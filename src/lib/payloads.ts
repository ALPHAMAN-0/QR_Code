/**
 * Builds the text that goes inside a QR code for each kind of content.
 * The formats are the de-facto standards phone camera apps understand
 * (Wi-Fi "WIFI:", vCard 3.0, mailto:, tel:, SMSTO:, geo:, iCalendar VEVENT).
 */

export class PayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayloadError'
  }
}

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass'

export interface TextContent {
  type: 'text'
  text: string
}
export interface UrlContent {
  type: 'url'
  url: string
}
export interface WifiContent {
  type: 'wifi'
  ssid: string
  password: string
  security: WifiSecurity
  hidden: boolean
}
export interface ContactContent {
  type: 'contact'
  firstName: string
  lastName: string
  organization: string
  title: string
  phone: string
  email: string
  website: string
  street: string
  city: string
  region: string
  postcode: string
  country: string
  note: string
}
export interface EmailContent {
  type: 'email'
  to: string
  subject: string
  body: string
}
export interface PhoneContent {
  type: 'phone'
  number: string
}
export interface SmsContent {
  type: 'sms'
  number: string
  message: string
}
export interface LocationContent {
  type: 'location'
  latitude: string
  longitude: string
}
export interface EventContent {
  type: 'event'
  title: string
  location: string
  /** `YYYY-MM-DDTHH:mm` (or `YYYY-MM-DD` when allDay) as produced by date inputs. */
  start: string
  end: string
  allDay: boolean
  description: string
}

export type Content =
  | TextContent
  | UrlContent
  | WifiContent
  | ContactContent
  | EmailContent
  | PhoneContent
  | SmsContent
  | LocationContent
  | EventContent

export type ContentType = Content['type']

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[0-9]{2,20}$/

export function buildPayload(content: Content): string {
  switch (content.type) {
    case 'text':
      if (content.text.trim() === '') throw new PayloadError('Enter some text to encode.')
      return content.text
    case 'url':
      return normalizeUrl(content.url)
    case 'wifi':
      return buildWifi(content)
    case 'contact':
      return buildVcard(content)
    case 'email':
      return buildMailto(content)
    case 'phone':
      return `tel:${normalizePhone(content.number)}`
    case 'sms':
      return `SMSTO:${normalizePhone(content.number)}:${content.message}`
    case 'location':
      return buildGeo(content)
    case 'event':
      return buildEvent(content)
  }
}

