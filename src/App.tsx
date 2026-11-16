import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
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

function tabFromHash(): TabId {
  const hash = typeof location === 'undefined' ? '' : location.hash.slice(1)
  return TABS.some((t) => t.id === hash) ? (hash as TabId) : 'create'
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
  const [toast, setToast] = useState('')
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ create: null, scan: null, batch: null, history: null })

  const select = useCallback((id: TabId, focus = false) => {
    setTab(id)
    if (location.hash.slice(1) !== id) replaceHash(id)
    if (focus) tabRefs.current[id]?.focus()
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
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
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const notify = useCallback((message: string) => setToast(message), [])
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
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="wrap">
          <div className="brand">
            <Icon name="mark" className="brand-mark" />
            <span>QR Studio</span>
          </div>
          <nav aria-label="Sections">
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
          </nav>
          {installEvent && (
            <button
              type="button"
              className="btn install"
              onClick={async () => {
                await installEvent.prompt()
                await installEvent.userChoice
                setInstallEvent(null)
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
            <CreatePanel request={request} onCreated={record} notify={notify} />
          </div>
          <div role="tabpanel" id="panel-scan" aria-labelledby="tab-scan" hidden={tab !== 'scan'}>
            {tab === 'scan' && <ScanPanel onScanned={record} notify={notify} />}
          </div>
          <div role="tabpanel" id="panel-batch" aria-labelledby="tab-batch" hidden={tab !== 'batch'}>
            <BatchPanel notify={notify} />
          </div>
          <div role="tabpanel" id="panel-history" aria-labelledby="tab-history" hidden={tab !== 'history'}>
            {tab === 'history' && (
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
        {toast}
      </div>
    </>
  )
}

function replaceHash(id: TabId) {
  window.history.replaceState(null, '', `#${id}`)
}
