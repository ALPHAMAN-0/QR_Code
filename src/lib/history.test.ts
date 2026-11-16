import { beforeEach, describe, expect, it } from 'vitest'
import {
  addHistory,
  clearHistory,
  HISTORY_LIMIT,
  isHistoryEnabled,
  loadHistory,
  removeHistory,
  setHistoryEnabled,
  type KeyValueStorage,
} from './history.ts'

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

const brokenStorage: KeyValueStorage = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('denied')
  },
  removeItem: () => {
    throw new Error('denied')
  },
}

describe('history', () => {
  let storage: ReturnType<typeof memoryStorage>
  beforeEach(() => {
    storage = memoryStorage()
  })

  it('starts empty', () => {
    expect(loadHistory(storage)).toEqual([])
  })

  it('adds newest entries first with id and timestamp', () => {
    addHistory({ kind: 'created', format: 'QR Code', text: 'one' }, storage, 1000)
    const list = addHistory({ kind: 'scanned', format: 'EAN-13', text: 'two' }, storage, 2000)
    expect(list.map((e) => e.text)).toEqual(['two', 'one'])
    expect(list[0]).toMatchObject({ kind: 'scanned', format: 'EAN-13', createdAt: 2000 })
    expect(list[0]?.id).toMatch(/\S+/)
    expect(loadHistory(storage)).toEqual(list)
  })

  it('moves a repeated entry to the top instead of duplicating it', () => {
    addHistory({ kind: 'created', format: 'QR Code', text: 'same' }, storage, 1)
    addHistory({ kind: 'created', format: 'QR Code', text: 'other' }, storage, 2)
    const list = addHistory({ kind: 'created', format: 'QR Code', text: 'same' }, storage, 3)
    expect(list.map((e) => e.text)).toEqual(['same', 'other'])
    expect(list[0]?.createdAt).toBe(3)
  })

  it(`keeps at most ${HISTORY_LIMIT} entries`, () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) addHistory({ kind: 'created', format: 'QR Code', text: `v${i}` }, storage, i)
    const list = loadHistory(storage)
    expect(list).toHaveLength(HISTORY_LIMIT)
    expect(list[0]?.text).toBe(`v${HISTORY_LIMIT + 4}`)
  })

  it('removes one entry and clears all', () => {
    const [a] = addHistory({ kind: 'created', format: 'QR Code', text: 'a' }, storage, 1)
    addHistory({ kind: 'created', format: 'QR Code', text: 'b' }, storage, 2)
    expect(removeHistory(a!.id, storage).map((e) => e.text)).toEqual(['b'])
    clearHistory(storage)
    expect(loadHistory(storage)).toEqual([])
  })

  it('ignores corrupted or malformed data', () => {
    storage.data.set('qr-studio:history:v1', '{not json')
    expect(loadHistory(storage)).toEqual([])
    storage.data.set('qr-studio:history:v1', JSON.stringify([{ id: 1 }, { id: 'x', kind: 'created', format: 'QR', text: 't', createdAt: 5 }]))
    expect(loadHistory(storage)).toEqual([{ id: 'x', kind: 'created', format: 'QR', text: 't', createdAt: 5 }])
  })

  it('keeps working when storage is unavailable', () => {
    expect(loadHistory(brokenStorage)).toEqual([])
    expect(addHistory({ kind: 'created', format: 'QR Code', text: 'a' }, brokenStorage, 1)).toHaveLength(1)
    expect(() => clearHistory(brokenStorage)).not.toThrow()
    expect(isHistoryEnabled(brokenStorage)).toBe(true)
  })

  it('can be switched off, which also clears saved entries', () => {
    addHistory({ kind: 'created', format: 'QR Code', text: 'a' }, storage, 1)
    setHistoryEnabled(false, storage)
    expect(isHistoryEnabled(storage)).toBe(false)
    expect(loadHistory(storage)).toEqual([])
    expect(addHistory({ kind: 'created', format: 'QR Code', text: 'b' }, storage, 2)).toEqual([])
    setHistoryEnabled(true, storage)
    expect(isHistoryEnabled(storage)).toBe(true)
  })
})
