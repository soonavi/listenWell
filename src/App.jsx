import { useState, useRef, useEffect } from 'react'
import './App.css'
import UploadScreen from './components/UploadScreen'
import SongsScreen from './components/SongsScreen'
import PlaylistsScreen from './components/PlaylistsScreen'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Settings2,
  UserCircle2,
  Music2,
} from 'lucide-react'

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
  const [playlists, setPlaylists] = useState([]) // {id, name, songIds[]}
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null)
  const audioRef = useRef(null)
  const audioContextRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const bassFilterRef = useRef(null)
  const [recentItems, setRecentItems] = useState([]) // {type: 'song'|'playlist', id}

  const markRecent = (type, id) => {
    setRecentItems((prev) => {
      const filtered = prev.filter((item) => !(item.type === type && item.id === id))
      return [{ type, id }, ...filtered].slice(0, 30)
    })
  }

  const ensureAudioGraph = () => {
    const audioEl = audioRef.current
    if (!audioEl || typeof window === 'undefined') return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return

    if (!audioContextRef.current) {
      audioContextRef.current = new Ctx()
    }
    const ctx = audioContextRef.current
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    if (!sourceNodeRef.current) {
      const source = ctx.createMediaElementSource(audioEl)
      const bass = ctx.createBiquadFilter()
      bass.type = 'lowshelf'
      bass.frequency.value = 200
      source.connect(bass)
      bass.connect(ctx.destination)
      sourceNodeRef.current = source
      bassFilterRef.current = bass
    }
  }

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

  const handlePlaySongClick = (index) => {
    const audio = audioRef.current
    if (!audio) return
    if (currentTrackIndex === index && isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }
    setSelectedSongIndex(index)
    setCurrentTrackIndex(index)
    setIsPlaying(true)
    markRecent('song', songs[index]?.id)
    // audio src will be set by effect, then play on next tick
    setTimeout(() => {
      if (!audioRef.current) return
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
    }, 0)
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

  // Apply simple bass boost preset via Web Audio API
  useEffect(() => {
    if (eqPreset === 'bass') {
      ensureAudioGraph()
      if (bassFilterRef.current) {
        bassFilterRef.current.gain.value = 10 // dB boost
      }
    } else {
      if (bassFilterRef.current) {
        bassFilterRef.current.gain.value = 0
      }
    }
  }, [eqPreset])

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
      {/* Top bar: navigation buttons + context actions */}
      <header className="shrink-0 h-16 sm:h-20 border-b border-white/10 bg-black/40 flex items-center justify-center px-4 sm:px-8">
        <nav className="flex items-center justify-center gap-2 sm:gap-3 w-full max-w-4xl">
          {[
            { id: 'library', label: 'Library' },
            { id: 'playlists', label: 'Playlists' },
            { id: 'songs', label: 'Songs' },
            { id: 'upload', label: 'Upload' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePage(tab.id)}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition border ${
                activePage === tab.id
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : 'bg-transparent border-transparent text-gray-300 hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-hidden px-6 sm:px-8 py-6 flex gap-6 sm:gap-8">
        {activePage === 'upload' && <UploadScreen onUpload={handleUpload} />}

        {activePage === 'library' && (
          <section className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-white">
                Recently played
              </h2>
              <p className="text-xs text-gray-500">
                Songs and playlists you&apos;ve listened to most recently.
              </p>
            </div>
            <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-sm px-4 sm:px-5 py-3 sm:py-4 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                {recentItems
                  .map((item) => {
                    if (item.type === 'song') {
                      const song = songs.find((s) => s.id === item.id)
                      if (!song) return null
                      return {
                        kind: 'song',
                        key: `song-${song.id}`,
                        song,
                      }
                    }
                    if (item.type === 'playlist') {
                      const pl = playlists.find((p) => p.id === item.id)
                      if (!pl) return null
                      return {
                        kind: 'playlist',
                        key: `pl-${pl.id}`,
                        playlist: pl,
                      }
                    }
                    return null
                  })
                  .filter(Boolean)
                  .map((entry) =>
                    entry.kind === 'song' ? (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => {
                          const idx = songs.findIndex(
                            (s) => s.id === entry.song.id,
                          )
                          if (idx !== -1) handlePlaySongClick(idx)
                        }}
                        className="flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-1 transition-all duration-200 hover:bg-white/[0.04]"
                      >
                        <div className="w-full aspect-square rounded-xl bg-white/[0.06] overflow-hidden flex items-center justify-center text-3xl shadow-inner">
                          {entry.song.coverUrl ? (
                            <img
                              src={entry.song.coverUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="opacity-60">🎵</span>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate text-white/95">
                          {entry.song.title || entry.song.fileName}
                        </p>
                        {entry.song.artist ? (
                          <p className="text-xs text-gray-500 truncate">
                            {entry.song.artist}
                          </p>
                        ) : null}
                      </button>
                    ) : (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => {
                          setSelectedPlaylistId(entry.playlist.id)
                          setActivePage('playlists')
                          markRecent('playlist', entry.playlist.id)
                        }}
                        className="flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-3 transition-all duration-200 bg-white/[0.02] hover:bg-white/[0.06] border border-white/10"
                      >
                        <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-violet-700/60 to-fuchsia-500/50 flex items-center justify-center text-xs text-white font-semibold tracking-wide">
                          PLAYLIST
                        </div>
                        <p className="text-sm font-medium truncate text-white/95">
                          {entry.playlist.name}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {
                            entry.playlist.songIds.filter((id) =>
                              songs.some((s) => s.id === id),
                            ).length
                          }{' '}
                          tracks
                        </p>
                      </button>
                    ),
                  )}
                {recentItems.length === 0 && (
                  <p className="text-xs sm:text-sm text-gray-500 col-span-full">
                    Nothing here yet. Start playing songs or playlists and
                    they&apos;ll show up in your Library.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {activePage === 'songs' && (
          <SongsScreen
            songs={songs}
            selectedSongIndex={selectedSongIndex}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            selectedSong={selectedSong}
            onSelectSong={handleSelectSong}
            onPlaySongClick={handlePlaySongClick}
            onGoToUpload={() => setActivePage('upload')}
            onCoverUpload={handleCoverUpload}
            onMetadataChange={handleMetadataChange}
          />
        )}

        {activePage === 'playlists' && (
          <PlaylistsScreen
            songs={songs}
            playlists={playlists}
            selectedPlaylistId={selectedPlaylistId}
            newPlaylistName={newPlaylistName}
            onChangeNewPlaylistName={setNewPlaylistName}
            onCreatePlaylist={() => {
              const name = newPlaylistName.trim()
              if (!name) return
              setPlaylists((prev) => [
                ...prev,
                { id: crypto.randomUUID(), name, songIds: [] },
              ])
              setNewPlaylistName('')
            }}
            onSelectPlaylist={setSelectedPlaylistId}
            onToggleSongInPlaylist={(songId) => {
              setPlaylists((prev) =>
                prev.map((pl) =>
                  pl.id === selectedPlaylistId
                    ? {
                        ...pl,
                        songIds: pl.songIds.includes(songId)
                          ? pl.songIds.filter((id) => id !== songId)
                          : [...pl.songIds, songId],
                      }
                    : pl,
                ),
              )
            }}
            onPlaySong={(songId) => {
              const index = songs.findIndex((s) => s.id === songId)
              if (index !== -1) handlePlaySongClick(index)
            }}
          />
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
        {/* Cat hanging over the top of the bar (image via CSS .cat-hanging) */}
        <div className="cat-hanging" aria-hidden />

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
              <SkipBack className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={songs.length === 0}
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 ml-0.5" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={songs.length === 0}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipForward className="w-6 h-6" />
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

        <div className="flex items-center gap-3 text-gray-500 shrink-0 mr-2 sm:mr-4">
          <Volume2 className="w-5 h-5" />
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

        {/* Settings toggle (left of logo, larger) */}
        <button
          type="button"
          onClick={() => setShowSettings((prev) => !prev)}
          className="ml-2 flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-white/30 text-gray-200 hover:text-white hover:border-white/70 bg-white/5 shrink-0"
        >
          <Settings2 className="w-7 h-7 sm:w-8 sm:h-8" />
        </button>

        {/* listenWell logo + account button (bottom right) */}
        <div className="ml-3 sm:ml-4 flex-1 min-w-0 max-w-lg flex flex-col items-end justify-center relative h-full min-h-[88px]">
          <button
            type="button"
            className="flex flex-col items-center justify-center w-full h-full min-h-[96px] rounded-2xl bg-white/7 border border-white/12 hover:bg-white/12 hover:border-white/25 transition text-center py-4 px-8 gap-3"
          >
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <Music2 className="w-7 h-7 sm:w-9 sm:h-9 text-violet-400" />
              <span
                className="text-2xl sm:text-3xl font-semibold tracking-[0.18em] uppercase text-white block"
                style={{ fontFamily: "'Orbitron', system-ui, sans-serif" }}
              >
                listenWell
              </span>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full border border-white/25 bg-white/10 text-xs sm:text-sm text-white/90 hover:bg-white/20 hover:border-white/60 transition"
            >
              <UserCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Account</span>
            </button>
          </button>
        </div>
      </footer>
    </div>
  )
}

export default App