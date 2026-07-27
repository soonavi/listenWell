import test from 'node:test'
import assert from 'node:assert/strict'

import {
  readLocalSongs,
  addLocalSong,
  updateLocalSong,
  removeLocalSong,
  isLocalSong,
  resetLocalSongCache,
} from './localLibrary.js'

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value) },
    removeItem: (key) => { delete data[key] },
  }
}

function withStorage(store) {
  globalThis.localStorage = store
  resetLocalSongCache()
}

test.beforeEach(() => withStorage(fakeStorage()))

test('an empty device has no local songs', () => {
  assert.deepEqual(readLocalSongs(), [])
  assert.equal(isLocalSong('anything'), false)
})

test('added songs are readable and flagged local', () => {
  addLocalSong({ id: 'a', title: 'Alpha' })
  const songs = readLocalSongs()
  assert.equal(songs.length, 1)
  assert.equal(songs[0].title, 'Alpha')
  assert.equal(songs[0].local, true)
  assert.ok(isLocalSong('a'))
})

test('adding the same id twice replaces rather than duplicates', () => {
  addLocalSong({ id: 'a', title: 'First' })
  addLocalSong({ id: 'a', title: 'Second' })
  const songs = readLocalSongs()
  assert.equal(songs.length, 1)
  assert.equal(songs[0].title, 'Second')
})

test('records survive a reload', () => {
  const store = fakeStorage()
  withStorage(store)
  addLocalSong({ id: 'a', title: 'Alpha', peaks: [1, 2] })

  // A fresh page: same storage, no in-memory cache.
  withStorage(store)
  assert.deepEqual(readLocalSongs()[0].peaks, [1, 2])
})

test('updates merge into the existing record', () => {
  addLocalSong({ id: 'a', title: 'Alpha', gainDb: 0 })
  updateLocalSong('a', { gainDb: -3.5, bpm: 128 })
  const song = readLocalSongs()[0]
  assert.equal(song.title, 'Alpha', 'untouched fields survive')
  assert.equal(song.gainDb, -3.5)
  assert.equal(song.bpm, 128)
})

test('updating an unknown id changes nothing', () => {
  addLocalSong({ id: 'a', title: 'Alpha' })
  updateLocalSong('server-song', { title: 'Nope' })
  assert.equal(readLocalSongs().length, 1)
  assert.equal(readLocalSongs()[0].title, 'Alpha')
})

test('removal takes the record out and clears the local flag', () => {
  addLocalSong({ id: 'a' })
  addLocalSong({ id: 'b' })
  removeLocalSong('a')
  assert.deepEqual(readLocalSongs().map((s) => s.id), ['b'])
  assert.equal(isLocalSong('a'), false)
})

test('corrupt storage reads as empty rather than throwing', () => {
  withStorage(fakeStorage({ 'listenwell-local-songs': '{not json' }))
  assert.deepEqual(readLocalSongs(), [])
})

test('non-array and malformed entries are discarded', () => {
  withStorage(fakeStorage({ 'listenwell-local-songs': '{"id":"a"}' }))
  assert.deepEqual(readLocalSongs(), [])

  withStorage(fakeStorage({ 'listenwell-local-songs': '[null,{"title":"no id"},{"id":"ok"}]' }))
  assert.deepEqual(readLocalSongs().map((s) => s.id), ['ok'])
})

test('a device with no storage at all still works in memory', () => {
  globalThis.localStorage = undefined
  resetLocalSongCache()
  addLocalSong({ id: 'a', title: 'Alpha' })
  assert.ok(isLocalSong('a'), 'the song is usable for this session')
})

test('a storage that throws on write does not lose the song mid-upload', () => {
  withStorage({
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError') },
  })
  addLocalSong({ id: 'a', title: 'Alpha' })
  assert.ok(isLocalSong('a'))
})
