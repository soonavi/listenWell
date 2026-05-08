import React, { useEffect, useMemo, useRef, useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import { Music2, Heart, Plus, Search } from 'lucide-react'

function SongsScreen({
  songs,
  selectedSongIndex,
  currentTrackIndex,
  isPlaying,
  selectedSong,
  songFilter,
  sortBy,
  onChangeSongFilter,
  onChangeSortBy,
  onAddSongQuick,
  onToggleLoved,
  lovedSongIds,
  playCounts = {},
  onSelectSong,
  onPlaySongClick,
  onGoToUpload,
  onUploadMore,
  onCoverUpload,
  onMetadataChange,
  onDeleteSong,
  onParallaxMove,
  onParallaxLeave,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const searchInputRef = useRef(null)
  const gridViewportRef = useRef(null)
  const normalizedQuery = searchQuery.trim().toLowerCase()

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
      if (event.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const visibleSongs = useMemo(() => [...songs]
    .filter((song) => (songFilter === 'loved' ? lovedSongIds.includes(song.id) : true))
    .filter((song) => {
      if (!normalizedQuery) return true
      const title = (song.title || song.fileName || '').toLowerCase()
      const artist = (song.artist || '').toLowerCase()
      const album = (song.album || '').toLowerCase()
      return title.includes(normalizedQuery) || artist.includes(normalizedQuery) || album.includes(normalizedQuery)
    })
    .sort((a, b) => {
      if (sortBy === 'title') return (a.title || a.fileName).localeCompare(b.title || b.fileName)
      if (sortBy === 'artist') return (a.artist || '').localeCompare(b.artist || '')
      if (sortBy === 'most-played') return (playCounts[b.id] || 0) - (playCounts[a.id] || 0)
      if (sortBy === 'discover') return (playCounts[a.id] || 0) - (playCounts[b.id] || 0)
      return 0
    }), [songs, songFilter, lovedSongIds, normalizedQuery, sortBy, playCounts])

  useEffect(() => {
    const viewport = gridViewportRef.current
    if (!viewport) return

    const measure = () => {
      setViewportHeight(viewport.clientHeight || 0)
      setViewportWidth(viewport.clientWidth || 0)
    }
    measure()

    const onScroll = () => setScrollTop(viewport.scrollTop)
    viewport.addEventListener('scroll', onScroll)

    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(viewport)
    window.addEventListener('resize', measure)

    return () => {
      viewport.removeEventListener('scroll', onScroll)
      resizeObserver.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [visibleSongs.length])

  const virtualColumns = viewportWidth >= 1024 ? 5 : viewportWidth >= 768 ? 4 : viewportWidth >= 640 ? 3 : 2
  const virtualGap = viewportWidth >= 640 ? 20 : 16
  const rowHeight = viewportWidth >= 640 ? 285 : 245
  const virtualItems = useMemo(() => [...visibleSongs, { id: '__upload__', uploadTile: true }], [visibleSongs])
  const rowCount = Math.ceil(virtualItems.length / virtualColumns)
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 1)
  const endRow = Math.min(rowCount - 1, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 1)
  const startIndex = startRow * virtualColumns
  const endIndex = Math.min(virtualItems.length, (endRow + 1) * virtualColumns)
  const renderedItems = virtualItems.slice(startIndex, endIndex)
  const paddingTop = startRow * rowHeight
  const paddingBottom = Math.max(0, (rowCount - endRow - 1) * rowHeight)

  return (
    <>
      <section className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="mb-3 shrink-0 flex flex-col gap-2">
          {/* Row 1: filter + sort + count */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter: All / Loved */}
            <div className="flex rounded-full border border-white/10 overflow-hidden text-xs bg-white/[0.02] shrink-0">
              <button
                type="button"
                onClick={() => onChangeSongFilter('all')}
                className={`px-3.5 py-1.5 transition-colors duration-150 ${songFilter === 'all' ? 'bg-violet-600/80 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onChangeSongFilter('loved')}
                className={`px-3.5 py-1.5 border-l border-white/10 transition-colors duration-150 flex items-center gap-1.5 ${songFilter === 'loved' ? 'bg-pink-600/70 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <Heart className="w-3 h-3" fill={songFilter === 'loved' ? 'currentColor' : 'none'} />
                Loved
              </button>
            </div>

            {/* Divider */}
            <span className="w-px h-4 bg-white/10 shrink-0" />

            {/* Sort */}
            <div className="flex rounded-full border border-white/10 overflow-hidden text-xs bg-white/[0.02] shrink-0">
              {[
                { id: 'default', label: 'Default' },
                { id: 'title', label: 'Title' },
                { id: 'artist', label: 'Artist' },
                { id: 'most-played', label: 'Most played' },
                { id: 'discover', label: 'Discover' },
              ].map((opt, i) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeSortBy(opt.id)}
                  className={`px-3.5 py-1.5 transition-colors duration-150 ${i > 0 ? 'border-l border-white/10' : ''} ${sortBy === opt.id ? 'bg-white/12 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Track count — pushed to the right */}
            <span className="ml-auto text-xs text-gray-600 tabular-nums whitespace-nowrap shrink-0">
              {visibleSongs.length} {songFilter === 'loved' ? 'loved ' : ''}track{visibleSongs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Row 2: search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ui-input w-full rounded-full pl-11 pr-20 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              placeholder="Search by title, artist, or album…"
              aria-label="Search songs"
            />
            {normalizedQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="ui-btn-secondary absolute right-2 top-1/2 -translate-y-1/2 text-xs rounded-full px-2.5 py-1"
              >
                Clear
              </button>
            ) : (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center pointer-events-none select-none px-1.5 py-0.5 rounded border border-white/12 bg-white/5 text-[11px] text-gray-600 font-mono">
                /
              </kbd>
            )}
          </div>
        </div>

        {visibleSongs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-500 gap-3">
            <span className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 inline-flex items-center justify-center text-violet-300/70"><Music2 className="w-6 h-6" /></span>
            <p>{normalizedQuery ? 'No songs match your search.' : songFilter === 'loved' ? 'No loved songs yet.' : 'No songs yet.'}</p>
            <button type="button" onClick={onGoToUpload} className="px-4 py-2 rounded-full bg-white text-black text-xs font-medium hover:bg-gray-100 transition">Upload music</button>
          </div>
        ) : (
          <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-sm pl-6 sm:pl-8 pr-3 sm:pr-4 py-3 sm:py-4 glass-card parallax-card song-grid-shell" onMouseMove={onParallaxMove} onMouseLeave={onParallaxLeave}>
            <div ref={gridViewportRef} className="h-full overflow-y-auto">
              <div style={{ paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px` }}>
                <div className="grid gap-4 sm:gap-5" style={{ gridTemplateColumns: `repeat(${virtualColumns}, minmax(0, 1fr))`, gap: `${virtualGap}px` }}>
              {renderedItems.map((song) => {
                if (song.uploadTile) {
                  return (
                    <label key="upload-tile" className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer p-1 transition-all duration-200">
                      <div className="w-full aspect-square rounded-xl bg-white/[0.04] border border-white/10 flex flex-col items-center justify-center gap-2 text-gray-300">
                        <span className="w-10 h-10 rounded-full border border-white/30 inline-flex items-center justify-center">
                          <Plus className="w-5 h-5" />
                        </span>
                        <span className="text-xs">Upload song</span>
                      </div>
                      <input
                        type="file"
                        accept="audio/*,video/webm,video/ogg,.webm,.ogg,.opus"
                        multiple
                        className="hidden"
                        onChange={onUploadMore}
                      />
                    </label>
                  )
                }
                const i = songs.findIndex((s) => s.id === song.id)
                return (
                <motion.button key={song.id} type="button" onClick={() => onSelectSong(i)} className={`relative flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-1.5 transition-all duration-200 song-tile ${i === selectedSongIndex ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#0c0c0e] bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`} whileHover={{ y: -4, scale: 1.03 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                  <div className="relative w-full aspect-square rounded-xl bg-white/[0.06] overflow-hidden flex items-center justify-center text-3xl shadow-inner">
                    {song.coverUrl ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music2 className="w-10 h-10 text-white/60" />}
                    {currentTrackIndex === i && isPlaying && (
                      <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50 animate-pulse" />
                    )}
                    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onPlaySongClick(i) }} className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg hover:scale-105 transition">
                        {currentTrackIndex === i && isPlaying ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> : <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium truncate text-white/95 flex-1">{song.title || song.fileName}</p>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onAddSongQuick(song.id) }} className="w-5 h-5 rounded-full border border-white/25 text-gray-200 inline-flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500 truncate">{song.artist || 'Unknown artist'}</p>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onToggleLoved(song.id) }} className={`inline-flex ${lovedSongIds.includes(song.id) ? 'text-pink-400' : 'text-gray-500'}`}><Heart className="w-3.5 h-3.5" fill={lovedSongIds.includes(song.id) ? 'currentColor' : 'none'} /></button>
                  </div>
                </motion.button>
              )})}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="w-full max-w-sm sm:max-w-md bg-white/[0.05] rounded-2xl border border-white/[0.08] p-5 flex flex-col gap-4 shrink-0 shadow-lg ml-1 sm:ml-2 glass-card parallax-card" onMouseMove={onParallaxMove} onMouseLeave={onParallaxLeave}>
        <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-gray-300">Details</h2>
        {selectedSong ? (
          <>
            <div className="flex gap-4 items-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white/[0.06] flex items-center justify-center text-2xl overflow-hidden shrink-0">
                {selectedSong.coverUrl ? <img src={selectedSong.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music2 className="w-8 h-8 text-white/60" />}
              </div>
              <div className="flex-1 min-w-0 text-xs text-gray-500">
                <p className="truncate mb-1">{selectedSong.fileName}</p>
                <label className="inline-flex items-center gap-2 cursor-pointer text-violet-400 hover:text-violet-300 text-xs font-medium">Change cover<input type="file" accept="image/*" className="hidden" onChange={onCoverUpload} /></label>
              </div>
            </div>
            {/* BPM + play count chips */}
            {(selectedSong.bpm || playCounts[selectedSong.id]) ? (
              <div className="flex gap-2 flex-wrap">
                {selectedSong.bpm && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-[11px] text-violet-300">
                    {Math.round(selectedSong.bpm)} BPM
                  </span>
                )}
                {playCounts[selectedSong.id] ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[11px] text-gray-400">
                    {playCounts[selectedSong.id]} {playCounts[selectedSong.id] === 1 ? 'play' : 'plays'}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-1"><label className="text-xs text-gray-500 font-medium">Title</label><input type="text" value={selectedSong.title} onChange={(e) => onMetadataChange('title', e.target.value)} className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" placeholder="Song title" /></div>
              <div className="flex flex-col gap-1"><label className="text-xs text-gray-500 font-medium">Artist</label><input type="text" value={selectedSong.artist} onChange={(e) => onMetadataChange('artist', e.target.value)} className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" placeholder="Artist name" /></div>
              <div className="flex flex-col gap-1"><label className="text-xs text-gray-500 font-medium">Album</label><input type="text" value={selectedSong.album} onChange={(e) => onMetadataChange('album', e.target.value)} className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" placeholder="Album name" /></div>
              <div className="flex flex-col gap-1"><label className="text-xs text-gray-500 font-medium">Description / notes</label><textarea value={selectedSong.description} onChange={(e) => onMetadataChange('description', e.target.value)} rows={2} className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none" placeholder="Optional notes" /></div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Lyrics</label>
                <textarea
                  value={selectedSong.lyrics || ''}
                  onChange={(e) => onMetadataChange('lyrics', e.target.value)}
                  rows={4}
                  className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white resize-none font-mono"
                  placeholder={"Paste plain or LRC lyrics here…\n[00:15.00] First line\n[00:20.50] Second line"}
                />
              </div>
            </div>
            {onDeleteSong && (
              <button
                type="button"
                onClick={() => onDeleteSong(selectedSong.id)}
                className="w-full text-center rounded-lg border border-red-500/20 text-red-400/70 text-xs py-1.5 hover:border-red-400/45 hover:bg-red-400/5 hover:text-red-300 transition mt-1"
              >
                Remove from library
              </button>
            )}
          </>
        ) : <p className="text-sm text-gray-500">Select a track to edit its details.</p>}
      </section>
    </>
  )
}

export default SongsScreen
