import React from 'react'
import { Music2, Plus } from 'lucide-react'

function PlaylistsScreen({
  songs,
  playlists,
  selectedPlaylistId,
  newPlaylistName,
  onChangeNewPlaylistName,
  onCreatePlaylist,
  onSelectPlaylist,
  onToggleSongInPlaylist,
  onPlaySong,
  onParallaxMove,
  onParallaxLeave,
}) {
  const selectedPlaylist =
    playlists.find((pl) => pl.id === selectedPlaylistId) || null

  return (
    <section className="flex-1 flex flex-col overflow-hidden min-w-0 gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-2">
        <div>
          <p className="section-title text-base text-gray-300 text-center">
            Playlists
          </p>
          <p className="text-xs text-gray-500 text-center">
            Create playlists from your library and choose what to play.
          </p>
        </div>
        <form
          className="flex items-center gap-2 text-xs sm:text-sm"
          onSubmit={(e) => {
            e.preventDefault()
            onCreatePlaylist()
          }}
        >
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => onChangeNewPlaylistName(e.target.value)}
            placeholder="New playlist name"
            className="bg-white/[0.04] border border-white/10 rounded-full px-3 py-1.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-full border border-violet-500/70 text-violet-300 hover:bg-violet-500/10 text-xs sm:text-sm font-medium transition"
          >
            Create
          </button>
        </form>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 flex-1 overflow-hidden">
        <div
          className="sm:w-64 md:w-72 bg-white/[0.02] border border-white/8 rounded-2xl p-3 flex flex-col gap-2 overflow-auto glass-card parallax-card"
          onMouseMove={onParallaxMove}
          onMouseLeave={onParallaxLeave}
        >
          {playlists.length === 0 ? (
            <p className="text-xs text-gray-500">
              No playlists yet. Create one to get started.
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
                <span className="truncate">{pl.name}</span>
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

        <div
          className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 sm:p-4 overflow-auto glass-card parallax-card"
          onMouseMove={onParallaxMove}
          onMouseLeave={onParallaxLeave}
        >
          {selectedPlaylist && playlists.length > 0 ? (
            <>
              <p className="text-xs sm:text-sm text-gray-300 mb-2">
                Songs in this playlist
              </p>
              <div className="space-y-1.5">
                {songs.map((song) => {
                  const inPlaylist = selectedPlaylist.songIds.includes(song.id)
                  return (
                    <div
                      key={song.id}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 bg-white/[0.02] hover:bg-white/[0.06] text-xs sm:text-sm text-gray-200"
                    >
                      <button
                        type="button"
                        onClick={() => onPlaySong(song.id)}
                        className="flex items-center gap-2 min-w-0"
                      >
                        <span className="w-6 h-6 rounded-md bg-white/[0.08] flex items-center justify-center text-[10px] text-gray-300 shrink-0">
                          {inPlaylist ? (
                            <Music2 className="w-3.5 h-3.5 text-cyan-300" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-violet-300" />
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
                        {inPlaylist ? 'Remove' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-xs sm:text-sm text-gray-500">
              Select a playlist on the left to manage its songs.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default PlaylistsScreen
