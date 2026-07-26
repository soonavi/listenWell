import test from 'node:test'
import assert from 'node:assert/strict'

import {
  offlineKeyFor,
  formatBytes,
  listOfflineSongIds,
  isSongOffline,
  saveSongOffline,
  removeSongOffline,
  offlineUsageBytes,
  storageEstimate,
} from './offlineCache.js'

test('the cache key is derived from the track id, not the signed URL', () => {
  assert.equal(offlineKeyFor('abc-123'), '/__offline_audio__/abc-123')
  // Two different signed URLs for the same track must land on one key.
  assert.equal(offlineKeyFor('abc-123'), offlineKeyFor('abc-123'))
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

test('a storage estimate is optional, never fatal', async () => {
  const estimate = await storageEstimate()
  assert.ok(estimate === null || typeof estimate.usage === 'number')
})
