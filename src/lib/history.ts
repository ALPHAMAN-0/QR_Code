/** Recent codes, kept only in this browser's localStorage. */

export interface HistoryEntry {
  id: string
  kind: 'created' | 'scanned'
  /** Human-readable format, e.g. "QR Code". */
  format: string
  /** bwip-js id for created codes, so they can be re-opened in the editor. */
  symbology?: string
  text: string
  createdAt: number
}

export type NewHistoryEntry = Omit<HistoryEntry, 'id' | 'createdAt'>

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const HISTORY_LIMIT = 100
const KEY = 'qr-studio:history:v1'
const ENABLED_KEY = 'qr-studio:history-enabled:v1'
/** Largest timestamp a Date can hold. */
const MAX_TIME = 8.64e15

/** Removes Wi-Fi passwords (`WIFI:…;P:secret;…`) so they are never written to storage. */
export function redactSecrets(text: string): string {
  if (!/^WIFI:/i.test(text)) return text
  return text.replace(/(^WIFI:|;)P:(?:\\.|[^;\\])*/i, '$1P:')
}

function browserStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    (v.kind === 'created' || v.kind === 'scanned') &&
    typeof v.format === 'string' &&
    typeof v.text === 'string' &&
    typeof v.createdAt === 'number' &&
    Number.isFinite(v.createdAt) &&
    v.createdAt >= 0 &&
    v.createdAt <= MAX_TIME &&
    (v.symbology === undefined || typeof v.symbology === 'string')
  )
}

export function loadHistory(storage = browserStorage()): HistoryEntry[] {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

function save(entries: HistoryEntry[], storage: KeyValueStorage | undefined): void {
  try {
    storage?.setItem(KEY, JSON.stringify(entries))
  } catch {
    // Storage full or blocked: history simply isn't persisted.
  }
}

let counter = 0
function newId(now: number): string {
  counter = (counter + 1) % 1_000_000
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${now.toString(36)}-${counter}-${random}`
}

export function addHistory(input: NewHistoryEntry, storage = browserStorage(), now = Date.now()): HistoryEntry[] {
  if (!isHistoryEnabled(storage)) return []
  const entry = { ...input, text: redactSecrets(input.text) }
  const rest = loadHistory(storage).filter(
    (e) => !(e.kind === entry.kind && e.text === entry.text && e.format === entry.format && e.symbology === entry.symbology),
  )
  const next = [{ ...entry, id: newId(now), createdAt: now }, ...rest].slice(0, HISTORY_LIMIT)
  save(next, storage)
  return next
}

export function removeHistory(id: string, storage = browserStorage()): HistoryEntry[] {
  const next = loadHistory(storage).filter((e) => e.id !== id)
  save(next, storage)
  return next
}

export function clearHistory(storage = browserStorage()): void {
  try {
    storage?.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}

export function isHistoryEnabled(storage = browserStorage()): boolean {
  try {
    return storage?.getItem(ENABLED_KEY) !== 'false'
  } catch {
    return true
  }
}

export function setHistoryEnabled(enabled: boolean, storage = browserStorage()): void {
  try {
    storage?.setItem(ENABLED_KEY, String(enabled))
  } catch {
    // Preference can't be stored; default (enabled) applies next time.
  }
  if (!enabled) clearHistory(storage)
}
