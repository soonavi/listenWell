// Waveform peaks for the seek bar.
//
// DESIGN.md puts the waveform alongside the current track and the queue as one
// of the few things that should carry visual weight, so the scrubber shows the
// actual shape of the audio rather than a generic bar.
//
// Peaks are computed once per song and cached, because decoding audio is far
// too expensive to repeat on every render.

/** How many buckets a cached waveform holds. Enough shape without bloating state. */
export const PEAK_BUCKETS = 160

/** Peaks are stored as 0-100 integers — a tenth the JSON of raw floats. */
const PEAK_SCALE = 100

/**
 * Reduce raw PCM to `bucketCount` normalised peaks in 0..1.
 *
 * Each bucket takes the largest absolute sample it covers, so short transients
 * stay visible instead of being averaged into nothing. The result is scaled so
 * the loudest bucket reaches 1 — a quiet track still shows a readable shape.
 *
 * @param channelData - Float32Array (or any indexable of numbers)
 */
export function computePeaks(channelData, bucketCount = PEAK_BUCKETS) {
  const length = channelData?.length ?? 0
  if (length === 0 || bucketCount <= 0) return []

  const peaks = new Array(bucketCount).fill(0)
  const samplesPerBucket = length / bucketCount

  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = Math.floor(bucket * samplesPerBucket)
    const end = Math.min(length, Math.max(start + 1, Math.floor((bucket + 1) * samplesPerBucket)))
    let max = 0
    for (let i = start; i < end; i++) {
      const value = Math.abs(channelData[i])
      if (value > max) max = value
    }
    peaks[bucket] = max
  }

  const loudest = peaks.reduce((m, v) => (v > m ? v : m), 0)
  if (loudest === 0) return peaks
  return peaks.map((v) => v / loudest)
}

/** Pack 0..1 peaks into small integers for storage. */
export function encodePeaks(peaks = []) {
  return peaks.map((v) => Math.round(Math.min(1, Math.max(0, v)) * PEAK_SCALE))
}

/** Unpack stored integers back to 0..1. Tolerates anything malformed. */
export function decodePeaks(stored) {
  if (!Array.isArray(stored)) return []
  return stored
    .map((v) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v) / PEAK_SCALE)) : 0))
}

/**
 * Decode an audio file and reduce it to storable peaks.
 * Returns null when the browser can't decode the file, so callers fall back to
 * a plain scrubber rather than breaking.
 */
export async function extractPeaksFromFile(file, bucketCount = PEAK_BUCKETS) {
  try {
    const AudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext
    if (!AudioContextClass) return null
    const buffer = await file.arrayBuffer()
    // A 1-channel context at a low rate is enough: we only need amplitude
    // shape, not fidelity, and it decodes considerably faster.
    const context = new AudioContextClass(1, 1, 22050)
    const audio = await context.decodeAudioData(buffer)
    return encodePeaks(computePeaks(audio.getChannelData(0), bucketCount))
  } catch {
    return null
  }
}

/** Fraction 0..1 of the way across an element, from a pointer event. */
export function positionFromPointer(clientX, rect) {
  if (!rect || !rect.width) return 0
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}
