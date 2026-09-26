# Bear refinement handoff

## Image handling — read before using tools

The user reports an unrecoverable session error if the Astra Bedrock model
receives images. Do not open images, take image-returning screenshots, or attach
images to an Astra/main-agent session. Delegate all visual authoring, reference
inspection, rendered comparisons, and visual checks to **Bedrock Opus 5.5**.
That agent must return text and file paths only, never image attachments.

The available model used in this workspace was
`amazon-bedrock/global.anthropic.claude-opus-5-5`; explicit `#low` worked well
for focused modeling and comparison tasks. Resolve the available model ID with
the model tool in a new session. Some large/default-variant tasks returned no
text and made no changes; bounded tasks with explicit variants were reliable.

Reference image, local to the original workspace:

```text
/Users/bjornhansen/conductor/workspaces/personal-website/tegucigalpa/.context/bear/target.jpeg
```

Original file: `/Users/bjornhansen/Downloads/bear.jpeg`.
The copy was verified byte-for-byte without the main agent viewing it.
The JPEG, screenshots, and local review notes are gitignored workspace artifacts,
so they will not arrive with a Git checkout. In another local workspace, copy
the reference as bytes from either path into `.context/bear/target.jpeg` and
give that path only to the visual agent. Do not embed it in chat. The reference
has no verified redistribution license and is not a published project asset.

## Current state and user feedback

This is a working, technically validated prototype, **not a visually approved
bear**. The current GLB predates the target-image comparison; no reference-driven
model changes have been made yet. The user specifically said:

1. Toes/claws look separate from the feet.
2. The face is overly round and the ears are weakly attached to the head.
3. The body and overall shape are wrong.
4. The walking animation does not look natural.

Use the supplied image as the next shape target and involve the user in
iterations. Earlier visual agents called the prototype acceptable, but the user
rejected its shape and movement; those earlier assessments are not acceptance.

## Files and implementation

- `scripts/build-bear.py`: deterministic Blender generator and GLB exporter.
- `assets/bear/bear.blend`: editable source.
- `public/models/bear.glb`: current runtime asset, about 654 KiB.
- `scripts/check-bear.mjs`: exported skin, loop, deformation, and contact checks.
- `components/wallowa/Bear.js`: scene actor and playback integration.
- `components/wallowa/BearStudy.js` and `app/wallowa/bear/page.js`: standalone
  studio with orbit/presets, Idle/Walk, pause, slower playback, bones, and reload.
- `docs/bear-asset.md`: generation instructions and asset/motion contract.

Current asset: 3,780 triangles, one skinned mesh/material, 16 bones, vertex
colors, flat normals. Walk is 1.2 seconds with 0.7-unit stride metadata and 58%
stance duty; Idle is four seconds. Blender is Z-up/negative-Y-forward; GLB is
Y-up/positive-Z-forward, approximately one-unit shoulder height.

The generator combines anatomical ellipsoids, voxel-remeshes and smooths the
body, then decimates it. Muzzle, ears, eyes, and claws are created separately
and joined into the exported object. **One mesh object does not mean connected
topology:** those detail islands can still look detached. Do not treat the
one-mesh validation check as a resolution of the user's feet/ears complaint.

Skinning uses analytic distance-to-bone weights with up to four influences.
Details are rigidly weighted to the head or paw. Two-bone leg posing is baked
onto deform bones; there are no required runtime Blender constraints.

The `TORSO_SCALE`/`fy` remapping currently changes body, details, bones, foot-path
centers, and some color boundaries together. Account for that remapping before
editing raw shape coordinates. Joint pivots and weights need to follow anatomy
changes, not just the outer geometry.

## Target comparison, reported by Opus

The detailed local comparison is `.context/bear/target-review.md` in the
original workspace. Its approximate percentages are visual starting points,
not measured reference geometry. Summary:

- A more compact, taller, deep-chested body, defined shoulders, higher rump,
  straighter belly line, and longer/thicker legs.
