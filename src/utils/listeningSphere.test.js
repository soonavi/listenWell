import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSphereNodes,
  latticePoint,
  project,
  dotRadius,
  toneColor,
  depthAlpha,
  pickNode,
} from './listeningSphere.js'

const songs = [
  { id: 'a', title: 'Roygbiv', artist: 'Boards of Canada', album: 'Music Has the Right', duration: 100, coverUrl: 'cover-a' },
  { id: 'b', title: 'Sixtyten', artist: 'Boards of Canada', album: 'Music Has the Right', duration: 200, coverUrl: null },
  { id: 'c', title: 'Xtal', artist: 'Aphex Twin', album: 'Selected Ambient Works', duration: 300, coverUrl: null },
  { id: 'd', title: 'Voice memo', artist: '', album: '', duration: 60, coverUrl: null },
  { id: 'e', title: 'Never played', artist: 'Kavinsky', album: 'OutRun', duration: 120, coverUrl: null },
]
// a:5 b:1 c:4 d:2 — e is never played
const playCounts = { a: 5, b: 1, c: 4, d: 2 }

test('only played entries reach the sphere', () => {
  const { nodes } = buildSphereNodes(songs, playCounts, 'tracks')
  assert.deepEqual(nodes.map((n) => n.key), ['a', 'c', 'd', 'b'])
  assert.ok(!nodes.some((n) => n.key === 'e'), 'a never-played track is not listening history')
})

test('artists aggregate their tracks, plays and time', () => {
  const { nodes } = buildSphereNodes(songs, playCounts, 'artists')
  const boc = nodes.find((n) => n.label === 'Boards of Canada')
  assert.equal(boc.count, 6, '5 + 1')
  assert.equal(boc.tracks, 2)
  assert.equal(boc.seconds, 5 * 100 + 1 * 200)
  assert.equal(boc.sublabel, '2 tracks')
  assert.equal(boc.coverUrl, 'cover-a', 'first available cover stands in')
})

test('rank orders by plays, and rank 1 sits at the north pole', () => {
  const { nodes } = buildSphereNodes(songs, playCounts, 'artists')
  assert.deepEqual(nodes.map((n) => n.label), ['Boards of Canada', 'Aphex Twin', 'Unknown artist'])
  assert.equal(nodes[0].rank, 1)
  assert.equal(nodes[0].y, 1, 'most played is the top of the globe')
  assert.equal(nodes[nodes.length - 1].y, -1, 'least played is the bottom')
})

test('an untagged track is unfiled in albums mode, not invented into an album', () => {
  const { nodes, unfiled } = buildSphereNodes(songs, playCounts, 'albums')
  assert.deepEqual(nodes.map((n) => n.label), ['Music Has the Right', 'Selected Ambient Works'])
  assert.equal(unfiled, 1, 'the untagged voice memo is reported, not dropped silently')
})

test('weight is the share of the top count and tone spans the ramp', () => {
  const { nodes } = buildSphereNodes(songs, playCounts, 'artists')
  assert.equal(nodes[0].weight, 1)
  assert.equal(nodes[1].weight, 4 / 6)
  assert.equal(nodes[0].tone, 0)
  assert.equal(nodes[nodes.length - 1].tone, 1)
})

test('share is the fraction of all counted plays', () => {
  const { nodes, totalPlays } = buildSphereNodes(songs, playCounts, 'tracks')
  assert.equal(totalPlays, 12)
  assert.equal(nodes[0].share, 5 / 12)
  assert.equal(nodes.reduce((sum, n) => sum + n.share, 0).toFixed(6), '1.000000')
})

test('a group lists its songs most-played first', () => {
  const { nodes } = buildSphereNodes(songs, playCounts, 'artists')
  const boc = nodes.find((n) => n.label === 'Boards of Canada')
  assert.deepEqual(boc.songIds, ['a', 'b'])
})

test('the node cap is reported rather than silent', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, title: `T${i}`, artist: `Artist ${i}` }))
  const counts = Object.fromEntries(many.map((s, i) => [s.id, i + 1]))
  const { nodes, total, truncated } = buildSphereNodes(many, counts, 'artists', 10)
  assert.equal(nodes.length, 10)
  assert.equal(total, 30)
  assert.equal(truncated, 20)
})

