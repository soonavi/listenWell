import test from 'node:test'
import assert from 'node:assert/strict'

import {
  evaluateRule,
  matchesDefinition,
  selectSmartPlaylistSongs,
  describeDefinition,
  createEmptyDefinition,
  fieldType,
} from './smartPlaylists.js'

const songs = [
  { id: 's1', title: 'Roygbiv', artist: 'Boards of Canada', album: 'Music Has the Right', bpm: 92 },
  { id: 's2', title: 'Xtal', artist: 'Aphex Twin', album: 'Selected Ambient Works', bpm: 128 },
  { id: 's3', title: 'Ageispolis', artist: 'Aphex Twin', album: 'Selected Ambient Works', bpm: null },
]
const context = { lovedSongIds: ['s1'], playCounts: { s1: 12, s2: 3 } }

test('text operators compare case- and accent-insensitively', () => {
  assert.equal(evaluateRule(songs[0], { field: 'artist', op: 'contains', value: 'BOARDS' }, context), true)
  assert.equal(evaluateRule(songs[0], { field: 'artist', op: 'is', value: 'boards of canada' }, context), true)
  assert.equal(evaluateRule(songs[0], { field: 'artist', op: 'isNot', value: 'Aphex Twin' }, context), true)
  assert.equal(evaluateRule(songs[0], { field: 'title', op: 'startsWith', value: 'roy' }, context), true)
  assert.equal(evaluateRule(songs[0], { field: 'artist', op: 'notContains', value: 'aphex' }, context), true)
})

test('an unfinished text rule constrains nothing', () => {
  assert.equal(evaluateRule(songs[0], { field: 'artist', op: 'contains', value: '' }, context), true)
})

test('boolean rules read from context, not the song', () => {
  assert.equal(evaluateRule(songs[0], { field: 'loved', op: 'isTrue' }, context), true)
  assert.equal(evaluateRule(songs[1], { field: 'loved', op: 'isTrue' }, context), false)
  assert.equal(evaluateRule(songs[1], { field: 'loved', op: 'isFalse' }, context), true)
})

test('play count defaults to zero for never-played tracks', () => {
  assert.equal(evaluateRule(songs[0], { field: 'playCount', op: 'gte', value: 10 }, context), true)
  assert.equal(evaluateRule(songs[1], { field: 'playCount', op: 'gte', value: 10 }, context), false)
  assert.equal(evaluateRule(songs[2], { field: 'playCount', op: 'lte', value: 0 }, context), true)
})

test('an unmeasured BPM never satisfies a numeric rule', () => {
  assert.equal(evaluateRule(songs[2], { field: 'bpm', op: 'lte', value: 200 }, context), false)
  assert.equal(evaluateRule(songs[2], { field: 'bpm', op: 'gte', value: 0 }, context), false)
  assert.equal(evaluateRule(songs[1], { field: 'bpm', op: 'gte', value: 120 }, context), true)
})

test('match all requires every rule, match any requires one', () => {
  const all = { match: 'all', rules: [
    { field: 'artist', op: 'contains', value: 'aphex' },
    { field: 'bpm', op: 'gte', value: 120 },
  ] }
  assert.equal(matchesDefinition(songs[1], all, context), true)
  assert.equal(matchesDefinition(songs[2], all, context), false)

  const any = { ...all, match: 'any' }
  assert.equal(matchesDefinition(songs[2], any, context), true, 'artist alone is enough')
})

test('a definition with no rules matches the whole library', () => {
  assert.deepEqual(
    selectSmartPlaylistSongs(songs, { match: 'all', rules: [] }, context).map((s) => s.id),
    ['s1', 's2', 's3'],
  )
})

test('selection returns songs in library order', () => {
  const definition = { match: 'all', rules: [{ field: 'album', op: 'contains', value: 'selected ambient' }] }
  assert.deepEqual(selectSmartPlaylistSongs(songs, definition, context).map((s) => s.id), ['s2', 's3'])
})

test('unknown fields and operators do not throw or exclude', () => {
  assert.equal(evaluateRule(songs[0], { field: 'nope', op: 'contains', value: '' }, context), true)
  assert.equal(evaluateRule(songs[0], { field: 'title', op: 'unknownOp', value: 'x' }, context), true)
  assert.equal(evaluateRule(songs[0], {}, context), true)
})

test('missing context does not crash', () => {
  assert.equal(evaluateRule(songs[0], { field: 'loved', op: 'isTrue' }), false)
  assert.equal(evaluateRule(songs[0], { field: 'playCount', op: 'gte', value: 1 }), false)
})

test('descriptions read as plain language', () => {
  assert.equal(describeDefinition({ match: 'all', rules: [] }), 'Every song')
  assert.equal(
    describeDefinition({ match: 'all', rules: [
      { field: 'artist', op: 'contains', value: 'aphex' },
      { field: 'playCount', op: 'gte', value: 5 },
    ] }),
    'artist contains aphex and play count at least 5',
  )
  assert.equal(
    describeDefinition({ match: 'any', rules: [{ field: 'loved', op: 'isTrue' }] }),
    'Loved',
  )
})

test('field types are known', () => {
  assert.equal(fieldType('playCount'), 'number')
  assert.equal(fieldType('loved'), 'boolean')
  assert.equal(fieldType('artist'), 'text')
  assert.equal(fieldType('nonsense'), 'text')
})

test('a fresh definition matches everything until edited', () => {
  const def = createEmptyDefinition()
  assert.equal(selectSmartPlaylistSongs(songs, def, context).length, songs.length)
})
