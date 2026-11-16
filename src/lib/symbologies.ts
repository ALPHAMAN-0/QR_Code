/**
 * Catalog of every barcode type the app can make, built from bwip-js's own symbol list
 * (names, sample values, default options) plus our grouping and scanner mapping.
 */

import { symbolList } from 'bwip-js/browser'

export type CategoryId = 'matrix' | 'retail' | 'industrial' | 'gs1' | 'postal' | 'healthcare' | 'composite' | 'other'

export const CATEGORIES: ReadonlyArray<{ id: CategoryId; label: string }> = [
  { id: 'matrix', label: '2D codes' },
  { id: 'retail', label: 'Retail & books' },
  { id: 'industrial', label: 'Industrial & logistics' },
  { id: 'gs1', label: 'GS1 supply chain' },
  { id: 'healthcare', label: 'Healthcare & pharma' },
  { id: 'postal', label: 'Postal' },
  { id: 'composite', label: 'Composite' },
  { id: 'other', label: 'Specialty' },
]

export type EccLevel = 'L' | 'M' | 'Q' | 'H'
export type BwippOptionValue = string | true

export interface Symbology {
  /** bwip-js barcode id (bcid). */
  id: string
  name: string
  category: CategoryId
  /** Example value that is valid for this symbology. */
  sample: string
  /** Default bwip-js options taken from the symbol list. */
  options: Readonly<Record<string, BwippOptionValue>>
  /** Draws a human-readable line under the bars by default. */
  showsText: boolean
  /** Square-module 2D symbol (used for quiet-zone sizing). */
  matrix: boolean
  /** Holds arbitrary text, so content templates (Wi-Fi, contact, …) make sense. */
  freeText: boolean
  eccLevels?: readonly EccLevel[]
  /** A centered logo is supported (QR only; relies on error correction). */
  logo: boolean
  /** Format name the scanner reports, when the scanner can read this symbology. */
  decoderFormat?: string
}

const RETAIL = ['ean13', 'ean8', 'ean5', 'ean2', 'upca', 'upce', 'isbn', 'ismn', 'issn', 'mands']
const POSTAL = ['onecode', 'postnet', 'planet', 'royalmail', 'auspost', 'kix', 'japanpost', 'mailmark', 'identcode', 'leitcode']
const HEALTHCARE = ['pharmacode', 'pharmacode2', 'pzn', 'code32']
const GS1_EXTRA = ['ean14', 'sscc18', 'itf14', 'd3aqr']
const OTHER = ['raw', 'daft', 'symbol', 'flattermarken', 'channelcode', 'posicode', 'bc412']
const MATRIX_2D = [
  'qrcode', 'microqrcode', 'rectangularmicroqrcode', 'swissqrcode', 'datamatrix', 'datamatrixrectangular',
  'datamatrixrectangularextension', 'azteccode', 'azteccodecompact', 'aztecrune', 'pdf417', 'pdf417compact',
  'micropdf417', 'maxicode', 'codeone', 'hanxin', 'dotcode', 'ultracode', 'codablockf', 'code16k', 'code49',
]
const SQUARE_MODULES = new Set([
  'qrcode', 'microqrcode', 'rectangularmicroqrcode', 'swissqrcode', 'gs1qrcode', 'gs1dlqrcode', 'hibcqrcode',
  'datamatrix', 'datamatrixrectangular', 'datamatrixrectangularextension', 'gs1datamatrix', 'gs1datamatrixrectangular',
  'gs1dldatamatrix', 'hibcdatamatrix', 'hibcdatamatrixrectangular', 'azteccode', 'azteccodecompact', 'aztecrune',
  'hibcazteccode', 'maxicode', 'codeone', 'hanxin', 'dotcode', 'gs1dotcode', 'ultracode', 'mailmark', 'd3aqr',
])
const FREE_TEXT = new Set(['qrcode', 'datamatrix', 'datamatrixrectangular', 'azteccode', 'pdf417', 'pdf417compact', 'hanxin', 'dotcode', 'codeone'])

