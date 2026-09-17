import fs from 'node:fs'
import path from 'node:path'

const srcDir = process.argv[2] || '/tmp/qnat/OBJ'
const outDir = process.argv[3] || 'public/models/nature'

const MODELS = [
  'PineTree_1',
  'PineTree_2',
  'PineTree_3',
  'PineTree_Snow_1',
  'PineTree_Snow_2',
  'BirchTree_2',
  'BirchTree_3',
  'BirchTree_Autumn_1',
  'Willow_1',
  'Willow_3',
  'Bush_1',
  'Bush_2',
  'BushBerries_1',
  'Rock_1',
  'Rock_2',
  'Rock_Moss_1',
  'Rock_Moss_2',
  'Grass',
  'Grass_Short',
  'Flowers',
  'Lilypad',
  'WoodLog',
  'TreeStump',
]

function parseMTL(text) {
  const materials = {}
  let current = null
  for (const line of text.split('\n')) {
    const t = line.trim().split(/\s+/)
    if (t[0] === 'newmtl') current = t[1]
    if (t[0] === 'Kd' && current) {
      materials[current] = [
        Math.round(parseFloat(t[1]) * 255),
        Math.round(parseFloat(t[2]) * 255),
        Math.round(parseFloat(t[3]) * 255),
      ]
    }
  }
  return materials
}

function parseOBJ(text, materials) {
  const positions = []
  const normals = []
  const outPos = []
  const outNrm = []
  const outCol = []
  const indices = []
  let currentColor = [128, 128, 128]
  const hasNormals = text.includes('\nvn ')

  const lines = text.split('\n')
  for (const line of lines) {
    const t = line.trim().split(/\s+/)
    if (t[0] === 'v') {
      positions.push([parseFloat(t[1]), parseFloat(t[2]), parseFloat(t[3])])
    } else if (t[0] === 'vn') {
      normals.push([parseFloat(t[1]), parseFloat(t[2]), parseFloat(t[3])])
    } else if (t[0] === 'usemtl') {
      const c = materials[t[1]]
      if (c) currentColor = c
    } else if (t[0] === 'f') {
      const verts = []
      for (let i = 1; i < t.length; i++) {
        const [vi, , ni] = t[i].split('/')
        let v = parseInt(vi, 10)
        let n = ni ? parseInt(ni, 10) : 0
        if (v < 0) v = positions.length + v + 1
        if (n < 0) n = normals.length + n + 1
        verts.push({ v, n })
      }
      for (let i = 1; i < verts.length - 1; i++) {
        const tri = [verts[0], verts[i], verts[i + 1]]
        const base = outPos.length / 3
        for (const { v, n } of tri) {
          const p = positions[v - 1]
          outPos.push(p[0], p[1], p[2])
          outCol.push(currentColor[0], currentColor[1], currentColor[2], 255)
          if (hasNormals && n > 0) {
            const nn = normals[n - 1]
            outNrm.push(nn[0], nn[1], nn[2])
          } else {
            outNrm.push(0, 0, 0)
          }
        }
        indices.push(base, base + 1, base + 2)
      }
    }
  }

  if (!hasNormals || outNrm.some((v) => v !== 0)) {
    // keep parsed normals
  } else {
    outNrm.length = 0
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3
      const b = indices[i + 1] * 3
      const c = indices[i + 2] * 3
      const u = [outPos[b] - outPos[a], outPos[b + 1] - outPos[a + 1], outPos[b + 2] - outPos[a + 2]]
      const v = [outPos[c] - outPos[a], outPos[c + 1] - outPos[a + 1], outPos[c + 2] - outPos[a + 2]]
      const n = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ]
      const len = Math.hypot(n[0], n[1], n[2]) || 1
      for (const idx of [a, b, c]) {
        outNrm[idx] = n[0] / len
        outNrm[idx + 1] = n[1] / len
        outNrm[idx + 2] = n[2] / len
      }
    }
  }

  return {
    positions: new Float32Array(outPos),
    normals: new Float32Array(outNrm),
    colors: new Uint8Array(outCol),
    indices: new Uint32Array(indices),
  }
}

