# AGENTS.md — repo notes for coding agents

Personal website for Bjorn Hansen (Next.js App Router, React 19, Tailwind v4)
plus the `/wallowa` 3D experience (three.js + React Three Fiber + zustand).
Full product context and roadmap for the 3D scene live in README.md
("Wallowa Camp" section) — read that before changing the experience.

## Commands

- `npm run dev` — dev server (homepage `/`, 3D scene `/wallowa`)
- `npm run build` — production build; run this before pushing changes to
  `/wallowa` (WebGL issues often only surface in prod mode)
- `npm run lint` — ESLint (eslint-config-next + react-hooks rules; the repo
  runs with strict react-hooks purity/immutability checks — do not call
  `Math.random()` during render, and never mutate hook results directly;
  mutate via refs inside `useFrame`/effects)

## Conventions

- App Router in `app/`, shared components in `components/` (Wallowa scene
  files in `components/wallowa/`). No comments in code unless asked.
- 3D scene rules:
  - Procedural-first: terrain, sky, water, lighting are all generated; only
    vegetation (`public/models/nature/*.glb`) and an optional bear
    (`public/models/bear.glb`) are assets.
  - Everything instanced: vegetation is `InstancedMesh` per model type, one
    draw call each. Keep new props instanced too.
  - Asset pipeline: `scripts/convert-nature-pack.mjs` converts Quaternius
    CC0 OBJs to single-primitive GLBs with MTL colors baked into vertex
    colors. Any new pack assets should go through it.
  - `components/wallowa/store.js` (zustand) is the experience state
    (timeOfDay, isNight, activeSection, bearArrived).
  - Placement must sample `terrainHeight`/`meadowMask`/`lakeBowl` from
    `Terrain.js` — never hardcode ground heights.
  - Mobile + `prefers-reduced-motion` behavior must be preserved when adding
    animations (`components/wallowa/hooks.js`).
  - No DOM overlays for content — in-world text/dialogue only (see README
    roadmap). HUD is limited to nav, local time, sound toggle, and one
    instruction line.
- Licensing: only CC0 assets may be committed (this repo is public). Quaternius
  packs are fine; PolyPerfect and other store assets are not.
- Known repo issue: multiple lockfiles warning from Turbopack (root
  `~/package-lock.json`); harmless, ignore.
- GitHub Dependabot reports ~30 pre-existing vulns on `main` (mostly
  transitive); unrelated to the Wallowa work, worth a separate pass.

## Git

- Wallowa work happens on `wallowa-camp-migration-plan`; `main` deploys to
  production via Vercel. Do not merge without asking.
- Keep `git diff origin/main` in mind; this workspace targets `origin/main`.
