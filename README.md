# listenWell

**Your library. Your files. Your player.**

listenWell is a customizable music player for people who would rather own their
music than rent it. There is no catalog and nothing to discover — you upload your
own audio files, they are stored privately in your account, and you play them from
any device through an interface built for control rather than engagement.

React + Vite on the front end, Supabase for auth/database/storage, Web Audio API for
playback. Runs as a web app, an installable PWA, or a packaged desktop app for Windows,
macOS, and Linux.

### ⬇️ [Open the web app](https://listen-well-eight.vercel.app) · [Download the desktop app](https://github.com/soonavi/listenWell/releases/latest) · [Install instructions](#download--install) · [Updating](#updating)

---

## Table of contents

- [Download & install](#download--install)
- [Updating](#updating)
- [Core philosophy](#core-philosophy)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Supabase setup](#supabase-setup)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Desktop build (Electron)](#desktop-build-electron)
- [PWA and offline](#pwa-and-offline)
- [Design system](#design-system)
- [Limits and known constraints](#limits-and-known-constraints)
- [Contributing](#contributing)
- [Documentation map](#documentation-map)
- [License](#license)

---

## Download & install

One account, three ways to listen. Your library, playlists, loved tracks, and play counts
live in your ListenWell account, so everything follows you between them.

### Web — nothing to install

Open **[listen-well-eight.vercel.app](https://listen-well-eight.vercel.app)** and sign in
or create an account with an email and password. This is always the newest build.

### Desktop — Windows, macOS, Linux

Every download lives on the
**[latest release](https://github.com/soonavi/listenWell/releases/latest)** page, under
**Assets**. Pick the one file that matches your machine — the rest are for the built-in
updater and you can ignore them.

| Your machine | Download | Size |
| --- | --- | --- |
| Windows 10/11 (64-bit) | `ListenWell.Setup.<version>.exe` | ~108 MB |
| Mac with Apple Silicon (M1 or later) | `ListenWell-<version>-arm64.dmg` | ~128 MB |
| Linux (any distro, x86-64) | `ListenWell-<version>.AppImage` | ~141 MB |

The `latest*.yml` and `.blockmap` files are how the app finds and downloads its own
updates. You never need to download them by hand.

**Windows.** Run the installer. Windows will show a **"Windows protected your PC"**
screen — click **More info → Run anyway**. The app is unsigned, which is normal for
independent software and is not something the installer can suppress. You can choose the
install directory; then launch **ListenWell** from the Start menu.

**macOS.** Open the `.dmg` and drag ListenWell to Applications. The app is unsigned and
un-notarized, so the first launch is blocked: **right-click (or Control-click) the app →
Open → Open**. Double-clicking will only offer "Move to Bin". You only have to do this
once per installed version. If macOS insists the app "is damaged", clear the quarantine
flag and open it again:

```bash
xattr -dr com.apple.quarantine /Applications/ListenWell.app
```

> **Intel Macs are not covered.** The release builds Apple Silicon (`arm64`) only. On an
> Intel Mac, use the web app or [build from source](#getting-started).

**Linux.** An AppImage needs no installation — mark it executable and run it:

```bash
chmod +x ListenWell-<version>.AppImage
./ListenWell-<version>.AppImage
```

Some distributions need FUSE 2 for AppImages (`sudo apt install libfuse2` on Debian and
Ubuntu). Failing that, `./ListenWell-<version>.AppImage --appimage-extract-and-run` works
without it.

**All three** need an internet connection, because your library lives in your account
rather than on the machine.

### Phone / tablet — install as an app

listenWell is a PWA, so you can add it to your home screen and run it fullscreen without
an app store:

- **iOS (Safari):** open the site → Share → **Add to Home Screen**
- **Android (Chrome):** open the site → ⋮ menu → **Install app** / **Add to Home screen**

You get the app icon, a standalone window with no browser chrome, and the mobile layout:
a bottom player bar tinted from the current cover art, swipe-to-skip, and a
touch-draggable queue.

### Build it yourself

See [Getting started](#getting-started) to run the dev server, or
[Desktop build](#desktop-build-electron) to package your own installers.

---

## Updating

Nothing you have to remember, on any platform except one.

### Web and phone — automatic

The web app deploys from `main`, so loading the page gives you the newest build. The
service worker serves navigations network-first, which means an installed PWA picks up a
new version the next time you open it with a connection. There is no update button and
nothing to clear.

If a PWA ever looks stale, fully close it (swipe it away from the app switcher rather
than backgrounding it) and reopen it.

### Desktop — Windows and Linux, on a prompt

The desktop app checks for updates **once, at launch**, and never downloads anything
without asking:

1. If a newer version exists, a dialog offers **Download** or **Not now**.
2. Choose Download and it fetches in the background — only the changed chunks, not the
   whole installer, because of those `.blockmap` files.
3. When it finishes, a second dialog offers **Restart now** or **Later**. Choosing Later
   installs the update the next time you quit.

Declining costs nothing; it asks again the next time you start the app. A failed check
(no connection, GitHub unreachable) is ignored silently rather than interrupting you.

### Desktop — macOS, by hand

**macOS is the exception: the in-app updater cannot update this app.** Applying an update
on macOS requires a valid code signature, and these builds are unsigned. The check runs
and fails quietly, so you will not see an error — you will simply never be prompted.

To update a Mac, download the new `.dmg` from the
[latest release](https://github.com/soonavi/listenWell/releases/latest) and drag it over
the old app, right-clicking to open it the first time as above. Signing and notarizing
the macOS build would fix this and needs an Apple Developer account.

### What an update does not touch

Your library, playlists, loved tracks, play counts, and settings live in your ListenWell
account, not in the app. Updating, reinstalling, or moving to a different machine leaves
all of it intact — sign in and it is there.

---

## Core philosophy

- **Ownership over service** — you upload and control your own files. No catalog, no
  distribution, no rentals.
- **Precision over pageantry** — futuristic means exact, not flashy. Visual weight goes
  to what's active; everything else recedes.
- **Modular composition** — panels and screens are discrete, composable parts. The queue
  is its own thing. The song list is its own thing.
- **The file is the source of truth** — metadata, artwork, and playback all trace back to
  what you uploaded. The UI never editorializes.
- **Silence the algorithm** — no recommendations, no trending, no "For You," no engagement
  loops, no data harvesting.

Full product positioning lives in [`PRODUCT.md`](PRODUCT.md).

## Features

### Library

- Drag-and-drop or file-picker upload of MP3, M4A, AAC, FLAC, WAV, WebM, OGG, and Opus
- Automatic ID3v2 metadata extraction (title, artist, album, embedded cover art), with a
  custom in-app tag reader and `jsmediatags` as fallback
- Editable per-song details: title, artist, album, artwork, and free-form description/notes
- Search, filter, and sort across the library; adjustable song tile size
- Loved songs, play counts, listening history, "Most played," and "Recently played"
- Optional custom background image (with blur control) for the Songs screen

### Playlists

- Create, rename, and delete playlists
- Drag-and-drop reordering of tracks (`@dnd-kit`)
- Per-playlist accent color from an eight-color preset palette, which re-tints the whole UI
  while that playlist is open
- Dedicated playlist detail screen

### Playback

- Play/pause, next/previous, shuffle, repeat (off / all / one)
- Playback speed from 0.25× to 3×
- True crossfade between tracks — the outgoing tail plays on a secondary audio element so
  the songs genuinely overlap (configurable duration; skipped for repeat-one and
  single-track libraries)
- Queue panel and an "Up Next" panel, both reorderable
- Full-screen Now Playing overlay with an aurora visualizer driven by live FFT data
- Audio output device selection (where the browser exposes it)

### Audio processing

- Web Audio API graph with a low shelf, a high shelf, and six configurable bands
  (60 Hz, 170 Hz, 500 Hz, 1.5 kHz, 4.5 kHz, 12 kHz)
- Quick EQ presets (normal / bass / bright) plus a custom "Neural Equalizer" with savable
  user presets
- Volume normalization — RMS analysis targeting −14 dBFS, computed in an
  `OfflineAudioContext` over the first ~90 s of each file
- BPM detection on upload
- Both analyses run entirely in the browser; results are persisted per song

### Personalization

- 13 scene themes: Light, Dark, Sunset, Pink, Cartoon, Terminal, Paper, Blueprint, Chrome,
  Bubblegum, Ocean, Ember, Moss
- Accent color extraction from album artwork (toggleable)
- Tunable aurora intensity, glow softness, and blur amount
- Equalizer ring color (accent-following or fixed)
- Display name and profile picture

### Platform

- Installable PWA with a service worker (network-first navigations, cache-first hashed
  assets) and proper home-screen icons
- Mobile layout with a bottom player bar tinted from the current cover art, swipe to skip,
  and a touch-draggable queue
- Packaged desktop app for Windows, macOS, and Linux via Electron + electron-builder,
  with an in-app updater that prompts rather than installing behind your back
- Keyboard shortcuts with an in-app, draggable reference modal
- Error boundary around the app shell; upload failures surface as toasts and fall back to
  a session-only object URL so the track still plays

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | React 19, JavaScript/JSX (no TypeScript) |
| Build | Vite 7 (`base: './'` so builds also work from `file://` in Electron) |
| Styling | TailwindCSS 4 via `@tailwindcss/vite`, `clsx` + `tailwind-merge` |
| Animation | Framer Motion 12 |
| Primitives | Radix UI (dialog, slider), `lucide-react` icons |
| Drag & drop | `@dnd-kit/core`, `@dnd-kit/sortable` |
| Audio | Web Audio API, `jsmediatags` |
| Backend | Supabase (auth, Postgres, Storage) via `@supabase/supabase-js` |
| Desktop | Electron 43 + electron-builder |
| Lint | ESLint 9 (flat config) with React Hooks and React Refresh plugins |

Path alias: `@/` → `src/` (declared in both `jsconfig.json` and `vite.config.js`).

## Getting started

### Prerequisites

- Node.js 20+ (CI builds on Node 22)
- npm
- A Supabase project (free tier is fine)

### Install and run

```bash
git clone https://github.com/soonavi/listenWell.git
cd listenWell
npm install

cp .env.example .env    # then fill in your Supabase values
npm run dev             # http://localhost:5173
```

### Environment variables

Copy `.env.example` to `.env` and fill in both values from your Supabase project settings
(Project Settings → API):

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Both values ship to the browser in the client bundle — they are publishable, not secrets.
Actual access control is enforced by row-level security in Postgres and Storage, so never
put a service-role key here. `.env` is gitignored; only `.env.example` is tracked.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint across the repo |
| `npm run electron` | Launch the Electron shell against the current build |
| `npm run test` | Node's built-in test runner across `src/**/*.test.js` |
| `npm run dist:win` | Build web assets, then package a Windows NSIS installer into `release/` |
| `npm run dist:mac` | Same, for a macOS `.dmg` and `.zip` (builds for the host architecture) |
| `npm run dist:linux` | Same, for a Linux `.AppImage` |

Each `dist:*` target only builds for the platform it names, and electron-builder can only
build a macOS package on macOS.

## Supabase setup

The app talks to Supabase directly from the client — there is no custom server. Before the
app will work against a fresh project, run [`supabase/setup.sql`](supabase/setup.sql) in the
Supabase Dashboard → SQL Editor. Run the whole file at once; it is idempotent and safe to
re-run.

It creates:

1. **`public.tracks`** — one row per uploaded song, with RLS policies scoping every
   select/insert/update/delete to `auth.uid() = user_id`, plus explicit table grants
2. **`public.user_state`** — one JSONB row per user holding playlists, loved songs, and
   settings, with the same RLS shape
3. **`audio-files`** — a private Storage bucket whose policies require the first path
   segment to equal the caller's user id
4. **`enforce_track_upload_limit`** — a `before insert` trigger enforcing the per-account
   upload cap in the database, so it cannot be bypassed by calling the API directly
5. A `notify pgrst, 'reload schema'` at the end to refresh the PostgREST schema cache

**Symptoms that the script has not been run:**

- `Could not find the table 'public.user_state' in the schema cache`
- `permission denied for table tracks`
- 403 responses from Storage, and uploads that appear to succeed but never persist

Email/password auth must be enabled in Supabase → Authentication → Providers.

## Project structure

```
listenWell/
├─ .github/workflows/       # Desktop release workflow (Windows, macOS, Linux)
├─ build/                   # electron-builder resources (icons)
├─ electron/
│  └─ main.cjs              # Electron main process; external links open in the OS browser
├─ public/
│  ├─ manifest.json         # PWA manifest
│  ├─ sw.js                 # Service worker (network-first pages, cache-first assets)
│  └─ icon*.png|svg         # App and maskable icons
├─ src/
│  ├─ App.jsx               # Root component — state, audio graph, routing, settings
│  ├─ App.css               # Theme variables and component styles
│  ├─ main.jsx              # React entry point
│  ├─ components/
│  │  ├─ AppErrorBoundary.jsx
│  │  ├─ AuthScreen.jsx           # Sign in / sign up gate
│  │  ├─ HomeScreen.jsx           # Recents, most played, entry points
│  │  ├─ UploadScreen.jsx         # Drag-and-drop upload zone
│  │  ├─ SongsScreen.jsx          # Library grid/list, search, sort, edit
│  │  ├─ PlaylistsScreen.jsx      # Playlist index
│  │  ├─ PlaylistDetailScreen.jsx # Single playlist, reorderable
│  │  ├─ NowPlayingOverlay.jsx    # Full-screen player + aurora visualizer
│  │  ├─ QueuePanel.jsx / UpNextPanel.jsx
│  │  ├─ Equalizer.jsx            # Custom multi-band EQ UI
│  │  ├─ KeyboardShortcutsModal.jsx
│  │  ├─ LegalModal.jsx           # Terms and privacy policy
│  │  └─ ui/gooey-input.jsx
│  ├─ lib/
│  │  ├─ supabase.js        # Supabase client
│  │  └─ utils.js           # `cn()` class merge helper
│  └─ utils/
│     └─ audioAnalysis.js   # RMS normalization gain + BPM detection
├─ supabase/setup.sql       # Schema, RLS policies, storage bucket, upload-limit trigger
├─ CLAUDE.md                # Guidance for AI coding agents
├─ DESIGN.md                # Full design system spec
└─ PRODUCT.md               # Product purpose, users, principles
```

## Architecture

**Client-only.** There is no backend service of your own. The browser talks to Supabase
directly through `src/lib/supabase.js`. Everything a user can do is expressed as a
Supabase call gated by row-level security.

**State lives in `src/App.jsx`.** The root component is large (~3,700 lines) and holds
essentially all application state with `useState` / `useRef` / `useCallback`, passing props
and callbacks down to presentational children. There is no Context API, Redux, or Zustand.
*Before adding new state, look for the variable or handler that already exists in
`App.jsx`.*

Key state areas:

| Area | State |
| --- | --- |
| Auth | `user`, `authLoading` — the app is gated behind `AuthScreen` until a session exists |
| Library | `songs` (with extracted ID3 metadata), `songMeta`, `songFilter`, `songSortBy` |
| Playback | `currentTrackIndex`, `isPlaying`, `currentTime`, `duration`, `volume`, `playbackRate`, `shuffle`, `repeat`, `songQueue`, `crossfadeDuration` |
| Organization | `playlists`, `selectedPlaylistId`, `lovedSongIds`, `playCounts`, `recentItems` |
| Audio | `AudioContext`, EQ preset, custom band gains, gain/filter nodes, analyser |
| Appearance | `theme`, `accentColor`, `auroraIntensity`, `glowSoftness`, `blurAmount`, `eqRingColor`, `songTileSize` |
| UI | `activePage` (`home` \| `upload` \| `songs` \| `library` \| `playlists` \| `playlist-detail`), `showSettings`, `settingsTab` (`playback` \| `appearance`) |

**Audio pipeline.** A single `AudioContext` feeds a chain of biquad filters (low shelf →
six peaking bands → high shelf) into a gain node and an analyser that drives the aurora
visualizer. Crossfades use a second audio element for the outgoing tail, armed shortly
before the current track ends.

**Metadata.** A custom ID3v2 reader in `App.jsx` parses the first 512 KB of each file;
`jsmediatags` is the fallback when that fails.

## Data model

### Storage

Audio and cover art live in the private `audio-files` bucket:

```
<user_id>/<track_id>/<filename>   # the audio file
<user_id>/<track_id>/cover        # extracted or user-supplied artwork
```

On login the client issues 7-day signed URLs, so a library follows the account across
devices and browsers.

### `tracks`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | primary key |
| `user_id` | `uuid` | FK → `auth.users`, cascade on delete |
| `title` / `artist` / `album` | `text` | from ID3 or user edits |
| `storage_path` | `text` | path within `audio-files` |
| `created_at` | `timestamptz` | defaults to `now()` |

### `user_state`

One JSONB row per user (`user_id` primary key, `data`, `updated_at`) holding playlists,
loved songs, play counts, recents, per-song extras (description, `gainDb`, `bpm`), and
appearance/playback settings. It is loaded on login and written back debounced on change.
`localStorage` mirrors the same values as a local cache and offline fallback.

### Failure behavior

If a Supabase upload fails, the track falls back to an in-memory object URL — playable for
the current session only — and the error surfaces in a toast rather than silently
disappearing.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` | Previous track |
| `→` | Next track |
| `/` | Focus search (Songs page) |
| `?` | Show / hide the shortcuts modal |
| `Esc` | Clear search / close panels |

## Desktop build (Electron)

`electron/main.cjs` opens a 1280×800 window (minimum 900×600) with `contextIsolation: true`
and `nodeIntegration: false`. External links are handed to the OS browser rather than
opening inside the app. In development it loads `VITE_DEV_SERVER_URL` when set; otherwise
it loads `dist/index.html` from disk.

`setUpAutoUpdates()` wires `electron-updater` to GitHub Releases. It runs only in a
packaged app, checks once at launch, and sets `autoDownload = false` so a download is
always the user's choice — see [Updating](#updating) for what that looks like from the
outside.

Package locally (each target must be built on its own platform):

```bash
npm run dist:win     # → release/*.exe (NSIS, user-selectable install directory)
npm run dist:mac     # → release/*.dmg + *.zip
npm run dist:linux   # → release/*.AppImage
```

### Releasing

`.github/workflows/desktop-release.yml` builds all three platforms in parallel on every
`v*` tag push and on manual dispatch, running `npm test` before packaging. Installers are
always uploaded as workflow artifacts; tagged builds also attach them to a GitHub Release,
which is what [the download links](#desktop--windows-macos-linux) point at.

```bash
git tag v0.2.2
git push origin v0.2.2     # → builds, releases, and attaches every installer
```

Each platform also uploads the `latest*.yml` feed that `electron-updater` polls, plus
`.blockmap` files that let it download only the changed chunks. A release missing its
`latest*.yml` leaves every existing install unable to see the new version, so the workflow
treats a missing file as a build failure (`if-no-files-found: error`).

Because `.env` is no longer tracked in the repo, CI needs `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` supplied as repository secrets and exported on the
"Build web assets" step.

The web app deploys to Vercel at
[listen-well-eight.vercel.app](https://listen-well-eight.vercel.app) from `main`; the same
two environment variables must be set in the Vercel project.

## PWA and offline

`public/manifest.json` declares a standalone display mode with 192/512/maskable icons and
`#0c0c0e` as both background and theme color. `public/sw.js` (cache `listenwell-v2`)
precaches the app shell, serves navigations network-first, and serves hashed build assets
cache-first. Audio itself streams from signed Supabase URLs, so offline playback covers the
shell and cached assets rather than the full library.

## Design system

The complete spec is in [`DESIGN.md`](DESIGN.md). In brief:

- **Palette** — Void Base `#0c0c0e`, Archive Violet `#8b5cf6`, Signal Cyan `#22d3ee`
- **Typography** — Orbitron for structural/label text (all caps), Space Grotesk for
  human-facing copy
- **Tone** — an instrument room, not a music service
- **Anti-patterns** — no Spotify/Apple Music visual grammar: no card carousels, no "For You"
  widgets, no rounded hero banners, no streaming-app gradients

## Limits and known constraints

- **50 songs per account**, enforced both client-side (for a friendly error) and by a
  database trigger. Change `max_uploads` in `supabase/setup.sql` to adjust it; a small
  hardcoded email allowlist in `App.jsx` bypasses the cap.
- **Test coverage is partial.** `npm test` covers the pure utility modules; screens and
  the audio pipeline are verified manually plus `npm run lint`.
- **`App.jsx` is monolithic** (~3,700 lines). Extracting screens and hooks is the obvious
  next refactor, but it has not happened yet.
- **Audio analysis reads the first ~90 s / ~12 MB** of each file, so normalization gain and
  BPM are estimates for long tracks.
- **Signed URLs expire after 7 days**, refreshed on login.
- **Desktop builds are unsigned**, so Windows shows a SmartScreen warning and macOS
  requires right-click → Open on first launch. Code signing needs paid certificates.
- **The macOS build is Apple Silicon only** (`arm64`); there is no Intel package.
- **In-app updates do not work on macOS.** `electron-updater` will not apply an update to
  an unsigned app, so Mac users re-download the `.dmg` by hand. Windows and Linux update
  in place.
- **Browser support** requires the Web Audio API and modern ES modules — current Chrome,
  Edge, Firefox, and Safari.

## Contributing

This is primarily a solo build, but issues and pull requests are welcome.

1. Fork and branch from `main`
2. Run `npm run lint` before opening a PR
3. Keep changes surgical — match the existing style, and don't refactor adjacent code that
   isn't part of the change
4. New UI should follow `DESIGN.md`; new product behavior should follow `PRODUCT.md`

If you are using an AI coding agent, [`CLAUDE.md`](CLAUDE.md) contains the repository's
working agreement and is worth loading first.

**About the music itself:** listenWell distributes nothing. You are responsible for having
the right to upload and store the files you add to your own library.

## Documentation map

| File | Purpose |
| --- | --- |
| [`README.md`](README.md) | This file — setup, architecture, and feature overview |
| [`PRODUCT.md`](PRODUCT.md) | Who it's for, what it's for, design principles, anti-references |
| [`DESIGN.md`](DESIGN.md) | Full design system: color, type, elevation, components |
| [`CLAUDE.md`](CLAUDE.md) | Guidance for AI coding agents working in this repo |
| [`supabase/setup.sql`](supabase/setup.sql) | Backend schema, RLS, storage, upload limits |

## License

No license file is currently present, which means the work is under exclusive copyright by
default. If you intend to accept outside contributions or allow reuse, add a `LICENSE`.

---

Built by [@soonavi](https://github.com/soonavi).
