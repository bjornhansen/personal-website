# Wallowa performance plan

## Goal and status

Keep `/wallowa` a beautiful, game-like experience that feels as quick to open
as a static website and runs comfortably on older computers and phones.
Target first interactive 3D in **under two seconds on an agreed reference
device/network profile**, with quality degrading gracefully when needed.
Sustained power consumption matters alongside frame rate: a smooth scene
that makes a modern laptop hot is not meeting the goal.

This document records the performance investigation and proposed direction.
No optimizations or benchmark instrumentation described here have been
implemented as part of that investigation. Findings below come from source
inspection and GLB geometry counts, not runtime CPU/GPU measurements. A
browser was not connected during the investigation.

The reported symptom is sustained heat and fan activity on an M5 Pro MacBook
Pro. The leading hypothesis is excessive sustained GPU work, but profiling
must establish the actual bottlenecks before larger changes.

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
  zone, so record/fix that too. `speed=0` does not freeze animation time or
  random fish jumps; a fully deterministic benchmark needs seeded events and
  a repeatable camera/interaction sequence.
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

Use 16.7 ms (60 FPS) and 33.3 ms (30 FPS) as initial frame budgets, leaving
headroom for interaction and device variability. Report tail behavior, not
just average FPS. Keep any debug HUD opt-in, outside the normal experience.

### One-change-at-a-time experiments

1. DPR 2 versus 1 at a fixed viewport and frame-rate policy.
2. Uncapped versus 60 versus 30 FPS at fixed resolution.
3. Freeze the reflection texture while keeping water animated, then vary
   reflection resolution, samples, and update rate.
4. Replace terrain detail shading with a simple baseline material.
5. Replace sky shading with a simple baseline sky.
6. Reduce vegetation independently; then disable shadows and mist separately.

Compare frame times and sustained energy use, and capture matching views for
visual review. Do not infer savings from triangle counts or pixel ratios
alone. Once individual costs are understood, test the combined presets.

## Implementation order

- [ ] Add opt-in benchmark instrumentation, deterministic scenarios, quality
      overrides, and exportable results. Establish baseline measurements.
- [ ] Cap FPS/pixel work and reduce reflection cost; compare visual quality
      and sustained power use on reference hardware.
- [ ] Cache terrain detail and reduce sky shading/overdraw.
- [ ] Add spatial chunks, LOD, and pass-specific detail filtering.
- [ ] Improve startup through progressive loading, asset delivery, and
      build-time/worker generation, guided by startup traces.
- [ ] Tune adaptive presets and validate cold startup plus sustained runs on
      older desktop/mobile devices. Investigate WASM only if CPU profiles
      justify it.

Update this document with measured results, chosen budgets, and completed
steps as work lands. Preserve the lake, lighting, silhouettes, and close-up
detail first; make distant, repeated, and slowly changing work cheaper.
