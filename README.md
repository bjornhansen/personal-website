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
Pack (`public/models/nature/`, converted via `scripts/convert-nature-pack.mjs`).

Behavior conventions:
- Content belongs in the game world (dialogue, signs, dioramas) — not DOM
  cards or website-style overlays.
- Camera uses authored viewpoints, not free orbit. Hotspots / nav fly the
  camera; Esc returns to camp.
- Deferred loading: the scene paints first; vegetation and Bear stream in
  after (`Suspense` / deferred fetch).
- Bear upgrade path: drop a rigged, animated GLB at
  `public/models/bear.glb` and it replaces the procedural bear automatically
  (plays Walk on the way in, Idle on arrival).
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
- Ground detail: `groundMap.js` is a shared texture (R contact shadow,
  G canopy/forest floor, B dirt) painted by Forest, CampProps, and the trails
  in `trails.js`; placement code should avoid `trailDistance()`.
- Debug params: `?t=19.5` (local hour), `?date=2026-06-21`, `?speed=600`
  (timelapse), `?clouds=0..1`, `?lat=45.28&lng=-117.21`.

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
LODs for vegetation, wind-sway shader for plants, and a rigged CC0 bear GLB
(see `AGENTS.md`).

## Getting Started

This is a [Next.js](https://nextjs.org/) project bootstrapped with [
`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The 3D experience lives at [http://localhost:3000/wallowa](http://localhost:3000/wallowa).

The homepage is `app/page.js` (App Router). This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Newsreader, JetBrains Mono, and Hanken Grotesk.