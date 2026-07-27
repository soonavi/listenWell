import test from 'node:test'
import assert from 'node:assert/strict'

import {
  offlineKeyFor,
  offlineCoverKeyFor,
  formatBytes,
  listOfflineSongIds,
  isSongOffline,
  saveSongOffline,
  saveFileOffline,
  saveCoverOffline,
  offlineCoverObjectUrl,
  offlineSongBlob,
  removeSongOffline,
  offlineUsageBytes,
  storageEstimate,
} from './offlineCache.js'

test('the cache key is derived from the track id, not the signed URL', () => {
  assert.equal(offlineKeyFor('abc-123'), '/__offline_audio__/abc-123')
  // Two different signed URLs for the same track must land on one key.
  assert.equal(offlineKeyFor('abc-123'), offlineKeyFor('abc-123'))
})

test('cover art gets its own key so it never reads back as a track', () => {
  assert.equal(offlineCoverKeyFor('abc-123'), '/__offline_cover__/abc-123')
  assert.notEqual(offlineCoverKeyFor('abc-123'), offlineKeyFor('abc-123'))
  // listOfflineSongIds() matches only the audio prefix — a cover must not be
  // mistaken for a downloaded song.
  assert.ok(!offlineCoverKeyFor('abc-123').includes('__offline_audio__'))
})

test('byte sizes format at a sensible scale', () => {
  assert.equal(formatBytes(0), '0 MB')
  assert.equal(formatBytes(-5), '0 MB')
  assert.equal(formatBytes(2048), '2 KB')
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB')
  assert.equal(formatBytes(120 * 1024 * 1024), '120 MB')
  assert.equal(formatBytes(2 * 1024 * 1024 * 1024), '2.0 GB')
  assert.equal(formatBytes(undefined), '0 MB')
})

// Every cache helper has to degrade quietly where Cache Storage doesn't exist —
// Node here, but equally Safari private browsing and older embedded webviews.
test('helpers degrade quietly without Cache Storage', async () => {
  assert.deepEqual(await listOfflineSongIds(), [])
  assert.equal(await isSongOffline('x'), false)
  assert.equal(await removeSongOffline('x'), false)
  assert.equal(await offlineUsageBytes(), 0)
})

test('saving reports a clear failure rather than throwing', async () => {
  const result = await saveSongOffline('x', 'https://example.test/a.mp3')
  assert.equal(result.ok, false)
  assert.equal(typeof result.error, 'string')
})

test('saving validates its arguments', async () => {
  assert.equal((await saveSongOffline(null, null)).ok, false)
})

// A device-only upload writes the picked file straight in. If that path can't
// report failure cleanly the song is lost with nothing on the server to fall
// back to, so it matters more here than for a downloaded copy.
test('storing a picked file degrades quietly and validates its arguments', async () => {
  const failed = await saveFileOffline('x', new Blob(['audio']))
  assert.equal(failed.ok, false)
  assert.equal(typeof failed.error, 'string')

  assert.equal((await saveFileOffline(null, null)).ok, false)
  assert.equal((await saveFileOffline('x', null)).ok, false)
})

test('cover helpers degrade quietly without Cache Storage', async () => {
  assert.equal(await saveCoverOffline('x', new Blob(['img'])), false)
  assert.equal(await saveCoverOffline('x', null), false)
  assert.equal(await offlineCoverObjectUrl('x'), null)
  assert.equal(await offlineSongBlob('x'), null)
})

test('a storage estimate is optional, never fatal', async () => {
  const estimate = await storageEstimate()
  assert.ok(estimate === null || typeof estimate.usage === 'number')
})
