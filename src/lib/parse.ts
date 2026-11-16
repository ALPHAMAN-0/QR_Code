/**
 * Turns decoded text into something the UI can act on.
 * Decoded text is untrusted: only http(s), mailto, tel and sms ever become links.
 */

import type { WifiSecurity } from './payloads.ts'

export type ParsedContent =
  | { kind: 'url'; url: string; secure: boolean }
  | { kind: 'wifi'; ssid: string; password: string; security: WifiSecurity; hidden: boolean }
  | {
      kind: 'contact'
      name: string
      organization: string
      title: string
      phones: string[]
      emails: string[]
      urls: string[]
      address: string
      note: string
    }
  | { kind: 'email'; to: string; subject: string; body: string }
  | { kind: 'phone'; number: string }
  | { kind: 'sms'; number: string; message: string }
  | { kind: 'location'; latitude: number; longitude: number }
  | { kind: 'event'; title: string; location: string; description: string; start: string; end: string }
  | { kind: 'text'; text: string }

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|sms:)/i

/** True only for link schemes that cannot run script (http, https, mailto, tel, sms). */
export function isSafeLink(href: string): boolean {
  if (!SAFE_LINK.test(href)) return false
  try {
    const { protocol } = new URL(href)
    return ['http:', 'https:', 'mailto:', 'tel:', 'sms:'].includes(protocol)
  } catch {
    return false
  }
}

export function parseContent(raw: string): ParsedContent {
  const text = raw.trim()
  const upper = text.toUpperCase()

  if (/^https?:\/\//i.test(text)) {
    if (isSafeLink(text)) return { kind: 'url', url: text, secure: /^https:/i.test(text) }
  }
  if (/^www\.[^\s]+\.[^\s]+$/i.test(text)) return { kind: 'url', url: `https://${text}`, secure: true }
  if (upper.startsWith('WIFI:')) return parseWifi(text)
  if (upper.startsWith('BEGIN:VCARD')) return parseVcard(text)
  if (upper.startsWith('MECARD:')) return parseMecard(text)
  if (upper.startsWith('MAILTO:')) return parseMailto(text)
  if (upper.startsWith('MATMSG:')) return parseMatmsg(text)
  if (upper.startsWith('TEL:')) return { kind: 'phone', number: text.slice(4) }
  if (upper.startsWith('SMSTO:')) {
    const rest = text.slice(6)
    const split = rest.indexOf(':')
    return split === -1
      ? { kind: 'sms', number: rest, message: '' }
      : { kind: 'sms', number: rest.slice(0, split), message: rest.slice(split + 1) }
  }
  if (upper.startsWith('SMS:')) {
    const [number = '', query = ''] = text.slice(4).split('?')
    return { kind: 'sms', number, message: new URLSearchParams(query).get('body') ?? '' }
  }
  if (upper.startsWith('GEO:')) {
    const match = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i.exec(text)
    if (match) return { kind: 'location', latitude: Number(match[1]), longitude: Number(match[2]) }
  }
  if (upper.startsWith('BEGIN:VEVENT') || upper.startsWith('BEGIN:VCALENDAR')) return parseEvent(text)

  return { kind: 'text', text: raw }
}

/** Splits `key:value;key:value;;` honouring backslash escapes. */
function splitEscaped(body: string, separator: string): string[] {
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!
    if (ch === '\\' && i + 1 < body.length) {
      current += body[i + 1]
      i++
    } else if (ch === separator) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return parts
}

function parseWifi(text: string): ParsedContent {
  const fields = new Map<string, string>()
  for (const part of splitEscaped(text.slice(5), ';')) {
    const split = part.indexOf(':')
    if (split > 0) fields.set(part.slice(0, split).toUpperCase(), part.slice(split + 1))
  }
  const type = (fields.get('T') ?? 'nopass').toUpperCase()
  const security: WifiSecurity = type === 'WEP' ? 'WEP' : type === 'NOPASS' || type === '' ? 'nopass' : 'WPA'
  return {
    kind: 'wifi',
    ssid: fields.get('S') ?? '',
    password: fields.get('P') ?? '',
    security,
    hidden: (fields.get('H') ?? '').toLowerCase() === 'true',
  }
}

function unescapeVcard(value: string): string {
  return value.replace(/\\([\\,;nN])/g, (_, ch: string) => (ch === 'n' || ch === 'N' ? '\n' : ch))
}

