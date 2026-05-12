import React, { useState } from 'react'
import { Music2, Plus, ImagePlus, Play } from 'lucide-react'
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion'

function PlaylistsScreen({ playlists, songs, onCreatePlaylist, onSelectPlaylist, accentPresets = [] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState(null)
  const [coverName, setCoverName] = useState('')
  const [selectedAccent, setSelectedAccent] = useState(null)

  const reset = () => {
    setName('')
    setDescription('')
    setCoverUrl(null)
    setCoverName('')
    setSelectedAccent(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onCreatePlaylist({ name: trimmed, description: description.trim(), coverUrl, accentColor: selectedAccent })
    reset()
    setShowCreate(false)
  }

  return (
    <section className="flex-1 flex flex-col overflow-hidden min-w-0 gap-4 relative">
      <div className="flex items-center justify-center gap-3 shrink-0">
        <h2 className="section-title text-base sm:text-lg text-white">Playlists</h2>
      </div>

      <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-sm p-4 sm:p-5 glass-card overflow-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
          {/* New Playlist card */}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-2 transition-all duration-200"
          >
            <div className="w-full aspect-square rounded-xl overflow-hidden border-2 border-dashed border-white/12 group-hover:border-violet-500/50 flex flex-col items-center justify-center transition-colors bg-white/[0.02] group-hover:bg-violet-500/5">
              <div className="w-10 h-10 rounded-full border border-white/15 group-hover:border-violet-400/60 flex items-center justify-center transition-colors mb-2">
                <Plus className="w-5 h-5 text-gray-600 group-hover:text-violet-400 transition-colors" />
              </div>
              <span className="text-[11px] text-gray-600 group-hover:text-gray-400 transition-colors">New playlist</span>
            </div>
            <p className="text-sm font-medium text-gray-600 group-hover:text-gray-300 transition-colors">New playlist</p>
            <p className="text-[11px] text-gray-700">—</p>
          </button>

          {playlists.map((pl) => {
            const trackCount = pl.songIds.filter((id) => songs?.some((s) => s.id === id)).length
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => onSelectPlaylist(pl.id)}
                className="flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-2 transition-all duration-200 hover:bg-white/[0.04]"
              >
                <div
                  className={`relative w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center shadow-inner ${pl.coverUrl ? 'bg-white/[0.06]' : ''}`}
                  style={!pl.coverUrl ? { background: pl.accentColor ? `linear-gradient(135deg, ${pl.accentColor}66, ${pl.accentColor}22)` : 'linear-gradient(135deg, rgba(109,40,217,0.4), rgba(217,70,239,0.3))' } : {}}
                >
                  {pl.coverUrl
                    ? <img src={pl.coverUrl} alt="" className="w-full h-full object-cover" />
                    : <Music2 className="w-10 h-10 text-violet-300/80" />
                  }
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 text-black ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium truncate text-white/95">{pl.name}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                </p>
              </button>
            )
          })}
        </div>

        {playlists.length === 0 && (
          <p className="text-xs text-gray-600 text-center mt-10">
            Click &ldquo;New playlist&rdquo; to create your first playlist.
          </p>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-sm"
          >
            <motion.form
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleSubmit}
              className="w-[min(92vw,400px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 p-5 flex flex-col gap-4 glass-card"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Create playlist</h3>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); reset() }}
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>

              {/* Cover preview */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-violet-700/40 to-fuchsia-500/30 flex items-center justify-center shrink-0 border border-white/10">
                  {coverUrl
                    ? <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                    : <Music2 className="w-8 h-8 text-violet-300/60" />
                  }
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-gray-200 transition-colors">
                  <ImagePlus className="w-4 h-4 shrink-0 text-violet-400" />
                  <span className="truncate max-w-[140px]">{coverName || 'Add cover photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setCoverUrl(URL.createObjectURL(file))
                      setCoverName(file.name)
                    }}
                  />
                </label>
              </div>

              {accentPresets.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-gray-500">Accent colour</p>
                  <div className="flex gap-2 flex-wrap">
                    {accentPresets.map((preset) => (
                      <button
                        key={preset.hex}
                        type="button"
                        title={preset.label}
                        onClick={() => setSelectedAccent(selectedAccent === preset.hex ? null : preset.hex)}
                        className="w-6 h-6 rounded-full transition-transform hover:scale-110 shrink-0"
                        style={{
                          background: preset.hex,
                          outline: selectedAccent === preset.hex ? `2px solid ${preset.hex}` : '2px solid transparent',
                          outlineOffset: '2px',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Playlist name"
                className="ui-input rounded-lg px-3 py-2 text-sm w-full"
              />
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="ui-input rounded-lg px-3 py-2 text-sm resize-none"
              />
              <button type="submit" className="ui-btn-primary px-3 py-2 text-sm font-medium text-center rounded-xl">
                Create playlist
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export default PlaylistsScreen
