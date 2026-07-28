// The listening sphere.
//
// The same counts the listening log reports, arranged as a globe instead of a
// list. Three rules, and nothing else is encoded:
//
//   latitude  — rank. What you have played most sits at the top.
//   dot area  — the play count itself.
//   colour    — violet at the most played, cyan at the least.
//
// Nothing is inferred, predicted or recommended; this is the play counts
// drawn, and it reads as a reading instrument rather than a year in review.
// There are no timestamps behind any of it — the account stores a count per
// track, not a history of when — so the sphere deliberately has no time axis.

import { normalizeForMatch } from './duplicates.js'
import { UNKNOWN_ARTIST } from './grouping.js'

/** The angle that spaces a Fibonacci lattice evenly over a sphere. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/**
 * Ceiling on drawn nodes. A library with thousands of played tracks would turn
 * the sphere into noise long before it turned it into a slideshow, so the cap
 * is about legibility first. Whatever it drops is reported, never silent.
 */
export const MAX_NODES = 240

/**
 * How far the globe may be pitched, in radians — short of a right angle on
 * purpose. Turned fully onto a pole, latitude stops reading as rank and the
 * sphere collapses into concentric rings of dots that encode nothing.
 */
export const PITCH_LIMIT = 1.25

const TAU = Math.PI * 2

const VIOLET = [139, 92, 246]
const CYAN = [34, 211, 238]

/**
 * One point of a Fibonacci lattice — the standard trick for scattering n points
 * over a sphere with no clumping at the poles. Index 0 is the north pole, so
 * feeding it a list ordered by play count puts the most played at the top.
 */
export function latticePoint(index, count) {
  const y = count > 1 ? 1 - (index / (count - 1)) * 2 : 0
  const ring = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = index * GOLDEN_ANGLE
  return { x: Math.cos(theta) * ring, y, z: Math.sin(theta) * ring }
}

function aggregate(songs, playCounts, mode) {
  if (mode === 'tracks') {
    return songs
      .map((song) => {
        const count = Number(playCounts[song.id]) || 0
        return {
          key: song.id,
          label: song.title || song.fileName || 'Untitled',
          sublabel: (song.artist || '').trim() || UNKNOWN_ARTIST,
          count,
          tracks: 1,
          seconds: count * (Number(song.duration) || 0),
          coverUrl: song.coverUrl || null,
          songIds: [song.id],
        }
      })
      .filter((node) => node.count > 0)
  }

  const groups = new Map()
  let unfiled = 0

  for (const song of songs) {
    const count = Number(playCounts[song.id]) || 0
    if (count === 0) continue
    const artist = (song.artist || '').trim() || UNKNOWN_ARTIST

    let key
    let label
    let sublabel = null
    if (mode === 'albums') {
      const album = (song.album || '').trim()
      // Same rule the Albums browse view follows: a record exists because it
      // was named. An untagged upload is a loose track, so it is counted as
      // unfiled and reported rather than invented into an album of one.
      if (!album) { unfiled += 1; continue }
      key = `${normalizeForMatch(album)}|${normalizeForMatch(artist)}`
      label = album
      sublabel = artist
    } else {
      key = normalizeForMatch(artist) || artist.toLowerCase()
      label = artist
    }

    let group = groups.get(key)
    if (!group) {
      group = { key, label, sublabel, count: 0, tracks: 0, seconds: 0, coverUrl: null, songIds: [] }
      groups.set(key, group)
    }
    group.count += count
    group.tracks += 1
    group.seconds += count * (Number(song.duration) || 0)
    if (!group.coverUrl && song.coverUrl) group.coverUrl = song.coverUrl
    group.songIds.push(song.id)
  }

  const list = [...groups.values()]
  if (mode === 'artists') {
    for (const group of list) {
      group.sublabel = `${group.tracks} track${group.tracks === 1 ? '' : 's'}`
    }
  }
  list.unfiled = unfiled
  return list
}

/**
 * Everything the sphere draws, for one mode.
 *
 * @param mode 'artists' | 'albums' | 'tracks'
 * @returns {{ nodes, total, truncated, unfiled, totalPlays }}
 *   nodes carry a unit-sphere position, a 0..1 `weight` (share of the top
 *   node's count, which drives dot size) and a 0..1 `tone` (rank position,
 *   which drives colour).
 */
export function buildSphereNodes(songs = [], playCounts = {}, mode = 'artists', limit = MAX_NODES) {
  const all = aggregate(songs, playCounts, mode)
  const unfiled = all.unfiled || 0
  all.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))

  const kept = all.slice(0, Math.max(0, limit))
  const size = kept.length
  const topCount = size > 0 ? kept[0].count : 0
  const totalPlays = all.reduce((sum, node) => sum + node.count, 0)

  const nodes = kept.map((node, index) => ({
    ...node,
    // Songs are listed most-played first so a node's tracks are useful to play
    // straight from the detail panel.
    songIds: mode === 'tracks'
      ? node.songIds
      : [...node.songIds].sort((a, b) => (Number(playCounts[b]) || 0) - (Number(playCounts[a]) || 0)),
    rank: index + 1,
    ...latticePoint(index, size),
    weight: topCount > 0 ? node.count / topCount : 0,
    tone: size > 1 ? index / (size - 1) : 0,
    share: totalPlays > 0 ? node.count / totalPlays : 0,
  }))

  return { nodes, total: all.length, truncated: Math.max(0, all.length - size), unfiled, totalPlays }
}

