// Duplicate detection for uploads.
//
// Two songs count as the same in one of two ways:
//   1. identical bytes — the same file added twice, whatever it was renamed to
//   2. the same title + artist — a re-rip or a different encode of one track
//
// (1) is certain, so it is reported as such. (2) is a strong hint but a
// legitimate re-upload at a better bitrate looks identical by metadata, so the
// listener decides what happens rather than the app silently dropping files.

/** Fold a tag value down to something two spellings of the same thing share. */
export function normalizeForMatch(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    // strip combining marks so "Bjork" matches "Björk"
    .replace(/[\u0300-\u036f]/g, '')
    // drop bracketed noise: "(Remastered 2011)", "[Explicit]"
    .replace(/[([{][^)\]}]*[)\]}]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Stable key for title+artist matching. Empty when there's nothing to match on. */
export function metadataKey({ title, artist } = {}) {
  const t = normalizeForMatch(title)
  const a = normalizeForMatch(artist)
  if (!t) return ''
  return `${t} ${a}`
}

/**
 * SHA-256 of a file's bytes, hex encoded.
 * Uses Web Crypto, available in the browser and in Node >= 20.
 */
export async function hashAudioFile(file) {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Compare incoming uploads against the existing library.
 *
 * @param candidates - [{ id, title, artist, fileName, contentHash }]
 * @param existing   - the library, same shape
 * @returns [{ candidate, match, reason: 'content' | 'metadata' }]
 *
 * Candidates are also compared against each other, so selecting the same track
 * twice in one file picker is caught before either copy is uploaded.
 */
export function findDuplicates(candidates = [], existing = []) {
  const byHash = new Map()
  const byMeta = new Map()

  for (const song of existing) {
    if (song?.contentHash) byHash.set(song.contentHash, song)
    const key = metadataKey(song)
    if (key && !byMeta.has(key)) byMeta.set(key, song)
  }

  const results = []
  for (const candidate of candidates) {
    const hashMatch = candidate?.contentHash ? byHash.get(candidate.contentHash) : null
    if (hashMatch) {
      results.push({ candidate, match: hashMatch, reason: 'content' })
      continue
    }

    const key = metadataKey(candidate)
    const metaMatch = key ? byMeta.get(key) : null
    if (metaMatch) {
      results.push({ candidate, match: metaMatch, reason: 'metadata' })
    }

    // Register the candidate so a second copy in the same batch matches it.
    if (candidate?.contentHash && !byHash.has(candidate.contentHash)) {
      byHash.set(candidate.contentHash, candidate)
    }
    if (key && !byMeta.has(key)) byMeta.set(key, candidate)
  }

  return results
}

/** Human-readable reason, used in the confirmation dialog. */
export function describeDuplicate(reason) {
  return reason === 'content'
    ? 'identical file already in your library'
    : 'same title and artist already in your library'
}
