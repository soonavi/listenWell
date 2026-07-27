import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computePeaks,
  encodePeaks,
  decodePeaks,
  positionFromPointer,
  resamplePeaks,
  PEAK_BUCKETS,
} from './waveform.js'

test('peaks reduce samples to the requested bucket count', () => {
  const data = new Float32Array(1000).fill(0.5)
  assert.equal(computePeaks(data, 10).length, 10)
  assert.equal(computePeaks(data).length, PEAK_BUCKETS)
})

test('the loudest bucket normalises to 1', () => {
  const data = new Float32Array([0.1, 0.1, 0.2, 0.2])
  const peaks = computePeaks(data, 2)
  assert.deepEqual(peaks, [0.5, 1])
})

test('each bucket keeps its transient rather than averaging it away', () => {
  // A single loud sample in an otherwise silent second half.
  const data = new Float32Array([0, 0, 0, 0, 0, 0, 0, 1])
  const peaks = computePeaks(data, 2)
  assert.equal(peaks[0], 0)
  assert.equal(peaks[1], 1, 'the spike survives')
})

test('negative samples count by magnitude', () => {
  const peaks = computePeaks(new Float32Array([-0.8, 0.2]), 2)
  assert.deepEqual(peaks, [1, 0.25])
})

test('digital silence yields flat zeroes, not NaN', () => {
  const peaks = computePeaks(new Float32Array(100), 8)
  assert.equal(peaks.length, 8)
  assert.ok(peaks.every((v) => v === 0))
})

test('empty or nonsense input is safe', () => {
  assert.deepEqual(computePeaks(new Float32Array(0), 8), [])
  assert.deepEqual(computePeaks(null, 8), [])
  assert.deepEqual(computePeaks(new Float32Array(10), 0), [])
})

test('more buckets than samples still produces the requested length', () => {
  const peaks = computePeaks(new Float32Array([1, 0.5]), 8)
  assert.equal(peaks.length, 8)
  assert.ok(peaks.every((v) => Number.isFinite(v)))
})

test('encode and decode round trip within quantisation error', () => {
  const original = [0, 0.25, 0.5, 1]
  const restored = decodePeaks(encodePeaks(original))
  original.forEach((v, i) => assert.ok(Math.abs(restored[i] - v) < 0.01))
})

test('encoding clamps out-of-range values', () => {
  assert.deepEqual(encodePeaks([-1, 2]), [0, 100])
})

test('decoding tolerates junk', () => {
  assert.deepEqual(decodePeaks(null), [])
  assert.deepEqual(decodePeaks('nope'), [])
  assert.deepEqual(decodePeaks([50, 'x', null]), [0.5, 0, 0])
})

test('resampling returns exactly the requested bar count', () => {
  const peaks = new Array(160).fill(0.5)
  assert.equal(resamplePeaks(peaks, 93).length, 93)
  assert.equal(resamplePeaks(peaks, 1).length, 1)
})

test('resampling keeps the loudest value in each group', () => {
  // Four bars down to two: each pair collapses to its maximum.
  assert.deepEqual(resamplePeaks([0.1, 0.9, 0.2, 0.3], 2), [0.9, 0.3])
})

test('asking for more bars than exist returns a copy, not the original', () => {
  const peaks = [0.1, 0.2]
  const out = resamplePeaks(peaks, 10)
  assert.deepEqual(out, peaks)
  assert.notEqual(out, peaks, 'callers must not be able to mutate the stored array')
})

test('resampling tolerates junk input', () => {
  assert.deepEqual(resamplePeaks(null, 8), [])
  assert.deepEqual(resamplePeaks([], 8), [])
  assert.deepEqual(resamplePeaks([0.5], 0), [])
  assert.deepEqual(resamplePeaks([0.5, 'x', null, 0.25], 2), [0.5, 0.25])
})

test('resampling a decoded waveform never exceeds the bar count it is given', () => {
  // The scrubber picks its bar count from the measured width; going over would
  // overflow the box and desync the click position from the bars.
  const decoded = decodePeaks(new Array(PEAK_BUCKETS).fill(70))
  for (const count of [8, 40, 93, 200]) {
    assert.ok(resamplePeaks(decoded, count).length <= Math.max(count, decoded.length))
    assert.equal(resamplePeaks(decoded, count).length, Math.min(count, decoded.length))
  }
})

test('pointer position maps to a 0..1 fraction and clamps', () => {
  const rect = { left: 100, width: 200 }
  assert.equal(positionFromPointer(100, rect), 0)
  assert.equal(positionFromPointer(200, rect), 0.5)
  assert.equal(positionFromPointer(300, rect), 1)
  assert.equal(positionFromPointer(50, rect), 0, 'clamped below')
  assert.equal(positionFromPointer(999, rect), 1, 'clamped above')
  assert.equal(positionFromPointer(150, { left: 0, width: 0 }), 0, 'zero-width is safe')
})