test('a single node sits on the equator rather than dividing by zero', () => {
  const { nodes } = buildSphereNodes([songs[0]], { a: 3 }, 'tracks')
  assert.equal(nodes.length, 1)
  assert.equal(nodes[0].y, 0)
  assert.equal(nodes[0].tone, 0)
  assert.ok(Number.isFinite(nodes[0].x) && Number.isFinite(nodes[0].z))
})

test('lattice points all land on the unit sphere', () => {
  for (let i = 0; i < 50; i += 1) {
    const p = latticePoint(i, 50)
    const length = Math.hypot(p.x, p.y, p.z)
    assert.ok(Math.abs(length - 1) < 1e-9, `point ${i} is off the sphere: ${length}`)
  }
})

test('an empty library builds an empty sphere', () => {
  const empty = buildSphereNodes([], {}, 'artists')
  assert.deepEqual(empty.nodes, [])
  assert.equal(empty.total, 0)
  assert.equal(empty.totalPlays, 0)
  assert.deepEqual(buildSphereNodes().nodes, [])
})

test('projection puts the sphere centre at the canvas centre', () => {
  const view = { rotX: 0, rotY: 0, radius: 100, cx: 200, cy: 150 }
  const centre = project({ x: 0, y: 0, z: 0 }, view)
  assert.equal(centre.sx, 200)
  assert.equal(centre.sy, 150)
  assert.equal(centre.scale, 1)
})

test('a nearer point projects larger, a further point smaller', () => {
  const view = { rotX: 0, rotY: 0, radius: 100, cx: 0, cy: 0 }
  const near = project({ x: 0, y: 0, z: 1 }, view)
  const far = project({ x: 0, y: 0, z: -1 }, view)
  assert.ok(near.scale > 1 && far.scale < 1)
  assert.ok(near.z > far.z)
})

test('screen y grows downward while sphere y grows upward', () => {
  const view = { rotX: 0, rotY: 0, radius: 100, cx: 0, cy: 0 }
  assert.ok(project({ x: 0, y: 1, z: 0 }, view).sy < project({ x: 0, y: -1, z: 0 }, view).sy)
})

test('a half turn about Y sends the front of the sphere to the back', () => {
  const view = { rotX: 0, rotY: Math.PI, radius: 100, cx: 0, cy: 0 }
  const flipped = project({ x: 0, y: 0, z: 1 }, view)
  assert.ok(Math.abs(flipped.z + 1) < 1e-9)
})

test('rotation preserves the radius', () => {
  const view = { rotX: 0.7, rotY: -2.1, radius: 1, cx: 0, cy: 0, distance: 1e9 }
  const p = project({ x: 0.6, y: 0.48, z: 0.64 }, view)
  assert.ok(Math.abs(Math.hypot(p.sx, p.sy, p.z) - 1) < 1e-6)
})

test('dot area, not diameter, tracks the count', () => {
  const r = dotRadius(1, 100) - dotRadius(0, 100)
  const quarter = dotRadius(0.25, 100) - dotRadius(0, 100)
  assert.ok(Math.abs(quarter - r / 2) < 1e-9, 'a quarter of the plays is half the radius')
  assert.ok(dotRadius(2, 100) === dotRadius(1, 100), 'weight is clamped')
})

test('the colour ramp runs violet to cyan', () => {
  assert.equal(toneColor(0, 1), 'rgba(139, 92, 246, 1)')
  assert.equal(toneColor(1, 1), 'rgba(34, 211, 238, 1)')
  assert.equal(toneColor(0.5, 0.5), 'rgba(87, 152, 242, 0.5)')
})

test('the far hemisphere fades but never vanishes', () => {
  assert.equal(depthAlpha(1), 1)
  assert.equal(depthAlpha(-1), 0.2)
  assert.ok(depthAlpha(0) > depthAlpha(-0.5))
})

test('picking prefers the dot nearest the camera when two overlap', () => {
  const points = [
    { sx: 10, sy: 10, r: 8, z: -0.5, node: { key: 'back' } },
    { sx: 12, sy: 11, r: 8, z: 0.9, node: { key: 'front' } },
  ]
  assert.equal(pickNode(points, 11, 10).node.key, 'front')
  assert.equal(pickNode(points, 500, 500), null)
})

test('picking has a tolerance so small dots stay tappable', () => {
  const points = [{ sx: 0, sy: 0, r: 2, z: 0, node: { key: 'tiny' } }]
  assert.equal(pickNode(points, 7, 0, 6).node.key, 'tiny')
  assert.equal(pickNode(points, 7, 0, 0), null)
})
