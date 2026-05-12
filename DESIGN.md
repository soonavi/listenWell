---
name: Listenwell
description: A local music player for people who own their library.
colors:
  bg-base: "#0c0c0e"
  accent-violet: "#8b5cf6"
  accent-cyan: "#22d3ee"
  text-primary: "#f3f4f6"
  text-secondary: "#e5e7eb"
  text-muted: "#6b7280"
  border-subtle: "#ffffff0d"
  border-default: "#ffffff1f"
  surface-glass: "#ffffff14"
typography:
  display:
    fontFamily: "Orbitron, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.16em"
  headline:
    fontFamily: "Orbitron, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
  title:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.04em"
rounded:
  pill: "999px"
  lg: "16px"
  md: "10px"
  sm: "6px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "rgb(139 92 246 / 0.14)"
    textColor: "#ede9fe"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "rgb(139 92 246 / 0.24)"
    textColor: "#ede9fe"
  button-secondary:
    backgroundColor: "rgb(255 255 255 / 0.03)"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "rgb(255 255 255 / 0.07)"
  input:
    backgroundColor: "rgb(255 255 255 / 0.05)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  pill:
    backgroundColor: "rgb(255 255 255 / 0.05)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  song-tile:
    backgroundColor: "transparent"
    rounded: "{rounded.sm}"
  song-tile-hover:
    backgroundColor: "rgb(139 92 246 / 0.06)"
  upload-zone:
    backgroundColor: "rgb(255 255 255 / 0.03)"
    rounded: "{rounded.lg}"
---

# Design System: Listenwell

## 1. Overview

**Creative North Star: "The Frequency Archive"**

The interface is an instrument room inside a private archive: surfaces barely present, light arriving only from the signal. Nothing decorates for decoration's sake. Violet is the frequency readout — the active marker, the focus ring, the border on the element asking for your attention. Cyan appears where the violet signal resonates, a harmonic overtone. The two colors together are not a palette choice; they are a physics fact about how those frequencies relate.

The system is dark because the listener is focused. Someone who has chosen to leave streaming platforms and upload their own files is not a casual user — they are deliberate. The interface matches that: no warm editorial surfaces, no "made for you" nudges, no rounded friendly shapes that imply a service is doing something for you. The library belongs to the user. The interface holds it without comment.

Glass surfaces appear only where they carry architectural meaning: the settings panel floating above content, the queue panel sliding in from outside the main surface, the now-playing overlay taking over the entire screen. Glass is structure, not decoration. Applied indiscriminately it becomes the thing this system refuses to be.

**Key Characteristics:**
- Near-void base (`#0c0c0e`) with fractional white surfaces (2-8% opacity)
- Violet as frequency marker; cyan as harmonic resonance — neither is used as fill color
- Orbitron for structural labels and section identity; Space Grotesk for everything human
- Glow expresses elevation and state before movement does
- Aurora visualizer reacts to audio frequency data; all motion respects `prefers-reduced-motion`
- Fully controllable: aurora intensity, glow softness, blur amount, accent color, theme

## 2. Colors: The Archive Frequency

One primary frequency against a near-void, with a resonant harmonic.

### Primary
- **Archive Violet** (`#8b5cf6` / `oklch(55% 0.23 290)`): The system's one voice. Active state borders, focus rings, glow halos, the neural visualizer bars. Appears as solid color on 10-15% of any surface; appears as glow spread on up to 50%. Its rarity is the point.

### Secondary
- **Signal Cyan** (`#22d3ee` / `oklch(80% 0.15 200)`): The overtone. Used exclusively in gradient pairings with violet: scrollbar fills, neural band visualizer, aurora secondary bloom. Never used as a standalone action color.

