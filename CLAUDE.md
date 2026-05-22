# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite)
npm run build      # Production build
npm run lint       # ESLint check
npm run preview    # Preview production build
```

No test suite configured.

## Architecture

**ListenWell** is a fully client-side, local-first music player. No backend, no API keys, no accounts.

### State management

All state lives in `src/App.jsx` (~1900 lines). There is no Context API, Redux, or Zustand — it's a single large component using `useState`/`useRef`/`useCallback`, passing props and callbacks down to presentational children. Before adding state, look for the relevant variable/handler already in `App.jsx`.

### Key state areas in `App.jsx`
- **Library**: `songs` array with extracted ID3 metadata
- **Playback**: `currentTrackIndex`, `isPlaying`, `currentTime`, `duration`, `volume`, `playbackRate`
- **Organization**: `playlists`, `selectedPlaylistId`, `lovedSongIds`, `songFilter`, `songSortBy`
- **Audio**: Web Audio API `AudioContext`, EQ preset, gain nodes
- **UI**: `activePage` (`upload` | `songs` | `playlists` | `detail`), `showSettings`, `settingsTab`

### Data persistence
- `localStorage` for playlists, loved songs, and all settings
- Files stay in memory (FileReader / Object URLs) — no IndexedDB yet
- PWA: `public/sw.js` (cache-first), `public/manifest.json`

### Audio pipeline
- Web Audio API for playback and EQ
- `src/utils/audioAnalysis.js`: RMS gain normalization + BPM detection
- Custom ID3v2 tag reader in `App.jsx` reads the first 512 KB of each file (fallback: `jsmediatags`)

### Tech stack
- React 19 + Vite 7, JavaScript/JSX (no TypeScript)
- TailwindCSS 4, Framer Motion 12, Radix UI (dialog, slider)
- `@dnd-kit` for drag-and-drop in playlists/queue
- `lucide-react` for icons
- Path alias: `@/` → `src/` (configured in `jsconfig.json` and `vite.config.js`)

## Design system

The full design spec is in `DESIGN.md`. Key points:

- **Palette**: Void Base `#0c0c0e`, Archive Violet `#8b5cf6`, Signal Cyan `#22d3ee`
- **Typography**: Orbitron for structural/label text (all-caps), Space Grotesk for human-facing text
- **Tone**: Instrument room, not a music service. Precision over pageantry. No warm editorial styling, no recommendations, no gradients that feel "streaming app."
- **Anti-pattern**: Do not introduce Spotify/Apple Music visual patterns — no card carousels, no "For You" widgets, no rounded hero banners

## Product philosophy (`PRODUCT.md`)

Ownership > Service. Precision > Pageantry. Modular > Monolithic. The user's library is theirs; no algorithms, no data harvesting. When in doubt, lean toward explicit user control rather than automatic behavior.
