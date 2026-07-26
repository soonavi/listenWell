import test from 'node:test'
import assert from 'node:assert/strict'

import {
  coverScale,
  clampOffset,
  computeCropTransform,
  sourceRect,
  centeredOffsets,
} from './cropGeometry.js'

test('cover scale fills the frame from the limiting dimension', () => {
  // Wide image: height is the constraint.
  assert.equal(coverScale(800, 400, 400), 1)
  // Tall image: width is the constraint.
  assert.equal(coverScale(400, 800, 400), 1)
  // Small image must scale up.
  assert.equal(coverScale(200, 200, 400), 2)
})

test('cover scale is safe with missing dimensions', () => {
  assert.equal(coverScale(0, 100, 400), 1)
  assert.equal(coverScale(100, 100, 0), 1)
})

test('offsets cannot expose a gap at either edge', () => {
  // 600px image in a 400px frame: valid offsets run from -200 to 0.
  assert.equal(clampOffset(50, 600, 400), 0, 'cannot pull right past the left edge')
  assert.equal(clampOffset(-500, 600, 400), -200, 'cannot pull left past the right edge')
  assert.equal(clampOffset(-100, 600, 400), -100, 'valid offset passes through')
})

test('an image smaller than the frame is centred rather than gapped', () => {
  assert.equal(clampOffset(0, 300, 400), 50)
  assert.equal(clampOffset(-999, 300, 400), 50)
})

test('the transform clamps offsets after applying zoom', () => {
  const t = computeCropTransform({
    imageWidth: 800, imageHeight: 400, frameSize: 400, zoom: 1, offsetX: 999, offsetY: 999,
  })
  assert.equal(t.scaledWidth, 800)
  assert.equal(t.scaledHeight, 400)
  assert.equal(t.offsetX, 0)
  assert.equal(t.offsetY, 0)
})

test('zoom below 1 is ignored so the frame stays covered', () => {
  const t = computeCropTransform({ imageWidth: 400, imageHeight: 400, frameSize: 400, zoom: 0.2 })
  assert.equal(t.scale, 1)
  assert.equal(t.scaledWidth, 400)
})

test('zooming in enlarges and widens the pannable range', () => {
  const t = computeCropTransform({
    imageWidth: 400, imageHeight: 400, frameSize: 400, zoom: 2, offsetX: -999, offsetY: 0,
  })
  assert.equal(t.scaledWidth, 800)
  assert.equal(t.offsetX, -400, 'clamped to the far edge, not to zero')
})

test('the source rectangle maps back onto the original image', () => {
  const t = computeCropTransform({
    imageWidth: 800, imageHeight: 400, frameSize: 400, zoom: 1, offsetX: -200, offsetY: 0,
  })
  const { sx, sy, sSize } = sourceRect(t, 400)
  assert.equal(sx, 200, 'reads 200px in from the left of the source')
  assert.equal(sy, 0)
  assert.equal(sSize, 400, 'a square the size of the frame at scale 1')
})

test('source rectangle accounts for zoom', () => {
  const t = computeCropTransform({ imageWidth: 400, imageHeight: 400, frameSize: 400, zoom: 2 })
  const { sSize } = sourceRect(t, 400)
  assert.equal(sSize, 200, 'zoomed 2x reads half as much of the source')
})

test('an untouched crop of a square image reads the whole thing', () => {
  const t = computeCropTransform({ imageWidth: 500, imageHeight: 500, frameSize: 400 })
  const { sx, sy, sSize } = sourceRect(t, 400)
  assert.equal(sx, 0)
  assert.equal(sy, 0)
  assert.equal(sSize, 500)
})

test('centring puts equal margins on both sides', () => {
  assert.deepEqual(centeredOffsets(600, 400, 400), { offsetX: -100, offsetY: 0 })
})
