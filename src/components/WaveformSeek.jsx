import React, { useCallback, useMemo, useRef, useState } from 'react'

import { decodePeaks, positionFromPointer } from '@/utils/waveform'

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

  const values = useMemo(() => {
    const decoded = decodePeaks(peaks)
    // Flat, quiet placeholder while the waveform is still being computed.
    return decoded.length > 0 ? decoded : new Array(80).fill(0.18)
  }, [peaks])

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
      className={`relative flex items-end gap-[2px] select-none touch-none focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400/60 rounded ${disabled ? '' : 'cursor-pointer'} ${className}`}
      style={{ height }}
    >
      {values.map((value, index) => {
        const played = (index + 0.5) / values.length <= playedFraction
        return (
          <span
            key={index}
            aria-hidden
            className={`flex-1 min-w-[1px] rounded-full transition-colors ${played ? 'bg-violet-400' : 'bg-white/20'}`}
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