function contentLines(text: string): Array<{ name: string; value: string }> {
  // Unfold continuation lines (RFC 6350 §3.2), then split "NAME;PARAMS:value".
  return text
    .replace(/\r?\n[ \t]/g, '')
    .split(/\r?\n/)
    .map((line) => {
      const split = line.indexOf(':')
      if (split === -1) return null
      return { name: line.slice(0, split).split(';')[0]!.toUpperCase(), value: line.slice(split + 1) }
    })
    .filter((x): x is { name: string; value: string } => x !== null)
}

/** Splits a structured value on unescaped semicolons. */
function structured(value: string): string[] {
  return value.split(/(?<!\\);/).map(unescapeVcard)
}

function parseVcard(text: string): ParsedContent {
  const contact = { kind: 'contact' as const, name: '', organization: '', title: '', phones: [] as string[], emails: [] as string[], urls: [] as string[], address: '', note: '' }
  let structuredName = ''
  for (const { name, value } of contentLines(text)) {
    if (name === 'FN') contact.name = unescapeVcard(value)
    else if (name === 'N') {
      const [last = '', first = ''] = structured(value)
      structuredName = [first, last].filter(Boolean).join(' ')
    } else if (name === 'ORG') contact.organization = structured(value).filter(Boolean).join(', ')
    else if (name === 'TITLE') contact.title = unescapeVcard(value)
    else if (name === 'TEL') contact.phones.push(unescapeVcard(value))
    else if (name === 'EMAIL') contact.emails.push(unescapeVcard(value))
    else if (name === 'URL') contact.urls.push(unescapeVcard(value))
    else if (name === 'ADR') contact.address = structured(value).filter(Boolean).join(', ')
    else if (name === 'NOTE') contact.note = unescapeVcard(value)
  }
  if (!contact.name) contact.name = structuredName
  return contact
}

function parseMecard(text: string): ParsedContent {
  const contact = { kind: 'contact' as const, name: '', organization: '', title: '', phones: [] as string[], emails: [] as string[], urls: [] as string[], address: '', note: '' }
  for (const part of splitEscaped(text.slice(7), ';')) {
    const split = part.indexOf(':')
    if (split <= 0) continue
    const key = part.slice(0, split).toUpperCase()
    const value = part.slice(split + 1)
    if (key === 'N') {
      const [last = '', first = ''] = value.split(',')
      contact.name = [first, last].filter(Boolean).join(' ')
    } else if (key === 'TEL') contact.phones.push(value)
    else if (key === 'EMAIL') contact.emails.push(value)
    else if (key === 'URL') contact.urls.push(value)
    else if (key === 'ORG') contact.organization = value
    else if (key === 'ADR') contact.address = value
    else if (key === 'NOTE') contact.note = value
  }
  return contact
}

function parseMailto(text: string): ParsedContent {
  const [address = '', query = ''] = text.slice(7).split('?')
  const params = new URLSearchParams(query.replace(/\+/g, '%2B'))
  return {
    kind: 'email',
    to: decodeURIComponent(address),
    subject: params.get('subject') ?? '',
    body: params.get('body') ?? '',
  }
}

function parseMatmsg(text: string): ParsedContent {
  const fields = new Map<string, string>()
  for (const part of splitEscaped(text.slice(7), ';')) {
    const split = part.indexOf(':')
    if (split > 0) fields.set(part.slice(0, split).toUpperCase(), part.slice(split + 1))
  }
  return { kind: 'email', to: fields.get('TO') ?? '', subject: fields.get('SUB') ?? '', body: fields.get('BODY') ?? '' }
}

function readableIcsDate(value: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(value)
  if (!match) return value
  const [, y, m, d, h, mi] = match
  return h ? `${y}-${m}-${d} ${h}:${mi}` : `${y}-${m}-${d}`
}

function parseEvent(text: string): ParsedContent {
  const event = { kind: 'event' as const, title: '', location: '', description: '', start: '', end: '' }
  for (const { name, value } of contentLines(text)) {
    if (name === 'SUMMARY') event.title = unescapeVcard(value)
    else if (name === 'LOCATION') event.location = unescapeVcard(value)
    else if (name === 'DESCRIPTION') event.description = unescapeVcard(value)
    else if (name === 'DTSTART') event.start = readableIcsDate(value)
    else if (name === 'DTEND') event.end = readableIcsDate(value)
  }
  return event
}
