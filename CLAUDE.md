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

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.