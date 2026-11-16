/** Draws codes with bwip-js as SVG (vector) or onto a canvas (PNG), with colors, quiet zone and an optional logo. */

import { toCanvas, toSVG, type RenderOptions } from 'bwip-js/browser'
import { getSymbology, type EccLevel, type Symbology } from './symbologies.ts'

export interface LogoSpec {
  /** A `data:image/…;base64,…` URL (already re-encoded by the app). */
  dataUrl: string
  /** Logo width as a fraction of the symbol width (clamped to 0.1–0.3). */
  size: number
}

export interface RenderSpec {
  symbology: string
  text: string
  /** 6-digit hex without `#`. */
  foreground: string
  background: string
  transparent: boolean
  /** Pixels per bwip-js unit (integer, keeps modules crisp). */
  scale: number
  /** Quiet zone in modules. */
  margin: number
  eclevel: EccLevel
  showText: boolean
  logo?: LogoSpec
}

const SAFE_IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/

/** Options that the user controls, so the symbol list's sample defaults must not override them. */
const USER_CONTROLLED = new Set(['includetext', 'includecheckintext'])
/** MaxiCode mode 2/3 is only for structured carrier messages (`[)>…`); plain text uses the default mode. */
function skipSampleOption(symbology: string, key: string, text: string): boolean {
  return symbology === 'maxicode' && key === 'mode' && !text.startsWith('[)>')
}

function requireSymbology(id: string): Symbology {
  const symbology = getSymbology(id)
  if (!symbology) throw new Error(`Unknown barcode type: ${id}`)
  return symbology
}

export function defaultSpec(symbology: string, text?: string): RenderSpec {
  const s = requireSymbology(symbology)
  return {
    symbology,
    text: text ?? s.sample,
    foreground: '000000',
    background: 'FFFFFF',
    transparent: false,
    scale: 4,
    margin: s.matrix ? 4 : 10,
    eclevel: 'M',
    showText: s.showsText,
  }
}

/** bwip-js options; symbology-specific keys (eclevel, columns, …) are not in its typings. */
export type BwipOptions = RenderOptions & Record<string, unknown>

export function toBwipOptions(spec: RenderSpec): BwipOptions {
  const s = requireSymbology(spec.symbology)
  const options: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(s.options)) {
    if (USER_CONTROLLED.has(key) || skipSampleOption(s.id, key, spec.text)) continue
    if (key === 'eclevel' && s.eccLevels) continue
    options[key] = typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value
  }
  if (spec.showText) {
    options.includetext = true
    if (s.options.includecheckintext) options.includecheckintext = true
  }
  if (s.eccLevels) {
    options.eclevel = spec.logo && s.logo ? 'H' : s.eccLevels.includes(spec.eclevel) ? spec.eclevel : 'M'
  }
  return {
    ...options,
    bcid: s.id,
    text: spec.text,
    scale: Math.max(1, Math.round(spec.scale)),
    padding: Math.max(0, Math.round(spec.margin)) * (s.matrix ? 2 : 1),
    barcolor: spec.foreground,
    textcolor: spec.foreground,
    ...(spec.transparent ? {} : { backgroundcolor: spec.background }),
  } as BwipOptions
}

/** Turns bwip-js errors such as `bwipp.ean13badLength#6878: EAN-13 must be …` into plain sentences. */
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (!message) return 'Something went wrong. Please try again.'
  if (/text not specified/i.test(message)) return 'Enter a value to encode.'
  const cleaned = message.replace(/^bwipp\.[A-Za-z0-9]+#\d+:\s*/, '').replace(/^bwip-js:\s*/, '')
  if (/too long/i.test(cleaned)) {
    return 'The data is too long for this barcode type. Shorten it or choose a larger 2D code such as QR Code.'
  }
  return cleaned
}

export function svgSize(svg: string): { width: number; height: number } {
  const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  if (!viewBox) return { width: 0, height: 0 }
  return { width: Number(viewBox[1]), height: Number(viewBox[2]) }
}

function assertSafeLogo(logo: LogoSpec): void {
  if (!SAFE_IMAGE_DATA_URL.test(logo.dataUrl)) throw new Error('The logo must be a PNG, JPEG, WebP or GIF image.')
}

function logoBox(width: number, height: number, logo: LogoSpec) {
  const ratio = Math.min(0.3, Math.max(0.1, logo.size))
  const side = Math.round(Math.min(width, height) * ratio)
  const pad = Math.max(2, Math.round(side * 0.1))
  const x = Math.round((width - side) / 2)
  const y = Math.round((height - side) / 2)
  return { side, pad, x, y, radius: Math.round(side * 0.12) }
}

export function renderSvg(spec: RenderSpec): string {
  if (spec.logo) assertSafeLogo(spec.logo)
  let svg: string
  try {
    svg = toSVG(toBwipOptions(spec))
  } catch (error) {
    throw new Error(friendlyError(error))
  }
  const { width, height } = svgSize(svg)
  svg = svg.replace('<svg ', `<svg width="${width}" height="${height}" shape-rendering="crispEdges" `)
  if (spec.logo) {
    const { side, pad, x, y, radius } = logoBox(width, height, spec.logo)
    const plate = spec.transparent ? 'FFFFFF' : spec.background
    const overlay =
      `<rect x="${x - pad}" y="${y - pad}" width="${side + pad * 2}" height="${side + pad * 2}" rx="${radius}" fill="#${plate}"/>` +
      `<image x="${x}" y="${y}" width="${side}" height="${side}" preserveAspectRatio="xMidYMid meet" href="${spec.logo.dataUrl}"/>`
    svg = svg.replace(/<\/svg>\s*$/, `${overlay}</svg>`)
  }
  return svg
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The logo image could not be loaded.'))
    image.src = src
  })
}

/** Draws onto a canvas (for PNG export, copy and the read-back check). */
export async function renderCanvas(spec: RenderSpec, canvas: HTMLCanvasElement = document.createElement('canvas')) {
  if (spec.logo) assertSafeLogo(spec.logo)
  try {
    toCanvas(canvas, toBwipOptions(spec))
  } catch (error) {
    throw new Error(friendlyError(error))
  }
  if (spec.logo) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available in this browser.')
    const { side, pad, x, y, radius } = logoBox(canvas.width, canvas.height, spec.logo)
    const image = await loadImage(spec.logo.dataUrl)
    context.fillStyle = `#${spec.transparent ? 'FFFFFF' : spec.background}`
    context.beginPath()
    context.roundRect(x - pad, y - pad, side + pad * 2, side + pad * 2, radius)
    context.fill()
    const fit = Math.min(side / image.width, side / image.height)
    const w = image.width * fit
    const h = image.height * fit
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, x + (side - w) / 2, y + (side - h) / 2, w, h)
  }
  return canvas
}

export async function renderPng(spec: RenderSpec): Promise<Blob> {
  const canvas = await renderCanvas(spec)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the PNG image.'))), 'image/png')
  })
}
