import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon.tsx'
import { scanWarnings } from '../../lib/contrast.ts'
import type { ReadBack } from '../../lib/readback.ts'
import { verifyReadBack } from '../../lib/readback.ts'
import { canCopyImage, canShareFiles, copyImage, copyText, downloadBlob, fileStem, printPage, shareFile } from '../../lib/files.ts'
import type { NewHistoryEntry } from '../../lib/history.ts'
import { parseContent } from '../../lib/parse.ts'
import { buildPayload, type ContentType } from '../../lib/payloads.ts'
import { renderCanvas, renderPng, renderSvg, svgSize, type RenderSpec } from '../../lib/render.ts'
import { CATEGORIES, getSymbology, POPULAR_IDS, SYMBOLOGIES } from '../../lib/symbologies.ts'
import { ContentFields } from './ContentFields.tsx'
import { CONTENT_TYPES, EMPTY_CONTENT, isBlank, type ContentValues } from './contentState.ts'
import { DEFAULT_STYLE, StyleFields, type StyleState } from './StyleFields.tsx'

export interface CreateRequest {
  symbology: string
  text: string
  nonce: number
}

interface Props {
  request?: CreateRequest
  onCreated: (entry: NewHistoryEntry) => void
  notify: (message: string) => void
}

const QUICK_FORMATS = POPULAR_IDS.slice(0, 8)

type Rendered =
  | { ok: true; spec: RenderSpec; svg: string; width: number; height: number; payload: string }
  | { ok: false; error: string }

type CheckState = ReadBack | { status: 'checking' } | null

