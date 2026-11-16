import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { Icon, type IconName } from './components/Icon.tsx'
import { BatchPanel } from './features/batch/BatchPanel.tsx'
import { CreatePanel, type CreateRequest } from './features/create/CreatePanel.tsx'
import { HistoryPanel } from './features/history/HistoryPanel.tsx'
import { ScanPanel } from './features/scan/ScanPanel.tsx'
import {
  addHistory,
  clearHistory,
  isHistoryEnabled,
  loadHistory,
  removeHistory,
  setHistoryEnabled,
  type HistoryEntry,
  type NewHistoryEntry,
} from './lib/history.ts'

type TabId = 'create' | 'scan' | 'batch' | 'history'

const TABS: ReadonlyArray<{ id: TabId; label: string; icon: IconName }> = [
  { id: 'create', label: 'Create', icon: 'create' },
  { id: 'scan', label: 'Scan', icon: 'scan' },
  { id: 'batch', label: 'Batch', icon: 'batch' },
  { id: 'history', label: 'History', icon: 'history' },
]

const isTab = (value: string): value is TabId => TABS.some((t) => t.id === value)

function tabFromHash(): TabId {
  const hash = typeof location === 'undefined' ? '' : location.hash.slice(1)
  return isTab(hash) ? hash : 'create'
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash)
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [historyOn, setHistoryOn] = useState(() => isHistoryEnabled())
  const [request, setRequest] = useState<CreateRequest>()
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ create: null, scan: null, batch: null, history: null })

  const select = useCallback((id: TabId, focus = false) => {
    setTab(id)
    if (location.hash.slice(1) !== id) replaceHash(id)
    if (focus) tabRefs.current[id]?.focus()
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    // Only section hashes switch sections; other anchors (like the skip link) are ignored.
    const onHash = () => {
      const hash = location.hash.slice(1)
      if (isTab(hash)) setTab(hash)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }
    const onInstalled = () => setInstallEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  // A fresh id re-announces and re-times identical messages (e.g. saving twice).
  const notify = useCallback((message: string) => setToast({ id: Date.now() + Math.random(), message }), [])
  const record = useCallback((entry: NewHistoryEntry) => setHistory(addHistory(entry)), [])

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    select(TABS[next]!.id, true)
  }

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        Skip to content
      </a>
      <header className="topbar">
        <div className="wrap">
          <div className="brand">
            <Icon name="mark" className="brand-mark" />
            <span>QR Studio</span>
          </div>
          <div className="tabs" role="tablist" aria-label="QR Studio sections">
              {TABS.map((t, index) => (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  className="tab"
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => select(t.id)}
                  onKeyDown={(e) => onTabKey(e, index)}
                >
                  <Icon name={t.icon} />
                  {t.label}
                </button>
              ))}
          </div>
          {installEvent && (
            <button
              type="button"
              className="btn install"
              onClick={async () => {
                try {
                  await installEvent.prompt()
                  await installEvent.userChoice
                } catch {
                  // The browser already used this prompt; it will offer installation itself.
                } finally {
                  setInstallEvent(null)
                }
              }}
            >
              <Icon name="install" /> Install app
            </button>
          )}
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <div className="wrap">
          {/* Create and Batch stay mounted so work in progress survives switching sections. */}
          <div role="tabpanel" id="panel-create" aria-labelledby="tab-create" hidden={tab !== 'create'}>
            <ErrorBoundary section="Create">
              <CreatePanel request={request} onCreated={record} notify={notify} />
            </ErrorBoundary>
          </div>
          <div role="tabpanel" id="panel-scan" aria-labelledby="tab-scan" hidden={tab !== 'scan'}>
            {tab === 'scan' && (
              <ErrorBoundary section="Scan">
                <ScanPanel onScanned={record} notify={notify} />
              </ErrorBoundary>
            )}
          </div>
          <div role="tabpanel" id="panel-batch" aria-labelledby="tab-batch" hidden={tab !== 'batch'}>
            <ErrorBoundary section="Batch">
              <BatchPanel notify={notify} />
            </ErrorBoundary>
          </div>
          <div role="tabpanel" id="panel-history" aria-labelledby="tab-history" hidden={tab !== 'history'}>
            {tab === 'history' && (
              <ErrorBoundary section="History">
              <HistoryPanel
                entries={history}
                enabled={historyOn}
                notify={notify}
                onToggle={(on) => {
                  setHistoryEnabled(on)
                  setHistoryOn(on)
                  setHistory(loadHistory())
                }}
                onRemove={(id) => setHistory(removeHistory(id))}
                onClear={() => {
                  clearHistory()
                  setHistory([])
                }}
                onOpen={(entry) => {
                  setRequest({ symbology: entry.symbology ?? 'qrcode', text: entry.text, nonce: Date.now() })
                  select('create')
                }}
              />
              </ErrorBoundary>
            )}
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="wrap">
          <span>Runs on your device. Nothing you make or scan is uploaded.</span>
          <span>
            <a href="https://github.com/ALPHAMAN-0/QR_Code" target="_blank" rel="noopener noreferrer">
              Source on GitHub
            </a>
          </span>
        </div>
      </footer>

      <div className="toast" role="status" aria-live="polite">
        {toast && <span key={toast.id}>{toast.message}</span>}
      </div>
    </>
  )
}

function replaceHash(id: TabId) {
  window.history.replaceState(null, '', `#${id}`)
}
