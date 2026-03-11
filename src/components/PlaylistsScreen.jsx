import React, { useState } from 'react'
import { Music2, Plus, ImagePlus } from 'lucide-react'

function PlaylistsScreen({ playlists, onCreatePlaylist, onSelectPlaylist }) {
  const [showCreatePopup, setShowCreatePopup] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const [playlistDescription, setPlaylistDescription] = useState('')
  const [playlistCoverUrl, setPlaylistCoverUrl] = useState(null)

  const resetCreateForm = () => {
    setPlaylistName('')
    setPlaylistDescription('')
    setPlaylistCoverUrl(null)
  }

  return (
    <section className="flex-1 flex flex-col overflow-hidden min-w-0 gap-4 relative">
      <div className="flex items-center justify-center gap-3 mb-1">
        <p className="section-title text-base text-gray-300 text-center">Playlists</p>
        <button
          type="button"
          aria-label="Create playlist"
          onClick={() => setShowCreatePopup(true)}
          className="w-8 h-8 rounded-full border border-violet-500/70 text-violet-300 hover:bg-violet-500/10 flex items-center justify-center transition"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-sm p-4 sm:p-5 glass-card overflow-auto">
        {playlists.length === 0 ? (
          <p className="text-xs text-gray-500">No playlists yet. Use + to create your first playlist.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => onSelectPlaylist(pl.id)}
                className="flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-1 transition-all duration-200 hover:bg-white/[0.04]"
              >
                <div className="w-full aspect-square rounded-xl bg-white/[0.06] overflow-hidden flex items-center justify-center shadow-inner">
                  {pl.coverUrl ? (
                    <img src={pl.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music2 className="w-10 h-10 text-violet-300/80" />
                  )}
                </div>
                <p className="text-sm font-medium truncate text-white/95">{pl.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{pl.songIds.length} tracks</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreatePopup && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const name = playlistName.trim()
              if (!name) return
              onCreatePlaylist({ name, description: playlistDescription.trim(), coverUrl: playlistCoverUrl })
              resetCreateForm()
              setShowCreatePopup(false)
            }}
            className="w-[min(92vw,420px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cyan-200">Create playlist</h3>
              <button type="button" className="text-xs text-gray-400 hover:text-white" onClick={() => { setShowCreatePopup(false); resetCreateForm() }}>Close</button>
            </div>
            <input type="text" value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} placeholder="Playlist name" className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
            <textarea rows={3} value={playlistDescription} onChange={(e) => setPlaylistDescription(e.target.value)} placeholder="Playlist description" className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none" />
            <label className="text-xs text-gray-300 inline-flex items-center gap-2 cursor-pointer">
              <ImagePlus className="w-4 h-4 text-violet-300" />
              {playlistCoverUrl ? 'Cover selected' : 'Add cover photo'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; setPlaylistCoverUrl(URL.createObjectURL(file)) }} />
            </label>
            <button type="submit" className="px-3 py-2 rounded-lg border border-violet-500/70 text-violet-200 hover:bg-violet-500/10 text-sm font-medium transition">Create playlist</button>
          </form>
        </div>
      )}
    </section>
  )
}

export default PlaylistsScreen