export function CreatePanel({ request, onCreated, notify }: Props) {
  const ids = { format: useId(), value: useId(), valueHint: useId(), error: useId() }
  const [symbologyId, setSymbologyId] = useState('qrcode')
  const [contentType, setContentType] = useState<ContentType>('url')
  const [content, setContent] = useState<ContentValues>(EMPTY_CONTENT)
  const [rawValues, setRawValues] = useState<Record<string, string>>({})
  const [style, setStyle] = useState<StyleState>(DEFAULT_STYLE)
  const [checked, setChecked] = useState<{ for: Rendered; result: ReadBack | null } | null>(null)
  const [busy, setBusy] = useState(false)

  const symbology = getSymbology(symbologyId) ?? getSymbology('qrcode')!
  const defaultMargin = symbology.matrix ? 4 : 10

  // Open an entry from History in the editor (state adjusted during render when the request changes).
  const [handledNonce, setHandledNonce] = useState(request?.nonce)
  if (request && request.nonce !== handledNonce) {
    setHandledNonce(request.nonce)
    const target = getSymbology(request.symbology) ?? getSymbology('qrcode')!
    setSymbologyId(target.id)
    setStyle((s) => ({ ...s, margin: null, showText: null }))
    const wifi = /^WIFI:/i.test(request.text) ? parseContent(request.text) : null
    if (target.freeText && wifi?.kind === 'wifi') {
      // History never keeps Wi-Fi passwords, so reopen the form for the user to type it again.
      setContentType('wifi')
      setContent((c) => ({ ...c, wifi: { type: 'wifi', ssid: wifi.ssid, password: wifi.password, security: wifi.security, hidden: wifi.hidden } }))
    } else if (target.freeText) {
      setContentType('text')
      setContent((c) => ({ ...c, text: { type: 'text', text: request.text } }))
    } else {
      setRawValues((v) => ({ ...v, [target.id]: request.text }))
    }
  }

  const input = useMemo((): { payload: string | null; error: string | null } => {
    if (symbology.freeText) {
      const value = content[contentType]
      if (isBlank(value)) return { payload: null, error: null }
      try {
        return { payload: buildPayload(value), error: null }
      } catch (error) {
        return { payload: null, error: error instanceof Error ? error.message : String(error) }
      }
    }
    const value = rawValues[symbology.id] ?? symbology.sample
    return { payload: value === '' ? null : value, error: null }
  }, [symbology, content, contentType, rawValues])

  const payload = useDeferredValue(input.payload)
  // Dragging a color picker or slider fires many changes; let React skip stale renders.
  const deferredStyle = useDeferredValue(style)

  const rendered = useMemo((): Rendered | null => {
    if (payload === null) return null
    const base: RenderSpec = {
      symbology: symbology.id,
      text: payload,
      foreground: deferredStyle.foreground,
      background: deferredStyle.background,
      transparent: deferredStyle.transparent,
      scale: 1,
      margin: deferredStyle.margin ?? defaultMargin,
      eclevel: deferredStyle.eclevel,
      showText: deferredStyle.showText ?? symbology.showsText,
      logo: symbology.logo && deferredStyle.logo ? deferredStyle.logo : undefined,
    }
    try {
      const natural = svgSize(renderSvg({ ...base, logo: undefined }))
      const scale = Math.max(1, Math.floor(deferredStyle.size / Math.max(natural.width, natural.height, 1)))
      const spec = { ...base, scale }
      const svg = renderSvg(spec)
      const { width, height } = svgSize(svg)
      return { ok: true, spec, svg, width, height, payload }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }, [payload, symbology, deferredStyle, defaultMargin])

  // Read the finished code back with the scanner, so the user knows it works before printing it.
  const readable = Boolean(symbology.decoderFormat)
  useEffect(() => {
    if (!rendered?.ok || !readable) return
    let cancelled = false
    const timer = setTimeout(async () => {
      let result: ReadBack | null = null
      try {
        const [{ decodeImage, pixelsFrom }, canvas] = await Promise.all([import('../../lib/scanner.ts'), renderCanvas(rendered.spec)])
        const results = await decodeImage(pixelsFrom(canvas, canvas.width, canvas.height, 1600))
        result = verifyReadBack(rendered.payload, symbology.id, results)
      } catch {
        result = null // the check is a bonus; never block the user on it
      }
      if (!cancelled) setChecked({ for: rendered, result })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [rendered, readable, symbology.id])

  const check: CheckState = !rendered?.ok
    ? null
    : !readable
      ? { status: 'unsupported' }
      : checked?.for === rendered
        ? checked.result
        : { status: 'checking' }

  const imageSrc = rendered?.ok ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rendered.svg)}` : null
  const warnings = rendered?.ok ? scanWarnings(style.foreground, style.background, style.transparent) : []
  const errorMessage = input.error ?? (rendered && !rendered.ok ? rendered.error : null)

  const record = () => {
    if (rendered?.ok) onCreated({ kind: 'created', format: symbology.name, symbology: symbology.id, text: rendered.payload })
  }
  const baseName = rendered?.ok ? `${fileStem(rendered.payload)}-${symbology.id}` : 'code'

  const run = async (action: () => Promise<string | void>) => {
    setBusy(true)
    try {
      const message = await action()
      if (message) notify(message)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'That did not work. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const downloadPng = () =>
    run(async () => {
      if (!rendered?.ok) return
      downloadBlob(await renderPng(rendered.spec), `${baseName}.png`)
      record()
      return 'PNG saved'
    })
  const downloadSvg = () =>
    run(async () => {
      if (!rendered?.ok) return
      downloadBlob(new Blob([rendered.svg], { type: 'image/svg+xml' }), `${baseName}.svg`)
      record()
      return 'SVG saved'
    })
  const copy = () =>
    run(async () => {
      if (!rendered?.ok) return
      await copyImage(await renderPng(rendered.spec))
      record()
      return 'Image copied'
    })
  const share = () =>
    run(async () => {
      if (!rendered?.ok) return
      const file = new File([await renderPng(rendered.spec)], `${baseName}.png`, { type: 'image/png' })
      if ((await shareFile(file, symbology.name)) === 'shared') record()
    })
  const copyData = () =>
    run(async () => {
      if (!rendered?.ok) return
      await copyText(rendered.payload)
      return 'Encoded text copied'
    })

  const selectFormat = (id: string) => {
    setSymbologyId(id)
    setStyle((s) => ({ ...s, margin: null, showText: null }))
  }

  return (
    <section aria-labelledby="create-title">
      <div className="wrap">
      <div className="panel-head">
        <h1 id="create-title">Make a QR code or barcode</h1>
        <p>{SYMBOLOGIES.length} formats. Everything is drawn on your device.</p>
      </div>

      <div className="create">
        <div className="card stack create-format">
            <h2 className="section-title">1 · Format</h2>
            <fieldset className="segments">
              <legend className="sr-only">Popular formats</legend>
              {QUICK_FORMATS.map((id) => (
                <label key={id} className="segment">
                  <input type="radio" name="quick-format" value={id} checked={symbologyId === id} onChange={() => selectFormat(id)} />
                  <span>{getSymbology(id)?.name}</span>
                </label>
              ))}
            </fieldset>
            <div className="field">
              <label htmlFor={ids.format}>All formats</label>
              <select id={ids.format} className="select" value={symbologyId} onChange={(e) => selectFormat(e.target.value)}>
                {CATEGORIES.map((category) => (
                  <optgroup key={category.id} label={category.label}>
                    {SYMBOLOGIES.filter((s) => s.category === category.id).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="card stack create-content">
            <h2 className="section-title">2 · Content</h2>
            {symbology.freeText ? (
              <>
                <fieldset className="segments">
                  <legend className="sr-only">Type of content</legend>
                  {CONTENT_TYPES.map(({ type, label, icon }) => (
                    <label key={type} className="segment">
                      <input type="radio" name="content-type" value={type} checked={contentType === type} onChange={() => setContentType(type)} />
                      <span>
                        <Icon name={icon} />
                        {label}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <ContentFields value={content[contentType]} onChange={(next) => setContent((c) => ({ ...c, [next.type]: next }))} />
              </>
            ) : (
              <div className="field">
                <label htmlFor={ids.value}>Value to encode</label>
                <input
                  id={ids.value}
                  className="input mono"
                  value={rawValues[symbology.id] ?? symbology.sample}
                  onChange={(e) => setRawValues((v) => ({ ...v, [symbology.id]: e.target.value }))}
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={`${ids.valueHint}${errorMessage ? ` ${ids.error}` : ''}`}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p className="hint" id={ids.valueHint}>
                  Example: <span className="mono">{symbology.sample.length > 60 ? `${symbology.sample.slice(0, 60)}…` : symbology.sample}</span>{' '}
                  <button type="button" className="btn btn-quiet" onClick={() => setRawValues((v) => ({ ...v, [symbology.id]: symbology.sample }))}>
                    Use example
                  </button>
                </p>
              </div>
            )}
            <div aria-live="polite">
              {errorMessage && (
                <p className="status status-bad" id={ids.error}>
                  <Icon name="alert" /> {errorMessage}
                </p>
              )}
            </div>
          </div>

          <details className="card disclosure create-style" open>
            <summary>
              <h2 className="section-title flush">
                3 · Style and size
              </h2>
            </summary>
            <div className="stack disclosure-body">
              <StyleFields symbology={symbology} style={style} defaultMargin={defaultMargin} onChange={setStyle} />
            </div>
          </details>

        <div className="create-preview">
          <div className="stage marks">
            <span className="marks-b" aria-hidden="true" />
            {imageSrc && rendered?.ok ? (
              <img
                className={`stage-img${style.transparent ? ' is-transparent' : ''}`}
                src={imageSrc}
                width={rendered.width}
                height={rendered.height}
                alt={`${symbology.name} for: ${rendered.payload.length > 120 ? `${rendered.payload.slice(0, 120)}…` : rendered.payload}`}
              />
            ) : (
              <p className="stage-empty">{errorMessage ? 'Fix the content to see your code.' : 'Your code appears here as you type.'}</p>
            )}
          </div>

          {rendered?.ok && (
            <>
              <div className="readout">
                <span>{symbology.name}</span>
                <span>
                  {rendered.width} × {rendered.height} px
                </span>
                <span>{rendered.payload.length} chars</span>
              </div>
              {check?.status === 'checking' && <CheckLine check={check} />}
              <div aria-live="polite" aria-atomic="true">
                {check && check.status !== 'checking' && <CheckLine check={check} />}
              </div>
              {warnings.map((w) => (
                <p key={w.id} className="status status-warn">
                  <Icon name="alert" /> {w.message}
                </p>
              ))}
              <div className="actions">
                <button type="button" className="btn btn-primary" onClick={downloadPng} disabled={busy}>
                  <Icon name="download" /> Download PNG
                </button>
                <button type="button" className="btn" onClick={downloadSvg} disabled={busy}>
                  <Icon name="download" /> SVG
                </button>
                {canCopyImage() && (
                  <button type="button" className="btn" onClick={copy} disabled={busy}>
                    <Icon name="copy" /> Copy image
                  </button>
                )}
                {canShareFiles() && (
                  <button type="button" className="btn" onClick={share} disabled={busy}>
                    <Icon name="share" /> Share
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    record()
                    printPage()
                  }}
                >
                  <Icon name="print" /> Print
                </button>
                <button type="button" className="btn" onClick={copyData} disabled={busy}>
                  <Icon name="text" /> Copy text
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </section>
  )
}

function CheckLine({ check }: { check: CheckState }) {
  if (!check) return null
  switch (check.status) {
    case 'checking':
      return (
        <p className="status status-info">
          <Icon name="scan" /> Checking that it scans…
        </p>
      )
    case 'match':
      return (
        <p className="status status-ok">
          <Icon name="check" /> Scans correctly: our reader reads it back exactly.
        </p>
      )
    case 'different':
      return (
        <p className="status status-warn">
          <Icon name="alert" /> Scans, but reads back as “{check.decoded.length > 80 ? `${check.decoded.slice(0, 80)}…` : check.decoded}”.
        </p>
      )
    case 'unreadable':
      return (
        <p className="status status-bad">
          <Icon name="alert" /> Our reader can’t read this. Raise the contrast, widen the quiet zone or shrink the logo.
        </p>
      )
    case 'unsupported':
      return (
        <p className="status status-info">
          <Icon name="info" /> Self-check isn’t available for this format; it is drawn to the official specification.
        </p>
      )
  }
}
