import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { configureDecoder } from '../lib/decode.ts'

const require = createRequire(import.meta.url)

/** Loads the reader's WebAssembly from node_modules so tests run without a network or dev server. */
export function useLocalDecoder(): void {
  const wasmPath = require.resolve('zxing-wasm/reader/zxing_reader.wasm')
  const bytes = readFileSync(wasmPath)
  configureDecoder({
    wasmBinary: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  })
}
