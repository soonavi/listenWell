import React, { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Music2, X, GripVertical, Pencil } from 'lucide-react'

function SortableQueueItem({ song, idx, onPlay, onRemove, onEditMetadata }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id })
  const [ctxMenu, setCtxMenu] = useState(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  const openCtx = (e) => {
    e.preventDefault()
    const x = Math.min(e.clientX, window.innerWidth - 180)
    const y = Math.min(e.clientY, window.innerHeight - 100)
    setCtxMenu({ x, y })
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl px-2 py-1.5 group transition-colors ${isDragging ? 'bg-white/[0.1]' : 'hover:bg-white/[0.06]'}`}
        onContextMenu={openCtx}
      >
        {/* drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="touch-none shrink-0 text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing p-0.5 transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-3 h-3" />
        </button>

        {/* index */}
        <span className="text-[10px] text-gray-700 w-4 text-right shrink-0 tabular-nums">{idx + 1}</span>

        {/* cover */}
        <button
          type="button"
          onClick={onPlay}
          className="w-8 h-8 rounded-md overflow-hidden bg-white/[0.05] flex items-center justify-center shrink-0 hover:ring-1 hover:ring-violet-400/40 transition-all"
        >
          {song.coverUrl
            ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
            : <Music2 className="w-3.5 h-3.5 text-gray-600" />}
        </button>

        {/* title + artist — inline, single line */}
        <button type="button" onClick={onPlay} className="min-w-0 flex-1 text-left flex items-center gap-1.5 overflow-hidden">
          <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors truncate">{song.title || song.fileName}</span>
          <span className="text-[10px] text-gray-700 shrink-0 hidden group-hover:inline truncate">·</span>
          <span className="text-[10px] text-gray-600 truncate hidden group-hover:inline">{song.artist || 'Unknown'}</span>
        </button>

        {/* action buttons */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEditMetadata}
            className="p-0.5 text-gray-600 hover:text-violet-400 transition-colors"
            aria-label="Edit metadata"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-0.5 text-gray-600 hover:text-red-400 transition-colors"
            aria-label="Remove from queue"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }} />
          <div
            className="fixed z-[70] min-w-[170px] rounded-xl border border-white/12 bg-[#0e1016]/96 backdrop-blur-xl shadow-2xl py-1.5 overflow-hidden"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <button
              type="button"
              onClick={() => { onPlay(); setCtxMenu(null) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 transition-colors text-left"
            >
              Play now
            </button>
            <button
              type="button"
              onClick={() => { onEditMetadata(); setCtxMenu(null) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 transition-colors text-left"
            >
              <Pencil className="w-3.5 h-3.5 text-gray-500" />
              Edit metadata
            </button>
            <div className="h-px bg-white/10 mx-2 my-0.5" />
            <button
              type="button"
              onClick={() => { onRemove(); setCtxMenu(null) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
            >
              Remove from queue
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ManualQueueItem({ song, idx, onPlay, onRemove, onEditMetadata }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 group transition-colors hover:bg-white/[0.06]">
      <span className="text-[10px] text-gray-700 w-4 text-right shrink-0 tabular-nums">{idx + 1}</span>
      <button
        type="button"
        onClick={onPlay}
        className="w-8 h-8 rounded-md overflow-hidden bg-white/[0.05] flex items-center justify-center shrink-0 hover:ring-1 hover:ring-violet-400/40 transition-all"
      >
        {song.coverUrl
          ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
          : <Music2 className="w-3.5 h-3.5 text-gray-600" />}
      </button>
      <button type="button" onClick={onPlay} className="min-w-0 flex-1 text-left flex items-center gap-1.5 overflow-hidden">
        <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors truncate">{song.title || song.fileName}</span>
        <span className="text-[10px] text-gray-700 shrink-0 hidden group-hover:inline truncate">·</span>
        <span className="text-[10px] text-gray-600 truncate hidden group-hover:inline">{song.artist || 'Unknown'}</span>
      </button>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onEditMetadata}
          className="p-0.5 text-gray-600 hover:text-violet-400 transition-colors"
          aria-label="Edit metadata"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-0.5 text-gray-600 hover:text-red-400 transition-colors"
          aria-label="Remove from queue"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function UpNextPanel({ songs, currentTrackIndex, songQueue = [], onPlaySong, onRemoveSong, onRemoveFromManualQueue, onReorder, onEditMetadata }) {
  const queuedSongs = songQueue.map(id => songs.find(s => s.id === id)).filter(Boolean)
  const upNext = currentTrackIndex != null ? songs.slice(currentTrackIndex + 1) : []

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }) => {
    if (!active || !over || active.id === over.id) return
    const fromIdx = upNext.findIndex((s) => s.id === active.id)
    const toIdx = upNext.findIndex((s) => s.id === over.id)
    if (fromIdx !== -1 && toIdx !== -1) onReorder(fromIdx, toIdx)
  }

  if (queuedSongs.length === 0 && upNext.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Music2 className="w-6 h-6 text-gray-700" />
        <p className="text-xs text-gray-600">Queue is empty.</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {queuedSongs.length > 0 && (
        <div className="mb-1">
          <p className="text-[9px] uppercase tracking-widest text-gray-600 px-2 py-1">In queue</p>
          {queuedSongs.map((song, idx) => (
            <ManualQueueItem
              key={`q-${song.id}-${idx}`}
              song={song}
              idx={idx}
              onPlay={() => {
                const i = songs.findIndex(s => s.id === song.id)
                if (i !== -1) onPlaySong(i)
              }}
              onRemove={() => onRemoveFromManualQueue?.(idx)}
              onEditMetadata={() => onEditMetadata(song)}
            />
          ))}
        </div>
      )}
      {upNext.length > 0 && (
        <>
          {queuedSongs.length > 0 && (
            <p className="text-[9px] uppercase tracking-widest text-gray-600 px-2 py-1 mt-1">Next in playlist</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={upNext.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {upNext.slice(0, 20).map((song, idx) => (
                  <SortableQueueItem
                    key={song.id}
                    song={song}
                    idx={idx}
                    onPlay={() => onPlaySong(currentTrackIndex + 1 + idx)}
                    onRemove={() => onRemoveSong(idx)}
                    onEditMetadata={() => onEditMetadata(song)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  )
}

export default UpNextPanel
