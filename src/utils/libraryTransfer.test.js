import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLibraryExport,
  parseLibraryExport,
  resolveTrackIds,
  mergeLibraryImport,
  EXPORT_FORMAT,
  EXPORT_VERSION,
} from './libraryTransfer.js'

const songs = [
  { id: 's1', title: 'Alpha', artist: 'Beta', album: 'A', fileName: 'alpha.mp3', url: 'https://signed/1' },
  { id: 's2', title: 'Gamma', artist: 'Delta', album: 'B', fileName: 'gamma.mp3', url: 'https://signed/2' },
]

test('export carries organisation but never signed URLs', () => {
  const out = buildLibraryExport({
    songs,
    playlists: [{ id: 'p1', name: 'Mix', description: '', accent: null, songIds: ['s1'] }],
    lovedSongIds: ['s2'],
    playCounts: { s1: 3 },
    songMeta: { s1: { bpm: 120 } },
    settings: { theme: 'ocean', somethingLocal: 'nope' },
  })
  assert.equal(out.format, EXPORT_FORMAT)
  assert.equal(out.version, EXPORT_VERSION)
  assert.equal(out.tracks.length, 2)
  assert.equal(JSON.stringify(out).includes('signed'), false)
  assert.equal(out.settings.theme, 'ocean')
  assert.equal('somethingLocal' in out.settings, false, 'device-local settings are not portable')
})

test('parse rejects junk, foreign files and future versions', () => {
  assert.equal(parseLibraryExport('not json').ok, false)
  assert.equal(parseLibraryExport('{"format":"spotify"}').ok, false)
  assert.equal(parseLibraryExport(JSON.stringify({ format: EXPORT_FORMAT, version: 99 })).ok, false)
  assert.equal(parseLibraryExport('null').ok, false)
  const good = parseLibraryExport(JSON.stringify({ format: EXPORT_FORMAT, version: 1 }))
  assert.equal(good.ok, true)
})

test('round trip through JSON parses back', () => {
  const text = JSON.stringify(buildLibraryExport({ songs }))
  const parsed = parseLibraryExport(text)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.data.tracks.length, 2)
})

test('track ids resolve by id, then by title and artist', () => {
  const exported = [
    { id: 's1', title: 'Alpha', artist: 'Beta' },
    { id: 'other-account-id', title: 'Gamma', artist: 'Delta' },
    { id: 'missing', title: 'Nowhere', artist: 'Nobody' },
  ]
  const mapping = resolveTrackIds(exported, songs)
  assert.equal(mapping.get('s1'), 's1')
  assert.equal(mapping.get('other-account-id'), 's2', 'falls back to metadata match')
  assert.equal(mapping.has('missing'), false)
})

test('import merges into a same-named playlist without duplicating tracks', () => {
  const result = mergeLibraryImport(
    { songs, playlists: [{ id: 'p1', name: 'Mix', songIds: ['s1'] }] },
    {
      tracks: [{ id: 's1', title: 'Alpha', artist: 'Beta' }, { id: 's2', title: 'Gamma', artist: 'Delta' }],
      playlists: [{ id: 'x', name: 'mix', songIds: ['s1', 's2'] }],
    },
  )
  assert.equal(result.playlists.length, 1)
  assert.deepEqual(result.playlists[0].songIds, ['s1', 's2'])
  assert.equal(result.stats.playlistsMerged, 1)
  assert.equal(result.stats.playlistsAdded, 0)
})

test('import appends a genuinely new playlist', () => {
  const result = mergeLibraryImport(
    { songs, playlists: [] },
    { tracks: [{ id: 's1', title: 'Alpha', artist: 'Beta' }], playlists: [{ id: 'x', name: 'Fresh', songIds: ['s1'] }] },
    { makeId: () => 'generated' },
  )
  assert.equal(result.playlists.length, 1)
  assert.equal(result.playlists[0].id, 'generated')
  assert.equal(result.stats.playlistsAdded, 1)
})

test('import never removes existing playlists or loved songs', () => {
  const result = mergeLibraryImport(
    { songs, playlists: [{ id: 'keep', name: 'Keep', songIds: ['s1'] }], lovedSongIds: ['s1'] },
    { tracks: [], playlists: [], lovedSongIds: [] },
  )
  assert.equal(result.playlists.length, 1)
  assert.deepEqual(result.lovedSongIds, ['s1'])
})

test('play counts add rather than overwrite', () => {
  const result = mergeLibraryImport(
    { songs, playCounts: { s1: 2 } },
    { tracks: [{ id: 's1', title: 'Alpha', artist: 'Beta' }], playCounts: { s1: 3 } },
  )
  assert.equal(result.playCounts.s1, 5)
})

test('local metadata edits win over imported ones', () => {
  const result = mergeLibraryImport(
    { songs, songMeta: { s1: { description: 'local' } } },
    { tracks: [{ id: 's1', title: 'Alpha', artist: 'Beta' }], songMeta: { s1: { description: 'imported', bpm: 90 } } },
  )
  assert.equal(result.songMeta.s1.description, 'local')
  assert.equal(result.songMeta.s1.bpm, 90, 'but new fields still come through')
})

test('a playlist whose tracks are all missing is skipped', () => {
  const result = mergeLibraryImport(
    { songs, playlists: [] },
    { tracks: [{ id: 'gone', title: 'Absent', artist: 'Ghost' }], playlists: [{ id: 'x', name: 'Orphan', songIds: ['gone'] }] },
  )
  assert.equal(result.playlists.length, 0)
  assert.equal(result.stats.tracksUnmatched, 1)
})

test('an empty playlist still imports', () => {
  const result = mergeLibraryImport(
    { songs, playlists: [] },
    { tracks: [], playlists: [{ id: 'x', name: 'Empty', songIds: [] }] },
    { makeId: () => 'e1' },
  )
  assert.equal(result.playlists.length, 1)
  assert.deepEqual(result.playlists[0].songIds, [])
})

test('merging is safe with no arguments at all', () => {
  const result = mergeLibraryImport()
  assert.deepEqual(result.playlists, [])
  assert.deepEqual(result.lovedSongIds, [])
})
