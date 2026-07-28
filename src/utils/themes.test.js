import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { THEMES, LIGHT_THEMES, normalizeThemeId, themeTone } from './themes.js'

const css = readFileSync(fileURLToPath(new URL('../App.css', import.meta.url)), 'utf8')

/** The `[data-theme='x'] { ... }` root block for a scene, if it has one. */
function rootBlock(id) {
  const match = css.match(new RegExp(`\\[data-theme='${id}'\\]\\s*\\{([^}]*)\\}`))
  return match ? match[1] : null
}

test('every scene in the picker has a stylesheet', () => {
  const missing = THEMES.filter((theme) => rootBlock(theme.id) === null)
  assert.deepEqual(missing, [], 'a scene you can pick but cannot style renders as an unthemed page')
})

test('the light list matches what the stylesheet actually declares', () => {
  // This is the invariant behind the bug this test exists for: `chrome` and
  // `bubblegum` were light scenes that no light-surface rule reached, so the
  // playlist name input drew near-white text on a near-white field.
  for (const { id } of THEMES) {
    const declaresLight = /color-scheme:\s*light/.test(rootBlock(id) || '')
    assert.equal(
      LIGHT_THEMES.has(id),
      declaresLight,
      `${id}: LIGHT_THEMES says ${LIGHT_THEMES.has(id)} but its CSS says ${declaresLight}`,
    )
  }
})

test('light-surface rules hang off the tone, not off single scene names', () => {
  // Anything keyed to `[data-theme='light']` only ever reaches one of the five
  // light scenes. Legibility rules belong on [data-tone='light'].
  const perScene = [...css.matchAll(/\[data-theme='light'\]\s*([^,{]*)[,{]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean)
  assert.deepEqual(perScene, [], `these still target only the 'light' scene: ${perScene.join(', ')}`)
})

test('controls that must stay readable are styled for the light tone', () => {
  // The set that carries text or takes typing. If one loses its light-tone
  // rule, some scene renders it as pale text on a pale surface.
  const required = [
    '.ui-input', '.ui-input::placeholder', '.ui-pill',
    '.ui-btn-primary', '.ui-btn-secondary',
    '.menu-panel', '.glass-card', '.sort-select',
  ]
  for (const selector of required) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.ok(
      new RegExp(`\\[data-tone='light'\\]\\s*${escaped}\\s*[,{]`).test(css),
      `${selector} has no [data-tone='light'] rule`,
    )
  }
})

test('a surface coloured from artwork pins its own white', () => {
  // The mini player's background comes from album art, so the scene's inverted
  // white would print dark text on a dark bar.
  const block = css.match(/\.fixed-dark-surface\s*\{([^}]*)\}/)
  assert.ok(block, '.fixed-dark-surface is missing')
  assert.match(block[1], /--color-white:\s*#f{3,6}/i, 'it must re-point --color-white to real white')
})

test('unknown and retired scene ids resolve to something styleable', () => {
  assert.equal(normalizeThemeId('chrome'), 'chrome')
  assert.equal(normalizeThemeId('hologram'), 'pink', 'retired id keeps working')
  assert.equal(normalizeThemeId('deep-space'), 'dark')
  assert.equal(normalizeThemeId('nonsense'), 'dark')
  assert.equal(normalizeThemeId(undefined), 'dark')
})

test('tone follows the scene, including through an alias', () => {
  assert.equal(themeTone('chrome'), 'light')
  assert.equal(themeTone('bubblegum'), 'light')
  assert.equal(themeTone('dark'), 'dark')
  assert.equal(themeTone('terminal'), 'dark')
  assert.equal(themeTone('hologram'), 'dark', 'alias resolves to pink, a dark scene')
  assert.equal(themeTone('nonsense'), 'dark')
})
