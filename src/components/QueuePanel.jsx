import React from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import { Music2, X } from 'lucide-react'

function QueuePanel({ songs, currentTrackIndex, onClose, onPlaySong }) {
  const nowPlaying = currentTrackIndex != null ? songs[currentTrackIndex] : null
  const upNext = currentTrackIndex != null ? songs.slice(currentTrackIndex + 1) : []

  return (
    <>
      <motion.button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="Close queue"
      />
      <motion.aside
        initial={{ x: 340, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 340, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed right-4 top-4 bottom-4 z-50 w-[300px] rounded-2xl border border-white/10 bg-[#0f1117]/92 backdrop-blur-xl flex flex-col overflow-hidden glass-card"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
          <h3 className="text-sm font-semibold text-white">Queue</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close queue"
            className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {nowPlaying && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 px-1">Now Playing</p>
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] border border-violet-500/20 px-3 py-2.5">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
                  {nowPlaying.coverUrl
                    ? <img src={nowPlaying.coverUrl} alt="" className="w-full h-full object-cover" />
                    : <Music2 className="w-4 h-4 text-violet-300" />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{nowPlaying.title || nowPlaying.fileName}</p>
                  <p className="text-xs text-gray-500 truncate">{nowPlaying.artist || 'Unknown artist'}</p>
                </div>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: 'rgb(var(--accent-rgb))' }} />
              </div>
            </div>
          )}

          {upNext.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 px-1">Up Next</p>
              <div className="space-y-0.5">
                {upNext.map((song, idx) => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => onPlaySong(song.id)}
                    className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.06] px-3 py-2 transition-colors group text-left"
                  >
                    <span className="text-[11px] text-gray-700 w-4 text-right shrink-0 tabular-nums">{idx + 1}</span>
                    <div className="w-8 h-8 rounded-md overflow-hidden bg-white/[0.05] flex items-center justify-center shrink-0">
                      {song.coverUrl
                        ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                        : <Music2 className="w-3.5 h-3.5 text-gray-600" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-300 truncate group-hover:text-white transition-colors">
                        {song.title || song.fileName}
                      </p>
                      <p className="text-[11px] text-gray-600 truncate">{song.artist || 'Unknown artist'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!nowPlaying && upNext.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Music2 className="w-8 h-8 text-gray-700" />
              <p className="text-sm text-gray-600">Queue is empty.</p>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  )
}

export default QueuePanel
