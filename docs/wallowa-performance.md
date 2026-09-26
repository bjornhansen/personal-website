# Wallowa performance plan

## Goal and status

Keep `/wallowa` a beautiful, game-like experience that feels as quick to open
as a static website and runs comfortably on older computers and phones.
Target first interactive 3D in **under two seconds on an agreed reference
device/network profile**, with quality degrading gracefully when needed.
Sustained power consumption matters alongside frame rate: a smooth scene
that makes a modern laptop hot is not meeting the goal.

This document records the performance investigation and proposed direction.
The benchmark plan was revisited against the current source on 2026-09-25.
An opt-in benchmark harness and Chromium runner are now implemented. Production
smoke checks cover deterministic placement, multipass counters, FPS limiting,
GPU query collection, reflection controls, diagnostic shaders, startup input,
and reduced motion. These short functional checks are not reference-device
baselines or optimization results. The workload hypotheses below still come
from source inspection and the earlier GLB geometry counts.

The reported symptom is sustained heat and fan activity on an M5 Pro MacBook
Pro. The leading hypothesis is excessive sustained GPU work, but profiling
must establish the actual bottlenecks before larger changes.

The next deliverable is a measured ranking of optimization targets. Start with
sustained rendering and power on the symptomatic MacBook, while measuring
startup separately. The experiment order below is an investigation sequence,
not a commitment to optimize reflections, shaders, or geometry first.

## Current workload and likely bottlenecks

Paths below are relative to `components/wallowa/` unless otherwise noted.

| Area | Current behavior | Performance implication |
| --- | --- | --- |
| Rendering (`Scene.js`) | Continuous R3F render loop; desktop DPR up to 2 with antialiasing; mobile DPR up to 1.75. No explicit FPS cap. | DPR 2 means four rendered pixels per CSS pixel. A browser scheduling at 120 Hz can attempt twice the frames of 60 Hz, including while the visitor is idle. |
| Reflection (`Lake.js`) | Planar `Reflector`, updated each rendered frame when visible. Desktop target is half the canvas width/height with 4× multisampling; mobile uses a 0.35 scale without multisampling. | Another scene render with geometry submission and shading. Lower target resolution reduces pixel cost but does not proportionally reduce geometry cost. |
| Terrain (`Terrain.js`, `glsl.js`) | 256×256 grid; multiple noise evaluations and four nine-cell Voronoi searches in the surface shader. | Significant per-fragment work, repeated in relevant passes. Terrain generation also samples complex height functions on the main thread during initialization. |
| Sky (`Sky.js`) | Clouds use 14 noise octaves; night adds stars and nine 3D-noise octaves for the Milky Way. Sky renders before opaque geometry. | Expensive screen coverage, including pixels later covered by terrain; also participates in reflection rendering. |
| Vegetation (`Forest.js`, `GroundCover.js`) | Instanced per model type across large areas, without distance LODs or spatial chunks. | Low draw-call count, but coarse culling and substantial vertex processing even for distant or offscreen instances in submitted batches. |
| Mist (`LakeMist.js`) | Four transparent noise-shaded layers, hidden when mist is negligible. | Additional overdraw in dawn/mist conditions; benchmark those separately. |
| Shadows (`DayNight.js`) | Cached after initialization; refreshed for light changes, scene object-count changes, and Bear's entrance. Desktop map is 4096², mobile 2048². | The nine-second walk is more expensive than settled rendering. Shadows are not normally regenerated every frame afterward. |
| Quality selection (`hooks.js`) | Mobile means narrow viewport or coarse pointer. | It does not measure device capability; mobile still uses the same expensive terrain/sky/water shaders. |
| Loading (`app/wallowa/page.js`, `Forest.js`) | Scene is dynamically imported; forest requests its model set together through `useGLTF(URLS)`. | Scene loading is deferred, but the forest component waits for its asset set. Progressive rendering inside the forest needs finer loading boundaries. |

Approximate geometry budgets from actual GLB triangle counts and configured
population targets:

| Preset | Instanced objects | Terrain + instanced triangles |
| --- | ---: | ---: |
| Desktop | 4,700 | 2.7 million |
| Mobile | 1,800 | 1.05 million |

These assume placement targets are filled and model variants are evenly
distributed. They are not measured visible-frame counts, exclude small
non-instanced scene objects, and do not include additional reflection/shadow
passes. Instancing reduces draw calls, not the triangles in each instance.

## Engine techniques to apply

### Visibility, chunks, and LOD

Three.js already performs object-level frustum culling. A large instanced
batch whose bounds intersect the view is still submitted; GPU clipping of
offscreen triangles happens after vertex processing.

- Partition vegetation into spatial chunks, retaining instancing per model
  type within each chunk. Benchmark chunk size against the extra draw calls.
- Add simpler distant tree geometry and progressively remove tiny distant
  grass/props. Use screen size or distance, with hysteresis/transitions to
  avoid obvious popping.
- Consider chunked terrain with distance-dependent detail if measurements
  justify it.
- Cull separately for the main camera, reflection camera, and shadow pass.
  Objects outside the main view can still be visible in water or cast visible
  shadows; do not globally hide them solely using the main camera.
