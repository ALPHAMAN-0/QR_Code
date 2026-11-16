import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon.tsx'
import { copyText } from '../../lib/files.ts'
import type { HistoryEntry } from '../../lib/history.ts'

interface Props {
  entries: HistoryEntry[]
  enabled: boolean
  onToggle: (enabled: boolean) => void
  onRemove: (id: string) => void
  onClear: () => void
  onOpen: (entry: HistoryEntry) => void
  notify: (message: string) => void
}

const time = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function HistoryPanel({ entries, enabled, onToggle, onRemove, onClear, onOpen, notify }: Props) {
  const [filter, setFilter] = useState<'all' | 'created' | 'scanned'>('all')
  const [confirming, setConfirming] = useState(false)
  const shown = entries.filter((e) => filter === 'all' || e.kind === filter)

  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 5000)
    return () => clearTimeout(timer)
  }, [confirming])

  return (
    <section aria-labelledby="history-title">
      <div className="panel-head">
        <h1 id="history-title">History</h1>
        <p>Saved only in this browser on this device. Wi-Fi passwords you encode are saved too, so switch it off on shared devices.</p>
      </div>

      <div className="history-tools">
        <fieldset className="segments">
          <legend className="sr-only">Show</legend>
          {(['all', 'created', 'scanned'] as const).map((value) => (
            <label key={value} className="segment">
              <input type="radio" name="history-filter" value={value} checked={filter === value} onChange={() => setFilter(value)} />
              <span>{value === 'all' ? 'All' : value === 'created' ? 'Made' : 'Scanned'}</span>
            </label>
          ))}
        </fieldset>
        <div className="btn-row">
          <label className="check">
            <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
            Save history
          </label>
          {entries.length > 0 && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (confirming) {
                  onClear()
                  setConfirming(false)
                  notify('History cleared')
                } else setConfirming(true)
              }}
            >
              <Icon name="trash" /> {confirming ? 'Press again to clear all' : 'Clear all'}
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="empty">{enabled ? 'Codes you save, copy, share or scan will be listed here.' : 'History is off. Nothing is being saved.'}</p>
      ) : (
        <ul className="history-list">
          {shown.map((entry) => (
            <li key={entry.id} className="history-item">
              <div>
                <div className="history-meta">
                  <span className="chip">{entry.kind === 'created' ? 'Made' : 'Scanned'}</span>
                  <span>{entry.format}</span>
                  <time dateTime={new Date(entry.createdAt).toISOString()}>{time.format(entry.createdAt)}</time>
                </div>
                <p className="history-text" title={entry.text}>
                  {entry.text}
                </p>
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-icon" onClick={() => onOpen(entry)}>
                  <Icon name="edit" label={`Open “${entry.text.slice(0, 40)}” in the editor`} />
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() =>
                    copyText(entry.text).then(
                      () => notify('Text copied'),
                      () => notify('Copying is blocked in this browser.'),
                    )
                  }
                >
                  <Icon name="copy" label={`Copy “${entry.text.slice(0, 40)}”`} />
                </button>
                <button type="button" className="btn btn-icon btn-danger" onClick={() => onRemove(entry.id)}>
                  <Icon name="trash" label={`Delete “${entry.text.slice(0, 40)}” from history`} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
