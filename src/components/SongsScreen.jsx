import React from 'react'
import { motion } from 'framer-motion'
import { Music2 } from 'lucide-react'

function SongsScreen({
  songs,
  selectedSongIndex,
  currentTrackIndex,
  isPlaying,
  selectedSong,
  onSelectSong,
  onPlaySongClick,
  onGoToUpload,
  onCoverUpload,
  onMetadataChange,
  onParallaxMove,
  onParallaxLeave,
}) {
  return (
    <>
      {/* Left: Song Grid */}
      <section className="flex-1 flex flex-col overflow-hidden min-w-0">
        {songs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-500 gap-3">
            <p>No songs yet.</p>
            <button
              type="button"
              onClick={onGoToUpload}
              className="px-4 py-2 rounded-full bg-white text-black text-xs font-medium hover:bg-gray-100 transition"
            >
              Upload music
            </button>
          </div>
        ) : (
          <div
            className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-sm pl-6 sm:pl-8 pr-3 sm:pr-4 py-3 sm:py-4 glass-card parallax-card"
            onMouseMove={onParallaxMove}
            onMouseLeave={onParallaxLeave}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 overflow-y-auto">
              {songs.map((song, i) => (
                <motion.button
                  key={song.id}
                  type="button"
                  onClick={() => onSelectSong(i)}
                  className={`flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-1 transition-all duration-200 ${
                    i === selectedSongIndex
                      ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#0c0c0e] bg-white/[0.04]'
                      : 'hover:bg-white/[0.04]'
                  } ${i === currentTrackIndex ? 'opacity-100' : ''}`}
                  whileHover={{ y: -4, scale: 1.03 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <div className="relative w-full aspect-square rounded-xl bg-white/[0.06] overflow-hidden flex items-center justify-center text-3xl shadow-inner">
                    {song.coverUrl ? (
                      <img
                        src={song.coverUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music2 className="w-10 h-10 text-white/60" />
                    )}
                    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPlaySongClick(i)
                        }}
                        className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg hover:scale-105 transition"
                      >
                        {currentTrackIndex === i && isPlaying ? (
                          <svg
                            className="w-6 h-6"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </svg>
                        ) : (
                          <svg
                            className="w-6 h-6 ml-0.5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-medium truncate text-white/95">
                    {song.title || song.fileName}
                  </p>
                  {song.artist ? (
                    <p className="text-xs text-gray-500 truncate">
                      {song.artist}
                    </p>
                  ) : null}
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Right: Metadata Editor */}
      <section
        className="w-full max-w-sm sm:max-w-md bg-white/[0.05] rounded-2xl border border-white/[0.08] p-5 flex flex-col gap-4 shrink-0 shadow-lg ml-1 sm:ml-2 glass-card parallax-card"
        onMouseMove={onParallaxMove}
        onMouseLeave={onParallaxLeave}
      >
        <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-gray-300">
          Details
        </h2>
        {selectedSong ? (
          <>
            <div className="flex gap-4 items-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white/[0.06] flex items-center justify-center text-2xl overflow-hidden shrink-0">
                {selectedSong.coverUrl ? (
                  <img
                    src={selectedSong.coverUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music2 className="w-8 h-8 text-white/60" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-xs text-gray-500">
                <p className="truncate mb-1">{selectedSong.fileName}</p>
                <label className="inline-flex items-center gap-2 cursor-pointer text-violet-400 hover:text-violet-300 text-xs font-medium">
                  Change cover
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onCoverUpload}
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">
                  Title
                </label>
                <input
                  type="text"
                  value={selectedSong.title}
                  onChange={(e) => onMetadataChange('title', e.target.value)}
                  className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent"
                  placeholder="Song title"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">
                  Artist
                </label>
                <input
                  type="text"
                  value={selectedSong.artist}
                  onChange={(e) => onMetadataChange('artist', e.target.value)}
                  className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent"
                  placeholder="Artist name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">
                  Album
                </label>
                <input
                  type="text"
                  value={selectedSong.album}
                  onChange={(e) => onMetadataChange('album', e.target.value)}
                  className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent"
                  placeholder="Album name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">
                  Description / notes
                </label>
                <textarea
                  value={selectedSong.description}
                  onChange={(e) =>
                    onMetadataChange('description', e.target.value)
                  }
                  rows={3}
                  className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent resize-none"
                  placeholder="Optional notes"
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            Select a track to edit its details.
          </p>
        )}
      </section>
    </>
  )
}

export default SongsScreen
