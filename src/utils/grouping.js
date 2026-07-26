// Grouping the library by album and by artist.
//
// Purely derived from the tags on the files. Nothing is inferred, merged by
// similarity, or looked up externally — if two albums are spelled differently
// they are two albums, because that is what the files say. The listener fixes
// that by editing the tags, not by the app guessing.

import { normalizeForMatch } from './duplicates.js'

export const UNKNOWN_ARTIST = 'Unknown artist'
export const UNKNOWN_ALBUM = 'Unknown album'

/**
 * Group songs into albums, keyed by album + album artist so that two different
 * records sharing a title ("Greatest Hits") stay separate.
 *
 * @returns [{ key, album, artist, songs, coverUrl, year }] sorted by artist then album
 */
export function groupByAlbum(songs = []) {
  const groups = new Map()

  for (const song of songs) {
    const album = (song.album || '').trim() || UNKNOWN_ALBUM
    const artist = (song.artist || '').trim() || UNKNOWN_ARTIST
    const key = `${normalizeForMatch(album)}|${normalizeForMatch(artist)}`

    let group = groups.get(key)
    if (!group) {
      group = { key, album, artist, songs: [], coverUrl: null }
      groups.set(key, group)
    }
    group.songs.push(song)
    // First cover encountered stands in for the record.
    if (!group.coverUrl && song.coverUrl) group.coverUrl = song.coverUrl
  }

  return [...groups.values()].sort(compareByArtistThenAlbum)
}

/**
 * Group songs by artist.
 *
 * @returns [{ key, artist, songs, albums, coverUrl }] sorted by artist
 */
export function groupByArtist(songs = []) {
  const groups = new Map()

  for (const song of songs) {
    const artist = (song.artist || '').trim() || UNKNOWN_ARTIST
    const key = normalizeForMatch(artist) || UNKNOWN_ARTIST.toLowerCase()

    let group = groups.get(key)
    if (!group) {
      group = { key, artist, songs: [], albums: [], coverUrl: null }
      groups.set(key, group)
    }
    group.songs.push(song)
    if (!group.coverUrl && song.coverUrl) group.coverUrl = song.coverUrl

    const album = (song.album || '').trim() || UNKNOWN_ALBUM
    if (!group.albums.includes(album)) group.albums.push(album)
  }

  return [...groups.values()].sort((a, b) => collate(a.artist, b.artist))
}

/** Unknowns sort last; everything else alphabetically, case-insensitively. */
function collate(a, b) {
  const aUnknown = a === UNKNOWN_ARTIST || a === UNKNOWN_ALBUM
  const bUnknown = b === UNKNOWN_ARTIST || b === UNKNOWN_ALBUM
  if (aUnknown !== bUnknown) return aUnknown ? 1 : -1
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

function compareByArtistThenAlbum(a, b) {
  const byArtist = collate(a.artist, b.artist)
  return byArtist !== 0 ? byArtist : collate(a.album, b.album)
}

/** Filter groups by a free-text query against the group's own labels. */
export function filterGroups(groups = [], query = '') {
  const needle = normalizeForMatch(query)
  if (!needle) return groups
  return groups.filter((g) => (
    normalizeForMatch(g.album || '').includes(needle) ||
    normalizeForMatch(g.artist || '').includes(needle)
  ))
}
