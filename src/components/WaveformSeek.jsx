import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { decodePeaks, positionFromPointer, resamplePeaks } from '@/utils/waveform'

/**
 * Width of one bar plus its gap. The bar count comes from dividing the measured
 * width by this, so the strip always fits the box exactly.
 */
const BAR_PITCH = 4

/**
 * Scrubber drawn from the track's own waveform.
 *
 * Falls back to a flat bar when peaks haven't been computed for a song yet, so
 * it behaves like an ordinary progress bar in the meantime rather than
 * disappearing. Dragging previews the position and only commits on release, so
 * the audio isn't re-seeked on every pixel of movement.
 */
function WaveformSeek({
  peaks,
  currentTime = 0,
  duration = 0,
  onSeek,
  className = '',
  height = 40,
  disabled = false,
}) {
  const trackRef = useRef(null)
  const [dragFraction, setDragFraction] = useState(null)
  const [trackWidth, setTrackWidth] = useState(0)

  // Draw only as many bars as actually fit. A stored waveform holds 160 of
  // them, which needs ~480px — more than the player bar ever gets — so the
  // strip used to overflow its own box to the right. That both pushed the
  // waveform off-centre and made every click land ahead of the target, because
  // `getBoundingClientRect()` measures the box, not the overflowing bars.
  // Measured in a layout effect so the first painted frame is already correct.
  useLayoutEffect(() => {
    const element = trackRef.current
    if (!element) return
    setTrackWidth(element.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setTrackWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const barCount = Math.max(8, Math.floor(trackWidth / BAR_PITCH) || 8)

  const values = useMemo(() => {
    const decoded = decodePeaks(peaks)
    // Flat, quiet placeholder while the waveform is still being computed.
    if (decoded.length === 0) return new Array(barCount).fill(0.18)
    return resamplePeaks(decoded, Math.min(decoded.length, barCount))
  }, [peaks, barCount])

  const playedFraction = dragFraction ?? (duration > 0 ? Math.min(1, currentTime / duration) : 0)

  const fractionFromEvent = useCallback((event) => {
    const rect = trackRef.current?.getBoundingClientRect()
    return positionFromPointer(event.clientX, rect)
  }, [])

  const commit = useCallback((fraction) => {
    if (duration > 0) onSeek?.(fraction * duration)
  }, [duration, onSeek])

  const handlePointerDown = (event) => {
    if (disabled || duration <= 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragFraction(fractionFromEvent(event))
  }

  const handlePointerMove = (event) => {
    if (dragFraction === null) return
    setDragFraction(fractionFromEvent(event))
  }

  const handlePointerUp = (event) => {
    if (dragFraction === null) return
    const fraction = fractionFromEvent(event)
    setDragFraction(null)
    commit(fraction)
  }

  const handleKeyDown = (event) => {
    if (disabled || duration <= 0) return
    const step = event.shiftKey ? 30 : 5
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      event.stopPropagation()
      onSeek?.(Math.max(0, currentTime - step))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      event.stopPropagation()
      onSeek?.(Math.min(duration, currentTime + step))
    }
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      aria-disabled={disabled || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragFraction(null)}
      onKeyDown={handleKeyDown}
      // `min-w-0` lets a flex parent shrink this below the bars' intrinsic
      // width instead of being forced wider by it.
      className={`relative flex items-end gap-[2px] min-w-0 select-none touch-none focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/60 rounded ${disabled ? '' : 'cursor-pointer'} ${className}`}
      style={{ height }}
    >
      {values.map((value, index) => {
        const played = (index + 0.5) / values.length <= playedFraction
        return (
          <span
            key={index}
            aria-hidden
            className={`flex-1 min-w-0 rounded-full transition-colors ${played ? 'bg-violet-400' : 'bg-white/20'}`}
            // Floor keeps near-silent passages visible as a hairline rather
            // than a gap in the bar.
            style={{ height: `${Math.max(8, value * 100)}%` }}
          />
        )
      })}
    </div>
  )
}

export default WaveformSeek
