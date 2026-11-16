import { describe, expect, it } from 'vitest'
import { generateBatch } from './batch.ts'
import { addHistory, loadHistory, redactSecrets, type KeyValueStorage } from './history.ts'
import { linkWarnings, parseContent } from './parse.ts'

const memory = (): KeyValueStorage => {
  const data = new Map<string, string>()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}

describe('review fix: malformed percent-encoding never throws', () => {
  it.each(['mailto:%', 'mailto:%E0%A4%A', 'mailto:a@b.com?subject=%'])('%s', (text) => {
    expect(() => parseContent(text)).not.toThrow()
    expect(parseContent(text).kind).toBe('email')
  })

  it('keeps the raw address when it cannot be decoded', () => {
    expect(parseContent('mailto:%zz@x.com')).toMatchObject({ kind: 'email', to: '%zz@x.com' })
  })
})

describe('review fix: deceptive links are flagged', () => {
  it('flags user-info tricks like paypal.com@evil.example', () => {
    expect(linkWarnings('https://paypal.com@evil.example/login')).toContainEqual(expect.objectContaining({ id: 'userinfo' }))
  })

  it('flags punycode look-alike domains', () => {
    expect(linkWarnings('https://xn--pypal-4ve.com/')).toContainEqual(expect.objectContaining({ id: 'punycode' }))
  })

  it('flags plain http', () => {
    expect(linkWarnings('http://example.com')).toContainEqual(expect.objectContaining({ id: 'insecure' }))
  })

  it('has no warnings for an ordinary https link', () => {
    expect(linkWarnings('https://example.com/a?b=c')).toEqual([])
  })
})

describe('review fix: Wi-Fi passwords are never stored in history', () => {
  it('redacts the password field and keeps the rest', () => {
    expect(redactSecrets('WIFI:T:WPA;S:Home;P:hunter2;H:true;;')).toBe('WIFI:T:WPA;S:Home;P:;H:true;;')
    expect(redactSecrets(String.raw`WIFI:S:x;P:a\;b;;`)).toBe('WIFI:S:x;P:;;')
    expect(redactSecrets('hello P:secret')).toBe('hello P:secret')
  })

  it('applies to both made and scanned entries', () => {
    const storage = memory()
    addHistory({ kind: 'scanned', format: 'QR Code', text: 'WIFI:T:WPA;S:Cafe;P:s3cret;;' }, storage, 1)
    expect(loadHistory(storage)[0]?.text).toBe('WIFI:T:WPA;S:Cafe;P:;;')
  })
})

describe('review fix: tampered timestamps are ignored', () => {
  it.each([1e308, Number.NaN, -1, 9e15])('drops createdAt=%s', (createdAt) => {
    const storage = memory()
    storage.setItem('qr-studio:history:v1', JSON.stringify([{ id: 'x', kind: 'created', format: 'QR', text: 't', createdAt }]))
    expect(loadHistory(storage)).toEqual([])
  })
})

describe('review fix: big batches yield so progress can paint', () => {
  it('gives the browser a turn while working through synchronous renders', async () => {
    let ticks = 0
    const timer = setInterval(() => ticks++, 0)
    await generateBatch(Array.from({ length: 60 }, (_, i) => `v${i}`), async (v) => new TextEncoder().encode(v), 'svg')
    clearInterval(timer)
    expect(ticks).toBeGreaterThan(0)
  })
})
