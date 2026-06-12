import React from 'react'
import { Music2, ListMusic, Heart, Play } from 'lucide-react'

function PanelHeader({ label, count }) {
  return (
    <div className="shrink-0 flex items-baseline justify-between gap-3 mb-3">
      <h3 className="section-title text-[11px] sm:text-xs text-gray-400">{label}</h3>
      {count > 0 && <span className="text-[11px] text-gray-500 tabular-nums">{count}</span>}
    </div>
  )
}

function EmptyState({ message, actionLabel, onAction }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
      <p className="text-xs text-gray-500 max-w-[26ch] leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="px-3.5 py-1.5 rounded-[10px] text-xs text-gray-200 border border-white/15 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/40 transition-colors duration-150"
      >
        {actionLabel}
      </button>
    </div>
  )
}

function SongRow({ song, isCurrent, isPlaying, onPlay, trailing }) {
  return (
    <div
      className={`flex items-center gap-1 rounded-lg border transition-colors duration-150 ${
        isCurrent ? 'border-violet-500/35 bg-violet-500/[0.06]' : 'border-transparent hover:border-violet-500/25 hover:bg-violet-500/[0.05]'
      }`}
    >
      <button
        type="button"
        onClick={onPlay}
        className="group flex-1 min-w-0 flex items-center gap-3 px-2 py-2 text-left"
      >
        <div className="w-10 h-10 rounded-md bg-white/[0.06] overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
          {song.coverUrl
            ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
            : <Music2 className="w-4 h-4 text-violet-300/70" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm truncate ${isCurrent ? 'text-violet-100' : 'text-white/90'}`}>
            {song.title || song.fileName}
          </p>
          <p className="text-xs text-gray-500 truncate">{song.artist || song.album || song.fileName}</p>
        </div>
        {isCurrent && isPlaying
          ? <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_2px_rgba(139,92,246,0.45)] animate-pulse shrink-0" aria-label="Playing" />
          : <Play className="w-3.5 h-3.5 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0" aria-hidden />}
      </button>
      {trailing}
    </div>
  )
}

function HomeScreen({
  displayName,
  songs,
  playlists,
  lovedSongIds,
  recentItems,
  currentTrackIndex,
  isPlaying,
  onPlaySong,
  onOpenPlaylist,
  onToggleLoved,
  onGoToSongs,
  onGoToPlaylists,
}) {
  const currentSongId = currentTrackIndex !== null ? songs[currentTrackIndex]?.id : null

  const recentSongs = recentItems
    .filter((item) => item.type === 'song')
    .map((item) => songs.find((s) => s.id === item.id))
    .filter(Boolean)
    .slice(0, 20)

  const lovedSongs = lovedSongIds
    .map((id) => songs.find((s) => s.id === id))
    .filter(Boolean)

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-4 sm:gap-5 overflow-y-auto lg:overflow-hidden">
      {/* Page identity */}
      <div className="shrink-0 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 px-1">
        <div>
          <h2 className="section-title text-base sm:text-lg text-white">Home</h2>
          <p className="text-xs text-gray-500 mt-1">
            Welcome back{displayName ? `, ${displayName}` : ''}. Your library, as you left it.
          </p>
        </div>
        <p className="text-[11px] text-gray-500 tabular-nums">
          {songs.length} {songs.length === 1 ? 'track' : 'tracks'} · {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'} · {lovedSongs.length} loved
        </p>
      </div>

      <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Playlists */}
        <section className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col lg:min-h-0 lg:col-span-7">
          <PanelHeader label="Playlists" count={playlists.length} />
          {playlists.length === 0 ? (
            <EmptyState
              message="No playlists yet. Group tracks into sets that stay exactly as you arrange them."
              actionLabel="Create a playlist"
              onAction={onGoToPlaylists}
            />
          ) : (
            <div className="max-h-80 lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto -mx-1 px-1">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 sm:gap-3">
                {playlists.map((pl) => {
                  const trackCount = pl.songIds.filter((id) => songs.some((s) => s.id === id)).length
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => onOpenPlaylist(pl.id)}
                      className="text-left flex flex-col gap-2 rounded-xl p-2 border border-transparent hover:border-violet-500/25 hover:bg-violet-500/[0.05] transition-colors duration-150"
                    >
                      <div
                        className={`w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center shadow-inner ${pl.coverUrl ? 'bg-white/[0.06]' : ''}`}
                        style={!pl.coverUrl ? { background: pl.accentColor ? `linear-gradient(135deg, ${pl.accentColor}66, ${pl.accentColor}22)` : 'linear-gradient(135deg, rgba(109,40,217,0.4), rgba(217,70,239,0.3))' } : {}}
                      >
                        {pl.coverUrl
                          ? <img src={pl.coverUrl} alt="" className="w-full h-full object-cover" />
                          : <ListMusic className="w-7 h-7 text-white/70" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white/95 truncate">{pl.name}</p>
                        <p className="text-[11px] text-gray-500 tabular-nums">{trackCount} {trackCount === 1 ? 'track' : 'tracks'}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* Recent listens + Loved */}
        <div className="flex flex-col gap-4 sm:gap-5 lg:min-h-0 lg:col-span-5">
          <section className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col lg:min-h-0 lg:flex-1">
            <PanelHeader label="Recent listens" count={recentSongs.length} />
            {recentSongs.length === 0 ? (
              <EmptyState
                message="Nothing played yet. Press play on a track and it shows up here."
                actionLabel="Browse songs"
                onAction={onGoToSongs}
              />
            ) : (
              <div className="max-h-80 lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto -mx-1 px-1 flex flex-col gap-0.5">
                {recentSongs.map((song) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    isCurrent={song.id === currentSongId}
                    isPlaying={isPlaying}
                    onPlay={() => onPlaySong(song.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col lg:min-h-0 lg:flex-1">
            <PanelHeader label="Loved" count={lovedSongs.length} />
            {lovedSongs.length === 0 ? (
              <EmptyState
                message="Tap the heart on any track to keep it here."
                actionLabel="Browse songs"
                onAction={onGoToSongs}
              />
            ) : (
              <div className="max-h-80 lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto -mx-1 px-1 flex flex-col gap-0.5">
                {lovedSongs.map((song) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    isCurrent={song.id === currentSongId}
                    isPlaying={isPlaying}
                    onPlay={() => onPlaySong(song.id)}
                    trailing={
                      <button
                        type="button"
                        onClick={() => onToggleLoved(song.id)}
                        aria-label={`Remove ${song.title || song.fileName} from loved`}
                        className="shrink-0 p-2 mr-1 rounded-md text-pink-400 hover:text-pink-300 hover:bg-white/[0.06] transition-colors duration-150"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default HomeScreen
