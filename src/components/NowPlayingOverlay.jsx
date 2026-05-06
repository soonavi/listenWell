import React from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import {
  Music2, X, Shuffle, SkipBack, SkipForward, Play, Pause,
  Repeat, Repeat1, Heart, Volume2,
} from 'lucide-react'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
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
  const isLoved = song ? lovedSongIds.includes(song.id) : false

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

      {/* Content */}
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
    </motion.div>
  )
}

export default NowPlayingOverlay
