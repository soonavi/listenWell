import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'
import { analyzeAudio } from './utils/audioAnalysis'
import UploadScreen from './components/UploadScreen'
import SongsScreen from './components/SongsScreen'
import PlaylistsScreen from './components/PlaylistsScreen'
import PlaylistDetailScreen from './components/PlaylistDetailScreen'
import NowPlayingOverlay from './components/NowPlayingOverlay'
import QueuePanel from './components/QueuePanel'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
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
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  Keyboard,
  Library,
  Upload,
} from 'lucide-react'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function clampPlaybackRate(rate) {
  return Math.max(0.25, Math.min(3, rate))
}

function createSafeId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

function stableSongId(fileName) {
  if (!fileName) return createSafeId('song')
  let h = 5381
  for (let i = 0; i < fileName.length; i++) {
    h = (Math.imul(h, 31) + fileName.charCodeAt(i)) | 0
  }
  return `s${(h >>> 0).toString(36)}`
}

// Playlist accent colour presets (hex → space-separated RGB for CSS var)
const ACCENT_PRESETS = [
  { hex: '#7c3aed', rgb: '124 58 237', label: 'Violet' },
  { hex: '#2563eb', rgb: '37 99 235',  label: 'Blue' },
  { hex: '#0891b2', rgb: '8 145 178',  label: 'Cyan' },
  { hex: '#16a34a', rgb: '22 163 74',  label: 'Green' },
  { hex: '#d97706', rgb: '217 119 6',  label: 'Amber' },
  { hex: '#ea580c', rgb: '234 88 12',  label: 'Orange' },
  { hex: '#dc2626', rgb: '220 38 38',  label: 'Red' },
  { hex: '#db2777', rgb: '219 39 119', label: 'Pink' },
]

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
    // ignore storage failures
  }
}

function parseStoredJSON(key, fallback) {
  const stored = safeGetStorage(key, null)
  if (!stored) return fallback
  try { return JSON.parse(stored) } catch { return fallback }
}

function normalizeThemeId(themeId) {
  const map = {
    'deep-space': 'dark',
    'neon-grid': 'dark',
    hologram: 'pink',
    light: 'light',
    dark: 'dark',
    sunset: 'sunset',
    pink: 'pink',
  }
  return map[themeId] || 'dark'
}

