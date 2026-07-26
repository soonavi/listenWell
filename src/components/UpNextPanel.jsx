import React, { useLayoutEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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

function SortableQueueItem({ id, song, idx, onPlay, onRemove, onEditMetadata }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const [ctxMenu, setCtxMenu] = useState(null)
  const ctxRef = useRef(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  const openCtx = (e) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  // Same measure-then-place pass as the songs grid: the old clamp guessed a
  // 100px menu height against window.innerHeight, which is both too small for
  // this three-item menu and blind to mobile browser chrome, so opening it low
  // in the queue pushed the Remove item off the bottom of the screen.
  useLayoutEffect(() => {
    const el = ctxRef.current
    if (!ctxMenu || !el) return
    const vv = window.visualViewport
    const vw = vv?.width ?? window.innerWidth
    const vh = vv?.height ?? window.innerHeight
    const margin = 8
    const { width, height } = el.getBoundingClientRect()
    el.style.left = `${Math.max(margin, Math.min(ctxMenu.x, vw - width - margin))}px`
    el.style.top = `${Math.max(margin, Math.min(ctxMenu.y, vh - height - margin))}px`
    el.style.visibility = 'visible'
  }, [ctxMenu])

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        className={`flex items-center gap-1.5 rounded-xl pr-1.5 py-1.5 group transition-colors ${isDragging ? 'bg-white/[0.1]' : 'hover:bg-white/[0.06]'}`}
        onContextMenu={openCtx}
      >
        {/* drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="touch-none shrink-0 text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing p-2 -my-1 transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* index */}
        <span className="text-[10px] text-gray-700 w-4 text-right shrink-0 tabular-nums">{idx + 1}</span>

        {/* cover */}
        <button
          type="button"
          onClick={onPlay}
          className="w-9 h-9 rounded-md overflow-hidden bg-white/[0.05] flex items-center justify-center shrink-0 hover:ring-1 hover:ring-violet-400/40 transition-all"
        >
          {song.coverUrl
            ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
            : <Music2 className="w-3.5 h-3.5 text-gray-600" />}
        </button>

        {/* title + artist */}
        <button type="button" onClick={onPlay} className="min-w-0 flex-1 text-left overflow-hidden pl-1">
          <span className="block text-xs font-medium text-gray-300 group-hover:text-white transition-colors truncate">{song.title || song.fileName}</span>
          <span className="block text-[10px] text-gray-500 truncate">{song.artist || 'Unknown artist'}</span>
        </button>

        {/* action buttons — always visible on touch, hover-revealed on desktop */}
        <div className="flex items-center shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEditMetadata}
            className="p-1.5 text-gray-500 hover:text-violet-400 transition-colors"
            aria-label="Edit metadata"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
            aria-label="Remove from queue"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }} />
          <div
            ref={ctxRef}
            className="fixed z-[70] min-w-[170px] max-w-[calc(100vw-1rem)] max-h-[70vh] overflow-y-auto overscroll-contain rounded-xl border border-white/12 bg-[#0e1016]/96 backdrop-blur-xl shadow-2xl py-1.5"
            style={{ left: 0, top: 0, visibility: 'hidden' }}
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

function UpNextPanel({ songs, currentTrackIndex, songQueue = [], onPlaySong, onRemoveSong, onRemoveFromManualQueue, onReorder, onReorderManualQueue, onEditMetadata }) {
  const queuedSongs = songQueue.map(id => songs.find(s => s.id === id)).filter(Boolean)
  const upNext = currentTrackIndex != null ? songs.slice(currentTrackIndex + 1) : []

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }) => {
    if (!active || !over || active.id === over.id) return
    const fromIdx = upNext.findIndex((s) => s.id === active.id)
    const toIdx = upNext.findIndex((s) => s.id === over.id)
    if (fromIdx !== -1 && toIdx !== -1) onReorder(fromIdx, toIdx)
  }

  // Manual-queue ids are index-composite so duplicate songs stay distinct
  const manualIds = queuedSongs.map((s, i) => `m-${i}-${s.id}`)
  const handleManualDragEnd = ({ active, over }) => {
    if (!active || !over || active.id === over.id) return
    const fromIdx = manualIds.indexOf(active.id)
    const toIdx = manualIds.indexOf(over.id)
    if (fromIdx !== -1 && toIdx !== -1) onReorderManualQueue?.(fromIdx, toIdx)
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
          <p className="text-[11px] font-medium text-gray-500 px-2 py-1">In queue</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleManualDragEnd}>
            <SortableContext items={manualIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {queuedSongs.map((song, idx) => (
                  <SortableQueueItem
                    key={manualIds[idx]}
                    id={manualIds[idx]}
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
            </SortableContext>
          </DndContext>
        </div>
      )}
      {upNext.length > 0 && (
        <>
          {queuedSongs.length > 0 && (
            <p className="text-[11px] font-medium text-gray-500 px-2 py-1 mt-1">Next in playlist</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={upNext.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {upNext.slice(0, 20).map((song, idx) => (
                  <SortableQueueItem
                    key={song.id}
                    id={song.id}
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
