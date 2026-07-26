// The listening log.
//
// A record of what you played, for you. Not a year-in-review, not a shareable
// card, not a nudge to listen more. It answers "what have I actually been
// playing?" and then stops. Everything here is derived from counts already
// stored in the account; nothing new is tracked to make it work.

/** Total plays across the library. */
export function totalPlays(playCounts = {}) {
  return Object.values(playCounts).reduce((sum, n) => sum + (Number(n) || 0), 0)
}

/**
 * Rough listening time, in seconds. Play counts don't record partial listens,
 * so this is plays × duration and therefore an upper bound — labelled as
 * approximate wherever it's shown rather than dressed up as exact.
 */
export function estimatedSeconds(songs = [], playCounts = {}) {
  return songs.reduce((sum, song) => {
    const count = Number(playCounts[song.id]) || 0
    const duration = Number(song.duration) || 0
    return sum + count * duration
  }, 0)
}

/** "3h 24m", "12m", "—" when there's nothing yet. */
export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0))
  if (seconds === 0) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return '<1m'
}

/** Most-played tracks, highest first. Never-played tracks are excluded. */
export function topTracks(songs = [], playCounts = {}, limit = 10) {
  return songs
    .map((song) => ({ song, count: Number(playCounts[song.id]) || 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || titleOf(a.song).localeCompare(titleOf(b.song)))
    .slice(0, limit)
}

/** Plays summed per artist, highest first. */
export function topArtists(songs = [], playCounts = {}, limit = 10) {
  const totals = new Map()
  for (const song of songs) {
    const count = Number(playCounts[song.id]) || 0
    if (count === 0) continue
    const artist = (song.artist || '').trim() || 'Unknown artist'
    const entry = totals.get(artist) || { artist, count: 0, tracks: 0 }
    entry.count += count
    entry.tracks += 1
    totals.set(artist, entry)
  }
  return [...totals.values()]
    .sort((a, b) => b.count - a.count || a.artist.localeCompare(b.artist))
    .slice(0, limit)
}

/** How much of the library has ever been played. */
export function libraryCoverage(songs = [], playCounts = {}) {
  const total = songs.length
  if (total === 0) return { played: 0, total: 0, percent: 0 }
  const played = songs.filter((s) => (Number(playCounts[s.id]) || 0) > 0).length
  return { played, total, percent: Math.round((played / total) * 100) }
}

/**
 * Tracks that have never been played, oldest in the library first — the part of
 * a collection that tends to get forgotten.
 */
export function neverPlayed(songs = [], playCounts = {}, limit = 10) {
  return songs.filter((s) => (Number(playCounts[s.id]) || 0) === 0).slice(0, limit)
}

function titleOf(song) {
  return song.title || song.fileName || ''
}

/** Everything the log screen needs, in one pass. */
export function buildListeningLog(songs = [], playCounts = {}, limit = 10) {
  return {
    totalPlays: totalPlays(playCounts),
    estimatedSeconds: estimatedSeconds(songs, playCounts),
    topTracks: topTracks(songs, playCounts, limit),
    topArtists: topArtists(songs, playCounts, limit),
    coverage: libraryCoverage(songs, playCounts),
    neverPlayed: neverPlayed(songs, playCounts, limit),
  }
}
