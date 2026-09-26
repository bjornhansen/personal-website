# Quaternius animal assets

Status: imported and technically validated; ready for scene placement.

Source: [Ultimate Animated Animals, July 2021](https://quaternius.com/packs/ultimateanimatedanimals.html),
by Quaternius, the creator of the scene's vegetation assets.
The [provided Google Drive folder](https://drive.google.com/drive/folders/1uJ3N5HfB7jKTseJUNQr3N4YaN0UuEtHk)
contains 12 animals. The four forest-wildlife models selected here are deer,
stag, fox, and wolf.

## Imported files

| Animal | Runtime file | Triangles | Joints | Clips | GLB size |
| --- | --- | ---: | ---: | ---: | ---: |
| Deer | `public/models/animals/Deer.glb` | 2,098 | 46 | 13 | 1.92 MiB |
| Stag | `public/models/animals/Stag.glb` | 3,670 | 38 | 13 | 1.95 MiB |
| Fox | `public/models/animals/Fox.glb` | 1,848 | 51 | 12 | 1.82 MiB |
| Wolf | `public/models/animals/Wolf.glb` | 1,962 | 51 | 12 | 1.83 MiB |

- Original editable `.blend` files: `assets/animals/`.
- Original download URLs, sizes, and SHA-256 hashes: `assets/animals/manifest.json`.
- Original license: `assets/animals/License.txt`, also distributed with the GLBs
  at `public/models/animals/License.txt`.
- Original glTF downloads in this workspace: `.context/animal-pack/`.

The license text is preserved with normalized line endings/whitespace; manifest
hashes describe the original downloaded bytes.

All four have `Idle`, `Idle_2`, `Walk`, `Eating`, `Gallop`, `Gallop_Jump`,
death, attack, and hit-reaction clips. Deer and stag also have `Idle_Headlow`;
fox and wolf use `Idle_2_HeadLow`. Clip names and capitalization are preserved.
The files are CC0 1.0 and may be included in this public repository.

## Packaging

The animated path in the existing asset converter packages each embedded glTF
as a self-contained GLB:

```sh
node scripts/convert-nature-pack.mjs .context/animal-pack public/models/animals --animated
```

For another workspace, download the four original `.gltf` files from the URLs
in the manifest into a local directory and pass that as the first argument.
The Blender files are editable source backups; packaging uses the supplied glTF
exports so it does not re-bake or alter animation data.

This path preserves all geometry, normals, material colors, vertex colors,
bone hierarchy, bind matrices, and animation channels. It removes the base64
wrapper and writes the same binary data into the GLB buffer. The original
OBJ/MTL conversion path remains available for static vegetation; OBJ cannot
preserve a skeletal rig or animation.

Validation compared each GLB's JSON and binary data exactly against its source,
then loaded it through Three.js's `GLTFLoader`, checked skin weights and joint
indices, and sampled every animation for finite deformed vertex positions.
The existing static converter was regression-checked against its previous
version with byte-identical fixture outputs. These are technical import checks,
not an in-scene visual or movement review.

## Scene integration

A small number of idling or grazing animals is a straightforward addition:

1. Load only the selected species through the scene's deferred loading path.
2. Clone each actor with `SkeletonUtils.clone` so its pose is independent, while
   sharing the source geometry and materials where appropriate.
3. Use an `AnimationMixer` or drei's `useAnimations` to play `Idle` or `Eating`,
   advancing with the existing capped frame loop's delta.
4. Apply species-specific scale and ground alignment. Native full-height bounds
   are approximately 4.27 units for deer, 5.38 for stag (including antlers),
   and 2.67 for fox/wolf; these are not normalized to the custom bear's scale.
5. Place from `terrainHeight`/`meadowMask`/`lakeBowl`, avoid trails, and check
   actual rendered-ground contact. Preserve reduced-motion behavior and use
   lower animal counts on mobile.
6. Wrap materials with the shared atmosphere treatment for scene lighting/fog.

The stag's antlers are a separate mesh attached to its bone hierarchy; keep that
hierarchy intact. Native materials use several primitives (deer 7, stag 6,
fox 5, wolf 4), and the full four-species library is about 7.52 MiB. Stream
species as needed. Animated skeletons need their own actor poses; ordinary
`InstancedMesh` does not provide independent skeletal animation.

Wandering adds path selection, obstacles, terrain contact, gait-speed matching,
and transitions. The files do not contain the custom bear's `strideLength`
metadata, so walking speed should be measured from these clips rather than
reusing the bear's stride constant. A pair of grazing deer is a useful first
scene integration before adding moving wildlife.
