import { supabase } from './lib/supabase'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import './App.css'
import { analyzeAudio } from './utils/audioAnalysis'
import { hashAudioFile, findDuplicates, describeDuplicate } from './utils/duplicates'
import { buildLibraryExport, parseLibraryExport, mergeLibraryImport } from './utils/libraryTransfer'
import { selectSmartPlaylistSongs, createEmptyDefinition } from './utils/smartPlaylists'
import { extractPeaksFromFile } from './utils/waveform'
import { writeId3Tag, supportsId3 } from './utils/id3Writer'
import {
  listOfflineSongIds, saveSongOffline, removeSongOffline, offlineObjectUrl,
  offlineUsageBytes, formatBytes, saveFileOffline, saveCoverOffline,
  offlineCoverObjectUrl, offlineSongBlob,
} from './utils/offlineCache'
import {
  readLocalSongs, addLocalSong, updateLocalSong, removeLocalSong, isLocalSong,
} from './utils/localLibrary'
import WaveformSeek from './components/WaveformSeek'
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
import ListeningLogScreen from './components/ListeningLogScreen'
import { THEMES, normalizeThemeId, themeTone } from './utils/themes'
import CoverCropModal from './components/CoverCropModal'
import CommandPalette from './components/CommandPalette'
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
  BarChart3,
  Cloud,
  HardDrive,
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
// Keyboard scrub and volume increments.
const SEEK_STEP_SECONDS = 10
const VOLUME_STEP = 0.05

