# Bear asset

The first custom animal for Wallowa is an original, vertex-colored low-poly
black bear with a skeletal rig and looping Walk and Idle animations. It is
a prototype intended for iterative anatomy and movement review.

For the user's latest feedback, reference-image handling requirements, and
next modeling/animation steps, read [Bear refinement handoff](bear-handoff.md).

## Files

- `scripts/build-bear.py`: deterministic Blender mesh, color, rig, animation,
  and GLB export pipeline. Requires Blender 5.2 LTS; no downloaded models,
  textures, or additional Python packages.
- `assets/bear/bear.blend`: editable mesh, armature, and named actions.
- `public/models/bear.glb`: self-contained runtime asset.
- `scripts/check-bear.mjs`: checks the exported asset using Three.js's actual
  GLTF loader and CPU skinning.
- `components/wallowa/Bear.js`: scene placement and distance-driven playback.
- `components/wallowa/BearStudy.js`: standalone review studio at `/wallowa/bear`.

The mesh, vertex colors, skeleton, and animation data are original generated
assets dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
The GLB also records the license in its asset and scene metadata.

## Generate and check

From the repository root on macOS:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build-bear.py
npm run check:bear
```

If Blender is on PATH, `blender --background --python scripts/build-bear.py`
is equivalent. Generation replaces both the `.blend` and `.glb`; save manual
Blender edits separately before regenerating. Website builds use the committed
GLB and do not require Blender.

The checker verifies a self-contained colored skinned mesh, valid joint
indices and normalized weights, both clips, finite deformed vertices, loop
continuity, ground clearance, planted Idle paws, and Walk stance motion
consistent with the stride metadata. It prints geometry, file-size, motion,
and contact measurements for the current export.

Before shipping scene changes, also run `npm run lint` and `npm run build`.

## Review and iterate

Run `npm run dev`, then open [the bear studio](http://localhost:3000/wallowa/bear).

- Drag to orbit; scroll or pinch to zoom.
- Use the front, side, back, and three-quarter presets to compare proportions.
- Switch between Idle and Walk. Pause and use half/quarter speed to inspect
  joint deformation and ground contact; enable bones to inspect the rig.
- During Walk, the floor grid moves at the exported walk speed.
- Click Reload after generating a new export to fetch it without a stale
  model cache. Reloading the full Wallowa page picks up the new scene asset.
- Reduced-motion visitors start with playback paused; explicit Play still works.

For each revision, review silhouette, head/muzzle/ear proportions, leg volume
through the stride, planted paws, and the Walk-to-Idle transition. Check both
the neutral studio and `/wallowa` under daylight and evening lighting. Studio
floor contact does not imply per-paw terrain conformance in the campsite.

## Asset and motion contract

- Blender: Z up, forward along negative Y. GLB: Y up, forward along positive Z.
- The neutral stance has paws close to Y = 0 and shoulders roughly one unit high.
- The campsite uses a uniform scale of 1.8 and samples `terrainHeight` at the
  bear's ground position.
- One skinned mesh, one vertex-color material; geometry has flat face normals.
- The first reviewed export has 3,780 triangles and is approximately 654 KiB.
  Its neutral dimensions are roughly 1.96 units long and 0.59 units wide.
- A 16-bone skeleton includes root, spine, neck, head, and upper/lower/paw
  chains for all four legs. Skin weights use at most four influences per vertex.
- `Walk`: 1.2-second in-place loop, nominal 0.7-unit distance per full cycle.
  Four staggered footfalls, 58% stance duty, analytical two-bone leg posing
  baked onto the deform bones. No runtime Blender constraints are needed.
- `Idle`: four-second loop with subtle breathing/head movement and planted paws.
- Scene extras `strideLength`, `walkDuration`, and `walkSpeed` describe motion
  in unscaled asset units. Keep them synchronized when changing the gait.

The scene's approach lasts nine seconds over the final 12 units of the existing
entrance direction. Walk playback follows actual horizontal displacement,
including the eased start/stop. Arrival blends to Idle. The root turns toward
the camera, but there is no authored turn-in-place clip or per-paw terrain IK
yet; these are useful later movement refinements.