### Neutral
- **Void Base** (`#0c0c0e`): The foundation. Not pure black — a near-void with a trace of cool undertone. All surfaces begin here.
- **Glass Surface** (`rgba(255,255,255,0.08)` → `rgba(255,255,255,0.02)`): The barely-there elevated layer. Used as backdrop for panels that float above content.
- **Border Whisper** (`rgba(255,255,255,0.05)`): Resting-state borders on song tiles and non-interactive surfaces.
- **Border Default** (`rgba(255,255,255,0.12)–0.18`): Input fields, secondary pill elements.
- **Text Primary** (`#f3f4f6`): Near-white. Song titles, active labels, headings.
- **Text Secondary** (`#e5e7eb`): Slightly dimmer. Secondary metadata, button labels.
- **Text Muted** (`#6b7280`): Captions, placeholders, inactive states, supporting copy.

### Named Rules
**The One Frequency Rule.** Violet appears as a solid color on ≤15% of any given screen. Its power comes from scarcity and glow spread. The moment it floods a surface it becomes decoration, not signal. Reserve solid violet fills for active borders and primary button tints; let the glow radius do the visual work.

**The Tonal Void Rule.** The base is `#0c0c0e`, not `#000000`. Never render pure black or pure white. Every neutral carries the archive's cold undertone.

**The Harmonic Pair Rule.** Cyan appears only alongside violet, never alone. It is an overtone, not a second accent. If violet is absent from a surface, cyan must be absent too.

## 3. Typography

**Display Font:** Orbitron (with `system-ui, sans-serif` fallback)
**Body Font:** Space Grotesk (with `system-ui, sans-serif` fallback)

**Character:** Orbitron is the archive's structural skeleton — geometric, monospaced-feeling, all-caps always. It identifies where you are; it doesn't carry prose. Space Grotesk is every human-facing moment: song titles, metadata, error messages, labels. The pairing is intentional tension: machine structure above, human text below.

### Hierarchy
- **Display** (Orbitron 700, `clamp(1.5rem, 4vw, 2.5rem)`, line-height 1.1, 0.16em tracking, uppercase): Section identity and screen titles. Sparse — appears once per screen at most.
- **Headline** (Orbitron 600, `1.125rem`, line-height 1.2, 0.12em tracking, uppercase): Sub-section labels, panel headers.
- **Title** (Space Grotesk 600, `1rem`, line-height 1.4): Song titles in the now-playing overlay. Primary content identity.
- **Body** (Space Grotesk 400–500, `0.875rem`, line-height 1.6): Metadata, artist names, secondary labels. Max line length 65–75ch where text wraps.
- **Label** (Space Grotesk 500, `0.75rem`, line-height 1.4, 0.04em tracking): Filter pills, control labels, timestamps, play counts.

### Named Rules
**The Two-Voice Rule.** Orbitron speaks for the archive's structure. Space Grotesk speaks for the music and the user. They do not cross over. Do not use Orbitron for body copy, error messages, or button labels. Do not use Space Grotesk for section identity.

**The Uppercase Contract.** Orbitron is always uppercase with letter-spacing ≥ 0.12em. Lowercase Orbitron breaks the typographic logic of the system entirely.

## 4. Elevation

The system uses structural glassmorphism: intentional, architectural, not decorative. Depth is expressed through glow radius, not shadow darkness. An elevated element does not get a heavier black shadow — it gets a violet glow halo alongside an ambient dark shadow.

Glass surfaces (`backdrop-filter: blur(18px)`) appear only on components that genuinely float above the content plane: the settings panel, the queue panel, the now-playing overlay. Song tiles, list rows, and inline controls are flat at rest. Hover state introduces a glow border rather than lifting the element.

### Shadow Vocabulary
- **Glass Panel** (`0 12px 48px rgb(8 9 14 / 0.35), 0 0 36px rgb(139 92 246 / 0.14), inset 0 0 0 1px rgb(255 255 255 / 0.05)`): The 3-layer stack on `.glass-card`. Ambient dark base + violet glow spread + inner border highlight.
- **Song Tile Hover** (`0 8px 24px rgb(10 10 12 / 0.35)`): Subtle ambient shadow, paired with a violet border (`rgb(139 92 246 / 0.35)`).
- **Album Art** (`0 28px 80px rgba(0,0,0,0.65)`): Deep directional shadow under the now-playing album art.
- **Magnetic Hover** (`0 0 [8–32px] rgb(139 92 246 / 0.2)`): Dynamic glow halo on interactive thumbnails, intensity controlled by `--glow-softness`.

