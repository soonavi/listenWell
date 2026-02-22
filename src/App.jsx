import { useState, useRef, useEffect } from 'react'
import './App.css'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function App() {
  const [songs, setSongs] = useState([])
  const [selectedSongIndex, setSelectedSongIndex] = useState(null)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.75)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [eqPreset, setEqPreset] = useState('normal') // 'normal' | 'bass' | 'bright'
  const [activePage, setActivePage] = useState('upload') // 'upload' | 'songs' | 'playlists'
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('playback') // 'playback' | 'appearance'
  const audioRef = useRef(null)

  const handleUpload = (e) => {
    const files = Array.from(e.target.files || [])
    const audioFiles = files.filter((f) => f.type.startsWith('audio/'))

    if (audioFiles.length === 0) return

    const newSongs = audioFiles.map((f) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${f.name}-${Date.now()}`,
      title: f.name.replace(/\.[^/.]+$/, ''),
      fileName: f.name,
      url: URL.createObjectURL(f),
      artist: '',
      album: '',
      coverUrl: null,
      description: '',
    }))

    setSongs((prev) => [...prev, ...newSongs])
    if (selectedSongIndex === null) {
      setSelectedSongIndex(0)
      setCurrentTrackIndex(0)
      setActivePage('songs')
    }
  }

  const handleSelectSong = (index) => {
    setSelectedSongIndex(index)
    setCurrentTrackIndex(index)
  }

  // Load track only when the active track index or its URL changes (not when other metadata changes)
  const currentTrackUrl = songs[currentTrackIndex]?.url ?? null
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || currentTrackIndex == null || !currentTrackUrl) return
    audio.src = currentTrackUrl
    audio.volume = volume
    setCurrentTime(0)
    setDuration(0)
    if (isPlaying) audio.play().catch(() => setIsPlaying(false))
  }, [currentTrackIndex, currentTrackUrl])

  // Keep volume in sync with audio element
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
  }, [volume])

  // Keep playback speed in sync with audio element
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.playbackRate = playbackRate
  }, [playbackRate])

  const handlePlayPause = () => {
    const audio = audioRef.current
    if (!audio || currentTrackIndex == null) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(() => {})
    }
    setIsPlaying(!isPlaying)
  }

  const handlePrev = () => {
    if (songs.length === 0) return
    const next = currentTrackIndex === null ? 0 : (currentTrackIndex - 1 + songs.length) % songs.length
    setCurrentTrackIndex(next)
    setSelectedSongIndex(next)
    setIsPlaying(true)
  }

  const handleNext = () => {
    if (songs.length === 0) return
    const next = currentTrackIndex === null ? 0 : (currentTrackIndex + 1) % songs.length
    setCurrentTrackIndex(next)
    setSelectedSongIndex(next)
    setIsPlaying(true)
  }

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const pct = Number(e.target.value) / 100
    const t = pct * duration
    audio.currentTime = t
    setCurrentTime(t)
  }

  const handleVolumeChange = (e) => {
    const v = Number(e.target.value)
    setVolume(v)
  }

  const nowPlaying = currentTrackIndex != null ? songs[currentTrackIndex] : null

  const handleMetadataChange = (field, value) => {
    setSongs((prev) =>
      prev.map((song, index) =>
        index === selectedSongIndex ? { ...song, [field]: value } : song,
      ),
    )
  }

  const handleCoverUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const coverUrl = URL.createObjectURL(file)
    setSongs((prev) =>
      prev.map((song, index) =>
        index === selectedSongIndex ? { ...song, coverUrl } : song,
      ),
    )
  }

  const selectedSong =
    selectedSongIndex !== null ? songs[selectedSongIndex] : null

  return (
    <div className="relative flex flex-col min-h-screen w-full bg-[#0c0c0e] text-gray-100">
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          if (songs.length > 1) handleNext()
          else setIsPlaying(false)
        }}
      />
      {/* Top bar: page title (My Library in purple) + actions */}
      <header className="shrink-0 h-14 border-b border-white/10 bg-black/40 flex items-center justify-between px-6 sm:px-8">
        <h1 className="text-sm sm:text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
          {activePage === 'upload' && 'Upload'}
          {activePage === 'songs' && (
            <span className="text-violet-400">My Library</span>
          )}
          {activePage === 'playlists' && 'Playlists'}
        </h1>
        {activePage === 'songs' && (
          <label className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500 text-xs sm:text-sm font-medium text-white shadow-sm cursor-pointer transition">
            <span>+ Add more</span>
            <input
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-hidden px-6 sm:px-8 py-6 flex gap-6 sm:gap-8">
        {activePage === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              ListenWell
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              Upload your music to get started
            </p>
            <label className="cursor-pointer rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] px-12 sm:px-16 py-10 sm:py-12 flex flex-col items-center gap-3 hover:border-violet-500/50 hover:bg-white/[0.04] transition-all duration-200">
              <span className="text-4xl opacity-80">🎵</span>
              <span className="text-sm text-gray-400">
                Click to upload audio files
              </span>
              <input
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={handleUpload}
              />
            </label>
          </div>
        )}

        {activePage === 'songs' && (
          <>
            {/* Left: Song Grid */}
            <section className="flex-1 flex flex-col overflow-hidden min-w-0">
              {songs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-500 gap-3">
                  <p>No songs yet.</p>
                  <button
                    type="button"
                    onClick={() => setActivePage('upload')}
                    className="px-4 py-2 rounded-full bg-white text-black text-xs font-medium hover:bg-gray-100 transition"
                  >
                    Upload music
                  </button>
                </div>
              ) : (
                <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-sm px-3 sm:px-4 py-3 sm:py-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 overflow-y-auto pr-1">
                    {songs.map((song, i) => (
                      <button
                        key={song.id}
                        type="button"
                        onClick={() => handleSelectSong(i)}
                        className={`flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-1 transition-all duration-200 ${
                          i === selectedSongIndex
                            ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#0c0c0e] bg-white/[0.04]'
                            : 'hover:bg-white/[0.04]'
                        } ${i === currentTrackIndex ? 'opacity-100' : ''}`}
                      >
                        <div className="w-full aspect-square rounded-xl bg-white/[0.06] overflow-hidden flex items-center justify-center text-3xl shadow-inner">
                          {song.coverUrl ? (
                            <img
                              src={song.coverUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="opacity-60">🎵</span>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate text-white/95">
                          {song.title || song.fileName}
                        </p>
                        {song.artist ? (
                          <p className="text-xs text-gray-500 truncate">
                            {song.artist}
                          </p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Right: Metadata Editor */}
            <section className="w-full max-w-sm sm:max-w-md bg-white/[0.05] rounded-2xl border border-white/[0.08] p-5 flex flex-col gap-4 shrink-0 shadow-lg ml-1 sm:ml-2">
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
                        <span className="opacity-60">🎵</span>
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
                          onChange={handleCoverUpload}
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
                        onChange={(e) =>
                          handleMetadataChange('title', e.target.value)
                        }
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
                        onChange={(e) =>
                          handleMetadataChange('artist', e.target.value)
                        }
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
                        onChange={(e) =>
                          handleMetadataChange('album', e.target.value)
                        }
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
                          handleMetadataChange('description', e.target.value)
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
        )}

        {activePage === 'playlists' && (
          <section className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-500 gap-3">
              <p>Playlist management is coming soon.</p>
              <p className="text-xs text-gray-600">
                You&apos;ll be able to create custom playlists from your library.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute bottom-28 right-4 sm:right-8 z-20 w-72 sm:w-80 rounded-2xl bg-black/80 border border-white/10 shadow-xl backdrop-blur-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex gap-2 items-center">
              <span className="text-sm font-semibold text-white">Settings</span>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-gray-500 hover:text-white text-xs"
            >
              Close
            </button>
          </div>
          <div className="flex gap-2 mb-1 text-xs">
            <button
              type="button"
              onClick={() => setSettingsTab('playback')}
              className={`flex-1 py-1.5 rounded-full border ${
                settingsTab === 'playback'
                  ? 'border-violet-500/70 bg-violet-500/10 text-white'
                  : 'border-white/10 text-gray-400 hover:border-white/30'
              }`}
            >
              Playback
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab('appearance')}
              className={`flex-1 py-1.5 rounded-full border ${
                settingsTab === 'appearance'
                  ? 'border-violet-500/70 bg-violet-500/10 text-white'
                  : 'border-white/10 text-gray-400 hover:border-white/30'
              }`}
            >
              Appearance
            </button>
          </div>

          {settingsTab === 'playback' && (
            <div className="flex flex-col gap-3 text-xs text-gray-300">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Speed</span>
                  <span className="tabular-nums text-gray-400">
                    {playbackRate.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>0.5x</span>
                  <span>1x</span>
                  <span>2x</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Equalizer</span>
                <div className="flex gap-2">
                  {[
                    { id: 'normal', label: 'Normal' },
                    { id: 'bass', label: 'Bass boost' },
                    { id: 'bright', label: 'Bright' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setEqPreset(preset.id)}
                      className={`flex-1 py-1.5 rounded-full border text-[11px] ${
                        eqPreset === preset.id
                          ? 'border-violet-500/70 bg-violet-500/15 text-white'
                          : 'border-white/10 text-gray-400 hover:border-white/30'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500">
                  Presets are visual-only for now; connect to a Web Audio
                  pipeline when you&apos;re ready.
                </p>
              </div>
            </div>
          )}

          {settingsTab === 'appearance' && (
            <div className="flex flex-col gap-3 text-xs text-gray-300">
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Theme</span>
                <p className="text-[11px] text-gray-500">
                  Dark mode is currently enabled. You can extend this section to
                  support additional themes and accent colors.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Layout density</span>
                <div className="flex gap-2">
                  <button className="flex-1 py-1.5 rounded-full border border-violet-500/60 bg-violet-500/10 text-[11px]">
                    Comfortable
                  </button>
                  <button className="flex-1 py-1.5 rounded-full border border-white/10 text-gray-400 text-[11px]">
                    Compact
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Player Bar */}
      <footer className="relative h-28 sm:h-32 border-t border-white/10 bg-black/40 backdrop-blur-xl flex items-center px-4 sm:px-8 gap-4 sm:gap-8 w-full shrink-0 overflow-visible">
        {/* One cat hanging over the top of the bar */}
        <div className="cat-hanging" aria-hidden>🐈</div>

        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center text-2xl">
          {nowPlaying?.coverUrl ? (
            <img
              src={nowPlaying.coverUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="opacity-70">🎵</span>
          )}
        </div>
        <div className="w-40 sm:w-52 min-w-0">
          <p className="text-sm sm:text-base font-semibold truncate text-white/95">
            {nowPlaying ? nowPlaying.title || nowPlaying.fileName : 'No song selected'}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 truncate">
            {nowPlaying?.artist || (nowPlaying ? 'Unknown artist' : '—')}
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center gap-2 min-w-0 max-w-2xl">
          <div className="flex gap-6 sm:gap-10 items-center">
            <button
              type="button"
              onClick={handlePrev}
              disabled={songs.length === 0}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={songs.length === 0}
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isPlaying ? (
                <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={songs.length === 0}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zm2-6l5 3.5V8.5L8 12zm9-6v12h2V6h-2z"/></svg>
            </button>
          </div>
          <div className="w-full flex items-center gap-3 text-xs sm:text-sm text-gray-500">
            <span className="w-10 shrink-0 tabular-nums text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={duration ? (currentTime / duration) * 100 : 0}
              onChange={handleSeek}
              className="flex-1 h-2 rounded-full appearance-none bg-white/25 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="w-10 shrink-0 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-500 shrink-0 mr-2 sm:mr-4">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 sm:w-24 h-2 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>

        {/* Settings toggle (moved left of logo) */}
        <button
          type="button"
          onClick={() => setShowSettings((prev) => !prev)}
          className="ml-2 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/25 text-gray-300 hover:text-white hover:border-white/60 bg-white/5 shrink-0"
        >
          <svg
            className="w-4.5 h-4.5 sm:w-5 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.6}
              d="M10.325 4.317a1 1 0 0 1 .948-.684h1.454a1 1 0 0 1 .948.684l.517 1.597a1 1 0 0 0 .95.69h1.68a1 1 0 0 1 .832 1.555l-.96 1.44a1 1 0 0 0 0 1.11l.96 1.44a1 1 0 0 1-.832 1.555h-1.68a1 1 0 0 0-.95.69l-.517 1.597a1 1 0 0 1-.948.684h-1.454a1 1 0 0 1-.948-.684l-.517-1.597a1 1 0 0 0-.95-.69h-1.68a1 1 0 0 1-.832-1.555l.96-1.44a1 1 0 0 0 0-1.11l-.96-1.44a1 1 0 0 1 .832-1.555h1.68a1 1 0 0 0 .95-.69l.517-1.597z"
            />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          </svg>
        </button>

        {/* listenWell: large logo + drop-up menu (majority of bottom right) */}
        <div className="ml-3 sm:ml-4 flex-1 min-w-0 max-w-lg flex flex-col items-end justify-center relative h-full min-h-[88px]">
          <button
            type="button"
            onClick={() => setIsNavOpen((prev) => !prev)}
            className="flex flex-col items-center justify-center w-full h-full min-h-[96px] rounded-2xl bg-white/7 border border-white/12 hover:bg-white/12 hover:border-white/25 transition text-center py-4 px-8 gap-2"
          >
            <span className="text-4xl sm:text-5xl font-bold tracking-[0.08em] sm:tracking-[0.12em] text-white block">
              listenWell
            </span>
            <span className="text-[10px] text-gray-400 block">
              {isNavOpen ? '▾ menu open' : '▴ open menu'}
            </span>
          </button>
          {isNavOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-56 rounded-2xl bg-black/95 border border-white/15 shadow-xl backdrop-blur-xl py-3 px-2 z-10 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setActivePage('upload')
                  setIsNavOpen(false)
                }}
                className="w-full py-3 px-4 rounded-xl text-left text-sm font-medium text-gray-200 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10 transition"
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePage('songs')
                  setIsNavOpen(false)
                }}
                className="w-full py-3 px-4 rounded-xl text-left text-sm font-medium text-gray-200 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10 transition"
              >
                Songs
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePage('playlists')
                  setIsNavOpen(false)
                }}
                className="w-full py-3 px-4 rounded-xl text-left text-sm font-medium text-gray-200 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10 transition"
              >
                Playlists
              </button>
            </div>
          )}
        </div>

        {/* Settings toggle */}
        <button
          type="button"
          onClick={() => setShowSettings((prev) => !prev)}
          className="ml-2 flex items-center justify-center w-8 h-8 rounded-full border border-white/20 text-gray-300 hover:text-white hover:border-white/50 bg-white/5 shrink-0"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.6}
              d="M10.325 4.317a1 1 0 0 1 .948-.684h1.454a1 1 0 0 1 .948.684l.517 1.597a1 1 0 0 0 .95.69h1.68a1 1 0 0 1 .832 1.555l-.96 1.44a1 1 0 0 0 0 1.11l.96 1.44a1 1 0 0 1-.832 1.555h-1.68a1 1 0 0 0-.95.69l-.517 1.597a1 1 0 0 1-.948.684h-1.454a1 1 0 0 1-.948-.684l-.517-1.597a1 1 0 0 0-.95-.69h-1.68a1 1 0 0 1-.832-1.555l.96-1.44a1 1 0 0 0 0-1.11l-.96-1.44a1 1 0 0 1 .832-1.555h1.68a1 1 0 0 0 .95-.69l.517-1.597z"
            />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          </svg>
        </button>
      </footer>
    </div>
  )
}

export default App