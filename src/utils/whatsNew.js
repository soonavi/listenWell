// "What's new" — tells the caller whether the user has crossed a version
// boundary since they last looked, and which release notes cover the gap.
// Pure and framework-free so the version-comparison logic (the part most
// likely to have an off-by-one) can be unit tested without touching React.

// Device-local: this tracks what a specific browser/install has seen, not
// what the account has seen. It intentionally does NOT go through
// user_state — syncing it would mean signing in on a second device replays
// (or skips) the prompt based on the first device's history, which has
// nothing to do with whether this device has seen the notes.
export const STORAGE_KEY = 'listenwell-whats-new-seen'

// Newest first. Each entry is what shipped in that version, written for the
// person using the app rather than the person who wrote the commit — no
// internal file names, no "we", no launch-announcement tone.
export const RELEASES = [
  {
    version: '0.2.4',
    date: '2026-07-28',
    highlights: [
      'Signing out now clears your library from the device. Before this, the next account signed in on the same browser could see and play the previous one’s music.',
      'Repeat "off" now stops at the end of your library instead of quietly starting it over.',
      'Tapping a point in the listening sphere turns it to face you and leans in, rather than stopping the globe wherever it happened to be.',
      'The listening log and sphere moved out of the playback settings panel into Settings → Library.',
      'Fixed: coming back to Songs after browsing Albums could show only a couple of tracks, with scrolling unable to recover the rest.',
      'Fixed: deleting several songs at once could leave the player reading "Nothing playing" while the audio kept going.',
      'Album art colour extraction works now — it had never once succeeded, and silently fell back to violet every time.',
      'The equalizer ring around your profile picture has thicker, evenly spaced bars with more room to move.',
      'Songs are now added five at a time, and the decorative Neural Equalizer has been removed from the settings panel.',
    ],
  },
  {
    version: '0.2.3',
    date: '2026-07-28',
    highlights: [
      "Closing the app window mid-download no longer kills an update — it keeps downloading in the background and installs once it's ready.",
      'Downloading an update now shows progress in the taskbar and window title, instead of no feedback at all.',
      'A failed update download now shows an error dialog instead of failing silently.',
    ],
  },
  {
    version: '0.2.2',
    date: '2026-07-28',
    highlights: [
      'New bar view for the song list — a compact row-per-track layout, alongside the artwork grid, in Songs, Albums, and Artists.',
      'Listening sphere: your play counts plotted by track, album, or artist. Tap a point to see its plays, rank, and play its tracks from there.',
      'The listening log and sphere are now reachable straight from Settings, not just from a card on the Library page.',
      'Fixed unreadable text on light scenes (Chrome, Bubblegum) — inputs and the mini player were rendering dark text on dark backgrounds.',
      "The footer's settings and queue buttons are now slanted segments instead of circles, with a violet hover sweep.",
    ],
  },
  {
    version: '0.2.1',
    date: '2026-07-27',
    highlights: [
      'Linux now ships as a single AppImage that runs on any distro without installing — the previous Linux build failed to package at all.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-07-27',
    highlights: [
      'Fixed a crash that could blank the entire app on load.',
      'Playlists can now be deleted — smart playlists included — without touching the songs inside them.',
      'Uploads now ask where a song should live: on your account, or kept on this device only.',
      'Fixed the waveform seek bar overflowing its own box, which made clicks land ahead of where you meant to seek.',
      'Auto-update can finally find new versions — it was silently reporting "up to date" forever before this.',
    ],
  },
]

// Splits a plain major.minor.patch string into numeric segments. Returns
// null for anything that isn't one, rather than throwing, since this reads
// a value out of localStorage: a corrupted or hand-edited entry should be
// treated as "we don't know," not crash the app on startup.
function parseVersion(version) {
  if (typeof version !== 'string' || version.trim() === '') return null
  const parts = version.trim().split('.').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return null
  return parts
}

// Compares two version strings numerically (so "0.2.10" sorts after
// "0.2.9", unlike a plain string compare). A version that fails to parse
// sorts as older than any version that does — malformed data reads as "we
// don't know what this device has seen," which behaves like a very old
// version rather than blocking the comparison outright.
export function compareVersions(a, b) {
  const partsA = parseVersion(a)
  const partsB = parseVersion(b)
  if (!partsA && !partsB) return 0
  if (!partsA) return -1
  if (!partsB) return 1

  const length = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

// Releases strictly newer than seenVersion and no newer than currentVersion,
// newest first. RELEASES is already ordered newest-first, so filtering
// preserves that order without a re-sort. Capping at currentVersion means a
// release note for a version the app hasn't actually reached yet (a stale
// build, a rollback) never shows up.
export function releasesSince(seenVersion, currentVersion) {
  return RELEASES.filter((release) => (
    compareVersions(release.version, seenVersion) > 0
    && compareVersions(release.version, currentVersion) <= 0
  ))
}

// Whether the user should be asked if they want to be briefed on what
// changed. A missing seenVersion means this is the first time the app has
// ever run on this device — there is no "before" for the user to catch up
// on, so this deliberately returns false rather than dumping every release
// note on a brand-new user. Everything else (downgrade, equal version, a
// gap with no notes covering it) also resolves to false so the prompt only
// ever appears when there is something real to say.
export function shouldPrompt(seenVersion, currentVersion) {
  if (!seenVersion) return false
  if (compareVersions(currentVersion, seenVersion) <= 0) return false
  return releasesSince(seenVersion, currentVersion).length > 0
}
