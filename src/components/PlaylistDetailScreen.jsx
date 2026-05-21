import React, { useState } from 'react'
import { Music2, ArrowLeft, Play, ImagePlus, GripVertical, X, Search, Plus, Pencil, Shuffle, Trash2, Heart } from 'lucide-react'
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

function SortableTrackRow({ song, index, isActive, onPlayFromHere, onRemove, onToggleLoved, lovedSongIds }) {
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

  const loved = lovedSongIds?.includes(song.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 group transition-colors ${
        isDragging ? 'bg-white/[0.08] shadow-xl' : isActive ? 'bg-violet-500/10' : 'hover:bg-white/[0.04]'
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
        {isActive ? (
          <span className="flex gap-0.5 items-end h-3">
            <span className="w-0.5 rounded-full bg-violet-400 animate-[equalize_0.8s_ease-in-out_infinite]" style={{ height: '40%', animationDelay: '0s' }} />
            <span className="w-0.5 rounded-full bg-violet-400 animate-[equalize_0.8s_ease-in-out_infinite]" style={{ height: '80%', animationDelay: '0.2s' }} />
            <span className="w-0.5 rounded-full bg-violet-400 animate-[equalize_0.8s_ease-in-out_infinite]" style={{ height: '60%', animationDelay: '0.1s' }} />
          </span>
        ) : (
          <span className="text-gray-600">{index + 1}</span>
        )}
      </span>

      <div style={{ width: '36px', height: '36px', overflow: 'hidden', borderRadius: '8px', flexShrink: 0, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {song.coverUrl
          ? <img src={song.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Music2 className="w-4 h-4 text-gray-600" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-violet-300' : 'text-white/90'}`}>
          {song.title || song.fileName}
        </p>
        <p className="text-xs text-gray-500 truncate">{song.artist || 'Unknown artist'}</p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {onToggleLoved && (
          <div
            role="button"
            tabIndex={-1}
            onClick={() => onToggleLoved(song.id)}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${loved ? 'text-pink-400' : 'text-gray-600 hover:text-gray-400'}`}
          >
            <Heart className="w-3.5 h-3.5" fill={loved ? 'currentColor' : 'none'} />
          </div>
        )}
        <div
          role="button"
          tabIndex={-1}
          onClick={() => onPlayFromHere(song.id)}
          style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}
          className="text-gray-300 hover:text-white hover:border-white/40 transition-colors cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
        </div>
        <div
          role="button"
          tabIndex={-1}
          onClick={() => onRemove(song.id)}
          style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}
          className="text-gray-500 hover:text-red-400 hover:border-red-400/40 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  )
}

function PlaylistDetailScreen({
  playlist,
  songs,
  onBack,
  onPlayPlaylist,
  onToggleSongInPlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  currentTrackIndex,
  isPlaying,
  accentPresets = [],
  lovedSongIds = [],
  onToggleLoved,
}) {
  const [addSearch, setAddSearch] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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

  // Determine which track in the playlist is currently active
  const currentSong = songs[currentTrackIndex]
  const activePlaylistIndex = currentSong
    ? playlistSongs.findIndex((s) => s.id === currentSong.id)
    : -1

  return (
    <section className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0 relative">
      {/* Header row */}
      <div className="flex items-center gap-3 shrink-0">
        <div
          role="button"
          tabIndex={0}
          onClick={onBack}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onBack()}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0, cursor: 'pointer' }}
          className="text-gray-400 hover:text-white hover:border-white/40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </div>

        {/* Hero: cover + meta */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center shadow-xl shrink-0 group"
            style={{ background: playlist.accentColor ? `linear-gradient(135deg, ${playlist.accentColor}99, ${playlist.accentColor}44)` : 'linear-gradient(135deg, rgba(109,40,217,0.6), rgba(217,70,239,0.4))' }}
          >
            {playlist.coverUrl && <img src={playlist.coverUrl} alt="" className="w-full h-full object-cover absolute inset-0" />}
            {!playlist.coverUrl && <Music2 className="w-9 h-9 text-violet-300/80" />}
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl z-10">
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
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold text-white truncate leading-tight">{playlist.name}</h1>
              <div
                role="button"
                tabIndex={0}
                title="Edit playlist"
                onClick={() => { setEditName(playlist.name); setEditDescription(playlist.description || ''); setShowEdit(true) }}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (setEditName(playlist.name), setEditDescription(playlist.description || ''), setShowEdit(true))}
                className="shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </div>
            </div>
            {playlist.description && (
              <p className="text-xs text-gray-500 truncate">{playlist.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-gray-600">{playlistSongs.length} {playlistSongs.length === 1 ? 'song' : 'songs'}</span>
              <button
                type="button"
                disabled={playlistSongs.length === 0}
                onClick={() => onPlayPlaylist(playlist.id, null, false)}
                className="disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-semibold hover:scale-105 transition-transform cursor-pointer select-none">
                  <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
                  Play all
                </div>
              </button>
              <button
                type="button"
                disabled={playlistSongs.length === 0}
                onClick={() => onPlayPlaylist(playlist.id, null, true)}
                className="disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="px-3 py-1.5 rounded-full border border-white/20 text-gray-300 text-xs font-medium hover:border-white/40 hover:text-white transition-colors cursor-pointer select-none">
                  <Shuffle className="w-3 h-3" />
                  Shuffle
                </div>
              </button>
              {onDeletePlaylist && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowDeleteConfirm(true)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowDeleteConfirm(true)}
                  className="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Delete playlist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            {accentPresets.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {accentPresets.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    title={preset.label}
                    onClick={() => onUpdatePlaylist(playlist.id, { accentColor: playlist.accentColor === preset.hex ? null : preset.hex })}
                    className="w-4 h-4 rounded-full transition-transform hover:scale-110 shrink-0"
                    style={{
                      background: preset.hex,
                      outline: playlist.accentColor === preset.hex ? `2px solid ${preset.hex}` : '2px solid transparent',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            )}
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
                  {playlistSongs.map((song, index) => (
                    <SortableTrackRow
                      key={song.id}
                      song={song}
                      index={index}
                      isActive={activePlaylistIndex === index && isPlaying}
                      lovedSongIds={lovedSongIds}
                      onToggleLoved={onToggleLoved}
                      onPlayFromHere={(songId) => onPlayPlaylist(playlist.id, songId, false)}
                      onRemove={onToggleSongInPlaylist}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Add songs panel */}
        <div className="w-80 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col overflow-hidden glass-card shrink-0">
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
                  <div
                    key={song.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleSongInPlaylist(song.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggleSongInPlaylist(song.id)}
                    className="rounded-xl hover:bg-white/[0.06] px-2.5 py-2 transition-colors group cursor-pointer"
                    style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                  >
                    <div style={{ width: '32px', height: '32px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {song.coverUrl
                        ? <img src={song.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit playlist modal */}
      {showEdit && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const trimmed = editName.trim()
              if (!trimmed) return
              onUpdatePlaylist(playlist.id, { name: trimmed, description: editDescription.trim() })
              setShowEdit(false)
            }}
            className="w-[min(92%,380px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 p-5 flex flex-col gap-4 glass-card"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Edit playlist</h3>
              <button type="button" onClick={() => setShowEdit(false)} className="text-xs text-gray-500 hover:text-white transition-colors">Close</button>
            </div>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Playlist name"
              className="ui-input rounded-lg px-3 py-2 text-sm w-full"
              autoFocus
            />
            <textarea
              rows={2}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              className="ui-input rounded-lg px-3 py-2 text-sm resize-none"
            />
            <button type="submit" className="ui-btn-primary px-3 py-2 text-sm font-medium text-center rounded-xl">
              Save changes
            </button>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
          <div className="w-[min(92%,340px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 p-5 flex flex-col gap-4 glass-card">
            <h3 className="text-sm font-semibold text-white">Delete &ldquo;{playlist.name}&rdquo;?</h3>
            <p className="text-xs text-gray-400">This will permanently remove the playlist. Your songs will not be deleted.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 ui-btn-secondary px-3 py-2 text-sm rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { onDeletePlaylist(playlist.id); setShowDeleteConfirm(false); onBack() }}
                className="flex-1 rounded-xl border border-red-500/50 bg-red-500/10 text-red-300 px-3 py-2 text-sm hover:bg-red-500/20 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default PlaylistDetailScreen
