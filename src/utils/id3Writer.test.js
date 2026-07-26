import test from 'node:test'
import assert from 'node:assert/strict'

import { readId3TagSize, buildId3Tag, writeId3Tag, supportsId3 } from './id3Writer.js'

const ascii = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0))
const tagId = (bytes, offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4))

test('a file with no tag reports size zero', () => {
  assert.equal(readId3TagSize(ascii('RIFFxxxx')), 0)
  assert.equal(readId3TagSize(new Uint8Array(0)), 0)
  assert.equal(readId3TagSize(null), 0)
})

test('an existing tag header is measured including its 10 header bytes', () => {
  // "ID3", v2.3, no flags, synchsafe size = 1 -> total 11
  const bytes = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 1, 0xff])
  assert.equal(readId3TagSize(bytes), 11)
})

test('synchsafe sizes decode across byte boundaries', () => {
  // 0x00 0x00 0x01 0x00 => 128
  const bytes = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 1, 0])
  assert.equal(readId3TagSize(bytes), 10 + 128)
})

test('a built tag starts with a valid v2.3 header', () => {
  const tag = buildId3Tag({ title: 'Hello' })
  assert.equal(tagId(tag, 0).slice(0, 3), 'ID3')
  assert.equal(tag[3], 3, 'major version')
  assert.equal(tag[4], 0, 'revision')
  // Declared size must match the bytes after the 10-byte header.
  const declared = (tag[6] << 21) | (tag[7] << 14) | (tag[8] << 7) | tag[9]
  assert.equal(declared, tag.length - 10)
})

test('each populated field becomes its own frame', () => {
  const tag = buildId3Tag({ title: 'T', artist: 'A', album: 'B' })
  const ids = []
  let offset = 10
  while (offset + 10 <= tag.length) {
    const id = tagId(tag, offset)
    if (id.trim() === '') break
    ids.push(id)
    const size = (tag[offset + 4] << 24) | (tag[offset + 5] << 16) | (tag[offset + 6] << 8) | tag[offset + 7]
    offset += 10 + size
  }
  assert.deepEqual(ids, ['TIT2', 'TPE1', 'TALB'])
  assert.equal(offset, tag.length, 'frame sizes account for the whole tag')
})

test('empty fields are omitted rather than written blank', () => {
  const tag = buildId3Tag({ title: 'Only', artist: '', album: undefined })
  assert.equal(tag.length > 0, true)
  const text = String.fromCharCode(...tag)
  assert.equal(text.includes('TPE1'), false)
  assert.equal(text.includes('TALB'), false)
})

test('no fields at all produces no tag', () => {
  assert.equal(buildId3Tag({}).length, 0)
  assert.equal(buildId3Tag().length, 0)
})

test('text is UTF-16 with a BOM so non-Latin titles survive', () => {
  const tag = buildId3Tag({ title: 'Жизнь' })
  // frame body begins at 10 (header) + 10 (frame header)
  assert.equal(tag[20], 0x01, 'UTF-16 encoding byte')
  assert.equal(tag[21], 0xff)
  assert.equal(tag[22], 0xfe)
})

test('a cover becomes an APIC frame carrying the image bytes', () => {
  const picture = { data: new Uint8Array([1, 2, 3, 4]), mimeType: 'image/png' }
  const tag = buildId3Tag({ title: 'x', picture })
  const text = String.fromCharCode(...tag)
  assert.equal(text.includes('APIC'), true)
  assert.equal(text.includes('image/png'), true)
})

test('writing prepends the tag to untagged audio', () => {
  const audio = ascii('AUDIODATA')
  const out = writeId3Tag(audio, { title: 'x' })
  assert.equal(tagId(out, 0).slice(0, 3), 'ID3')
  assert.equal(String.fromCharCode(...out.subarray(out.length - 9)), 'AUDIODATA')
})

test('writing replaces an existing tag instead of stacking a second one', () => {
  const oldTag = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 2, 0xaa, 0xbb])
  const withAudio = new Uint8Array([...oldTag, ...ascii('AUDIO')])
  const out = writeId3Tag(withAudio, { title: 'new' })

  const text = String.fromCharCode(...out)
  assert.equal(text.indexOf('ID3'), 0)
  assert.equal(text.indexOf('ID3', 1), -1, 'only one tag')
  assert.equal(text.endsWith('AUDIO'), true, 'audio preserved')
  assert.equal(text.includes(String.fromCharCode(0xaa, 0xbb)), false, 'old tag body dropped')
})

test('audio survives byte-for-byte', () => {
  const audio = new Uint8Array([0, 255, 128, 7, 42])
  const out = writeId3Tag(audio, { title: 'x' })
  assert.deepEqual([...out.subarray(out.length - 5)], [0, 255, 128, 7, 42])
})

test('writing nothing leaves the audio alone', () => {
  const audio = ascii('AUDIO')
  assert.deepEqual([...writeId3Tag(audio, {})], [...audio])
})

test('ArrayBuffer input is accepted', () => {
  const out = writeId3Tag(ascii('AUDIO').buffer, { title: 'x' })
  assert.equal(String.fromCharCode(...out).endsWith('AUDIO'), true)
})

test('only MPEG-family files are tagged', () => {
  assert.equal(supportsId3('song.mp3'), true)
  assert.equal(supportsId3('SONG.MP3'), true)
  assert.equal(supportsId3('song.flac'), false)
  assert.equal(supportsId3('song.wav'), false)
  assert.equal(supportsId3('song.m4a'), false)
  assert.equal(supportsId3(''), false)
})
