import bwipjs from 'bwip-js/node'
import { beforeAll, describe, expect, it } from 'vitest'
import { useLocalDecoder } from '../test/zxing-node.ts'
import { decodeImage, formatLabel, sameContent, upceToUpca, verifyReadBack } from './decode.ts'
import { defaultSpec, toBwipOptions, type RenderSpec } from './render.ts'
import { SYMBOLOGIES } from './symbologies.ts'

async function png(spec: RenderSpec): Promise<Uint8Array> {
  return new Uint8Array(await bwipjs.toBuffer({ ...toBwipOptions(spec), scale: 3 }))
}

beforeAll(() => {
  useLocalDecoder()
})

describe('decodeImage', () => {
  it('reads a QR code from PNG bytes', async () => {
    const results = await decodeImage(await png(defaultSpec('qrcode', 'Hello, wörld ✓')))
    expect(results).toEqual([expect.objectContaining({ format: 'QRCode', label: 'QR Code', text: 'Hello, wörld ✓' })])
  })

  it('returns an empty list when there is no code', async () => {
    const blank = { data: new Uint8ClampedArray(64 * 64 * 4).fill(255), width: 64, height: 64 }
    expect(await decodeImage(blank)).toEqual([])
  })
})

describe('round trip: every readable symbology decodes back to its input', () => {
  const readable = SYMBOLOGIES.filter((s) => s.decoderFormat)

  it('covers the main families', () => {
    const ids = readable.map((s) => s.id)
    for (const id of ['qrcode', 'microqrcode', 'datamatrix', 'azteccode', 'pdf417', 'ean13', 'upca', 'code128', 'code39', 'interleaved2of5']) {
      expect(ids).toContain(id)
    }
  })

  it.each(readable.map((s) => [s.id, s.sample]))('%s (%s)', async (id) => {
    const spec = defaultSpec(id)
    const results = await decodeImage(await png(spec))
    expect(verifyReadBack(spec.text, id, results)).toMatchObject({ status: 'match' })
  })
})

describe('verifyReadBack', () => {
  it('reports unsupported formats', () => {
    expect(verifyReadBack('01234', 'postnet', [])).toEqual({ status: 'unsupported' })
  })

  it('reports unreadable output', () => {
    expect(verifyReadBack('x', 'qrcode', [])).toEqual({ status: 'unreadable' })
  })

  it('reports a different value', () => {
    expect(verifyReadBack('abc', 'qrcode', [{ format: 'QRCode', label: 'QR Code', text: 'xyz' }])).toEqual({
      status: 'different',
      decoded: 'xyz',
    })
  })
})

describe('sameContent', () => {
  it.each([
    ['THIS IS CODE 39', 'THIS IS CODE 39Q', 'code39'],
    ['2401234567', '024012345676', 'interleaved2of5'],
    ['978-1-56581-231-4 90000', '9781565812314', 'isbn'],
    ['01234558', '0012345000058', 'upce'],
    ['(00) 0 9528765 432101234 6', '(00)095287654321012346', 'sscc18'],
  ])('%s ~ %s (%s)', (input, decoded, id) => {
    expect(sameContent(input, decoded, id)).toBe(true)
  })

  it('does not match unrelated short values', () => {
    expect(sameContent('12', '9912', 'code128')).toBe(false)
  })
})

describe('upceToUpca', () => {
  it.each([
    ['01234558', '012345000058'],
    ['04252614', '042100005264'],
    ['0123453', '012300000451'],
    ['123455', '012345000058'],
  ])('%s -> %s', (upce, upca) => {
    expect(upceToUpca(upce)).toBe(upca)
  })
})

describe('formatLabel', () => {
  it.each([
    ['QRCode', 'QR Code'],
    ['EAN13', 'EAN-13'],
    ['DataBarExp', 'DataBar Expanded'],
    ['SomethingNew', 'Something New'],
  ])('%s -> %s', (format, label) => {
    expect(formatLabel(format)).toBe(label)
  })
})