- An angular, wedge-shaped skull with a broad flatter forehead, clear cheek/jaw
  planes, and a longer tapered muzzle. Avoid a round head with a round snout
  pasted onto it.
- Broad continuous paws with modeled toe tips. Claws should emerge directly
  from those tips, with embedded bases and appropriate paw weights.
- Small rounded/cupped ears with broad bases integrated into the skull.
- Larger deliberate planar facets, brown-to-dark color variation, and a tan
  muzzle rather than a dense, rounded, uniformly dark surface.

First get side/front/three-quarter silhouette and attachments right. Revisit
the topology strategy if further ellipsoid/remesh tuning still produces soft,
lumpy shapes. Then refit the rig and refine animation.

## Gait and scene issues to continue investigating

- Audit actual footfall order. `walk_target` advances phase with
  `(t + phase_offset) % 1`, so positive offsets advance contacts rather than
  delaying them. Current `LEGS` offsets HL=0, FL=.25, HR=.5, FR=.75 produce
  chronological stance starts HL, FR, HR, FL. A lateral four-beat sequence
  (hind then front on the same side) needs corrected timing. Validate actual
  exported contacts rather than reading the list order.
- Add convincing support/weight transfer, shoulder and hip movement, wrist
  flex, heel/toe action, and a restrained head response. Recheck reach and skin
  deformation, especially the forearms/ankles.
- The still target establishes appearance, not movement. A four-frame contact
  sheet cannot prove sliding or the absence of subtle body motion. Review
  moving animation through Opus, both at native speed and in the scene.
- Prior numeric checks found paw-bone stance speed matches stride metadata and
  Idle paw targets remain planted on a flat reference. That does not guarantee
  believable gait, attached claw geometry, or contact with uneven terrain.
- `Bear.js` scales the asset by 1.8 and moves it 12 horizontal units over nine
  seconds with easing. It reads `strideLength` to synchronize Walk. Peak clip
  speed is about 1.9x the authored rate; review whether the approach is hurried.
- Arrival blends to Idle and rotates the root toward the camera without a
  turn-in-place clip. Reduced motion snaps to the destination and freezes the
  pose at the entrance heading.
- A partial browser review reported floating/sinking from a mismatch between
  the smooth terrain-height function and the actual terrain mesh, obscured paws
  in the Contact view, rock occlusion/facing issues with reduced motion, and
  poor mobile framing. These need reproduction and visual verification; they
  were not fixed. Avoid hardcoding a compensating ground height.

## Iteration and verification

Read `AGENTS.md` and `README.md` first. Read `docs/wallowa-performance.md` before
performance changes. Keep the capped frame loop, atmosphere integration,
deferred loading, reduced-motion support, and mobile behavior.

Blender installed in the original environment: 5.2.2 LTS, at
`/Applications/Blender.app/Contents/MacOS/Blender`.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build-bear.py
npm run check:bear
npm run lint
npm run build
```

Generation overwrites both `.blend` and `.glb`. Preserve manual edits separately
or incorporate them into the generator. Do not regenerate just to inspect the
current asset. Check scripts do not assess artistic quality; update meaningful
checks when intentionally changing the rig/contract rather than merely loosening
them to hide regressions.

For visual review, start `npm run dev` and delegate `/wallowa/bear` plus the main
scene to Opus. The studio's Reload control fetches a new export. Existing local
tools include `.context/bear/render.py` for Blender previews and
`.context/bear-smoke.mjs` for production browser checks; these are not committed.
Existing images are under `.context/bear/`; only the visual agent may open them.

The user previously requested that all started processes be stopped. Servers
and review processes were shut down. Start processes only as needed for the new
task and clean up the processes you start when finished.

## Other assets in this change

Quaternius CC0 deer, stag, fox, and wolf were downloaded and packaged as GLBs
under `public/models/animals/`, with original Blender files and a source/hash
manifest under `assets/animals/`. They retain all 12–13 supplied animations and
have not been placed in the campsite. See `docs/animal-assets.md`.
The user likes that pack; preserve those imports while focusing on the bear.
The existing nature converter now has a lossless `--animated` packaging path.
