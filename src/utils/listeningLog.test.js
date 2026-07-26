import test from 'node:test'
import assert from 'node:assert/strict'

import {
  totalPlays,
  estimatedSeconds,
  formatDuration,
  topTracks,
  topArtists,
  libraryCoverage,
  neverPlayed,
  buildListeningLog,
} from './listeningLog.js'

const songs = [
  { id: '1', title: 'One', artist: 'Alpha', duration: 200 },
  { id: '2', title: 'Two', artist: 'Alpha', duration: 100 },
  { id: '3', title: 'Three', artist: 'Beta', duration: 300 },
  { id: '4', title: 'Four', artist: '', duration: 60 },
]
const playCounts = { 1: 5, 2: 2, 3: 1 }

test('total plays sums every count', () => {
  assert.equal(totalPlays(playCounts), 8)
  assert.equal(totalPlays({}), 0)
  assert.equal(totalPlays(), 0)
})

test('estimated time multiplies plays by duration', () => {
  // 5*200 + 2*100 + 1*300 = 1500
  assert.equal(estimatedSeconds(songs, playCounts), 1500)
})

test('missing durations contribute nothing rather than NaN', () => {
  const result = estimatedSeconds([{ id: '1', title: 'x' }], { 1: 3 })
  assert.equal(result, 0)
})

test('durations format readably', () => {
  assert.equal(formatDuration(0), '—')
  assert.equal(formatDuration(30), '<1m')
  assert.equal(formatDuration(600), '10m')
  assert.equal(formatDuration(3600), '1h')
  assert.equal(formatDuration(12240), '3h 24m')
  assert.equal(formatDuration(undefined), '—')
})

test('top tracks rank by count and exclude unplayed', () => {
  const top = topTracks(songs, playCounts)
  assert.deepEqual(top.map((t) => t.song.id), ['1', '2', '3'])
  assert.equal(top[0].count, 5)
  assert.equal(top.some((t) => t.song.id === '4'), false)
})

test('top tracks respects the limit', () => {
  assert.equal(topTracks(songs, playCounts, 2).length, 2)
})

test('artist totals combine their tracks', () => {
  const artists = topArtists(songs, playCounts)
  assert.deepEqual(artists[0], { artist: 'Alpha', count: 7, tracks: 2 })
  assert.deepEqual(artists[1], { artist: 'Beta', count: 1, tracks: 1 })
})

test('an untagged artist is labelled, not dropped', () => {
  const artists = topArtists(songs, { 4: 3 })
  assert.equal(artists[0].artist, 'Unknown artist')
})

test('coverage reports how much of the library was touched', () => {
  assert.deepEqual(libraryCoverage(songs, playCounts), { played: 3, total: 4, percent: 75 })
  assert.deepEqual(libraryCoverage([], {}), { played: 0, total: 0, percent: 0 })
})

test('never played lists the forgotten tracks', () => {
  assert.deepEqual(neverPlayed(songs, playCounts).map((s) => s.id), ['4'])
})

test('the whole log builds from empty state without throwing', () => {
  const log = buildListeningLog([], {})
  assert.equal(log.totalPlays, 0)
  assert.deepEqual(log.topTracks, [])
  assert.deepEqual(log.topArtists, [])
  assert.equal(log.coverage.percent, 0)
})

test('the whole log builds from real state', () => {
  const log = buildListeningLog(songs, playCounts)
  assert.equal(log.totalPlays, 8)
  assert.equal(log.estimatedSeconds, 1500)
  assert.equal(log.topArtists[0].artist, 'Alpha')
  assert.equal(log.coverage.played, 3)
  assert.equal(log.neverPlayed.length, 1)
})