### Named Rules
**The Glow-as-Elevation Rule.** Depth is glow, not darkness. Black shadows exist for ambient grounding; violet glow communicates interactive state and surface hierarchy. If an element needs to feel higher, increase its glow radius before increasing shadow darkness.

**The Flat-by-Default Rule.** Every interactive surface is flat at rest. Glow and border shift appear only as state responses (hover, focus, active, playing). Static glow on a non-interactive surface is prohibited.

## 5. Components

### Buttons
Glowing and tactile: borders illuminate before fills flood.

- **Shape:** Gently rounded (10px). Not pill, not sharp. The radius is functional, not friendly.
- **Primary:** `rgb(139 92 246 / 0.14)` fill, `rgb(139 92 246 / 0.68)` border, `#ede9fe` text. The violet tint is a whisper; the border is the signal.
- **Primary Hover:** Fill brightens to `rgb(139 92 246 / 0.24)`, border to `rgb(167 139 250 / 0.85)`. Transition: 160ms ease on background, border, transform.
- **Secondary:** `rgb(255 255 255 / 0.03)` fill, `rgb(255 255 255 / 0.18)` border, `#e5e7eb` text.
- **Secondary Hover:** Fill to `rgb(255 255 255 / 0.07)`, border to `rgb(255 255 255 / 0.40)`.
- **Focus Visible:** 2px outline `rgb(var(--accent-rgb) / 0.8)` with 2px offset. Works across all button variants.

### Pills / Filter Chips
- **Style:** Fully rounded (999px), `rgb(255 255 255 / 0.05)` fill, `rgb(255 255 255 / 0.16)` border. Space Grotesk label (0.75rem, 500).
- **Active / Selected:** Border shifts to violet, fill gains a violet tint. Never a solid fill.
- **Usage:** Song filter chips (All, Loved, Recently Played), sort dropdowns on toolbar.

### Song Tiles
- **Resting:** 1px `rgba(255,255,255,0.05)` border, transparent background.
- **Hover:** Border becomes `rgb(139 92 246 / 0.35)`, `box-shadow: 0 8px 24px rgb(10 10 12 / 0.35)`. Background tints to `rgb(139 92 246 / 0.06)`.
- **Currently Playing:** Persistent violet border glow. Distinct from hover state.
- **Internal:** Album art thumbnail (left) + title + artist + metadata (right). No nested cards.

### Inputs / Search Fields
- **Style:** `rgb(255 255 255 / 0.05)` fill, `rgb(255 255 255 / 0.12)` 1px border, `rgb(243 244 246)` text, rounded 10px.
- **Placeholder:** `rgb(107 114 128)` — muted, never white.
- **Focus:** Border becomes `rgb(139 92 246 / 0.55)`, 2px glow ring `rgb(139 92 246 / 0.22)`.
- **Keyboard shortcut:** `/` focuses the search field; `Escape` clears it.

### Glass Card / Panel
- **Background:** `linear-gradient(145deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.02))`
- **Backdrop:** `blur(18px)`. Used only on floating panels (settings, queue, overlays).
- **Shadow:** 3-layer stack (see Elevation — Glass Panel).
- **Border:** `inset 0 0 0 1px rgb(255 255 255 / 0.05)` — inner edge highlight.

### Upload Zone
- **Style:** `rounded-2xl` (16px), `rgb(255 255 255 / 0.03)` fill, `rgb(255 255 255 / 0.10)` border. Centered icon + instructional copy.
- **Drag Active:** Border shifts to `rgb(139 92 246 / 0.60)`, fill to `rgb(139 92 246 / 0.06)`, icon color to violet.
- **Transition:** 150ms on all properties.

