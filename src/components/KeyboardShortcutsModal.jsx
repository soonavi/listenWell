import React, { useEffect, useRef, useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import { Keyboard } from 'lucide-react'

const SHORTCUTS = [
  { key: 'Ctrl K', desc: 'Command palette' },
  { key: 'Space', desc: 'Play / Pause' },
  { key: '←', desc: 'Previous track' },
  { key: '→', desc: 'Next track' },
  { key: 'Shift ←', desc: 'Back 10 seconds' },
  { key: 'Shift →', desc: 'Forward 10 seconds' },
  { key: '↑', desc: 'Volume up' },
  { key: '↓', desc: 'Volume down' },
  { key: 'M', desc: 'Mute / unmute' },
  { key: 'S', desc: 'Toggle shuffle' },
  { key: 'R', desc: 'Cycle repeat' },
  { key: 'F', desc: 'Love current track' },
  { key: '/', desc: 'Focus search (Songs page)' },
  { key: '?', desc: 'Show / hide shortcuts' },
  { key: 'Esc', desc: 'Close panels' },
]

function KeyboardShortcutsModal({ onClose }) {
  const [pos, setPos] = useState(null) // null = centered; {x,y} = dragged
  const [dragging, setDragging] = useState(false)
  const panelRef = useRef(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  const startDrag = (e) => {
    if (!panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - 416, e.clientX - dragOffset.current.x)),
        y: Math.max(8, Math.min(window.innerHeight - 300, e.clientY - dragOffset.current.y)),
      })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  const posStyle = pos
    ? { left: pos.x, top: pos.y, transform: 'none' }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <>
      <motion.button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="Close shortcuts"
      />
      <motion.div
        ref={panelRef}
        style={posStyle}
        initial={{ opacity: 0, y: pos ? 0 : 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed z-50 w-[min(92vw,400px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 shadow-2xl glass-card overflow-hidden"
      >
        {/* Drag handle header */}
        <div
          onMouseDown={startDrag}
          className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Keyboard shortcuts</h3>
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-300">{desc}</span>
              <kbd className="px-2.5 py-1 rounded-lg border border-white/15 bg-white/[0.06] text-xs text-gray-300 font-mono shrink-0 leading-tight">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </motion.div>
    </>
  )
}

export default KeyboardShortcutsModal
