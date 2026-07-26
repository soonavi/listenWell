// Keeping audio on the device.
//
// Until now "offline" meant the shell loaded and nothing played, because the
// service worker only cached the app itself. This stores the actual audio in a
// dedicated Cache Storage bucket, keyed by track id rather than by signed URL —
// signed URLs rotate every seven days, and a cache keyed on them would miss
// every entry the moment they did.
//
// Opt-in per song. Nothing is downloaded behind the listener's back.

export const OFFLINE_CACHE = 'listenwell-audio-v1'

/** Stable per-track key, independent of the rotating signed URL. */
export function offlineKeyFor(songId) {
  return `/__offline_audio__/${songId}`
}

function cachesAvailable() {
  return typeof caches !== 'undefined' && typeof caches.open === 'function'
}

/** Ids of every track currently held offline. */
export async function listOfflineSongIds() {
  if (!cachesAvailable()) return []
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    const requests = await cache.keys()
    return requests
      .map((request) => {
        const match = new URL(request.url).pathname.match(/\/__offline_audio__\/(.+)$/)
        return match ? decodeURIComponent(match[1]) : null
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export async function isSongOffline(songId) {
  if (!cachesAvailable() || !songId) return false
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    return Boolean(await cache.match(offlineKeyFor(songId)))
  } catch {
    return false
  }
}

/**
 * Download a track and keep it. Returns { ok, bytes } or { ok: false, error }.
 * The response is stored under the stable key so it survives URL rotation.
 */
export async function saveSongOffline(songId, url) {
  if (!cachesAvailable()) return { ok: false, error: 'Offline storage is unavailable in this browser.' }
  if (!songId || !url) return { ok: false, error: 'Nothing to download.' }
  try {
    const response = await fetch(url)
    if (!response.ok) return { ok: false, error: `Download failed (${response.status}).` }
    const blob = await response.blob()
    const cache = await caches.open(OFFLINE_CACHE)
    await cache.put(
      offlineKeyFor(songId),
      new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/mpeg' } }),
    )
    return { ok: true, bytes: blob.size }
  } catch (err) {
    // Quota is the common failure and deserves a clearer message than the raw
    // DOMException name.
    const quota = err?.name === 'QuotaExceededError'
    return { ok: false, error: quota ? 'Not enough space left on this device.' : (err?.message || 'Download failed.') }
  }
}

export async function removeSongOffline(songId) {
  if (!cachesAvailable() || !songId) return false
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    return await cache.delete(offlineKeyFor(songId))
  } catch {
    return false
  }
}

/** An object URL for the cached copy, or null when it isn't held. */
export async function offlineObjectUrl(songId) {
  if (!cachesAvailable() || !songId) return null
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    const response = await cache.match(offlineKeyFor(songId))
    if (!response) return null
    return URL.createObjectURL(await response.blob())
  } catch {
    return null
  }
}

/** Total bytes held offline. Walks the cache, so call it sparingly. */
export async function offlineUsageBytes() {
  if (!cachesAvailable()) return 0
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    const requests = await cache.keys()
    let total = 0
    for (const request of requests) {
      const response = await cache.match(request)
      if (!response) continue
      total += (await response.blob()).size
    }
    return total
  } catch {
    return 0
  }
}

/** What the browser will let us keep, when it's willing to say. */
export async function storageEstimate() {
  try {
    if (!navigator.storage?.estimate) return null
    const { usage, quota } = await navigator.storage.estimate()
    return { usage: usage ?? 0, quota: quota ?? 0 }
  } catch {
    return null
  }
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value <= 0) return '0 MB'
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  const megabytes = value / (1024 * 1024)
  if (megabytes < 1024) return `${megabytes.toFixed(megabytes < 10 ? 1 : 0)} MB`
  return `${(megabytes / 1024).toFixed(1)} GB`
}
