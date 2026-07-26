// Export and import of everything about a library except the audio itself.
//
// Audio lives in Supabase Storage and is not portable through a JSON file, so
// an export carries the *organisation*: playlists, loved songs, play counts,
// per-song metadata and settings, plus enough identifying information about
// each track to re-attach it on the other side.
//
// Re-attaching matters because track ids are per-account. Importing into a
// second account matches on id first, then falls back to title+artist, so a
// listener who re-uploaded the same files gets their playlists back.

import { metadataKey } from './duplicates.js'

export const EXPORT_FORMAT = 'listenwell-library'
export const EXPORT_VERSION = 1

/** Fields worth carrying across; anything else is device-local noise. */
const PORTABLE_SETTINGS = [
  'theme', 'repeat', 'volumeNormalization', 'crossfadeDuration', 'artColorExtract',
  'eqRingColor', 'customEqGains', 'savedPresets', 'auroraIntensity', 'glowSoftness',
  'blurAmount', 'songTileSize', 'playbackRate', 'eqPreset',
]

export function buildLibraryExport({
  songs = [],
  playlists = [],
  lovedSongIds = [],
  playCounts = {},
  songMeta = {},
  recentItems = [],
  settings = {},
} = {}) {
  const portableSettings = {}
  for (const key of PORTABLE_SETTINGS) {
    if (settings[key] !== undefined) portableSettings[key] = settings[key]
  }

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    // Identity only — no signed URLs, which expire and leak account paths.
    tracks: songs.map((s) => ({
      id: s.id,
      title: s.title || '',
      artist: s.artist || '',
      album: s.album || '',
      fileName: s.fileName || '',
    })),
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      accent: p.accent ?? null,
      songIds: Array.isArray(p.songIds) ? [...p.songIds] : [],
    })),
    lovedSongIds: [...lovedSongIds],
    playCounts: { ...playCounts },
    songMeta: { ...songMeta },
    recentItems: [...recentItems],
    settings: portableSettings,
  }
}

/** Parse and validate. Never throws — returns a result object. */
export function parseLibraryExport(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'That file is not a ListenWell export.' }
  }
  if (data.format !== EXPORT_FORMAT) {
    return { ok: false, error: 'That file is not a ListenWell export.' }
  }
  if (typeof data.version !== 'number' || data.version > EXPORT_VERSION) {
    return { ok: false, error: `That export was made by a newer version of ListenWell (v${data.version}).` }
  }
  return { ok: true, data }
}

/**
 * Map track ids in the export onto ids in the current library.
 * Exact id wins; otherwise title+artist. Unmatched ids are dropped.
 */
export function resolveTrackIds(exportedTracks = [], localSongs = []) {
  const localById = new Set(localSongs.map((s) => s.id))
  const localByMeta = new Map()
  for (const song of localSongs) {
    const key = metadataKey(song)
    if (key && !localByMeta.has(key)) localByMeta.set(key, song.id)
  }

  const mapping = new Map()
  for (const track of exportedTracks) {
    if (!track?.id) continue
    if (localById.has(track.id)) {
      mapping.set(track.id, track.id)
      continue
    }
    const key = metadataKey(track)
    const match = key ? localByMeta.get(key) : null
    if (match) mapping.set(track.id, match)
  }
  return mapping
}

/**
 * Merge an export into current state. Additive: nothing already present is
 * removed, because an import should never silently destroy a library.
 *
 * @returns { playlists, lovedSongIds, playCounts, songMeta, settings, stats }
 */
export function mergeLibraryImport(current = {}, imported = {}, options = {}) {
  const {
    songs = [],
    playlists: currentPlaylists = [],
    lovedSongIds: currentLoved = [],
    playCounts: currentCounts = {},
    songMeta: currentMeta = {},
  } = current

  const mapping = resolveTrackIds(imported.tracks || [], songs)
  const mapId = (id) => mapping.get(id) ?? null
  const stats = { playlistsAdded: 0, playlistsMerged: 0, tracksMatched: mapping.size, tracksUnmatched: 0 }
  stats.tracksUnmatched = (imported.tracks || []).length - mapping.size

  // Playlists: merge into a same-named list when one exists, else append.
  const byName = new Map(currentPlaylists.map((p) => [p.name?.toLowerCase(), p]))
  const playlists = currentPlaylists.map((p) => ({ ...p, songIds: [...(p.songIds || [])] }))

  for (const incoming of imported.playlists || []) {
    const songIds = (incoming.songIds || []).map(mapId).filter(Boolean)
    if (songIds.length === 0 && (incoming.songIds || []).length > 0) continue

    const existing = byName.get(incoming.name?.toLowerCase())
    if (existing) {
      const target = playlists.find((p) => p.id === existing.id)
      const seen = new Set(target.songIds)
      for (const id of songIds) if (!seen.has(id)) { target.songIds.push(id); seen.add(id) }
      stats.playlistsMerged++
    } else {
      playlists.push({
        id: options.makeId ? options.makeId() : `imported-${incoming.id}`,
        name: incoming.name || 'Imported playlist',
        description: incoming.description || '',
        accent: incoming.accent ?? null,
        coverUrl: null,
        songIds,
      })
      stats.playlistsAdded++
    }
  }

  const lovedSongIds = [...currentLoved]
  const lovedSeen = new Set(lovedSongIds)
  for (const id of imported.lovedSongIds || []) {
    const mapped = mapId(id)
    if (mapped && !lovedSeen.has(mapped)) { lovedSongIds.push(mapped); lovedSeen.add(mapped) }
  }

  // Counts add together: the same track played on two devices was played twice.
  const playCounts = { ...currentCounts }
  for (const [id, count] of Object.entries(imported.playCounts || {})) {
    const mapped = mapId(id)
    if (!mapped || typeof count !== 'number') continue
    playCounts[mapped] = (playCounts[mapped] || 0) + count
  }

  // Existing metadata wins — a local edit is more current than an import.
  const songMeta = { ...currentMeta }
  for (const [id, meta] of Object.entries(imported.songMeta || {})) {
    const mapped = mapId(id)
    if (!mapped || !meta) continue
    songMeta[mapped] = { ...meta, ...songMeta[mapped] }
  }

  return { playlists, lovedSongIds, playCounts, songMeta, settings: imported.settings || {}, stats }
}
