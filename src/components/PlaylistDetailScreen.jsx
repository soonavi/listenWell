import React from 'react'
import { Music2, Plus, ImagePlus, ArrowLeft } from 'lucide-react'

function PlaylistDetailScreen({ playlist, songs, onBack, onPlaySong, onToggleSongInPlaylist, onUpdatePlaylist }) {
  if (!playlist) {
    return (
      <section className="flex-1 flex items-center justify-center text-sm text-gray-500">
        Playlist not found.
      </section>
    )
  }

  const playlistSongs = songs.filter((song) => playlist.songIds.includes(song.id))
  const songsNotInPlaylist = songs.filter((song) => !playlist.songIds.includes(song.id))

  return (
    <section className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="ui-btn-secondary px-3 py-1.5 rounded-full text-xs inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <h2 className="text-lg font-semibold text-white truncate">{playlist.name}</h2>
      </div>

      <div className="flex gap-4 min-h-0 flex-1">
        <div className="w-72 rounded-2xl bg-white/[0.03] border border-white/10 p-3 glass-card overflow-auto">
          <div className="aspect-square rounded-xl bg-white/[0.06] overflow-hidden flex items-center justify-center mb-3">
            {playlist.coverUrl ? <img src={playlist.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music2 className="w-12 h-12 text-violet-300/80" />}
          </div>
          <p className="text-sm font-medium text-white">{playlist.name}</p>
          {playlist.description ? <p className="text-xs text-gray-400 mt-1">{playlist.description}</p> : null}
          <label className="ui-btn-secondary mt-3 text-[11px] px-2 py-1 rounded-full inline-flex items-center gap-1 cursor-pointer">
            <ImagePlus className="w-3.5 h-3.5" /> Cover
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; onUpdatePlaylist(playlist.id, { coverUrl: URL.createObjectURL(file) }) }} />
          </label>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 overflow-auto glass-card">
            <p className="text-xs text-gray-300 mb-2">Songs in playlist</p>
            <div className="space-y-1.5">
              {playlistSongs.length === 0 ? <p className="text-xs text-gray-500">No songs yet.</p> : playlistSongs.map((song) => (
                <div key={song.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 bg-white/[0.02]">
                  <button type="button" onClick={() => onPlaySong(song.id)} className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-md bg-white/[0.08] overflow-hidden flex items-center justify-center shrink-0">{song.coverUrl ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music2 className="w-4 h-4 text-cyan-300" />}</span>
                    <span className="truncate text-sm text-gray-100">{song.title || song.fileName}</span>
                  </button>
                  <button type="button" onClick={() => onToggleSongInPlaylist(song.id)} className="ui-btn-secondary text-[11px] px-2 py-1 rounded-full">Remove</button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 overflow-auto glass-card">
            <p className="text-xs text-gray-300 mb-2">Add songs</p>
            <div className="space-y-1.5">
              {songsNotInPlaylist.length === 0 ? <p className="text-xs text-gray-500">All songs already in playlist.</p> : songsNotInPlaylist.map((song) => (
                <div key={song.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 bg-white/[0.02]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-md bg-white/[0.08] overflow-hidden flex items-center justify-center shrink-0">{song.coverUrl ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music2 className="w-4 h-4 text-violet-300" />}</span>
                    <span className="truncate text-sm text-gray-100">{song.title || song.fileName}</span>
                  </div>
                  <button type="button" onClick={() => onToggleSongInPlaylist(song.id)} className="ui-btn-primary text-[11px] px-2 py-1 rounded-full inline-flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PlaylistDetailScreen
