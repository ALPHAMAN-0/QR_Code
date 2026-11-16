import { useId, useState } from 'react'
import { Icon } from '../../components/Icon.tsx'
import { BATCH_LIMIT, buildZip, generateBatch, parseBatchLines, type BatchError } from '../../lib/batch.ts'
import { downloadBlob } from '../../lib/files.ts'
import { defaultSpec, renderPng, renderSvg } from '../../lib/render.ts'
import { CATEGORIES, getSymbology, SYMBOLOGIES } from '../../lib/symbologies.ts'

const SIZES = [256, 512, 1024, 2048]

export function BatchPanel({ notify }: { notify: (message: string) => void }) {
  const ids = { format: useId(), lines: useId(), linesHint: useId(), output: useId(), size: useId() }
  const [symbologyId, setSymbologyId] = useState('qrcode')
  const [text, setText] = useState('')
  const [output, setOutput] = useState<'png' | 'svg'>('png')
  const [size, setSize] = useState(1024)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [errors, setErrors] = useState<BatchError[]>([])
  const [summary, setSummary] = useState('')

  const symbology = getSymbology(symbologyId)!
  const { values, truncated } = parseBatchLines(text)
  const running = progress !== null && progress.done < progress.total

  const render = async (value: string): Promise<Uint8Array> => {
    const base = defaultSpec(symbologyId, value)
    const natural = renderSvg({ ...base, scale: 1 })
    const width = Number(/viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(natural)?.[1] ?? 100)
    const spec = { ...base, scale: Math.max(1, Math.floor(size / width)) }
    if (output === 'svg') return new TextEncoder().encode(renderSvg(spec))
    return new Uint8Array(await (await renderPng(spec)).arrayBuffer())
  }

  const start = async () => {
    setErrors([])
    setSummary('')
    setProgress({ done: 0, total: values.length })
    const result = await generateBatch(values, render, output, (done, total) => setProgress({ done, total }))
    setErrors(result.errors)
    if (result.files.length) {
      const zip = buildZip(result.files)
      downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `${symbologyId}-codes.zip`)
      notify(`ZIP saved with ${result.files.length} codes`)
    }
    setSummary(
      `${result.files.length} of ${values.length} made${result.errors.length ? `; ${result.errors.length} skipped (see below)` : ''}.`,
    )
  }

  return (
    <section aria-labelledby="batch-title">
      <div className="wrap">
      <div className="panel-head">
        <h1 id="batch-title">Make many codes at once</h1>
        <p>One value per line, up to {BATCH_LIMIT}. You get a ZIP of images.</p>
      </div>
      <div className="batch">
        <div className="card stack">
          <div className="field">
            <label htmlFor={ids.format}>Format</label>
            <select id={ids.format} className="select" value={symbologyId} onChange={(e) => setSymbologyId(e.target.value)}>
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
          <div className="field">
            <label htmlFor={ids.lines}>Values</label>
            <textarea
              id={ids.lines}
              className="textarea mono"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`${symbology.sample}\n…`}
              aria-describedby={ids.linesHint}
              spellCheck={false}
            />
            <p className="hint" id={ids.linesHint}>
              {values.length} value{values.length === 1 ? '' : 's'}
              {truncated ? `; only the first ${BATCH_LIMIT} will be used` : ''}. Example for {symbology.name}:{' '}
              <span className="mono">{symbology.sample.slice(0, 40)}</span>
            </p>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor={ids.output}>File type</label>
              <select id={ids.output} className="select" value={output} onChange={(e) => setOutput(e.target.value as 'png' | 'svg')}>
                <option value="png">PNG images</option>
                <option value="svg">SVG (vector)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={ids.size}>Size</label>
              <select id={ids.size} className="select" value={size} disabled={output === 'svg'} onChange={(e) => setSize(Number(e.target.value))}>
                {SIZES.map((px) => (
                  <option key={px} value={px}>
                    ≈{px} px
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="button" className="btn btn-primary" disabled={values.length === 0 || running} onClick={() => void start()}>
            <Icon name="download" /> {running ? 'Making codes…' : `Make ${values.length || ''} codes and download ZIP`}
          </button>
        </div>

        <div className="stack">
          {progress === null ? (
            <p className="empty">Paste a list of links, product numbers or IDs, and every code lands in one ZIP file.</p>
          ) : (
            <div className="card stack">
              <label className="field-label" htmlFor="batch-progress">
                {running ? `Making code ${progress.done + 1} of ${progress.total}` : 'Done'}
              </label>
              <progress id="batch-progress" max={progress.total || 1} value={progress.done} />
              <div aria-live="polite">
                {summary && (
                  <p className={`status ${errors.length ? 'status-warn' : 'status-ok'}`}>
                    <Icon name={errors.length ? 'alert' : 'check'} /> {summary}
                  </p>
                )}
              </div>
              {errors.length > 0 && (
                <ul className="error-list">
                  {errors.map((e) => (
                    <li key={e.line}>
                      Line {e.line} (<span className="mono">{e.value.slice(0, 30)}</span>): {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </section>
  )
}
