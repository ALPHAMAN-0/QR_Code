// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canCopyImage, canShareFiles, copyText, downloadBlob, downloadText, fileStem, logoFromFile, shareFile } from './files.ts'

afterEach(() => vi.unstubAllGlobals())

describe('fileStem', () => {
  it.each([
    ['https://example.com/a?b', 'example-com-a-b'],
    ['WIFI:T:WPA;S:Home;;', 't-wpa-s-home'],
    ['日本', 'code'],
  ])('%s -> %s', (input, stem) => {
    expect(fileStem(input)).toBe(stem)
  })
})

describe('downloads', () => {
  it('clicks a temporary link with the file name and cleans up', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    downloadText('hi', 'a.txt', 'text/plain')
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a[download]')).toBeNull()
    downloadBlob(new Blob(['x']), 'b.bin')
    expect(click).toHaveBeenCalledTimes(2)
  })
})

describe('feature detection', () => {
  it('reports missing clipboard image and share support', () => {
    expect(canCopyImage()).toBe(false)
    expect(canShareFiles()).toBe(false)
  })

  it('detects file sharing when the browser supports it', () => {
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn(), canShare: () => true })
    expect(canShareFiles()).toBe(true)
  })

  it('treats a cancelled share as cancelled, not an error', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')) })
    await expect(shareFile(new File(['x'], 'a.png'), 'A')).resolves.toBe('cancelled')
  })

  it('copies text through the clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await copyText('hello')
    expect(writeText).toHaveBeenCalledWith('hello')
  })
})

describe('logoFromFile', () => {
  it('refuses files that are not images', async () => {
    await expect(logoFromFile(new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow(/image file/)
  })

  it('refuses very large images', async () => {
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    await expect(logoFromFile(big)).rejects.toThrow(/10 MB/)
  })

  it('re-encodes images as PNG within the size limit', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 2000, height: 1000, close: vi.fn() })))
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, imageSmoothingQuality: 'low' } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAA')
    await expect(logoFromFile(new File(['x'], 'a.png', { type: 'image/png' }))).resolves.toBe('data:image/png;base64,AAA')
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 512, 256)
  })
})
