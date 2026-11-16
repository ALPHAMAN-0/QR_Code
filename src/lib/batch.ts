/** Many codes at once, packed into a ZIP on the device. */

import { zipSync } from 'fflate'

export const BATCH_LIMIT = 500

export function parseBatchLines(input: string, limit = BATCH_LIMIT): { values: string[]; truncated: boolean } {
  const all = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return { values: all.slice(0, limit), truncated: all.length > limit }
}

/** `001-example-com.png`: numbered, ASCII-only, no path separators. */
export function batchFileName(index: number, value: string, extension: string, total: number): string {
  const number = String(index + 1).padStart(String(total).length, '0')
  const slug =
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'code'
  return `${number}-${slug}.${extension}`
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

export function buildZip(files: ZipEntry[]): Uint8Array {
  // PNG/SVG are already compressed or tiny; level 6 keeps SVG small without slowing PNG much.
  return zipSync(Object.fromEntries(files.map((f) => [f.name, [f.data, { level: f.name.endsWith('.png') ? 0 : 6 }]])))
}

export interface BatchError {
  line: number
  value: string
  message: string
}

export async function generateBatch(
  values: string[],
  render: (value: string) => Promise<Uint8Array>,
  extension: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ files: ZipEntry[]; errors: BatchError[] }> {
  const files: ZipEntry[] = []
  const errors: BatchError[] = []
  for (const [index, value] of values.entries()) {
    try {
      files.push({ name: batchFileName(index, value, extension, values.length), data: await render(value) })
    } catch (error) {
      errors.push({ line: index + 1, value, message: error instanceof Error ? error.message : String(error) })
    }
    onProgress?.(index + 1, values.length)
  }
  return { files, errors }
}
