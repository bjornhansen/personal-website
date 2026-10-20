```
____                                   __  __                                             
/\  _`\    __                          /\ \/\ \                                            
\ \ \L\ \ /\_\    ___   _ __    ___    \ \ \_\ \     __      ___     ____     __    ___    
 \ \  _ <'\/\ \  / __`\/\`'__\/' _ `\   \ \  _  \  /'__`\  /' _ `\  /',__\  /'__`\/' _ `\  
  \ \ \L\ \\ \ \/\ \L\ \ \ \/ /\ \/\ \   \ \ \ \ \/\ \L\.\_/\ \/\ \/\__, `\/\  __//\ \/\ \ 
   \ \____/_\ \ \ \____/\ \_\ \ \_\ \_\   \ \_\ \_\ \__/.\_\ \_\ \_\/\____/\ \____\ \_\ \_\
    \/___//\ \_\ \/___/  \/_/  \/_/\/_/    \/_/\/_/\/__/\/_/\/_/\/_/\/___/  \/____/\/_/\/_/
          \ \____/                                                                         
           \/___/                                                                                                                    
```

Code for Bjorn Hansen's personal website built with Next.js. Feel free to use or borrow parts of this repo!

## Wallowa Camp (`/wallowa`)

A full-page 3D experience: an explorable campsite on the shore of an alpine
lake in the Wallowa Mountains, guided by a quiet black bear named **Bear**.
Stack: `three` + `@react-three/fiber` + `@react-three/drei` + `zustand`.
Everything is procedural (terrain, lake, sky, day/night from the real sun
and moon position at the visitor's location and clock) except vegetation models from the CC0 Quaternius Ultimate Nature
Pack (`public/models/nature/`, converted via `scripts/convert-nature-pack.mjs`)
and an original CC0 rigged bear generated with Blender (`public/models/bear.glb`).

Behavior conventions:
- Content belongs in the game world (dialogue, signs, dioramas) — not DOM
  cards or website-style overlays.
- Camera uses authored viewpoints, not free orbit. Hotspots / nav fly the
  camera; Esc returns to camp.
- Deferred loading: the scene paints first; vegetation and Bear stream in
  after (`Suspense` / deferred fetch).
- Bear: an original vertex-colored, skinned low-poly model plays Walk on
  its approach and Idle on arrival. The walk cycle follows distance traveled
  using the GLB's stride metadata; reduced motion skips the approach and
  freezes the pose. The procedural bear remains a fallback if the asset is absent.
- Bear review: `/wallowa/bear` is a separate studio with orbit, camera presets,
  playback speed, pause, bones, and export reload controls. Source files,
  regeneration, and validation are documented in [Bear asset](docs/bear-asset.md).
- Animal library: CC0 Quaternius deer, stag, fox, and wolf GLBs and editable
  Blender sources are imported for future scene placement. See
  [Animal assets](docs/animal-assets.md) for clips, source links, and integration notes.
- Respects `prefers-reduced-motion`; mobile gets reduced counts and DPR clamp.

Sky, light, and water:
- `sun.js` computes sun/moon position and moon phase; the scene treats -z as
  south (camera looks up-lake at the peaks), +x as west.
- Visitor location: `?lat&lng` override → device geolocation (only if already
  granted; never prompts) → Vercel IP geolocation via `/api/geo` → a
  timezone-based guess.
- `palette.js` keyframes every sky/light/fog/water color by sun altitude;
  `DayNight.js` (`Atmosphere`) samples it and writes the shared uniforms in
  `atmosphere.js`. Sky dome, fog, lake, and mist all read those, so the
  horizon and the fog always match. Materials opt into the directional fog
  with `withAtmosphere(material, key)`.
- Tone mapping is `NeutralToneMapping`; custom shaders must end with
  `tonemapping_fragment` + `colorspace_fragment` (or `toDisplay()`) so they
  match fog, which three applies after tone mapping.
- Shadows render on demand (`shadowMap.autoUpdate = false`): when the light
  moves, the object count changes, or Bear is walking.
- Lake is a planar `Reflector` with a baked depth texture; ripple rings come
  from fish jumps and clicks (`uRipples`), splashes emit `splash` in the
  store for the audio.
- Terrain (`heightfield.js`, React-free): an explicit shoreline (ellipse
  from `LAKE` with low-frequency angular wobble, damped near camp) with a
  beach whose slope varies along the shore and a basin profile inside; a
  calm valley floor that rises gently away from the lake, with
  derivative-damped "eroded" fbm hills (`erodedFbm` in `noise.js`) that are
  flattened inside `meadowMask`; ridged peaks at the back (−z) and a soft
  rise toward the side edges. The floor never drops below lake level away
  from the shore, so there are no stray puddles. The world seed is pinned
  (`WORLD_SEED` in `noise.js`, default 1849, `?seed=` override).
- Ground contact: `terrainMesh.js` bakes the 257² height grid the terrain
  geometry is built from and `groundHeight()`/`groundContact()`/
  `groundNormal()` sample those exact triangles. Everything that sits on the
  ground (vegetation, props, Bear, camera clamp) uses them; instances sink
  to the minimum of a small contact ring and rocks/logs tilt to the slope.
- Deterministic math: `dmath.js` (sin/cos/atan2/pow6 from basic arithmetic)
  is used by heightfield, creek and trail code because V8 versions differ by
  an ulp in those functions and the creek route walk is chaotic — Node and
  Chromium picked different routes for the same seed before this.
- Creek: an inlet stream descends from the mountain foot at the back of
  the lake into its shore (`creekbed.js`). The source is chosen from a
  ring of candidates around the lake (camp/trail side excluded), the route is
  a gradient-descent walk toward the lake with meander, and the bed is the
  running minimum of the terrain along it (so it carves through small humps
  instead of stopping). A 512² distance + bed-height field carves the channel
  into `terrainHeight`, so trails/placement/depth stay consistent. The bed
  reads as dark wet stone through the ground map's alpha channel
  (`CREEK = 3`) plus darkened vertex colors; the water is one static ribbon
  (`Creek.js`) whose surface sits a fixed depth above the bed, floods to lake
  level at the mouth, and uses a scrolling-noise shader with analytic sky
  reflection and foam — no extra render passes. The lake's depth bake uses
  the carved `terrainHeight` at 192×240 so the lake fills the flooded
  mouth, and the ribbon fades out as the channel floods. Placement must avoid
  `creekDistance()` (trees ≥ `CREEK_BANK_RADIUS + 2.5`, grass/pebbles ≥
  `CREEK_HALF_WIDTH + 1.5`). `npm run test:wallowa-creek` checks the route
  across seeds; `node scripts/wallowa-creek-probe.mjs <seed> --map` prints
  stats and an ASCII map.
- Ground detail: `groundMap.js` is a shared texture (R contact shadow,
  G canopy/forest floor, B dirt, A creek/wet) painted by Forest, CampProps,
  and the trails in `trails.js`; placement code should avoid
  `trailDistance()` and `creekDistance()`.
- Debug params: `?t=19.5` (local hour), `?date=2026-06-21`, `?speed=600`
  (timelapse), `?clouds=0..1`, `?lat=45.28&lng=-117.21`, `?cam=x,y,z&look=x,y,z`
  (fixed debug camera), `?fly=1` (free fly camera: WASD move, Q/E or
  Space/Ctrl for altitude, Shift sprints, drag or arrow keys to look; soft
  ground clamp; composes with `?cam`/`?look` for the spawn point).

### Performance goals and plan

Target a first interactive scene in under two seconds on defined reference
devices/networks, with graceful quality scaling for older machines and phones
and low sustained power use. See [Wallowa performance plan](docs/wallowa-performance.md)
for the current code-based findings, benchmark protocol, proposed quality
presets, and prioritized optimization work. An opt-in harness is available at
`/wallowa?bench=1`; `npm run bench:wallowa` runs repeatable production samples
with JSON exports. See the performance plan's quick start for setup and
experiment controls. Reference baselines and power measurements are still needed.

### Roadmap ideas (not yet built — do not implement without checking)

Goal: visitors learn about Bjorn and his work through play, not reading.

1. **Bear as the content vehicle** (top pick)
   - Follow-the-guide: Bear walks between spots, camera follows; facts
     arrive as speech-bubble dialogue in his dry PNW voice.
   - Campfire stories: at night, sitting at the fire triggers a
     multi-line story about a chapter of Bjorn's background, fire-lit.
2. **Discovery mechanics**
   - Hidden objects: 5–8 meaningful trinkets scattered in the world (tiny
     city skyline for City Detect, duck with Blackbird logo, coffee mug,
     trail permit with contact info). Bear comments on each find; finding
     all opens contact naturally.
   - Readable trail signs: in-world `Text` on the trailhead sign; trails
     double as navigation to story spots.
3. **Ambient/simulation mechanics**
   - Time-of-day as content: different experiences for day vs. night
     visitors; a reason to return.
   - Small toys: skip stones on the lake, toast marshmallows, feed the
     fire. Fun is retention; retention is when Bear's dialogue drip-feeds
     the story.
   - Stone-skipping browse mode: each skipped stone surfaces the next
     factoid as floating splash text.
4. **Bigger swings**
   - Diorama vignettes: fly to a spot and a miniature self-assembling
     scene tells that section's story (tiny rising city = City Detect).
   - Photography mode with a shareable postcard URL.
5. **Recommended first slice**: Bear-guided tours + readable trail signs +
   one hidden-object collectible + the campfire story at night.

Also on the shelf (from earlier discussion): terrain texture-splatting,
LODs for vegetation, and wind-sway shader for plants (see `AGENTS.md`).

## Getting Started

This is a [Next.js](https://nextjs.org/) project bootstrapped with [
`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The 3D experience lives at [http://localhost:3000/wallowa](http://localhost:3000/wallowa).

The homepage is `app/page.js` (App Router). This project uses `next/font/local`
with version-pinned Fontsource packages for Newsreader, JetBrains Mono, and
Hanken Grotesk. Both development and production use Turbopack; builds load font
files locally instead of fetching Google Fonts. See [Font loading](docs/font-loading.md).