// Minimal inline ID3v2 tag reader — no external dependency
async function readAudioTags(file) {
  try {
    // Only read first 512 KB (enough for any ID3 header + embedded art)
    const slice = file.slice(0, 524288)
    const buffer = await slice.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Must start with "ID3"
    if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null

    const version = bytes[3] // 2 = ID3v2.2, 3 = ID3v2.3, 4 = ID3v2.4
    // Syncsafe integer for tag size
    const tagSize = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]
    const maxOffset = Math.min(10 + tagSize, bytes.length)

    const readStr = (data, enc) => {
      try {
        const d = data[0] === 0xff && data[1] === 0xfe ? data.slice(2) : data
        const codec = (enc === 1 || enc === 2) ? 'utf-16le' : enc === 3 ? 'utf-8' : 'iso-8859-1'
        return new TextDecoder(codec).decode(d).replace(/\0/g, '').trim()
      } catch { return '' }
    }

    const tags = {}
    let offset = 10

    while (offset < maxOffset - 10) {
      let frameId, frameSize, headerLen

      if (version >= 3) {
        frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
        frameSize = version >= 4
          ? (bytes[offset + 4] << 21) | (bytes[offset + 5] << 14) | (bytes[offset + 6] << 7) | bytes[offset + 7]
          : (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]
        headerLen = 10
      } else {
        // ID3v2.2: 3-char frame IDs, 3-byte size
        frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2])
        frameSize = (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5]
        headerLen = 6
        // Map v2.2 → v2.3 frame IDs
        const map22 = { TT2: 'TIT2', TP1: 'TPE1', TAL: 'TALB', PIC: 'APIC' }
        frameId = map22[frameId] || frameId
      }

      if (!frameId.trim() || frameId[0] === '\0' || frameSize <= 0) break
      offset += headerLen

      const end = Math.min(offset + frameSize, bytes.length)
      const frame = bytes.slice(offset, end)

      if (frameId === 'TIT2' && !tags.title) tags.title = readStr(frame.slice(1), frame[0])
      else if (frameId === 'TPE1' && !tags.artist) tags.artist = readStr(frame.slice(1), frame[0])
      else if (frameId === 'TALB' && !tags.album) tags.album = readStr(frame.slice(1), frame[0])
      else if (frameId === 'APIC' && !tags.picture) {
        let p = 1
        const enc = frame[0]
        while (p < frame.length && frame[p] !== 0) p++
        const mime = new TextDecoder('ascii').decode(frame.slice(1, p)) || 'image/jpeg'
        p += 2 // skip null + picture type
        if (enc === 1 || enc === 2) {
          while (p < frame.length - 1 && !(frame[p] === 0 && frame[p + 1] === 0)) p += 2
          p += 2
        } else {
          while (p < frame.length && frame[p] !== 0) p++
          p++
        }
        tags.picture = { data: frame.slice(p), format: mime }
      }

      offset += frameSize
    }

    return Object.keys(tags).length > 0 ? tags : null
  } catch {
    return null
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
  const [eqPreset, setEqPreset] = useState('normal')
  const [activePage, setActivePage] = useState('upload')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('playback')
  const [playlists, setPlaylists] = useState(() => parseStoredJSON('listenwell-playlists', []))
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null)
  const [songFilter, setSongFilter] = useState('all')
  const [songSortBy, setSongSortBy] = useState('default')
  const [lovedSongIds, setLovedSongIds] = useState(() => parseStoredJSON('listenwell-loved', []))
  const [showNowPlayingAddMenu, setShowNowPlayingAddMenu] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(() => safeGetStorage('listenwell-repeat', 'off'))
  const [showNowPlaying, setShowNowPlaying] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [volumeNormalization, setVolumeNormalization] = useState(() => safeGetStorage('listenwell-vnorm', 'true') !== 'false')
  const [playCounts, setPlayCounts] = useState(() => parseStoredJSON('listenwell-playcounts', {}))
  const [playlistAccentOverride, setPlaylistAccentOverride] = useState(null)
  const audioRef = useRef(null)
  const audioContextRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const gainNodeRef = useRef(null)
  const bassFilterRef = useRef(null)
  const analyserRef = useRef(null)
  const visualizerDataRef = useRef(null)
  const visualizerFrameRef = useRef(null)
  const visualizerCanvasRef = useRef(null)
  const [recentItems, setRecentItems] = useState([])
  const [showLogoSymbol, setShowLogoSymbol] = useState(true)
  const [theme, setTheme] = useState(() => normalizeThemeId(safeGetStorage('listenwell-theme', 'dark')))
  const [accentColor, setAccentColor] = useState('139 92 246')
  const [shimmer, setShimmer] = useState({ low: 0, mid: 0, high: 0 })
  const [settingsPosition, setSettingsPosition] = useState(() => {
    const parsed = parseStoredJSON('listenwell-settings-position', { x: 0, y: 0 })
    const x = Number(parsed?.x)
    const y = Number(parsed?.y)
    return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }
  })
  const [isDraggingSettings, setIsDraggingSettings] = useState(false)
  const [eqBands, setEqBands] = useState(Array.from({ length: 12 }, () => 0.3))
  const [showAccountDrawer, setShowAccountDrawer] = useState(false)
  const [showLogoMenu, setShowLogoMenu] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [aboutModalPos, setAboutModalPos] = useState({ x: 0, y: 0 })
  const [isDraggingAbout, setIsDraggingAbout] = useState(false)
  const aboutModalRef = useRef(null)
  const aboutDragOffsetRef = useRef({ x: 0, y: 0 })
  const [showListeningHistoryModal, setShowListeningHistoryModal] = useState(false)
  const [historyModalPos, setHistoryModalPos] = useState({ x: 0, y: 0 })
  const [isDraggingHistory, setIsDraggingHistory] = useState(false)
  const historyModalRef = useRef(null)
  const historyDragOffsetRef = useRef({ x: 0, y: 0 })
  const [listeningHistory, setListeningHistory] = useState([])
  const [savedPresets, setSavedPresets] = useState(() => parseStoredJSON('listenwell-presets', []))
  const [auroraIntensity, setAuroraIntensity] = useState(() => Number(safeGetStorage('listenwell-aurora-intensity', '0.75')))
  const [glowSoftness, setGlowSoftness] = useState(() => Number(safeGetStorage('listenwell-glow-softness', '0.65')))
  const [blurAmount, setBlurAmount] = useState(() => Number(safeGetStorage('listenwell-blur-amount', '0.7')))
  const settingsButtonRef = useRef(null)
  const settingsPanelRef = useRef(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const logoMenuRef = useRef(null)
  const nowPlayingMenuRef = useRef(null)
  const stateRef = useRef({})
  const analyzeQueueRef = useRef([])

  const markSongHistory = useCallback((song) => {
    if (!song?.id) return
    setListeningHistory((prev) =>
      [{ id: song.id, title: song.title || song.fileName || 'Untitled' }, ...prev].slice(0, 100),
    )
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
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    if (!sourceNodeRef.current) {
      const source = ctx.createMediaElementSource(audioEl)
      const gain = ctx.createGain()
      const bass = ctx.createBiquadFilter()
      const analyser = ctx.createAnalyser()
      bass.type = 'lowshelf'
      bass.frequency.value = 200
      analyser.fftSize = 128
      source.connect(gain)
      gain.connect(bass)
      bass.connect(analyser)
      analyser.connect(ctx.destination)
      sourceNodeRef.current = source
      gainNodeRef.current = gain
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
    setShimmer({ low: lowSum / bandSize, mid: midSum / bandSize, high: highSum / bandSize })
    visualizerFrameRef.current = requestAnimationFrame(runVisualizerFrame)
  }, [])

  const handleParallaxMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    event.currentTarget.style.setProperty('--rx', `${-y * 3.5}deg`)
    event.currentTarget.style.setProperty('--ry', `${x * 4.9}deg`)
    event.currentTarget.style.setProperty('--mx', `${(x + 1) * 50}%`)
    event.currentTarget.style.setProperty('--my', `${(y + 1) * 50}%`)
  }

  const handleParallaxLeave = (event) => {
    event.currentTarget.style.setProperty('--rx', '0deg')
    event.currentTarget.style.setProperty('--ry', '0deg')
    event.currentTarget.style.setProperty('--mx', '50%')
    event.currentTarget.style.setProperty('--my', '50%')
  }

  // Brief crossfade out before switching tracks (300ms)
  const crossfade = useCallback((callback) => {
    const audio = audioRef.current
    if (!audio || audio.paused) { callback(); return }
    let step = 0
    const steps = 12
    const startVol = audio.volume
    const id = setInterval(() => {
      step++
      audio.volume = Math.max(0, startVol * (1 - step / steps))
      if (step >= steps) {
        clearInterval(id)
        audio.volume = startVol
        callback()
      }
    }, 25)
  }, [])

  const toggleLovedSong = (songId) => {
    setLovedSongIds((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [songId, ...prev],
    )
  }

  const handleToggleRepeat = () => {
    setRepeat((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'))
  }

  const createPlaylistWithSong = (songId) => {
    const id = createSafeId('playlist')
    setPlaylists((prev) => [
      ...prev,
      { id, name: `Playlist ${prev.length + 1}`, description: '', coverUrl: null, songIds: [songId] },
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
      let r = 0; let g = 0; let b = 0; let count = 0
      for (let i = 0; i < pixels.length; i += 16) {
        r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++
      }
      setAccentColor(`${Math.round(r / count)} ${Math.round(g / count)} ${Math.round(b / count)}`)
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
      theme, eqPreset, volume, playbackRate, auroraIntensity, glowSoftness, blurAmount,
    }
    setSavedPresets((prev) => [preset, ...prev].slice(0, 10))
  }

  const applyPreset = (preset) => {
    setTheme(normalizeThemeId(preset.theme))
    setEqPreset(preset.eqPreset)
    setVolume(preset.volume)
    setPlaybackRate(preset.playbackRate)
    setAuroraIntensity(preset.auroraIntensity)
    setGlowSoftness(preset.glowSoftness)
    setBlurAmount(preset.blurAmount)
  }

  const processAudioFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || [])
    const audioFiles = files.filter((f) => f.type.startsWith('audio/') || f.type === 'video/webm' || f.type === 'video/ogg' || f.name.match(/\.(webm|ogg|opus|m4a)$/i))
    if (audioFiles.length === 0) return

    // Build basic song objects immediately (ID3 tags are fast)
    const newSongs = await Promise.all(
      audioFiles.map(async (f) => {
        const id = stableSongId(f.name)
        const tags = await readAudioTags(f)

        let coverUrl = null
        if (tags?.picture) {
          const { data, format } = tags.picture
          try {
            const blob = new Blob([data], { type: format || 'image/jpeg' })
            coverUrl = URL.createObjectURL(blob)
          } catch { coverUrl = null }
        }

        return {
          id,
          title: tags?.title || f.name.replace(/\.[^/.]+$/, ''),
          fileName: f.name,
          url: URL.createObjectURL(f),
          artist: tags?.artist || '',
          album: tags?.album || '',
          coverUrl,
          description: '',
          lyrics: '',
          gainDb: 0,
          bpm: null,
          _file: f, // temporary, removed after analysis
        }
      }),
    )

    setSongs((prev) => {
      const existingIds = new Set(prev.map((s) => s.id))
      const toAdd = newSongs.filter((s) => !existingIds.has(s.id))
      // Strip the temporary _file field from state
      return [...prev, ...toAdd.map(({ _file: _, ...rest }) => rest)]
    })
    setActivePage('songs')
    if (stateRef.current.currentTrackIndex == null && newSongs.length > 0) {
      setSelectedSongIndex(0)
      setCurrentTrackIndex(0)
    }

    // Background analysis: BPM + volume normalisation (non-blocking)
    for (const song of newSongs) {
      const f = song._file
      if (!f) continue
      analyzeAudio(f).then(({ gainDb, bpm }) => {
        setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, gainDb, bpm } : s))
      }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = (e) => {
    processAudioFiles(e.target.files || [])
    if (e?.target) e.target.value = ''
  }

  const handleDeleteSong = (songId) => {
    const idx = songs.findIndex((s) => s.id === songId)
    if (idx === -1) return
    if (currentTrackIndex === idx) {
      audioRef.current?.pause()
      setIsPlaying(false)
      setCurrentTrackIndex(null)
    } else if (currentTrackIndex !== null && currentTrackIndex > idx) {
      setCurrentTrackIndex(currentTrackIndex - 1)
    }
    if (selectedSongIndex === idx) {
      const remaining = songs.length - 1
      setSelectedSongIndex(remaining > 0 ? Math.min(idx, remaining - 1) : null)
    } else if (selectedSongIndex !== null && selectedSongIndex > idx) {
      setSelectedSongIndex(selectedSongIndex - 1)
    }
    setSongs((prev) => prev.filter((s) => s.id !== songId))
    setLovedSongIds((prev) => prev.filter((id) => id !== songId))
    setPlaylists((prev) =>
      prev.map((pl) => ({ ...pl, songIds: pl.songIds.filter((id) => id !== songId) })),
    )
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
    const song = songs[index]
    markRecent('song', song?.id)
    markSongHistory(song)
    if (song?.id) {
      setPlayCounts((prev) => ({ ...prev, [song.id]: (prev[song.id] || 0) + 1 }))
    }
    setTimeout(() => {
      if (!audioRef.current) return
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }, 0)
  }

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
    if (isPlaying && audio.paused) audio.play().catch(() => setIsPlaying(false))
    if (!isPlaying && !audio.paused) audio.pause()
  }, [isPlaying, currentTrackUrl, effectivePlaybackRate, volume])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.playbackRate = effectivePlaybackRate
  }, [effectivePlaybackRate])

  useEffect(() => {
    if (eqPreset === 'bass') {
      ensureAudioGraph()
      if (bassFilterRef.current) bassFilterRef.current.gain.value = 10
    } else {
      if (bassFilterRef.current) bassFilterRef.current.gain.value = 0
    }
  }, [eqPreset])

  useEffect(() => { ensureAudioGraph() }, [])

  useEffect(() => { safeSetStorage('listenwell-theme', theme) }, [theme])
  useEffect(() => { safeSetStorage('listenwell-settings-position', JSON.stringify(settingsPosition)) }, [settingsPosition])
  useEffect(() => { safeSetStorage('listenwell-presets', JSON.stringify(savedPresets)) }, [savedPresets])
  useEffect(() => { safeSetStorage('listenwell-aurora-intensity', String(auroraIntensity)) }, [auroraIntensity])
  useEffect(() => { safeSetStorage('listenwell-glow-softness', String(glowSoftness)) }, [glowSoftness])
  useEffect(() => { safeSetStorage('listenwell-blur-amount', String(blurAmount)) }, [blurAmount])
  useEffect(() => { safeSetStorage('listenwell-repeat', repeat) }, [repeat])
  useEffect(() => { safeSetStorage('listenwell-loved', JSON.stringify(lovedSongIds)) }, [lovedSongIds])
  useEffect(() => { safeSetStorage('listenwell-playlists', JSON.stringify(playlists)) }, [playlists])
  useEffect(() => { safeSetStorage('listenwell-playcounts', JSON.stringify(playCounts)) }, [playCounts])
  useEffect(() => { safeSetStorage('listenwell-vnorm', String(volumeNormalization)) }, [volumeNormalization])

  // Apply per-song gain normalisation whenever the track changes
  useEffect(() => {
    if (!gainNodeRef.current) return
    const song = songs[currentTrackIndex]
    const db = volumeNormalization && song?.gainDb ? song.gainDb : 0
    gainNodeRef.current.gain.value = Math.min(4, Math.max(0.25, Math.pow(10, db / 20)))
  }, [currentTrackIndex, volumeNormalization, songs])

  // Override accent with playlist colour when on playlist-detail page
  useEffect(() => {
    if (activePage === 'playlist-detail' && selectedPlaylistId) {
      const pl = playlists.find((p) => p.id === selectedPlaylistId)
      const preset = ACCENT_PRESETS.find((c) => c.hex === pl?.accentColor)
      setPlaylistAccentOverride(preset?.rgb || null)
    } else {
      setPlaylistAccentOverride(null)
    }
  }, [activePage, selectedPlaylistId, playlists])

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

  const SETTINGS_PANEL_W = 320
  const SETTINGS_PANEL_H = 440

  const clampSettingsPosition = (x, y) => ({
    x: Math.max(8, Math.min(window.innerWidth - SETTINGS_PANEL_W - 8, x)),
    y: Math.max(8, Math.min(window.innerHeight - SETTINGS_PANEL_H - 8, y)),
  })

  const openSettingsPanel = () => {
    let nextX = settingsPosition.x
    let nextY = settingsPosition.y
    if (nextX === 0 && nextY === 0 && settingsButtonRef.current) {
      const br = settingsButtonRef.current.getBoundingClientRect()
      nextX = br.left - 120
      nextY = br.top - SETTINGS_PANEL_H - 16
    }
    const clamped = clampSettingsPosition(nextX, nextY)
    setSettingsPosition(clamped)
    setShowSettings(true)
  }

  const closeSettingsPanel = () => setShowSettings(false)

  useEffect(() => {
    if (!showLogoMenu) return
    const onDown = (event) => {
      if (!logoMenuRef.current?.contains(event.target)) setShowLogoMenu(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [showLogoMenu])

  useEffect(() => {
    if (!showNowPlayingAddMenu) return
    const onDown = (event) => {
      if (!nowPlayingMenuRef.current?.contains(event.target)) setShowNowPlayingAddMenu(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [showNowPlayingAddMenu])

  useEffect(() => {
    if (!isDraggingSettings) return
    const onMove = (event) => {
      const maxX = window.innerWidth - SETTINGS_PANEL_W - 8
      const maxY = window.innerHeight - SETTINGS_PANEL_H - 8
      setSettingsPosition({
        x: Math.max(8, Math.min(maxX, event.clientX - dragOffsetRef.current.x)),
        y: Math.max(8, Math.min(maxY, event.clientY - dragOffsetRef.current.y)),
      })
    }
    const onUp = () => setIsDraggingSettings(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isDraggingSettings])

  useEffect(() => {
    if (!isDraggingAbout) return
    const onMove = (e) => setAboutModalPos({
      x: Math.max(0, Math.min(window.innerWidth - 560, e.clientX - aboutDragOffsetRef.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 180, e.clientY - aboutDragOffsetRef.current.y)),
    })
    const onUp = () => setIsDraggingAbout(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isDraggingAbout])

  useEffect(() => {
    if (!isDraggingHistory) return
    const onMove = (e) => setHistoryModalPos({
      x: Math.max(0, Math.min(window.innerWidth - 520, e.clientX - historyDragOffsetRef.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 300, e.clientY - historyDragOffsetRef.current.y)),
    })
    const onUp = () => setIsDraggingHistory(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isDraggingHistory])

  useEffect(() => {
    if (isPlaying) {
      visualizerFrameRef.current = requestAnimationFrame(runVisualizerFrame)
    } else if (visualizerFrameRef.current) {
      cancelAnimationFrame(visualizerFrameRef.current)
      visualizerFrameRef.current = null
    }
    return () => {
      if (visualizerFrameRef.current) { cancelAnimationFrame(visualizerFrameRef.current); visualizerFrameRef.current = null }
    }
  }, [isPlaying, currentTrackIndex, runVisualizerFrame])

  useEffect(() => {
    if (!isPlaying) return undefined
    let frameId = null
    const tick = () => {
      if (audioRef.current && !audioRef.current.paused) setCurrentTime(audioRef.current.currentTime)
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => { if (frameId) cancelAnimationFrame(frameId) }
  }, [isPlaying])

  // Keep stateRef fresh so the keyboard handler always reads current state
  stateRef.current = { isPlaying, currentTrackIndex, songs, shuffle, repeat }

  useEffect(() => {
    const onKeyDown = (e) => {
      const target = e.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return

      const { isPlaying: playing, currentTrackIndex: trackIdx } = stateRef.current

      if (e.key === ' ') {
        if (trackIdx == null) return
        e.preventDefault()
        const audio = audioRef.current
        if (playing) { audio?.pause(); setIsPlaying(false) }
        else { audio?.play().catch(() => {}); setIsPlaying(true) }
      }

      if (e.key === '?') {
        e.preventDefault()
        setShowKeyboardShortcuts((prev) => !prev)
      }

      if (e.key === 'ArrowLeft' && trackIdx != null) {
        e.preventDefault()
        handlePrev()
      }

      if (e.key === 'ArrowRight' && trackIdx != null) {
        e.preventDefault()
        handleNext()
      }

      if (e.key === 'Escape') {
        setShowKeyboardShortcuts(false)
        setShowNowPlaying(false)
        setShowQueue(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePlayPause = () => {
    const audio = audioRef.current
    if (!audio || currentTrackIndex == null) return
    if (isPlaying) audio.pause()
    else audio.play().catch(() => {})
    setIsPlaying(!isPlaying)
  }

  const handlePrev = () => {
    if (songs.length === 0) return
    const next = currentTrackIndex === null ? 0 : (currentTrackIndex - 1 + songs.length) % songs.length
    crossfade(() => {
      setCurrentTrackIndex(next)
      setSelectedSongIndex(next)
      setIsPlaying(true)
      markRecent('song', songs[next]?.id)
      markSongHistory(songs[next])
    })
  }

  const handleNext = () => {
    if (songs.length === 0) return
    const { shuffle: sh, currentTrackIndex: cur, songs: ss } = stateRef.current
    let next
    if (sh && ss.length > 1) {
      do { next = Math.floor(Math.random() * ss.length) } while (next === cur)
    } else {
      next = cur === null ? 0 : (cur + 1) % ss.length
    }
    crossfade(() => {
      setCurrentTrackIndex(next)
      setSelectedSongIndex(next)
      setIsPlaying(true)
      markRecent('song', ss[next]?.id)
      markSongHistory(ss[next])
    })
  }

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const t = Number(e.target.value)
    audio.currentTime = t
    setCurrentTime(t)
  }

  const handleVolumeChange = (e) => setVolume(Number(e.target.value))

  const handleMetadataChange = (field, value) => {
    setSongs((prev) =>
      prev.map((song, index) => (index === selectedSongIndex ? { ...song, [field]: value } : song)),
    )
  }

  const handleCoverUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSongs((prev) =>
      prev.map((song, index) =>
        index === selectedSongIndex ? { ...song, coverUrl: URL.createObjectURL(file) } : song,
      ),
    )
  }

  const selectedSong = selectedSongIndex !== null ? songs[selectedSongIndex] : null

  const pageTransition = {
    initial: { opacity: 0, y: 16, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: -12, filter: 'blur(8px)' },
  }

  const NAV_TABS = [
    { id: 'library', label: 'Library', icon: Library },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'songs', label: 'Songs', icon: Music2 },
    { id: 'upload', label: 'Upload', icon: Upload },
  ]

  return (
    <div
      data-theme={theme}
      className="relative flex flex-col min-h-screen w-full bg-[#0c0c0e] text-gray-100 overflow-hidden"
      style={{
        '--accent-rgb': playlistAccentOverride || accentColor,
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
          const { repeat: rep, songs: ss, currentTrackIndex: cur } = stateRef.current
          if (rep === 'one') {
            const audio = audioRef.current
            if (audio) { audio.currentTime = 0; audio.play().catch(() => {}) }
          } else if (ss.length > 1 || rep === 'all') {
            handleNext()
          } else {
            setIsPlaying(false)
          }
        }}
      />

      {/* Header */}
      <header className="relative z-10 shrink-0 h-16 sm:h-20 border-b border-white/10 bg-black/40 flex items-center px-4 sm:px-8 gap-4">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <Music2 className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400" />
            <span
              className="text-xs sm:text-sm font-semibold tracking-widest text-white/70 hidden sm:block"
              style={{ fontFamily: "'Orbitron', system-ui, sans-serif" }}
            >
              LW
            </span>
          </div>
          {nowPlaying && (
            <div className="hidden md:flex items-center gap-2 pl-4 border-l border-white/10 text-[11px] text-gray-500 min-w-0 max-w-[160px]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 animate-pulse" />
              <span className="truncate">{nowPlaying.title || nowPlaying.fileName}</span>
            </div>
          )}
        </div>

        {/* Nav — hidden on mobile, shown sm+ */}
        <nav className="flex-1 hidden sm:flex items-center justify-center gap-2 sm:gap-3">
          {NAV_TABS.map((tab) => (
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
              <UploadScreen onUpload={handleUpload} onDrop={processAudioFiles} />
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
                <h2 className="section-title text-base sm:text-lg text-white text-center">Recently played</h2>
                <p className="text-xs text-gray-500 text-center">Songs and playlists you&apos;ve listened to most recently.</p>
              </div>
              <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-sm px-4 sm:px-5 py-3 sm:py-4 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                  {recentItems
                    .map((item) => {
                      if (item.type === 'song') {
                        const song = songs.find((s) => s.id === item.id)
                        if (!song) return null
                        return { kind: 'song', key: `song-${song.id}`, song }
                      }
                      if (item.type === 'playlist') {
                        const pl = playlists.find((p) => p.id === item.id)
                        if (!pl) return null
                        return { kind: 'playlist', key: `pl-${pl.id}`, playlist: pl }
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
                            const idx = songs.findIndex((s) => s.id === entry.song.id)
                            if (idx !== -1) handlePlaySongClick(idx)
                          }}
                          className="flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-1 transition-all duration-200 hover:bg-white/[0.04]"
                        >
                          <div className="w-full aspect-square rounded-xl bg-white/[0.06] overflow-hidden flex items-center justify-center shadow-inner">
                            {entry.song.coverUrl
                              ? <img src={entry.song.coverUrl} alt="" className="w-full h-full object-cover" />
                              : <Music2 className="w-11 h-11 opacity-60 text-violet-300" />
                            }
                          </div>
                          <p className="text-sm font-medium truncate text-white/95">{entry.song.title || entry.song.fileName}</p>
                          {entry.song.artist ? <p className="text-xs text-gray-500 truncate">{entry.song.artist}</p> : null}
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
                          <p className="text-sm font-medium truncate text-white/95">{entry.playlist.name}</p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {entry.playlist.songIds.filter((id) => songs.some((s) => s.id === id)).length} tracks
                          </p>
                        </button>
                      ),
                    )}
                  {recentItems.length === 0 && (
                    <p className="text-xs sm:text-sm text-gray-500 col-span-full">
                      Nothing here yet. Start playing songs or playlists and they&apos;ll show up in your Library.
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
                playCounts={playCounts}
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
                onDeleteSong={handleDeleteSong}
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
                songs={songs}
                selectedPlaylistId={selectedPlaylistId}
                accentPresets={ACCENT_PRESETS}
                onCreatePlaylist={({ name, description, coverUrl, accentColor: ac }) => {
                  const trimmedName = name.trim()
                  if (!trimmedName) return
                  const id = createSafeId('playlist')
                  setPlaylists((prev) => [
                    ...prev,
                    { id, name: trimmedName, description: description || '', coverUrl: coverUrl || null, accentColor: ac || null, songIds: [] },
                  ])
                  setSelectedPlaylistId(id)
                }}
                onUpdatePlaylist={(playlistId, updates) => {
                  setPlaylists((prev) =>
                    prev.map((pl) => (pl.id === playlistId ? { ...pl, ...updates } : pl)),
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
                currentTrackIndex={currentTrackIndex}
                isPlaying={isPlaying}
                accentPresets={ACCENT_PRESETS}
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
                    prev.map((pl) => (pl.id === playlistId ? { ...pl, ...updates } : pl)),
                  )
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile bottom nav (visible sm and below) */}
      <nav className="flex sm:hidden shrink-0 border-t border-white/10 bg-black/60 backdrop-blur-xl">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activePage === tab.id || (tab.id === 'playlists' && activePage === 'playlist-detail')
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePage(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
                isActive ? 'text-violet-400' : 'text-gray-600'
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Settings Panel */}
      {showSettings && (
        <div
          ref={settingsPanelRef}
          className="fixed z-[100] w-80 rounded-2xl bg-black/80 border border-white/10 shadow-xl backdrop-blur-xl p-4 flex flex-col gap-3 glass-card"
          style={{ left: settingsPosition.x, top: settingsPosition.y }}
        >
          <div
            className="flex items-center justify-between mb-1 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={startSettingsDrag}
          >
            <span className="text-sm font-semibold text-white">Settings</span>
            <button type="button" onClick={closeSettingsPanel} className="text-gray-500 hover:text-white text-xs">
              Close
            </button>
          </div>
          <div className="flex gap-2 mb-1 text-xs">
            {['playback', 'appearance'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSettingsTab(tab)}
                className={`flex-1 py-1.5 rounded-full border capitalize ${
                  settingsTab === tab
                    ? 'border-violet-500/70 bg-violet-500/10 text-white'
                    : 'border-white/10 text-gray-400 hover:border-white/30'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {settingsTab === 'playback' && (
            <div className="flex flex-col gap-3 text-xs text-gray-300">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Playback speed</span>
                  <span className="tabular-nums text-cyan-300 font-semibold tracking-wide">
                    {effectivePlaybackRate.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.005}
                  value={playbackRate <= 1 ? (playbackRate - 0.25) / 0.75 * 0.5 : 0.5 + (playbackRate - 1) / 4}
                  onInput={(e) => {
                    const n = Number(e.target.value)
                    setPlaybackRate(n <= 0.5 ? 0.25 + n * 1.5 : 1 + (n - 0.5) * 4)
                  }}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setPlaybackRate(n <= 0.5 ? 0.25 + n * 1.5 : 1 + (n - 0.5) * 4)
                  }}
                  className="w-full h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <div className="relative text-[10px] text-gray-500 h-3">
                  <span className="absolute left-0">0.25×</span>
                  <span className="absolute left-1/2 -translate-x-1/2">1×</span>
                  <span className="absolute right-0">3×</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Equalizer</span>
                <div className="flex gap-2">
                  {[{ id: 'normal', label: 'Normal' }, { id: 'bass', label: 'Bass boost' }, { id: 'bright', label: 'Bright' }].map((preset) => (
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
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Volume normalisation</span>
                <button
                  type="button"
                  onClick={() => setVolumeNormalization((prev) => !prev)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${volumeNormalization ? 'bg-violet-600' : 'bg-white/20'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${volumeNormalization ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
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
                  {[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'sunset', label: 'Sunset' }, { id: 'pink', label: 'Pink' }].map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => setTheme(normalizeThemeId(scene.id))}
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
              <div className="flex flex-col gap-2">
                <span className="font-medium">Theme intensity</span>
                {[
                  { label: 'Aurora strength', value: auroraIntensity, min: 0.2, max: 1.2, onChange: setAuroraIntensity },
                  { label: 'Glow softness', value: glowSoftness, min: 0.25, max: 1.25, onChange: setGlowSoftness },
                  { label: 'Blur amount', value: blurAmount, min: 0.25, max: 1.35, onChange: setBlurAmount },
                ].map(({ label, value, min, max, onChange }) => (
                  <label key={label} className="text-[11px] text-gray-400 flex flex-col gap-1">
                    {label}
                    <input
                      type="range" min={min} max={max} step={0.05} value={value}
                      onChange={(e) => onChange(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-200"
                    />
                  </label>
                ))}
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
        <div className="cat-hanging" aria-hidden />

        {/* Album art — click to open NowPlaying overlay */}
        <button
          type="button"
          onClick={() => nowPlaying && setShowNowPlaying(true)}
          style={{ display: 'flex', overflow: 'hidden', flexShrink: 0 }}
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white/[0.08] items-center justify-center text-2xl transition-transform ${nowPlaying ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}`}
          aria-label="Open now playing"
        >
          {nowPlaying?.coverUrl
            ? <img src={nowPlaying.coverUrl} alt="" className="w-full h-full object-cover" />
            : <Music2 className="w-8 h-8 text-violet-300/80" />
          }
        </button>

        <div ref={nowPlayingMenuRef} className="w-40 sm:w-52 min-w-0 relative">
          <div className="flex items-center gap-2">
            <p className="text-sm sm:text-base font-semibold truncate text-white/95 flex-1">
              {nowPlaying ? nowPlaying.title || nowPlaying.fileName : 'No song selected'}
            </p>
            {nowPlaying && (
              <button
                type="button"
                onClick={() => setShowNowPlayingAddMenu((prev) => !prev)}
                className="w-5 h-5 rounded-full border border-white/30 inline-flex items-center justify-center text-gray-200 hover:border-white/70"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 truncate">
            {nowPlaying?.artist || (nowPlaying ? 'Unknown artist' : '—')}
          </p>
          {showNowPlayingAddMenu && nowPlaying && (
            <div className="absolute z-30 right-0 bottom-[calc(100%+0.35rem)] w-52 max-h-[min(50vh,280px)] overflow-y-auto rounded-xl border border-white/12 bg-[#0e1016]/95 backdrop-blur-xl p-2 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => { toggleLovedSong(nowPlaying.id); setShowNowPlayingAddMenu(false) }}
                className="w-full rounded-lg hover:bg-white/10 px-3 py-2"
              >
                <div className="flex items-center gap-2 text-sm text-gray-200 whitespace-nowrap">
                  <Heart className="w-4 h-4 shrink-0" fill={lovedSongIds.includes(nowPlaying.id) ? 'currentColor' : 'none'} />
                  <span>{lovedSongIds.includes(nowPlaying.id) ? 'Unlove song' : 'Love song'}</span>
                </div>
              </button>
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => {
                    setPlaylists((prev) =>
                      prev.map((item) =>
                        item.id === pl.id && !item.songIds.includes(nowPlaying.id)
                          ? { ...item, songIds: [...item.songIds, nowPlaying.id] }
                          : item,
                      ),
                    )
                    setShowNowPlayingAddMenu(false)
                  }}
                  className="w-full rounded-lg hover:bg-white/10 px-3 py-2 text-left"
                >
                  <span className="text-xs text-gray-300 whitespace-nowrap truncate block">Add to {pl.name}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { createPlaylistWithSong(nowPlaying.id); setShowNowPlayingAddMenu(false) }}
                className="w-full rounded-lg hover:bg-white/10 px-3 py-2 text-left"
              >
                <span className="text-xs text-cyan-300 whitespace-nowrap">+ Create playlist &amp; add</span>
              </button>
            </div>
          )}
        </div>

        {/* Playback controls */}
        <div className="flex-1 flex flex-col items-center gap-2 min-w-0 max-w-2xl">
          <div className="flex gap-4 sm:gap-5 items-center">
            <button
              type="button"
              onClick={() => setShuffle((prev) => !prev)}
              disabled={songs.length === 0}
              title={shuffle ? 'Shuffle on' : 'Shuffle off'}
              className={`magnetic-hover p-1.5 sm:p-2 transition disabled:opacity-30 disabled:cursor-not-allowed ${shuffle ? 'text-violet-400' : 'text-gray-500 hover:text-white'}`}
            >
              <Shuffle className="w-5 h-5" />
            </button>
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
              {isPlaying ? <Pause className="w-6 h-6 ml-0.5" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={songs.length === 0}
              className="magnetic-hover p-1.5 sm:p-2 text-gray-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipForward className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={handleToggleRepeat}
              disabled={songs.length === 0}
              title={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
              className={`magnetic-hover p-1.5 sm:p-2 transition disabled:opacity-30 disabled:cursor-not-allowed ${repeat !== 'off' ? 'text-violet-400' : 'text-gray-500 hover:text-white'}`}
            >
              {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>
          </div>
          <div className="w-full flex items-center gap-3 text-xs sm:text-sm text-gray-500">
            <span className="w-10 shrink-0 tabular-nums text-right">{formatTime(currentTime)}</span>
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
            <span className="w-10 shrink-0 tabular-nums">{formatTime(duration)}</span>
          </div>
          <canvas
            ref={visualizerCanvasRef}
            className="w-full h-8 rounded-lg bg-white/[0.04] border border-white/10"
            aria-label="Live audio visualizer"
          />
        </div>

        {/* Volume + utility buttons */}
        <div className="flex items-center gap-2 sm:gap-3 text-gray-500 shrink-0">
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
          <button
            type="button"
            onClick={() => setShowQueue((prev) => !prev)}
            title="Queue"
            className={`magnetic-hover p-2 rounded-lg transition-colors ${showQueue ? 'text-violet-400' : 'text-gray-500 hover:text-white'}`}
          >
            <ListMusic className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowKeyboardShortcuts((prev) => !prev)}
            title="Keyboard shortcuts (?)"
            className={`magnetic-hover p-2 rounded-lg transition-colors ${showKeyboardShortcuts ? 'text-violet-400' : 'text-gray-500 hover:text-white'}`}
          >
            <Keyboard className="w-5 h-5" />
          </button>
        </div>

        <button
          ref={settingsButtonRef}
          type="button"
          onClick={() => (showSettings ? closeSettingsPanel() : openSettingsPanel())}
          className="magnetic-hover ml-1 flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-white/30 text-gray-200 hover:text-white hover:border-white/70 bg-white/5 shrink-0"
        >
          <Settings2 className="w-7 h-7 sm:w-8 sm:h-8" />
        </button>

        {/* listenWell logo + account button */}
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
                <button
                  type="button"
                  onClick={() => { setShowAccountDrawer(true); setShowLogoMenu(false) }}
                  className="w-full rounded-lg hover:bg-white/10 px-3 py-2"
                >
                  <div className="flex items-center gap-2.5 text-sm text-gray-200 whitespace-nowrap">
                    <UserCircle2 className="w-4 h-4 shrink-0 text-gray-400" />
                    <span>Account</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAboutModalPos({ x: Math.max(0, window.innerWidth / 2 - 280), y: Math.max(0, window.innerHeight / 2 - 110) })
                    setShowAboutModal(true)
                    setShowLogoMenu(false)
                  }}
                  className="w-full rounded-lg hover:bg-white/10 px-3 py-2"
                >
                  <div className="flex items-center gap-2.5 text-sm text-gray-200 whitespace-nowrap">
                    <Info className="w-4 h-4 shrink-0 text-gray-400" />
                    <span>About us</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryModalPos({ x: Math.max(0, window.innerWidth / 2 - 260), y: Math.max(0, window.innerHeight / 2 - 180) })
                    setShowListeningHistoryModal(true)
                    setShowLogoMenu(false)
                  }}
                  className="w-full rounded-lg hover:bg-white/10 px-3 py-2"
                >
                  <div className="flex items-center gap-2.5 text-sm text-gray-200 whitespace-nowrap">
                    <History className="w-4 h-4 shrink-0 text-gray-400" />
                    <span>Listening history</span>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {showAboutModal && (
          <motion.div
            ref={aboutModalRef}
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed z-50 w-[min(92vw,560px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 p-5 shadow-2xl glass-card"
            style={{ left: aboutModalPos.x, top: aboutModalPos.y }}
          >
            <div
              className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing select-none"
              onMouseDown={(e) => {
                if (!aboutModalRef.current) return
                const rect = aboutModalRef.current.getBoundingClientRect()
                aboutDragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
                setIsDraggingAbout(true)
              }}
            >
              <h3 className="text-base font-semibold text-cyan-200">About ListenWell</h3>
              <button type="button" onClick={() => setShowAboutModal(false)} className="text-xs text-gray-400 hover:text-white">Close</button>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed">
              ListenWell was built out of a simple frustration — why pay a monthly fee just to listen to music you already have? I&apos;m a student who believes your music should be yours, fully and without conditions. No algorithms deciding what you hear next. No subscriptions. No data harvesting. Just your library, the way you want it.
            </p>
            <p className="text-sm text-gray-400 mt-3">— Ben Krause</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showListeningHistoryModal && (
          <motion.div
            ref={historyModalRef}
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed z-50 w-[min(92vw,520px)] rounded-2xl border border-white/10 bg-[#0f1117]/95 p-5 shadow-2xl glass-card"
            style={{ left: historyModalPos.x, top: historyModalPos.y }}
          >
            <div
              className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing select-none"
              onMouseDown={(e) => {
                if (!historyModalRef.current) return
                const rect = historyModalRef.current.getBoundingClientRect()
                historyDragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
                setIsDraggingHistory(true)
              }}
            >
              <h3 className="text-base font-semibold text-cyan-200">Listening history</h3>
              <button type="button" onClick={() => setShowListeningHistoryModal(false)} className="text-xs text-gray-400 hover:text-white">Close</button>
            </div>
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
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAccountDrawer && (
          <>
            <motion.button
              type="button"
              onClick={() => setShowAccountDrawer(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              aria-label="Close account drawer"
            />
            <motion.aside
              initial={{ x: 340, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 340, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed right-4 top-4 bottom-4 z-50 w-[330px] rounded-2xl border border-white/10 bg-[#0f1117]/90 backdrop-blur-xl p-4 flex flex-col gap-4 glass-card"
            >
              <div className="flex items-center justify-between">
                <h3 className="section-title text-sm text-cyan-200">Account</h3>
                <button type="button" onClick={() => setShowAccountDrawer(false)} className="text-xs text-gray-400 hover:text-white">Close</button>
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
                          <button type="button" onClick={() => applyPreset(preset)} className="flex-1 text-center py-1 rounded-md border border-cyan-300/50 text-cyan-200 text-[11px]">Apply</button>
                          <button type="button" onClick={() => setSavedPresets((prev) => prev.filter((item) => item.id !== preset.id))} className="px-2 py-1 rounded-md border border-white/20 text-gray-300 text-[11px]">Delete</button>
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

      {/* Now Playing Overlay */}
      <AnimatePresence>
        {showNowPlaying && (
          <NowPlayingOverlay
            song={nowPlaying}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            shuffle={shuffle}
            repeat={repeat}
            lovedSongIds={lovedSongIds}
            lyrics={nowPlaying?.lyrics || ''}
            onMetadataChange={(field, value) => {
              if (currentTrackIndex != null)
                setSongs((prev) => prev.map((s, i) => i === currentTrackIndex ? { ...s, [field]: value } : s))
            }}
            onClose={() => setShowNowPlaying(false)}
            onPlayPause={handlePlayPause}
            onPrev={handlePrev}
            onNext={handleNext}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onToggleShuffle={() => setShuffle((prev) => !prev)}
            onToggleRepeat={handleToggleRepeat}
            onToggleLoved={toggleLovedSong}
          />
        )}
      </AnimatePresence>

      {/* Queue Panel */}
      <AnimatePresence>
        {showQueue && (
          <QueuePanel
            songs={songs}
            currentTrackIndex={currentTrackIndex}
            onClose={() => setShowQueue(false)}
            onPlaySong={(songId) => {
              const index = songs.findIndex((s) => s.id === songId)
              if (index !== -1) handlePlaySongClick(index)
            }}
          />
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {showKeyboardShortcuts && (
          <KeyboardShortcutsModal onClose={() => setShowKeyboardShortcuts(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
