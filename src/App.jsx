import { supabase } from './lib/supabase'
import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'
import { analyzeAudio } from './utils/audioAnalysis'
import UploadScreen from './components/UploadScreen'
import SongsScreen from './components/SongsScreen' 
import PlaylistsScreen from './components/PlaylistsScreen'
import PlaylistDetailScreen from './components/PlaylistDetailScreen'
import HomeScreen from './components/HomeScreen'
import NowPlayingOverlay from './components/NowPlayingOverlay'
import UpNextPanel from './components/UpNextPanel'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
import AuthScreen from './components/AuthScreen'
import LegalModal from './components/LegalModal'
import Equalizer from './components/Equalizer'
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
  ChevronDown,
  ImagePlus,
  Plus,
  Heart,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  Keyboard,
  Library,
  Upload,
  Home,
  SlidersVertical,
  Speaker,
  LayoutGrid,
  Shield,
  ScrollText,
} from 'lucide-react'

// Custom equalizer bands (Hz). First band is a low shelf, last a high shelf.
const EQ_BANDS = [
  { freq: 60, label: '60' },
  { freq: 170, label: '170' },
  { freq: 500, label: '500' },
  { freq: 1500, label: '1.5k' },
  { freq: 4500, label: '4.5k' },
  { freq: 12000, label: '12k' },
]

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
const THEMES = [
  { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'sunset', label: 'Sunset' },
  { id: 'pink', label: 'Pink' }, { id: 'cartoon', label: 'Cartoon' }, { id: 'terminal', label: 'Terminal' },
  { id: 'paper', label: 'Paper' }, { id: 'blueprint', label: 'Blueprint' }, { id: 'chrome', label: 'Chrome' },
  { id: 'bubblegum', label: 'Bubblegum' }, { id: 'ocean', label: 'Ocean' }, { id: 'ember', label: 'Ember' },
  { id: 'moss', label: 'Moss' },
]

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
    cartoon: 'cartoon',
    terminal: 'terminal',
    paper: 'paper',
    blueprint: 'blueprint',
    chrome: 'chrome',
    bubblegum: 'bubblegum',
    ocean: 'ocean',
    ember: 'ember',
    moss: 'moss',
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

// Signed URLs must outlive a listening session — 7 days
const SIGNED_URL_TTL = 60 * 60 * 24 * 7

