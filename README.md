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
Everything is procedural (terrain, lake, sky, day/night from the visitor's
local clock) except vegetation models from the CC0 Quaternius Ultimate Nature
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

Also on the shelf (from earlier discussion): terrain texture-splatting +
domain-warped/erosion noise for the heightfield, vertex AO, LODs for
vegetation, wind-sway shader for plants, and a rigged CC0 bear GLB (see
`AGENTS.md`).

## Getting Started

This is a [Next.js](https://nextjs.org/) project bootstrapped with [
`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The 3D experience lives at [http://localhost:3000/wallowa](http://localhost:3000/wallowa).

The homepage is `app/page.js` (App Router). This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Newsreader, JetBrains Mono, and Hanken Grotesk.