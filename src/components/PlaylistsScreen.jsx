import React, { useState } from 'react'
import { Music2, Plus, ImagePlus } from 'lucide-react'

function PlaylistsScreen({
  songs,
  playlists,
  selectedPlaylistId,
  onCreatePlaylist,
  onSelectPlaylist,
  onToggleSongInPlaylist,
  onPlaySong,
  onUpdatePlaylist,
  onParallaxMove,
  onParallaxLeave,
}) {
  const [showCreatePopup, setShowCreatePopup] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const [playlistDescription, setPlaylistDescription] = useState('')
  const [playlistCoverUrl, setPlaylistCoverUrl] = useState(null)

  const selectedPlaylist =
    playlists.find((pl) => pl.id === selectedPlaylistId) || null
  const selectedSongs = selectedPlaylist
    ? songs.filter((song) => selectedPlaylist.songIds.includes(song.id))
    : []

  const resetCreateForm = () => {
    setPlaylistName('')
    setPlaylistDescription('')
    setPlaylistCoverUrl(null)
  }

  return (
    <section className="flex-1 flex flex-col overflow-hidden min-w-0 gap-4 relative">
      <div className="flex items-center justify-center gap-3 mb-2">
        <p className="section-title text-base text-gray-300 text-center">
          Playlists
        </p>
        <button
          type="button"
          aria-label="Create playlist"
          onClick={() => setShowCreatePopup(true)}
          className="w-8 h-8 rounded-full border border-violet-500/70 text-violet-300 hover:bg-violet-500/10 flex items-center justify-center transition"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 flex-1 overflow-hidden">
        <div
          className="sm:w-64 md:w-72 bg-white/[0.02] border border-white/8 rounded-2xl p-3 flex flex-col gap-2 overflow-auto glass-card parallax-card"
          onMouseMove={onParallaxMove}
          onMouseLeave={onParallaxLeave}
        >
          {playlists.length === 0 ? (
            <p className="text-xs text-gray-500">
              No playlists yet. Use + to create your first playlist.
            </p>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => onSelectPlaylist(pl.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 transition ${
                  pl.id === selectedPlaylistId
                    ? 'bg-white/[0.08] text-white'
                    : 'hover:bg-white/[0.04] text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-white/[0.08] overflow-hidden flex items-center justify-center shrink-0">
                    {pl.coverUrl ? (
                      <img src={pl.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music2 className="w-4 h-4 text-violet-300" />
                    )}
                  </div>
                  <span className="truncate">{pl.name}</span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {
                    pl.songIds.filter((id) =>
                      songs.some((s) => s.id === id),
                    ).length
                  }{' '}
                  tracks
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 sm:p-4 overflow-auto glass-card">
          {selectedPlaylist && playlists.length > 0 ? (
            <>
              <div className="mb-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white/[0.08] overflow-hidden flex items-center justify-center shrink-0">
                  {selectedPlaylist.coverUrl ? (
                    <img src={selectedPlaylist.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music2 className="w-6 h-6 text-violet-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{selectedPlaylist.name}</p>
                  {selectedPlaylist.description ? (
                    <p className="text-xs text-gray-400 truncate">{selectedPlaylist.description}</p>
                  ) : null}
                </div>
                <label className="text-[11px] px-2 py-1 rounded-full border border-white/15 hover:border-white/40 text-gray-200 inline-flex items-center gap-1 cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5" />
                  Cover
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const coverUrl = URL.createObjectURL(file)
                      onUpdatePlaylist(selectedPlaylist.id, { coverUrl })
                    }}
                  />
                </label>
              </div>
              <div className="space-y-1.5">
                {selectedSongs.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500">
                    This playlist has no songs yet.
                  </p>
                ) : (
                  selectedSongs.map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 bg-white/[0.02] hover:bg-white/[0.06] text-xs sm:text-sm text-gray-200"
                    >
                      <button
                        type="button"
                        onClick={() => onPlaySong(song.id)}
                        className="flex items-center gap-2 min-w-0"
                      >
                        <span className="w-8 h-8 rounded-md bg-white/[0.08] overflow-hidden flex items-center justify-center shrink-0">
                          {song.coverUrl ? (
                            <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Music2 className="w-4 h-4 text-cyan-300" />
                          )}
                        </span>
                        <span className="truncate">
                          {song.title || song.fileName}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleSongInPlaylist(song.id)}
                        className="text-[11px] px-2 py-1 rounded-full border border-white/12 hover:border-white/40 text-gray-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="text-xs sm:text-sm text-gray-500">
              Select a playlist on the left to view its songs.
            </p>
          )}
        </div>
      </div>

      {showCreatePopup && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const name = playlistName.trim()
              if (!name) return
              onCreatePlaylist({
                name,
                description: playlistDescription.trim(),
                coverUrl: playlistCoverUrl,
              })
              resetCreateForm()
              setShowCreatePopup(false)
            }}
            className="w-[min(92vw,420px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cyan-200">Create playlist</h3>
              <button type="button" className="text-xs text-gray-400 hover:text-white" onClick={() => { setShowCreatePopup(false); resetCreateForm() }}>Close</button>
            </div>
            <input
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="Playlist name"
              className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
            />
            <textarea
              rows={3}
              value={playlistDescription}
              onChange={(e) => setPlaylistDescription(e.target.value)}
              placeholder="Playlist description"
              className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none resize-none"
            />
            <label className="text-xs text-gray-300 inline-flex items-center gap-2 cursor-pointer">
              <ImagePlus className="w-4 h-4 text-violet-300" />
              {playlistCoverUrl ? 'Cover selected' : 'Add cover photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setPlaylistCoverUrl(URL.createObjectURL(file))
                }}
              />
            </label>
            <button type="submit" className="px-3 py-2 rounded-lg border border-violet-500/70 text-violet-200 hover:bg-violet-500/10 text-sm font-medium transition">Create playlist</button>
          </form>
        </div>
      )}
    </section>
  )
}

export default PlaylistsScreen