/** bwip-js id → scanner (zxing) symbology. Unlisted ids can be made but not read back. */
const DECODER_FORMATS: Record<string, string> = {
  qrcode: 'QRCode', gs1qrcode: 'QRCode', gs1dlqrcode: 'QRCode', hibcqrcode: 'QRCode', swissqrcode: 'QRCode',
  microqrcode: 'QRCode', rectangularmicroqrcode: 'QRCode',
  datamatrix: 'DataMatrix', datamatrixrectangular: 'DataMatrix', gs1datamatrix: 'DataMatrix',
  gs1datamatrixrectangular: 'DataMatrix', gs1dldatamatrix: 'DataMatrix', hibcdatamatrix: 'DataMatrix',
  hibcdatamatrixrectangular: 'DataMatrix',
  pdf417: 'PDF417', pdf417compact: 'PDF417', micropdf417: 'PDF417', hibcpdf417: 'PDF417', hibcmicropdf417: 'PDF417',
  azteccode: 'Aztec', azteccodecompact: 'Aztec', aztecrune: 'Aztec', hibcazteccode: 'Aztec',
  maxicode: 'MaxiCode',
  ean13: 'EANUPC', ean8: 'EANUPC', upca: 'EANUPC', upce: 'EANUPC', isbn: 'EANUPC', ismn: 'EANUPC',
  code128: 'Code128', 'gs1-128': 'Code128', ean14: 'Code128', sscc18: 'Code128', hibccode128: 'Code128',
  code39: 'Code39', code39ext: 'Code39', hibccode39: 'Code39', code32: 'Code39', pzn: 'Code39',
  code93: 'Code93', code93ext: 'Code93',
  interleaved2of5: 'ITF', itf14: 'ITF',
  rationalizedCodabar: 'Codabar',
  databaromni: 'DataBar', databarstacked: 'DataBar', databarstackedomni: 'DataBar', databartruncated: 'DataBar',
  databarlimited: 'DataBar', databarexpanded: 'DataBar', databarexpandedstacked: 'DataBar',
  telepen: 'Telepen', telepennumeric: 'Telepen',
}

const ECC: Record<string, readonly EccLevel[]> = {
  qrcode: ['L', 'M', 'Q', 'H'],
  microqrcode: ['L', 'M', 'Q'],
}

export const POPULAR_IDS: readonly string[] = [
  'qrcode', 'datamatrix', 'azteccode', 'pdf417', 'ean13', 'upca', 'code128', 'code39', 'ean8', 'upce',
  'itf14', 'rationalizedCodabar', 'gs1-128', 'isbn', 'microqrcode', 'maxicode',
]

function categorize(id: string): CategoryId {
  if (id.includes('composite') || id === 'gs1-cc') return 'composite'
  if (id.startsWith('hibc') || HEALTHCARE.includes(id)) return 'healthcare'
  if (POSTAL.includes(id)) return 'postal'
  if (id.startsWith('gs1') || id.startsWith('databar') || GS1_EXTRA.includes(id)) return 'gs1'
  if (RETAIL.includes(id)) return 'retail'
  if (MATRIX_2D.includes(id)) return 'matrix'
  if (OTHER.includes(id)) return 'other'
  return 'industrial'
}

/** Parses bwip-js option strings such as `includetext height=12.5`. */
export function parseBwippOptions(opts: string): Record<string, BwippOptionValue> {
  const result: Record<string, BwippOptionValue> = {}
  for (const token of opts.split(/\s+/).filter(Boolean)) {
    const eq = token.indexOf('=')
    if (eq === -1) result[token] = true
    else result[token.slice(0, eq)] = token.slice(eq + 1)
  }
  return result
}

export const SYMBOLOGIES: readonly Symbology[] = symbolList.map((s): Symbology => {
  const options = parseBwippOptions(s.opts)
  return {
    id: s.bcid,
    name: s.desc,
    category: categorize(s.bcid),
    sample: s.text,
    options,
    showsText: options.includetext === true,
    matrix: SQUARE_MODULES.has(s.bcid),
    freeText: FREE_TEXT.has(s.bcid),
    eccLevels: ECC[s.bcid],
    logo: s.bcid === 'qrcode',
    decoderFormat: DECODER_FORMATS[s.bcid],
  }
})

const BY_ID = new Map(SYMBOLOGIES.map((s) => [s.id, s]))

export function getSymbology(id: string): Symbology | undefined {
  return BY_ID.get(id)
}

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.id, c.label]))

export function searchSymbologies(query: string): Symbology[] {
  const q = squash(query)
  if (!q) return [...SYMBOLOGIES]
  return SYMBOLOGIES.filter((s) =>
    [s.name, s.id, CATEGORY_LABEL.get(s.category) ?? ''].some((field) => squash(field).includes(q)),
  )
}
