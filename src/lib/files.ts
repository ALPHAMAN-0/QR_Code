/** Browser helpers for saving, copying, sharing and printing. All local; nothing is uploaded. */

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function downloadText(text: string, fileName: string, type: string): void {
  downloadBlob(new Blob([text], { type }), fileName)
}

export function canCopyImage(): boolean {
  return typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'
}

export async function copyImage(png: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function canShareFiles(file?: File): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false
  return navigator.canShare({ files: [file ?? new File([''], 'x.png', { type: 'image/png' })] })
}

export async function shareFile(file: File, title: string): Promise<'shared' | 'cancelled'> {
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    throw error
  }
}

/** Prints just the code (the print stylesheet hides everything else). */
export function printPage(): void {
  window.print()
}

/** A short, safe file name from any text. */
export function fileStem(text: string, fallback = 'code'): string {
  const stem = text
    .toLowerCase()
    .replace(/^[a-z]+:\/*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return stem || fallback
}

/**
 * Re-encodes an uploaded logo as a PNG data URL no larger than 512 px.
 * Re-encoding drops metadata and anything that is not plain pixels (e.g. scripts inside SVG files).
 */
export async function logoFromFile(file: File, maxSide = 512): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file for the logo.')
  if (file.size > 10 * 1024 * 1024) throw new Error('The logo image is larger than 10 MB.')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('That image could not be opened.')
  })
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available in this browser.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/png')
}
