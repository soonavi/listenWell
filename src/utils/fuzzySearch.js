// Subsequence matching for the command palette.
//
// "bocg" should find "Boards of Canada — Geogaddi". Scoring favours matches
// that start a word and matches whose characters sit close together, so the
// obvious candidate wins rather than whatever happens to be first in the list.

/**
 * Score `text` against `query`.
 * @returns a number > 0 when every query character appears in order, else 0
 */
export function fuzzyScore(text, query) {
  const haystack = String(text ?? '').toLowerCase()
  const needle = String(query ?? '').toLowerCase().trim()
  if (!needle) return 1
  if (!haystack) return 0

  // A straight substring hit always beats a scattered subsequence.
  const direct = haystack.indexOf(needle)
  if (direct !== -1) {
    const startsWord = direct === 0 || /[\s\-_/([]/.test(haystack[direct - 1])
    return 1000 - direct + (startsWord ? 500 : 0)
  }

  let score = 0
  let textIndex = 0
  let previousMatch = -1

  for (const char of needle) {
    const found = haystack.indexOf(char, textIndex)
    if (found === -1) return 0

    // Consecutive characters, and characters starting a word, are stronger
    // evidence that this is the item the listener meant.
    if (found === previousMatch + 1) score += 8
    else score += 1
    if (found === 0 || /[\s\-_/([]/.test(haystack[found - 1])) score += 6

    previousMatch = found
    textIndex = found + 1
  }

  // Shorter haystacks that satisfy the query are the tighter match.
  return score + Math.max(0, 20 - haystack.length / 4)
}

/**
 * Rank candidates by the best score across their searchable fields.
 *
 * @param items - anything
 * @param query - user input
 * @param getFields - item => string[] of text to match against
 */
export function fuzzyRank(items = [], query = '', getFields = (item) => [String(item)], limit = 20) {
  const scored = []
  for (const item of items) {
    let best = 0
    for (const field of getFields(item)) {
      const score = fuzzyScore(field, query)
      if (score > best) best = score
    }
    if (best > 0) scored.push({ item, score: best })
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item)
}
