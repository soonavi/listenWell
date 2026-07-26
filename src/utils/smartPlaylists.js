// Rule-based playlists.
//
// Deliberately not an algorithm. Every track in a smart playlist is there
// because the listener wrote a rule that says so, and the rules are visible and
// editable. Nothing is inferred, weighted or personalised — the app has no
// opinion about what should be in here.
//
// A definition looks like:
//   { match: 'all', rules: [ { field: 'artist', op: 'is', value: 'Boards of Canada' },
//                            { field: 'playCount', op: 'gte', value: 5 } ] }

import { normalizeForMatch } from './duplicates.js'

/** Fields a rule can test, and which operators make sense for each. */
export const SMART_FIELDS = [
  { id: 'title', label: 'Title', type: 'text' },
  { id: 'artist', label: 'Artist', type: 'text' },
  { id: 'album', label: 'Album', type: 'text' },
  { id: 'loved', label: 'Loved', type: 'boolean' },
  { id: 'playCount', label: 'Play count', type: 'number' },
  { id: 'bpm', label: 'BPM', type: 'number' },
]

export const OPERATORS_BY_TYPE = {
  text: [
    { id: 'contains', label: 'contains' },
    { id: 'notContains', label: 'does not contain' },
    { id: 'is', label: 'is' },
    { id: 'isNot', label: 'is not' },
    { id: 'startsWith', label: 'starts with' },
  ],
  number: [
    { id: 'gte', label: 'at least' },
    { id: 'lte', label: 'at most' },
    { id: 'is', label: 'exactly' },
  ],
  boolean: [
    { id: 'isTrue', label: 'yes' },
    { id: 'isFalse', label: 'no' },
  ],
}

export function fieldType(fieldId) {
  return SMART_FIELDS.find((f) => f.id === fieldId)?.type ?? 'text'
}

/** Resolve a field for one song, pulling from context where it isn't on the song. */
function readField(song, fieldId, context = {}) {
  switch (fieldId) {
    case 'loved':
      return (context.lovedSongIds || []).includes(song.id)
    case 'playCount':
      return (context.playCounts || {})[song.id] || 0
    case 'bpm':
      return typeof song.bpm === 'number' ? song.bpm : null
    default:
      return song[fieldId] ?? ''
  }
}

export function evaluateRule(song, rule, context = {}) {
  if (!rule?.field || !rule?.op) return true
  const actual = readField(song, rule.field, context)
  const type = fieldType(rule.field)

  if (type === 'boolean') {
    return rule.op === 'isTrue' ? actual === true : actual === false
  }

  if (type === 'number') {
    // A track whose BPM was never measured shouldn't silently satisfy "at most
    // 100" — treat unknown as no match rather than as zero.
    if (actual === null || actual === undefined) return false
    const target = Number(rule.value)
    if (!Number.isFinite(target)) return true
    if (rule.op === 'gte') return actual >= target
    if (rule.op === 'lte') return actual <= target
    if (rule.op === 'is') return actual === target
    return true
  }

  const haystack = normalizeForMatch(actual)
  const needle = normalizeForMatch(rule.value)
  // An empty text rule is not yet meaningful; treat it as "no constraint"
  // instead of matching nothing, so a half-written rule doesn't empty the list.
  if (!needle) return true

  switch (rule.op) {
    case 'contains': return haystack.includes(needle)
    case 'notContains': return !haystack.includes(needle)
    case 'is': return haystack === needle
    case 'isNot': return haystack !== needle
    case 'startsWith': return haystack.startsWith(needle)
    default: return true
  }
}

/** `all` = every rule must pass, `any` = at least one. No rules matches everything. */
export function matchesDefinition(song, definition, context = {}) {
  const rules = definition?.rules || []
  if (rules.length === 0) return true
  if (definition?.match === 'any') return rules.some((r) => evaluateRule(song, r, context))
  return rules.every((r) => evaluateRule(song, r, context))
}

export function selectSmartPlaylistSongs(songs = [], definition, context = {}) {
  return songs.filter((song) => matchesDefinition(song, definition, context))
}

/** Plain-language summary for the playlist list, e.g. "artist contains aphex + at least 5 plays". */
export function describeDefinition(definition) {
  const rules = definition?.rules || []
  if (rules.length === 0) return 'Every song'
  const joiner = definition?.match === 'any' ? ' or ' : ' and '
  return rules.map((rule) => {
    const field = SMART_FIELDS.find((f) => f.id === rule.field)
    const label = field?.label ?? rule.field
    const type = fieldType(rule.field)
    if (type === 'boolean') return rule.op === 'isTrue' ? `${label}` : `not ${label.toLowerCase()}`
    const op = (OPERATORS_BY_TYPE[type] || []).find((o) => o.id === rule.op)?.label ?? rule.op
    return `${label.toLowerCase()} ${op} ${rule.value}`
  }).join(joiner)
}

export function createEmptyRule() {
  return { field: 'artist', op: 'contains', value: '' }
}

export function createEmptyDefinition() {
  return { match: 'all', rules: [createEmptyRule()] }
}