/** Accepts `example.com/x` or a full http(s) URL; refuses every other scheme. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (trimmed === '') throw new PayloadError('Enter a web address.')
  const hasScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(trimmed) // "host:8080" is a port, not a scheme
  const candidate = hasScheme ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new PayloadError('That doesn’t look like a web address.')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new PayloadError('Only http:// and https:// web addresses are allowed.')
  }
  if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost' && !hasScheme) {
    throw new PayloadError('That doesn’t look like a web address.')
  }
  return hasScheme ? trimmed : candidate
}

function normalizePhone(input: string): string {
  const cleaned = input.replace(/[\s().-]/g, '')
  if (!PHONE_PATTERN.test(cleaned)) throw new PayloadError('Enter a phone number using digits, optionally starting with +.')
  return cleaned
}

function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1')
}

function buildWifi(c: WifiContent): string {
  if (c.ssid === '') throw new PayloadError('Enter the network name (SSID).')
  if (c.security !== 'nopass' && c.password === '') throw new PayloadError('Enter the network password.')
  const parts = [`T:${c.security}`, `S:${escapeWifi(c.ssid)}`]
  if (c.security !== 'nopass') parts.push(`P:${escapeWifi(c.password)}`)
  if (c.hidden) parts.push('H:true')
  return `WIFI:${parts.join(';')};;`
}

function escapeVcard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n')
}

function buildVcard(c: ContactContent): string {
  const first = c.firstName.trim()
  const last = c.lastName.trim()
  const fullName = [first, last].filter(Boolean).join(' ')
  if (!fullName && !c.organization.trim() && !c.phone.trim() && !c.email.trim()) {
    throw new PayloadError('Add at least a name, organization, phone number or email.')
  }
  if (c.email.trim() && !EMAIL_PATTERN.test(c.email.trim())) throw new PayloadError('Enter a valid email address.')

  const lines = ['BEGIN:VCARD', 'VERSION:3.0']
  if (fullName) {
    lines.push(`N:${escapeVcard(last)};${escapeVcard(first)};;;`, `FN:${escapeVcard(fullName)}`)
  }
  const add = (key: string, value: string) => {
    if (value.trim()) lines.push(`${key}:${escapeVcard(value.trim())}`)
  }
  add('ORG', c.organization)
  add('TITLE', c.title)
  add('TEL;TYPE=CELL', c.phone)
  add('EMAIL', c.email)
  if (c.website.trim()) lines.push(`URL:${escapeVcard(normalizeUrl(c.website))}`)
  const address = [c.street, c.city, c.region, c.postcode, c.country].map((v) => escapeVcard(v.trim()))
  if (address.some(Boolean)) lines.push(`ADR;TYPE=WORK:;;${address.join(';')}`)
  add('NOTE', c.note)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

function buildMailto(c: EmailContent): string {
  const to = c.to.trim()
  if (!EMAIL_PATTERN.test(to)) throw new PayloadError('Enter a valid email address.')
  const query = [
    c.subject ? `subject=${encodeURIComponent(c.subject)}` : '',
    c.body ? `body=${encodeURIComponent(c.body)}` : '',
  ].filter(Boolean)
  return `mailto:${to}${query.length ? `?${query.join('&')}` : ''}`
}

function parseCoordinate(value: string, limit: number, name: string): number {
  const trimmed = value.trim()
  const number = Number(trimmed)
  if (trimmed === '' || !Number.isFinite(number) || Math.abs(number) > limit) {
    throw new PayloadError(`Enter a ${name} between -${limit} and ${limit}.`)
  }
  return number
}

function buildGeo(c: LocationContent): string {
  const lat = parseCoordinate(c.latitude, 90, 'latitude')
  const lng = parseCoordinate(c.longitude, 180, 'longitude')
  return `geo:${lat},${lng}`
}

function compactDate(date: string): string {
  return date.replace(/-/g, '')
}

function icsDateTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) throw new PayloadError('Enter a valid date and time.')
  const [, y, mo, d, h, mi, s] = match
  return `${y}${mo}${d}T${h}${mi}${s ?? '00'}`
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return next.toISOString().slice(0, 10).replace(/-/g, '')
}

function buildEvent(c: EventContent): string {
  if (!c.title.trim()) throw new PayloadError('Enter an event title.')
  if (!c.start) throw new PayloadError('Choose when the event starts.')

  const lines = ['BEGIN:VEVENT', `SUMMARY:${escapeVcard(c.title.trim())}`]
  if (c.allDay) {
    const start = c.start.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new PayloadError('Enter a valid date.')
    const end = c.end ? c.end.slice(0, 10) : start
    if (end < start) throw new PayloadError('The end date must be on or after the start date.')
    lines.push(`DTSTART;VALUE=DATE:${compactDate(start)}`, `DTEND;VALUE=DATE:${nextDay(end)}`)
  } else {
    const start = icsDateTime(c.start)
    lines.push(`DTSTART:${start}`)
    if (c.end) {
      const end = icsDateTime(c.end)
      if (end < start) throw new PayloadError('The end must be after the start.')
      lines.push(`DTEND:${end}`)
    }
  }
  if (c.location.trim()) lines.push(`LOCATION:${escapeVcard(c.location.trim())}`)
  if (c.description.trim()) lines.push(`DESCRIPTION:${escapeVcard(c.description.trim())}`)
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}
