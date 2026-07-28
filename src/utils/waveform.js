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

/**
 * Reduce a peak array to `count` bars, keeping the loudest value in each group.
 *
 * The stored waveform holds PEAK_BUCKETS bars, which is far more than the
 * player bar is ever wide enough to draw. Rendering all of them made the strip
 * overflow its own box to the right — it looked off-centre, and every click
 * landed ahead of where it was aimed because the pointer maths measured the box
 * rather than the bars. The scrubber now picks a bar count from its measured
 * width and resamples to it.
 */
export function resamplePeaks(peaks, count) {
  if (!Array.isArray(peaks) || peaks.length === 0 || count <= 0) return []
  if (count >= peaks.length) return peaks.slice()

  const out = new Array(count).fill(0)
  const perBar = peaks.length / count
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * perBar)
    const end = Math.min(peaks.length, Math.max(start + 1, Math.floor((i + 1) * perBar)))
    let max = 0
    for (let j = start; j < end; j++) {
      const value = Number(peaks[j])
      if (Number.isFinite(value) && value > max) max = value
    }
    out[i] = max
  }
  return out
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
  let context = null
  try {
    const AudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext
    if (!AudioContextClass) return null
    const buffer = await file.arrayBuffer()
    // A 1-channel context at a low rate is enough: we only need amplitude
    // shape, not fidelity, and it decodes considerably faster.
    context = new AudioContextClass(1, 1, 22050)
    const audio = await context.decodeAudioData(buffer)
    return encodePeaks(computePeaks(audio.getChannelData(0), bucketCount))
  } catch {
    return null
  } finally {
    // decodeAudioData holds the whole track as PCM — tens of megabytes for an
    // ordinary song — and the context keeps it alive until it is closed. The
    // sibling analyser in audioAnalysis.js has always closed its context; this
    // one never did, so every track decoded here left its buffer resident. On
    // a phone that is exactly the kind of resident memory that gets a
    // backgrounded tab reclaimed, which stops playback.
    if (typeof context?.close === 'function') {
      try { await context.close() } catch { /* already closed, or unsupported */ }
    }
  }
}

/** Fraction 0..1 of the way across an element, from a pointer event. */
export function positionFromPointer(clientX, rect) {
  if (!rect || !rect.width) return 0
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}
