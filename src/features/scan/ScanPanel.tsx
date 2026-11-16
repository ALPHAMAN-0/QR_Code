import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon.tsx'
import { symbologyForFormat, type DecodedCode } from '../../lib/readback.ts'
import type { NewHistoryEntry } from '../../lib/history.ts'
import { ResultCard } from './ResultCard.tsx'

interface Props {
  onScanned: (entry: NewHistoryEntry) => void
  notify: (message: string) => void
}

type CameraState = 'idle' | 'starting' | 'running' | 'found' | 'denied' | 'unavailable' | 'error'

const loadScanner = () => import('../../lib/scanner.ts')

export function ScanPanel({ onScanned, notify }: Props) {
  const [results, setResults] = useState<DecodedCode[] | null>(null)
  const [source, setSource] = useState<'camera' | 'image' | null>(null)

  const report = useCallback(
    (codes: DecodedCode[], from: 'camera' | 'image') => {
      setResults(codes)
      setSource(from)
      for (const code of codes) {
        onScanned({ kind: 'scanned', format: code.label, symbology: symbologyForFormat(code.format), text: code.text })
      }
      if (codes.length) navigator.vibrate?.(40)
    },
    [onScanned],
  )

  return (
    <section aria-labelledby="scan-title">
      <div className="panel-head">
        <h1 id="scan-title">Scan any code</h1>
        <p>QR, Data Matrix, Aztec, PDF417, MaxiCode, EAN/UPC, Code 128 and every other common format.</p>
      </div>
      <div className="scan">
        <div className="stack">
          <Camera onFound={(codes) => report(codes, 'camera')} notify={notify} />
          <ImageInput onDecoded={(codes) => report(codes, 'image')} />
        </div>
        <div className="stack" aria-live="polite">
          {results === null ? (
            <p className="empty">Results show up here. Nothing is uploaded: images are read on this device.</p>
          ) : results.length === 0 ? (
            <p className="status status-warn">
              <Icon name="alert" /> No code found in that {source === 'image' ? 'image' : 'frame'}. Try a sharper, closer or better-lit picture.
            </p>
          ) : (
            <>
              <h2 className="section-title">
                {results.length === 1 ? '1 code found' : `${results.length} codes found`}
              </h2>
              {results.map((code, i) => (
                <ResultCard key={`${code.format}-${code.text}-${i}`} code={code} notify={notify} />
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function Camera({ onFound, notify }: { onFound: (codes: DecodedCode[]) => void; notify: (m: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<CameraState>('idle')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [canFlip, setCanFlip] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const start = useCallback(
    async (mode: 'environment' | 'user') => {
      stop()
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable')
        return
      }
      setState('starting')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        setCanFlip(devices.filter((d) => d.kind === 'videoinput').length > 1)
        setState('running')
      } catch (error) {
        const name = error instanceof DOMException ? error.name : ''
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'error')
      }
    },
    [stop],
  )

  // Scan frames while the camera runs; pause after a hit so the result stays readable.
  useEffect(() => {
    if (state !== 'running') return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      const video = videoRef.current
      if (cancelled || !video) return
      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const { decodeImage, pixelsFrom } = await loadScanner()
          const codes = await decodeImage(pixelsFrom(video, video.videoWidth, video.videoHeight, 960), { fast: true })
          if (!cancelled && codes.length > 0) {
            setState('found')
            onFound(codes)
            return
          }
        } catch {
          // A dropped frame is not worth surfacing; keep scanning.
        }
      }
      if (!cancelled) timer = setTimeout(tick, 150)
    }
    timer = setTimeout(tick, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [state, onFound])

  // Release the camera when the tab is hidden or the panel closes.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && streamRef.current) {
        stop()
        setState('idle')
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      stop()
    }
  }, [stop])

  useEffect(() => {
    if (state === 'found') stop()
  }, [state, stop])

  const live = state === 'running' || state === 'starting'

  return (
    <div className="viewfinder marks">
      <span className="marks-b" aria-hidden="true" />
      <video ref={videoRef} muted playsInline aria-label="Camera preview" hidden={!live} />
      {state === 'running' && <div className="scanline" aria-hidden="true" />}
      {!live && (
        <div className="viewfinder-idle">
          <Icon name="camera" className="big" />
          <p>
            {state === 'denied'
              ? 'Camera permission is blocked. Allow it in your browser’s site settings, or scan an image instead.'
              : state === 'unavailable'
                ? 'No camera found. Scan an image instead.'
                : state === 'error'
                  ? 'The camera could not start. It may be in use by another app.'
                  : state === 'found'
                    ? 'Got it. Point at another code to scan again.'
                    : 'Point your camera at a QR code or barcode.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void start(facing)}>
            <Icon name="camera" /> {state === 'found' ? 'Scan again' : 'Start camera'}
          </button>
        </div>
      )}
      {live && (
        <div className="camera-bar">
          {canFlip && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                const next = facing === 'environment' ? 'user' : 'environment'
                setFacing(next)
                void start(next)
              }}
            >
              <Icon name="flip" /> Switch camera
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => {
              stop()
              setState('idle')
              notify('Camera stopped')
            }}
          >
            <Icon name="stop" /> Stop
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {state === 'running' ? 'Camera on. Scanning.' : state === 'found' ? 'Code found.' : ''}
      </p>
    </div>
  )
}

function ImageInput({ onDecoded }: { onDecoded: (codes: DecodedCode[]) => void }) {
  const [over, setOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const inputId = 'scan-file'

  const readFile = useCallback(
    async (file: File | undefined) => {
      setError('')
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setError('That file is not an image. Use PNG, JPEG, WebP, GIF or a screenshot.')
        return
      }
      setWorking(true)
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(file)
      })
      try {
        const { decodeImage, pixelsFrom } = await loadScanner()
        const bitmap = await createImageBitmap(file)
        const codes = await decodeImage(pixelsFrom(bitmap, bitmap.width, bitmap.height, 2400))
        bitmap.close()
        onDecoded(codes)
      } catch {
        setError('That image could not be read. Try another file.')
      } finally {
        setWorking(false)
      }
    },
    [onDecoded],
  )

  // Paste a screenshot anywhere on the Scan screen.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
      if (file) {
        event.preventDefault()
        void readFile(file)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [readFile])

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const pasteFromClipboard = async () => {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) {
          const blob = await item.getType(type)
          await readFile(new File([blob], 'pasted', { type }))
          return
        }
      }
      setError('There is no image on the clipboard.')
    } catch {
      setError('The clipboard could not be read. Press Ctrl+V (⌘V on Mac) instead.')
    }
  }

  return (
    <div
      className={`dropzone${over ? ' is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        void readFile(Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/')) ?? e.dataTransfer.files[0])
      }}
    >
      {preview ? <img className="scanned-image" src={preview} alt="Selected file" /> : <Icon name="image" className="big" />}
      <p>
        <strong>Scan an image</strong>
        <br />
        <span className="hint">Drop a file here, choose one, or paste a screenshot.</span>
      </p>
      <div className="btn-row">
        <input
          id={inputId}
          className="sr-only file-proxy"
          type="file"
          accept="image/*"
          onChange={(e) => {
            void readFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <label className="btn" htmlFor={inputId}>
          <Icon name="upload" /> Choose image
        </label>
        {typeof navigator.clipboard?.read === 'function' && (
          <button type="button" className="btn" onClick={() => void pasteFromClipboard()}>
            <Icon name="paste" /> Paste image
          </button>
        )}
      </div>
      <div aria-live="polite">
        {working && <p className="hint">Reading the image…</p>}
        {error && (
          <p className="status status-bad">
            <Icon name="alert" /> {error}
          </p>
        )}
      </div>
    </div>
  )
}
