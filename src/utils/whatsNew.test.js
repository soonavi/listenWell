import test from 'node:test'
import assert from 'node:assert/strict'

import { compareVersions, releasesSince, shouldPrompt, RELEASES } from './whatsNew.js'

test('equal versions compare as equal', () => {
  assert.equal(compareVersions('0.2.3', '0.2.3'), 0)
})

test('a later patch compares greater than an earlier one', () => {
  assert.ok(compareVersions('0.2.3', '0.2.2') > 0)
  assert.ok(compareVersions('0.2.2', '0.2.3') < 0)
})

test('multi-digit segments compare numerically, not lexically', () => {
  // A string compare would put "0.2.10" before "0.2.9" (\'1\' < \'9\').
  assert.ok(compareVersions('0.2.10', '0.2.9') > 0)
  assert.ok(compareVersions('0.2.9', '0.2.10') < 0)
})

test('a missing patch segment is treated as zero', () => {
  assert.equal(compareVersions('0.2', '0.2.0'), 0)
  assert.ok(compareVersions('0.3', '0.2.9') > 0)
})

test('malformed or missing input does not throw and sorts as "oldest"', () => {
  assert.doesNotThrow(() => compareVersions('not-a-version', '0.2.0'))
  assert.doesNotThrow(() => compareVersions(undefined, undefined))
  assert.doesNotThrow(() => compareVersions(null, '0.2.0'))
  assert.doesNotThrow(() => compareVersions(42, '0.2.0'))

  assert.ok(compareVersions('not-a-version', '0.2.0') < 0)
  assert.ok(compareVersions(undefined, '0.2.0') < 0)
  assert.equal(compareVersions(undefined, undefined), 0)
})

test('releasesSince spans a gap covering multiple releases, newest first', () => {
  const gap = releasesSince('0.2.0', '0.2.3')
  assert.deepEqual(gap.map((r) => r.version), ['0.2.3', '0.2.2', '0.2.1'])
})

test('releasesSince excludes the seen version itself and anything past current', () => {
  const gap = releasesSince('0.2.1', '0.2.2')
  assert.deepEqual(gap.map((r) => r.version), ['0.2.2'])
})

test('releasesSince returns nothing when there is no gap', () => {
  assert.deepEqual(releasesSince('0.2.3', '0.2.3'), [])
})

test('a first-ever run (no stored version) never prompts', () => {
  assert.equal(shouldPrompt(undefined, '0.2.3'), false)
  assert.equal(shouldPrompt(null, '0.2.3'), false)
  assert.equal(shouldPrompt('', '0.2.3'), false)
})

test('equal versions do not prompt', () => {
  assert.equal(shouldPrompt('0.2.3', '0.2.3'), false)
})

test('a downgrade does not prompt', () => {
  assert.equal(shouldPrompt('0.2.3', '0.2.1'), false)
})

test('a gap spanning multiple releases prompts', () => {
  assert.equal(shouldPrompt('0.2.0', '0.2.3'), true)
})

test('a gap with no release notes covering it does not prompt', () => {
  // Both versions are newer than anything in RELEASES, so there is nothing
  // to brief the user on even though currentVersion > seenVersion.
  assert.equal(shouldPrompt('9.0.0', '9.0.1'), false)
})

test('malformed seenVersion does not throw when checked', () => {
  assert.doesNotThrow(() => shouldPrompt('garbage', '0.2.3'))
})

test('RELEASES is ordered newest first with no gaps in the documented range', () => {
  const versions = RELEASES.map((r) => r.version)
  for (let i = 0; i < versions.length - 1; i++) {
    assert.ok(compareVersions(versions[i], versions[i + 1]) > 0)
  }
})
