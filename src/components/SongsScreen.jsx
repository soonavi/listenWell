import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion'
import { Music2, Heart, Plus, ChevronDown, Trash2, ListPlus, ListMusic, Pencil, Grid3x3, Grid2x2, Square, MoreVertical, Upload, CornerUpRight, Disc3, ArrowLeft, X, Download, ArrowDownToLine, CheckCircle2 } from 'lucide-react'
import { GooeyInput } from '@/components/ui/gooey-input'
import { groupByAlbum, groupByArtist, filterGroups } from '@/utils/grouping'

// Same list as UploadScreen — the explicit extensions matter on mobile pickers,
// which can gray out files that only match by extension, not MIME type.
const AUDIO_ACCEPT = 'audio/*,video/webm,video/ogg,.mp3,.m4a,.aac,.flac,.wav,.webm,.ogg,.opus'

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
  onToggleLoved,
  lovedSongIds,
  playCounts = {},
  playlists = [],
  onAddToQueue,
  onPlayNext,
  onBatchAddToQueue,
  onBatchAddToPlaylist,
  onBatchEdit,
  onBatchDelete,
  onDownloadSong,
  onToggleOffline,
  offlineSongIds = [],
  offlineBusyIds = [],
  onAddSongToPlaylist,
  onSelectSong,
  onPlaySongClick,
  onGoToUpload,
  onUploadMore,
  onCoverUpload,
  onMetadataChange,
  onDeleteSong,
  onParallaxMove,
  onParallaxLeave,
  onEditSong,
  songsBgUrl = null,
  songsBgBlur = 8,
  tileSize = 'medium',
  onChangeTileSize,
  searchFocusSignal = 0,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, songId, songIndex }
  const menuRef = useRef(null)
  const [sortOpen, setSortOpen] = useState(false)
  // 'songs' | 'albums' | 'artists'. Album and artist views are derived straight
  // from the tags — drilling into one narrows the same song grid below.
  const [browseMode, setBrowseMode] = useState('songs')
  const [focusedGroupKey, setFocusedGroupKey] = useState(null)
  // Multi-select. `anchor` is the last plainly-clicked row, so Shift can extend
  // a range from it the way file managers do.
  const [selectedIds, setSelectedIds] = useState([])
  const [selectionAnchor, setSelectionAnchor] = useState(null)
  const [bgMouse, setBgMouse] = useState({ x: 50, y: 50 })
  const sortRef = useRef(null)
  const gridViewportRef = useRef(null)
  const normalizedQuery = searchQuery.trim().toLowerCase()

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return
    const close = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [sortOpen])

  // Close context menu on any click/scroll
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [contextMenu])

  const groups = useMemo(() => {
    if (browseMode === 'albums') return groupByAlbum(songs)
    if (browseMode === 'artists') return groupByArtist(songs)
    return []
  }, [browseMode, songs])

  const visibleGroups = useMemo(() => filterGroups(groups, searchQuery), [groups, searchQuery])
  const focusedGroup = useMemo(
    () => (focusedGroupKey ? groups.find((g) => g.key === focusedGroupKey) ?? null : null),
    [groups, focusedGroupKey],
  )

  // Leaving a browse mode shouldn't strand the view inside a group that no
  // longer exists in it.
  if (browseMode === 'songs' && focusedGroupKey !== null) setFocusedGroupKey(null)

  const visibleSongs = useMemo(() => [...songs]
    .filter((song) => (focusedGroup ? focusedGroup.songs.some((s) => s.id === song.id) : true))
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
    }), [songs, focusedGroup, songFilter, lovedSongIds, normalizedQuery, sortBy, playCounts])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // Ctrl/Cmd toggles one, Shift extends from the anchor, a plain click opens
  // the song as before. Selection is ordered by the visible list so batch
  // actions apply in the order the listener sees.
  const handleTileClick = (event, song, songIndex) => {
    if (event.shiftKey && selectionAnchor) {
      event.preventDefault()
      const from = visibleSongs.findIndex((s) => s.id === selectionAnchor)
      const to = visibleSongs.findIndex((s) => s.id === song.id)
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from]
        const range = visibleSongs.slice(lo, hi + 1).map((s) => s.id)
        setSelectedIds((prev) => [...new Set([...prev, ...range])])
        return
      }
    }
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault()
      setSelectedIds((prev) => (
        prev.includes(song.id) ? prev.filter((id) => id !== song.id) : [...prev, song.id]
      ))
      setSelectionAnchor(song.id)
      return
    }
    setSelectionAnchor(song.id)
    if (selectedIds.length > 0) setSelectedIds([])
    onSelectSong(songIndex)
  }

  const clearSelection = () => { setSelectedIds([]); setSelectionAnchor(null) }

  useEffect(() => {
    const viewport = gridViewportRef.current
    if (!viewport) return
    const measure = () => {
      setViewportHeight(viewport.clientHeight || 0)
      setViewportWidth(viewport.clientWidth || 0)
    }
    measure()
    // Coalesce scroll events to one state update per frame so fast scrolling
    // doesn't fire a render per wheel tick.
    let scrollRaf = null
    const onScroll = () => {
      if (scrollRaf) return
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null
        setScrollTop(viewport.scrollTop)
      })
    }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(viewport)
    window.addEventListener('resize', measure)
    return () => {
      if (scrollRaf) cancelAnimationFrame(scrollRaf)
      viewport.removeEventListener('scroll', onScroll)
      resizeObserver.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [visibleSongs.length])

  // Tile height is art (colWidth - 20px padding) + text block (60px incl. padding);
  // row stride adds the grid gap
  const baseColumns = viewportWidth >= 1024 ? 5 : viewportWidth >= 768 ? 4 : viewportWidth >= 640 ? 3 : 2
  const virtualColumns = tileSize === 'small' ? baseColumns + 1 : tileSize === 'large' ? Math.max(1, baseColumns - 1) : baseColumns
  const virtualGap = viewportWidth >= 640 ? 20 : 16
  // Inner padding on the scroll viewport so hover-scaled tiles and selection
  // rings have room and aren't clipped at the edges. `viewportWidth` is the
  // viewport's clientWidth (includes this padding), so subtract it back out
  // before sizing columns.
  const GRID_PAD = 12
  const innerWidth = Math.max(0, viewportWidth - GRID_PAD * 2)
  const colWidth = innerWidth > 0 ? (innerWidth - virtualGap * (virtualColumns - 1)) / virtualColumns : 220
  const rowHeight = Math.round(colWidth + 60 + virtualGap)
  const virtualItems = useMemo(() => [...visibleSongs, { id: '__upload__', uploadTile: true }], [visibleSongs])
  const rowCount = Math.ceil(virtualItems.length / virtualColumns)
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 1)
  const endRow = Math.min(rowCount - 1, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 1)
  const startIndex = startRow * virtualColumns
  const endIndex = Math.min(virtualItems.length, (endRow + 1) * virtualColumns)
  const renderedItems = virtualItems.slice(startIndex, endIndex)
  const paddingTop = startRow * rowHeight
  const paddingBottom = Math.max(0, (rowCount - endRow - 1) * rowHeight)

  const openContextMenu = (e, song, i) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, songId: song.id, songIndex: i })
  }

  // Position the menu once it has actually rendered.
  //
  // The previous clamp subtracted a hard-coded 240px guess for the menu's
  // height, but the menu grows with the playlist list, so a user with more than
  // a couple of playlists got a panel far taller than the guess. window
  // .innerHeight also ignores the mobile browser's collapsing URL bar and the
  // home-indicator safe area. Between the two, tapping the ⋮ near the bottom of
  // a song list opened a menu whose lower half sat off-screen and unreachable.
  // Measuring the real panel against the visual viewport fixes both cases, and
  // the max-height below lets a genuinely long menu scroll instead of overflow.
  //
  // The placement is written straight to the node rather than held in state:
  // it's a one-way push to the DOM after React has painted, so routing it back
  // through a setState would only buy an extra render pass.
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!contextMenu || !el) return
    const vv = window.visualViewport
    const vw = vv?.width ?? window.innerWidth
    const vh = vv?.height ?? window.innerHeight
    const margin = 8
    const { width, height } = el.getBoundingClientRect()
    el.style.left = `${Math.max(margin, Math.min(contextMenu.x, vw - width - margin))}px`
    el.style.top = `${Math.max(margin, Math.min(contextMenu.y, vh - height - margin))}px`
    el.style.visibility = 'visible'
  }, [contextMenu])

  return (
    <>
      <section className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="mb-3 shrink-0 flex items-center gap-2">
          {/* Sort dropdown */}
          <div className="relative shrink-0" ref={sortRef}>
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#9ca3af' }}
              className="border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs rounded-full pl-3.5 pr-2.5 py-1.5 transition-colors"
            >
              {{ default: 'Default', title: 'Title', artist: 'Artist', 'most-played': 'Most played', discover: 'Discover' }[sortBy]}
              <motion.span animate={{ rotate: sortOpen ? 180 : 0 }} transition={{ duration: 0.18 }} style={{ display: 'flex' }}>
                <ChevronDown className="w-3 h-3" />
              </motion.span>
            </button>

            <AnimatePresence>
              {sortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute left-0 top-full mt-1.5 z-50 min-w-[130px] rounded-xl border border-white/10 bg-[#13111a] backdrop-blur-xl shadow-xl shadow-black/50 overflow-hidden"
                >
                  {[
                    { value: 'default', label: 'Default' },
                    { value: 'title', label: 'Title' },
                    { value: 'artist', label: 'Artist' },
                    { value: 'most-played', label: 'Most played' },
                    { value: 'discover', label: 'Discover' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { onChangeSortBy(value); setSortOpen(false) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', color: sortBy === value ? '#a78bfa' : '#9ca3af' }}
                      className={`text-xs transition-colors hover:bg-white/[0.06] ${sortBy === value ? 'bg-violet-500/10' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Browse mode */}
          <div className="shrink-0 flex items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5" role="group" aria-label="Browse by">
            {[
              { value: 'songs', label: 'Songs' },
              { value: 'albums', label: 'Albums' },
              { value: 'artists', label: 'Artists' },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={browseMode === value}
                onClick={() => { setBrowseMode(value); setFocusedGroupKey(null) }}
                className={`px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                  browseMode === value ? 'bg-violet-500/15 text-violet-300' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Loved filter */}
          {onChangeSongFilter && (
            <button
              type="button"
              title={songFilter === 'loved' ? 'Show all songs' : 'Show loved songs only'}
              aria-label={songFilter === 'loved' ? 'Show all songs' : 'Show loved songs only'}
              aria-pressed={songFilter === 'loved'}
              onClick={() => onChangeSongFilter(songFilter === 'loved' ? 'all' : 'loved')}
              className={`shrink-0 p-2 rounded-full border transition-colors ${
                songFilter === 'loved'
                  ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                  : 'border-white/10 bg-white/[0.04] text-gray-500 hover:text-gray-300'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${songFilter === 'loved' ? 'fill-current' : ''}`} />
            </button>
          )}

          {/* Tile size */}
          {onChangeTileSize && (
            <div className="shrink-0 flex items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5" role="group" aria-label="Tile size">
              {[
                { value: 'small', label: 'Small tiles', Icon: Grid3x3 },
                { value: 'medium', label: 'Medium tiles', Icon: Grid2x2 },
                { value: 'large', label: 'Large tiles', Icon: Square },
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={tileSize === value}
                  onClick={() => onChangeTileSize(value)}
                  className={`p-1.5 rounded-full transition-colors ${tileSize === value ? 'bg-violet-500/15 text-violet-300' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="flex-1 flex items-center justify-end">
            <GooeyInput
              placeholder="Search…"
              value={searchQuery}
              onValueChange={setSearchQuery}
              focusSignal={searchFocusSignal}
              collapsedWidth={44}
              expandedWidth={220}
              classNames={{
                trigger: 'bg-white/[0.05] text-gray-400 ring-white/[0.12] !px-2.5 hover:ring-white/25 focus-visible:ring-white/30 focus-visible:ring-offset-0',
                bubbleSurface: 'bg-white/[0.05] ring-white/[0.12]',
                input: 'gooey-search-input text-[#f3f4f6] placeholder:text-[#6b7280] text-xs',
              }}
            />
          </div>

          {/* Count — of groups while browsing, of tracks once inside one */}
          <span className="text-xs text-gray-600 tabular-nums whitespace-nowrap shrink-0">
            {browseMode !== 'songs' && !focusedGroup
              ? `${visibleGroups.length} ${browseMode === 'albums' ? 'album' : 'artist'}${visibleGroups.length === 1 ? '' : 's'}`
              : `${visibleSongs.length} track${visibleSongs.length === 1 ? '' : 's'}`}
          </span>

          {/* Upload — mobile only; desktop has the grid's upload tile */}
          <label
            aria-label="Upload songs"
            className="sm:hidden shrink-0 w-8 h-8 rounded-full border border-white/10 bg-white/[0.04] active:bg-white/[0.08] flex items-center justify-center text-gray-400 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <input type="file" accept={AUDIO_ACCEPT} multiple className="hidden" onChange={onUploadMore} />
          </label>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 rounded-xl border border-cyan-400/30 bg-cyan-400/[0.06] px-3 py-2">
            <span className="text-xs text-cyan-200 tabular-nums">
              {selectedIds.length} selected
            </span>
            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => { onBatchAddToQueue?.(selectedIds); clearSelection() }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] text-gray-200 border border-white/15 hover:border-white/40 transition-colors"
              >
                Add to queue
              </button>
              <div className="relative">
                <select
                  aria-label="Add selection to playlist"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    onBatchAddToPlaylist?.(selectedIds, e.target.value)
                    clearSelection()
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] text-gray-200 border border-white/15 bg-[#0f1117] hover:border-white/40 transition-colors focus:outline-none"
                >
                  <option value="">Add to playlist…</option>
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => { onBatchEdit?.(selectedIds); }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] text-gray-200 border border-white/15 hover:border-white/40 transition-colors"
              >
                Edit fields
              </button>
              <button
                type="button"
                onClick={() => { onBatchDelete?.(selectedIds); clearSelection() }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] text-red-300 border border-red-400/30 hover:border-red-400/60 transition-colors"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Clear selection"
                className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/40 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {focusedGroup && (
          <div className="flex items-center gap-2 shrink-0 -mt-1">
            <button
              type="button"
              onClick={() => setFocusedGroupKey(null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-white/15 text-[11px] text-gray-300 hover:border-white/40 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              All {browseMode === 'albums' ? 'albums' : 'artists'}
            </button>
            <span className="text-xs text-gray-300 truncate">
              {browseMode === 'albums' ? focusedGroup.album : focusedGroup.artist}
            </span>
            {browseMode === 'albums' && (
              <span className="text-[11px] text-gray-600 truncate">· {focusedGroup.artist}</span>
            )}
          </div>
        )}

        {browseMode !== 'songs' && !focusedGroup ? (
          visibleGroups.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-500 gap-3">
              <Disc3 className="w-9 h-9 text-gray-700" />
              <p>{normalizedQuery ? 'Nothing matches your search.' : 'No songs yet.'}</p>
            </div>
          ) : (
            <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-sm px-3 sm:px-4 py-3 sm:py-4 glass-card overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                {visibleGroups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setFocusedGroupKey(group.key)}
                    className="flex flex-col gap-2 text-left rounded-2xl p-2 transition-colors hover:bg-white/[0.04] group"
                  >
                    <div className={`w-full aspect-square overflow-hidden bg-white/[0.05] border border-white/10 flex items-center justify-center ${browseMode === 'artists' ? 'rounded-full' : 'rounded-xl'}`}>
                      {group.coverUrl
                        ? <img src={group.coverUrl} alt="" className="w-full h-full object-cover" />
                        : <Disc3 className="w-8 h-8 text-gray-700" />}
                    </div>
                    <p className="text-sm font-medium truncate text-white/90">
                      {browseMode === 'albums' ? group.album : group.artist}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {browseMode === 'albums'
                        ? group.artist
                        : `${group.albums.length} album${group.albums.length === 1 ? '' : 's'}`}
                      {' · '}
                      {group.songs.length} track{group.songs.length === 1 ? '' : 's'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )
        ) : visibleSongs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-500 gap-3">
            <span className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 inline-flex items-center justify-center"><img src="./logo.svg" alt="Listenwell" className="w-7 h-7 opacity-70" /></span>
            <p>{normalizedQuery ? 'No songs match your search.' : songFilter === 'loved' ? 'No loved songs yet.' : 'No songs yet.'}</p>
            {/* Uploading isn't the way out of an empty loved-songs filter — clearing it is. */}
            {songFilter === 'loved' && !normalizedQuery ? (
              <button type="button" onClick={() => onChangeSongFilter('all')} className="px-4 py-2 rounded-full bg-white text-black text-xs font-medium hover:bg-gray-100 transition">Show all songs</button>
            ) : (
              <button type="button" onClick={onGoToUpload} className="px-4 py-2 rounded-full bg-white text-black text-xs font-medium hover:bg-gray-100 transition">Upload music</button>
            )}
          </div>
        ) : (
          <div
            className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-sm px-3 sm:px-4 py-3 sm:py-4 glass-card parallax-card song-grid-shell relative overflow-hidden"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              setBgMouse({ x: (e.clientX - rect.left) / rect.width * 100, y: (e.clientY - rect.top) / rect.height * 100 })
              onParallaxMove(e)
            }}
            onMouseLeave={(e) => { setBgMouse({ x: 50, y: 50 }); onParallaxLeave(e) }}
          >
            {songsBgUrl && (
              <div
                aria-hidden
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                  backgroundImage: `url(${songsBgUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: `blur(${songsBgBlur}px)`,
                  transform: `translate(${(bgMouse.x - 50) * -0.04}%, ${(bgMouse.y - 50) * -0.04}%) scale(1.08)`,
                  transition: 'transform 200ms ease-out',
                }}
              />
            )}
            <div ref={gridViewportRef} className="h-full overflow-y-auto relative z-[1] px-3 pt-3 pb-3">
              <div style={{ paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px` }}>
                <div className="grid" style={{ gridTemplateColumns: `repeat(${virtualColumns}, minmax(0, 1fr))`, gap: `${virtualGap}px` }}>
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
                      <input type="file" accept={AUDIO_ACCEPT} multiple className="hidden" onChange={onUploadMore} />
                    </label>
                  )
                }
                const i = songs.findIndex((s) => s.id === song.id)
                return (
                <motion.div
                  key={song.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${song.title || song.fileName} details`}
                  onClick={(e) => handleTileClick(e, song, i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSong(i) } }}
                  onContextMenu={(e) => openContextMenu(e, song, i)}
                  aria-selected={selectedSet.has(song.id)}
                  className={`relative flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-2.5 transition-all duration-200 song-tile ${
                    selectedSet.has(song.id)
                      ? 'ring-2 ring-cyan-400/70 ring-offset-2 ring-offset-[#0c0c0e] bg-cyan-400/10'
                      : i === selectedSongIndex
                        ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#0c0c0e] bg-white/[0.08]'
                        : 'hover:bg-white/[0.04]'
                  }`}
                  whileHover={{ y: -4, scale: 1.03 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <div className="relative w-full aspect-square rounded-xl bg-white/[0.06] overflow-hidden flex items-center justify-center text-3xl shadow-inner">
                    {song.coverUrl ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music2 className="w-10 h-10 text-white/60" />}
                    {currentTrackIndex === i && isPlaying && (
                      <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50 animate-pulse" />
                    )}
                    <div className="tile-play-overlay absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onPlaySongClick(i) }} className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg hover:scale-105 transition">
                        {currentTrackIndex === i && isPlaying
                          ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                          : <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-medium truncate text-white/95">{song.title || song.fileName}</p>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs text-gray-500 truncate flex-1">{song.artist || 'Unknown artist'}</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleLoved(song.id) }}
                      className={`inline-flex shrink-0 p-0.5 ${lovedSongIds.includes(song.id) ? 'text-pink-400' : 'text-gray-600 hover:text-gray-400'}`}
                      aria-label={lovedSongIds.includes(song.id) ? 'Unlove' : 'Love'}
                    >
                      <Heart className="w-5 h-5" fill={lovedSongIds.includes(song.id) ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => openContextMenu(e, song, i)}
                      className="inline-flex shrink-0 p-0.5 text-gray-500 hover:text-white transition-colors"
                      aria-label="Song options"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )})}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="w-full max-w-sm sm:max-w-md bg-white/[0.05] rounded-2xl border border-white/[0.08] p-5 hidden lg:flex flex-col gap-4 shrink-0 shadow-lg ml-1 sm:ml-2 glass-card parallax-card" onMouseMove={onParallaxMove} onMouseLeave={onParallaxLeave}>
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

      {/* Right-click context menu — glassmorphism */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="menu-panel fixed z-[400] min-w-[220px] max-w-[calc(100vw-1rem)] max-h-[70vh] overflow-y-auto overscroll-contain rounded-2xl border border-white/15 backdrop-blur-2xl p-1.5 flex flex-col gap-0.5"
          // Hidden for the first paint; the layout effect above measures the
          // panel, places it and reveals it before the browser draws, so the
          // user never sees the unpositioned frame.
          style={{ left: 0, top: 0, visibility: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pt-1.5 pb-1">
            <p className="text-[11px] font-medium text-gray-500">Track actions</p>
          </div>
          <button
            type="button"
            onClick={() => { onPlayNext?.(contextMenu.songId); setContextMenu(null) }}
            className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-3 py-2.5 text-sm text-white transition-colors text-left"
          >
            <CornerUpRight className="w-4 h-4 shrink-0 text-gray-500" />
            Play next
          </button>
          <button
            type="button"
            onClick={() => { onAddToQueue?.(contextMenu.songId); setContextMenu(null) }}
            className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-3 py-2.5 text-sm text-white transition-colors text-left"
          >
            <ListPlus className="w-4 h-4 shrink-0 text-gray-500" />
            Add to queue
          </button>
          <button
            type="button"
            onClick={() => { onEditSong?.(contextMenu.songIndex); setContextMenu(null) }}
            className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-3 py-2.5 text-sm text-white transition-colors text-left"
          >
            <Pencil className="w-4 h-4 shrink-0 text-gray-500" />
            Edit metadata
          </button>
          <button
            type="button"
            onClick={() => { onDownloadSong?.(contextMenu.songId); setContextMenu(null) }}
            className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-3 py-2.5 text-sm text-white transition-colors text-left"
          >
            <Download className="w-4 h-4 shrink-0 text-gray-500" />
            Download
          </button>
          <button
            type="button"
            disabled={offlineBusyIds.includes(contextMenu.songId)}
            onClick={() => { onToggleOffline?.(contextMenu.songId); setContextMenu(null) }}
            className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-3 py-2.5 text-sm text-white transition-colors text-left disabled:opacity-50"
          >
            {offlineSongIds.includes(contextMenu.songId)
              ? <CheckCircle2 className="w-4 h-4 shrink-0 text-cyan-400" />
              : <ArrowDownToLine className="w-4 h-4 shrink-0 text-gray-500" />}
            {offlineBusyIds.includes(contextMenu.songId)
              ? 'Working…'
              : offlineSongIds.includes(contextMenu.songId) ? 'Remove from device' : 'Keep offline'}
          </button>
          <div className="h-px bg-white/[0.07] mx-2 my-0.5" />
          <div className="px-3 py-1">
            <p className="text-[11px] font-medium text-gray-500">Add to playlist</p>
          </div>
          <button
            type="button"
            onClick={() => { onToggleLoved?.(contextMenu.songId); setContextMenu(null) }}
            className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-3 py-2.5 text-sm text-white transition-colors text-left"
          >
            <Heart className={`w-3.5 h-3.5 shrink-0 ${lovedSongIds.includes(contextMenu.songId) ? 'text-pink-400' : 'text-gray-600'}`} fill={lovedSongIds.includes(contextMenu.songId) ? 'currentColor' : 'none'} />
            Loved Songs
            {lovedSongIds.includes(contextMenu.songId) && <span className="ml-auto text-[10px] text-gray-500">Added</span>}
          </button>
          {playlists.length > 0 && (
            <>
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => { onAddSongToPlaylist?.(contextMenu.songId, pl.id); setContextMenu(null) }}
                  className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-3 py-2.5 text-sm text-white transition-colors text-left"
                >
                  <ListMusic className="w-3.5 h-3.5 shrink-0 text-gray-600" />
                  {pl.name}
                </button>
              ))}
            </>
          )}
          <div className="h-px bg-white/[0.07] mx-2 my-0.5" />
          <button
            type="button"
            onClick={() => { onDeleteSong?.(contextMenu.songId); setContextMenu(null) }}
            className="w-full flex items-center gap-3 rounded-xl hover:bg-red-500/10 px-3 py-2.5 text-sm text-red-400 transition-colors text-left"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            Remove track
          </button>
        </div>
      )}
    </>
  )
}

export default SongsScreen
