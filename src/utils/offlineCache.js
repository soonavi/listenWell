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

/**
 * Cover art for a device-only song. Server-hosted tracks keep their artwork in
 * storage next to the audio; a local song has nowhere else to put it, and the
 * embedded picture is far too big for localStorage.
 */
export function offlineCoverKeyFor(songId) {
  return `/__offline_cover__/${songId}`
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

/**
 * Store bytes we already hold, rather than fetching them back down.
 *
 * This is the write path for a device-only upload: the picked file goes
 * straight into the cache and never touches the network.
 */
export async function saveFileOffline(songId, file) {
  if (!cachesAvailable()) return { ok: false, error: 'Offline storage is unavailable in this browser.' }
  if (!songId || !file) return { ok: false, error: 'Nothing to store.' }
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    await cache.put(
      offlineKeyFor(songId),
      new Response(file, { headers: { 'Content-Type': file.type || 'audio/mpeg' } }),
    )
    return { ok: true, bytes: file.size ?? 0 }
  } catch (err) {
    const quota = err?.name === 'QuotaExceededError'
    return { ok: false, error: quota ? 'Not enough space left on this device.' : (err?.message || 'Could not save to this device.') }
  }
}

/** Keep a local song's artwork alongside its audio. Failure is not fatal. */
export async function saveCoverOffline(songId, blob) {
  if (!cachesAvailable() || !songId || !blob) return false
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    await cache.put(
      offlineCoverKeyFor(songId),
      new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } }),
    )
    return true
  } catch {
    return false
  }
}

export async function offlineCoverObjectUrl(songId) {
  if (!cachesAvailable() || !songId) return null
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    const response = await cache.match(offlineCoverKeyFor(songId))
    if (!response) return null
    return URL.createObjectURL(await response.blob())
  } catch {
    return null
  }
}

/** The cached bytes themselves — used when downloading a device-only song. */
export async function offlineSongBlob(songId) {
  if (!cachesAvailable() || !songId) return null
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    const response = await cache.match(offlineKeyFor(songId))
    return response ? await response.blob() : null
  } catch {
    return null
  }
}

export async function removeSongOffline(songId) {
  if (!cachesAvailable() || !songId) return false
  try {
    const cache = await caches.open(OFFLINE_CACHE)
    // The cover is part of the same copy; leaving it behind would strand bytes
    // that nothing can reach.
    const [removed] = await Promise.all([
      cache.delete(offlineKeyFor(songId)),
      cache.delete(offlineCoverKeyFor(songId)),
    ])
    return removed
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
