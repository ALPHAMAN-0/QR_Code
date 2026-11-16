// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubBrowserApis } from '../../test/dom.ts'
import { ScanPanel } from './ScanPanel.tsx'

const decodeImage = vi.fn()
vi.mock('../../lib/scanner.ts', () => ({
  decodeImage: (...args: unknown[]) => decodeImage(...args),
  pixelsFrom: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
}))

const QR = { format: 'QRCode', label: 'QR Code', text: 'https://example.com' }

function mockCamera(getUserMedia: () => Promise<unknown>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia, enumerateDevices: async () => [{ kind: 'videoinput' }, { kind: 'videoinput' }] },
  })
}

beforeEach(() => {
  stubBrowserApis()
  decodeImage.mockReset()
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 10, height: 10, close: () => undefined })))
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const setup = () => {
  const onScanned = vi.fn()
  const notify = vi.fn()
  render(<ScanPanel onScanned={onScanned} notify={notify} />)
  return { onScanned, notify, user: userEvent.setup() }
}

describe('scanning an image', () => {
  it('reads an uploaded image and records the result with its format', async () => {
    decodeImage.mockResolvedValue([{ format: 'EAN13', label: 'EAN-13', text: '9520123456788' }])
    const { user, onScanned } = setup()
    await user.upload(screen.getByLabelText(/Choose image/), new File(['x'], 'code.png', { type: 'image/png' }))
    expect(await screen.findByText('1 code found')).toBeVisible()
    expect(screen.getByText('9520123456788')).toBeVisible()
    expect(onScanned).toHaveBeenCalledWith({ kind: 'scanned', format: 'EAN-13', symbology: 'ean13', text: '9520123456788' })
    expect(screen.getByRole('img', { name: 'Selected file' })).toBeVisible()
  })

  it('says when no code is found', async () => {
    decodeImage.mockResolvedValue([])
    const { user } = setup()
    await user.upload(screen.getByLabelText(/Choose image/), new File(['x'], 'blank.png', { type: 'image/png' }))
    expect(await screen.findByText(/No code found in that image/)).toBeVisible()
  })

  it('rejects files that are not images', async () => {
    setup()
    fireEvent.drop(screen.getByText(/Drop a file here/).closest('.dropzone')!, {
      dataTransfer: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] },
    })
    expect(await screen.findByText(/That file is not an image/)).toBeVisible()
  })

  it('reads a pasted screenshot', async () => {
    decodeImage.mockResolvedValue([QR])
    setup()
    const file = new File(['x'], 'shot.png', { type: 'image/png' })
    const paste = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(paste, 'clipboardData', { value: { files: [file] } })
    await act(async () => {
      document.dispatchEvent(paste)
    })
    expect(await screen.findByRole('link', { name: /Open link/ })).toHaveAttribute('href', 'https://example.com')
  })

  it('shows an error when the image cannot be decoded', async () => {
    decodeImage.mockRejectedValue(new Error('boom'))
    const { user } = setup()
    await user.upload(screen.getByLabelText(/Choose image/), new File(['x'], 'bad.png', { type: 'image/png' }))
    expect(await screen.findByText(/could not be read/)).toBeVisible()
  })

  it('highlights the drop zone while dragging', () => {
    setup()
    const zone = screen.getByText(/Drop a file here/).closest('.dropzone')!
    fireEvent.dragOver(zone)
    expect(zone).toHaveClass('is-over')
    fireEvent.dragLeave(zone)
    expect(zone).not.toHaveClass('is-over')
  })
})

describe('camera', () => {
  it('explains a blocked camera', async () => {
    mockCamera(() => Promise.reject(new DOMException('no', 'NotAllowedError')))
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Start camera/ }))
    expect(await screen.findByText(/Camera permission is blocked/)).toBeVisible()
  })

  it('explains a missing camera', async () => {
    mockCamera(() => Promise.reject(new DOMException('no', 'NotFoundError')))
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Start camera/ }))
    expect(await screen.findByText(/No camera found/)).toBeVisible()
  })

  it('scans frames, stops the camera on a hit and shows the result', async () => {
    const stopTrack = vi.fn()
    mockCamera(async () => ({ getTracks: () => [{ stop: stopTrack }] }))
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4)
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640)
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480)
    decodeImage.mockResolvedValueOnce([]).mockResolvedValue([QR])
    const { user, onScanned } = setup()
    await user.click(screen.getByRole('button', { name: /Start camera/ }))
    expect(await screen.findByRole('button', { name: /Switch camera/ })).toBeVisible()
    expect(await screen.findByText('1 code found', {}, { timeout: 3000 })).toBeVisible()
    expect(stopTrack).toHaveBeenCalled()
    expect(onScanned).toHaveBeenCalledWith(expect.objectContaining({ kind: 'scanned', symbology: 'qrcode', text: QR.text }))
    expect(screen.getByRole('button', { name: /Scan again/ })).toBeVisible()
  })

  it('can be stopped by the user', async () => {
    const stopTrack = vi.fn()
    mockCamera(async () => ({ getTracks: () => [{ stop: stopTrack }] }))
    const { user, notify } = setup()
    await user.click(screen.getByRole('button', { name: /Start camera/ }))
    await user.click(await screen.findByRole('button', { name: /Stop/ }))
    expect(stopTrack).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Camera stopped')
  })
})
