/** Reads codes from images with zxing-wasm and checks that a generated code reads back correctly. */

import { prepareZXingModule, readBarcodes, type ZXingModuleOverrides } from 'zxing-wasm/reader'
import { getSymbology } from './symbologies.ts'

export interface DecodedCode {
  /** Canonical scanner format, e.g. `QRCode`, `EAN13`. */
  format: string
  /** Human label, e.g. `QR Code`, `EAN-13`. */
  label: string
  text: string
  /** Corner points of the code in the image, when known. */
  corners?: Array<{ x: number; y: number }>
}

export interface PixelData {
  data: Uint8ClampedArray
  width: number
  height: number
}

export type DecodeInput = Blob | ArrayBuffer | Uint8Array | PixelData

/** Must be called before the first read. Browsers point `locateFile` at the bundled .wasm; tests pass `wasmBinary`. */
export function configureDecoder(overrides: ZXingModuleOverrides): void {
  prepareZXingModule({ overrides })
}

const LABELS: Record<string, string> = {
  QRCode: 'QR Code',
  QRCodeModel1: 'QR Code Model 1',
  QRCodeModel2: 'QR Code',
  MicroQRCode: 'Micro QR Code',
  RMQRCode: 'rMQR Code',
  DataMatrix: 'Data Matrix',
  PDF417: 'PDF417',
  CompactPDF417: 'Compact PDF417',
  MicroPDF417: 'MicroPDF417',
  Aztec: 'Aztec',
  AztecCode: 'Aztec Code',
  AztecRune: 'Aztec Rune',
  MaxiCode: 'MaxiCode',
  EANUPC: 'EAN/UPC',
  EAN13: 'EAN-13',
  EAN8: 'EAN-8',
  EAN5: 'EAN-5',
  EAN2: 'EAN-2',
  ISBN: 'ISBN',
  UPCA: 'UPC-A',
  UPCE: 'UPC-E',
  Code128: 'Code 128',
  Code39: 'Code 39',
  Code39Std: 'Code 39',
  Code39Ext: 'Code 39 Extended',
  Code32: 'Code 32 (Italian Pharmacode)',
  PZN: 'PZN',
  Code93: 'Code 93',
  ITF: 'ITF',
  ITF14: 'ITF-14',
  Codabar: 'Codabar',
  DataBar: 'GS1 DataBar',
  DataBarOmni: 'DataBar Omnidirectional',
  DataBarStk: 'DataBar Stacked',
  DataBarStkOmni: 'DataBar Stacked Omnidirectional',
  DataBarLtd: 'DataBar Limited',
  DataBarExp: 'DataBar Expanded',
  DataBarExpStk: 'DataBar Expanded Stacked',
  Telepen: 'Telepen',
  TelepenAlpha: 'Telepen',
  TelepenNumeric: 'Telepen Numeric',
  DXFilmEdge: 'DX Film Edge',
}

export function formatLabel(format: string): string {
  return LABELS[format] ?? format.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export async function decodeImage(input: DecodeInput, options: { fast?: boolean } = {}): Promise<DecodedCode[]> {
  const results = await readBarcodes(input as Blob, {
    tryHarder: !options.fast,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    maxNumberOfSymbols: 8,
  })
  return results
    .filter((r) => r.isValid && r.format !== 'None')
    .map((r) => ({
      format: r.format,
      label: formatLabel(r.format),
      text: r.text,
      corners: r.position
        ? [r.position.topLeft, r.position.topRight, r.position.bottomRight, r.position.bottomLeft]
        : undefined,
    }))
}

const CONTROL_MNEMONICS = [
  'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'TAB', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI',
  'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US',
]

// Longest names first so `^LFS` is read as `^LF` + `S`.
const MNEMONIC_PATTERN = new RegExp(
  `\\^(${[...CONTROL_MNEMONICS].sort((a, b) => b.length - a.length).join('|')})`,
  'g',
)

/** Expands bwip-js `parse` escapes (`^029`, `^GS`, `^CR`) into real characters. */
function expandCaretEscapes(text: string): string {
  return text
    .replace(/\^(\d{3})/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(MNEMONIC_PATTERN, (_, name: string) => String.fromCharCode(CONTROL_MNEMONICS.indexOf(name)))
}

const alnum = (value: string) => value.replace(/[^A-Za-z0-9]/g, '')

/** True when `short` can be obtained from `long` by deleting characters (e.g. an inserted check digit). */
function isSubsequence(short: string, long: string): boolean {
  let i = 0
  for (const ch of long) if (ch === short[i]) i++
  return i === short.length
}
const digits = (value: string) => value.replace(/\D/g, '')

/** Expands a 6–8 digit UPC-E into its 12-digit UPC-A form (with computed check digit). */
export function upceToUpca(upce: string): string | null {
  const d = digits(upce)
  let system = '0'
  let body: string
  if (d.length === 6) body = d
  else if (d.length === 7 || d.length === 8) {
    system = d[0]!
    body = d.slice(1, 7)
  } else return null
  const [d1, d2, d3, d4, d5, d6] = body.split('') as [string, string, string, string, string, string]
  let middle: string
  if (d6 <= '2') middle = `${d1}${d2}${d6}0000${d3}${d4}${d5}`
  else if (d6 === '3') middle = `${d1}${d2}${d3}00000${d4}${d5}`
  else if (d6 === '4') middle = `${d1}${d2}${d3}${d4}00000${d5}`
  else middle = `${d1}${d2}${d3}${d4}${d5}0000${d6}`
  const eleven = system + middle
  const sum = eleven.split('').reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 3 : 1), 0)
  return eleven + String((10 - (sum % 10)) % 10)
}

/**
 * True when the scanner's output carries the same data as the input. Scanners legitimately
 * add check digits, drop add-ons, expand UPC-E or format GS1 data, so compare the essentials.
 */
export function sameContent(input: string, decoded: string, symbologyId: string): boolean {
  const symbology = getSymbology(symbologyId)
  const expected = symbology?.options.parse ? expandCaretEscapes(input) : input
  if (expected === decoded) return true
  if (symbologyId === 'upce') {
    const upca = upceToUpca(expected)
    const read = digits(decoded)
    if (upca && (read === upca || read === `0${upca}`)) return true
  }
  // Code 39 readers may switch to Full ASCII mode, where "+A" reads as "a".
  const caseInsensitive = symbology?.decoderFormat === 'Code39'
  const a = caseInsensitive ? alnum(expected).toUpperCase() : alnum(expected)
  const b = caseInsensitive ? alnum(decoded).toUpperCase() : alnum(decoded)
  if (a !== '' && a === b) return true
  if (/^\d+$/.test(a) && /^\d+$/.test(b) && Number(a) === Number(b)) return true
  if (Math.min(a.length, b.length) < 6) return false
  if (a.includes(b) || b.includes(a)) return true
  // Check characters inserted inside the data (e.g. Codabar's before the stop character).
  return Math.abs(a.length - b.length) <= 2 && (isSubsequence(a, b) || isSubsequence(b, a))
}

export type ReadBack =
  | { status: 'match'; decoded: string }
  | { status: 'different'; decoded: string }
  | { status: 'unreadable' }
  | { status: 'unsupported' }

export function verifyReadBack(input: string, symbologyId: string, results: DecodedCode[]): ReadBack {
  if (!getSymbology(symbologyId)?.decoderFormat) return { status: 'unsupported' }
  if (results.length === 0) return { status: 'unreadable' }
  const hit = results.find((r) => sameContent(input, r.text, symbologyId))
  return hit ? { status: 'match', decoded: hit.text } : { status: 'different', decoded: results[0]!.text }
}
