import React, { useEffect, useMemo, useRef, useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import {
  Music2, X, Shuffle, SkipBack, SkipForward, Play, Pause,
  Repeat, Repeat1, Heart, Volume2, MicVocal, SlidersHorizontal,
} from 'lucide-react'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function parseLrc(lyrics) {
  if (!lyrics || !lyrics.trim()) return []
  const lines = []
  const lrcRe = /^\[(\d{1,2}):(\d{2})(?:[.:,](\d{1,3}))?\]\s*(.*)/
  for (const raw of lyrics.split('\n')) {
    const m = raw.trim().match(lrcRe)
    if (m) {
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0
      lines.push({
        time: parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + ms / 1000,
        text: m[4].trim(),
      })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

function NowPlayingOverlay({
  song,
  isPlaying,
  currentTime,
  duration,
  volume,
  shuffle,
  repeat,
  lovedSongIds,
  lyrics = '',
  onMetadataChange,
  onClose,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLoved,
}) {
  const [view, setView] = useState('controls') // 'controls' | 'lyrics'
  const isLoved = song ? lovedSongIds.includes(song.id) : false
  const lrcLines = useMemo(() => parseLrc(lyrics), [lyrics])
  const isLrc = lrcLines.length > 0
  const plainLines = useMemo(() => {
    if (isLrc) return []
    return lyrics.split('\n').map((t) => t.trim()).filter(Boolean)
  }, [lyrics, isLrc])

  const activeIndex = useMemo(() => {
    if (!isLrc || lrcLines.length === 0) return -1
    let idx = -1
    for (let i = 0; i < lrcLines.length; i++) {
      if (lrcLines[i].time <= currentTime) idx = i
      else break
    }
    return idx
  }, [lrcLines, currentTime, isLrc])

  const lyricsContainerRef = useRef(null)
  const activeLineRef = useRef(null)

  useEffect(() => {
    if (view !== 'lyrics' || !activeLineRef.current || !lyricsContainerRef.current) return
    activeLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex, view])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background layers */}
      <div className="absolute inset-0 bg-[#08090c]/88 backdrop-blur-3xl" />
      {song?.coverUrl && (
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `url(${song.coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(48px) saturate(180%)',
          }}
        />
      )}

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/40 transition-colors bg-white/[0.05]"
      >
        <X className="w-5 h-5" />
      </button>

      {/* View toggle — only show when lyrics exist */}
      {(lyrics && lyrics.trim()) && (
        <div className="absolute top-5 left-5 z-10 flex gap-1 rounded-full border border-white/15 bg-white/[0.05] p-1">
          <button
            type="button"
            onClick={() => setView('controls')}
            title="Player"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${view === 'controls' ? 'bg-white/15 text-white' : 'text-gray-600 hover:text-gray-300'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('lyrics')}
            title="Lyrics"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${view === 'lyrics' ? 'bg-white/15 text-white' : 'text-gray-600 hover:text-gray-300'}`}
          >
            <MicVocal className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── CONTROLS VIEW ── */}
      {view === 'controls' && (
        <div className="relative z-10 flex flex-col items-center gap-7 px-6 w-full max-w-[420px]">
          {/* Album art */}
          <motion.div
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, duration: 0.4, ease: 'easeOut' }}
            className="w-60 h-60 sm:w-72 sm:h-72 rounded-2xl overflow-hidden bg-white/[0.07] flex items-center justify-center shadow-2xl"
            style={{ boxShadow: '0 28px 80px rgba(0,0,0,0.65)' }}
          >
            {song?.coverUrl
              ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
              : <Music2 className="w-24 h-24 text-violet-300/50" />
            }
          </motion.div>

          {/* Song info */}
          <div className="text-center w-full">
            <div className="flex items-center justify-center gap-3 mb-1">
              <p className="text-xl font-semibold text-white truncate max-w-[300px]">
                {song?.title || song?.fileName || 'No song'}
              </p>
              {song && (
                <button
                  type="button"
                  onClick={() => onToggleLoved(song.id)}
                  className={`shrink-0 transition-colors ${isLoved ? 'text-pink-400' : 'text-gray-600 hover:text-gray-300'}`}
                >
                  <Heart className="w-5 h-5" fill={isLoved ? 'currentColor' : 'none'} />
                </button>
              )}
            </div>
            <p className="text-gray-400 text-sm">{song?.artist || 'Unknown artist'}</p>
            {song?.album && <p className="text-gray-600 text-xs mt-0.5">{song.album}</p>}
            {song?.bpm && <p className="text-gray-600 text-xs mt-1">{Math.round(song.bpm)} BPM</p>}
          </div>

          {/* Seek bar */}
          <div className="w-full flex flex-col gap-1.5">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.05}
              value={Math.min(currentTime, duration || 0)}
              onInput={onSeek}
              onChange={onSeek}
              className="w-full h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-7">
            <button
              type="button"
              onClick={onToggleShuffle}
              title={shuffle ? 'Shuffle on' : 'Shuffle off'}
              className={`transition-colors ${shuffle ? 'text-violet-400' : 'text-gray-600 hover:text-gray-300'}`}
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onPrev}
              className="text-gray-300 hover:text-white transition-colors"
            >
              <SkipBack className="w-7 h-7" />
            </button>
            <button
              type="button"
              onClick={onPlayPause}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              {isPlaying
                ? <Pause className="w-7 h-7" />
                : <Play className="w-7 h-7 ml-0.5" />
              }
            </button>
            <button
              type="button"
              onClick={onNext}
              className="text-gray-300 hover:text-white transition-colors"
            >
              <SkipForward className="w-7 h-7" />
            </button>
            <button
              type="button"
              onClick={onToggleRepeat}
              title={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
              className={`transition-colors ${repeat !== 'off' ? 'text-violet-400' : 'text-gray-600 hover:text-gray-300'}`}
            >
              {repeat === 'one'
                ? <Repeat1 className="w-5 h-5" />
                : <Repeat className="w-5 h-5" />
              }
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3 w-full max-w-xs">
            <Volume2 className="w-4 h-4 text-gray-600 shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onInput={onVolumeChange}
              onChange={onVolumeChange}
              className="flex-1 h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* ── LYRICS VIEW ── */}
      {view === 'lyrics' && (
        <div className="relative z-10 w-full max-w-[520px] h-[80vh] flex flex-col px-6">
          {/* Mini song header */}
          <div className="flex items-center gap-3 mb-5 shrink-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/[0.07] flex items-center justify-center shrink-0">
              {song?.coverUrl
                ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                : <Music2 className="w-5 h-5 text-violet-300/50" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{song?.title || song?.fileName}</p>
              <p className="text-xs text-gray-500 truncate">{song?.artist || 'Unknown artist'}</p>
            </div>
            <button
              type="button"
              onClick={onPlayPause}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
          </div>

          {/* Lyrics scroll area */}
          <div ref={lyricsContainerRef} className="flex-1 overflow-y-auto flex flex-col items-center gap-1 pb-24 scrollbar-none">
            {isLrc ? (
              lrcLines.map((line, i) => (
                <p
                  key={i}
                  ref={i === activeIndex ? activeLineRef : null}
                  className={`text-center text-lg font-semibold leading-relaxed transition-all duration-300 cursor-pointer hover:opacity-80 px-4 py-1 rounded-xl ${
                    i === activeIndex
                      ? 'text-white scale-105'
                      : i < activeIndex
                      ? 'text-gray-600 scale-100'
                      : 'text-gray-500 scale-100'
                  }`}
                  style={i === activeIndex ? { textShadow: '0 0 24px rgba(var(--accent-rgb),0.7)' } : {}}
                  onClick={() => onSeek({ target: { value: line.time } })}
                >
                  {line.text || '·'}
                </p>
              ))
            ) : plainLines.length > 0 ? (
              plainLines.map((line, i) => (
                <p
                  key={i}
                  className="text-center text-base text-gray-300 leading-relaxed px-4"
                >
                  {line}
                </p>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <MicVocal className="w-10 h-10 text-gray-700" />
                <p className="text-sm text-gray-500">No lyrics added yet.</p>
                <p className="text-xs text-gray-600 max-w-[240px]">
                  Select the song in the Songs tab and paste plain text or LRC-timestamped lyrics in the Details panel.
                </p>
              </div>
            )}
          </div>

          {/* Mini seek bar pinned to bottom */}
          <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3">
            <span className="text-xs text-gray-600 tabular-nums w-10 text-right shrink-0">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.05}
              value={Math.min(currentTime, duration || 0)}
              onInput={onSeek}
              onChange={onSeek}
              className="flex-1 h-1 rounded-full appearance-none bg-white/15 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="text-xs text-gray-600 tabular-nums w-10 shrink-0">{formatTime(duration)}</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default NowPlayingOverlay
