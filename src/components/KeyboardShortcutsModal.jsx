import React from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import { Keyboard } from 'lucide-react'

const SHORTCUTS = [
  { key: 'Space', desc: 'Play / Pause' },
  { key: '←', desc: 'Previous track' },
  { key: '→', desc: 'Next track' },
  { key: '/', desc: 'Focus search (Songs page)' },
  { key: '?', desc: 'Show / hide shortcuts' },
  { key: 'Esc', desc: 'Clear search / close panels' },
]

function KeyboardShortcutsModal({ onClose }) {
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
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,400px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 p-5 shadow-2xl glass-card"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Keyboard shortcuts</h3>
          </div>
          <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-white transition-colors">
            Close
          </button>
        </div>
        <div className="space-y-3">
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