- Fog does not itself remove rendering work. Add explicit distance cutoffs
  where appropriate.
- Full occlusion culling (behind mountains, etc.) is a later option. Start
  with chunking, distance culling, and LOD before adding that complexity.

The current repo convention is one instanced mesh per model type. Spatial
chunking is a proposed evolution to that convention, not permission to
replace instances with one mesh per tree. Update the convention when this
change is implemented.

### Cache expensive results and vary update rates

- Generate static terrain surface detail into reusable textures rather than
  repeating all of its procedural calculations per pixel per frame.
- Evaluate cached or lower-resolution sky rendering. Render the sky after
  opaque geometry, with depth testing, before transparent water, to avoid
  shading pixels already covered by opaque objects.
- Keep water animation smooth while updating reflections less frequently.
  Test 15–30 Hz reflection updates, capped target dimensions, and no MSAA.
  Account for camera movement and resulting reflection staleness.
- Use simplified geometry and omit tiny details in reflections/shadows.
- Preserve the existing on-demand shadow strategy.
- Explicitly pause unnecessary work when hidden and budget visible idle
  rendering. Reduced motion alone does not stop a continuous render loop.
  A demand loop requires deliberate animation/invalidation scheduling; just
  setting `frameloop="demand"` is not sufficient for this animated scene.

Procedural-first does not mean recomputing everything continuously. Generated
textures, geometry, and placement data can be cached at runtime or generated
at build time. Preserve shared atmosphere uniforms and time-of-day behavior;
separate static surface detail from changing lighting. Continue following the
asset licensing and placement rules in `AGENTS.md`.

### Workers, WASM, compression, and WebGPU

- **Build-time generation:** a strong option for fixed terrain/placement
  data. Balance computation saved against added transfer and decoding cost.
- **Web Workers:** generate geometry arrays, placements, and ground-map data
  without blocking input or first paint; transfer buffers back for upload.
  Workers improve responsiveness, not necessarily total compute time.
- **WASM:** consider only for measured CPU-heavy generation or decoding.
  It does not accelerate shaders already running on the GPU, reduce pixels,
  or remove reflection passes, and adds download/initialization costs.
- **Mesh compression / meshoptimizer:** evaluate transfer savings, decoding
  cost, and geometry layout alongside startup measurements.
- **WebGPU:** potentially useful for later GPU-driven rendering, but not a
  prerequisite for this scene. Weigh implementation/fallback costs and actual
  target-device support before migrating.

Keep Three.js/R3F initially. A heavier engine migration is not required to use
these techniques and could increase startup cost.

## Startup and adaptive quality

Track two distinct milestones:

1. **First attractive visual:** an immediate lightweight campsite preview or
   economical scene, rather than a prolonged loading screen.
2. **First interactive 3D:** the scene responds to input and its core view is
   ready. A preview alone does not satisfy the sub-two-second target.

Define reference devices, browser versions, network conditions, and cold-cache
behavior before treating that target as an acceptance criterion. Universal
two-second startup across all old devices/connections is not assumed.

Start with an attractive low-cost scene, then stream additional model variants
and detail independently. Prioritize the current authored camera view and
prefetch the next viewpoint. Budget shader compilation and GPU uploads too;
do not move a large stall just after first paint. Use compressed, cacheable
assets served through the CDN. A preview should not delay the interactive
scene's critical resources.

Proposed presets to benchmark, not finalized defaults:

| Setting | Low / battery saver | Balanced | High |
| --- | --- | --- | --- |
| FPS cap | 30 | 60 | 60 |
| Render resolution | Lower/adaptive | Moderate/adaptive | Higher, capped |
| Reflections | Cached or simple sky reflection | Reduced resolution, 15–30 Hz | Higher resolution/update rate |
| Vegetation | Aggressive LOD, little distant grass | Moderate LOD | More nearby detail |
| Shadows | Contact shading, limited dynamic shadows | Smaller cached map | Larger cached map |
| Sky/terrain | Cached detail, simpler shaders | Most visual features | Full detail |

Start conservatively; upgrade only with sustained headroom. Downgrade faster
than upgrading, with hysteresis/cooldowns to avoid oscillation. Stable FPS
alone is not proof of low energy use: keep sensible workload caps even on
powerful machines. Consider a user override/battery-saver preference, with
settings UI placement decided within the existing minimal-HUD convention.
Preserve reduced-motion behavior at every quality level.

## Benchmark protocol

### Establish a repeatable production baseline

```sh
npm run build
npm run start
```

- Record commit, device, OS/browser, viewport, actual drawing-buffer size,
  DPR, display refresh rate, power mode, and plugged-in/battery state.
- Use existing `t`, `date`, `lat`, `lng`, `clouds`, and `speed=0` parameters to
  fix celestial conditions. Time is interpreted in the browser's local time
  zone, so record/fix that too. `speed=0` does not freeze animation time,
  camera drift, or random fish jumps. `noise.js` shuffles its permutation
  table with `Math.random()` at module initialization, changing terrain,
  trails, and accepted vegetation placements between reloads. Forest and
  ground-cover placement have seeded generators but depend on that terrain.
  Seed the noise before dependent modules initialize, and use repeatable
  event timing and camera/interaction sequences in benchmark mode.
