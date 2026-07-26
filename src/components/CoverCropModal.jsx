import React, { useEffect, useRef, useState } from 'react'

import { computeCropTransform, sourceRect } from '@/utils/cropGeometry'

const FRAME = 320
// Covers are stored as data URLs in synced state, so they need to stay small.
const OUTPUT_SIZE = 400

/**
 * Square cover cropper: drag to position, zoom to fill. Nothing is fetched —
 * the image is whatever the listener picked off their own disk.
 */
function CoverCropModal({ file, onCancel, onApply }) {
  const [image, setImage] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState(null)
  const dragRef = useRef(null)

  useEffect(() => {
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => setImage(img)
    img.onerror = () => setError("That image couldn't be read.")
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const transform = image
    ? computeCropTransform({
        imageWidth: image.naturalWidth,
        imageHeight: image.naturalHeight,
        frameSize: FRAME,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
      })
    : null

  // Re-clamp whenever zoom changes, so zooming out can't leave a gap.
  useEffect(() => {
    if (!transform) return
    if (transform.offsetX !== offset.x || transform.offsetY !== offset.y) {
      setOffset({ x: transform.offsetX, y: transform.offsetY })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, image])

  const handlePointerDown = (event) => {
    if (!transform) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: transform.offsetX, originY: transform.offsetY }
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return
    setOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    })
  }

  const endDrag = () => { dragRef.current = null }

  const apply = () => {
    if (!image || !transform) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    const { sx, sy, sSize } = sourceRect(transform, FRAME)
    ctx.drawImage(image, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    onApply(canvas.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cover-crop-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1117]/95 shadow-2xl glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 id="cover-crop-title" className="text-sm font-semibold text-white">Crop cover</h3>
          <p className="text-xs text-gray-500 mt-1">Drag to reposition, zoom to fill.</p>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          {error ? (
            <p className="text-xs text-red-300 py-10">{error}</p>
          ) : (
            <>
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="relative overflow-hidden rounded-xl border border-white/15 bg-black/40 touch-none cursor-grab active:cursor-grabbing"
                style={{ width: FRAME, height: FRAME, maxWidth: '100%' }}
              >
                {image && transform && (
                  <img
                    src={image.src}
                    alt=""
                    draggable={false}
                    className="absolute max-w-none select-none"
                    style={{
                      width: transform.scaledWidth,
                      height: transform.scaledHeight,
                      left: transform.offsetX,
                      top: transform.offsetY,
                    }}
                  />
                )}
              </div>

              <label className="w-full flex items-center gap-3">
                <span className="text-[11px] text-gray-500 shrink-0">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-white/15 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-[10px] text-xs text-gray-300 border border-white/15 hover:border-white/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!image}
            className="px-3.5 py-2 rounded-[10px] text-xs font-medium bg-white text-black hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            Use this crop
          </button>
        </div>
      </div>
    </div>
  )
}

export default CoverCropModal
