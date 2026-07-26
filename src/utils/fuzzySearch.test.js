import test from 'node:test'
import assert from 'node:assert/strict'

import { fuzzyScore, fuzzyRank } from './fuzzySearch.js'

test('an empty query matches everything equally', () => {
  assert.equal(fuzzyScore('anything', ''), 1)
  assert.equal(fuzzyScore('anything', '   '), 1)
})

test('a substring scores, a missing character does not', () => {
  assert.ok(fuzzyScore('Geogaddi', 'geo') > 0)
  assert.equal(fuzzyScore('Geogaddi', 'xyz'), 0)
  assert.equal(fuzzyScore('', 'geo'), 0)
})

test('matching is case-insensitive', () => {
  assert.ok(fuzzyScore('Boards of Canada', 'BOARDS') > 0)
})

test('a substring beats a scattered subsequence', () => {
  const substring = fuzzyScore('play next', 'next')
  const scattered = fuzzyScore('none exist xylophone tonight', 'next')
  assert.ok(substring > scattered, `${substring} should beat ${scattered}`)
})

test('a match at the start of a word outranks one mid-word', () => {
  assert.ok(fuzzyScore('Open settings', 'set') > fuzzyScore('Unsettling', 'set'))
})

test('initials find a multi-word title', () => {
  assert.ok(fuzzyScore('Boards of Canada Geogaddi', 'bocg') > 0)
})

test('characters must appear in order', () => {
  assert.equal(fuzzyScore('abc', 'cba'), 0)
})

test('ranking puts the intended item first', () => {
  const items = ['Shuffle', 'Show settings', 'Sleep', 'Playlists']
  assert.equal(fuzzyRank(items, 'shuf')[0], 'Shuffle')
  assert.equal(fuzzyRank(items, 'play')[0], 'Playlists')
})

test('ranking searches every provided field', () => {
  const songs = [
    { title: 'Xtal', artist: 'Aphex Twin' },
    { title: 'Roygbiv', artist: 'Boards of Canada' },
  ]
  const byArtist = fuzzyRank(songs, 'aphex', (s) => [s.title, s.artist])
  assert.equal(byArtist[0].title, 'Xtal')
})

test('non-matching items are dropped entirely', () => {
  assert.deepEqual(fuzzyRank(['alpha', 'beta'], 'zzz'), [])
})

test('the limit is respected', () => {
  const items = Array.from({ length: 50 }, (_, i) => `item ${i}`)
  assert.equal(fuzzyRank(items, 'item', undefined, 5).length, 5)
})

test('empty input is safe', () => {
  assert.deepEqual(fuzzyRank([], 'x'), [])
  assert.deepEqual(fuzzyRank(), [])
})
