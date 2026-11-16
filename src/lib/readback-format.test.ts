import { describe, expect, it } from 'vitest'
import { symbologyForFormat } from './readback.ts'
import { getSymbology } from './symbologies.ts'

describe('symbologyForFormat', () => {
  it.each([
    ['QRCode', 'qrcode'],
    ['MicroQRCode', 'microqrcode'],
    ['RMQRCode', 'rectangularmicroqrcode'],
    ['EAN13', 'ean13'],
    ['UPCE', 'upce'],
    ['Code128', 'code128'],
    ['ITF', 'interleaved2of5'],
    ['ITF14', 'itf14'],
    ['Codabar', 'rationalizedCodabar'],
    ['DataMatrix', 'datamatrix'],
    ['AztecCode', 'azteccode'],
    ['DataBarExp', 'databarexpanded'],
  ])('maps scanner format %s to the editor format %s', (format, id) => {
    expect(symbologyForFormat(format)).toBe(id)
    expect(getSymbology(id)).toBeDefined()
  })

  it('returns undefined for formats the editor cannot make', () => {
    expect(symbologyForFormat('DXFilmEdge')).toBeUndefined()
  })
})