function toGLB(name, { positions, normals, colors, indices }) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k])
      max[k] = Math.max(max[k], positions[i + k])
    }
  }

  const buffers = []
  const views = []
  const accessors = []
  const push = (data, alignment) => {
    const offset =
      buffers.reduce((s, b) => s + b.byteLength, 0)
    const pad = (alignment - (offset % alignment)) % alignment
    if (pad) buffers.push(new ArrayBuffer(pad))
    const start = buffers.reduce((s, b) => s + b.byteLength, 0)
    buffers.push(data.buffer)
    views.push({ buffer: 0, byteOffset: start, byteLength: data.byteLength })
    return views.length - 1
  }

  const posView = push(positions, 4)
  const nrmView = push(normals, 4)
  const colView = push(colors, 4)
  const idxView = push(indices, 4)

  accessors.push({
    bufferView: posView, componentType: 5126, count: positions.length / 3,
    type: 'VEC3', min, max,
  })
  accessors.push({
    bufferView: nrmView, componentType: 5126, count: normals.length / 3,
    type: 'VEC3',
  })
  accessors.push({
    bufferView: colView, componentType: 5121, count: colors.length / 4,
    type: 'VEC4', normalized: true,
  })
  accessors.push({
    bufferView: idxView, componentType: 5125, count: indices.length,
    type: 'SCALAR',
  })

  const json = {
    asset: { version: '2.0', generator: 'wallowa-obj-convert' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [{
      name,
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 },
        indices: 3,
        material: 0,
      }],
    }],
    materials: [{
      name: 'baked',
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    }],
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: buffers.reduce((s, b) => s + b.byteLength, 0) }],
  }

  const jsonText = JSON.stringify(json)
  const jsonPad = (4 - (jsonText.length % 4)) % 4
  const jsonBuf = Buffer.from(jsonText + ' '.repeat(jsonPad))
  const binBuf = Buffer.concat(buffers.map((b) => Buffer.from(new Uint8Array(b))))
  const binPad = (4 - (binBuf.length % 4)) % 4
  const binPadded = Buffer.concat([binBuf, Buffer.alloc(binPad)])

  const total = 12 + 8 + jsonBuf.length + 8 + binPadded.length
  const glb = Buffer.alloc(total)
  glb.writeUInt32LE(0x46546c67, 0)
  glb.writeUInt32LE(2, 4)
  glb.writeUInt32LE(total, 8)
  glb.writeUInt32LE(jsonBuf.length, 12)
  glb.writeUInt32LE(0x4e4f534a, 16)
  jsonBuf.copy(glb, 20)
  const binHeader = 20 + jsonBuf.length
  glb.writeUInt32LE(binPadded.length, binHeader)
  glb.writeUInt32LE(0x004e4942, binHeader + 4)
  binPadded.copy(glb, binHeader + 8)

  return glb
}

fs.mkdirSync(outDir, { recursive: true })
let totalBytes = 0
for (const name of MODELS) {
  const objText = fs.readFileSync(path.join(srcDir, `${name}.obj`), 'utf8')
  const mtlText = fs.readFileSync(path.join(srcDir, `${name}.mtl`), 'utf8')
  const materials = parseMTL(mtlText)
  const geometry = parseOBJ(objText, materials)
  const glb = toGLB(name, geometry)
  fs.writeFileSync(path.join(outDir, `${name}.glb`), glb)
  totalBytes += glb.length
  const heights = geometry.positions
  console.log(
    name.padEnd(20),
    `${(glb.length / 1024).toFixed(1)} KB`,
    `${geometry.indices.length / 3} tris`
  )
}
console.log('total:', (totalBytes / 1024).toFixed(1), 'KB')