/**
 * Rotate a unit-sphere point into view and project it to the screen.
 *
 * `distance` is the camera's distance in sphere radii; the resulting `scale`
 * both sizes the dot and tells the caller how near the front the point is.
 */
export function project(node, { rotX, rotY, radius, cx, cy, distance = 3.2 }) {
  const cosY = Math.cos(rotY)
  const sinY = Math.sin(rotY)
  const x1 = node.x * cosY + node.z * sinY
  const z1 = node.z * cosY - node.x * sinY

  const cosX = Math.cos(rotX)
  const sinX = Math.sin(rotX)
  const y2 = node.y * cosX - z1 * sinX
  const z2 = node.y * sinX + z1 * cosX

  const scale = distance / (distance - z2)
  return { sx: cx + x1 * radius * scale, sy: cy - y2 * radius * scale, z: z2, scale }
}

/**
 * The rotation that turns a node to the front of the globe, facing the camera.
 *
 * It falls straight out of the order `project` rotates in — Y first, then X.
 * Undoing the node's own bearing puts it in the plane of the screen centre
 * (x1 = 0, which leaves z1 = hypot(x, z), its distance from the polar axis),
 * and pitching by its latitude lifts it onto the equator (y2 = 0). Together
 * that is the canvas centre at z = 1, the nearest point of the sphere.
 *
 * Two corrections sit on top of the arithmetic:
 *
 * The pitch is clamped exactly as dragging clamps it, so a node near a pole
 * comes as near the middle as the camera is ever allowed and stops there. It
 * ends up off-centre, which is the honest result — the alternative is a view
 * the rest of the component forbids.
 *
 * rotY is unbounded, because it counts every turn the user has dragged
 * through. Tweening to a raw angle could therefore spin the globe several times
 * on the way to a node that was already in front of them, so the target is the
 * current angle plus the short way round: the move a viewer would describe as
 * turning to face it.
 */
export function focusRotation(node, currentRotY) {
  const pitch = Math.atan2(node.y, Math.hypot(node.x, node.z))

  let delta = (-Math.atan2(node.x, node.z) - currentRotY) % TAU
  if (delta > Math.PI) delta -= TAU
  else if (delta <= -Math.PI) delta += TAU

  return {
    rotX: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch)),
    rotY: currentRotY + delta,
  }
}

/** Dot radius before perspective, in pixels, proportional to the sphere. */
export function dotRadius(weight, radius) {
  const min = radius * 0.013
  const max = radius * 0.055
  // Area, not diameter, tracks the count — the honest way to size a bubble.
  return min + (max - min) * Math.sqrt(Math.max(0, Math.min(1, weight)))
}

/**
 * Radius for a node drawn as its cover art.
 *
 * Same square-root-of-the-count curve as a dot, over a larger range: a 4px
 * disc is a fine dot and a useless photograph, so the floor is raised until
 * the smallest cover is still recognisable. Sizes stay comparable to each
 * other, which is what the encoding claims — they are simply all bigger.
 */
export function artRadius(weight, radius) {
  const min = radius * 0.030
  const max = radius * 0.078
  return min + (max - min) * Math.sqrt(Math.max(0, Math.min(1, weight)))
}

/** How many of these nodes actually have a cover to draw. */
export function countWithArt(nodes = []) {
  return nodes.reduce((total, node) => total + (node.coverUrl ? 1 : 0), 0)
}

/**
 * The square crop of an image that fills a circle without stretching it —
 * canvas has no object-fit, so the centre square is worked out by hand.
 */
export function coverCrop(naturalWidth, naturalHeight) {
  const side = Math.min(naturalWidth, naturalHeight)
  return { sx: (naturalWidth - side) / 2, sy: (naturalHeight - side) / 2, side }
}

/** Violet at the most played (tone 0) through to cyan at the least (tone 1). */
export function toneColor(tone, alpha = 1) {
  const t = Math.max(0, Math.min(1, tone))
  const channel = (i) => Math.round(VIOLET[i] + (CYAN[i] - VIOLET[i]) * t)
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${alpha})`
}

/** Far side of the globe fades rather than disappears, so depth reads. */
export function depthAlpha(z) {
  return 0.2 + 0.8 * ((Math.max(-1, Math.min(1, z)) + 1) / 2)
}

/**
 * Nearest drawn dot under the pointer. Ties go to whichever is nearest the
 * camera, which is the one the eye believes it clicked.
 *
 * @param points [{ sx, sy, r, z, node }]
 */
export function pickNode(points = [], px, py, pad = 6) {
  let best = null
  for (const point of points) {
    const dx = px - point.sx
    const dy = py - point.sy
    const reach = point.r + pad
    if (dx * dx + dy * dy <= reach * reach && (!best || point.z > best.z)) best = point
  }
  return best
}
