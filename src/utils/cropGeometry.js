// Geometry for the square cover cropper.
//
// Kept separate from the component because the arithmetic is where cropping
// goes wrong — off-by-one edges, zoom that lets the image pull away from the
// frame, drags that escape the crop box. All of it is testable without a canvas.

/** Smallest scale at which the image still covers the square frame entirely. */
export function coverScale(imageWidth, imageHeight, frameSize) {
  if (!imageWidth || !imageHeight || !frameSize) return 1
  return Math.max(frameSize / imageWidth, frameSize / imageHeight)
}

/**
 * Clamp an offset so the scaled image never exposes a gap inside the frame.
 * Offsets are in frame pixels, measuring the image's top-left corner.
 */
export function clampOffset(offset, scaledSize, frameSize) {
  // Scaled smaller than the frame (shouldn't happen at >= coverScale, but be
  // safe): centre it rather than allowing a gap at one edge.
  if (scaledSize <= frameSize) return (frameSize - scaledSize) / 2
  const min = frameSize - scaledSize
  return Math.min(0, Math.max(min, offset))
}

/**
 * Full transform for a crop interaction.
 *
 * @returns { scale, scaledWidth, scaledHeight, offsetX, offsetY }
 */
export function computeCropTransform({
  imageWidth,
  imageHeight,
  frameSize,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
}) {
  const base = coverScale(imageWidth, imageHeight, frameSize)
  const scale = base * Math.max(1, zoom)
  const scaledWidth = imageWidth * scale
  const scaledHeight = imageHeight * scale
  return {
    scale,
    scaledWidth,
    scaledHeight,
    offsetX: clampOffset(offsetX, scaledWidth, frameSize),
    offsetY: clampOffset(offsetY, scaledHeight, frameSize),
  }
}

/**
 * Convert a frame-space transform into the source rectangle to read from the
 * original image — what canvas `drawImage` needs.
 */
export function sourceRect(transform, frameSize) {
  const { scale, offsetX, offsetY } = transform
  // Negating a zero offset yields -0, which compares unequal to 0 under Object
  // .is and reads strangely anywhere it surfaces. Normalise it away.
  const noNegativeZero = (n) => (n === 0 ? 0 : n)
  return {
    sx: noNegativeZero(-offsetX / scale),
    sy: noNegativeZero(-offsetY / scale),
    sSize: frameSize / scale,
  }
}

/** Centre the image in the frame at the current scale. */
export function centeredOffsets(scaledWidth, scaledHeight, frameSize) {
  return {
    offsetX: (frameSize - scaledWidth) / 2,
    offsetY: (frameSize - scaledHeight) / 2,
  }
}