### Now Playing Overlay (signature)
Full-screen takeover. The interface's most dramatic surface.

- **Background:** `#08090c` at 88% opacity + `backdrop-blur: 3xl (64px)`.
- **Ambient layer:** Album art scaled to full screen, `blur(48px) saturate(180%)` at 15% opacity. The music bleeds into the space.
- **Album art:** 240–288px square, `rounded-2xl`, `box-shadow: 0 28px 80px rgba(0,0,0,0.65)`. Entrance: scale 0.88 → 1, 400ms ease-out.
- **Controls:** Lucide icons, all 20–24px. Play/pause at 48px, slightly larger. Heart, shuffle, repeat as secondary.
- **Seek bar:** Custom `<input type="range">` styled with accent color via CSS custom property.
- **Lyrics view:** Alternates with controls via view toggle. Active LRC line highlighted in white; inactive lines in `text-muted`.

### Aurora Visualizer (signature)
Three radial glow blobs reacting to audio frequency bands (low, mid, high).

- **Colors:** Archive Violet (primary blob) + Signal Cyan (secondary bloom).
- **Blur:** `blur(calc(50px + (40px * var(--blur-amount))))` — controllable softness.
- **Opacity:** Driven by frequency shimmer data (`--shimmer-low`, `--shimmer-mid`, `--shimmer-high`).
- **Animation:** `auroraFloat 16s ease-in-out infinite` — gentle translate + scale drift.
- **Reduced motion:** All aurora animation stops; blobs remain as static background color.

## 6. Do's and Don'ts

### Do:
- **Do** use violet as glow and frequency marker. Let the glow spread (via `box-shadow` and the aurora system) do the visual work — not solid fills.
- **Do** use Orbitron uppercase with ≥ 0.12em letter-spacing for section headers and structural labels. Match the typographic contract.
- **Do** apply glass (`backdrop-filter: blur(18px)`) only on panels that architecturally float above the content plane: settings, queue, now-playing. Not on song tiles, list rows, or inline cards.
- **Do** honor `prefers-reduced-motion`. Every aurora blob, parallax card, and magnetic hover must have a static fallback. The app already implements `animation-duration: 0.01ms` globally.
- **Do** keep all easing exponential ease-out: `cubic-bezier(0.16, 1, 0.3, 1)` or equivalent. State transitions at 160ms; entrance animations 280–400ms.
- **Do** use `rgb(var(--accent-rgb) / opacity)` for any new interactive state that needs a violet glow — this lets accent color customization propagate automatically.

### Don't:
- **Don't** add warm editorial card layouts, rounded organic shapes, or "For You" / discovery sections. This is not Spotify's surface. The interface has no opinion about what you should play.
- **Don't** add any content curation affordance: trending rows, recommended playlists, algorithmic suggestions. These violate the core principle: the library belongs to the user, not the product.
- **Don't** use gradient text (`background-clip: text` with a gradient). Emphasis is through weight (Space Grotesk 600 vs 400) or color (violet vs muted), never gradient decoration.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored stripe accent on list items, song tiles, or callout panels. Use full-border tints or background color shifts instead.
- **Don't** use violet as a large fill color. If a surface is predominantly violet, the frequency metaphor collapses into decoration.
- **Don't** introduce bounce or elastic easing. No `spring`, no overshoot. The archive is precise; it does not wobble.
- **Don't** apply glassmorphism decoratively — blurring a card because it looks cool. Every `backdrop-filter` must have an architectural reason (it floats above, it overlays a content layer, it takes over the screen).
- **Don't** replicate Apple Music's editorial warmth: large editorial images, serif type, warm neutral backgrounds, "curated" language.
- **Don't** use the hero-metric template: large number, small label, supporting stats, gradient accent. There are no engagement metrics in this product.
