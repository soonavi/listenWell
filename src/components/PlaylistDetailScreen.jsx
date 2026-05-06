import React, { useState } from 'react'
import { Music2, ArrowLeft, Play, ImagePlus, GripVertical, X, Search, Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableTrackRow({ song, index, isPlaying, currentTrackIndex, songIndex, onPlaySong, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const active = currentTrackIndex === songIndex && isPlaying

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 group transition-colors ${
        isDragging ? 'bg-white/[0.08] shadow-xl' : active ? 'bg-violet-500/10' : 'hover:bg-white/[0.04]'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0 touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <span className="w-5 shrink-0 flex items-center justify-end text-[11px] tabular-nums">
        {active ? (
          <span className="flex gap-0.5 items-end h-3">
            <span className="w-0.5 rounded-full bg-violet-400 animate-[equalize_0.8s_ease-in-out_infinite]" style={{ height: '40%', animationDelay: '0s' }} />
            <span className="w-0.5 rounded-full bg-violet-400 animate-[equalize_0.8s_ease-in-out_infinite]" style={{ height: '80%', animationDelay: '0.2s' }} />
            <span className="w-0.5 rounded-full bg-violet-400 animate-[equalize_0.8s_ease-in-out_infinite]" style={{ height: '60%', animationDelay: '0.1s' }} />
          </span>
        ) : (
          <span className={active ? 'text-violet-400' : 'text-gray-600'}>{index + 1}</span>
        )}
      </span>

      <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/[0.06] flex items-center justify-center shrink-0">
        {song.coverUrl
          ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
          : <Music2 className="w-4 h-4 text-gray-600" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${active ? 'text-violet-300' : 'text-white/90'}`}>
          {song.title || song.fileName}
        </p>
        <p className="text-xs text-gray-500 truncate">{song.artist || 'Unknown artist'}</p>
      </div>

      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={() => onPlaySong(song.id)}
          className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-gray-300 hover:text-white hover:border-white/40 transition-colors"
        >
          <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(song.id)}
          className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-gray-500 hover:text-red-400 hover:border-red-400/40 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function PlaylistDetailScreen({
  playlist,
  songs,
  onBack,
  onPlaySong,
  onToggleSongInPlaylist,
  onUpdatePlaylist,
  currentTrackIndex,
  isPlaying,
}) {
  const [addSearch, setAddSearch] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (!playlist) {
    return (
      <section className="flex-1 flex items-center justify-center text-sm text-gray-500">
        Playlist not found.
      </section>
    )
  }

  const playlistSongs = playlist.songIds
    .map((id) => songs.find((s) => s.id === id))
    .filter(Boolean)

  const normalizedSearch = addSearch.trim().toLowerCase()
  const songsNotInPlaylist = songs
    .filter((s) => !playlist.songIds.includes(s.id))
    .filter((s) => {
      if (!normalizedSearch) return true
      const title = (s.title || s.fileName || '').toLowerCase()
      const artist = (s.artist || '').toLowerCase()
      return title.includes(normalizedSearch) || artist.includes(normalizedSearch)
    })

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = playlist.songIds.indexOf(active.id)
    const newIndex = playlist.songIds.indexOf(over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onUpdatePlaylist(playlist.id, { songIds: arrayMove(playlist.songIds, oldIndex, newIndex) })
  }

  return (
    <section className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
      {/* Header row */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-full border border-white/15 text-gray-400 hover:text-white hover:border-white/40 transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Hero: cover + meta */}
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-violet-700/60 to-fuchsia-500/40 flex items-center justify-center shadow-xl shrink-0 group">
            {playlist.coverUrl
              ? <img src={playlist.coverUrl} alt="" className="w-full h-full object-cover" />
              : <Music2 className="w-9 h-9 text-violet-300/80" />
            }
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
              <ImagePlus className="w-5 h-5 text-white" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  onUpdatePlaylist(playlist.id, { coverUrl: URL.createObjectURL(file) })
                }}
              />
            </label>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-0.5">Playlist</p>
            <h1 className="text-xl font-bold text-white truncate leading-tight">{playlist.name}</h1>
            {playlist.description && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{playlist.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <p className="text-xs text-gray-600">{playlistSongs.length} {playlistSongs.length === 1 ? 'song' : 'songs'}</p>
              <button
                type="button"
                onClick={() => playlistSongs[0] && onPlaySong(playlistSongs[0].id)}
                disabled={playlistSongs.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black text-xs font-semibold hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
                Play all
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Body: track list + add panel */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Track list */}
        <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col overflow-hidden glass-card">
          <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Tracks</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {playlistSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
                <Music2 className="w-9 h-9 text-gray-700" />
                <p className="text-sm text-gray-500">No songs yet.</p>
                <p className="text-xs text-gray-600">Add songs from the panel on the right.</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={playlist.songIds} strategy={verticalListSortingStrategy}>
                  {playlistSongs.map((song, index) => {
                    const songIndex = songs.findIndex((s) => s.id === song.id)
                    return (
                      <SortableTrackRow
                        key={song.id}
                        song={song}
                        index={index}
                        isPlaying={isPlaying}
                        currentTrackIndex={currentTrackIndex}
                        songIndex={songIndex}
                        onPlaySong={onPlaySong}
                        onRemove={onToggleSongInPlaylist}
                      />
                    )
                  })}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Add songs panel */}
        <div className="w-64 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col overflow-hidden glass-card shrink-0">
          <div className="px-4 py-3 border-b border-white/[0.06] shrink-0 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Add Songs</p>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Search…"
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500/40 focus:bg-white/[0.07] transition-colors"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {songsNotInPlaylist.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-8 px-3">
                {normalizedSearch ? 'No matches.' : 'All your songs are in this playlist.'}
              </p>
            ) : (
              <div className="space-y-0.5">
                {songsNotInPlaylist.map((song) => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => onToggleSongInPlaylist(song.id)}
                    className="w-full flex items-center gap-2.5 rounded-xl hover:bg-white/[0.06] px-2.5 py-2 transition-colors group text-left"
                  >
                    <div className="w-8 h-8 rounded-md overflow-hidden bg-white/[0.06] flex items-center justify-center shrink-0">
                      {song.coverUrl
                        ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                        : <Music2 className="w-3.5 h-3.5 text-gray-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-300 truncate group-hover:text-white transition-colors">
                        {song.title || song.fileName}
                      </p>
                      <p className="text-[11px] text-gray-600 truncate">{song.artist || 'Unknown'}</p>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-gray-600 group-hover:text-violet-400 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default PlaylistDetailScreen