// Per-account upload cap. Temporary while limits/monetization are decided.
const MAX_UPLOADS = 50

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  // Set when the user opens a password-reset link from their email; Supabase
  // creates a recovery session and we show the "set new password" screen.
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [uploadNotice, setUploadNotice] = useState(null)
  const uploadNoticeTimerRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showMetadataModal, setShowMetadataModal] = useState(false)
  const [pendingEditSongId, setPendingEditSongId] = useState(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsModalTab, setSettingsModalTab] = useState('account')
  const [songs, setSongs] = useState([])
  const [selectedSongIndex, setSelectedSongIndex] = useState(null)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    const v = Number(safeGetStorage('listenwell-volume', '0.75'))
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.75
  })
  const [playbackRate, setPlaybackRate] = useState(() => {
    const r = Number(safeGetStorage('listenwell-rate', '1'))
    return Number.isFinite(r) ? clampPlaybackRate(r) : 1
  })
  const [eqPreset, setEqPreset] = useState(() => safeGetStorage('listenwell-eqpreset', 'normal'))
  const [activePage, setActivePage] = useState('upload')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('playback')
  const [playlists, setPlaylists] = useState(() => parseStoredJSON('listenwell-playlists', []))
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null)
  const [songFilter, setSongFilter] = useState('all')
  const [songSortBy, setSongSortBy] = useState('default')
  const [songTileSize, setSongTileSize] = useState(() => safeGetStorage('listenwell-tile-size', 'medium'))
  const [lovedSongIds, setLovedSongIds] = useState(() => parseStoredJSON('listenwell-loved', []))
  const [showNowPlayingAddMenu, setShowNowPlayingAddMenu] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(() => safeGetStorage('listenwell-repeat', 'off'))
  const [showNowPlaying, setShowNowPlaying] = useState(false)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [volumeNormalization, setVolumeNormalization] = useState(() => safeGetStorage('listenwell-vnorm', 'true') !== 'false')
  const [playCounts, setPlayCounts] = useState(() => parseStoredJSON('listenwell-playcounts', {}))
  const [playlistAccentOverride, setPlaylistAccentOverride] = useState(null)
  const [songQueue, setSongQueue] = useState([])
  const audioRef = useRef(null)
  const audioContextRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const gainNodeRef = useRef(null)
  const bassFilterRef = useRef(null)
  const trebleFilterRef = useRef(null)
  const analyserRef = useRef(null)
  const visualizerDataRef = useRef(null)
  const visualizerFrameRef = useRef(null)
  const visualizerCanvasRef = useRef(null)
  const [recentItems, setRecentItems] = useState(() => parseStoredJSON('listenwell-recent', []))
  const [theme, setTheme] = useState(() => normalizeThemeId(safeGetStorage('listenwell-theme', 'dark')))
  const [eqRingColor, setEqRingColor] = useState(() => safeGetStorage('listenwell-eq-ring-color', 'accent'))
  const [customEqGains, setCustomEqGains] = useState(() => {
    const stored = parseStoredJSON('listenwell-custom-eq', null)
    return Array.isArray(stored) && stored.length === EQ_BANDS.length ? stored.map(Number) : EQ_BANDS.map(() => 0)
  })
  const [showGeneralSettings, setShowGeneralSettings] = useState(false)
  const [audioOutputs, setAudioOutputs] = useState([])
  const [outputDeviceId, setOutputDeviceId] = useState(() => safeGetStorage('listenwell-output', 'default'))
  const [accentColor, setAccentColor] = useState('139 92 246')
  // Shimmer is written straight to the root element's CSS vars from the
  // visualizer's rAF loop. Keeping it out of React state avoids a full App
  // re-render on every animation frame (~60fps) while a track plays.
  const rootRef = useRef(null)
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
  const [songsBgUrl, setSongsBgUrl] = useState(() => safeGetStorage('listenwell-songs-bg', null))
  const [songsBgBlur, setSongsBgBlur] = useState(() => Number(safeGetStorage('listenwell-songs-bg-blur', '8')))
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [legalTab, setLegalTab] = useState(null) // null | 'privacy' | 'terms'
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
  const [crossfadeDuration, setCrossfadeDuration] = useState(() => Number(safeGetStorage('listenwell-crossfade', '300')))
  const [artColorExtract, setArtColorExtract] = useState(() => safeGetStorage('listenwell-art-color', 'false') === 'true')
  const [showUpNext, setShowUpNext] = useState(false)
  const [profilePicUrl, setProfilePicUrl] = useState(() => safeGetStorage('listenwell-profile-pic', null))
  const [displayName, setDisplayName] = useState(() => safeGetStorage('listenwell-display-name', ''))
  const circularEqCanvasRef = useRef(null)
  const drawerEqCanvasRef = useRef(null)
  const eqRingColorRef = useRef('accent')
  const eqFiltersRef = useRef([])
  const customEqGainsRef = useRef(null)
  // Crossfade: a dedicated gain node fades the new track IN on the main
  // element, while a secondary <audio> plays the outgoing tail and fades OUT.
  const crossfadeAudioRef = useRef(null)
  const fadeGainRef = useRef(null)
  const crossfadeArmedRef = useRef(false)
  const handleNextRef = useRef(null)
  // A play counts only once it passes the halfway mark; reset each new play.
  const hasCountedRef = useRef(false)
  // Per-song fields not stored in the tracks table (description, gainDb, bpm),
  // persisted in user_state/localStorage so they survive a refresh.
  const [songMeta, setSongMeta] = useState(() => parseStoredJSON('listenwell-songmeta', {}))
  const songMetaRef = useRef(songMeta)
  songMetaRef.current = songMeta

  // Auth effect — check session on mount and listen for changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      // Only update when the identity actually changes. Supabase fires this on
      // every background token refresh with a fresh user object; replacing the
      // reference each time would re-run the library/state loaders on a ~30s
      // loop and add auth-lock churn.
      const next = session?.user ?? null
      setUser((prev) => (prev?.id === next?.id ? prev : next))
    })

    return () => subscription.unsubscribe()
  }, [])
  
  useEffect(() => {
    if (!user) return
  
    const loadSongs = async () => {
      const { data: tracks, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('user_id', user.id)

      if (error) {
        console.error('Failed to load library:', error.message)
        return
      }
      if (!tracks?.length) return

      const audioPaths = tracks.map((t) => t.storage_path)
      const coverPaths = tracks.map((t) => `${t.storage_path.split('/').slice(0, -1).join('/')}/cover`)

      const [{ data: audioUrls }, { data: coverUrls }] = await Promise.all([
        supabase.storage.from('audio-files').createSignedUrls(audioPaths, SIGNED_URL_TTL),
        supabase.storage.from('audio-files').createSignedUrls(coverPaths, SIGNED_URL_TTL),
      ])

      const meta = songMetaRef.current || {}
      const songsWithUrls = tracks.map((track, i) => {
        const m = meta[track.id] || {}
        return {
          id: track.id,
          title: track.title,
          fileName: track.storage_path.split('/').pop(),
          artist: track.artist || '',
          album: track.album || '',
          url: audioUrls?.[i]?.signedUrl || '',
          coverUrl: coverUrls?.[i]?.signedUrl || null,
          description: m.description || '',
          lyrics: '',
          gainDb: typeof m.gainDb === 'number' ? m.gainDb : 0,
          bpm: m.bpm ?? null,
        }
      })

      setSongs(songsWithUrls)
    }

    loadSongs()
  }, [user])

  const markSongHistory = useCallback((song) => {
    if (!song?.id) return
    setListeningHistory((prev) =>
      [{ id: song.id, title: song.title || song.fileName || 'Untitled' }, ...prev].slice(0, 100),
    )
  }, [])

  // Persist per-song fields the tracks table doesn't hold (description, gainDb,
  // bpm) so they survive a refresh and sync across devices.
  const persistSongMeta = useCallback((id, patch) => {
    if (!id) return
    setSongMeta((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
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
      const fade = ctx.createGain()
      fade.gain.value = 1
      const bass = ctx.createBiquadFilter()
      const treble = ctx.createBiquadFilter()
      const analyser = ctx.createAnalyser()
      bass.type = 'lowshelf'
      bass.frequency.value = 200
      treble.type = 'highshelf'
      treble.frequency.value = 3500
      analyser.fftSize = 128
      // Custom equalizer chain: low shelf, peaking mids, high shelf
      const eqFilters = EQ_BANDS.map(({ freq }, i) => {
        const f = ctx.createBiquadFilter()
        f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking'
        f.frequency.value = freq
        if (f.type === 'peaking') f.Q.value = 1
        f.gain.value = customEqGainsRef.current?.[i] ?? 0
        return f
      })
      source.connect(gain)
      gain.connect(fade)
      fade.connect(bass)
      bass.connect(treble)
      let prev = treble
      for (const f of eqFilters) {
        prev.connect(f)
        prev = f
      }
      prev.connect(analyser)
      analyser.connect(ctx.destination)
      sourceNodeRef.current = source
      gainNodeRef.current = gain
      fadeGainRef.current = fade
      bassFilterRef.current = bass
      trebleFilterRef.current = treble
      eqFiltersRef.current = eqFilters
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
    // Resizing a canvas clears and reallocates its backing store, so only do it
    // when the element actually changed size rather than every frame.
    const pxW = Math.round(rect.width * dpr)
    const pxH = Math.round(rect.height * dpr)
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW
      canvas.height = pxH
    }
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
    const root = rootRef.current
    if (root) {
      root.style.setProperty('--shimmer-low', String(lowSum / bandSize))
      root.style.setProperty('--shimmer-mid', String(midSum / bandSize))
      root.style.setProperty('--shimmer-high', String(highSum / bandSize))
    }
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

  // Set the fade-gain node (which scales the main element's output) to a value,
  // optionally ramping over `ms`. Falls back to no-op until the graph exists.
  const setFadeGain = useCallback((to, ms = 0) => {
    const ctx = audioContextRef.current
    const fg = fadeGainRef.current
    if (!fg) return
    if (ctx) {
      const now = ctx.currentTime
      fg.gain.cancelScheduledValues(now)
      fg.gain.setValueAtTime(Math.max(0.0001, fg.gain.value), now)
      if (ms > 0) fg.gain.linearRampToValueAtTime(Math.max(0.0001, to), now + ms / 1000)
      else fg.gain.setValueAtTime(to, now)
    } else {
      fg.gain.value = to
    }
  }, [])

  // True crossfade: play the outgoing track's tail on a secondary element and
  // fade it out, while `switchTrack` advances the main element to the next song
  // and we fade that in via the fade-gain node. When disabled or not currently
  // audible, just switch instantly.
  const crossfade = useCallback((switchTrack) => {
    const audio = audioRef.current
    const dur = crossfadeDuration
    if (!audio || dur === 0 || audio.paused) {
      setFadeGain(1, 0)
      switchTrack()
      return
    }
    ensureAudioGraph()

    // Hand the outgoing track to the secondary element and fade it out.
    const tail = crossfadeAudioRef.current
    const outSrc = audio.currentSrc || audio.src
    if (tail && outSrc) {
      try {
        tail.src = outSrc
        tail.currentTime = audio.currentTime
        tail.playbackRate = audio.playbackRate
        tail.volume = audio.volume
        tail.play().then(() => {
          const steps = Math.max(4, Math.round(dur / 25))
          let step = 0
          const startVol = tail.volume
          const id = setInterval(() => {
            step++
            tail.volume = Math.max(0, startVol * (1 - step / steps))
            if (step >= steps) {
              clearInterval(id)
              tail.pause()
              tail.removeAttribute('src')
              tail.load()
            }
          }, dur / steps)
        }).catch(() => {})
      } catch { /* ignore tail failures — main track still transitions */ }
    }

    // Fade the new track in: start silent, ramp up once it begins playing.
    setFadeGain(0.0001, 0)
    switchTrack()
    requestAnimationFrame(() => setFadeGain(1, dur))
  }, [crossfadeDuration, setFadeGain])

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

  const showUploadNotice = useCallback((type, message) => {
    setUploadNotice({ type, message })
    window.clearTimeout(uploadNoticeTimerRef.current)
    uploadNoticeTimerRef.current = window.setTimeout(() => setUploadNotice(null), 7000)
  }, [])

  const processAudioFiles = useCallback(async (fileList) => {
    // Use the authenticated user from state rather than awaiting
    // supabase.auth.getSession(): in Chrome that call can block indefinitely
    // on the auth Web Lock during a token refresh, hanging the whole upload
    // before any network request fires. The auth gate guarantees `user` here.
    const currentUser = user
    if (!currentUser) {
      showUploadNotice('error', 'You must be signed in to upload songs.')
      return
    }

    const files = Array.from(fileList || [])
    const allAudioFiles = files.filter((f) => f.type.startsWith('audio/') || f.type === 'video/webm' || f.type === 'video/ogg' || f.name.match(/\.(webm|ogg|opus|m4a)$/i))
    if (allAudioFiles.length === 0) {
      if (files.length > 0) showUploadNotice('error', 'No supported audio files were selected.')
      return
    }

    // Enforce the per-account upload cap. Read the live library size from the
    // ref so this isn't a stale closure.
    const existingCount = stateRef.current.songs?.length ?? 0
    if (existingCount >= MAX_UPLOADS) {
      showUploadNotice('error', `You've reached the ${MAX_UPLOADS}-song upload limit. Remove a song before adding more.`)
      return
    }
    const audioFiles = allAudioFiles.slice(0, MAX_UPLOADS - existingCount)
    const skippedForLimit = allAudioFiles.length - audioFiles.length

    setIsUploading(true)

    const failures = []
    const newSongs = await Promise.all(
      audioFiles.map(async (f) => {
        const id = crypto.randomUUID()
        let tags = null
        let saveError = null
        let url = null
        let coverUrl = null

        try {
          tags = await readAudioTags(f)

          const sanitizedName = f.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
          const storagePath = `${currentUser.id}/${id}/${sanitizedName}`

          const { error: uploadError } = await supabase.storage
            .from('audio-files')
            .upload(storagePath, f, { upsert: true })
          if (uploadError) throw uploadError

          if (tags?.picture) {
            const { data, format } = tags.picture
            const coverBlob = new Blob([data], { type: format || 'image/jpeg' })
            // Cover lives at a fixed path next to the audio so loadSongs can find it
            const { error: coverError } = await supabase.storage
              .from('audio-files')
              .upload(`${currentUser.id}/${id}/cover`, coverBlob, { upsert: true, contentType: format || 'image/jpeg' })
            if (!coverError) {
              const { data: coverSigned } = await supabase.storage
                .from('audio-files')
                .createSignedUrl(`${currentUser.id}/${id}/cover`, SIGNED_URL_TTL)
              coverUrl = coverSigned?.signedUrl || null
            }
          }

          const { error: dbError } = await supabase.from('tracks').insert({
            id,
            user_id: currentUser.id,
            title: tags?.title || f.name.replace(/\.[^/.]+$/, ''),
            artist: tags?.artist || '',
            album: tags?.album || '',
            storage_path: storagePath,
          })
          if (dbError) throw dbError

          const { data: signedData } = await supabase.storage
            .from('audio-files')
            .createSignedUrl(storagePath, SIGNED_URL_TTL)
          url = signedData?.signedUrl
        } catch (err) {
          saveError = err?.message || 'Unknown error'
          failures.push({ name: f.name, reason: saveError })
          console.error(`Failed to save "${f.name}":`, saveError)
        }

        // Fall back to an in-memory URL so the song is still playable this
        // session even when saving failed
        if (!url) url = URL.createObjectURL(f)
        if (!coverUrl && tags?.picture) {
          try {
            const { data, format } = tags.picture
            coverUrl = URL.createObjectURL(new Blob([data], { type: format || 'image/jpeg' }))
          } catch { coverUrl = null }
        }

        return {
          id,
          title: tags?.title || f.name.replace(/\.[^/.]+$/, ''),
          fileName: f.name,
          artist: tags?.artist || '',
          album: tags?.album || '',
          gainDb: 0,
          bpm: null,
          url,
          coverUrl,
          description: '',
          lyrics: '',
          _file: f,
        }
      }),
    )

    const limitNote = skippedForLimit > 0
      ? ` ${skippedForLimit} song${skippedForLimit > 1 ? 's were' : ' was'} skipped — you've reached the ${MAX_UPLOADS}-song upload limit.`
      : ''
    if (failures.length > 0) {
      const saved = audioFiles.length - failures.length
      showUploadNotice('error', `${failures.length} song${failures.length > 1 ? 's' : ''} could not be saved to your library (${failures[0].reason}). ${saved > 0 ? `${saved} saved. ` : ''}Unsaved songs will play until you refresh.${limitNote}`)
    } else {
      showUploadNotice('success', `${audioFiles.length} song${audioFiles.length > 1 ? 's' : ''} saved to your library.${limitNote}`)
    }

    setIsUploading(false)

    setSongs((prev) => {
      const existingIds = new Set(prev.map((s) => s.id))
      const toAdd = newSongs.filter((s) => !existingIds.has(s.id))
      return [...prev, ...toAdd.map(({ _file: _, ...rest }) => rest)]
    })
    setActivePage('songs')
    if (stateRef.current.currentTrackIndex == null && newSongs.length > 0) {
      setSelectedSongIndex(0)
      setCurrentTrackIndex(0)
    }

    // Prompt the user to edit the new song's metadata once it's in the library.
    // Resolved to a row index by the effect below, so it works regardless of
    // how the songs array settles after the async upload.
    if (newSongs.length > 0) setPendingEditSongId(newSongs[0].id)

    for (const song of newSongs) {
      const f = song._file
      if (!f) continue
      analyzeAudio(f).then(({ gainDb, bpm }) => {
        setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, gainDb, bpm } : s))
        persistSongMeta(song.id, { gainDb, bpm })
      }).catch(() => {})
    }
  }, [showUploadNotice, user, persistSongMeta])

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

    // Remove from Supabase so the song doesn't reappear on refresh
    const deleteRemote = async () => {
      const { data: track } = await supabase
        .from('tracks')
        .select('storage_path')
        .eq('id', songId)
        .maybeSingle()
      if (track?.storage_path) {
        const dir = track.storage_path.split('/').slice(0, -1).join('/')
        await supabase.storage.from('audio-files').remove([track.storage_path, `${dir}/cover`])
      }
      const { error } = await supabase.from('tracks').delete().eq('id', songId)
      if (error) console.error('Failed to delete track:', error.message)
    }
    deleteRemote().catch((err) => console.error('Failed to delete track:', err?.message))
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
    // A play is only counted once it passes the halfway mark (see the ticker).
    hasCountedRef.current = false
    // A direct click isn't a crossfade — make sure the new track is full volume.
    setFadeGain(1, 0)
    setTimeout(() => {
      if (!audioRef.current) return
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }, 0)
  }

  const handleAddToQueue = useCallback((songId) => {
    setSongQueue((prev) => [...prev, songId])
  }, [])

  const handleRemoveFromManualQueue = useCallback((idx) => {
    setSongQueue((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const handleReorderQueue = useCallback((fromIndex, toIndex) => {
    const base = (stateRef.current.currentTrackIndex ?? -1) + 1
    setSongs((prev) => {
      const next = [...prev]
      const absFrom = base + fromIndex
      const absTo = base + toIndex
      const [item] = next.splice(absFrom, 1)
      next.splice(absTo, 0, item)
      return next
    })
  }, [])

  const handleEditSongFromContext = useCallback((songIndex) => {
    setSelectedSongIndex(songIndex)
    setShowMetadataModal(true)
  }, [])

  // After an upload finishes, select the new song and open the metadata editor
  useEffect(() => {
    if (!pendingEditSongId) return
    const idx = songs.findIndex((s) => s.id === pendingEditSongId)
    if (idx === -1) return
    setSelectedSongIndex(idx)
    setShowMetadataModal(true)
    setPendingEditSongId(null)
  }, [pendingEditSongId, songs])

  const handleProfilePicUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      setProfilePicUrl(dataUrl)
      safeSetStorage('listenwell-profile-pic', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleEditQueueSong = useCallback((song) => {
    const idx = songs.findIndex((s) => s.id === song.id)
    if (idx !== -1) {
      setActivePage('songs')
      setSelectedSongIndex(idx)
    }
    setShowUpNext(false)
  }, [songs])

  const handleRemoveFromQueue = useCallback((upNextRelIdx) => {
    const cur = stateRef.current.currentTrackIndex ?? -1
    const absIdx = cur + 1 + upNextRelIdx
    setSongs((prev) => {
      if (absIdx < 0 || absIdx >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(absIdx, 1)
      next.splice(0, 0, item) // park at front of array so it stays in library
      return next
    })
    // Shift currentTrackIndex to keep pointing at the same song
    setCurrentTrackIndex((prev) => (prev != null ? prev + 1 : null))
    setSelectedSongIndex((prev) => (typeof prev === 'number' ? prev + 1 : prev))
  }, [])

  const currentTrackUrl = songs[currentTrackIndex]?.url ?? null
  const nowPlaying = currentTrackIndex != null ? songs[currentTrackIndex] : null
  const effectivePlaybackRate = clampPlaybackRate(playbackRate)

  // Top listened songs for the profile leaderboard (resolved against the
  // current library so deleted songs drop off automatically).
  const topListened = Object.entries(playCounts)
    .map(([id, count]) => ({ song: songs.find((s) => s.id === id), count }))
    .filter((x) => x.song && x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const topPlayMax = topListened.length ? topListened[0].count : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || currentTrackIndex == null || !currentTrackUrl) return
    // New track: re-arm the end-of-track crossfade and the play-count guard.
    crossfadeArmedRef.current = false
    hasCountedRef.current = false
    audio.src = currentTrackUrl
    audio.currentTime = 0
    // A new src resets playbackRate to 1; re-apply the user's speed and keep
    // pitch natural rather than chipmunked.
    audio.preservesPitch = true
    audio.playbackRate = effectivePlaybackRate
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
    ensureAudioGraph()
    const ctx = audioContextRef.current
    const bass = bassFilterRef.current
    const treble = trebleFilterRef.current
    if (!ctx || !bass || !treble) return
    // Moderate boosts (was +10dB, which clipped/distorted), ramped smoothly
    // with setTargetAtTime so switching presets doesn't click or break audio.
    const presets = {
      normal: { bass: 0, treble: 0 },
      bass: { bass: 6, treble: 0 },
      bright: { bass: 0, treble: 6 },
    }
    const target = presets[eqPreset] || presets.normal
    const now = ctx.currentTime
    bass.gain.setTargetAtTime(target.bass, now, 0.03)
    treble.gain.setTargetAtTime(target.treble, now, 0.03)
  }, [eqPreset])

  useEffect(() => { ensureAudioGraph() }, [])

  // Enumerate audio output devices when the settings audio tab is open
  useEffect(() => {
    if (!showSettingsModal || settingsModalTab !== 'audio') return
    if (!navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices.enumerateDevices()
      .then((devs) => setAudioOutputs(devs.filter((d) => d.kind === 'audiooutput')))
      .catch(() => {})
  }, [showSettingsModal, settingsModalTab])

  // Route audio to the chosen output device (where supported)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || typeof audio.setSinkId !== 'function') return
    audio.setSinkId(outputDeviceId).catch(() => {})
    safeSetStorage('listenwell-output', outputDeviceId)
  }, [outputDeviceId, currentTrackUrl])

  useEffect(() => { safeSetStorage('listenwell-theme', theme) }, [theme])
  useEffect(() => { safeSetStorage('listenwell-eq-ring-color', eqRingColor) }, [eqRingColor])
  useEffect(() => { safeSetStorage('listenwell-custom-eq', JSON.stringify(customEqGains)) }, [customEqGains])

  // Apply custom equalizer gains to the live filter chain (smoothly, to avoid
  // clicks/zipper noise when dragging a band)
  useEffect(() => {
    const ctx = audioContextRef.current
    const now = ctx?.currentTime ?? 0
    eqFiltersRef.current.forEach((f, i) => {
      const g = Math.max(-12, Math.min(12, customEqGains[i] ?? 0))
      if (ctx) f.gain.setTargetAtTime(g, now, 0.03)
      else f.gain.value = g
    })
  }, [customEqGains])
  useEffect(() => { safeSetStorage('listenwell-settings-position', JSON.stringify(settingsPosition)) }, [settingsPosition])
  useEffect(() => { safeSetStorage('listenwell-presets', JSON.stringify(savedPresets)) }, [savedPresets])
  useEffect(() => { safeSetStorage('listenwell-aurora-intensity', String(auroraIntensity)) }, [auroraIntensity])
  useEffect(() => { safeSetStorage('listenwell-glow-softness', String(glowSoftness)) }, [glowSoftness])
  useEffect(() => { safeSetStorage('listenwell-blur-amount', String(blurAmount)) }, [blurAmount])
  useEffect(() => { safeSetStorage('listenwell-repeat', repeat) }, [repeat])
  useEffect(() => { safeSetStorage('listenwell-volume', String(volume)) }, [volume])
  useEffect(() => { safeSetStorage('listenwell-rate', String(playbackRate)) }, [playbackRate])
  useEffect(() => { safeSetStorage('listenwell-eqpreset', eqPreset) }, [eqPreset])
  useEffect(() => { safeSetStorage('listenwell-loved', JSON.stringify(lovedSongIds)) }, [lovedSongIds])
  useEffect(() => { safeSetStorage('listenwell-playlists', JSON.stringify(playlists)) }, [playlists])
  useEffect(() => { safeSetStorage('listenwell-playcounts', JSON.stringify(playCounts)) }, [playCounts])
  useEffect(() => { safeSetStorage('listenwell-recent', JSON.stringify(recentItems)) }, [recentItems])
  useEffect(() => { safeSetStorage('listenwell-vnorm', String(volumeNormalization)) }, [volumeNormalization])
  useEffect(() => { safeSetStorage('listenwell-crossfade', String(crossfadeDuration)) }, [crossfadeDuration])
  useEffect(() => { safeSetStorage('listenwell-art-color', String(artColorExtract)) }, [artColorExtract])
  useEffect(() => { if (displayName) safeSetStorage('listenwell-display-name', displayName) }, [displayName])
  useEffect(() => { safeSetStorage('listenwell-tile-size', songTileSize) }, [songTileSize])
  useEffect(() => { safeSetStorage('listenwell-songmeta', JSON.stringify(songMeta)) }, [songMeta])
  useEffect(() => {
    if (songsBgUrl) safeSetStorage('listenwell-songs-bg', songsBgUrl)
    else if (typeof window !== 'undefined') { try { window.localStorage.removeItem('listenwell-songs-bg') } catch { /* ignore */ } }
  }, [songsBgUrl])
  useEffect(() => { safeSetStorage('listenwell-songs-bg-blur', String(songsBgBlur)) }, [songsBgBlur])

  // Sync per-user state (playlists, loved, settings) with Supabase so it
  // follows the account across devices. localStorage stays as the local cache.
  const userStateLoadedRef = useRef(false)
  const userStateTimerRef = useRef(null)

  const buildSyncedState = () => ({
    playlists,
    lovedSongIds,
    playCounts,
    recentItems,
    theme,
    repeat,
    volumeNormalization,
    crossfadeDuration,
    artColorExtract,
    eqRingColor,
    customEqGains,
    savedPresets,
    auroraIntensity,
    glowSoftness,
    blurAmount,
    profilePicUrl,
    displayName,
    songTileSize,
    volume,
    playbackRate,
    eqPreset,
    songMeta,
    songsBgUrl,
    songsBgBlur,
  })

  useEffect(() => {
    userStateLoadedRef.current = false
    if (!user) return
    let cancelled = false

    const loadUserState = async () => {
      const { data: row, error } = await supabase
        .from('user_state')
        .select('data')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        // Leave the loaded flag unset so a failed read is never overwritten
        console.error('Failed to load synced state:', error.message)
        return
      }
      const d = row?.data
      if (d && typeof d === 'object') {
        if (Array.isArray(d.playlists)) setPlaylists(d.playlists)
        if (Array.isArray(d.lovedSongIds)) setLovedSongIds(d.lovedSongIds)
        if (d.playCounts && typeof d.playCounts === 'object') setPlayCounts(d.playCounts)
        if (Array.isArray(d.recentItems)) setRecentItems(d.recentItems)
        if (typeof d.theme === 'string') setTheme(normalizeThemeId(d.theme))
        if (typeof d.repeat === 'string') setRepeat(d.repeat)
        if (typeof d.volumeNormalization === 'boolean') setVolumeNormalization(d.volumeNormalization)
        if (typeof d.crossfadeDuration === 'number') setCrossfadeDuration(d.crossfadeDuration)
        if (typeof d.artColorExtract === 'boolean') setArtColorExtract(d.artColorExtract)
        if (typeof d.eqRingColor === 'string') setEqRingColor(d.eqRingColor)
        if (Array.isArray(d.customEqGains) && d.customEqGains.length === EQ_BANDS.length) setCustomEqGains(d.customEqGains.map(Number))
        if (Array.isArray(d.savedPresets)) setSavedPresets(d.savedPresets)
        if (typeof d.auroraIntensity === 'number') setAuroraIntensity(d.auroraIntensity)
        if (typeof d.glowSoftness === 'number') setGlowSoftness(d.glowSoftness)
        if (typeof d.blurAmount === 'number') setBlurAmount(d.blurAmount)
        if (typeof d.profilePicUrl === 'string' || d.profilePicUrl === null) setProfilePicUrl(d.profilePicUrl)
        if (typeof d.displayName === 'string') setDisplayName(d.displayName)
        if (typeof d.songTileSize === 'string') setSongTileSize(d.songTileSize)
        if (typeof d.volume === 'number') setVolume(Math.min(1, Math.max(0, d.volume)))
        if (typeof d.playbackRate === 'number') setPlaybackRate(clampPlaybackRate(d.playbackRate))
        if (typeof d.eqPreset === 'string') setEqPreset(d.eqPreset)
        if (d.songMeta && typeof d.songMeta === 'object') setSongMeta(d.songMeta)
        if (typeof d.songsBgUrl === 'string' || d.songsBgUrl === null) setSongsBgUrl(d.songsBgUrl)
        if (typeof d.songsBgBlur === 'number') setSongsBgBlur(d.songsBgBlur)
      } else {
        // First login from this account: migrate this browser's local state up
        const { error: pushError } = await supabase
          .from('user_state')
          .upsert({ user_id: user.id, data: buildSyncedState(), updated_at: new Date().toISOString() })
        if (pushError) console.error('Failed to sync state:', pushError.message)
      }
      if (!cancelled) userStateLoadedRef.current = true
    }

    loadUserState()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!user || !userStateLoadedRef.current) return
    window.clearTimeout(userStateTimerRef.current)
    userStateTimerRef.current = window.setTimeout(async () => {
      const { error } = await supabase
        .from('user_state')
        .upsert({ user_id: user.id, data: buildSyncedState(), updated_at: new Date().toISOString() })
      if (error) console.error('Failed to sync state:', error.message)
    }, 1200)
    return () => window.clearTimeout(userStateTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, playlists, lovedSongIds, playCounts, recentItems, theme, repeat, volumeNormalization, crossfadeDuration, artColorExtract, eqRingColor, customEqGains, savedPresets, auroraIntensity, glowSoftness, blurAmount, profilePicUrl, displayName, songTileSize, volume, playbackRate, eqPreset, songMeta, songsBgUrl, songsBgBlur])

  // When persisted meta arrives from user_state after songs have already loaded
  // (login race), fill in any gainDb/bpm/description still at their defaults.
  // Keyed on songMeta only — never runs while the user types, so live edits in
  // the metadata modal are left untouched. Guarded to avoid a render loop.
  useEffect(() => {
    setSongs((prev) => {
      if (!prev.length) return prev
      let changed = false
      const next = prev.map((s) => {
        const m = songMeta[s.id]
        if (!m) return s
        const merged = { ...s }
        if (m.description && !s.description) { merged.description = m.description; changed = true }
        if (typeof m.gainDb === 'number' && !s.gainDb) { merged.gainDb = m.gainDb; changed = true }
        if (m.bpm != null && s.bpm == null) { merged.bpm = m.bpm; changed = true }
        return merged
      })
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songMeta])

  // Apply per-song gain normalisation whenever the track changes
  useEffect(() => {
    if (!gainNodeRef.current) return
    const song = songs[currentTrackIndex]
    const db = volumeNormalization && song?.gainDb ? song.gainDb : 0
    gainNodeRef.current.gain.value = Math.min(4, Math.max(0.25, Math.pow(10, db / 20)))
  }, [currentTrackIndex, volumeNormalization, songs])

  // Extract dominant color from album art when artColorExtract is enabled
  useEffect(() => {
    if (!artColorExtract) { setAccentColor('139 92 246'); return }
    const coverUrl = songs[currentTrackIndex]?.coverUrl
    if (!coverUrl) { setAccentColor('139 92 246'); return }
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 8; canvas.height = 8
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 8, 8)
        const data = ctx.getImageData(0, 0, 8, 8).data
        let r = 0, g = 0, b = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          const lum = (data[i] + data[i + 1] + data[i + 2]) / 3
          if (lum < 30 || lum > 225) continue
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count++
        }
        setAccentColor(count > 0 ? `${Math.round(r / count)} ${Math.round(g / count)} ${Math.round(b / count)}` : '139 92 246')
      } catch { setAccentColor('139 92 246') }
    }
    img.onerror = () => setAccentColor('139 92 246')
    img.src = coverUrl
  }, [artColorExtract, currentTrackIndex, songs])

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
    // The Neural Equalizer bars only render inside the open Settings panel, so
    // only animate them while that panel is actually visible. Running this
    // interval always re-rendered the whole App 8x/second even when idle.
    if (!showSettings || settingsTab !== 'playback') return undefined
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
  }, [eqPreset, showSettings, settingsTab])

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
    } else {
      if (visualizerFrameRef.current) {
        cancelAnimationFrame(visualizerFrameRef.current)
        visualizerFrameRef.current = null
      }
      // Settle the shimmer-driven aurora back to its idle level when paused.
      const root = rootRef.current
      if (root) {
        root.style.setProperty('--shimmer-low', '0')
        root.style.setProperty('--shimmer-mid', '0')
        root.style.setProperty('--shimmer-high', '0')
      }
    }
    return () => {
      if (visualizerFrameRef.current) { cancelAnimationFrame(visualizerFrameRef.current); visualizerFrameRef.current = null }
    }
  }, [isPlaying, currentTrackIndex, runVisualizerFrame])

  useEffect(() => {
    if (!isPlaying) return undefined
    let frameId = null
    let last = 0
    const tick = (ts) => {
      // Throttle to ~10fps: a full App re-render every frame (60fps) while
      // playing was needless; the seek bar reads smoothly at 100ms steps.
      const audio = audioRef.current
      if (ts - last >= 100 && audio && !audio.paused) {
        last = ts
        setCurrentTime(audio.currentTime)

        const dur = audio.duration
        if (Number.isFinite(dur) && dur > 0) {
          const { songs: ss, currentTrackIndex: cur, repeat: rep, crossfadeDuration: cf } = stateRef.current

          // Count a play once it passes the halfway mark (covers auto-advance).
          if (!hasCountedRef.current && audio.currentTime >= dur / 2) {
            hasCountedRef.current = true
            const song = cur != null ? ss[cur] : null
            if (song?.id) setPlayCounts((prev) => ({ ...prev, [song.id]: (prev[song.id] || 0) + 1 }))
          }

          // Start the crossfade before the track actually ends so the next song
          // overlaps the tail. Skipped for repeat-one and single-track libraries.
          if (cf > 0 && !crossfadeArmedRef.current && rep !== 'one' && (ss.length > 1 || rep === 'all')) {
            if (dur - audio.currentTime <= cf / 1000) {
              crossfadeArmedRef.current = true
              handleNextRef.current?.()
            }
          }
        }
      }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => { if (frameId) cancelAnimationFrame(frameId) }
  }, [isPlaying])

  // Circular equalizer animation around profile spheres (footer + account drawer)
  useEffect(() => {
    let frameId
    let freqBuf = null
    let cachedColor = [139, 92, 246]
    let lastColorAt = 0

    const resolveColor = () => {
      const setting = eqRingColorRef.current
      if (setting && setting !== 'accent') {
        const m = /^#?([0-9a-f]{6})$/i.exec(setting)
        if (m) {
          const n = parseInt(m[1], 16)
          return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
        }
      }
      const accentRaw = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '139 92 246'
      return accentRaw.split(' ').map(Number)
    }

    const drawRing = (canvas, sphereR, [r, g, b], data) => {
      const ctx = canvas.getContext('2d')
      const dpr = window.devicePixelRatio || 1
      // Use actual CSS size so bars never clip regardless of DPR
      const W = canvas.clientWidth || 112
      const H = canvas.clientHeight || 112
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const cx = W / 2, cy = H / 2
      const innerR = sphereR + 4
      const maxBar = Math.max(6, cx - innerR - 2)
      const bars = 40
      const t = Date.now() / 1000

      // Per-canvas smoothing buffer → fluid, spectrum-analyser motion (fast
      // attack, slow release) instead of the old raw, jittery bars.
      let sm = canvas._eqSmooth
      if (!sm || sm.length !== bars) sm = canvas._eqSmooth = new Float32Array(bars).fill(0.1)

      // Bars read light/cyan at the core and fade to the accent at the tips —
      // a single radial gradient keeps it cohesive and cheap (one stroke pass).
      const lr = Math.round(r + (255 - r) * 0.5)
      const lg = Math.round(g + (255 - g) * 0.5)
      const lb = Math.round(b + (255 - b) * 0.5)
      const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, innerR + maxBar)
      grad.addColorStop(0, `rgb(${lr},${lg},${lb})`)
      grad.addColorStop(1, `rgb(${r},${g},${b})`)

      // Faint gauge baseline ring for an instrument-panel feel
      ctx.beginPath()
      ctx.arc(cx, cy, innerR - 1.5, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${r},${g},${b},0.14)`
      ctx.lineWidth = 1
      ctx.stroke()

      const ang = new Array(bars)
      for (let i = 0; i < bars; i++) {
        let target
        if (data) {
          const idx = Math.floor((i / bars) * data.length * 0.6)
          target = (data[idx] / 255) ** 0.85
        } else {
          // Gentle idle breathing so the ring is always alive
          target = 0.12 + 0.16 * (Math.sin(t * 1.3 + i * 0.55) * 0.5 + 0.5)
        }
        sm[i] += (target - sm[i]) * (target > sm[i] ? 0.5 : 0.14)
        ang[i] = (i / bars) * Math.PI * 2 - Math.PI / 2
      }

      const strokeBars = (widthPx) => {
        ctx.beginPath()
        for (let i = 0; i < bars; i++) {
          const bLen = sm[i] * maxBar + 1.5
          const cos = Math.cos(ang[i]), sin = Math.sin(ang[i])
          ctx.moveTo(cx + innerR * cos, cy + innerR * sin)
          ctx.lineTo(cx + (innerR + bLen) * cos, cy + (innerR + bLen) * sin)
        }
        ctx.strokeStyle = grad
        ctx.lineWidth = widthPx
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      // Soft glow underlay, then crisp bars on top
      ctx.save()
      ctx.globalAlpha = 0.22
      ctx.shadowColor = `rgba(${r},${g},${b},0.85)`
      ctx.shadowBlur = 7
      strokeBars(4)
      ctx.restore()
      strokeBars(2.5)
    }

    const renderOnce = () => {
      const analyser = analyserRef.current
      let data = null
      if (analyser && isPlaying) {
        if (!freqBuf || freqBuf.length !== analyser.frequencyBinCount) {
          freqBuf = new Uint8Array(analyser.frequencyBinCount)
        }
        analyser.getByteFrequencyData(freqBuf)
        data = freqBuf
      }
      // getComputedStyle forces a style recalc; resolve at ~2/sec, not 60/sec
      const now = Date.now()
      if (now - lastColorAt > 500) { cachedColor = resolveColor(); lastColorAt = now }
      if (circularEqCanvasRef.current) drawRing(circularEqCanvasRef.current, 40, cachedColor, data)
      if (drawerEqCanvasRef.current) drawRing(drawerEqCanvasRef.current, 56, cachedColor, data)
    }

    // Only run the per-frame loop when there's something to animate (a track
    // playing, or the account drawer's larger ring is on screen). Otherwise
    // draw a single static frame so the ring is visible without burning CPU.
    if (isPlaying || showAccountDrawer) {
      const draw = () => { frameId = requestAnimationFrame(draw); renderOnce() }
      draw()
    } else {
      renderOnce()
    }
    return () => { if (frameId) cancelAnimationFrame(frameId) }
  }, [isPlaying, showAccountDrawer])

  // Keep stateRef fresh so the keyboard handler always reads current state
  stateRef.current = { isPlaying, currentTrackIndex, songs, shuffle, repeat, songQueue, crossfadeDuration }
  eqRingColorRef.current = eqRingColor
  customEqGainsRef.current = customEqGains

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
    // Drain the manual queue first
    const { songQueue: sq } = stateRef.current
    if (sq.length > 0) {
      const [nextId, ...rest] = sq
      setSongQueue(rest)
      const idx = ss.findIndex((s) => s.id === nextId)
      if (idx !== -1) {
        crossfade(() => {
          setCurrentTrackIndex(idx)
          setSelectedSongIndex(idx)
          setIsPlaying(true)
          markRecent('song', ss[idx]?.id)
          markSongHistory(ss[idx])
        })
        return
      }
    }
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

  // Keep a stable handle so the playback ticker can early-trigger crossfades
  // without capturing a stale handleNext closure.
  handleNextRef.current = handleNext

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
    const song = selectedSongIndex !== null ? songs[selectedSongIndex] : null
    setSongs((prev) =>
      prev.map((s, index) =>
        index === selectedSongIndex ? { ...s, coverUrl: URL.createObjectURL(file) } : s,
      ),
    )
    // Persist the cover to storage so it survives a refresh and other devices
    if (song?.id && user) {
      supabase.storage
        .from('audio-files')
        .upload(`${user.id}/${song.id}/cover`, file, { upsert: true, contentType: file.type || 'image/jpeg' })
        .then(({ error }) => { if (error) console.error('Cover upload failed:', error.message) })
    }
  }

  // Persist edited title/artist/album back to the tracks table
  const saveSongMetadata = useCallback(async (song) => {
    if (!song?.id || !user) return
    const { error } = await supabase
      .from('tracks')
      .update({ title: song.title || '', artist: song.artist || '', album: song.album || '' })
      .eq('id', song.id)
      .eq('user_id', user.id)
    if (error) console.error('Failed to save metadata:', error.message)
  }, [user])

  const selectedSong = selectedSongIndex !== null ? songs[selectedSongIndex] : null

  const closeMetadataModal = () => {
    if (selectedSong?.id) {
      saveSongMetadata(selectedSong)
      // Description isn't a tracks-table column; persist it with the song meta.
      persistSongMeta(selectedSong.id, { description: selectedSong.description || '' })
    }
    setShowMetadataModal(false)
  }

  const pageTransition = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  }

  const NAV_TABS = [
    { id: 'library', label: 'Library', icon: Library },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'songs', label: 'Songs', icon: Music2 },
    { id: 'upload', label: 'Upload', icon: Upload },
  ]

  // Auth loading spinner
  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-[#0c0c0e] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  // Password recovery — user followed a reset link from their email. Show the
  // reset screen even though a (recovery) session may already exist.
  if (passwordRecovery) {
    return <AuthScreen recovery onAuth={(u) => { setUser(u); setPasswordRecovery(false) }} />
  }

  // Auth gate — show login screen if not logged in
  if (!user) {
    return <AuthScreen onAuth={setUser} />
  }

  return (
    <div
      ref={rootRef}
      data-theme={theme}
      className="relative flex flex-col min-h-screen w-full bg-[#0c0c0e] text-gray-100 overflow-hidden"
      style={{
        '--accent-rgb': playlistAccentOverride || accentColor,
        '--aurora-intensity': auroraIntensity,
        '--glow-softness': glowSoftness,
        '--blur-amount': blurAmount,
      }}
    >
      <div className="aurora aurora-one" aria-hidden />
      <div className="aurora aurora-two" aria-hidden />
      <div className="aurora aurora-three" aria-hidden />
      {uploadNotice && (
        <div
          role="status"
          className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 max-w-md px-4 py-2.5 rounded-lg border bg-[#0c0c0e]/95 backdrop-blur text-xs leading-relaxed shadow-lg ${
            uploadNotice.type === 'error'
              ? 'border-red-500/40 text-red-300'
              : 'border-white/15 text-gray-200'
          }`}
        >
          {uploadNotice.message}
        </div>
      )}
      {isUploading && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#0c0c0e]/70 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="flex flex-col items-center gap-4 px-8 py-7 rounded-2xl border border-white/10 bg-[#0c0c0e]/90 shadow-2xl">
            <div className="w-10 h-10 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
            <p className="text-sm text-gray-200 font-medium">Uploading your music…</p>
            <p className="text-xs text-gray-500">Saving to your library</p>
          </div>
        </div>
      )}
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          const a = audioRef.current
          if (!a) return
          setDuration(a.duration ?? 0)
          a.preservesPitch = true
          a.playbackRate = effectivePlaybackRate
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          const { repeat: rep, songs: ss, currentTrackIndex: cur } = stateRef.current
          if (rep === 'one') {
            const audio = audioRef.current
            // Looping the same track is a fresh play: re-arm the count guard.
            hasCountedRef.current = false
            crossfadeArmedRef.current = false
            if (audio) { audio.currentTime = 0; audio.play().catch(() => {}) }
          } else if (ss.length > 1 || rep === 'all') {
            handleNext()
          } else {
            setIsPlaying(false)
          }
        }}
      />
      {/* Secondary element: plays the outgoing track's tail during a crossfade */}
      <audio ref={crossfadeAudioRef} />

      {/* Header */}
      <header className="app-chrome relative z-20 shrink-0 h-16 sm:h-20 border-b border-white/10 flex items-center justify-end px-4 sm:px-8">
        {/* Now Playing indicator — top left. Capped well short of the Home
            button on mobile and truncated with an ellipsis so it never
            overlaps it. */}
        <div className="absolute left-4 sm:left-8 flex items-center gap-2 min-w-0 max-w-[40vw] sm:max-w-[340px]">
          {nowPlaying ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.55)] animate-pulse shrink-0" />
              <span className="text-[11px] sm:text-xs text-gray-400 truncate">
                <span className="text-gray-500 hidden sm:inline">Now Playing: </span>
                <span className="text-gray-200">{nowPlaying.artist || 'Unknown'}</span>
                <span className="text-gray-500"> — </span>
                <span className="text-gray-200">{nowPlaying.title || nowPlaying.fileName}</span>
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-gray-700 shrink-0" />
              <span className="text-[11px] sm:text-xs text-gray-600 truncate">Now Playing: —</span>
            </>
          )}
        </div>

        {/* Nav — centered */}
        <nav className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 sm:gap-3">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePage(tab.id)}
              className={`magnetic-hover px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition border ${
                activePage === tab.id || (tab.id === 'playlists' && activePage === 'playlist-detail')
                  ? 'bg-violet-500/15 border-violet-500/60 text-violet-100'
                  : 'bg-transparent border-transparent text-gray-300 hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Home — top right, before logo */}
        <button
          type="button"
          onClick={() => setActivePage('home')}
          aria-label="Home"
          className={`magnetic-hover shrink-0 mr-2 sm:mr-3 flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full border transition ${
            activePage === 'home'
              ? 'bg-violet-500/15 border-violet-500/60 text-violet-100'
              : 'border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/40 text-gray-300'
          }`}
        >
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline text-xs sm:text-sm font-medium">Home</span>
        </button>

        {/* Logo — right side of header */}
        <div ref={logoMenuRef} className="shrink-0 relative mr-3">
          <button
            type="button"
            onClick={() => setShowLogoMenu((prev) => !prev)}
            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full border border-white/15 hover:border-white/40 bg-white/[0.04] hover:bg-white/[0.08] transition"
            aria-label="Menu"
          >
            <img src="/logo.svg" alt="listenWell" className="w-8 h-8 sm:w-11 sm:h-11" />
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showLogoMenu ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showLogoMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="menu-panel absolute right-0 top-[calc(100%+0.5rem)] min-w-[290px] rounded-2xl border border-white/15 backdrop-blur-2xl p-2 flex flex-col gap-0.5 z-30"
              >
                <button
                  type="button"
                  onClick={() => { setSettingsModalTab('account'); setShowSettingsModal(true); setShowLogoMenu(false) }}
                  className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-4 py-3 text-base text-white transition-colors text-left whitespace-nowrap"
                >
                  <Settings2 className="w-5 h-5 shrink-0 text-white/80" />
                  <span>Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAccountDrawer(true); setShowLogoMenu(false) }}
                  className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-4 py-3 text-base text-white transition-colors text-left whitespace-nowrap"
                >
                  <UserCircle2 className="w-5 h-5 shrink-0 text-white/80" />
                  <span>Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAboutModalPos({ x: Math.max(0, window.innerWidth / 2 - 280), y: Math.max(0, window.innerHeight / 2 - 110) })
                    setShowAboutModal(true)
                    setShowLogoMenu(false)
                  }}
                  className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-4 py-3 text-base text-white transition-colors text-left whitespace-nowrap"
                >
                  <Info className="w-5 h-5 shrink-0 text-white/80" />
                  <span>About</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryModalPos({ x: Math.max(0, window.innerWidth / 2 - 260), y: Math.max(0, window.innerHeight / 2 - 180) })
                    setShowListeningHistoryModal(true)
                    setShowLogoMenu(false)
                  }}
                  className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-4 py-3 text-base text-white transition-colors text-left whitespace-nowrap"
                >
                  <History className="w-5 h-5 shrink-0 text-white/80" />
                  <span>Listening history</span>
                </button>
                <div className="h-px bg-white/[0.07] mx-2 my-1" />
                <button
                  type="button"
                  onClick={() => { setLegalTab('privacy'); setShowLogoMenu(false) }}
                  className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-4 py-3 text-base text-white transition-colors text-left whitespace-nowrap"
                >
                  <Shield className="w-5 h-5 shrink-0 text-white/80" />
                  <span>Privacy Policy</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setLegalTab('terms'); setShowLogoMenu(false) }}
                  className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.08] px-4 py-3 text-base text-white transition-colors text-left whitespace-nowrap"
                >
                  <ScrollText className="w-5 h-5 shrink-0 text-white/80" />
                  <span>Terms &amp; Conditions</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 overflow-y-hidden px-4 sm:px-8 py-4 sm:py-6">
        <AnimatePresence>
          {activePage === 'home' && (
            <motion.div
              key="home"
              className="absolute inset-0 flex px-4 sm:px-8 py-4 sm:py-6"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <HomeScreen
                displayName={displayName}
                songs={songs}
                playlists={playlists}
                lovedSongIds={lovedSongIds}
                recentItems={recentItems}
                currentTrackIndex={currentTrackIndex}
                isPlaying={isPlaying}
                onPlaySong={(songId) => {
                  const index = songs.findIndex((s) => s.id === songId)
                  if (index !== -1) handlePlaySongClick(index)
                }}
                onOpenPlaylist={(id) => {
                  setSelectedPlaylistId(id)
                  setActivePage('playlist-detail')
                  markRecent('playlist', id)
                }}
                onToggleLoved={toggleLovedSong}
                onGoToSongs={() => setActivePage('songs')}
                onGoToPlaylists={() => setActivePage('playlists')}
              />
            </motion.div>
          )}

          {activePage === 'upload' && (
            <motion.div
              key="upload"
              className="absolute inset-0 flex px-4 sm:px-8 py-4 sm:py-6"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <UploadScreen onUpload={handleUpload} onDrop={processAudioFiles} />
            </motion.div>
          )}

          {activePage === 'library' && (
            <motion.div
              key="library"
              className="absolute inset-0 mx-4 sm:mx-8 my-4 sm:my-6"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <section
                className="h-full flex flex-col overflow-hidden min-w-0 glass-card parallax-card p-5 sm:p-6"
                onMouseMove={handleParallaxMove}
                onMouseLeave={handleParallaxLeave}
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
                          className="flex flex-col gap-2 cursor-pointer group text-left rounded-2xl p-2 transition-all duration-200 hover:bg-white/[0.04]"
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
              </section>
            </motion.div>
          )}

          {activePage === 'songs' && (
            <motion.div
              key="songs"
              className="absolute inset-0"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className="relative flex h-full px-4 sm:px-8 py-4 sm:py-6">
              <SongsScreen
                songsBgUrl={songsBgUrl}
                songsBgBlur={songsBgBlur}
                songs={songs}
                selectedSongIndex={selectedSongIndex}
                currentTrackIndex={currentTrackIndex}
                isPlaying={isPlaying}
                selectedSong={selectedSong}
                songFilter={songFilter}
                sortBy={songSortBy}
                lovedSongIds={lovedSongIds}
                playCounts={playCounts}
                tileSize={songTileSize}
                onChangeTileSize={setSongTileSize}
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
                onEditSong={handleEditSongFromContext}
                onPlaySongClick={handlePlaySongClick}
                onGoToUpload={() => setActivePage('upload')}
                onUploadMore={handleUpload}
                onCoverUpload={handleCoverUpload}
                onMetadataChange={handleMetadataChange}
                onDeleteSong={handleDeleteSong}
                onAddToQueue={handleAddToQueue}
                onAddSongToPlaylist={(songId, playlistId) => {
                  setPlaylists((prev) =>
                    prev.map((pl) =>
                      pl.id === playlistId && !pl.songIds.includes(songId)
                        ? { ...pl, songIds: [...pl.songIds, songId] }
                        : pl,
                    ),
                  )
                }}
                playlists={playlists}
                onParallaxMove={handleParallaxMove}
                onParallaxLeave={handleParallaxLeave}
              />
              </div>
            </motion.div>
          )}

          {activePage === 'playlists' && (
            <motion.div
              key="playlists"
              className="absolute inset-0 flex px-4 sm:px-8 py-4 sm:py-6"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
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
                  setActivePage('playlist-detail')
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
              className="absolute inset-0 flex px-4 sm:px-8 py-4 sm:py-6"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
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
      <nav className="app-chrome flex sm:hidden shrink-0 border-t border-white/10 backdrop-blur-xl">
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
          style={{ left: settingsPosition.x, top: settingsPosition.y, maxHeight: 'min(88vh, 640px)' }}
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

          <div className="overflow-y-auto flex-1 min-h-0 -mx-1 px-1">
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
                  role="switch"
                  aria-checked={volumeNormalization}
                  aria-label="Volume normalisation"
                  onClick={() => setVolumeNormalization((prev) => !prev)}
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${volumeNormalization ? 'bg-violet-600' : 'bg-white/20'}`}
                >
                  <span className={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${volumeNormalization ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Crossfade</span>
                  <span className="tabular-nums text-cyan-300 font-semibold tracking-wide">{crossfadeDuration === 0 ? 'Off' : `${crossfadeDuration}ms`}</span>
                </div>
                <input
                  type="range" min={0} max={2000} step={50}
                  value={crossfadeDuration}
                  onChange={(e) => setCrossfadeDuration(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <div className="relative text-[10px] text-gray-500 h-3">
                  <span className="absolute left-0">Off</span>
                  <span className="absolute right-0">2s</span>
                </div>
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
                  {THEMES.map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => setTheme(normalizeThemeId(scene.id))}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] text-center ${
                        theme === scene.id
                          ? 'border-violet-500/60 bg-violet-500/10 text-violet-100'
                          : 'border-white/10 hover:border-white/40 text-gray-300'
                      }`}
                    >
                      {scene.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Equalizer color</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setEqRingColor('accent')}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      eqRingColor === 'accent'
                        ? 'border-violet-500/60 bg-violet-500/10 text-violet-100'
                        : 'border-white/10 hover:border-white/40 text-gray-300'
                    }`}
                  >
                    Accent
                  </button>
                  {ACCENT_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      title={preset.label}
                      aria-label={`Equalizer color ${preset.label}`}
                      onClick={() => setEqRingColor(preset.hex)}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-110 shrink-0"
                      style={{
                        background: preset.hex,
                        outline: eqRingColor === preset.hex ? `2px solid ${preset.hex}` : '2px solid transparent',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                  <label className="relative w-5 h-5 rounded-full overflow-hidden shrink-0 cursor-pointer border border-white/30 hover:border-white/60 transition-colors" title="Custom color">
                    <span
                      className="absolute inset-0"
                      style={{
                        background: /^#[0-9a-f]{6}$/i.test(eqRingColor)
                          && !ACCENT_PRESETS.some((p) => p.hex === eqRingColor)
                          ? eqRingColor
                          : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                      }}
                    />
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(eqRingColor) ? eqRingColor : '#8b5cf6'}
                      onChange={(e) => setEqRingColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      aria-label="Custom equalizer color"
                    />
                  </label>
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
                      className="w-full h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-medium">Songs background</span>
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-400 hover:text-gray-200 transition-colors">
                  <ImagePlus className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span>{songsBgUrl ? 'Change image' : 'Upload background image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      // Downscale to a compact data URL so the background
                      // survives a refresh (a blob: URL dies on reload).
                      const reader = new FileReader()
                      reader.onload = () => {
                        const img = new Image()
                        img.onload = () => {
                          const maxW = 1600
                          const scale = Math.min(1, maxW / img.width)
                          const canvas = document.createElement('canvas')
                          canvas.width = Math.round(img.width * scale)
                          canvas.height = Math.round(img.height * scale)
                          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
                          setSongsBgUrl(canvas.toDataURL('image/jpeg', 0.82))
                        }
                        img.onerror = () => setSongsBgUrl(reader.result)
                        img.src = reader.result
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                </label>
                {songsBgUrl && (
                  <>
                    <label className="text-[11px] text-gray-400 flex flex-col gap-1">
                      Background blur
                      <input
                        type="range" min={0} max={20} step={0.5} value={songsBgBlur}
                        onChange={(e) => setSongsBgBlur(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setSongsBgUrl(null)}
                      className="text-[11px] text-red-400 hover:text-red-300 text-left"
                    >
                      Remove background
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">Art color extraction</span>
                  <span className="text-[10px] text-gray-600">Pulls accent color from album art</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={artColorExtract}
                  aria-label="Art color extraction"
                  onClick={() => setArtColorExtract((prev) => !prev)}
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${artColorExtract ? 'bg-violet-600' : 'bg-white/20'}`}
                >
                  <span className={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${artColorExtract ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <button
                type="button"
                onClick={saveCurrentPreset}
                className="w-full text-center rounded-lg border border-violet-500/50 bg-violet-500/10 text-violet-100 py-1.5 text-[11px] hover:border-violet-400/70"
              >
                Save current profile preset
              </button>
            </div>
          )}
          </div>{/* end overflow-y-auto settings content */}
        </div>
      )}

      {/* Bottom Player Bar */}
      <footer className="app-chrome relative z-10 h-20 sm:h-36 border-t border-white/10 backdrop-blur-xl flex items-center px-3 sm:px-8 gap-2.5 sm:gap-8 w-full shrink-0 overflow-visible">
        <div className="cat-hanging" aria-hidden />

        {/* Album art — click to open NowPlaying overlay */}
        <div
          role="button"
          tabIndex={nowPlaying ? 0 : -1}
          onClick={() => nowPlaying && setShowNowPlaying(true)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && nowPlaying && setShowNowPlaying(true)}
          className={`w-14 h-14 sm:w-24 sm:h-24 rounded-xl bg-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center text-2xl ${nowPlaying ? 'cursor-pointer hover:brightness-110 transition-[filter]' : 'cursor-default'}`}
          aria-label="Open now playing"
        >
          {nowPlaying?.coverUrl
            ? <img src={nowPlaying.coverUrl} alt="" className="w-full h-full object-cover" />
            : <Music2 className="w-6 h-6 sm:w-9 sm:h-9 text-violet-300/80" />
          }
        </div>

        <div ref={nowPlayingMenuRef} className="flex-1 sm:flex-none sm:w-52 min-w-0 relative">
          <div className="flex items-center gap-2">
            <p className="text-sm sm:text-base font-semibold truncate text-white/95 flex-1">
              {nowPlaying ? nowPlaying.title || nowPlaying.fileName : 'No song selected'}
            </p>
            {nowPlaying && (
              <button
                type="button"
                onClick={() => setShowNowPlayingAddMenu((prev) => !prev)}
                className="w-8 h-8 rounded-full border border-white/25 hidden sm:inline-flex items-center justify-center text-gray-300 hover:border-violet-400/60 hover:bg-violet-500/10 hover:text-violet-300 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 truncate">
            {nowPlaying?.artist || (nowPlaying ? 'Unknown artist' : '—')}
          </p>
          {showNowPlayingAddMenu && nowPlaying && (
            <>
            <div className="fixed inset-0 z-[29]" onClick={() => setShowNowPlayingAddMenu(false)} />
            <div className="menu-panel absolute z-[30] left-0 bottom-[calc(100%+1rem)] w-64 max-h-[min(50vh,320px)] overflow-y-auto rounded-2xl border border-white/15 backdrop-blur-2xl p-1.5 flex flex-col gap-0.5">
              <div className="px-3 pt-1.5 pb-1">
                <p className="text-[9px] uppercase tracking-widest text-gray-600">Add to</p>
              </div>
              <button
                type="button"
                onClick={() => { toggleLovedSong(nowPlaying.id); setShowNowPlayingAddMenu(false) }}
                className="w-full rounded-xl hover:bg-white/[0.08] px-3 py-2.5 text-left transition-colors"
              >
                <div className="flex items-center gap-3 text-sm whitespace-nowrap">
                  <Heart className={`w-4 h-4 shrink-0 ${lovedSongIds.includes(nowPlaying.id) ? 'text-pink-400' : 'text-gray-400'}`} fill={lovedSongIds.includes(nowPlaying.id) ? 'currentColor' : 'none'} />
                  <span className="text-white">Loved Songs</span>
                  {lovedSongIds.includes(nowPlaying.id) && <span className="ml-auto text-[10px] text-gray-500">Added</span>}
                </div>
              </button>
              {playlists.length > 0 && <div className="h-px bg-white/[0.07] mx-2 my-0.5" />}
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
                  className="w-full rounded-xl hover:bg-white/[0.08] px-3 py-2.5 text-left transition-colors"
                >
                  <span className="text-sm text-white whitespace-nowrap truncate block">{pl.name}</span>
                </button>
              ))}
              <div className="h-px bg-white/[0.07] mx-2 my-0.5" />
              <button
                type="button"
                onClick={() => { createPlaylistWithSong(nowPlaying.id); setShowNowPlayingAddMenu(false) }}
                className="w-full rounded-xl hover:bg-cyan-500/10 px-3 py-2.5 text-left transition-colors"
              >
                <span className="text-sm text-white whitespace-nowrap">+ New playlist &amp; add</span>
              </button>
            </div>
            </>
          )}
        </div>

        {/* Playback controls */}
        <div className="shrink-0 sm:shrink sm:flex-1 flex flex-col items-center gap-2 min-w-0 max-w-2xl">
          <div className="flex gap-2.5 sm:gap-5 items-center">
            <button
              type="button"
              onClick={() => setShuffle((prev) => !prev)}
              disabled={songs.length === 0}
              title={shuffle ? 'Shuffle on' : 'Shuffle off'}
              className={`magnetic-hover hidden sm:block p-1.5 sm:p-2 transition disabled:opacity-30 disabled:cursor-not-allowed ${shuffle ? 'text-violet-400' : 'text-gray-500 hover:text-white'}`}
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handlePrev}
              disabled={songs.length === 0}
              aria-label="Previous track"
              className="magnetic-hover p-1.5 sm:p-2 text-gray-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipBack className="w-6 h-6 sm:w-6 sm:h-6" />
            </button>
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={songs.length === 0}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="magnetic-hover ring-pulse w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#18151f] text-white flex items-center justify-center hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isPlaying ? <Pause className="w-5 h-5" strokeWidth={1.75} /> : <Play className="w-5 h-5 ml-0.5" strokeWidth={1.75} />}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={songs.length === 0}
              aria-label="Next track"
              className="magnetic-hover p-1.5 sm:p-2 text-gray-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipForward className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={handleToggleRepeat}
              disabled={songs.length === 0}
              title={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
              className={`magnetic-hover hidden sm:block p-1.5 sm:p-2 transition disabled:opacity-30 disabled:cursor-not-allowed ${repeat !== 'off' ? 'text-violet-400' : 'text-gray-500 hover:text-white'}`}
            >
              {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-500 absolute left-3 right-3 -top-[5px] sm:static sm:w-full">
            <span className="hidden sm:block w-10 shrink-0 tabular-nums text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.05}
              value={Math.min(currentTime, duration || 0)}
              onInput={handleSeek}
              onChange={handleSeek}
              aria-label="Seek"
              className="flex-1 h-2 rounded-full appearance-none bg-white/25 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="hidden sm:block w-10 shrink-0 tabular-nums">{formatTime(duration)}</span>
          </div>
          <canvas
            ref={visualizerCanvasRef}
            className="w-full h-8 rounded-lg bg-white/[0.04] border border-white/10 hidden sm:block"
            aria-label="Live audio visualizer"
          />
        </div>

        {/* Volume + utility buttons */}
        <div className="hidden sm:flex items-center gap-3 text-gray-500 shrink-0">
          <Volume2 className="w-5 h-5" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onInput={handleVolumeChange}
            onChange={handleVolumeChange}
            aria-label="Volume"
            className="w-20 sm:w-24 h-2 rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
          />
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
          aria-label="Settings"
          className="magnetic-hover ml-1 flex items-center justify-center w-11 h-11 sm:w-16 sm:h-16 rounded-full border border-white/30 text-gray-200 hover:text-white hover:border-white/70 bg-white/5 shrink-0"
        >
          <Settings2 className="w-5 h-5 sm:w-8 sm:h-8" />
        </button>

        <button
          type="button"
          onClick={() => setShowUpNext((prev) => !prev)}
          className={`magnetic-hover ml-1 flex flex-col items-center justify-center gap-0.5 w-11 h-11 sm:w-16 sm:h-16 rounded-full border shrink-0 transition-colors ${showUpNext ? 'border-violet-400/60 text-violet-300 bg-violet-500/10' : 'border-white/30 text-gray-400 hover:text-white hover:border-white/70 bg-white/5'}`}
          title="Up Next"
        >
          <ListMusic className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="text-[7px] uppercase tracking-wider hidden sm:block">Queue</span>
        </button>

        {/* Profile sphere + circular EQ */}
        <button
          type="button"
          onClick={() => setShowAccountDrawer(true)}
          className="relative shrink-0 ml-auto hidden sm:flex items-center justify-center"
          style={{ width: 112, height: 112 }}
          title="Profile"
        >
          <canvas
            ref={circularEqCanvasRef}
            className="absolute inset-0 w-full h-full"
          />
          <div
            className="relative z-10 w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center"
            style={{ borderColor: 'rgba(var(--accent-rgb), 0.6)' }}
          >
            {profilePicUrl
              ? <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
              : <UserCircle2 className="w-10 h-10 text-gray-500" />
            }
          </div>
        </button>

      </footer>

      {/* Up Next popup panel — slides up above the footer right */}
      <AnimatePresence>
        {showUpNext && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="menu-panel fixed right-4 sm:right-6 bottom-[8.5rem] sm:bottom-[9.5rem] z-40 w-80 xl:w-96 flex flex-col rounded-2xl overflow-hidden"
            style={{ maxHeight: '420px' }}
          >
            <div className="px-4 pt-3 pb-2 shrink-0 border-b border-white/[0.06] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400/80 shrink-0 animate-pulse" />
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">Up Next</p>
              {(songQueue.length > 0 || (currentTrackIndex != null && songs.slice(currentTrackIndex + 1).length > 0)) && (
                <span className="ml-auto text-[10px] text-gray-600 tabular-nums">{songQueue.length + (currentTrackIndex != null ? songs.slice(currentTrackIndex + 1).length : 0)} tracks</span>
              )}
              <button
                type="button"
                onClick={() => setShowUpNext(false)}
                className="text-gray-600 hover:text-gray-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-2 py-2">
              <UpNextPanel
                songs={songs}
                currentTrackIndex={currentTrackIndex}
                songQueue={songQueue}
                onPlaySong={handlePlaySongClick}
                onRemoveSong={handleRemoveFromQueue}
                onRemoveFromManualQueue={handleRemoveFromManualQueue}
                onReorder={handleReorderQueue}
                onEditMetadata={handleEditQueueSong}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>


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
            <p className="text-sm text-gray-400 mt-3">— Soonavi</p>
          </motion.div>
        )}
      </AnimatePresence>

      <LegalModal open={legalTab !== null} initialTab={legalTab || 'privacy'} onClose={() => setLegalTab(null)} />

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
              className="fixed right-4 top-4 bottom-4 z-50 w-[340px] rounded-2xl border border-white/10 bg-[#0f1117]/90 backdrop-blur-xl p-4 flex flex-col gap-3 glass-card overflow-y-auto"
            >
              <div className="flex items-center justify-between shrink-0">
                <h3 className="text-sm font-semibold text-white tracking-wide">Account</h3>
                <button type="button" onClick={() => setShowAccountDrawer(false)} className="text-xs text-gray-500 hover:text-white transition-colors">Close</button>
              </div>

              {/* Profile card */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex items-center gap-4">
                <div className="relative shrink-0 flex items-center justify-center" style={{ width: 140, height: 140 }}>
                  <canvas ref={drawerEqCanvasRef} className="absolute inset-0 w-full h-full" />
                  <label className="relative z-10 cursor-pointer group">
                    <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-white/20 group-hover:border-violet-400/60 transition-colors flex items-center justify-center bg-white/[0.06]">
                      {profilePicUrl
                        ? <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
                        : <UserCircle2 className="w-12 h-12 text-gray-600" />
                      }
                    </div>
                    <span className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ImagePlus className="w-5 h-5 text-white" />
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} />
                  </label>
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Display name"
                    className="bg-transparent text-sm text-white font-medium w-full outline-none border-b border-white/10 focus:border-violet-400/60 pb-0.5 transition-colors placeholder-gray-600"
                  />
                  <p className="text-xs text-gray-500 truncate mt-1">{user?.email}</p>
                  {profilePicUrl && (
                    <button type="button" onClick={() => { setProfilePicUrl(null); safeSetStorage('listenwell-profile-pic', null) }} className="text-[10px] text-red-400/70 hover:text-red-400 mt-1 transition-colors">Remove photo</button>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Songs', value: songs.length },
                  { label: 'Loved', value: lovedSongIds.length },
                  { label: 'Plays', value: Object.values(playCounts).reduce((a, b) => a + b, 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
                    <p className="text-base font-semibold text-white tabular-nums">{value}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Listen leaderboard */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">Listen leaderboard</p>
                  <span className="text-[10px] text-gray-600">Top {topListened.length || ''}</span>
                </div>
                {topListened.length === 0 ? (
                  <p className="text-xs text-gray-600">No plays yet. Songs you listen to most will rank here.</p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {topListened.map(({ song, count }, idx) => {
                      const rankStyles = [
                        'text-amber-300 border-amber-300/40 bg-amber-300/10',
                        'text-gray-200 border-white/30 bg-white/[0.08]',
                        'text-orange-300 border-orange-300/40 bg-orange-300/10',
                      ]
                      const rankClass = rankStyles[idx] || 'text-violet-300 border-violet-400/30 bg-violet-500/10'
                      return (
                        <li key={song.id} className="flex items-center gap-2.5">
                          <span className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center text-[10px] font-bold tabular-nums ${rankClass}`}>{idx + 1}</span>
                          <div className="shrink-0 w-9 h-9 rounded-lg overflow-hidden bg-white/[0.06] flex items-center justify-center">
                            {song.coverUrl ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music2 className="w-4 h-4 text-white/50" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white/95 truncate">{song.title || song.fileName}</p>
                            <div className="mt-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400/80 to-violet-500/80"
                                style={{ width: `${topPlayMax ? Math.max(8, (count / topPlayMax) * 100) : 0}%` }}
                              />
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] tabular-nums text-gray-400 w-12 text-right">{count} {count === 1 ? 'play' : 'plays'}</span>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </div>

              {/* Appearance shortcuts */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-2">
                <p className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">Quick settings</p>
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>Theme</span>
                  <span className="capitalize text-violet-300">{theme}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>Crossfade</span>
                  <span className="text-violet-300">{crossfadeDuration === 0 ? 'Off' : `${crossfadeDuration}ms`}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>Vol. normalisation</span>
                  <span className={volumeNormalization ? 'text-green-400' : 'text-gray-500'}>{volumeNormalization ? 'On' : 'Off'}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>Art color</span>
                  <span className={artColorExtract ? 'text-green-400' : 'text-gray-500'}>{artColorExtract ? 'On' : 'Off'}</span>
                </div>
              </div>

              {/* Saved Presets */}
              <div className="flex-1 min-h-0 flex flex-col gap-2">
                <p className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">Saved presets</p>
                <div className="space-y-2 overflow-auto pr-0.5" style={{ maxHeight: '28vh' }}>
                  {savedPresets.length === 0 ? (
                    <p className="text-xs text-gray-600">No saved presets yet. Use Settings → Save current profile preset.</p>
                  ) : (
                    savedPresets.map((preset) => (
                      <div key={preset.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                        <p className="text-xs text-white mb-0.5">{preset.name}</p>
                        <p className="text-[10px] text-gray-500 mb-2">{preset.theme} · {preset.eqPreset} · {Math.min(preset.playbackRate, 1).toFixed(2)}×</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => applyPreset(preset)} className="flex-1 text-center py-1 rounded-lg border border-violet-400/40 text-violet-300 text-[11px] hover:bg-violet-500/10 transition-colors">Apply</button>
                          <button type="button" onClick={() => setSavedPresets((prev) => prev.filter((item) => item.id !== preset.id))} className="px-2.5 py-1 rounded-lg border border-white/15 text-gray-400 text-[11px] hover:bg-white/[0.06] transition-colors">Delete</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sign out */}
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="w-full mt-1 py-2 rounded-xl border border-red-500/20 text-red-400/80 text-xs hover:border-red-400/40 hover:bg-red-500/[0.06] hover:text-red-300 transition-colors"
              >
                Sign out
              </button>
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

      {/* Settings modal — opened from the top-right dropdown */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div
            className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettingsModal(false)} />
            <motion.div
              className="relative z-10 w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/12 bg-[#0f0e14] shadow-2xl glass-card overflow-hidden"
              initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                <h2 className="section-title text-sm text-white">Settings</h2>
                <button type="button" onClick={() => setShowSettingsModal(false)} className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1">Done</button>
              </div>

              <div className="flex gap-1 px-3 pt-3 shrink-0">
                {['account', 'audio', 'appearance'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSettingsModalTab(t)}
                    className={`flex-1 capitalize py-2 rounded-lg text-xs font-medium border transition-colors ${settingsModalTab === t ? 'bg-violet-500/15 text-violet-100 border-violet-500/40' : 'text-gray-400 hover:text-gray-200 border-transparent'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5 text-sm text-gray-300">
                {settingsModalTab === 'account' && (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-white/[0.06] flex items-center justify-center shrink-0 border border-white/10">
                        {profilePicUrl ? <img src={profilePicUrl} alt="" className="w-full h-full object-cover" /> : <UserCircle2 className="w-9 h-9 text-gray-500" />}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-violet-300 hover:text-violet-200 text-xs font-medium">
                          <ImagePlus className="w-3.5 h-3.5" /> Change photo
                          <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} />
                        </label>
                        {profilePicUrl && (
                          <button type="button" onClick={() => { setProfilePicUrl(null); safeSetStorage('listenwell-profile-pic', null) }} className="text-[11px] text-red-400/70 hover:text-red-400 text-left transition-colors">Remove photo</button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-gray-500 font-medium">Display name</label>
                      <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-gray-500 font-medium">Email</label>
                      <div className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-400 truncate">{user?.email || '—'}</div>
                    </div>
                    <button type="button" onClick={() => supabase.auth.signOut()} className="w-full text-center rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 py-2.5 text-sm font-medium transition-colors mt-1">Sign out</button>
                  </>
                )}

                {settingsModalTab === 'audio' && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-500 font-medium">Audio output</span>
                      {typeof window !== 'undefined' && audioRef.current && typeof audioRef.current.setSinkId === 'function' ? (
                        <select
                          value={outputDeviceId}
                          onChange={(e) => setOutputDeviceId(e.target.value)}
                          className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                        >
                          <option value="default">System default</option>
                          {audioOutputs.filter((d) => d.deviceId && d.deviceId !== 'default').map((d, i) => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Output ${i + 1}`}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-gray-600">Output selection isn&apos;t supported in this browser.</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-500 font-medium">Equalizer preset</span>
                      <div className="flex gap-2">
                        {[{ id: 'normal', label: 'Normal' }, { id: 'bass', label: 'Bass boost' }, { id: 'bright', label: 'Bright' }].map((p) => (
                          <button key={p.id} type="button" onClick={() => setEqPreset(p.id)} className={`flex-1 py-1.5 rounded-full border text-[11px] transition-colors ${eqPreset === p.id ? 'border-violet-500/70 bg-violet-500/15 text-white' : 'border-white/10 text-gray-400 hover:border-white/30'}`}>{p.label}</button>
                        ))}
                      </div>
                    </div>

                    <Equalizer
                      bands={EQ_BANDS}
                      gains={customEqGains}
                      onChange={(i, v) => setCustomEqGains((prev) => prev.map((g, idx) => (idx === i ? v : g)))}
                      onReset={() => setCustomEqGains(EQ_BANDS.map(() => 0))}
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-300 font-medium">Volume normalisation</span>
                      <button type="button" role="switch" aria-checked={volumeNormalization} aria-label="Volume normalisation" onClick={() => setVolumeNormalization((p) => !p)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${volumeNormalization ? 'bg-violet-600' : 'bg-white/20'}`}>
                        <span className={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${volumeNormalization ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-300 font-medium">Crossfade</span><span className="text-xs text-cyan-300 tabular-nums">{crossfadeDuration === 0 ? 'Off' : `${crossfadeDuration}ms`}</span></div>
                      <input type="range" min={0} max={2000} step={50} value={crossfadeDuration} onChange={(e) => setCrossfadeDuration(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none bg-white/15 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center"><span className="text-xs text-gray-300 font-medium">Playback speed</span><span className="text-xs text-violet-300 tabular-nums">{effectivePlaybackRate.toFixed(2)}×</span></div>
                      <input type="range" min={0.25} max={3} step={0.05} value={effectivePlaybackRate} onChange={(e) => setPlaybackRate(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none bg-white/15 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer" />
                      <button type="button" onClick={() => setPlaybackRate(1)} className="self-start text-[11px] text-gray-500 hover:text-gray-300 transition-colors">Reset to 1×</button>
                    </div>
                  </>
                )}

                {settingsModalTab === 'appearance' && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-500 font-medium">Theme</span>
                      <div className="grid grid-cols-3 gap-2">
                        {THEMES.map((scene) => (
                          <button key={scene.id} type="button" onClick={() => setTheme(normalizeThemeId(scene.id))} className={`rounded-lg border px-2 py-1.5 text-[11px] text-center transition-colors ${theme === scene.id ? 'border-violet-500/60 bg-violet-500/10 text-violet-100' : 'border-white/10 hover:border-white/40 text-gray-300'}`}>{scene.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between"><span className="text-xs text-gray-300 font-medium">Aurora intensity</span><span className="text-xs text-gray-500 tabular-nums">{Math.round(auroraIntensity * 100)}%</span></div>
                      <input type="range" min={0} max={1} step={0.05} value={auroraIntensity} onChange={(e) => setAuroraIntensity(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none bg-white/15 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between"><span className="text-xs text-gray-300 font-medium">Glow softness</span><span className="text-xs text-gray-500 tabular-nums">{Math.round(glowSoftness * 100)}%</span></div>
                      <input type="range" min={0} max={1} step={0.05} value={glowSoftness} onChange={(e) => setGlowSoftness(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none bg-white/15 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between"><span className="text-xs text-gray-300 font-medium">Blur amount</span><span className="text-xs text-gray-500 tabular-nums">{Math.round(blurAmount * 100)}%</span></div>
                      <input type="range" min={0} max={1} step={0.05} value={blurAmount} onChange={(e) => setBlurAmount(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none bg-white/15 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer" />
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {showKeyboardShortcuts && (
          <KeyboardShortcutsModal onClose={() => setShowKeyboardShortcuts(false)} />
        )}
      </AnimatePresence>

      {/* Metadata editor — opens after upload and from the song context menu.
          Works on every screen size, unlike the desktop-only Details panel. */}
      <AnimatePresence>
        {showMetadataModal && selectedSong && (
          <motion.div
            className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMetadataModal} />
            <motion.div
              className="relative z-10 w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/12 bg-[#0f0e14] shadow-2xl p-5 flex flex-col gap-4 glass-card"
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between">
                <h2 className="section-title text-sm text-white">Edit details</h2>
                <button type="button" onClick={closeMetadataModal} className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1">Done</button>
              </div>

              <div className="flex gap-4 items-center">
                <div className="w-20 h-20 rounded-xl bg-white/[0.06] flex items-center justify-center overflow-hidden shrink-0">
                  {selectedSong.coverUrl
                    ? <img src={selectedSong.coverUrl} alt="" className="w-full h-full object-cover" />
                    : <Music2 className="w-8 h-8 text-white/50" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 truncate mb-1.5">{selectedSong.fileName}</p>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-violet-300 hover:text-violet-200 text-xs font-medium">
                    <ImagePlus className="w-3.5 h-3.5" /> Change cover
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Title</label>
                <input type="text" value={selectedSong.title} onChange={(e) => handleMetadataChange('title', e.target.value)} className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50" placeholder="Song title" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Artist</label>
                <input type="text" value={selectedSong.artist} onChange={(e) => handleMetadataChange('artist', e.target.value)} className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50" placeholder="Artist name" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Album</label>
                <input type="text" value={selectedSong.album} onChange={(e) => handleMetadataChange('album', e.target.value)} className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50" placeholder="Album name" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Description / notes</label>
                <textarea value={selectedSong.description} onChange={(e) => handleMetadataChange('description', e.target.value)} rows={2} className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500/50" placeholder="Optional notes" />
              </div>

              <button
                type="button"
                onClick={closeMetadataModal}
                className="ui-btn-primary w-full text-center py-2.5 text-sm font-semibold rounded-lg mt-1"
              >
                Save details
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App