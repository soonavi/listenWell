// Songs that were never uploaded.
//
// When a listener chooses "keep this on my device", the audio goes into the
// offline Cache Storage bucket and nothing about the track is sent to Supabase
// — not the file, not the title. That means the record has to live here, in
// localStorage, because the `tracks` table (which is what the library loader
// reads on login) will never know about it.
//
// The consequence is deliberate and worth stating plainly: a local song exists
// on exactly one device. It does not follow the account, and clearing site data
// takes it with it.

const STORAGE_KEY = 'listenwell-local-songs'

// Parsed once and kept current by the writers below, so `isLocalSong` — which
// runs on every metadata write — doesn't re-parse the whole list each time.
let cache = null

function storage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    // Safari throws on any localStorage access in some private-mode configs.
    return null
  }
}

/** Every local-only song known to this device. Never returns null. */
export function readLocalSongs() {
  if (cache) return cache
  const store = storage()
  if (!store) return (cache = [])
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) || '[]')
    cache = Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.id === 'string') : []
  } catch {
    cache = []
  }
  return cache
}

function write(next) {
  cache = next
  const store = storage()
  if (!store) return
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Out of quota. The in-memory cache still holds the song for this session,
    // which is better than dropping it on the floor mid-upload.
  }
}

/** Add a record, replacing any existing one with the same id. */
export function addLocalSong(record) {
  if (!record?.id) return readLocalSongs()
  const next = [...readLocalSongs().filter((s) => s.id !== record.id), { ...record, local: true }]
  write(next)
  return next
}

/** Merge a patch into one record. A no-op for ids that aren't local. */
export function updateLocalSong(id, patch) {
  if (!id || !patch) return readLocalSongs()
  const current = readLocalSongs()
  if (!current.some((s) => s.id === id)) return current
  const next = current.map((s) => (s.id === id ? { ...s, ...patch } : s))
  write(next)
  return next
}

export function removeLocalSong(id) {
  const current = readLocalSongs()
  const next = current.filter((s) => s.id !== id)
  if (next.length !== current.length) write(next)
  return next
}

export function isLocalSong(id) {
  if (!id) return false
  return readLocalSongs().some((s) => s.id === id)
}

/** Drop the parsed copy. Tests use this; the app has no reason to. */
export function resetLocalSongCache() {
  cache = null
}
