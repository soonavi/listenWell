import test from 'node:test'
import assert from 'node:assert/strict'

import {
  groupByAlbum,
  groupByArtist,
  filterGroups,
  UNKNOWN_ARTIST,
} from './grouping.js'

const songs = [
  { id: '1', title: 'One', artist: 'Boards of Canada', album: 'Geogaddi', coverUrl: null },
  { id: '2', title: 'Two', artist: 'Boards of Canada', album: 'Geogaddi', coverUrl: 'cover-a' },
  { id: '3', title: 'Three', artist: 'Aphex Twin', album: 'Drukqs', coverUrl: 'cover-b' },
  { id: '4', title: 'Four', artist: '', album: '', coverUrl: null },
]

test('albums group by album and artist together', () => {
  const albums = groupByAlbum(songs)
  assert.equal(albums.length, 2)
  const geogaddi = albums.find((a) => a.album === 'Geogaddi')
  assert.equal(geogaddi.songs.length, 2)
  assert.equal(geogaddi.artist, 'Boards of Canada')
})

test('two records sharing a title stay separate when the artist differs', () => {
  const albums = groupByAlbum([
    { id: 'a', artist: 'Artist One', album: 'Greatest Hits' },
    { id: 'b', artist: 'Artist Two', album: 'Greatest Hits' },
  ])
  assert.equal(albums.length, 2)
})

test('the first available cover represents the album', () => {
  const geogaddi = groupByAlbum(songs).find((a) => a.album === 'Geogaddi')
  assert.equal(geogaddi.coverUrl, 'cover-a')
})

test('an untagged upload is not turned into an album', () => {
  const albums = groupByAlbum(songs)
  assert.deepEqual(albums.map((a) => a.album), ['Drukqs', 'Geogaddi'])
  assert.ok(albums.every((a) => !a.songs.some((s) => s.id === '4')))
})

test('an album still keeps an untagged artist under the unknown label', () => {
  const albums = groupByAlbum([{ id: 'a', artist: '', album: 'Bootleg' }])
  assert.equal(albums[0].artist, UNKNOWN_ARTIST)
})

test('an artist counts only the albums that were named', () => {
  const artists = groupByArtist([
    { id: 'a', artist: 'Solo Act', album: '' },
    { id: 'b', artist: 'Solo Act', album: 'Real Record' },
  ])
  assert.deepEqual(artists[0].albums, ['Real Record'])
  assert.equal(artists[0].songs.length, 2, 'the untagged track still belongs to the artist')
})

test('artists group with their distinct albums listed', () => {
  const artists = groupByArtist([
    ...songs,
    { id: '5', title: 'Five', artist: 'Boards of Canada', album: 'Campfire Headphase' },
  ])
  const boc = artists.find((a) => a.artist === 'Boards of Canada')
  assert.equal(boc.songs.length, 3)
  assert.deepEqual(boc.albums, ['Geogaddi', 'Campfire Headphase'])
})

test('artist grouping is case- and accent-insensitive', () => {
  const artists = groupByArtist([
    { id: 'a', artist: 'Björk', album: 'Post' },
    { id: 'b', artist: 'bjork', album: 'Homogenic' },
  ])
  assert.equal(artists.length, 1, 'same artist, two spellings')
  assert.equal(artists[0].songs.length, 2)
})

test('artists sort alphabetically ignoring case', () => {
  const artists = groupByArtist(songs).map((a) => a.artist)
  assert.deepEqual(artists, ['Aphex Twin', 'Boards of Canada', UNKNOWN_ARTIST])
})

test('filtering matches album or artist text', () => {
  const albums = groupByAlbum(songs)
  assert.equal(filterGroups(albums, 'drukqs').length, 1)
  assert.equal(filterGroups(albums, 'boards').length, 1)
  assert.equal(filterGroups(albums, 'geogaddi').length, 1)
  assert.equal(filterGroups(albums, '').length, albums.length)
  assert.equal(filterGroups(albums, 'nothing here').length, 0)
})

test('empty library groups to nothing', () => {
  assert.deepEqual(groupByAlbum([]), [])
  assert.deepEqual(groupByArtist([]), [])
  assert.deepEqual(groupByAlbum(), [])
})
