import { mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Document, NodeIO } from '@gltf-transform/core'
import { MeshoptSimplifier } from 'meshoptimizer'
import { BufferGeometry, Float32BufferAttribute, Color } from 'three'
import inputs from './model-inputs.json'
import { structures } from '../src/anatomy'

// Simplification bound in source millimetres. Each mesh keeps its shape to
// within this distance; very small meshes keep at least FLOOR triangles.
const MAX_ERROR_MM = 0.8
const FLOOR_TRIANGLES = 240

const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex')
await mkdir('.asset-cache/stl', { recursive: true })
await mkdir('public/models', { recursive: true })
async function fetchPinned(path: string, url: string, expected: string) {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    console.log(`Downloading ${path}…`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
    await Bun.write(file, response)
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (sha(bytes) !== expected)
    throw new Error(
      `Checksum mismatch: ${path}. Refusing changed upstream data; review it before updating the pin.`,
    )
  return bytes
}
const partsBytes = await fetchPinned(
  '.asset-cache/parts_list_e.txt',
  inputs.baseUrl + inputs.partsList.file,
  inputs.partsList.sha256,
)
const names = new Map(
  new TextDecoder()
    .decode(partsBytes)
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split('\t') as [string, string]),
)
const byFile = new Map(inputs.files.map((f) => [f.id, f]))
// Download in small parallel batches; the full selection is about 890 MB.
for (let i = 0; i < inputs.files.length; i += 8)
  await Promise.all(
    inputs.files
      .slice(i, i + 8)
      .map((f) =>
        fetchPinned(`.asset-cache/stl/${f.id}.stl`, `${inputs.baseUrl}stl/${f.id}.stl`, f.sha256),
      ),
  )

await MeshoptSimplifier.ready
const credit =
  'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan'
const doc = new Document()
doc.getRoot().getAsset().copyright = credit
const scene = doc.createScene('OrganUI Muscles — BodyParts3D 3.0')
const buffer = doc.createBuffer()
const used = new Set<string>()
const min = [Infinity, Infinity, Infinity],
  max = [-Infinity, -Infinity, -Infinity]

// Binary STL stores unindexed triangles. Vertices are welded on exact position,
// then the indexed mesh is simplified within MAX_ERROR_MM and compacted.
function readMesh(id: string) {
  const bytes = new Uint8Array(readFileSync(`.asset-cache/stl/${id}.stl`))
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const triangles = view.getUint32(80, true)
  if (bytes.length !== 84 + triangles * 50) throw new Error(`Invalid binary STL: ${id}`)
  const positions: number[] = []
  const indices = new Uint32Array(triangles * 3)
  const weld = new Map<string, number>()
  for (let t = 0; t < triangles; t++) {
    for (let k = 0; k < 3; k++) {
      const o = 84 + t * 50 + 12 + k * 12
      const x = view.getFloat32(o, true),
        y = view.getFloat32(o + 4, true),
        z = view.getFloat32(o + 8, true)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
        throw new Error(`Invalid vertex: ${id}`)
      const key = `${x},${y},${z}`
      let index = weld.get(key)
      if (index === undefined) {
        index = positions.length / 3
        weld.set(key, index)
        positions.push(x, y, z)
        min[0] = Math.min(min[0], x)
        min[1] = Math.min(min[1], y)
        min[2] = Math.min(min[2], z)
        max[0] = Math.max(max[0], x)
        max[1] = Math.max(max[1], y)
        max[2] = Math.max(max[2], z)
      }
      indices[t * 3 + k] = index
    }
  }
  const welded = new Float32Array(positions)
  const floor = Math.min(triangles, FLOOR_TRIANGLES) * 3
  const [simplified, error] = MeshoptSimplifier.simplify(indices, welded, 3, floor, MAX_ERROR_MM, [
    'ErrorAbsolute',
  ])
  // Keep only vertices the simplified triangles still use.
  const remap = new Map<number, number>()
  const compact: number[] = []
  const out = new Uint32Array(simplified.length)
  simplified.forEach((v, i) => {
    let n = remap.get(v)
    if (n === undefined) {
      n = compact.length / 3
      remap.set(v, n)
      compact.push(welded[v * 3], welded[v * 3 + 1], welded[v * 3 + 2])
    }
    out[i] = n
  })
  return {
    positions: compact,
    indices: out,
    source: {
      element: id,
      sha256: sha(bytes),
      bytes: bytes.length,
      vertices: welded.length / 3,
      triangles,
      runtimeTriangles: out.length / 3,
      maxErrorMm: Number(error.toFixed(3)),
    },
  }
}

