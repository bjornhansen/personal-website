# Quaternius animal assets

Status: deer and stag are placed in the scene as a grazing herd
(`components/wallowa/Animals.js`); fox and wolf are packaged but unused.

Source: [Ultimate Animated Animals, July 2021](https://quaternius.com/packs/ultimateanimatedanimals.html),
by Quaternius, the creator of the scene's vegetation assets.
The [provided Google Drive folder](https://drive.google.com/drive/folders/1uJ3N5HfB7jKTseJUNQr3N4YaN0UuEtHk)
contains 12 animals. The four forest-wildlife models selected here are deer,
stag, fox, and wolf.

## Files

| Animal | Runtime file (trimmed) | Size | Full GLB (source for trimming) | Triangles | Joints |
| --- | --- | ---: | --- | ---: | ---: |
| Deer | `public/models/animals/Deer.glb` | 329 KiB | `assets/animals/full/Deer.glb` (1.92 MiB) | 2,098 | 46 |
| Stag | `public/models/animals/Stag.glb` | 362 KiB | `assets/animals/full/Stag.glb` (1.95 MiB) | 3,670 | 38 |
| Fox | `public/models/animals/Fox.glb` | 334 KiB | `assets/animals/full/Fox.glb` (1.82 MiB) | 1,848 | 51 |
| Wolf | `public/models/animals/Wolf.glb` | 340 KiB | `assets/animals/full/Wolf.glb` (1.83 MiB) | 1,962 | 51 |

- Original editable `.blend` files: `assets/animals/`.
- Original download URLs, sizes, and SHA-256 hashes: `assets/animals/manifest.json`.
- Original license: `assets/animals/License.txt`, also distributed with the GLBs
  at `public/models/animals/License.txt`.
- The full GLBs are lossless packagings of the original glTF downloads (see
  "Packaging"); the runtime GLBs are trimmed from them.

The files are CC0 1.0 and may be included in this public repository.

## Packaging (full GLBs)

The animated path in the existing asset converter packages each embedded glTF
as a self-contained GLB:

```sh
node scripts/convert-nature-pack.mjs .context/animal-pack assets/animals/full --animated
```

For another workspace, download the four original `.gltf` files from the URLs
in the manifest into a local directory and pass that as the first argument.
This path preserves all geometry, normals, material colors, vertex colors,
bone hierarchy, bind matrices, and animation channels.

## Trimming (runtime GLBs)

```sh
node scripts/trim-animals.mjs            # assets/animals/full -> public/models/animals
node scripts/trim-animals.mjs <in> <out>
```

Uses `@gltf-transform` (dev dependency) to:

- keep only `Idle`, `Idle_2`, `Idle_Headlow`/`Idle_2_HeadLow`, `Eating`,
  `Walk` (attack, death, hit, gallop, jump clips are dropped — about 90% of
  the original bytes were animation keyframes);
- bake each material's base color into `COLOR_0` and merge all primitives of a
  mesh into one with a single white material, so each animal is one draw
  call (the stag's antlers stay a second mesh attached to the head bone);
- drop normals (the runtime material uses `flatShading`), UVs and tangents;
- resample keyframes, quantize `COLOR_0` to 8-bit and `WEIGHTS_0` to 16-bit
  (core-spec encodings, no extensions required), dedup and prune;
- measure the `Walk` stride and store it as `strideLength` (native units per
  walk cycle) and `walkDuration` in the scene extras, read at runtime via
  `scene.userData`. The stride is the hoof's horizontal travel during its
  longest ground-contact stretch, scaled to a full cycle, averaged over the
  four `IK*Leg` targets: deer/stag 2.86, fox/wolf 2.18.

Native full-height bounds are approximately 4.27 units for deer, 5.38 for
stag (including antlers), and 2.67 for fox/wolf. The runtime scales deer by
0.45 and stag by 0.47.

## Scene integration

`Animals.js` renders a herd of one stag and two does (one doe on mobile) in a
tree-free clearing around `HERD` (`places.js`), on the south shore in the
default camera's lower-left foreground:

- Loaded in its own `Suspense` after the forest so vegetation appears first.
  Each actor is a `SkeletonUtils.clone` sharing geometry, with one shared
  `withAtmosphere` vertex-color material.
- `findHome()` picks the flattest standable spot near `HERD` (ground height
  0.6–8, slope < 0.22, clear of trails, creek, camp, Bear and the forest's
  registered obstacles in `obstacles.js`). Placement waits until the forest
  has registered its footprints.
- Each actor runs a small state machine: idle (`Idle`/`Idle_2`), graze
  (`Eating`), look (`Idle_Headlow`), walk (`Walk` to a validated target within
  14 units of home; one walker at a time; path checked against obstacles;
  walk `timeScale` follows actual speed from `strideLength`). Actions
  cross-fade over 0.35 s. Ground height and pitch come from
  `groundHeight`/`groundGradient` each frame.
- Actors do not cast shadow-map shadows (that would force shadow re-renders
  while they move); each has a soft blob shadow whose opacity follows the sun.
- Reduced motion freezes the mixer and prevents wandering. `?bench=1` seeds the
  wander RNG; `animals=off` removes the herd for A/B runs.
