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

## Getting Started

This is a [Next.js](https://nextjs.org/) project bootstrapped with [
`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.js`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed
on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in
`pages/api/hello.js`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated
as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and
load Inter, a custom Google Font.

---

# Migration Plan: "Wallowa Camp" — a 3D, game-like experience

> **Status: exploration / not yet begun.** This captures the agreed direction for
> the next major iteration of this site. Design notes live in
> `.context/wallowa-concept.md` (gitignored — copy them into this repo before
> starting the migration).

## Vision

Replace the current flat editorial page with a full-page 3D takeover: an
explorable campsite on the shore of an alpine lake in the Wallowa Mountains of
Oregon — granite horns, glacial valley, pine forest, and a campfire in the
foreground. A quiet black bear named **Bear** is the site's guide.

Decisions already made:

- **Full-page takeover.** This is a full re-imagining, not a hero section. The
  current page remains as the server-rendered fallback (SEO, no-WebGL,
  `prefers-reduced-motion`).
- **"Animated-film realism."** Procedural terrain, Preetham sky, fog, ACES tone
  mapping, water shader — looks like a high-end animated film, loads in seconds.
  No heavy photoreal assets. Optional texture pass can come later.
- **Bear's persona:** somewhat quiet and contemplative, with Pacific-Northwest
  dry humor. Speaks in short lines. Greeting varies with the visitor's local
  time of day.
- **Ambient sound** (wind, loons, fire crackle) — muted by default with a toggle.

## Experience

- **Day/night cycle synced to the visitor's local clock.** Sun position mapped
  from local time: sunrise over the peaks, stars, moonlight, and fireflies at
  night, campfire as the main light source after dark. Optional time-scrub
  slider so visitors can preview other times of day.
- **Content lives in the world:**
  - Bear's greeting + trailhead sign → intro / who Bjorn is
  - The tent & camp setup → 01 What I'm building (City Detect)
  - Trailhead signs down the valley → 02 Background (Blackbird)
  - Campfire circle / canoe → 03 Get in touch
- **Interaction:** orbit/pan/zoom by default; glowing hotspots fly the camera to
  a place while Bear walks ahead; content cards slide in over the canvas.
  Mobile gets large tap targets and reduced effects.

## Technical approach

- **Stack:** `three` + `@react-three/fiber@9` (pairs with React 19) +
  `@react-three/drei`. Mounted via `next/dynamic` (`ssr: false`) so HTML paint
  is untouched.
- **Assets:** everything procedural except a rigged, animated CC0 bear GLB
  (~1 MB, e.g. from poly.pizza / Quaternius CC0 packs). Terrain uses layered
  simplex noise (fBm + ridged) with vertex-blended rock/grass/snow; trees are
  hundreds of instanced low-poly pines in one draw call.
- **Budget:** ~3 MB total, interactive in <3 s on 4G. Mobile: DPR clamp ≤2,
  fewer instances, no soft shadows, no postprocessing.
- **Structure:** `components/wallowa/` (Scene, Terrain, Lake, Sky, DayNight,
  Bear, Hotspots, CameraRig, ui/) + a small store (zustand) for experience
  state.

## Milestones

1. **Prototype:** procedural Wallowa terrain + lake + sky, day/night from
   local time, orbit controls.
2. **Bear:** load GLB, idle/walk animations, greeting speech bubble, camera
   fly-to + content cards for the three sections.
3. **Polish:** instanced forest, campfire + fireflies at night, mobile tuning,
   ambient audio (muted), reduced-motion fallback, SEO fallback.