// Minimal ID3v2.3 tag writer.
//
// Metadata edited in ListenWell lives in the account, not in the file. That's
// fine while you're here and useless the moment you take the file somewhere
// else — so a download rewrites the tag, and your corrections travel with the
// audio. Only the fields the app actually edits are written; any other frames
// in the original tag are replaced along with it.
//
// Format reference: ID3v2.3.0 — a 10-byte header followed by frames, each with
// a 4-character id, a 4-byte big-endian size, and 2 flag bytes.

const ID3_HEADER_SIZE = 10
const ENCODING_UTF16 = 0x01
const PICTURE_TYPE_FRONT_COVER = 0x03

/**
 * Size in bytes of the ID3v2 tag at the start of `bytes`, including its header.
 * Zero when there isn't one — .flac, .wav and untagged .mp3 all land here.
 */
export function readId3TagSize(bytes) {
  if (!bytes || bytes.length < ID3_HEADER_SIZE) return 0
  // "ID3"
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0
  const size = readSynchsafe(bytes, 6)
  const footerPresent = (bytes[5] & 0x10) !== 0
  return ID3_HEADER_SIZE + size + (footerPresent ? 10 : 0)
}

/** Synchsafe integers store 7 bits per byte so the sync pattern never appears. */
function readSynchsafe(bytes, offset) {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  )
}

function writeSynchsafe(value) {
  return new Uint8Array([
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f,
  ])
}

function writeUint32BE(value) {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ])
}

function latin1Bytes(text) {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff
  return out
}

/**
 * UTF-16LE with a byte-order mark, which ID3v2.3 encoding 0x01 requires.
 * Using UTF-16 rather than Latin-1 means non-Western titles survive.
 */
function utf16Bytes(text) {
  const out = new Uint8Array(2 + text.length * 2)
  out[0] = 0xff
  out[1] = 0xfe
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    out[2 + i * 2] = code & 0xff
    out[2 + i * 2 + 1] = (code >> 8) & 0xff
  }
  return out
}

function concat(chunks) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function textFrame(id, value) {
  const body = concat([new Uint8Array([ENCODING_UTF16]), utf16Bytes(value)])
  return concat([latin1Bytes(id), writeUint32BE(body.length), new Uint8Array([0, 0]), body])
}

function pictureFrame({ data, mimeType = 'image/jpeg' }) {
  const body = concat([
    new Uint8Array([0x00]), // description encoding: Latin-1
    latin1Bytes(mimeType),
    new Uint8Array([0x00]),
    new Uint8Array([PICTURE_TYPE_FRONT_COVER]),
    new Uint8Array([0x00]), // empty description, terminated
    data,
  ])
  return concat([latin1Bytes('APIC'), writeUint32BE(body.length), new Uint8Array([0, 0]), body])
}

/**
 * Build a complete ID3v2.3 tag. Empty fields are omitted rather than written
 * blank, so a download never replaces a real tag value with nothing.
 *
 * @param picture - { data: Uint8Array, mimeType } or null
 */
export function buildId3Tag({ title, artist, album, picture } = {}) {
  const frames = []
  if (title) frames.push(textFrame('TIT2', title))
  if (artist) frames.push(textFrame('TPE1', artist))
  if (album) frames.push(textFrame('TALB', album))
  if (picture?.data?.length) frames.push(pictureFrame(picture))

  if (frames.length === 0) return new Uint8Array(0)

  const body = concat(frames)
  const header = concat([
    latin1Bytes('ID3'),
    new Uint8Array([0x03, 0x00]), // version 2.3.0
    new Uint8Array([0x00]), // no flags
    writeSynchsafe(body.length),
  ])
  return concat([header, body])
}

/**
 * Return `fileBytes` with any leading ID3v2 tag replaced by a fresh one.
 *
 * Only meaningful for formats that carry ID3 at the front (MP3 above all).
 * For anything else the caller should download the file untouched — see
 * `supportsId3`.
 */
export function writeId3Tag(fileBytes, tags) {
  const bytes = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes)
  const existing = readId3TagSize(bytes)
  const audio = existing > 0 ? bytes.subarray(existing) : bytes
  const tag = buildId3Tag(tags)
  return concat([tag, audio])
}

/** ID3 belongs on MPEG audio; other containers have their own tagging schemes. */
export function supportsId3(fileName = '') {
  return /\.(mp3|mp2|aac)$/i.test(fileName.trim())
}
