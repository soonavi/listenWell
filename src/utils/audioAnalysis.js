// Audio analysis: RMS normalisation gain + BPM detection
// Runs entirely in-browser using OfflineAudioContext.

// Normalisation target. RMS on modern masters sits around -12 to -10 dBFS, so
// the old -18 target handed back roughly -7 dB of gain for ordinary music and
// made every normalised track audibly quieter than the source file. -14 is in
// line with what streaming services target and keeps the correction small.
const TARGET_DB = -14

export async function analyzeAudio(file) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return { gainDb: 0, bpm: null }

    // Decode only the first 90 s to keep memory/time reasonable
    const maxBytes = Math.min(file.size, 12 * 1024 * 1024) // ~12 MB
    const slice = file.slice(0, maxBytes)
    const buffer = await slice.arrayBuffer()

    const tempCtx = new Ctx()
    let audioBuffer
    try {
      audioBuffer = await tempCtx.decodeAudioData(buffer)
    } catch {
      await tempCtx.close()
      return { gainDb: 0, bpm: null }
    }
    await tempCtx.close()

    const { sampleRate } = audioBuffer
    const maxSamples = Math.min(audioBuffer.length, sampleRate * 90)
    // Mix all channels down to mono for analysis
    const mono = new Float32Array(maxSamples)
    const numCh = audioBuffer.numberOfChannels
    for (let ch = 0; ch < numCh; ch++) {
      const ch_data = audioBuffer.getChannelData(ch)
      for (let i = 0; i < maxSamples; i++) mono[i] += ch_data[i] / numCh
    }

    // RMS → normalisation gain
    let sumSq = 0
    for (let i = 0; i < maxSamples; i++) sumSq += mono[i] * mono[i]
    const rms = Math.sqrt(sumSq / maxSamples)
    const rmsDb = 20 * Math.log10(Math.max(rms, 1e-10))
    const gainDb = Math.max(-24, Math.min(24, TARGET_DB - rmsDb))

    // BPM detection
    const bpm = detectBPM(mono, sampleRate, maxSamples)

    return { gainDb, bpm }
  } catch {
    return { gainDb: 0, bpm: null }
  }
}

function detectBPM(samples, sampleRate, length) {
  try {
    // Build an energy envelope: one value per ~23ms window
    const windowSize = Math.floor(sampleRate / 43)
    const numWindows = Math.floor(length / windowSize)
    if (numWindows < 40) return null

    const energy = new Float32Array(numWindows)
    for (let i = 0; i < numWindows; i++) {
      const start = i * windowSize
      let sq = 0
      for (let j = start; j < start + windowSize && j < length; j++) sq += samples[j] * samples[j]
      energy[i] = Math.sqrt(sq / windowSize)
    }

    // Adaptive threshold: local mean × factor
    const lookback = 43 // ~1 second
    const beats = []
    for (let i = lookback; i < numWindows - lookback; i++) {
      let sum = 0
      for (let j = i - lookback; j < i + lookback; j++) sum += energy[j]
      const avg = sum / (lookback * 2)
      if (energy[i] <= avg * 1.4) continue
      // Must be local max in ±2 windows
      let isMax = true
      for (let j = Math.max(0, i - 2); j <= Math.min(numWindows - 1, i + 2); j++) {
        if (j !== i && energy[j] >= energy[i]) { isMax = false; break }
      }
      if (isMax) beats.push(i)
    }

    if (beats.length < 6) return null

    // Histogram of inter-beat intervals → BPM
    const histogram = new Map()
    for (let i = 1; i < beats.length; i++) {
      const interval = beats[i] - beats[i - 1] // windows between beats
      const bpmRaw = Math.round(60 / (interval / 43))
      // Vote for this BPM and harmonics
      for (const candidate of [bpmRaw, Math.round(bpmRaw / 2), bpmRaw * 2]) {
        if (candidate >= 60 && candidate <= 200) {
          const w = candidate === bpmRaw ? 1 : 0.4
          histogram.set(candidate, (histogram.get(candidate) || 0) + w)
        }
      }
    }

    if (!histogram.size) return null
    let best = null, bestW = 0
    for (const [b, w] of histogram) { if (w > bestW) { bestW = w; best = b } }
    return best
  } catch {
    return null
  }
}
