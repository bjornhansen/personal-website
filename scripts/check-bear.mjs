import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { AnimationMixer, Box3, LoopOnce, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const path = process.argv[2] ?? 'public/models/bear.glb'
const bytes = await fs.readFile(path)
assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'Expected a GLB file')
assert.equal(bytes.readUInt32LE(4), 2, 'Expected glTF 2.0')
assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB length does not match its header')
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
assert.ok(!json.images?.length, 'The bear should use vertex colors without image textures')
assert.ok(json.skins?.length, 'The bear must have a skeletal skin')
assert.ok(!json.buffers.some((buffer) => buffer.uri), 'The GLB must be self-contained')

const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
const { scene, animations } = await new GLTFLoader().parseAsync(buffer, '')
const stride = Number(scene.userData.strideLength)
assert.ok(Number.isFinite(stride) && stride > 0, 'Missing positive strideLength metadata')
const meshes = []
const skeletons = new Set()
const paws = []
scene.traverse((object) => {
  if (object.isBone && object.name.endsWith('_paw')) paws.push(object)
  if (!object.isMesh) return
  assert.ok(object.isSkinnedMesh, `${object.name} must be skinned`)
  meshes.push(object)
  skeletons.add(object.skeleton)
  const { geometry, skeleton } = object
  const positions = geometry.getAttribute('position')
  const colors = geometry.getAttribute('color')
  const weights = geometry.getAttribute('skinWeight')
  const indices = geometry.getAttribute('skinIndex')
  assert.ok(colors, `${object.name} needs vertex colors`)
  assert.equal(colors.count, positions.count)
  assert.equal(weights.count, positions.count)
  assert.equal(indices.count, positions.count)
  for (let vertex = 0; vertex < positions.count; vertex++) {
    let sum = 0
    for (let component = 0; component < 4; component++) {
      const weight = weights.getComponent(vertex, component)
      const joint = indices.getComponent(vertex, component)
      assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1, 'Invalid skin weight')
      assert.ok(Number.isInteger(joint) && joint >= 0 && joint < skeleton.bones.length, 'Invalid joint index')
      sum += weight
    }
    assert.ok(Math.abs(sum - 1) < 0.001, `Unnormalized weights at vertex ${vertex}: ${sum}`)
  }
})
assert.ok(meshes.length > 0, 'No bear mesh found')
assert.equal(paws.length, 4, 'Expected four articulated paws')

const mixer = new AnimationMixer(scene)
const point = new Vector3()
function sample() {
  scene.updateMatrixWorld(true)
  skeletons.forEach((skeleton) => skeleton.update())
  const vertices = []
  const bounds = new Box3()
  for (const mesh of meshes) {
    for (let index = 0; index < mesh.geometry.getAttribute('position').count; index++) {
      mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld)
      assert.ok(point.toArray().every(Number.isFinite), 'Animation produced a non-finite vertex')
      vertices.push(point.x, point.y, point.z)
      bounds.expandByPoint(point)
    }
  }
  return { vertices, bounds, paws: paws.map((paw) => paw.getWorldPosition(new Vector3())) }
}
function displacement(a, b) {
  let maximum = 0
  for (let i = 0; i < a.length; i += 3) {
    maximum = Math.max(maximum, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]))
  }
  return maximum
}

const clips = []
for (const name of ['Walk', 'Idle']) {
  const clip = animations.find((animation) => animation.name === name)
  assert.ok(clip, `Missing ${name} animation`)
  assert.ok(clip.duration > 0, `${name} must have a nonzero duration`)
  assert.ok(clip.validate(), `${name} contains invalid tracks`)
  mixer.stopAllAction()
  const action = mixer.clipAction(clip).reset().setLoop(LoopOnce, 1)
  action.clampWhenFinished = true
  action.play()
  mixer.setTime(0)
  const first = sample()
  const bounds = first.bounds.clone()
  const pawSamples = [first.paws]
  let movement = 0
  let last = first
  for (let frame = 1; frame <= 32; frame++) {
    mixer.setTime(clip.duration * frame / 32)
    last = sample()
    pawSamples.push(last.paws)
    bounds.union(last.bounds)
    movement = Math.max(movement, displacement(first.vertices, last.vertices))
  }
  const loopSeam = displacement(first.vertices, last.vertices)
  assert.ok(movement > 0.001, `${name} does not visibly deform the mesh`)
  assert.ok(loopSeam < 0.005, `${name} has a loop discontinuity of ${loopSeam} units`)
  assert.ok(bounds.min.y > -0.025, `${name} penetrates the floor: ${bounds.min.y}`)
  assert.ok(bounds.max.y < 3 && bounds.max.y > 0.5, `${name} has an unexpected asset scale`)
  const contacts = paws.map((paw, index) => {
    const samples = pawSamples.map((frame) => frame[index])
    if (name === 'Idle') {
      const drift = Math.max(...samples.map((sample) => sample.distanceTo(samples[0])))
      assert.ok(drift < 0.005, `${paw.name} slides during Idle: ${drift}`)
      return { paw: paw.name, drift }
    }
    const ground = Math.min(...samples.map((sample) => sample.y))
    const lift = Math.max(...samples.map((sample) => sample.y)) - ground
    const speed = stride / clip.duration
    let planted = 0
    for (let i = 1; i < samples.length; i++) {
      const previous = samples[i - 1]
      const current = samples[i]
      if (current.y - ground > 0.005 || previous.y - ground > 0.005) continue
      const velocity = (current.z - previous.z) / (clip.duration / 32)
      if (Math.abs(velocity + speed) < speed * 0.1) planted++
    }
    assert.ok(lift > 0.025, `${paw.name} does not clear the ground during Walk`)
    assert.ok(planted >= 12, `${paw.name} stance does not match strideLength metadata`)
    return { paw: paw.name, lift, matchedStanceSamples: planted }
  })
  clips.push({ name, seconds: clip.duration, tracks: clip.tracks.length, maximumDeformation: movement, loopSeam, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, contacts })
}
mixer.stopAllAction()
mixer.uncacheRoot(scene)
console.log(JSON.stringify({
  path,
  bytes: bytes.length,
  stride,
  meshes: meshes.length,
  materials: json.materials?.length ?? 0,
  joints: [...skeletons].map((skeleton) => skeleton.bones.length),
  triangles: meshes.reduce((total, mesh) => total + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3, 0),
  clips,
}, null, 2))