- Separate cold startup, the first 20 seconds (including Bear's walk), and
  settled rendering. Test overview, close-ups, and navigation transitions.
- Cover day, night, and dawn/mist. Keep sound state consistent.
- Run short repeatable samples several times, then 5–10-minute sustained
  tests to expose power use and thermal throttling. Keep other workloads and
  starting thermal conditions comparable.
- Test Safari and Chromium on Mac, plus real iPhone and lower-end Android
  hardware. Viewport emulation/CPU throttling cannot reproduce a phone GPU,
  memory bandwidth, or thermal behavior.

### Measurements and tools

| Tool / metric | Purpose |
| --- | --- |
| Chrome DevTools Performance | Main-thread time, long tasks, garbage collection, loading and interaction stalls. |
| Spector.js | Inspect actual WebGL draw calls, shader programs, render targets, reflection and shadow passes. Do timing runs outside captures. |
| Opt-in scene instrumentation | Frame-interval median/p95/p99, missed frame budgets, draw calls, submitted triangles, quality/DPR, startup milestones, exportable samples. |
| GPU timer queries, where supported | Asynchronous GPU timing; check support and discard disjoint/invalid results. CPU render-call duration is not GPU execution time. |
| Activity Monitor / Instruments | Sustained CPU/GPU activity and energy comparisons. FPS alone does not quantify heat or battery cost. |
| Lighthouse / loading traces | Startup and web delivery checks; not a substitute for sustained WebGL benchmarking. |

Aggregate `renderer.info` counters across the entire logical frame, including
reflection and shadow passes. Default per-render resets can hide multipass
work; control/reset counters once per logical frame when instrumenting.
Geometry/texture counts are not precise GPU-memory byte measurements.

Record rendered-frame cadence separately from CPU work per frame and GPU
execution time. Vsync or an FPS cap can hide an improvement behind identical
FPS. At 30 FPS, a 33.3 ms interval is intentional, not a missed 60 FPS deadline.
Report misses against the active cadence with a documented scheduling
tolerance. Record actual rendered FPS, not just requestAnimationFrame calls.
GPU timer queries should cover the whole logical frame first; nested main
and reflection queries of the same type are invalid. Use separate diagnostic
runs for pass-level timing if needed, and never force synchronization with
`gl.finish()` or synchronous readbacks during normal samples.

Use 16.7 ms (60 FPS) and 33.3 ms (30 FPS) as initial frame budgets, leaving
headroom for interaction and device variability. Report tail behavior, not
just average FPS. Keep any debug HUD opt-in, outside the normal experience.

## Running the benchmark harness

### Quick start

```sh
npm ci
npx playwright install chromium
npm run build
npm run start
```

In another terminal, run three production baselines on the local machine:

```sh
npm run bench:wallowa -- --experiment baseline
```

The runner opens a visible Chromium window, fixes the viewport to 1440×900,
device scale factor to 2, and timezone to `America/Los_Angeles`. It primes the
browser HTTP cache, waits for at least 20 seconds of scene time, loaded
vegetation/Bear, Bear arrival, and two seconds without a shadow refresh, then
collects 60 seconds. Each run uses a fresh document; it navigates to a blank
page for a default 30-second cooldown between runs. Use longer cooldowns when
needed to restore comparable thermal conditions. Avoid interacting with the
test window or switching away while sampling.

Raw samples, environment/configuration, build identity, placement fingerprint,
startup marks, generation spans, seeded event records, and per-run/minute
summaries go to `.context/wallowa-benchmarks/<timestamp>/`. Each run also gets
a screenshot taken after collection, and `summary.json` indexes the batch.
When the batch finishes, the runner prints and saves `report.md`/`report.json`
with per-label medians and ranges across runs, plus paired variant − baseline
deltas. Deltas that point in opposite directions across pairs are marked `?`.
Regenerate a report with `npm run bench:wallowa:report -- <results-dir>`.
Record external power measurements against these run IDs and timestamps.

Useful commands:

```sh
npm run bench:wallowa -- --experiment dpr
npm run bench:wallowa -- --experiment reflection
npm run bench:wallowa -- --experiment sky --scenario night
npm run bench:wallowa -- --experiment mist --scenario dawn
npm run bench:wallowa -- --scenario navigation
npm run bench:wallowa -- --scenario startup --cache cold --repeat 5
npm run bench:wallowa -- --experiment cadence --duration 600
npm run bench:wallowa -- --experiment dpr --repeat 1 --list
```

Each variant gets its own paired baseline, alternating A/B then B/A across
repetitions. Available experiments: `baseline`, `dpr`, `cadence` (uncapped and
30 FPS versus the 60 FPS default), `reflection`, `reflection-resolution`,
`reflection-msaa`, `reflection-cadence`, `terrain`, `terrain-bake` (procedural
detail versus the baked default), `sky`, `forest`, `ground-cover`, `shadows`,
`mist`, `overhead`, and `previous-default` (the pre-optimization defaults:
uncapped with procedural terrain detail). The DPR
experiment locks reflection dimensions across the pair. `--list` prints the
run URLs and profile without opening a browser.

Other runner options: `--url`, `--width`, `--height`, `--dpr` (browser device
scale factor), `--duration`, `--warmup`, `--cooldown`, `--repeat`, `--timezone`,
`--cache cold|warm`, `--channel chrome`, `--reduced-motion`, `--output`, and
`--metadata path/to/local.json`. Metadata JSON can supply device model, OS,
display refresh rate, power mode, plugged-in state, brightness, initial
thermal state, network profile, power tool, and notes. These are not inferred
from FPS. Network throttling is not applied by the runner; configure and
record it separately for delivery tests. Cold mode clears browser HTTP/site
data, not the OS, CDN, or GPU driver's shader caches.

`--headless` is available for functional checks, but use the visible browser
for reference measurements. Software renderers such as SwiftShader are marked
invalid for reference benchmarking. The initial headless smoke run exercised
this fallback; subsequent visible Chromium checks used hardware GPU timing.
The automation is Chromium-only; use the browser controls below for real
Safari/iPhone/Android measurements rather than treating emulation as hardware.

### Browser controls and exports

Open `/wallowa?bench=1` for an automatic day run with an export/stop panel.
All overrides are ignored without `bench=1`. The full collector/UI module is
dynamically loaded only for benchmark visits. The normal scene uses the
capped production loop described under "Implemented optimizations"; benchmark
mode drives rendering with the same frame-cap logic. Reload or navigate afresh
for every run.

| URL parameter | Default | Meaning |
| --- | --- | --- |
| `scenario` | `day` | `day`, `night`, `dawn`, `navigation`, or `startup`. Startup samples immediately and clicks the building nav button after 0.5 seconds to probe input response. |
| `seed` | `1849` | Seeds terrain noise before module initialization and an independent fish/splash stream. Existing vegetation seeds remain fixed. |
| `warmup`, `duration` | `20`, `60` | Seconds; readiness gates still apply with a shorter warm-up. Startup bypasses warm-up. |
| `fps` | `60` | Rendered-FPS target, snapped to whole display refreshes like production (`0` = every refresh). Skipped frames also skip R3F updates. |
| `budgetFps` | `60` | Reporting budget for uncapped runs. Capped runs use their requested FPS budget. |
| `dpr` | Existing device clamp | Explicit main-view render DPR. This is distinct from the runner's browser `--dpr`. |
| `reflection` | `live` | `frozen` retains a fully populated reflection after warm-up, while water animation continues. |
| `reflectionWidth`, `reflectionHeight` | Derived from DPR | Explicit target pixels; supply both to isolate main-view DPR changes. |
| `reflectionScale`, `reflectionSamples`, `reflectionFps` | Existing scale/MSAA, uncapped | Independent reflection resolution scale, MSAA samples, and update cap. Explicit dimensions take precedence over scale. |
| `terrain`, `sky` | `full` | `simple` uses diagnostic shading with the existing geometry and shared atmosphere. `terrain=procedural` restores the pre-bake per-pixel detail noise for A/B runs. |
| `forest`, `groundCover` | `1` | Fraction of each existing instanced batch to submit (0–1); generate all placements/ground footprints and retain full bounds first. |
| `shadows`, `mist` | `on` | `off` disables that feature independently. |
| `camera` | `animated` | `fixed` removes drift and snaps to authored destinations for diagnostic comparisons. |
| `metrics`, `gpu`, `panel` | `on` | `off` disables collection, GPU queries only, or the DOM panel respectively. |
| `label` | `baseline` | Human-readable experiment label included in the export. |

Benchmark sky defaults are the June 21 Wallowa fixtures in the protocol.
Existing `t`, `date`, `lat`, `lng`, `clouds`, and `speed` still override them.
The timezone is the browser's timezone; URL parameters do not change it.
The sampling boundary resets ambient animation time, camera position, and the
seeded lake simulation for matched views. Fish physics uses fixed 1/60-second
steps in benchmark mode; camera interpolation remains frame-rate dependent,
so compare transitions as timed workloads rather than pixel-identical frames.

For automation or manual metadata, the opt-in console API is:

```js
window.wallowaBenchmark.status()
window.wallowaBenchmark.setMetadata({ device: 'M5 Pro MacBook Pro', pluggedIn: true })
window.wallowaBenchmark.result()
window.wallowaBenchmark.download()
```

The page emits `wallowa-benchmark-complete` with the result after pending GPU
queries drain, then stops rendering. Mid-run exports are explicitly incomplete.
Hidden tabs, resize/DPR changes, lost contexts, errors, manual input, missing
readiness, and invalid parameters are recorded as invalid runs. Stop/export
during collection also interferes with that run; export after completion.

### What is measured and what still needs external tools

- `cpuUpdateMs` covers R3F frame callbacks; `cpuSubmitMs` wraps the complete
  outer render including nested reflection submission. Neither is GPU time,
  and neither includes all unrelated React, network, or browser CPU work.
- Whole-frame GPU queries resolve asynchronously, with invalid/disjoint
  results discarded. Unsupported/disabled timing is explicit; there is no
  synchronous GPU wait. Use `gpu=off` for a Spector capture or another GPU
  timing tool to avoid conflicting queries.
- Draw/triangle counts span all passes. `reflectionPasses` counts nested
  renderer calls (currently the lake); `shadowUpdates` counts consumed shadow
  update requests, not individual caster draws. Functional checks independently
  wrap WebGL draw calls and verify totals against the export. A Spector capture
  for visual pass attribution and an external overhead comparison remain part
  of baseline collection.
- `core-first-frame-submitted` and `first-input-frame-submitted` are CPU-side
  submission milestones. The latter records a real camera change after the
  input request, tagged as synthetic when scripted. They do not certify display
  presentation or visual attractiveness. Use a loading trace/filmstrip before
  claiming the first-interactive or first-attractive-visual targets.
- Generation spans cover terrain, lake depth, forest, and ground cover.
  Resource timings and buffered long tasks supplement them. Use DevTools for
  JS/GLB parsing, shader compilation, uploads, and stalls outside those spans.
- `metrics=off` preserves deterministic scenarios, the scheduler, and readiness
  checks while disabling sample collection/render wrapping/GPU timing. Compare
  it externally with normal collection; it is not a zero-overhead normal-page
  mode. Power/energy and thermal measurements are external and still pending.

Harness checks:

```sh
npm run test:wallowa-benchmark
npm run lint
npm run build
npm run start -- --port 3100
```

In another terminal, `npm run test:wallowa-benchmark:smoke` runs visible Chromium
against port 3100 (an alternate origin can be passed after `--`). It verifies
repeatable placement, actual WebGL draw totals, reflection freeze/rate and
target controls, simple shaders, reduced-motion readiness, startup input,
invalid-config handling, and the normal route. Smoke screenshots/JSON are
stored under `.context/wallowa-benchmarks/`; smoke runs are deliberately short
and must not be used to rank optimization targets.

## Execution plan: find the best first target

### 1. Build the minimum measurement harness

The initial opt-in benchmark mode is implemented as documented above. Keep
collection in refs/buffers rather than React state updated every frame and
export after sampling. Use the integration checklist below when extending it
or validating the reference baseline.

| Integration point | Required control or measurement |
| --- | --- |
| `Scene.js` and a new benchmark module | Actual DPR/drawing-buffer dimensions, rendered frames, CPU update/submission duration, whole-frame GPU queries when available, multipass counters, configuration and run ID. |
| `noise.js`, `Lake.js`, `CameraRig.js` | Seeded terrain and fish/splash events; repeatable animation start and navigation schedule. Establish the noise seed before module-level terrain/trail generation. Avoid globally replacing `Math.random`. |
| `Lake.js` | Freeze a valid, fully populated reflection after warm-up; independently override target dimensions, MSAA samples, and update frequency. Keep water/ripples running. |
| `Terrain.js`, `Sky.js`, `Forest.js`, `GroundCover.js`, `LakeMist.js`, `DayNight.js` | Independent diagnostic material/visibility/count controls and observed shadow refreshes. Preserve baseline placement and ground-map data for rendering-only comparisons. |
| `app/wallowa/page.js` and scene/asset initialization | Navigation-relative startup marks, scene readiness, vegetation readiness, generation/upload/compile stalls, and first demonstrated input response. |

Measure once before updates and once after the outer render, including the
reflection render. A `useFrame` callback alone normally runs before R3F's
automatic render and is insufficient for end-of-frame totals. Any render-loop
takeover must preserve update ordering and execute exactly one outer render.
An FPS cap must skip real rendering work, not just skip the metrics callback.
Keep animation progression based on elapsed time when frames are skipped.

Acceptance for the harness:

- Repeated reloads with the same seed reproduce geometry counts, initial
  camera, and event schedule. Reset store and animation state between runs.
- Verify reflection/shadow pass counts with one Spector capture; do timing
  runs without captures, DevTools recording, or an updating debug HUD.
- Compare instrumentation on/off using external tools to estimate overhead.
  Unsupported GPU timing exports `unavailable`, not a CPU-derived estimate.
- Export commit plus dirty-diff identity, scenario/configuration, environment,
  readiness marks, raw samples, summaries, and invalid-run reasons. Reject
  hidden-tab, resized, context-lost, or incomplete-load samples.

### 2. Establish a small, representative baseline

Start on the M5 Pro MacBook Pro where heat was reported, using a production
build in Chromium. Record the actual hardware and display configuration;
propose a fixed 1440×900 CSS viewport with native DPR capped by the current
scene as the first desktop profile. Keep brightness, power mode, sound off,
and background workload consistent. Record refresh rate rather than assuming
60 Hz. Confirm the baseline and eventual finalists in Safari on the same Mac.

Use `date=2026-06-21`, `lat=45.28`, `lng=-117.21`, `clouds=0.35`, `speed=0`,
and timezone `America/Los_Angeles`. Start with `t=12` for day, `t=0` for night,
and `t=5` for dawn. Verify/export actual sun altitude and mist strength before
locking these fixtures; a clock label alone does not prove a mist workload.

| Scenario | Sampling procedure | Question answered |
| --- | --- | --- |
| Cold and warm startup | Five fresh-document navigations each; cold uses cleared browser site/HTTP cache, warm retains asset cache. Capture navigation through first interactive 3D and the next 20 seconds. | Is waiting dominated by delivery, JS, generation, shader compilation, or GPU uploads? |
| Settled day overview | Wait at least 20 seconds after the first scene frame, all expected assets, Bear arrival, and stable shadow refresh counts; then sample 60 seconds. | What is the default sustained workload? |
| Settled night and dawn overview | Same readiness and 60-second window, one fixture each. | Do sky or mist change the bottleneck? |
| Navigation | After warm-up, run overview → building → background → contact → overview, holding each destination for 10 seconds; repeat the same input schedule. | Do close-ups or transitions change costs or cause stalls? |

Do three baseline runs per settled/navigation scenario. Keep camera drift and
ambient animation active but repeatable. Compare matched elapsed-time views;
use a separate fixed-camera diagnostic if motion obscures attribution. Add a
reduced-motion check that verifies Bear arrival and shadow refresh behavior
instead of assuming that elapsed time alone guarantees a settled scene.

For startup, define the core view as terrain, sky, lake, campsite props, and
working navigation. Record vegetation readiness separately and use a filmstrip
to assess first attractive visual. A mounted Canvas or loading text is not
first interactive 3D: demonstrate input reaching the camera in a rendered
frame. Use localhost for render isolation; measure delivery on a deployed
production build. Propose 10 Mbps down / 2 Mbps up / 80 ms RTT as the initial
controlled network profile, recorded with browser/throttling method. Confirm
the reference device/network before judging the two-second goal. Browser-cold
does not imply cold CDN, OS, or driver shader caches; document cache scope.

### 3. Screen costs with one-factor experiments

Run the day overview first, adding night for sky and dawn for mist. Use three
paired baseline/variant runs of 60 seconds each after warm-up, alternating
order (A/B, B/A, A/B) and allowing comparable thermal recovery. Reuse baseline
configuration for every new experiment rather than accumulating changes.

| Experiment | Controlled comparison | What a large improvement would suggest |
| --- | --- | --- |
| Main render resolution | Baseline DPR versus 1 at fixed viewport/cadence, holding reflection target pixels fixed. Then measure the normal coupled DPR change separately. | Main-view pixel/shader work is a useful target. `Lake.js` currently scales reflection dimensions with DPR, so the coupled result alone cannot isolate it. |
| Render cadence | Current uncapped policy versus 60 and 30 rendered FPS at fixed pixel sizes. Verify achieved rates. | Avoiding excess frames may address heat even if per-frame cost stays the same. |
| Reflection pass | Baseline versus a frozen, fully initialized reflection with animated water. | Upper bound on recurring reflection-pass savings; then test smaller targets, zero MSAA, and 30/15 Hz updates individually. |
| Terrain shading | Same terrain geometry, depth coverage, lighting/fog contract; substitute a simple detail-free material. | Terrain fragment work merits caching/simplification. |
| Sky shading | Same sky geometry/coverage/order; substitute a simple gradient using shared palette colors. | Procedural sky work merits caching, fewer octaves, or a later draw order. |
| Forest and ground cover | Separately render 100%, a stable 50% subset, and 0% of existing instances after initialization. Preserve transforms and baked ground footprints. | Vegetation rendering merits a follow-up on vertex cost, overdraw, and chunk/LOD tradeoffs. Counts alone do not isolate those costs. |
| Shadows | Disable shadows separately during entrance and settled windows. | Distinguish map-generation cost from ongoing shadow sampling; count actual refreshes. |
| Mist | Disable just the mist layers in the verified dawn fixture. | Transparent noise/overdraw is a dawn-specific target. |

Material removal and visibility toggles are diagnostic upper bounds, not
shippable improvements. Their gains overlap across main/reflection/shadow
passes and must not be added together. Follow up the top two contributors
with focused tests, such as terrain simplification with reflection frozen,
to distinguish shared costs. Check CPU traces before attributing all savings
from reduced geometry to the GPU.

### 4. Rank targets and validate a realistic candidate

Rank sustained-power and startup results separately. For the reported heat
problem, prioritize lower sustained power at acceptable visual quality and
frame pacing. Use GPU milliseconds/frame and CPU work to explain the result;
equal FPS at vsync is not evidence of equal cost.

- Summarize each run independently: median/p95/p99 frame interval, budget
  misses, CPU work, GPU time if supported, draw calls/triangles, and startup
  marks. Report median and range across runs; do not pool frames and treat
  them as independent repetitions. Five startup runs support a median/range,
  not a reliable startup p99.
- Use a repeatable improvement exceeding baseline run-to-run variation as
  the first filter. A proposed practical shortlist threshold is roughly 10%
  lower GPU time or sustained power, or a clear reduction in missed budgets;
  smaller cheap wins can still qualify. Rerun ambiguous results.
- Turn the best diagnostic result into one quality-preserving candidate, then
  compare baseline/candidate in three paired 10-minute sessions. Record
  minute-by-minute power/activity and frame pacing to expose thermal drift.
  Record watts/joules only where tooling actually provides them; Activity
  Monitor Energy Impact is a relative indicator, not watts. Report system
  power as system-wide and include a same-environment idle reference.
- Capture matching screenshots and navigation clips outside timing runs.
  Review lake/reflection stability, silhouettes, lighting, close-up detail,
  aliasing, and motion smoothness. Frozen reflections or missing forests are
  not acceptable final quality comparisons.
- Validate finalists in Safari, then on an available older integrated-GPU
  laptop, a real iPhone, and lower-end Android. Record exact models/browser
  versions and device-specific winners. Confirm reduced motion and sound-on
  behavior, and measure visible idle versus hidden-tab work separately.

Choose the first target using measured savings, affected scenarios/devices,
visual cost, implementation effort, and confidence. If cadence alone reduces
heat enough, it can win ahead of a shader rewrite. If generation dominates
startup but not settled work, give it a separate startup priority. If no
candidate exceeds measurement noise, improve the experiment before choosing.

### 5. Record the decision and implement in measured order

Keep raw local JSON, traces, screenshots, and environment notes under
`.context/wallowa-benchmarks/<run-id>/`; this directory is gitignored. Add
compact result summaries here, with durable artifact links if shared beyond
the workspace.

#### Quick screening, 2026-09-25

M5 Pro MacBook Pro (Mac17,9), AC power, built-in 120 Hz display. Production
build in Playwright Chromium at 1440×900 CSS px, DPR 2. Each variant ran two
alternating pairs against its own baseline, with 15-second samples after
readiness; all 68 runs were valid. Baseline-to-baseline spread was 0–3%.
GPU values are whole-frame timer queries: mean ms per frame, and "busy" = mean
ms × rendered FPS. No power meter was used, and startup was not measured.

The uncapped baseline renders about 108 FPS (not a steady 120) at 8.1 ms GPU
per frame, so the GPU is about 87% busy. Its p95 frame interval is 16.7 ms,
meaning some frames drop to 60 Hz pacing. Each frame submits 100 draw calls
and 5.4M triangles across the main and reflection passes.

| Target / candidate | Device / scenario | GPU ms Δ (per frame) | GPU busy Δ | CPU ms Δ | Pacing / misses Δ | Power Δ + source | Startup ms Δ | Visual cost / effort | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Render cap 60 FPS | M5 Pro / day | +1% | −43% | negligible | Misses +7 pp vs 60 budget (timer-based cap) | Unmeasured | — | None on 60 Hz; low effort | Shortlist; cap must align to vsync |
| Render cap 30 FPS | M5 Pro / day | +2% | −72% | negligible | Misses +11 pp vs 30 budget | Unmeasured | — | Visible motion cost; low effort | Candidate for low-power/adaptive preset |
| Main DPR 2 → 1 (reflection locked) | M5 Pro / day | −41% | −35% | negligible | — | Unmeasured | — | Softer image; low effort | Overlaps terrain; test 1.5/adaptive |
| Simple terrain material | M5 Pro / day | −38% | −32% | negligible | — | Unmeasured | — | Diagnostic upper bound | Shortlist: bake static detail noise |
| Reflection frozen | M5 Pro / day | −21% | −13% | negligible | — | Unmeasured | — | Diagnostic upper bound | Shortlist: cut reflected content/rate |
| Reflection 15 / 30 Hz | M5 Pro / day | −17% / −14% | −9% / −5% | negligible | — | Unmeasured | — | Possible lag with camera motion | Follow-up |
| Reflection scale 0.5 → 0.25 / MSAA 4 → 0 | M5 Pro / day | −5% / −5% | ~0% | negligible | — | Unmeasured | — | Low | Minor |
| Forest 0% / 50% | M5 Pro / day | −19% / −8% | −9% / 0% | negligible | — | Unmeasured | — | Diagnostic (3.8M of 5.4M triangles) | Lower priority than triangle share suggests |
| Simple sky | Night / day | −18% / −7% | ~0% | negligible | — | Unmeasured | — | Diagnostic | Night-specific follow-up |
| Shadows off | M5 Pro / day | −9% | −1% | negligible | — | Unmeasured | — | Diagnostic | Minor |
| Mist off | Dawn | −8% | −1% | negligible | — | Unmeasured | — | Diagnostic | Dawn-only, minor |
| Ground cover 0% / 50% | M5 Pro / day | −7% / −4% | ~0% | negligible | — | Unmeasured | — | Diagnostic | Minor |

#### Implemented optimizations, 2026-09-25

Three changes followed from the screening:

- **Frame cap on whole display refreshes** (`frameCap.js`, `CappedFrameloop`
  in `Scene.js`). The Canvas uses `frameloop='never'`; a rAF loop measures the
  median refresh interval and renders every Nth refresh, with
  N = round(refresh interval for 60 FPS ÷ measured interval). That gives 60
  FPS on 60/120/240 Hz, 72 on 144 Hz, and 75 on 75 Hz. A late rAF counts
  the refreshes it actually spanned, so pacing stays on vsync. Benchmark mode
  uses the same cap (`fps`, default 60).
- **Baked terrain detail** (`terrainDetail.js`). Position-only terrain
  noise is rendered once on the GPU at mount into three mipmapped,
  anisotropically filtered targets. A 1024² world field over the 420-unit
  ground holds the low-frequency fbm/value noise. Two tiles repeat every 20
  units: a 1024² detail tile (fine noise, stone edge distance and ID, grit)
  and a 512² facet tile. They use lattice-wrapped noise and are seamless
  because each frequency × 20 is an integer. Raw noise is stored and the
  existing smoothsteps run after filtering, so mask edges stay sharp. Only
  the sub-texel flower petals and the cheap strata noise remain per-pixel.
  The bake uses about 12.6 MB of GPU memory.
- **Motion-aware reflection updates** (`reflectionSchedule.js`, `Lake.js`).
  The reflection re-renders when the camera has moved more than 0.1 units or
  turned more than 1° since the last update, every frame until the Bear
  arrives, and otherwise at least once per second (clouds, mist, sun).
  The lake samples the reflection through the stored texture matrix, so a
  reflection that hasn't updated yet stays consistent with the viewpoint it
  was rendered from. It doesn't slide with the screen, and 0.1 units of drift
  is under a pixel of parallax at lake distances.

Visual check (numeric, no screenshots): `scripts/wallowa-terrain-compare.mjs`
reads back per-16×16-block colour means and luminance contrast for procedural
and baked terrain in four fixed-camera views. Two procedural loads differ by
≤ 0.02/255, so the comparison is deterministic. Baked versus procedural block
means differ by 0.7/255 in the overview and 1–2.3/255 in close-ups. Close-up
fine-detail contrast is 1–4% lower; filtering removes some of the aliasing
the per-pixel shader had. Doubling every bake resolution did not change the
block differences, so they come from the tiles' different random instances
of the fine patterns. Halving the world field from 2048² to 1024² had no
measurable effect.

Validation on the same M5 Pro, 30-second samples (navigation: 50 seconds),
all runs valid:

| Comparison | Pairs | GPU ms/frame (mean) | GPU busy | FPS | Notes |
| --- | --- | --- | --- | --- | --- |
| Baked vs procedural terrain (both 60 FPS cap) | 3 | 6.12 vs 8.23 (−26%) | 36.7% vs 49.4% | 60 / 60 | Baseline noise 1% |
| Scheduled vs every-frame reflection, day | 3 | 5.78 vs 6.19 (−7%) | 34.7% vs 37.1% | 60 / 60 | 56 updates in 30 s (1.9 Hz); draw calls 49 vs 100 |
| Scheduled vs every-frame reflection, navigation | 2 | 5.69 vs 6.02 (−5%) | 34.1% vs 36.2% | 60 / 60 | Updates on 15% of frames through transitions |
| **New defaults vs previous defaults** (uncapped, procedural, every-frame reflection) | 3 | 5.75 vs 8.01 (−28%) | **34.5% vs 87.2% (−60%)** | 60 vs 108 | p95 interval 17.5 ms, no missed frames |

Baking the terrain also made the reflection cheaper, because the reflection
pass re-renders the terrain. That's why the reflection schedule now saves
about 0.4 ms per frame, compared with 1.7 ms for a frozen reflection in the
screening. Power draw still needs an external reading.

Removing work mostly raised FPS toward 120 instead of lowering GPU busy
time, because the uncapped loop refills the GPU. Per-frame savings only turn
into less heat once rendering is capped. Diagnostic savings overlap
(terrain and DPR are both pixel costs, and the reflection re-renders terrain
and forest), so they must not be added together. Short samples and a single
machine make this a screening result: confirm finalists with 60-second or
10-minute paired runs and external power readings.

- [x] Add and verify the opt-in harness and deterministic fixtures.
      Unit tests, lint, the production build, and visible-Chromium smoke
      checks pass. A short reflection A/B verified the runner and report.
- [ ] Record production baselines and startup traces on the reference Mac.
- [ ] Run one-factor screening; publish ranked costs and uncertainty.
      Quick 15-second screening on the M5 Pro is recorded above; longer
      paired runs with power readings are still needed for finalists.
- [ ] Prototype the leading quality-preserving optimization; validate paired
      sustained runs, visuals, and representative devices.
      The frame cap, terrain bake, and reflection schedule are implemented and
      validated on the M5 Pro in Chromium (above). Still to do: 10-minute
      power runs, Safari, and representative mobile/older devices.
- [ ] Select and implement the first target based on that evidence; run lint
      and a production build for scene changes, then repeat affected scenarios.
- [ ] Establish a new baseline and choose the next target from residual costs.
      Tune combined/adaptive presets after individual tradeoffs are understood.

Update this document with measured results, chosen budgets, and completed
steps as work lands. Preserve the lake, lighting, silhouettes, and close-up
detail first; make distant, repeated, and slowly changing work cheaper.
