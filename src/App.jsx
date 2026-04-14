import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'
import UploadScreen from './components/UploadScreen'
import SongsScreen from './components/SongsScreen'
import PlaylistsScreen from './components/PlaylistsScreen'
import PlaylistDetailScreen from './components/PlaylistDetailScreen'
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Settings2,
  Music2,
  UserCircle2,
  Info,
  History,
  ChevronUp,
  Plus,
  Heart,
} from 'lucide-react'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function clampPlaybackRate(rate) {
  return rate > 1 ? 1 : rate
}

function createSafeId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

function safeGetStorage(key, fallback) {
  try {
    if (typeof window === 'undefined') return fallback
    const value = window.localStorage.getItem(key)
    return value ?? fallback
  } catch {
    return fallback
  }
}

function safeSetStorage(key, value) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, value)
  } catch {
    // ignore storage failures (private mode / blocked storage)
  }
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
  const [activePage, setActivePage] = useState('upload') // 'upload' | 'songs' | 'playlists' | 'playlist-detail'
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('playback') // 'playback' | 'appearance'
  const [playlists, setPlaylists] = useState([]) // {id, name, description, coverUrl, songIds[]}
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null)
  const [songFilter, setSongFilter] = useState('all') // all | loved
  const [songSortBy, setSongSortBy] = useState('default') // default | title | artist
  const [lovedSongIds, setLovedSongIds] = useState([])
  const [showNowPlayingAddMenu, setShowNowPlayingAddMenu] = useState(false)
  const audioRef = useRef(null)
  const audioContextRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const bassFilterRef = useRef(null)
  const analyserRef = useRef(null)
  const visualizerDataRef = useRef(null)
  const visualizerFrameRef = useRef(null)
  const visualizerCanvasRef = useRef(null)
  const [recentItems, setRecentItems] = useState([]) // {type: 'song'|'playlist', id}
  const [showLogoSymbol, setShowLogoSymbol] = useState(true)
  const [theme, setTheme] = useState(() => safeGetStorage('listenwell-theme', 'deep-space'))
  const [accentColor, setAccentColor] = useState('139 92 246')
  const [shimmer, setShimmer] = useState({ low: 0, mid: 0, high: 0 })
  const [settingsPosition, setSettingsPosition] = useState(() => {
    const stored = safeGetStorage('listenwell-settings-position', null)
    if (!stored) return { x: 0, y: 0 }
    try {
      return JSON.parse(stored)
    } catch {
      return { x: 0, y: 0 }
    }
  })
  const [isDraggingSettings, setIsDraggingSettings] = useState(false)
  const [eqBands, setEqBands] = useState(Array.from({ length: 12 }, () => 0.3))
  const [showAccountDrawer, setShowAccountDrawer] = useState(false)
  const [showLogoMenu, setShowLogoMenu] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [showListeningHistoryModal, setShowListeningHistoryModal] = useState(false)
  const [listeningHistory, setListeningHistory] = useState([])
  const [savedPresets, setSavedPresets] = useState(() => {
    const stored = safeGetStorage('listenwell-presets', null)
    if (!stored) return []
    try {
      return JSON.parse(stored)
    } catch {
      return []
    }
  })
  const [auroraIntensity, setAuroraIntensity] = useState(() => Number(safeGetStorage('listenwell-aurora-intensity', '0.75')))
  const [glowSoftness, setGlowSoftness] = useState(() => Number(safeGetStorage('listenwell-glow-softness', '0.65')))
  const [blurAmount, setBlurAmount] = useState(() => Number(safeGetStorage('listenwell-blur-amount', '0.7')))
  const settingsButtonRef = useRef(null)
  const settingsPanelRef = useRef(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const logoMenuRef = useRef(null)
  const nowPlayingMenuRef = useRef(null)

  const markSongHistory = useCallback((song) => {
    if (!song?.id) return
    setListeningHistory((prev) => [{ id: song.id, title: song.title || song.fileName || 'Untitled' }, ...prev].slice(0, 100))
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setShowLogoSymbol((prev) => !prev)
    }, 2400)
    return () => window.clearInterval(interval)
  }, [])

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
      const analyser = ctx.createAnalyser()
      bass.type = 'lowshelf'
      bass.frequency.value = 200
      analyser.fftSize = 128
      source.connect(bass)
      bass.connect(analyser)
      analyser.connect(ctx.destination)
      sourceNodeRef.current = source
      bassFilterRef.current = bass
      analyserRef.current = analyser
      visualizerDataRef.current = new Uint8Array(analyser.frequencyBinCount)
    }
  }

  const runVisualizerFrame = useCallback(() => {
    const canvas = visualizerCanvasRef.current
    const analyser = analyserRef.current
    const data = visualizerDataRef.current
    if (!canvas || !analyser || !data) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    analyser.getByteFrequencyData(data)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const bars = 30
    const gap = 4
    const barWidth = Math.max(2, (rect.width - gap * (bars - 1)) / bars)

    let lowSum = 0
    let midSum = 0
    let highSum = 0

    for (let i = 0; i < bars; i += 1) {
      const value = data[Math.floor((i / bars) * data.length)] || 0
      const normalized = value / 255
      const barHeight = Math.max(3, normalized * rect.height)
      const x = i * (barWidth + gap)
      const y = rect.height - barHeight
      const gradient = ctx.createLinearGradient(0, y, 0, rect.height)
      gradient.addColorStop(0, 'rgba(34,211,238,0.9)')
      gradient.addColorStop(1, 'rgba(139,92,246,0.35)')
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, barWidth, barHeight)

      if (i < bars / 3) lowSum += normalized
      else if (i < (bars * 2) / 3) midSum += normalized
      else highSum += normalized
    }

    const bandSize = bars / 3
    setShimmer({
      low: lowSum / bandSize,
      mid: midSum / bandSize,
      high: highSum / bandSize,
    })

    visualizerFrameRef.current = requestAnimationFrame(runVisualizerFrame)
  }, [])

  const handleParallaxMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    event.currentTarget.style.setProperty('--rx', `${-y * 5}deg`)
    event.currentTarget.style.setProperty('--ry', `${x * 7}deg`)
    event.currentTarget.style.setProperty('--mx', `${(x + 1) * 50}%`)
    event.currentTarget.style.setProperty('--my', `${(y + 1) * 50}%`)
  }

  const handleParallaxLeave = (event) => {
    event.currentTarget.style.setProperty('--rx', '0deg')
    event.currentTarget.style.setProperty('--ry', '0deg')
    event.currentTarget.style.setProperty('--mx', '50%')
    event.currentTarget.style.setProperty('--my', '50%')
  }

  const handleSpeedChange = (value) => {
    setPlaybackRate(value)
  }

  const toggleLovedSong = (songId) => {
    setLovedSongIds((prev) => (prev.includes(songId) ? prev.filter((id) => id !== songId) : [songId, ...prev]))
  }

  const createPlaylistWithSong = (songId) => {
    const id = createSafeId('playlist')
    setPlaylists((prev) => [
      ...prev,
      {
        id,
        name: `Playlist ${prev.length + 1}`,
        description: '',
        coverUrl: null,
        songIds: [songId],
      },
    ])
    setSelectedPlaylistId(id)
    setActivePage('playlist-detail')
  }

  const extractAccentFromCover = useCallback((coverUrl) => {
    if (!coverUrl || typeof window === 'undefined') return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = 40
      canvas.height = 40
      ctx.drawImage(img, 0, 0, 40, 40)
      const pixels = ctx.getImageData(0, 0, 40, 40).data
      let r = 0
      let g = 0
      let b = 0
      let count = 0
      for (let i = 0; i < pixels.length; i += 16) {
        r += pixels[i]
        g += pixels[i + 1]
        b += pixels[i + 2]
        count += 1
      }
      const rr = Math.round(r / count)
      const gg = Math.round(g / count)
      const bb = Math.round(b / count)
      setAccentColor(`${rr} ${gg} ${bb}`)
    }
    img.src = coverUrl
  }, [])

  const startSettingsDrag = (event) => {
    if (!settingsPanelRef.current) return
    const rect = settingsPanelRef.current.getBoundingClientRect()
    dragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    setIsDraggingSettings(true)
  }

  const saveCurrentPreset = () => {
    const preset = {
      id: createSafeId('preset'),
      name: `Preset ${savedPresets.length + 1}`,
      theme,
      eqPreset,
      volume,
      playbackRate,
      auroraIntensity,
      glowSoftness,
      blurAmount,
    }
    setSavedPresets((prev) => [preset, ...prev].slice(0, 10))
  }

  const applyPreset = (preset) => {
    setTheme(preset.theme)
    setEqPreset(preset.eqPreset)
    setVolume(preset.volume)
    setPlaybackRate(preset.playbackRate)
    setAuroraIntensity(preset.auroraIntensity)
    setGlowSoftness(preset.glowSoftness)
    setBlurAmount(preset.blurAmount)
  }

  const handleUpload = (e) => {
    const files = Array.from(e.target.files || [])
    const audioFiles = files.filter((f) => f.type.startsWith('audio/'))

    if (audioFiles.length === 0) return

    const newSongs = audioFiles.map((f) => ({
      id: createSafeId(f.name || 'song'),
      title: f.name.replace(/\.[^/.]+$/, ''),
      fileName: f.name,
      url: URL.createObjectURL(f),
      artist: '',
      album: '',
      coverUrl: null,
      description: '',
    }))

    setSongs((prev) => [...prev, ...newSongs])
    setActivePage('songs')
    if (selectedSongIndex === null) {
      setSelectedSongIndex(0)
      setCurrentTrackIndex(0)
    }

    if (e?.target) {
      // allow selecting the same file again in subsequent uploads
      e.target.value = ''
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
    markSongHistory(songs[index])
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
  const nowPlaying = currentTrackIndex != null ? songs[currentTrackIndex] : null
  const effectivePlaybackRate = clampPlaybackRate(playbackRate)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || currentTrackIndex == null || !currentTrackUrl) return
    audio.src = currentTrackUrl
    audio.currentTime = 0
    if (isPlaying) audio.play().catch(() => setIsPlaying(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackIndex, currentTrackUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrackUrl) return
    audio.playbackRate = effectivePlaybackRate
    audio.volume = volume
    if (isPlaying && audio.paused) {
      audio.play().catch(() => setIsPlaying(false))
    }
    if (!isPlaying && !audio.paused) {
      audio.pause()
    }
  }, [isPlaying, currentTrackUrl, effectivePlaybackRate, volume])

  // Keep volume in sync with audio element
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
  }, [volume])

  // Keep playback speed in sync with audio element
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.playbackRate = effectivePlaybackRate
  }, [effectivePlaybackRate])

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

  useEffect(() => {
    ensureAudioGraph()
  }, [])

  useEffect(() => {
    safeSetStorage('listenwell-theme', theme)
  }, [theme])

  useEffect(() => {
    safeSetStorage('listenwell-settings-position', JSON.stringify(settingsPosition))
  }, [settingsPosition])

  useEffect(() => {
    safeSetStorage('listenwell-presets', JSON.stringify(savedPresets))
  }, [savedPresets])

  useEffect(() => {
    safeSetStorage('listenwell-aurora-intensity', String(auroraIntensity))
  }, [auroraIntensity])

  useEffect(() => {
    safeSetStorage('listenwell-glow-softness', String(glowSoftness))
  }, [glowSoftness])

  useEffect(() => {
    safeSetStorage('listenwell-blur-amount', String(blurAmount))
  }, [blurAmount])

  useEffect(() => {
    extractAccentFromCover(nowPlaying?.coverUrl)
  }, [nowPlaying?.coverUrl, extractAccentFromCover])

  useEffect(() => {
    const id = window.setInterval(() => {
      const base = eqPreset === 'bass' ? 0.68 : eqPreset === 'bright' ? 0.56 : 0.46
      setEqBands((prev) =>
        prev.map((_, i) => {
          const wave = (Math.sin(Date.now() / 260 + i * 0.45) + 1) / 2
          return Math.max(0.08, Math.min(1, base * 0.4 + wave * base))
        }),
      )
    }, 120)
    return () => window.clearInterval(id)
  }, [eqPreset])

  useEffect(() => {
    if (!showSettings || !settingsButtonRef.current) return
    const buttonRect = settingsButtonRef.current.getBoundingClientRect()
    const fallbackX = buttonRect.left - 120
    const fallbackY = buttonRect.top - 320
    const baseX = settingsPosition.x === 0 && settingsPosition.y === 0 ? fallbackX : settingsPosition.x
    const baseY = settingsPosition.x === 0 && settingsPosition.y === 0 ? fallbackY : settingsPosition.y
    const targetX = Math.max(8, Math.min(window.innerWidth - 340, baseX))
    const targetY = Math.max(8, Math.min(window.innerHeight - 80, baseY))
    if (targetX !== settingsPosition.x || targetY !== settingsPosition.y) {
      setSettingsPosition({ x: targetX, y: targetY })
    }
  }, [showSettings, settingsPosition.x, settingsPosition.y])

  useEffect(() => {
    if (!showLogoMenu) return
    const onDown = (event) => {
      if (!logoMenuRef.current?.contains(event.target)) {
        setShowLogoMenu(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [showLogoMenu])

  useEffect(() => {
    if (!showNowPlayingAddMenu) return
    const onDown = (event) => {
      if (!nowPlayingMenuRef.current?.contains(event.target)) {
        setShowNowPlayingAddMenu(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [showNowPlayingAddMenu])

  useEffect(() => {
    if (!isDraggingSettings) return

    const onMove = (event) => {
      const maxX = window.innerWidth - 340
      const maxY = window.innerHeight - 80
      setSettingsPosition({
        x: Math.max(8, Math.min(maxX, event.clientX - dragOffsetRef.current.x)),
        y: Math.max(8, Math.min(maxY, event.clientY - dragOffsetRef.current.y)),
      })
    }

    const onUp = () => setIsDraggingSettings(false)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDraggingSettings])

  useEffect(() => {
    if (isPlaying) {
      visualizerFrameRef.current = requestAnimationFrame(runVisualizerFrame)
    } else if (visualizerFrameRef.current) {
      cancelAnimationFrame(visualizerFrameRef.current)
      visualizerFrameRef.current = null
    }

    return () => {
      if (visualizerFrameRef.current) {
        cancelAnimationFrame(visualizerFrameRef.current)
        visualizerFrameRef.current = null
      }
    }
  }, [isPlaying, currentTrackIndex, runVisualizerFrame])

  useEffect(() => {
    if (!isPlaying) return undefined
    let frameId = null
    const tick = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime)
      }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => {
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [isPlaying])

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
    markRecent('song', songs[next]?.id)
    markSongHistory(songs[next])
  }

  const handleNext = () => {
    if (songs.length === 0) return
    const next = currentTrackIndex === null ? 0 : (currentTrackIndex + 1) % songs.length
    setCurrentTrackIndex(next)
    setSelectedSongIndex(next)
    setIsPlaying(true)
    markRecent('song', songs[next]?.id)
    markSongHistory(songs[next])
  }

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const t = Number(e.target.value)
    audio.currentTime = t
    setCurrentTime(t)
  }

  const handleVolumeChange = (e) => {
    const v = Number(e.target.value)
    setVolume(v)
  }

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

  const pageTransition = {
    initial: { opacity: 0, y: 16, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: -12, filter: 'blur(8px)' },
  }

  return (
    <div
      data-theme={theme}
      className="relative flex flex-col min-h-screen w-full bg-[#0c0c0e] text-gray-100 overflow-hidden"
      style={{
        '--accent-rgb': accentColor,
        '--shimmer-low': shimmer.low,
        '--shimmer-mid': shimmer.mid,
        '--shimmer-high': shimmer.high,
        '--aurora-intensity': auroraIntensity,
        '--glow-softness': glowSoftness,
        '--blur-amount': blurAmount,
      }}
    >
      <div className="aurora aurora-one" aria-hidden />
      <div className="aurora aurora-two" aria-hidden />
      <div className="aurora aurora-three" aria-hidden />
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
      <header className="relative z-10 shrink-0 h-16 sm:h-20 border-b border-white/10 bg-black/40 flex items-center justify-center px-4 sm:px-8">
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
                className={`magnetic-hover px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition border ${
                activePage === tab.id || (tab.id === 'playlists' && activePage === 'playlist-detail')
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
      <main className="relative z-10 flex-1 overflow-y-hidden px-6 sm:px-8 py-6 flex gap-6 sm:gap-8">
        <AnimatePresence mode="wait">
          {activePage === 'upload' && (
            <motion.div
              key="upload"
              className="flex-1 flex"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <UploadScreen onUpload={handleUpload} />
            </motion.div>
          )}

          {activePage === 'library' && (
            <motion.section
              key="library"
              className="flex-1 flex flex-col overflow-hidden min-w-0 glass-card parallax-card"
              onMouseMove={handleParallaxMove}
              onMouseLeave={handleParallaxLeave}
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
            <div className="mb-4">
              <h2 className="section-title text-base sm:text-lg text-white text-center">
                Recently played
              </h2>
              <p className="text-xs text-gray-500 text-center">
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
                            <Music2 className="w-11 h-11 opacity-60 text-violet-300" />
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
            </motion.section>
          )}

          {activePage === 'songs' && (
            <motion.div
              key="songs"
              className="flex-1 flex"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <SongsScreen
                songs={songs}
                selectedSongIndex={selectedSongIndex}
                currentTrackIndex={currentTrackIndex}
                isPlaying={isPlaying}
                selectedSong={selectedSong}
                songFilter={songFilter}
                sortBy={songSortBy}
                lovedSongIds={lovedSongIds}
                onChangeSongFilter={setSongFilter}
                onChangeSortBy={setSongSortBy}
                onToggleLoved={toggleLovedSong}
                onAddSongQuick={(songId) => {
                  if (selectedPlaylistId) {
                    setPlaylists((prev) =>
                      prev.map((pl) =>
                        pl.id === selectedPlaylistId && !pl.songIds.includes(songId)
                          ? { ...pl, songIds: [...pl.songIds, songId] }
                          : pl,
                      ),
                    )
                  } else {
                    createPlaylistWithSong(songId)
                  }
                }}
                onSelectSong={handleSelectSong}
                onPlaySongClick={handlePlaySongClick}
                onGoToUpload={() => setActivePage('upload')}
                onUploadMore={handleUpload}
                onCoverUpload={handleCoverUpload}
                onMetadataChange={handleMetadataChange}
                onParallaxMove={handleParallaxMove}
                onParallaxLeave={handleParallaxLeave}
              />
            </motion.div>
          )}

          {activePage === 'playlists' && (
            <motion.div
              key="playlists"
              className="flex-1 flex"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <PlaylistsScreen
                playlists={playlists}
                selectedPlaylistId={selectedPlaylistId}
                onCreatePlaylist={({ name, description, coverUrl }) => {
                  const trimmedName = name.trim()
                  if (!trimmedName) return
                  const id = createSafeId('playlist')
                  setPlaylists((prev) => [
                    ...prev,
                    {
                      id,
                      name: trimmedName,
                      description: description || '',
                      coverUrl: coverUrl || null,
                      songIds: [],
                    },
                  ])
                  setSelectedPlaylistId(id)
                }}
                onUpdatePlaylist={(playlistId, updates) => {
                  setPlaylists((prev) =>
                    prev.map((pl) =>
                      pl.id === playlistId ? { ...pl, ...updates } : pl,
                    ),
                  )
                }}
                onSelectPlaylist={(id) => {
                  setSelectedPlaylistId(id)
                  setActivePage('playlist-detail')
                }}
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
            </motion.div>
          )}

          {activePage === 'playlist-detail' && (
            <motion.div
              key="playlist-detail"
              className="flex-1 flex"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <PlaylistDetailScreen
                playlist={playlists.find((pl) => pl.id === selectedPlaylistId) || null}
                songs={songs}
                onBack={() => setActivePage('playlists')}
                onPlaySong={(songId) => {
                  const index = songs.findIndex((s) => s.id === songId)
                  if (index !== -1) handlePlaySongClick(index)
                }}
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
                onUpdatePlaylist={(playlistId, updates) => {
                  setPlaylists((prev) =>
                    prev.map((pl) =>
                      pl.id === playlistId ? { ...pl, ...updates } : pl,
                    ),
                  )
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Settings Panel */}
      {showSettings && (
        <div
          ref={settingsPanelRef}
          className="fixed z-30 w-80 rounded-2xl bg-black/80 border border-white/10 shadow-xl backdrop-blur-xl p-4 flex flex-col gap-3 glass-card parallax-card"
          onMouseMove={handleParallaxMove}
          onMouseLeave={handleParallaxLeave}
          style={{ left: settingsPosition.x, top: settingsPosition.y }}
        >
          <div
            className="flex items-center justify-between mb-1 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={startSettingsDrag}
          >
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
                  <span className="tabular-nums text-cyan-300 font-semibold tracking-wide">
                    {effectivePlaybackRate.toFixed(2)}x applied
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={playbackRate}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
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
                  Speeds above 1.0x are limited to 1.0x playback for clean
                  timing. The slider still lets you dial slower speeds.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-medium">Neural Equalizer</span>
                <div className="neural-panel rounded-xl p-2 border border-white/10">
                  <div className="flex items-end gap-1 h-14">
                    {eqBands.map((band, index) => (
                      <span
                        key={`${index}-${eqPreset}`}
                        className="neural-band"
                        style={{ height: `${Math.round(band * 100)}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {settingsTab === 'appearance' && (
            <div className="flex flex-col gap-3 text-xs text-gray-300">
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Scene theme</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'neon-grid', label: 'Neon Grid' },
                    { id: 'deep-space', label: 'Deep Space' },
                    { id: 'hologram', label: 'Hologram' },
                  ].map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => setTheme(scene.id)}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] text-center ${
                        theme === scene.id
                          ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-200'
                          : 'border-white/10 hover:border-white/40 text-gray-300'
                      }`}
                    >
                      {scene.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Accent source</span>
                <p className="text-[11px] text-gray-400">
                  Accent glow auto-matches album art when a cover exists.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-medium">Theme intensity</span>
                <label className="text-[11px] text-gray-400 flex flex-col gap-1">
                  Aurora strength
                  <input
                    type="range"
                    min={0.2}
                    max={1.2}
                    step={0.05}
                    value={auroraIntensity}
                    onChange={(e) => setAuroraIntensity(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-200"
                  />
                </label>
                <label className="text-[11px] text-gray-400 flex flex-col gap-1">
                  Glow softness
                  <input
                    type="range"
                    min={0.25}
                    max={1.25}
                    step={0.05}
                    value={glowSoftness}
                    onChange={(e) => setGlowSoftness(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-200"
                  />
                </label>
                <label className="text-[11px] text-gray-400 flex flex-col gap-1">
                  Blur amount
                  <input
                    type="range"
                    min={0.25}
                    max={1.35}
                    step={0.05}
                    value={blurAmount}
                    onChange={(e) => setBlurAmount(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-200"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={saveCurrentPreset}
                className="w-full text-center rounded-lg border border-cyan-300/45 bg-cyan-500/10 text-cyan-200 py-1.5 text-[11px] hover:border-cyan-200/75"
              >
                Save current profile preset
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Player Bar */}
      <footer className="relative z-10 h-28 sm:h-32 border-t border-white/10 bg-black/40 backdrop-blur-xl flex items-center px-4 sm:px-8 gap-4 sm:gap-8 w-full shrink-0 overflow-visible">
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
            <Music2 className="w-8 h-8 text-violet-300/80" />
          )}
        </div>
        <div ref={nowPlayingMenuRef} className="w-40 sm:w-52 min-w-0 relative">
          <div className="flex items-center gap-2">
            <p className="text-sm sm:text-base font-semibold truncate text-white/95 flex-1">
              {nowPlaying ? nowPlaying.title || nowPlaying.fileName : 'No song selected'}
            </p>
            {nowPlaying && (
              <button type="button" onClick={() => setShowNowPlayingAddMenu((prev) => !prev)} className="w-5 h-5 rounded-full border border-white/30 inline-flex items-center justify-center text-gray-200 hover:border-white/70">
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 truncate">
            {nowPlaying?.artist || (nowPlaying ? 'Unknown artist' : '—')}
          </p>
          {showNowPlayingAddMenu && nowPlaying && (
            <div className="absolute z-30 right-0 top-[calc(100%+0.35rem)] w-52 rounded-xl border border-white/12 bg-[#0e1016]/95 backdrop-blur-xl p-2 flex flex-col gap-1">
              <button type="button" onClick={() => { toggleLovedSong(nowPlaying.id); setShowNowPlayingAddMenu(false) }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-gray-200 inline-flex items-center gap-2"><Heart className="w-4 h-4" />{lovedSongIds.includes(nowPlaying.id) ? 'Unlove song' : 'Love song'}</button>
              {playlists.map((pl) => (
                <button key={pl.id} type="button" onClick={() => { setPlaylists((prev) => prev.map((item) => item.id === pl.id && !item.songIds.includes(nowPlaying.id) ? { ...item, songIds: [...item.songIds, nowPlaying.id] } : item)); setShowNowPlayingAddMenu(false) }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-xs text-gray-300">
                  Add to {pl.name}
                </button>
              ))}
              <button type="button" onClick={() => { createPlaylistWithSong(nowPlaying.id); setShowNowPlayingAddMenu(false) }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-xs text-cyan-200">Create playlist & add</button>
            </div>
          )}
        </div>

          <div className="flex-1 flex flex-col items-center gap-2 min-w-0 max-w-2xl">
          <div className="flex gap-6 sm:gap-10 items-center">
            <button
              type="button"
              onClick={handlePrev}
              disabled={songs.length === 0}
              className="magnetic-hover p-1.5 sm:p-2 text-gray-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipBack className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={songs.length === 0}
              className="magnetic-hover glow-pulse w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
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
              className="magnetic-hover p-1.5 sm:p-2 text-gray-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
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
              max={duration || 0}
              step={0.05}
              value={Math.min(currentTime, duration || 0)}
              onInput={handleSeek}
              onChange={handleSeek}
              className="flex-1 h-2 rounded-full appearance-none bg-white/25 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="w-10 shrink-0 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
          <canvas
            ref={visualizerCanvasRef}
            className="w-full h-8 rounded-lg bg-white/[0.04] border border-white/10"
            aria-label="Live audio visualizer"
          />
        </div>

        <div className="flex items-center gap-3 text-gray-500 shrink-0 mr-2 sm:mr-4">
          <Volume2 className="w-5 h-5" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onInput={handleVolumeChange}
            onChange={handleVolumeChange}
            className="w-20 sm:w-24 h-2 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>

        {/* Settings toggle (left of logo, larger) */}
        <button
          ref={settingsButtonRef}
          type="button"
          onClick={() => setShowSettings((prev) => !prev)}
          className="magnetic-hover ml-2 flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-white/30 text-gray-200 hover:text-white hover:border-white/70 bg-white/5 shrink-0"
        >
          <Settings2 className="w-7 h-7 sm:w-8 sm:h-8" />
        </button>

        {/* listenWell logo + account button (bottom right) */}
        <div ref={logoMenuRef} className="ml-3 sm:ml-4 flex-1 min-w-0 max-w-lg flex flex-col items-end justify-center relative h-full min-h-[88px]">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowLogoMenu((prev) => !prev)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setShowLogoMenu((prev) => !prev)
              }
            }}
            className="flex flex-col items-center justify-center w-full h-full min-h-[96px] rounded-2xl bg-white/7 border border-white/12 hover:bg-white/12 hover:border-white/25 transition text-center py-4 px-8 gap-3 cursor-pointer"
          >
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <span className="w-7 h-7 sm:w-9 sm:h-9 inline-flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {showLogoSymbol && (
                    <motion.span
                      key="logo-symbol"
                      initial={{ opacity: 0, scale: 0.7, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.7, y: -6 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <Music2 className="w-7 h-7 sm:w-9 sm:h-9 text-violet-400" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span
                className="text-2xl sm:text-3xl font-semibold tracking-[0.18em] uppercase text-white block"
                style={{ fontFamily: "'Orbitron', system-ui, sans-serif" }}
              >
                listenWell
              </span>
              <ChevronUp className={`w-4 h-4 text-gray-300 transition-transform ${showLogoMenu ? 'rotate-180' : ''}`} />
            </div>
          </div>

          <AnimatePresence>
            {showLogoMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute right-0 bottom-[calc(100%+0.5rem)] w-56 rounded-xl border border-white/12 bg-[#0e1016]/95 backdrop-blur-xl p-2 flex flex-col gap-1 z-30"
              >
                <button type="button" onClick={() => { setShowAccountDrawer(true); setShowLogoMenu(false) }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-gray-200 flex items-center justify-start gap-2.5 leading-none"><UserCircle2 className="w-4 h-4 shrink-0" /><span className="leading-none">Account</span></button>
                <button type="button" onClick={() => { setShowAboutModal(true); setShowLogoMenu(false) }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-gray-200 flex items-center justify-start gap-2.5 leading-none"><Info className="w-4 h-4 shrink-0" /><span className="leading-none">About us</span></button>
                <button type="button" onClick={() => { setShowListeningHistoryModal(true); setShowLogoMenu(false) }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-gray-200 flex items-center justify-start gap-2.5 leading-none"><History className="w-4 h-4 shrink-0" /><span className="leading-none">Listening history</span></button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </footer>

      <AnimatePresence>
        {showAboutModal && (
          <>
            <motion.button type="button" onClick={() => setShowAboutModal(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,560px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 p-5 shadow-2xl glass-card">
              <div className="flex items-center justify-between mb-3"><h3 className="text-base font-semibold text-cyan-200">About ListenWell</h3><button type="button" onClick={() => setShowAboutModal(false)} className="text-xs text-gray-400 hover:text-white">Close</button></div>
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">ListenWell was built out of a simple frustration — why pay a monthly fee just to listen to music you already have? We're a small team of students who believed your music should be yours, fully and without conditions.
No algorithms deciding what you hear next. No subscriptions. No data harvesting. Just your library, the way you want it.
We built this because we use it. And we hope you do too.

-- Ben Krause, Emanuel Shilaku </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showListeningHistoryModal && (
          <>
            <motion.button type="button" onClick={() => setShowListeningHistoryModal(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,520px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 p-5 shadow-2xl glass-card">
              <div className="flex items-center justify-between mb-3"><h3 className="text-base font-semibold text-cyan-200">Listening history</h3><button type="button" onClick={() => setShowListeningHistoryModal(false)} className="text-xs text-gray-400 hover:text-white">Close</button></div>
              <div className="max-h-[55vh] overflow-auto pr-1">
                {listeningHistory.length === 0 ? (
                  <p className="text-sm text-gray-400">No songs listened to yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {listeningHistory.map((entry, index) => (
                      <li key={`${entry.id}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-200">
                        {entry.title}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAccountDrawer && (
          <>
            <motion.button
              type="button"
              onClick={() => setShowAccountDrawer(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label="Close account drawer"
            />
            <motion.aside
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed right-4 top-4 bottom-4 z-50 w-[330px] rounded-2xl border border-white/10 bg-[#0f1117]/90 backdrop-blur-xl p-4 flex flex-col gap-4 glass-card"
            >
              <div className="flex items-center justify-between">
                <h3 className="section-title text-sm text-cyan-200">Account</h3>
                <button
                  type="button"
                  onClick={() => setShowAccountDrawer(false)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-sm text-white font-medium">ListenWell Pilot</p>
                <p className="text-xs text-gray-400 mt-1">Futuristic Listener Profile</p>
                <p className="text-[11px] text-gray-500 mt-2">Theme: {theme}</p>
              </div>
              <div className="flex-1 min-h-0">
                <p className="text-xs text-cyan-200 mb-2">Saved Presets</p>
                <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                  {savedPresets.length === 0 ? (
                    <p className="text-xs text-gray-500">No saved presets yet.</p>
                  ) : (
                    savedPresets.map((preset) => (
                      <div key={preset.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                        <p className="text-xs text-white mb-1">{preset.name}</p>
                        <p className="text-[10px] text-gray-400 mb-2">{preset.theme} · {preset.eqPreset} · {Math.min(preset.playbackRate, 1).toFixed(2)}x</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className="flex-1 text-center py-1 rounded-md border border-cyan-300/50 text-cyan-200 text-[11px]"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => setSavedPresets((prev) => prev.filter((item) => item.id !== preset.id))}
                            className="px-2 py-1 rounded-md border border-white/20 text-gray-300 text-[11px]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
