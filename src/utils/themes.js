// Scene themes.
//
// A theme re-skins the app by remapping Tailwind's colour variables, so
// `text-white` on a light scene resolves to near-black and every utility
// inverts without touching markup. That trick has one sharp edge: any surface
// whose background does NOT come from the theme — a bar coloured from album
// art, say — still gets the inverted foreground, and prints dark text on a
// dark background.
//
// `LIGHT_THEMES` is the single place that records which scenes sit on a light
// background. The app stamps it on the root as `data-tone`, and App.css hangs
// every light-surface rule off that rather than off individual theme names, so
// a new scene inherits legible controls the moment it declares its tone.

export const THEMES = [
  { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'sunset', label: 'Sunset' },
  { id: 'pink', label: 'Pink' }, { id: 'cartoon', label: 'Cartoon' }, { id: 'terminal', label: 'Terminal' },
  { id: 'paper', label: 'Paper' }, { id: 'blueprint', label: 'Blueprint' }, { id: 'chrome', label: 'Chrome' },
  { id: 'bubblegum', label: 'Bubblegum' }, { id: 'ocean', label: 'Ocean' }, { id: 'ember', label: 'Ember' },
  { id: 'moss', label: 'Moss' },
]

/** Scenes that paint onto a light background and therefore invert their text. */
export const LIGHT_THEMES = new Set(['light', 'cartoon', 'paper', 'chrome', 'bubblegum'])

/** Retired theme ids kept working for accounts that still store them. */
const ALIASES = {
  'deep-space': 'dark',
  'neon-grid': 'dark',
  hologram: 'pink',
}

const KNOWN = new Set(THEMES.map((theme) => theme.id))

export function normalizeThemeId(themeId) {
  if (KNOWN.has(themeId)) return themeId
  return ALIASES[themeId] || 'dark'
}

/** 'light' or 'dark' — what the root's `data-tone` says. */
export function themeTone(themeId) {
  return LIGHT_THEMES.has(normalizeThemeId(themeId)) ? 'light' : 'dark'
}
