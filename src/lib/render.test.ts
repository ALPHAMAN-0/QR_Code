import { describe, expect, it } from 'vitest'
import { defaultSpec, friendlyError, renderSvg, svgSize, toBwipOptions, type RenderSpec } from './render.ts'
import { SYMBOLOGIES } from './symbologies.ts'

const spec = (over: Partial<RenderSpec> = {}): RenderSpec => ({ ...defaultSpec('qrcode', 'hello'), ...over })

describe('defaultSpec', () => {
  it('uses the symbology sample text when none is given', () => {
    expect(defaultSpec('ean13').text).toBe('9520123456788')
  })

  it('shows human-readable text by default only where the symbology does', () => {
    expect(defaultSpec('ean13').showText).toBe(true)
    expect(defaultSpec('qrcode').showText).toBe(false)
  })

  it('uses a 4-module quiet zone for matrix codes and 10 for linear ones', () => {
    expect(defaultSpec('qrcode').margin).toBe(4)
    expect(defaultSpec('code128').margin).toBe(10)
  })
})

describe('toBwipOptions', () => {
  it('maps colors, scale and quiet zone', () => {
    expect(toBwipOptions(spec({ foreground: '112233', background: 'FFEEDD', scale: 3, margin: 4 }))).toMatchObject({
      bcid: 'qrcode',
      text: 'hello',
      scale: 3,
      padding: 8,
      barcolor: '112233',
      backgroundcolor: 'FFEEDD',
      textcolor: '112233',
      eclevel: 'M',
    })
  })

  it('omits the background when transparent', () => {
    expect(toBwipOptions(spec({ transparent: true }))).not.toHaveProperty('backgroundcolor')
  })

  it('forces high error correction when a logo is added', () => {
    expect(toBwipOptions(spec({ eclevel: 'L', logo: { dataUrl: 'data:image/png;base64,AA==', size: 0.2 } })).eclevel).toBe('H')
  })

  it('applies sample options, but lets the user control the human-readable text', () => {
    const opts = toBwipOptions({ ...defaultSpec('interleaved2of5'), showText: false })
    expect(opts).toMatchObject({ includecheck: true, height: 12.5 })
    expect(opts).not.toHaveProperty('includetext')
    expect(opts).not.toHaveProperty('includecheckintext')
  })

  it('does not send an error-correction level to symbologies without one', () => {
    expect(toBwipOptions(defaultSpec('code128'))).not.toHaveProperty('eclevel')
  })
})

describe('renderSvg', () => {
  it('returns a sized, crisp SVG', () => {
    const svg = renderSvg(spec({ scale: 2, margin: 0 }))
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('shape-rendering="crispEdges"')
    const size = svgSize(svg)
    expect(size.width).toBeGreaterThan(0)
    expect(svg).toContain(`width="${size.width}"`)
  })

  it('grows by the quiet zone on each side', () => {
    const tight = svgSize(renderSvg(spec({ scale: 1, margin: 0 })))
    const padded = svgSize(renderSvg(spec({ scale: 1, margin: 4 })))
    expect(padded.width - tight.width).toBe(16)
  })

  it('embeds a centered logo with a backing plate', () => {
    const svg = renderSvg(spec({ logo: { dataUrl: 'data:image/png;base64,AA==', size: 0.2 } }))
    expect(svg).toMatch(/<image [^>]*href="data:image\/png;base64,AA=="/)
    expect(svg).toMatch(/<rect [^>]*fill="#FFFFFF"/)
  })

  it('refuses logo data that is not an image data URL', () => {
    expect(() => renderSvg(spec({ logo: { dataUrl: 'javascript:alert(1)', size: 0.2 } }))).toThrow(/image/i)
    expect(() => renderSvg(spec({ logo: { dataUrl: 'data:image/png;base64,"/><script>', size: 0.2 } }))).toThrow(/image/i)
  })

  it('throws a readable message for invalid input', () => {
    expect(() => renderSvg(defaultSpec('ean13', '123'))).toThrow('EAN-13 must be 12 or 13 digits')
  })

  it.each(SYMBOLOGIES.map((s) => [s.id]))('renders the %s sample', (id) => {
    expect(() => renderSvg(defaultSpec(id))).not.toThrow()
  })
})

describe('friendlyError', () => {
  it('strips internal prefixes', () => {
    expect(friendlyError(new Error('bwipp.ean13badLength#6878: EAN-13 must be 12 or 13 digits'))).toBe(
      'EAN-13 must be 12 or 13 digits',
    )
  })

  it('explains missing text and too much data', () => {
    expect(friendlyError(new Error('bwip-js: bar code text not specified.'))).toMatch(/enter/i)
    expect(friendlyError(new Error('bwipp.qrcodeInputTooLong#27120: The input data is too long'))).toMatch(/too long/i)
  })

  it('handles non-Error values', () => {
    expect(friendlyError('boom')).toBe('boom')
    expect(friendlyError(undefined)).toMatch(/something went wrong/i)
  })
})
