/**
 * Browser entry for the barcode reader. Loaded lazily (it carries ~1 MB of WebAssembly) and points the
 * reader at the .wasm file bundled with the app, so scanning works offline and never touches a CDN.
 */

import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { configureDecoder, decodeImage } from './decode.ts'

configureDecoder({
  locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
})

export { decodeImage }

/** Reads codes from a canvas region, compositing transparency onto white first. */
export function pixelsFrom(source: CanvasImageSource, width: number, height: number, maxSide = 1024) {
  const ratio = Math.min(1, maxSide / Math.max(width, height))
  const w = Math.max(1, Math.round(width * ratio))
  const h = Math.max(1, Math.round(height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is not available in this browser.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, w, h)
  context.drawImage(source, 0, 0, w, h)
  return context.getImageData(0, 0, w, h)
}
