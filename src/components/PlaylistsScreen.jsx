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
      <div className="mb-1 flex flex-nowrap items-center justify-center gap-3">
        <p className="section-title shrink-0 whitespace-nowrap text-base text-gray-300 text-center">Playlists</p>
        <button
          type="button"
          aria-label="Create playlist"
          onClick={() => setShowCreatePopup(true)}
          className="ui-btn-primary shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-sm p-4 sm:p-5 glass-card overflow-auto">
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-700/40 to-fuchsia-500/30 flex items-center justify-center">
              <Music2 className="w-7 h-7 text-violet-300/80" />
            </div>
            <p className="text-sm text-gray-400">No playlists yet.</p>
            <p className="text-xs text-gray-600">Click the + button above to create your first playlist.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => onSelectPlaylist(pl.id)}
                className="flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-1 transition-all duration-200 hover:bg-white/[0.04]"
              >
                <div className={`w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center shadow-inner ${pl.coverUrl ? 'bg-white/[0.06]' : 'bg-gradient-to-br from-violet-700/40 to-fuchsia-500/30'}`}>
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
            className="w-[min(92vw,420px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 p-4 sm:p-5 flex flex-col gap-3 glass-card"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cyan-200">Create playlist</h3>
              <button type="button" className="ui-btn-secondary text-xs px-2.5 py-1.5" onClick={() => { setShowCreatePopup(false); resetCreateForm() }}>Close</button>
            </div>
            <input type="text" value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} placeholder="Playlist name" className="ui-input rounded-lg px-3 py-2 text-sm" />
            <textarea rows={3} value={playlistDescription} onChange={(e) => setPlaylistDescription(e.target.value)} placeholder="Playlist description" className="ui-input rounded-lg px-3 py-2 text-sm resize-none" />
            <label className="text-xs text-gray-300 inline-flex cursor-pointer flex-nowrap items-center gap-2 whitespace-nowrap">
              <ImagePlus className="w-4 h-4 shrink-0 text-violet-300" />
              <span className="truncate">{playlistCoverUrl ? 'Cover selected' : 'Add cover photo'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; setPlaylistCoverUrl(URL.createObjectURL(file)) }} />
            </label>
            <button type="submit" className="ui-btn-primary px-3 py-2 text-sm font-medium text-center">Create playlist</button>
          </form>
        </div>
      )}
    </section>
  )
}

export default PlaylistsScreen
