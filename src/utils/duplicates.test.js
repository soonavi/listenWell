import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeForMatch, metadataKey, findDuplicates, hashAudioFile } from './duplicates.js'

test('normalizeForMatch folds spelling differences together', () => {
  assert.equal(normalizeForMatch('  Hello World  '), 'hello world')
  assert.equal(normalizeForMatch('Björk'), 'bjork')
  assert.equal(normalizeForMatch('Song (Remastered 2011)'), 'song')
  assert.equal(normalizeForMatch('Track [Explicit]'), 'track')
  assert.equal(normalizeForMatch('A.B - C_D'), 'a b c d')
  assert.equal(normalizeForMatch(null), '')
})

test('metadataKey needs a title and ignores accents', () => {
  assert.equal(metadataKey({ title: 'Alpha', artist: 'Beta' }), 'alpha beta')
  assert.equal(metadataKey({ title: '', artist: 'Beta' }), '')
  assert.equal(
    metadataKey({ title: 'Jólin', artist: 'Björk' }),
    metadataKey({ title: 'Jolin', artist: 'Bjork' }),
  )
})

const existing = [
  { id: 'e1', title: 'Alpha', artist: 'Beta', contentHash: 'aaa' },
  { id: 'e2', title: 'Gamma', artist: 'Delta', contentHash: 'bbb' },
]

test('identical bytes are reported as a content match', () => {
  const found = findDuplicates(
    [{ id: 'c1', title: 'Totally Different', artist: 'X', contentHash: 'aaa' }],
    existing,
  )
  assert.deepEqual(found.map((r) => [r.candidate.id, r.match.id, r.reason]), [['c1', 'e1', 'content']])
})

test('same title and artist with different bytes is a metadata match', () => {
  const found = findDuplicates(
    [{ id: 'c2', title: 'alpha', artist: 'BETA', contentHash: 'zzz' }],
    existing,
  )
  assert.deepEqual(found.map((r) => [r.candidate.id, r.match.id, r.reason]), [['c2', 'e1', 'metadata']])
})

test('a remaster still matches the original by metadata', () => {
  const found = findDuplicates(
    [{ id: 'c4', title: 'Alpha (Remastered)', artist: 'Beta', contentHash: 'ppp' }],
    existing,
  )
  assert.deepEqual(found.map((r) => r.reason), ['metadata'])
})

test('a genuinely new track is not flagged', () => {
  assert.deepEqual(
    findDuplicates([{ id: 'c3', title: 'Brand New', artist: 'Nobody', contentHash: 'qqq' }], existing),
    [],
  )
})

test('the same file picked twice in one batch is caught', () => {
  const found = findDuplicates([
    { id: 'b1', title: 'New Song', artist: 'A', contentHash: 'h1' },
    { id: 'b2', title: 'New Song', artist: 'A', contentHash: 'h1' },
  ], [])
  assert.deepEqual(found.map((r) => [r.candidate.id, r.match.id, r.reason]), [['b2', 'b1', 'content']])
})

test('untitled files do not all collapse into one duplicate', () => {
  const found = findDuplicates([
    { id: 'u1', title: '', artist: '', contentHash: 'x1' },
    { id: 'u2', title: '', artist: '', contentHash: 'x2' },
  ], [])
  assert.deepEqual(found, [])
})

test('empty input is safe', () => {
  assert.deepEqual(findDuplicates(), [])
})

test('hashAudioFile is stable and content-addressed', async () => {
  const a = await hashAudioFile(new Blob([new Uint8Array([1, 2, 3, 4])]))
  const b = await hashAudioFile(new Blob([new Uint8Array([1, 2, 3, 4])]))
  const c = await hashAudioFile(new Blob([new Uint8Array([9, 9, 9, 9])]))
  assert.match(a, /^[0-9a-f]{64}$/)
  assert.equal(a, b)
  assert.notEqual(a, c)
})