// Per-account upload cap. Temporary while limits/monetization are decided.
const MAX_UPLOADS = 50
// Owner accounts exempt from the upload cap
const UNLIMITED_UPLOAD_EMAILS = ['attakhelicoptir@gmail.com']

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  // Set when the user opens a password-reset link from their email; Supabase
  // creates a recovery session and we show the "set new password" screen.
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [uploadNotice, setUploadNotice] = useState(null)
  const uploadNoticeTimerRef = useRef(null)
  // { files, prescan, duplicates } while the listener decides what to do about
  // files that already look present in the library.
  const [duplicatePrompt, setDuplicatePrompt] = useState(null)
  // { files } while the listener chooses where a batch should live — on this
  // device only, or hosted on the account. Asked every time: it decides whether
  // the audio leaves the machine, which is not a thing to assume.
  const [destinationPrompt, setDestinationPrompt] = useState(null)
  // Incremented by the `/` shortcut; SongsScreen watches it to focus search.
  const [searchFocusSignal, setSearchFocusSignal] = useState(0)
  // { songIds, artist, album } while the batch field editor is open. Blank
  // fields are left alone rather than blanking the tracks.
  const [batchEdit, setBatchEdit] = useState(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  // Track ids held in Cache Storage. Read once on mount from the cache itself,
  // which is the authority — not from synced state, since what's downloaded is
  // per-device rather than per-account.
  const [offlineSongIds, setOfflineSongIds] = useState([])
  const [offlineBusyIds, setOfflineBusyIds] = useState([])
  const [offlineUsage, setOfflineUsage] = useState(0)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  // { file, songId } while the cover cropper is open.
  const [coverCrop, setCoverCrop] = useState(null)
  const coverCropRef = useRef(null)
  coverCropRef.current = coverCrop
  const [isUploading, setIsUploading] = useState(false)
  // Per-file upload state: [{ id, name, status, error }]. A single spinner
  // couldn't say which of twelve files failed, or let you retry just that one.
  const [uploadQueue, setUploadQueue] = useState([])
  // Queue id -> File, so a failed entry can be retried without re-picking it.
  const uploadFilesRef = useRef(new Map())
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
  // Land on Home, not Upload. Uploading is an occasional action; opening every
  // session on it — which is what happened on phones, where there's no visible
  // desktop nav to redirect from — buried the library behind an extra tap.
  const [activePage, setActivePage] = useState('home')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('playback')
  const [playlists, setPlaylists] = useState(() => parseStoredJSON('listenwell-playlists', []))
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null)
  const [songFilter, setSongFilter] = useState('all')
  const [songSortBy, setSongSortBy] = useState('default')
  const [songTileSize, setSongTileSize] = useState(() => safeGetStorage('listenwell-tile-size', 'medium'))
  // How the Songs page lays entries out: 'grid' of artwork or 'bars' of rows.
  const [songViewMode, setSongViewMode] = useState(() => safeGetStorage('listenwell-song-view', 'grid'))
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
  const [audioOutputs, setAudioOutputs] = useState([])
  const [outputDeviceId, setOutputDeviceId] = useState(() => safeGetStorage('listenwell-output', 'default'))
  const [accentColor, setAccentColor] = useState('139 92 246')
  // Dominant cover colour for the mobile mini player bar, darkened for white text
  const [miniBarColor, setMiniBarColor] = useState('24 21 31')
  // Suppresses the tap-to-open when a swipe gesture just ended on the mini bar
  const miniBarDragRef = useRef(false)
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
  // Position to restore when the next src assignment is a re-signed URL for the
  // track already playing, rather than a genuine track change.
  const resumeAtRef = useRef(null)
  // { id, tries } — caps re-sign attempts so a genuinely broken file doesn't loop.
  const audioRecoveryRef = useRef({ id: null, tries: 0 })
  // Level to restore when unmuting with `m`.
  const premuteVolumeRef = useRef(1)
  // handleDeleteSong is defined further down; batch delete reaches it by ref.
  const handleDeleteSongRef = useRef(null)
  // Read inside the offline toggle, which must see the current list without
  // being re-created every time it changes.
  const offlineSongIdsRef = useRef([])
  // The window-level drop listener is installed once, so it reaches the
  // current upload handler through a ref rather than a stale closure.
  const processAudioFilesRef = useRef(null)
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
  // Handle to the in-flight tail fade-out so a new crossfade can cancel it
  const tailFadeIntervalRef = useRef(null)
  const crossfadeArmedRef = useRef(false)
  const handleNextRef = useRef(null)
  const handlePrevRef = useRef(null)
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
  
    // Device-only songs live in Cache Storage and localStorage, so they have to
    // be folded back in by hand — the tracks table has never heard of them. A
    // record whose audio is no longer in the cache is skipped rather than shown
    // as a row that can't play.
    const loadLocalSongs = async () => {
      const records = readLocalSongs()
      if (records.length === 0) return []
      const present = new Set(await listOfflineSongIds())
      return Promise.all(
        records
          .filter((record) => present.has(record.id))
          .map(async (record) => ({
            ...record,
            storagePath: null,
            url: null,
            coverUrl: await offlineCoverObjectUrl(record.id),
          })),
      )
    }

    const loadSongs = async () => {
      const localSongs = await loadLocalSongs()

      const { data: tracks, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('user_id', user.id)

      if (error) {
        console.error('Failed to load library:', error.message)
        if (localSongs.length > 0) setSongs(localSongs)
        return
      }
      if (!tracks?.length) {
        if (localSongs.length > 0) setSongs(localSongs)
        return
      }

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
          // Kept so an expired signed URL can be re-minted without another
          // round trip to the tracks table.
          storagePath: track.storage_path,
          contentHash: m.contentHash ?? null,
          duration: typeof m.duration === 'number' ? m.duration : null,
          peaks: Array.isArray(m.peaks) ? m.peaks : null,
          url: audioUrls?.[i]?.signedUrl || '',
          coverUrl: coverUrls?.[i]?.signedUrl || null,
          description: m.description || '',
          lyrics: '',
          gainDb: typeof m.gainDb === 'number' ? m.gainDb : 0,
          bpm: m.bpm ?? null,
        }
      })

      setSongs([...songsWithUrls, ...localSongs])
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
    // A device-only song keeps its metadata on the device too. Routing it
    // through songMeta would sync the title, waveform and analysis to the
    // account — exactly what choosing "this device" opted out of.
    if (isLocalSong(id)) {
      updateLocalSong(id, patch)
      return
    }
    setSongMeta((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }, [])

  // Signed URLs are minted for SIGNED_URL_TTL and only refreshed on login, so a
  // tab (or an installed PWA) left open past that window ends up holding dead
  // URLs. Re-mint one on demand from the stored path.
  const resignSong = useCallback(async (songId) => {
    const song = stateRef.current.songs?.find((s) => s.id === songId)
    if (!song?.storagePath) return null
    const dir = song.storagePath.split('/').slice(0, -1).join('/')
    const [{ data: audio }, { data: cover }] = await Promise.all([
      supabase.storage.from('audio-files').createSignedUrl(song.storagePath, SIGNED_URL_TTL),
      supabase.storage.from('audio-files').createSignedUrl(`${dir}/cover`, SIGNED_URL_TTL),
    ])
    const freshUrl = audio?.signedUrl
    if (!freshUrl) return null
    setSongs((prev) => prev.map((s) => (
      s.id === songId ? { ...s, url: freshUrl, coverUrl: cover?.signedUrl || s.coverUrl } : s
    )))
    return freshUrl
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
        // A rapid run of next/prev presses starts a new tail before the last
        // one has finished. The previous interval kept its own handle to the
        // shared element, so the fades fought over tail.volume and an expiring
        // fade would pause/unload a tail that had only just started — audible
        // as a dropout while skipping. Cancel the outgoing fade first.
        if (tailFadeIntervalRef.current) {
          clearInterval(tailFadeIntervalRef.current)
          tailFadeIntervalRef.current = null
        }
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
              if (tailFadeIntervalRef.current === id) tailFadeIntervalRef.current = null
              tail.pause()
              tail.removeAttribute('src')
              tail.load()
            }
          }, dur / steps)
          tailFadeIntervalRef.current = id
        }).catch(() => {})
      } catch { /* ignore tail failures — main track still transitions */ }
    }

    // Fade the new track in: start silent, ramp up once it begins playing.
    setFadeGain(0.0001, 0)
    switchTrack()
    requestAnimationFrame(() => setFadeGain(1, dur))
  }, [crossfadeDuration, setFadeGain])

  // Advancing to the index we're already on — a one-song library, repeat-all
  // with a single track, or a manual-queue entry pointing at the current song —
  // calls setCurrentTrackIndex() with an unchanged value. React bails out, so
  // the [currentTrackIndex, currentTrackUrl] effect never re-runs, audio.src is
  // never reassigned, and the element just sits at its ended state: silence.
  // Restart it explicitly instead of relying on a state transition.
  const restartCurrent = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    hasCountedRef.current = false
    crossfadeArmedRef.current = false
    setFadeGain(1, 0)
    audio.currentTime = 0
    audio.play().then(() => setIsPlaying(true)).catch(() => {})
  }, [setFadeGain])

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

  // The element errors with no visible cause when a signed URL has expired.
  // Re-mint once and resume where we were; a second failure is a real problem
  // with the file, so surface it instead of retrying forever.
  const handleAudioError = useCallback(async () => {
    const audio = audioRef.current
    const { songs: currentSongs, currentTrackIndex: idx } = stateRef.current
    const song = idx == null ? null : currentSongs?.[idx]
    if (!audio || !song) return
    // An object-URL fallback song has nothing in storage to re-sign.
    if (!song.storagePath) return

    const attempts = audioRecoveryRef.current.id === song.id ? audioRecoveryRef.current.tries : 0
    if (attempts >= 1) {
      showUploadNotice('error', `"${song.title || song.fileName}" could not be loaded. Try refreshing.`)
      return
    }
    audioRecoveryRef.current = { id: song.id, tries: attempts + 1 }

    resumeAtRef.current = audio.currentTime || 0
    const freshUrl = await resignSong(song.id)
    if (!freshUrl) {
      resumeAtRef.current = null
      showUploadNotice('error', `"${song.title || song.fileName}" could not be loaded. Try refreshing.`)
    }
    // On success the src effect picks up the new URL and restores the position.
  }, [resignSong, showUploadNotice])

  // Declared above its callers: the offline cache is the authority on what's
  // downloaded, so this re-reads it rather than tracking it optimistically.
  const refreshOfflineState = useCallback(async () => {
    const [ids, usage] = await Promise.all([listOfflineSongIds(), offlineUsageBytes()])
    setOfflineSongIds(ids)
    setOfflineUsage(usage)
  }, [])

  const processAudioFiles = useCallback(async (fileList, options) => {
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
    const uploadCap = UNLIMITED_UPLOAD_EMAILS.includes(currentUser.email?.toLowerCase())
      ? Infinity
      : MAX_UPLOADS
    const existingCount = stateRef.current.songs?.length ?? 0
    if (existingCount >= uploadCap) {
      showUploadNotice('error', `You've reached the ${MAX_UPLOADS}-song upload limit. Remove a song before adding more.`)
      return
    }
    const audioFiles = allAudioFiles.slice(0, uploadCap - existingCount)
    const skippedForLimit = allAudioFiles.length - audioFiles.length

    // Where the audio should live. Asked before anything is read or sent —
    // "keep it on this device" has to mean the bytes never left.
    const destination = options?.destination
    if (destination !== 'local' && destination !== 'server') {
      setDestinationPrompt({ files: audioFiles })
      return
    }
    const keepLocal = destination === 'local'

    // Read tags and hash the bytes up front so duplicates are caught before
    // anything is uploaded, and so the upload below doesn't re-read the tags.
    // Reused on the second pass when the listener has already made a choice.
    const prescan = options?.prescan ?? new Map(
      await Promise.all(audioFiles.map(async (f) => {
        const [tags, contentHash] = await Promise.all([
          readAudioTags(f).catch(() => null),
          hashAudioFile(f).catch(() => null),
        ])
        return [f, { tags, contentHash }]
      })),
    )

    if (!options?.skipDuplicateCheck) {
      const candidates = audioFiles.map((f) => {
        const pre = prescan.get(f) || {}
        return {
          file: f,
          title: pre.tags?.title || f.name.replace(/\.[^/.]+$/, ''),
          artist: pre.tags?.artist || '',
          contentHash: pre.contentHash,
        }
      })
      const duplicates = findDuplicates(candidates, stateRef.current.songs || [])
      if (duplicates.length > 0) {
        // The listener decides — a better-bitrate re-rip is a legitimate
        // re-upload, and the app shouldn't quietly discard files.
        setDuplicatePrompt({ files: audioFiles, prescan, duplicates, destination })
        return
      }
    }

    setIsUploading(true)
    const batchStamp = Date.now()
    const queueEntries = audioFiles.map((f, i) => ({
      id: `${batchStamp}-${i}`,
      name: f.name,
      status: 'uploading',
      error: null,
      // Kept so Retry doesn't quietly send a device-only file to the server.
      destination,
    }))
    setUploadQueue(queueEntries)
    uploadFilesRef.current = new Map(queueEntries.map((entry, i) => [entry.id, audioFiles[i]]))

    const markQueue = (index, patch) => {
      const entryId = queueEntries[index].id
      setUploadQueue((prev) => prev.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)))
    }

    const failures = []
    const newSongs = await Promise.all(
      audioFiles.map(async (f, fileIndex) => {
        const id = crypto.randomUUID()
        let tags = null
        let saveError = null
        let url = null
        let coverUrl = null
        // Null when the upload failed and we fell back to an object URL —
        // there is nothing in storage to re-sign in that case.
        let savedStoragePath = null
        const contentHash = prescan.get(f)?.contentHash ?? null

        try {
          tags = prescan.get(f)?.tags ?? await readAudioTags(f)

          // ── Device-only: the file goes into Cache Storage and stops there.
          // No storage upload, no `tracks` row, no signed URL. `url` stays null
          // — the offline resolver mints an object URL for whatever is playing,
          // which is also how a downloaded server track is played.
          if (keepLocal) {
            const stored = await saveFileOffline(id, f)
            if (!stored.ok) throw new Error(stored.error)
            if (tags?.picture) {
              const { data, format } = tags.picture
              const coverBlob = new Blob([data], { type: format || 'image/jpeg' })
              await saveCoverOffline(id, coverBlob)
              coverUrl = URL.createObjectURL(coverBlob)
            }
            markQueue(fileIndex, { status: 'done' })
            return {
              id,
              title: tags?.title || f.name.replace(/\.[^/.]+$/, ''),
              fileName: f.name,
              artist: tags?.artist || '',
              album: tags?.album || '',
              storagePath: null,
              contentHash,
              gainDb: 0,
              bpm: null,
              url: null,
              coverUrl,
              description: '',
              lyrics: '',
              local: true,
              _file: f,
            }
          }

          const sanitizedName = f.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
          const storagePath = `${currentUser.id}/${id}/${sanitizedName}`

          // A track's bytes never change once written (the path is keyed on a
          // fresh song id), so it can be cached hard. Supabase defaults to
          // max-age=3600; past that hour every replay re-downloads the file,
          // and the crossfade's tail element — which requests the same signed
          // URL the main element is already streaming — opens a second network
          // stream instead of reading from cache. On a phone that's the
          // difference between a smooth transition and a stall.
          const { error: uploadError } = await supabase.storage
            .from('audio-files')
            .upload(storagePath, f, { upsert: true, cacheControl: '31536000' })
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
          savedStoragePath = storagePath
          markQueue(fileIndex, { status: 'done' })
        } catch (err) {
          saveError = err?.message || 'Unknown error'
          failures.push({ name: f.name, reason: saveError })
          markQueue(fileIndex, { status: 'failed', error: saveError })
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
          storagePath: savedStoragePath,
          contentHash,
          gainDb: 0,
          bpm: null,
          url,
          coverUrl,
          description: '',
          lyrics: '',
          // Stays true even when the save above failed, so a device-only file
          // that didn't make it is still treated as device-only — otherwise its
          // title and analysis would sync to the account by the back door.
          local: keepLocal,
          _file: f,
        }
      }),
    )

    const limitNote = skippedForLimit > 0
      ? ` ${skippedForLimit} song${skippedForLimit > 1 ? 's were' : ' was'} skipped — you've reached the ${MAX_UPLOADS}-song upload limit.`
      : ''
    const where = keepLocal ? 'to this device' : 'to your library'
    if (failures.length > 0) {
      const saved = audioFiles.length - failures.length
      showUploadNotice('error', `${failures.length} song${failures.length > 1 ? 's' : ''} could not be saved ${where} (${failures[0].reason}). ${saved > 0 ? `${saved} saved. ` : ''}Unsaved songs will play until you refresh.${limitNote}`)
    } else {
      showUploadNotice('success', `${audioFiles.length} song${audioFiles.length > 1 ? 's' : ''} saved ${where}.${limitNote}`)
    }

    setIsUploading(false)
    // Successful entries have served their purpose; failures stay on screen
    // with a retry until they're dealt with.
    setUploadQueue((prev) => prev.filter((entry) => entry.status === 'failed'))

    // Write the device-only records before any metadata is persisted below:
    // `persistSongMeta` routes by this list, and a song missing from it would
    // have its analysis synced to the account the listener opted out of.
    // The object URLs are deliberately left out — they die on reload, and the
    // audio and artwork are already in the cache.
    for (const song of newSongs) {
      if (!song.local) continue
      addLocalSong({
        id: song.id,
        title: song.title,
        fileName: song.fileName,
        artist: song.artist,
        album: song.album,
        contentHash: song.contentHash,
        gainDb: song.gainDb,
        bpm: song.bpm,
        description: '',
        lyrics: '',
      })
    }
    if (newSongs.some((s) => s.local)) refreshOfflineState()

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

    // Remember each file's hash so duplicate detection still works after a
    // reload, when the library comes back from the tracks table rather than
    // from the files themselves.
    for (const song of newSongs) {
      if (song.contentHash) persistSongMeta(song.id, { contentHash: song.contentHash })
    }

    for (const song of newSongs) {
      const f = song._file
      if (!f) continue
      analyzeAudio(f).then(({ gainDb, bpm }) => {
        setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, gainDb, bpm } : s))
        persistSongMeta(song.id, { gainDb, bpm })
      }).catch(() => {})

      // Waveform for the seek bar. Cached because decoding is far too
      // expensive to repeat, and optional — a failure just leaves a flat bar.
      extractPeaksFromFile(f).then((peaks) => {
        if (!peaks) return
        setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, peaks } : s))
        persistSongMeta(song.id, { peaks })
      }).catch(() => {})
    }
  }, [showUploadNotice, user, persistSongMeta, refreshOfflineState])

  const handleUpload = (e) => {
    processAudioFiles(e.target.files || [])
    if (e?.target) e.target.value = ''
  }

  // 'skip' uploads only the files that weren't flagged; 'all' uploads
  // everything anyway (a higher-bitrate re-rip is a legitimate re-upload).
  const resolveDuplicatePrompt = useCallback((choice) => {
    const prompt = duplicatePrompt
    setDuplicatePrompt(null)
    if (!prompt || choice === 'cancel') return

    const flagged = new Set(prompt.duplicates.map((d) => d.candidate.file))
    const files = choice === 'skip'
      ? prompt.files.filter((f) => !flagged.has(f))
      : prompt.files

    if (files.length === 0) {
      showUploadNotice('success', 'Nothing to upload — every selected file is already in your library.')
      return
    }
    processAudioFiles(files, {
      prescan: prompt.prescan,
      skipDuplicateCheck: true,
      destination: prompt.destination,
    })
  }, [duplicatePrompt, processAudioFiles, showUploadNotice])

  const resolveDestinationPrompt = useCallback((destination) => {
    const prompt = destinationPrompt
    setDestinationPrompt(null)
    if (!prompt || !destination) return
    processAudioFiles(prompt.files, { destination })
  }, [destinationPrompt, processAudioFiles])

  const handleDeleteSong = (songId) => {
    const idx = songs.findIndex((s) => s.id === songId)
    if (idx === -1) return
    // Don't leave the audio sitting in the device cache for a song that no
    // longer exists.
    if (offlineSongIdsRef.current.includes(songId)) {
      removeSongOffline(songId).then(refreshOfflineState)
    }
    // For a device-only song that cache was the only copy, so this is the whole
    // deletion — the Supabase pass below finds nothing and does nothing.
    removeLocalSong(songId)
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
    // Build the Web Audio graph now, inside the user gesture, so the very first
    // play already routes through it and resumes the AudioContext. Previously
    // the graph was only created on the first EQ-preset switch, which is what
    // made audio cut out at that moment.
    ensureAudioGraph()
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

  // "Play next" jumps the queue instead of joining the back of it. Any existing
  // copy is pulled out first so the song lands in exactly one place.
  const handlePlayNext = useCallback((songId) => {
    setSongQueue((prev) => [songId, ...prev.filter((id) => id !== songId)])
  }, [])

  const handleRemoveFromManualQueue = useCallback((idx) => {
    setSongQueue((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const handleReorderManualQueue = useCallback((fromIndex, toIndex) => {
    setSongQueue((prev) => {
      const next = [...prev]
      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)
      return next
    })
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

  const nowPlaying = currentTrackIndex != null ? songs[currentTrackIndex] : null

  // Resolve the cached copy for whatever is playing. Only one object URL is
  // alive at a time; holding one per offline track would leak memory across a
  // long session.
  const [offlineTrackUrl, setOfflineTrackUrl] = useState(null)
  const currentSongId = currentTrackIndex != null ? songs[currentTrackIndex]?.id : null
  const currentSongIsOffline = currentSongId ? offlineSongIds.includes(currentSongId) : false

  // A locally cached copy wins over the network URL, which is what makes
  // offline playback work and also spares the bandwidth when it's online.
  // Must stay below the declaration above: reading `offlineTrackUrl` before it
  // is initialised throws on every render and takes the whole app down.
  const currentTrackUrl = offlineTrackUrl ?? songs[currentTrackIndex]?.url ?? null

  useEffect(() => {
    let cancelled = false
    let created = null
    setOfflineTrackUrl(null)
    if (currentSongId && currentSongIsOffline) {
      offlineObjectUrl(currentSongId).then((url) => {
        if (!url) return
        if (cancelled) { URL.revokeObjectURL(url); return }
        created = url
        setOfflineTrackUrl(url)
      })
    }
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [currentSongId, currentSongIsOffline])

  // Songs uploaded before waveforms existed have no cached peaks. Compute them
  // for whatever is playing, once, in the background. The file is already in
  // the HTTP cache from playback, so this is normally a cache read rather than
  // a second download.
  const nowPlayingId = nowPlaying?.id
  const nowPlayingUrl = nowPlaying?.url
  const nowPlayingHasPeaks = Boolean(nowPlaying?.peaks)
  // Only ever attempt a given track once per session. Without this, a track
  // the browser cannot decode re-downloaded itself in full on every single
  // play, forever.
  const peaksAttemptedRef = useRef(new Set())
  useEffect(() => {
    if (!nowPlayingId || !nowPlayingUrl || nowPlayingHasPeaks) return
    if (nowPlayingUrl.startsWith('blob:')) return
    if (peaksAttemptedRef.current.has(nowPlayingId)) return

    let cancelled = false
    const controller = new AbortController()

    // This downloads the entire track and decodes it to PCM to draw the
    // scrubber. That is a big transient allocation, and doing it while the
    // phone has the tab in the background is how a backgrounded tab gets
    // reclaimed mid-song. The waveform is invisible then anyway, so wait until
    // the tab is on screen, and abandon the attempt the moment it leaves.
    const run = async () => {
      if (document.visibilityState !== 'visible') return
      peaksAttemptedRef.current.add(nowPlayingId)
      try {
        const response = await fetch(nowPlayingUrl, { signal: controller.signal })
        if (!response.ok || cancelled) return
        const blob = await response.blob()
        if (cancelled || document.visibilityState !== 'visible') return
        const peaks = await extractPeaksFromFile(blob)
        if (!peaks || cancelled) return
        setSongs((prev) => prev.map((s) => (s.id === nowPlayingId ? { ...s, peaks } : s)))
        persistSongMeta(nowPlayingId, { peaks })
      } catch {
        // A flat scrubber is an acceptable outcome; nothing to report.
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') run()
      else controller.abort()
    }
    run()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      controller.abort()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [nowPlayingId, nowPlayingUrl, nowPlayingHasPeaks, persistSongMeta])
  const effectivePlaybackRate = clampPlaybackRate(playbackRate)

  // Top listened songs for the profile leaderboard (resolved against the
  // current library so deleted songs drop off automatically). Memoized so the
  // O(plays × songs) sort+lookup doesn't run on every render — this component
  // re-renders ~10×/second while a track is playing.
  const topListened = useMemo(() => (
    Object.entries(playCounts)
      .map(([id, count]) => ({ song: songs.find((s) => s.id === id), count }))
      .filter((x) => x.song && x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  ), [playCounts, songs])
  const topPlayMax = topListened.length ? topListened[0].count : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || currentTrackIndex == null || !currentTrackUrl) return
    // New track: re-arm the end-of-track crossfade and the play-count guard.
    crossfadeArmedRef.current = false
    hasCountedRef.current = false
    audio.src = currentTrackUrl
    // Normally a new src means a new track and position resets. A re-signed URL
    // is the same track though, so honour a pending resume position instead of
    // yanking the listener back to the start.
    const resumeAt = resumeAtRef.current
    resumeAtRef.current = null
    audio.currentTime = resumeAt ?? 0
    // The 10fps ticker is the only currentTime writer now (the redundant
    // onTimeUpdate handler re-rendered the whole app on top of it); reset the
    // displayed position here so a paused track switch still shows 0:00.
    setCurrentTime(resumeAt ?? 0)
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

  // Mobile browsers suspend the AudioContext when the tab is backgrounded, the
  // screen locks, or another app grabs the audio session (a call, another
  // player). Every track is routed through createMediaElementSource(), so a
  // suspended context means silence even though the <audio> element still
  // reports itself as playing — the element's clock keeps running and the seek
  // bar keeps moving, which is exactly what "the audio just cuts out" looks
  // like. Nothing resumed the context, so it stayed dead until a full reload.
  useEffect(() => {
    const resume = () => {
      const ctx = audioContextRef.current
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') resume() }
    const audio = audioRef.current
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', resume)
    window.addEventListener('focus', resume)
    audio?.addEventListener('play', resume)
    audio?.addEventListener('playing', resume)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', resume)
      window.removeEventListener('focus', resume)
      audio?.removeEventListener('play', resume)
      audio?.removeEventListener('playing', resume)
    }
  }, [])

  // OS media controls. Without a mediaSession the lock screen, notification
  // shade, Bluetooth car stereo and headphone buttons show nothing and do
  // nothing — on a phone that makes the player feel broken even when the audio
  // itself is fine, because the moment the screen locks there's no way to skip
  // or pause without reopening the app.
  useEffect(() => {
    const ms = navigator.mediaSession
    if (!ms || typeof window.MediaMetadata !== 'function') return
    if (!nowPlaying) { ms.metadata = null; return }
    ms.metadata = new window.MediaMetadata({
      title: nowPlaying.title || nowPlaying.fileName || 'Unknown title',
      artist: nowPlaying.artist || 'Unknown artist',
      album: nowPlaying.album || '',
      artwork: nowPlaying.coverUrl
        ? [{ src: nowPlaying.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    })
  }, [nowPlaying])

  useEffect(() => {
    const ms = navigator.mediaSession
    if (!ms) return
    ms.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  useEffect(() => {
    const ms = navigator.mediaSession
    if (!ms) return
    const seekBy = (delta) => {
      const a = audioRef.current
      if (!a) return
      const max = Number.isFinite(a.duration) ? a.duration : a.currentTime
      a.currentTime = Math.min(max, Math.max(0, a.currentTime + delta))
    }
    const handlers = {
      play: () => {
        const a = audioRef.current
        a?.play().then(() => setIsPlaying(true)).catch(() => {})
      },
      pause: () => {
        const a = audioRef.current
        if (a) { a.pause(); setIsPlaying(false) }
      },
      previoustrack: () => handlePrevRef.current?.(),
      nexttrack: () => handleNextRef.current?.(),
      seekbackward: (d) => seekBy(-(d?.seekOffset || 10)),
      seekforward: (d) => seekBy(d?.seekOffset || 10),
      seekto: (d) => {
        const a = audioRef.current
        if (a && typeof d?.seekTime === 'number') a.currentTime = d.seekTime
      },
    }
    // Not every browser implements every action; an unsupported one throws.
    for (const [action, fn] of Object.entries(handlers)) {
      try { ms.setActionHandler(action, fn) } catch { /* unsupported */ }
    }
    return () => {
      for (const action of Object.keys(handlers)) {
        try { ms.setActionHandler(action, null) } catch { /* unsupported */ }
      }
    }
  }, [])

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
  useEffect(() => { safeSetStorage('listenwell-song-view', songViewMode) }, [songViewMode])
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
    songViewMode,
    volume,
    playbackRate,
    eqPreset,
    songMeta,
    songsBgUrl,
    songsBgBlur,
  })

  // Writes only the fields that were filled in, to both local state and the
  // tracks table, so a mis-tagged album can be fixed in one pass.
  const applyBatchEdit = useCallback(async () => {
    const pending = batchEdit
    setBatchEdit(null)
    if (!pending) return

    const patch = {}
    if (pending.artist.trim()) patch.artist = pending.artist.trim()
    if (pending.album.trim()) patch.album = pending.album.trim()
    if (Object.keys(patch).length === 0) return

    setSongs((prev) => prev.map((s) => (pending.songIds.includes(s.id) ? { ...s, ...patch } : s)))

    // Device-only songs are edited in place; the rest go to the tracks table.
    const localIds = pending.songIds.filter((id) => isLocalSong(id))
    for (const id of localIds) updateLocalSong(id, patch)
    const remoteIds = pending.songIds.filter((id) => !localIds.includes(id))
    if (remoteIds.length === 0) {
      showUploadNotice('success', `Updated ${pending.songIds.length} track${pending.songIds.length === 1 ? '' : 's'}.`)
      return
    }

    const { error } = await supabase.from('tracks').update(patch).in('id', remoteIds)
    if (error) {
      showUploadNotice('error', `Saved locally, but the change didn't reach your library: ${error.message}`)
      return
    }
    showUploadNotice('success', `Updated ${pending.songIds.length} track${pending.songIds.length === 1 ? '' : 's'}.`)
  }, [batchEdit, showUploadNotice])

  // Dropping a file anywhere in the window uploads it. Without this the
  // browser (and Electron) treat a stray drop as "navigate to this file",
  // which blanks the app — so the guard matters even where the drop is
  // unwanted.
  useEffect(() => {
    const allow = (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return
      event.preventDefault()
      setIsDraggingFiles(true)
    }
    const leave = (event) => {
      // Only clear when the pointer actually leaves the window, not when it
      // crosses between child elements.
      if (event.relatedTarget === null) setIsDraggingFiles(false)
    }
    const drop = (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return
      event.preventDefault()
      setIsDraggingFiles(false)
      const files = Array.from(event.dataTransfer.files || [])
      if (files.length > 0) processAudioFilesRef.current?.(files)
    }
    window.addEventListener('dragover', allow)
    window.addEventListener('dragenter', allow)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', allow)
      window.removeEventListener('dragenter', allow)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  useEffect(() => { refreshOfflineState() }, [refreshOfflineState])

  // Explicit per-song opt-in. Nothing is cached without being asked for.
  const handleToggleOffline = useCallback(async (songId) => {
    const song = stateRef.current.songs?.find((s) => s.id === songId)
    if (!song) return

    // A device-only song has no server copy to fall back on, so clearing the
    // cache would destroy it. Deleting it is a separate, explicit action.
    if (song.local) {
      showUploadNotice('error', `"${song.title || song.fileName}" only exists on this device. Delete it if you want it gone.`)
      return
    }

    setOfflineBusyIds((prev) => [...prev, songId])
    try {
      if (offlineSongIdsRef.current.includes(songId)) {
        await removeSongOffline(songId)
        showUploadNotice('success', `"${song.title || song.fileName}" removed from this device.`)
      } else {
        const result = await saveSongOffline(songId, song.url)
        if (!result.ok) { showUploadNotice('error', result.error); return }
        showUploadNotice('success', `"${song.title || song.fileName}" is available offline (${formatBytes(result.bytes)}).`)
      }
      await refreshOfflineState()
    } finally {
      setOfflineBusyIds((prev) => prev.filter((id) => id !== songId))
    }
  }, [refreshOfflineState, showUploadNotice])

  // Downloading writes the edits you made here back into the file's tag, so
  // your corrections leave with the audio instead of being stranded in the
  // account. Non-MPEG containers are handed over untouched.
  const handleDownloadSong = useCallback(async (songId) => {
    const song = stateRef.current.songs?.find((s) => s.id === songId)
    // A device-only song has no URL to fetch — its bytes come out of the cache.
    if (!song || (!song.url && !song.local)) return

    try {
      const source = song.url
        ? await fetch(song.url).then((r) => {
            if (!r.ok) throw new Error(`status ${r.status}`)
            return r.blob()
          })
        : await offlineSongBlob(songId)
      if (!source) throw new Error('the file is no longer on this device')
      let bytes = new Uint8Array(await source.arrayBuffer())

      if (supportsId3(song.fileName)) {
        let picture = null
        if (song.coverUrl) {
          try {
            const coverResponse = await fetch(song.coverUrl)
            if (coverResponse.ok) {
              const blob = await coverResponse.blob()
              picture = {
                data: new Uint8Array(await blob.arrayBuffer()),
                mimeType: blob.type || 'image/jpeg',
              }
            }
          } catch {
            // A missing cover shouldn't block the download.
          }
        }
        bytes = writeId3Tag(bytes, {
          title: song.title,
          artist: song.artist,
          album: song.album,
          picture,
        })
      }

      const blob = new Blob([bytes], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = song.fileName || `${song.title || 'track'}.mp3`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showUploadNotice('error', `Couldn't download "${song.title || song.fileName}": ${err.message}`)
    }
  }, [showUploadNotice])

  const handleBatchAddToQueue = useCallback((songIds) => {
    setSongQueue((prev) => [...prev, ...songIds.filter((id) => !prev.includes(id))])
  }, [])

  const handleBatchAddToPlaylist = useCallback((songIds, playlistId) => {
    setPlaylists((prev) => prev.map((pl) => (
      pl.id === playlistId
        ? { ...pl, songIds: [...pl.songIds, ...songIds.filter((id) => !pl.songIds.includes(id))] }
        : pl
    )))
  }, [])

  // Deleting many at once goes through the same per-song path so storage, the
  // tracks row and every playlist reference are cleaned up identically.
  const handleBatchDelete = useCallback((songIds) => {
    for (const id of songIds) handleDeleteSongRef.current?.(id)
  }, [])

  // A smart playlist stores rules, not a track list, so its contents are
  // recomputed from the library. Everything downstream reads playlists through
  // this, which means the rest of the app never has to know the difference.
  const resolvedPlaylists = useMemo(() => playlists.map((pl) => (
    pl.smart
      ? { ...pl, songIds: selectSmartPlaylistSongs(songs, pl.smart, { lovedSongIds, playCounts }).map((s) => s.id) }
      : pl
  )), [playlists, songs, lovedSongIds, playCounts])

  // Manual "add to playlist" menus must not offer rule-driven lists — you
  // change what's in one by editing its rules.
  const manualPlaylists = useMemo(() => resolvedPlaylists.filter((pl) => !pl.smart), [resolvedPlaylists])

  const createSmartPlaylist = useCallback(() => {
    const id = createSafeId('playlist')
    setPlaylists((prev) => [
      ...prev,
      {
        id,
        name: `Smart playlist ${prev.filter((p) => p.smart).length + 1}`,
        description: '',
        coverUrl: null,
        songIds: [],
        smart: createEmptyDefinition(),
      },
    ])
    setSelectedPlaylistId(id)
    setActivePage('playlist-detail')
  }, [])

  const updateSmartDefinition = useCallback((playlistId, smart) => {
    setPlaylists((prev) => prev.map((pl) => (pl.id === playlistId ? { ...pl, smart } : pl)))
  }, [])

  // Removing a playlist only removes the grouping — the songs are the library's,
  // not the playlist's.
  const deletePlaylist = useCallback((playlistId) => {
    if (!playlistId) return
    const name = playlists.find((pl) => pl.id === playlistId)?.name
    setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId))
    setRecentItems((prev) => prev.filter((item) => !(item.type === 'playlist' && item.id === playlistId)))
    setSelectedPlaylistId((prev) => (prev === playlistId ? null : prev))
    setActivePage('playlists')
    showUploadNotice('success', name ? `"${name}" deleted.` : 'Playlist deleted.')
  }, [playlists, showUploadNotice])

  // Ownership means being able to walk away with your organisation, so the
  // export is a plain readable JSON file rather than an opaque blob.
  const handleExportLibrary = useCallback(() => {
    const payload = buildLibraryExport({
      songs, playlists, lovedSongIds, playCounts, songMeta, recentItems,
      settings: buildSyncedState(),
    })
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `listenwell-library-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showUploadNotice('success', 'Library exported.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, playlists, lovedSongIds, playCounts, songMeta, recentItems, showUploadNotice])

  const handleImportLibrary = useCallback(async (e) => {
    const file = e.target?.files?.[0]
    if (e?.target) e.target.value = ''
    if (!file) return

    const parsed = parseLibraryExport(await file.text())
    if (!parsed.ok) { showUploadNotice('error', parsed.error); return }

    const merged = mergeLibraryImport(
      { songs, playlists, lovedSongIds, playCounts, songMeta },
      parsed.data,
      { makeId: () => createSafeId('playlist') },
    )

    setPlaylists(merged.playlists)
    setLovedSongIds(merged.lovedSongIds)
    setPlayCounts(merged.playCounts)
    setSongMeta(merged.songMeta)

    const { stats } = merged
    const unmatched = stats.tracksUnmatched > 0
      ? ` ${stats.tracksUnmatched} track${stats.tracksUnmatched > 1 ? 's' : ''} in the file aren't in this library — upload them and import again to reattach.`
      : ''
    showUploadNotice('success', `Imported: ${stats.playlistsAdded} playlist${stats.playlistsAdded === 1 ? '' : 's'} added, ${stats.playlistsMerged} merged.${unmatched}`)
  }, [songs, playlists, lovedSongIds, playCounts, songMeta, showUploadNotice])

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
        if (d.songViewMode === 'grid' || d.songViewMode === 'bars') setSongViewMode(d.songViewMode)
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
  }, [user, playlists, lovedSongIds, playCounts, recentItems, theme, repeat, volumeNormalization, crossfadeDuration, artColorExtract, eqRingColor, customEqGains, savedPresets, auroraIntensity, glowSoftness, blurAmount, profilePicUrl, displayName, songTileSize, songViewMode, volume, playbackRate, eqPreset, songMeta, songsBgUrl, songsBgBlur])

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
        if (typeof m.gainDb === 'number' && typeof s.gainDb !== 'number') { merged.gainDb = m.gainDb; changed = true }
        if (m.bpm != null && s.bpm == null) { merged.bpm = m.bpm; changed = true }
        return merged
      })
      return changed ? next : prev
    })
  }, [songMeta])

  // Apply per-song gain normalisation whenever the track changes.
  //
  // `song.gainDb` was read as a truthy check, so a legitimately-measured 0 dB
  // was treated as "missing". More importantly the applied gain was clamped to
  // [0.25, 4] — a 12 dB cut at the floor, which is drastic. Analysis lands
  // asynchronously after an upload, so the first play ran ungained at full
  // volume and every play after it was attenuated: the "quieter after the
  // first time" symptom.
  // Attenuation is now capped at roughly -6 dB so a late-arriving gainDb can
  // never gut the level.
  useEffect(() => {
    if (!gainNodeRef.current) return
    const song = songs[currentTrackIndex]
    const db = volumeNormalization && typeof song?.gainDb === 'number' ? song.gainDb : 0
    gainNodeRef.current.gain.value = Math.min(2, Math.max(0.5, Math.pow(10, db / 20)))
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

  // Dominant colour of the current cover for the mobile mini player background.
  // Always on (independent of the artColorExtract accent toggle); darkened so
  // white text stays readable.
  useEffect(() => {
    const coverUrl = songs[currentTrackIndex]?.coverUrl
    if (!coverUrl) { setMiniBarColor('24 21 31'); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
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
        if (count === 0) { setMiniBarColor('24 21 31'); return }
        r /= count; g /= count; b /= count
        // Normalise brightness into a dark band (max channel ~120)
        const max = Math.max(r, g, b, 1)
        const k = Math.min(120 / max, 1.6)
        setMiniBarColor(`${Math.round(r * k)} ${Math.round(g * k)} ${Math.round(b * k)}`)
      } catch { setMiniBarColor('24 21 31') }
    }
    img.onerror = () => setMiniBarColor('24 21 31')
    img.src = coverUrl
  }, [currentTrackIndex, songs])

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
      const typing = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)

      // Ctrl/Cmd+K is the one chord we claim, and it works while typing so the
      // palette is reachable from anywhere.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCommandPalette((prev) => !prev)
        return
      }

      if (typing) return

      const { isPlaying: playing, currentTrackIndex: trackIdx, songs: ss } = stateRef.current
      // Leave browser and OS chords alone — Ctrl+R must still reload the page.
      const chord = e.ctrlKey || e.metaKey || e.altKey

      if (e.key === 'Escape') {
        setShowKeyboardShortcuts(false)
        setShowNowPlaying(false)
        return
      }

      if (chord) return

      if (e.key === ' ') {
        if (trackIdx == null) return
        e.preventDefault()
        const audio = audioRef.current
        if (playing) { audio?.pause(); setIsPlaying(false) }
        else { audio?.play().catch(() => {}); setIsPlaying(true) }
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        setShowKeyboardShortcuts((prev) => !prev)
        return
      }

      if (e.key === '/') {
        e.preventDefault()
        setActivePage('songs')
        // Bumping the counter is what SongsScreen watches to expand and focus
        // its search field.
        setSearchFocusSignal((n) => n + 1)
        return
      }

      // Shift widens the arrows from "change track" to "scrub within track".
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (trackIdx == null) return
        e.preventDefault()
        const forward = e.key === 'ArrowRight'
        if (e.shiftKey) {
          const audio = audioRef.current
          if (!audio || !Number.isFinite(audio.duration)) return
          audio.currentTime = Math.min(
            Math.max(audio.currentTime + (forward ? SEEK_STEP_SECONDS : -SEEK_STEP_SECONDS), 0),
            audio.duration,
          )
          setCurrentTime(audio.currentTime)
        } else {
          // Via refs: these handlers close over `songs`, and this listener is
          // installed once, so calling them directly would run against the
          // empty library from the first render.
          if (forward) handleNextRef.current?.()
          else handlePrevRef.current?.()
        }
        return
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const delta = e.key === 'ArrowUp' ? VOLUME_STEP : -VOLUME_STEP
        setVolume((prev) => Math.min(Math.max(prev + delta, 0), 1))
        return
      }

      switch (e.key.toLowerCase()) {
        case 'm': {
          e.preventDefault()
          // Remember the level so unmuting returns to it rather than to 100%.
          setVolume((prev) => {
            if (prev > 0) { premuteVolumeRef.current = prev; return 0 }
            return premuteVolumeRef.current || 1
          })
          break
        }
        case 's':
          e.preventDefault()
          setShuffle((prev) => !prev)
          break
        case 'r':
          e.preventDefault()
          setRepeat((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'))
          break
        case 'f': {
          if (trackIdx == null) return
          const song = ss?.[trackIdx]
          if (!song) return
          e.preventDefault()
          setLovedSongIds((prev) => (
            prev.includes(song.id) ? prev.filter((id) => id !== song.id) : [song.id, ...prev]
          ))
          break
        }
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handlePlayPause = () => {
    const audio = audioRef.current
    if (!audio || currentTrackIndex == null) return
    if (isPlaying) audio.pause()
    else { ensureAudioGraph(); audio.play().catch(() => {}) }
    setIsPlaying(!isPlaying)
  }

  const handlePrev = () => {
    if (songs.length === 0) return
    const audio = audioRef.current
    // Past ~2s into the track: restart it instead of jumping to the previous one
    if (audio && currentTrackIndex !== null && audio.currentTime > 2) {
      hasCountedRef.current = false
      crossfadeArmedRef.current = false
      audio.currentTime = 0
      return
    }
    const next = currentTrackIndex === null ? 0 : (currentTrackIndex - 1 + songs.length) % songs.length
    if (next === currentTrackIndex) { restartCurrent(); return }
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
        if (idx === cur) { restartCurrent(); return }
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
    if (next === cur) { restartCurrent(); return }
    crossfade(() => {
      setCurrentTrackIndex(next)
      setSelectedSongIndex(next)
      setIsPlaying(true)
      markRecent('song', ss[next]?.id)
      markSongHistory(ss[next])
    })
  }

  // Keep stable handles so the playback ticker and the OS media controls can
  // drive transport without capturing a stale closure.
  handleNextRef.current = handleNext
  handlePrevRef.current = handlePrev
  handleDeleteSongRef.current = handleDeleteSong
  offlineSongIdsRef.current = offlineSongIds
  processAudioFilesRef.current = processAudioFiles

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const t = Number(e.target.value)
    audio.currentTime = t
    setCurrentTime(t)
  }

  // WaveformSeek reports a time directly rather than an input event.
  const seekToTime = useCallback((seconds) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(seconds)) return
    audio.currentTime = seconds
    setCurrentTime(seconds)
  }, [])

  const handleVolumeChange = (e) => setVolume(Number(e.target.value))

  const handleMetadataChange = (field, value) => {
    setSongs((prev) =>
      prev.map((song, index) => (index === selectedSongIndex ? { ...song, [field]: value } : song)),
    )
  }

  // Picking an image opens the cropper rather than committing straight away —
  // covers are square, and letting the browser letterbox an arbitrary photo
  // into that shape gives a worse result than choosing the crop yourself.
  const handleCoverUpload = (e) => {
    const file = e.target.files?.[0]
    if (e?.target) e.target.value = ''
    if (!file) return
    const song = selectedSongIndex !== null ? songs[selectedSongIndex] : null
    if (!song) return
    setCoverCrop({ file, songId: song.id })
  }

  const applyCoverCrop = useCallback(async (dataUrl) => {
    const pending = coverCropRef.current
    setCoverCrop(null)
    if (!pending || !dataUrl) return

    setSongs((prev) => prev.map((s) => (s.id === pending.songId ? { ...s, coverUrl: dataUrl } : s)))

    // A device-only song's artwork belongs in the cache next to its audio.
    // Uploading it would put part of the track on the server after all.
    if (isLocalSong(pending.songId)) {
      try {
        await saveCoverOffline(pending.songId, await (await fetch(dataUrl)).blob())
      } catch (err) {
        showUploadNotice('error', `Cover saved for this session only: ${err.message}`)
      }
      return
    }

    if (!user) return
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const { error } = await supabase.storage
        .from('audio-files')
        .upload(`${user.id}/${pending.songId}/cover`, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
    } catch (err) {
      showUploadNotice('error', `Cover saved for this session only: ${err.message}`)
    }
  }, [user, showUploadNotice])

  // Persist edited title/artist/album back to the tracks table
  const saveSongMetadata = useCallback(async (song) => {
    if (!song?.id || !user) return
    // A device-only song has no tracks row to update — the edit belongs in the
    // local record, which is what the loader reads it back from.
    if (isLocalSong(song.id)) {
      updateLocalSong(song.id, {
        title: song.title || '',
        artist: song.artist || '',
        album: song.album || '',
      })
      return
    }
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

  // Mobile bottom nav leads with Home instead of Library
  const MOBILE_NAV_TABS = [
    { id: 'home', label: 'Home', icon: Home },
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
      data-tone={themeTone(theme)}
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
          className={`fixed top-[calc(env(safe-area-inset-top)+6rem)] left-1/2 -translate-x-1/2 z-50 max-w-md px-4 py-2.5 rounded-lg border bg-[#0c0c0e]/95 backdrop-blur text-xs leading-relaxed shadow-lg ${
            uploadNotice.type === 'error'
              ? 'border-red-500/40 text-red-300'
              : 'border-white/15 text-gray-200'
          }`}
        >
          {uploadNotice.message}
        </div>
      )}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          songs={songs.map((song, index) => ({
            ...song,
            run: () => handlePlaySongClick(index),
          }))}
          playlists={resolvedPlaylists.map((playlist) => ({
            ...playlist,
            run: () => {
              setSelectedPlaylistId(playlist.id)
              setActivePage('playlist-detail')
              markRecent('playlist', playlist.id)
            },
          }))}
          actions={[
            { id: 'play-pause', label: isPlaying ? 'Pause' : 'Play', hint: 'Playback', run: handlePlayPause },
            { id: 'next', label: 'Next track', hint: 'Playback', run: () => handleNextRef.current?.() },
            { id: 'prev', label: 'Previous track', hint: 'Playback', run: () => handlePrevRef.current?.() },
            { id: 'shuffle', label: 'Toggle shuffle', hint: 'Playback', run: () => setShuffle((v) => !v) },
            { id: 'repeat', label: 'Cycle repeat mode', hint: 'Playback', run: handleToggleRepeat },
            { id: 'songs', label: 'Go to Songs', hint: 'Navigate', run: () => setActivePage('songs') },
            { id: 'playlists', label: 'Go to Playlists', hint: 'Navigate', run: () => setActivePage('playlists') },
            { id: 'upload', label: 'Go to Upload', hint: 'Navigate', run: () => setActivePage('upload') },
            { id: 'log', label: 'Open listening log', hint: 'Navigate', run: () => setActivePage('log') },
            { id: 'smart', label: 'New smart playlist', hint: 'Create', run: createSmartPlaylist },
            { id: 'shortcuts', label: 'Keyboard shortcuts', hint: 'Help', run: () => setShowKeyboardShortcuts(true) },
            { id: 'export', label: 'Export library', hint: 'Library', run: handleExportLibrary },
          ]}
        />
      )}
      {coverCrop && (
        <CoverCropModal
          file={coverCrop.file}
          onCancel={() => setCoverCrop(null)}
          onApply={applyCoverCrop}
        />
      )}
      {batchEdit && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="batch-edit-title">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBatchEdit(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f1117]/95 shadow-2xl glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h3 id="batch-edit-title" className="text-sm font-semibold text-white">
                Edit {batchEdit.songIds.length} track{batchEdit.songIds.length === 1 ? '' : 's'}
              </h3>
              <p className="text-xs text-gray-500 mt-1">Anything left blank stays as it is.</p>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">Artist</span>
                <input
                  type="text"
                  value={batchEdit.artist}
                  onChange={(e) => setBatchEdit((prev) => ({ ...prev, artist: e.target.value }))}
                  placeholder="Leave blank to keep"
                  className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">Album</span>
                <input
                  type="text"
                  value={batchEdit.album}
                  onChange={(e) => setBatchEdit((prev) => ({ ...prev, album: e.target.value }))}
                  placeholder="Leave blank to keep"
                  className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setBatchEdit(null)}
                className="px-3.5 py-2 rounded-[10px] text-xs text-gray-300 border border-white/15 hover:border-white/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyBatchEdit}
                className="px-3.5 py-2 rounded-[10px] text-xs font-medium bg-white text-black hover:bg-gray-100 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Where the audio should live. Asked before a byte is read, because the
          answer decides whether the file leaves the machine at all. */}
      {destinationPrompt && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="destination-prompt-title">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDestinationPrompt(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1117]/95 shadow-2xl glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h3 id="destination-prompt-title" className="text-sm font-semibold text-white">
                Where should {destinationPrompt.files.length === 1 ? 'this file' : `these ${destinationPrompt.files.length} files`} live?
              </h3>
              <p className="text-xs text-gray-500 mt-1">Your call, every time. You can delete either kind later.</p>
            </div>

            <div className="px-5 py-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => resolveDestinationPrompt('server')}
                className="w-full text-left rounded-xl border border-white/12 hover:border-violet-400/60 hover:bg-violet-500/[0.07] px-4 py-3.5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Cloud className="w-4 h-4 shrink-0 text-violet-400" />
                  <span className="text-sm font-medium text-white">Host on Listenwell</span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 ml-7">
                  Uploaded to your account. Plays on every device you sign in to, and survives clearing your browser.
                </p>
              </button>

              <button
                type="button"
                onClick={() => resolveDestinationPrompt('local')}
                className="w-full text-left rounded-xl border border-white/12 hover:border-cyan-400/60 hover:bg-cyan-400/[0.07] px-4 py-3.5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <HardDrive className="w-4 h-4 shrink-0 text-cyan-300" />
                  <span className="text-sm font-medium text-white">Keep on this device</span>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 ml-7">
                  Nothing is uploaded — not the audio, not the title. Plays offline, but only here, and clearing site data
                  removes it.
                </p>
              </button>
            </div>

            <div className="flex items-center justify-end px-5 py-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setDestinationPrompt(null)}
                className="px-3.5 py-2 rounded-[10px] text-xs text-gray-300 border border-white/15 hover:border-white/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {duplicatePrompt && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="duplicate-prompt-title">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => resolveDuplicatePrompt('cancel')} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1117]/95 shadow-2xl glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h3 id="duplicate-prompt-title" className="text-sm font-semibold text-white">
                {duplicatePrompt.duplicates.length} of these look like duplicates
              </h3>
              <p className="text-xs text-gray-500 mt-1">Already in your library. Your call.</p>
            </div>
            <ul className="max-h-56 overflow-y-auto px-5 py-3 space-y-2">
              {duplicatePrompt.duplicates.map(({ candidate, reason }, i) => (
                <li key={`${candidate.file.name}-${i}`} className="text-xs">
                  <p className="text-gray-200 truncate">{candidate.title}</p>
                  <p className="text-gray-500">{describeDuplicate(reason)}</p>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => resolveDuplicatePrompt('cancel')}
                className="px-3.5 py-2 rounded-[10px] text-xs text-gray-300 border border-white/15 hover:border-white/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resolveDuplicatePrompt('all')}
                className="px-3.5 py-2 rounded-[10px] text-xs text-gray-300 border border-white/15 hover:border-white/40 transition-colors"
              >
                Upload anyway
              </button>
              <button
                type="button"
                onClick={() => resolveDuplicatePrompt('skip')}
                className="px-3.5 py-2 rounded-[10px] text-xs font-medium bg-white text-black hover:bg-gray-100 transition-colors"
              >
                Skip duplicates
              </button>
            </div>
          </div>
        </div>
      )}
      {isDraggingFiles && (
        <div className="fixed inset-0 z-[190] pointer-events-none flex items-center justify-center bg-[#0c0c0e]/70 backdrop-blur-sm">
          <div className="px-8 py-6 rounded-2xl border-2 border-dashed border-violet-500/60 bg-[#0c0c0e]/90">
            <p className="text-sm text-gray-200 font-medium">Drop to add to your library</p>
          </div>
        </div>
      )}

      {/* Upload queue. Stays on screen after the batch finishes if anything
          failed, so a single bad file can be retried on its own instead of
          re-picking the whole selection. */}
      {uploadQueue.length > 0 && (
        <div
          className={`fixed z-[150] ${isUploading ? 'inset-0 flex items-center justify-center bg-[#0c0c0e]/70 backdrop-blur-sm' : 'bottom-6 right-6'}`}
          role="status"
          aria-live="polite"
        >
          <div className="w-[min(92vw,26rem)] rounded-2xl border border-white/10 bg-[#0c0c0e]/95 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
              {isUploading && <div className="w-4 h-4 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin shrink-0" />}
              <p className="text-sm text-gray-200 font-medium">
                {isUploading
                  ? `Uploading ${uploadQueue.length} file${uploadQueue.length === 1 ? '' : 's'}…`
                  : `${uploadQueue.length} upload${uploadQueue.length === 1 ? '' : 's'} failed`}
              </p>
              {!isUploading && (
                <button
                  type="button"
                  onClick={() => setUploadQueue([])}
                  aria-label="Dismiss"
                  className="ml-auto w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/40 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <ul className="max-h-56 overflow-y-auto px-3 py-2 space-y-1">
              {uploadQueue.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-gray-200 truncate">{entry.name}</span>
                    {entry.error && <span className="block text-[10px] text-red-300 truncate">{entry.error}</span>}
                  </span>
                  {entry.status === 'uploading' && <span className="text-[10px] text-gray-500 shrink-0">Uploading…</span>}
                  {entry.status === 'done' && <span className="text-[10px] text-green-400 shrink-0">Saved</span>}
                  {entry.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => {
                        const file = uploadFilesRef.current.get(entry.id)
                        setUploadQueue((prev) => prev.filter((e) => e.id !== entry.id))
                        if (file) processAudioFiles([file], { skipDuplicateCheck: true, destination: entry.destination })
                      }}
                      className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] text-gray-200 border border-white/15 hover:border-white/40 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <audio
        ref={audioRef}
        // Signed URLs come from the Supabase storage origin. Without this,
        // routing the element through createMediaElementSource() silences the
        // stream (cross-origin media is muted in Web Audio), which is what made
        // playback "break" the first time the EQ graph was activated.
        crossOrigin="anonymous"
        onLoadedMetadata={() => {
          const a = audioRef.current
          if (!a) return
          // Loaded cleanly, so let a future expiry on this same track recover too.
          audioRecoveryRef.current = { id: null, tries: 0 }
          setDuration(a.duration ?? 0)
          // Remember the length. Nothing else knows how long a track is until
          // it has been loaded once, and the listening log needs it to total
          // up time played.
          const loaded = stateRef.current.songs?.[stateRef.current.currentTrackIndex]
          if (loaded && Number.isFinite(a.duration) && loaded.duration !== a.duration) {
            setSongs((prev) => prev.map((s) => (s.id === loaded.id ? { ...s, duration: a.duration } : s)))
            persistSongMeta(loaded.id, { duration: a.duration })
          }
          a.preservesPitch = true
          a.playbackRate = effectivePlaybackRate
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => { void handleAudioError() }}
        onEnded={() => {
          const { repeat: rep, songs: ss } = stateRef.current
          if (rep === 'one') {
            // Looping the same track is a fresh play: re-arm the count guard
            // and reset the fade gain, which an earlier crossfade may have left
            // part-way through a ramp.
            restartCurrent()
          } else if (ss.length > 1 || rep === 'all') {
            handleNext()
          } else {
            setIsPlaying(false)
          }
        }}
      />
      {/* Secondary element: plays the outgoing track's tail during a crossfade.
          preload="auto" lets it start from cache immediately rather than
          negotiating a fresh stream at the exact moment the next track is
          also buffering. */}
      <audio ref={crossfadeAudioRef} crossOrigin="anonymous" preload="auto" />

      {/* Header */}
      {/* pt/h include the top safe area so the phone's status bar (time + battery)
          doesn't cover the header when installed as a PWA */}
      <header className="app-chrome relative z-20 shrink-0 h-[calc(4rem+env(safe-area-inset-top))] sm:h-[calc(5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] border-b border-white/10 flex items-center justify-end px-4 sm:px-8">
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
              <span className="text-[11px] sm:text-xs text-gray-600 truncate">Nothing playing</span>
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
          className={`magnetic-hover shrink-0 mr-2 sm:mr-3 hidden sm:flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full border transition ${
            activePage === 'home'
              ? 'bg-violet-500/15 border-violet-500/60 text-violet-100'
              : 'border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/40 text-gray-300'
          }`}
        >
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline text-xs sm:text-sm font-medium">Home</span>
        </button>

        {/* Logo — right side of header */}
        <div ref={logoMenuRef} className="shrink-0 relative mr-0 sm:mr-3">
          {/* The bordered pill is a desktop treatment. At 64px of mobile header
              it wrapped a 32px mark in chrome that left almost no breathing
              room above or below, so the logo read as a cramped button rather
              than a brand mark. On mobile the frame drops away and the logo
              itself is the target, with the chevron shrunk to a hint. */}
          <button
            type="button"
            onClick={() => setShowLogoMenu((prev) => !prev)}
            className="flex items-center gap-1 sm:gap-3 px-1.5 sm:px-5 py-1.5 sm:py-2.5 rounded-full border border-transparent sm:border-white/15 sm:hover:border-white/40 bg-transparent sm:bg-white/[0.04] sm:hover:bg-white/[0.08] active:bg-white/[0.06] transition"
            aria-label="Menu"
            aria-expanded={showLogoMenu}
          >
            <img src="./logo.svg" alt="listenWell" className="w-9 h-9 sm:w-11 sm:h-11" />
            <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 sm:text-gray-400 transition-transform ${showLogoMenu ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showLogoMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                /* Capped and scrollable so a long menu can't run past the
                   bottom of a phone screen the way the song context menu did */
                className="menu-panel absolute right-0 top-[calc(100%+0.5rem)] min-w-[290px] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto overscroll-contain rounded-2xl border border-white/15 backdrop-blur-2xl p-2 flex flex-col gap-0.5 z-30"
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
                playlists={resolvedPlaylists}
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

          {activePage === 'log' && (
            <motion.div
              key="log"
              className="absolute inset-0 flex px-4 sm:px-8 py-4 sm:py-6"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <ListeningLogScreen
                songs={songs}
                playCounts={playCounts}
                onBack={() => setActivePage('library')}
                onPlaySong={(songId) => {
                  const index = songs.findIndex((s) => s.id === songId)
                  if (index !== -1) handlePlaySongClick(index)
                }}
              />
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
              <div className="mb-4 relative">
                <h2 className="section-title text-base sm:text-lg text-white text-center">Recently played</h2>
                <p className="text-xs text-gray-500 text-center">Songs and playlists you&apos;ve listened to most recently.</p>
                <button
                  type="button"
                  onClick={() => setActivePage('log')}
                  className="mt-2 sm:mt-0 sm:absolute sm:right-0 sm:top-0 mx-auto sm:mx-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] text-gray-300 border border-white/15 hover:border-white/40 transition-colors"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Listening log
                </button>
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
                        const pl = resolvedPlaylists.find((p) => p.id === item.id)
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
                viewMode={songViewMode}
                onChangeViewMode={setSongViewMode}
                onChangeSongFilter={setSongFilter}
                onChangeSortBy={setSongSortBy}
                onToggleLoved={toggleLovedSong}
                onSelectSong={handleSelectSong}
                onEditSong={handleEditSongFromContext}
                onPlaySongClick={handlePlaySongClick}
                onGoToUpload={() => setActivePage('upload')}
                onUploadMore={handleUpload}
                onCoverUpload={handleCoverUpload}
                onMetadataChange={handleMetadataChange}
                onDeleteSong={handleDeleteSong}
                onAddToQueue={handleAddToQueue}
                onPlayNext={handlePlayNext}
                onBatchAddToQueue={handleBatchAddToQueue}
                onBatchAddToPlaylist={handleBatchAddToPlaylist}
                onBatchDelete={handleBatchDelete}
                onDownloadSong={handleDownloadSong}
                onToggleOffline={handleToggleOffline}
                offlineSongIds={offlineSongIds}
                offlineBusyIds={offlineBusyIds}
                onBatchEdit={(songIds) => setBatchEdit({ songIds, artist: '', album: '' })}
                searchFocusSignal={searchFocusSignal}
                onAddSongToPlaylist={(songId, playlistId) => {
                  setPlaylists((prev) =>
                    prev.map((pl) =>
                      pl.id === playlistId && !pl.songIds.includes(songId)
                        ? { ...pl, songIds: [...pl.songIds, songId] }
                        : pl,
                    ),
                  )
                }}
                playlists={manualPlaylists}
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
                playlists={resolvedPlaylists}
                onCreateSmartPlaylist={createSmartPlaylist}
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
                playlist={resolvedPlaylists.find((pl) => pl.id === selectedPlaylistId) || null}
                onChangeSmartDefinition={(smart) => updateSmartDefinition(selectedPlaylistId, smart)}
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
                onDeletePlaylist={deletePlaylist}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Mobile bottom cluster: mini player above the nav (the full player bar is desktop-only) */}
      <div className="sm:hidden shrink-0 relative z-10">
        {nowPlaying && (
          <div className="px-2 pb-1.5">
            <motion.div
              role="button"
              tabIndex={0}
              aria-label="Open now playing"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              dragMomentum={false}
              onDragStart={() => { miniBarDragRef.current = true }}
              onDragEnd={(event, info) => {
                if (info.offset.x < -56 || info.velocity.x < -500) handleNext()
                else if (info.offset.x > 56 || info.velocity.x > 500) handlePrev()
                window.setTimeout(() => { miniBarDragRef.current = false }, 80)
              }}
              onClick={() => { if (!miniBarDragRef.current) setShowNowPlaying(true) }}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowNowPlaying(true)}
              /* rounded-xl, a hairline ring and a drop shadow to match the card
                 language used elsewhere — against an arbitrary artwork-derived
                 colour the bar previously blended into whatever sat behind it */
              className="fixed-dark-surface relative flex items-center gap-2.5 rounded-xl pl-1.5 pr-1 py-1.5 overflow-hidden cursor-pointer select-none shadow-lg shadow-black/30 ring-1 ring-white/10"
              style={{ backgroundColor: `rgb(${miniBarColor})` }}
            >
              <div className="w-10 h-10 rounded-md overflow-hidden bg-black/25 flex items-center justify-center shrink-0">
                {nowPlaying.coverUrl
                  ? <img src={nowPlaying.coverUrl} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
                  : <Music2 className="w-4 h-4 text-white/60" />}
              </div>
              <div className="min-w-0 flex-1 pb-0.5">
                <p className="text-[13px] font-semibold text-white truncate">{nowPlaying.title || nowPlaying.fileName}</p>
                <p className="text-[11px] text-white/60 truncate">{nowPlaying.artist || 'Unknown artist'}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowUpNext((prev) => !prev) }}
                aria-label="Queue"
                className={`shrink-0 w-10 h-10 flex items-center justify-center transition-colors ${showUpNext ? 'text-white' : 'text-white/70'}`}
              >
                <ListMusic className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handlePlayPause() }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="shrink-0 w-11 h-11 flex items-center justify-center text-white"
              >
                {isPlaying
                  ? <Pause className="w-6 h-6" fill="currentColor" strokeWidth={0} />
                  : <Play className="w-6 h-6 ml-0.5" fill="currentColor" strokeWidth={0} />}
              </button>
              {/* progress hairline */}
              <div className="absolute left-2 right-2 bottom-[3px] h-[2px] rounded-full bg-white/20 pointer-events-none">
                <div
                  className="h-full rounded-full bg-white/90"
                  style={{ width: `${duration ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
                />
              </div>
            </motion.div>
          </div>
        )}
        <nav className="app-chrome flex border-t border-white/10 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
          {MOBILE_NAV_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activePage === tab.id || (tab.id === 'playlists' && activePage === 'playlist-detail')
            return (
              /* Colour alone was carrying the active state, which is weak on a
                 small screen and invisible to anyone who doesn't distinguish
                 the violet from the grey. A top rule marks the active tab, and
                 active:scale gives the tap somewhere to land. */
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePage(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex-1 flex flex-col items-center gap-1 pt-3 pb-2.5 text-[11px] font-medium transition-colors active:scale-[0.94] ${
                  isActive ? 'text-violet-300' : 'text-gray-400'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0 h-[2px] w-9 rounded-full transition-opacity ${
                    isActive ? 'bg-violet-400 opacity-100' : 'opacity-0'
                  }`}
                />
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

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
      <footer className="app-chrome relative z-10 h-36 border-t border-white/10 backdrop-blur-xl hidden sm:flex items-center px-8 gap-8 w-full shrink-0 overflow-visible">
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
              {nowPlaying ? nowPlaying.title || nowPlaying.fileName : 'Not playing'}
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
            {nowPlaying?.artist || (nowPlaying ? 'Unknown artist' : 'Pick a song')}
          </p>
          {showNowPlayingAddMenu && nowPlaying && (
            <>
            <div className="fixed inset-0 z-[29]" onClick={() => setShowNowPlayingAddMenu(false)} />
            <div className="menu-panel absolute z-[30] left-0 bottom-[calc(100%+1rem)] w-64 max-h-[min(50vh,320px)] overflow-y-auto rounded-2xl border border-white/15 backdrop-blur-2xl p-1.5 flex flex-col gap-0.5">
              <div className="px-3 pt-1.5 pb-1">
                <p className="text-[11px] font-medium text-gray-500">Add to</p>
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
              className="magnetic-hover hidden sm:block p-1.5 sm:p-2 text-gray-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipBack className="w-6 h-6 sm:w-6 sm:h-6" />
            </button>
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={songs.length === 0}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="magnetic-hover ring-pulse w-14 h-14 rounded-full bg-[#18151f] text-white flex items-center justify-center hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isPlaying ? <Pause className="w-6 h-6" strokeWidth={1.75} /> : <Play className="w-6 h-6 ml-0.5" strokeWidth={1.75} />}
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
          <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-500 absolute left-0 right-0 -top-[5px] sm:static sm:w-full">
            <span className="hidden sm:block w-10 shrink-0 tabular-nums text-right">{formatTime(currentTime)}</span>
            <WaveformSeek
              peaks={nowPlaying?.peaks}
              currentTime={currentTime}
              duration={duration}
              onSeek={seekToTime}
              disabled={!nowPlaying}
              height={28}
              className="flex-1"
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
          className="magnetic-hover ml-1 flex items-center justify-center w-10 h-10 sm:w-16 sm:h-16 rounded-full border border-white/30 text-gray-200 hover:text-white hover:border-white/70 bg-white/5 shrink-0"
        >
          <Settings2 className="w-5 h-5 sm:w-8 sm:h-8" />
        </button>

        <button
          type="button"
          onClick={() => setShowUpNext((prev) => !prev)}
          className={`magnetic-hover ml-1 flex flex-col items-center justify-center gap-0.5 w-10 h-10 sm:w-16 sm:h-16 rounded-full border shrink-0 transition-colors ${showUpNext ? 'border-violet-400/60 text-violet-300 bg-violet-500/10' : 'border-white/30 text-gray-400 hover:text-white hover:border-white/70 bg-white/5'}`}
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
            className="menu-panel fixed left-3 right-3 sm:left-auto sm:right-6 bottom-[8.5rem] sm:bottom-[9.5rem] z-40 w-auto sm:w-80 xl:w-96 flex flex-col rounded-2xl overflow-hidden backdrop-blur-xl"
            style={{ maxHeight: '420px' }}
          >
            <div className="px-4 pt-3 pb-2 shrink-0 border-b border-white/[0.06] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400/80 shrink-0 animate-pulse" />
              <p className="text-sm font-semibold text-white">Queue</p>
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
                onReorderManualQueue={handleReorderManualQueue}
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
              className="fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] bottom-4 z-50 w-[340px] rounded-2xl border border-white/10 bg-[#0f1117]/90 backdrop-blur-xl p-4 flex flex-col gap-3 glass-card overflow-y-auto"
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
                    <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Listen leaderboard */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-300">Most played</p>
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
                <p className="text-xs font-semibold text-gray-300">Quick settings</p>
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
                <p className="text-xs font-semibold text-gray-300">Saved presets</p>
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
            playlists={manualPlaylists}
            onToggleInPlaylist={(playlistId, songId) => {
              setPlaylists((prev) =>
                prev.map((pl) =>
                  pl.id === playlistId
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
            onCreatePlaylistWithSong={createPlaylistWithSong}
            onEditSong={() => {
              if (currentTrackIndex == null) return
              setShowNowPlaying(false)
              setSelectedSongIndex(currentTrackIndex)
              setShowMetadataModal(true)
            }}
            onOpenSettings={() => {
              setShowNowPlaying(false)
              setSettingsPosition(clampSettingsPosition(
                (window.innerWidth - SETTINGS_PANEL_W) / 2,
                (window.innerHeight - SETTINGS_PANEL_H) / 2,
              ))
              setShowSettings(true)
            }}
            onClose={() => setShowNowPlaying(false)}
            onPlayPause={handlePlayPause}
            onPrev={handlePrev}
            onNext={handleNext}
            onSeek={handleSeek}
            onSeekTo={seekToTime}
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
                {['account', 'audio', 'appearance', 'library'].map((t) => (
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

                {settingsModalTab === 'library' && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-300 font-medium">Offline</span>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        {offlineSongIds.length === 0
                          ? 'Nothing kept on this device yet. Right-click a song and choose “Keep offline” to store it here.'
                          : `${offlineSongIds.length} track${offlineSongIds.length === 1 ? '' : 's'} on this device, using ${formatBytes(offlineUsage)}. Kept per device, not per account.`}
                      </p>
                      {offlineSongIds.length > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            for (const id of offlineSongIds) await removeSongOffline(id)
                            await refreshOfflineState()
                            showUploadNotice('success', 'Offline downloads cleared from this device.')
                          }}
                          className="self-start mt-1 px-3.5 py-2 rounded-[10px] text-xs text-gray-200 border border-white/15 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/40 transition-colors"
                        >
                          Clear downloads
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-300 font-medium">Export</span>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Downloads your playlists, loved songs, play counts and per-song
                        details as a readable JSON file. Audio files aren&apos;t included —
                        they stay in your account.
                      </p>
                      <button
                        type="button"
                        onClick={handleExportLibrary}
                        className="self-start mt-1 px-3.5 py-2 rounded-[10px] text-xs text-gray-200 border border-white/15 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/40 transition-colors"
                      >
                        Export library
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-300 font-medium">Import</span>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Merges an export into this library. Nothing is removed: playlists
                        with the same name are combined, and play counts add together.
                        Tracks are matched by title and artist, so upload your audio first.
                      </p>
                      <label className="self-start mt-1 px-3.5 py-2 rounded-[10px] text-xs text-gray-200 border border-white/15 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/40 transition-colors cursor-pointer">
                        Choose export file
                        <input type="file" accept="application/json,.json" className="hidden" onChange={handleImportLibrary} />
                      </label>
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