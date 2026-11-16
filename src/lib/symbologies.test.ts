import { describe, expect, it } from 'vitest'
import {
  CATEGORIES,
  getSymbology,
  parseBwippOptions,
  POPULAR_IDS,
  searchSymbologies,
  SYMBOLOGIES,
} from './symbologies.ts'

describe('symbology catalog', () => {
  it('includes every symbology bwip-js can draw', () => {
    expect(SYMBOLOGIES.length).toBeGreaterThanOrEqual(100)
    expect(new Set(SYMBOLOGIES.map((s) => s.id)).size).toBe(SYMBOLOGIES.length)
  })

  it('gives every entry a name, sample, and a known category', () => {
    const categoryIds = CATEGORIES.map((c) => c.id)
    for (const s of SYMBOLOGIES) {
      expect(s.name, s.id).not.toBe('')
      expect(s.sample, s.id).not.toBe('')
      expect(categoryIds, s.id).toContain(s.category)
    }
  })

  it('classifies well-known codes', () => {
    expect(getSymbology('qrcode')).toMatchObject({ name: 'QR Code', category: 'matrix', freeText: true, eccLevels: ['L', 'M', 'Q', 'H'], logo: true })
    expect(getSymbology('ean13')).toMatchObject({ category: 'retail', freeText: false, matrix: false })
    expect(getSymbology('code128')).toMatchObject({ category: 'industrial' })
    expect(getSymbology('onecode')).toMatchObject({ category: 'postal' })
    expect(getSymbology('hibccode128')).toMatchObject({ category: 'healthcare' })
    expect(getSymbology('ean13composite')).toMatchObject({ category: 'composite' })
    expect(getSymbology('databaromni')).toMatchObject({ category: 'gs1' })
  })

  it('maps symbologies to the format the scanner reports', () => {
    expect(getSymbology('qrcode')?.decoderFormat).toBe('QRCode')
    expect(getSymbology('ean13')?.decoderFormat).toBe('EANUPC')
    expect(getSymbology('rationalizedCodabar')?.decoderFormat).toBe('Codabar')
    expect(getSymbology('postnet')?.decoderFormat).toBeUndefined()
  })

  it('exposes popular formats that all exist', () => {
    expect(POPULAR_IDS[0]).toBe('qrcode')
    for (const id of POPULAR_IDS) expect(getSymbology(id), id).toBeDefined()
  })

  it('returns undefined for unknown ids', () => {
    expect(getSymbology('nope')).toBeUndefined()
  })
})

describe('searchSymbologies', () => {
  it('finds by name, id or category, ignoring case and punctuation', () => {
    const ids = searchSymbologies('ean').map((s) => s.id)
    expect(ids).toContain('ean13')
    expect(ids).toContain('ean8')
    expect(searchSymbologies('datamatrix').map((s) => s.id)).toContain('datamatrix')
    expect(searchSymbologies('Data Matrix').map((s) => s.id)).toContain('datamatrix')
    expect(searchSymbologies('postal').every((s) => s.category === 'postal' || /post/i.test(s.name))).toBe(true)
  })

  it('returns everything for an empty query', () => {
    expect(searchSymbologies('  ')).toHaveLength(SYMBOLOGIES.length)
  })
})

describe('parseBwippOptions', () => {
  it('parses flags and key=value pairs', () => {
    expect(parseBwippOptions('includetext height=12.5 eclevel=M')).toEqual({ includetext: true, height: '12.5', eclevel: 'M' })
  })

  it('handles empty input', () => {
    expect(parseBwippOptions('')).toEqual({})
  })
})
