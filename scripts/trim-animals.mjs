import fs from 'node:fs/promises'
import path from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, joinPrimitives, prune, quantize, resample } from '@gltf-transform/functions'
import { AnimationMixer, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const [inputDir = 'assets/animals/full', outputDir = 'public/models/animals'] = process.argv.slice(2)
const SPECIES = ['Deer', 'Stag', 'Fox', 'Wolf']
const KEEP_CLIPS = new Set(['Idle', 'Idle_2', 'Idle_Headlow', 'Idle_2_HeadLow', 'Eating', 'Walk'])
const SAMPLES = 120

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS)

function bakeVertexColors(document) {
  const root = document.getRoot()
  const buffer = root.listBuffers()[0]
  const shared = document.createMaterial('Baked').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1)
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const material = prim.getMaterial()
      const [r, g, b] = material ? material.getBaseColorFactor() : [1, 1, 1, 1]
      const count = prim.getAttribute('POSITION').getCount()
      const colors = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b
      }
      prim.setAttribute('COLOR_0', document.createAccessor().setType('VEC3').setArray(colors).setBuffer(buffer))
      for (const semantic of prim.listSemantics()) {
        if (semantic.startsWith('TEXCOORD') || semantic === 'TANGENT' || semantic === 'NORMAL') prim.setAttribute(semantic, null)
      }
      prim.setMaterial(shared)
    }
  }
}

function mergePrimitives(document) {
  for (const mesh of document.getRoot().listMeshes()) {
    const prims = mesh.listPrimitives()
    if (prims.length < 2) continue
    const joined = joinPrimitives(prims)
    for (const prim of prims) mesh.removePrimitive(prim)
    mesh.addPrimitive(joined)
  }
}

function dropClips(document) {
  for (const animation of document.getRoot().listAnimations()) {
    if (KEEP_CLIPS.has(animation.getName())) continue
    for (const channel of animation.listChannels()) channel.dispose()
    for (const sampler of animation.listSamplers()) sampler.dispose()
    animation.dispose()
  }
}

async function measureStride(glb) {
  const buffer = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength)
  const { scene, animations } = await new GLTFLoader().parseAsync(buffer, '')
  const walk = animations.find((clip) => clip.name === 'Walk')
  if (!walk) return null
  const feet = []
  let head = null
  let tail = null
  scene.traverse((object) => {
    if (/^IK(Front|Back)Leg\.?[LR]$/.test(object.name)) feet.push(object)
    if (object.name === 'Head') head = object
    if (object.name === 'Tail1') tail = object
  })
  if (feet.length !== 4 || !head || !tail) return null
  const mixer = new AnimationMixer(scene)
  mixer.clipAction(walk).play()
  scene.updateMatrixWorld(true)
  const forward = new Vector3().subVectors(head.getWorldPosition(new Vector3()), tail.getWorldPosition(new Vector3()))
  forward.y = 0
  forward.normalize()
  const tracks = feet.map(() => [])
  const point = new Vector3()
  for (let i = 0; i < SAMPLES; i++) {
    mixer.setTime((i / SAMPLES) * walk.duration)
    scene.updateMatrixWorld(true)
    feet.forEach((foot, f) => {
      foot.getWorldPosition(point)
      tracks[f].push({ y: point.y, s: point.dot(forward) })
    })
  }
  const strides = tracks.map((track) => {
    const ys = track.map((p) => p.y)
    const low = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.2
    const stance = track.map((p) => p.y <= low)
    let best = { start: 0, length: 0 }
    for (let start = 0; start < SAMPLES; start++) {
      if (!stance[start] || stance[(start + SAMPLES - 1) % SAMPLES]) continue
      let length = 0
      while (length < SAMPLES && stance[(start + length) % SAMPLES]) length++
      if (length > best.length) best = { start, length }
    }
    if (best.length < 4) return null
    const a = track[best.start].s
    const b = track[(best.start + best.length - 1) % SAMPLES].s
    const speed = Math.abs(a - b) / ((best.length - 1) / SAMPLES * walk.duration)
    return speed * walk.duration
  }).filter((v) => v !== null)
  if (!strides.length) return null
  return strides.reduce((sum, v) => sum + v, 0) / strides.length
}

await fs.mkdir(outputDir, { recursive: true })
for (const name of SPECIES) {
  const source = path.join(inputDir, `${name}.glb`)
  const before = (await fs.stat(source)).size
  const document = await io.read(source)
  dropClips(document)
  bakeVertexColors(document)
  mergePrimitives(document)
  await document.transform(
    resample({ tolerance: 1e-4 }),
    quantize({ pattern: /^(COLOR_0|WEIGHTS_0)$/, quantizeColor: 8, quantizeWeight: 16 }),
    dedup(),
    prune()
  )
  let glb = await io.writeBinary(document)
  const stride = await measureStride(glb)
  const extras = { ...document.getRoot().listScenes()[0].getExtras() }
  if (stride) {
    extras.strideLength = Number(stride.toFixed(4))
    extras.walkDuration = Number(document.getRoot().listAnimations().find((a) => a.getName() === 'Walk')?.listChannels()[0]?.getSampler()?.getInput()?.getMax([0])[0].toFixed(4))
    document.getRoot().listScenes()[0].setExtras(extras)
    glb = await io.writeBinary(document)
  }
  const target = path.join(outputDir, `${name}.glb`)
  await fs.writeFile(target, glb)
  const prims = document.getRoot().listMeshes().map((mesh) => mesh.listPrimitives().length)
  const clips = document.getRoot().listAnimations().map((a) => a.getName())
  console.log(`${name}: ${(before / 1024).toFixed(0)} KiB -> ${(glb.length / 1024).toFixed(0)} KiB, primitives ${prims.join('+')}, stride ${stride ? stride.toFixed(3) : 'n/a'}, clips ${clips.join(', ')}`)
}