const prepared = structures.map((structure) => {
  if (structure.sources.length !== structure.parts.length)
    throw new Error(`Parts do not match sources: ${structure.id}`)
  const positions: number[] = [],
    indices: number[] = []
  const sources = structure.sources.map((id, i) => {
    if (used.has(id)) throw new Error(`Duplicate ownership: ${id}`)
    used.add(id)
    const input = byFile.get(id)
    if (!input) throw new Error(`Missing input: ${id}`)
    if (names.get(id) !== structure.parts[i] || input.label !== structure.parts[i])
      throw new Error(`Source name mismatch: ${id} is "${names.get(id)}"`)
    const mesh = readMesh(id)
    const offset = positions.length / 3
    for (const p of mesh.positions) positions.push(p)
    for (const index of mesh.indices) indices.push(index + offset)
    return mesh.source
  })
  if (structure.fma && names.get(structure.fma) !== structure.sourceName)
    throw new Error(`Concept name mismatch: ${structure.id}`)
  return { structure, positions, indices, sources }
})
if (used.size !== inputs.files.length)
  throw new Error(
    `Unused input meshes: ${inputs.files.filter((f) => !used.has(f.id)).map((f) => f.id)}`,
  )

const center = min.map((v, i) => (v + max[i]) / 2)
const scale = 0.004 // millimeters to display units; uniform scale, no anatomical reshaping
for (const { structure, positions, indices } of prepared) {
  const transformed = new Float32Array(positions.length)
  for (let i = 0; i < positions.length; i += 3) {
    transformed[i] = (positions[i] - center[0]) * scale
    transformed[i + 1] = (positions[i + 2] - center[2]) * scale
    transformed[i + 2] = -(positions[i + 1] - center[1]) * scale
  }
  const geometry = new BufferGeometry()
    .setAttribute('position', new Float32BufferAttribute(transformed, 3))
    .setIndex(indices)
  geometry.computeVertexNormals()
  const color = new Color(structure.color)
  const material = doc
    .createMaterial(structure.id)
    .setBaseColorFactor([color.r, color.g, color.b, 1])
    .setRoughnessFactor(0.65)
    .setMetallicFactor(0)
    .setDoubleSided(true)
  const indexArray =
    transformed.length / 3 <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices)
  const primitive = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      doc.createAccessor().setType('VEC3').setArray(transformed).setBuffer(buffer),
    )
    .setAttribute(
      'NORMAL',
      doc
        .createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array(geometry.getAttribute('normal').array))
        .setBuffer(buffer),
    )
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(indexArray).setBuffer(buffer))
    .setMaterial(material)
  const mesh = doc.createMesh(structure.id).addPrimitive(primitive)
  scene.addChild(
    doc
      .createNode(structure.id)
      .setMesh(mesh)
      .setExtras({ structureId: structure.id, fma: structure.fma, sources: structure.sources }),
  )
  geometry.dispose()
}
const runtime = await new NodeIO().writeBinary(doc)
await Bun.write('public/models/muscles.glb', runtime)
const manifest = {
  dataset: 'BodyParts3D',
  version: '3.0 (20110915)',
  variant:
    'BodyParts3D_3.0_obj_95 converted to binary STL by the Kevin-Mattheus-Moerman/BodyParts3D mirror',
  retrieved: '2026-10-16',
  license: 'CC-BY-SA-2.1-JP',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en',
  credit,
  mirror: { repository: inputs.repository, commit: inputs.commit },
  partsList: inputs.partsList,
  simplification: {
    tool: 'meshoptimizer 1.1.1 simplify (ErrorAbsolute)',
    maxErrorMm: MAX_ERROR_MM,
    floorTriangles: FLOOR_TRIANGLES,
  },
  transform: { sourceBoundsMm: { min, max }, centerMm: center, scale, axes: '[x, z, -y]' },
  runtime: { file: 'muscles.glb', bytes: runtime.byteLength, sha256: sha(runtime) },
  structures: prepared.map(({ structure, sources }) => ({
    id: structure.id,
    fma: structure.fma,
    sourceName: structure.sourceName,
    sources,
  })),
}
await Bun.write('public/models/manifest.json', JSON.stringify(manifest, null, 2) + '\n')
await Bun.write(
  'docs/model-source/selected-parts.tsv',
  'structure\tgroup\tsource id\tsource label\tsource triangles\truntime triangles\tsha256\n' +
    prepared
      .flatMap(({ structure, sources }) =>
        sources.map((s, i) =>
          [
            structure.id,
            structure.group,
            s.element,
            structure.parts[i],
            s.triangles,
            s.runtimeTriangles,
            s.sha256,
          ].join('\t'),
        ),
      )
      .join('\n') +
    '\n',
)
const total = (key: 'triangles' | 'runtimeTriangles') =>
  prepared.reduce((n, p) => n + p.sources.reduce((m, s) => m + s[key], 0), 0)
console.log(
  `Prepared ${structures.length} structures from ${used.size} source meshes: ${total('triangles').toLocaleString()} → ${total('runtimeTriangles').toLocaleString()} triangles, ${runtime.byteLength.toLocaleString()} bytes. SHA-256 ${sha(runtime)}`,
)
