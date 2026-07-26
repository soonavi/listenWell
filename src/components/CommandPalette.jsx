import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Music2, ListMusic, CornerDownLeft } from 'lucide-react'

import { fuzzyRank } from '@/utils/fuzzySearch'

/**
 * Type-to-anywhere palette: songs, playlists and actions in one list.
 *
 * The instrument-room answer to navigation — no browsing required if you
 * already know what you want.
 */
function CommandPalette({ songs = [], playlists = [], actions = [], onClose }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const entries = useMemo(() => [
    ...actions.map((action) => ({
      kind: 'action',
      id: `action-${action.id}`,
      primary: action.label,
      secondary: action.hint || 'Action',
      run: action.run,
    })),
    ...songs.map((song) => ({
      kind: 'song',
      id: `song-${song.id}`,
      primary: song.title || song.fileName,
      secondary: song.artist || 'Unknown artist',
      coverUrl: song.coverUrl,
      run: song.run,
    })),
    ...playlists.map((playlist) => ({
      kind: 'playlist',
      id: `playlist-${playlist.id}`,
      primary: playlist.name,
      secondary: `${playlist.songIds?.length ?? 0} tracks`,
      run: playlist.run,
    })),
  ], [songs, playlists, actions])

  const results = useMemo(
    () => fuzzyRank(entries, query, (entry) => [entry.primary, entry.secondary], 30),
    [entries, query],
  )

  // A changed query invalidates the old highlight position.
  const [handledQuery, setHandledQuery] = useState(query)
  if (query !== handledQuery) {
    setHandledQuery(query)
    setActiveIndex(0)
  }

  const choose = (entry) => {
    if (!entry) return
    onClose()
    entry.run?.()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(results.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(results[activeIndex])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <div className="fixed inset-0 z-[180] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1117]/95 shadow-2xl glass-card overflow-hidden">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search songs, playlists and actions…"
          aria-label="Search songs, playlists and actions"
          className="w-full bg-transparent px-5 py-4 text-sm text-white placeholder:text-gray-600 border-b border-white/[0.06] focus:outline-none"
        />

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-5 py-6 text-xs text-gray-500 text-center">Nothing matches.</p>
          ) : results.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              data-active={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(entry)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                index === activeIndex ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
              }`}
            >
              <span className="w-8 h-8 rounded-md overflow-hidden bg-white/[0.06] flex items-center justify-center shrink-0">
                {entry.kind === 'song' && entry.coverUrl
                  ? <img src={entry.coverUrl} alt="" className="w-full h-full object-cover" />
                  : entry.kind === 'playlist'
                    ? <ListMusic className="w-3.5 h-3.5 text-gray-500" />
                    : entry.kind === 'song'
                      ? <Music2 className="w-3.5 h-3.5 text-gray-500" />
                      : <CornerDownLeft className="w-3.5 h-3.5 text-gray-500" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-white/90 truncate">{entry.primary}</span>
                <span className="block text-[11px] text-gray-500 truncate">{entry.secondary}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-3 text-[10px] text-gray-600">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
