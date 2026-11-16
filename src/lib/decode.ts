/** Reads codes from images with zxing-wasm (WebAssembly). Pure comparison helpers live in readback.ts. */

import { prepareZXingModule, readBarcodes, type ZXingModuleOverrides } from 'zxing-wasm/reader'
import { formatLabel, type DecodedCode } from './readback.ts'

export * from './readback.ts'

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
