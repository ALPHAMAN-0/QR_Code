import { useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon.tsx'
import type { DecodedCode } from '../../lib/readback.ts'
import { copyText, downloadText } from '../../lib/files.ts'
import { isSafeLink, linkWarnings, parseContent, type ParsedContent } from '../../lib/parse.ts'

interface Props {
  code: DecodedCode
  notify: (message: string) => void
}

const KIND_LABEL: Record<ParsedContent['kind'], string> = {
  url: 'Link',
  wifi: 'Wi-Fi network',
  contact: 'Contact',
  email: 'Email',
  phone: 'Phone number',
  sms: 'Text message',
  location: 'Location',
  event: 'Calendar event',
  text: 'Text',
}

/** Only digits and a leading + survive into tel:/sms: links. */
const dialable = (number: string) => number.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')

function SafeLink({ href, children, quiet = false }: { href: string; children: ReactNode; quiet?: boolean }) {
  if (!isSafeLink(href)) return null
  const external = /^https?:/i.test(href)
  return (
    <a className={quiet ? 'btn' : 'btn btn-primary'} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  )
}

export function ResultCard({ code, notify }: Props) {
  const parsed = parseContent(code.text)
  const [showPassword, setShowPassword] = useState(false)

  const copy = async (text: string, what: string) => {
    try {
      await copyText(text)
      notify(`${what} copied`)
    } catch {
      notify('Copying is blocked in this browser. Select the text instead.')
    }
  }

  return (
    <article className="card result" aria-label={`${code.label}: ${KIND_LABEL[parsed.kind]}`}>
      <div className="result-head">
        <div className="btn-row">
          <span className="chip">{code.label}</span>
          <span className="chip">{KIND_LABEL[parsed.kind]}</span>
        </div>
        <button type="button" className="btn btn-quiet" onClick={() => copy(code.text, 'Text')}>
          <Icon name="copy" /> Copy
        </button>
      </div>

      <Details parsed={parsed} showPassword={showPassword} />

      <div className="btn-row">
        {parsed.kind === 'url' && (
          <SafeLink href={parsed.url} quiet={linkWarnings(parsed.url).some((w) => w.id !== 'insecure')}>
            <Icon name="external" /> Open link
          </SafeLink>
        )}
        {parsed.kind === 'wifi' && parsed.password && (
          <>
            <button type="button" className="btn" aria-pressed={showPassword} onClick={() => setShowPassword((s) => !s)}>
              <Icon name={showPassword ? 'eyeOff' : 'eye'} /> {showPassword ? 'Hide password' : 'Show password'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => copy(parsed.password, 'Password')}>
              <Icon name="copy" /> Copy password
            </button>
          </>
        )}
        {parsed.kind === 'contact' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => downloadText(toVcard(parsed), `${(parsed.name || 'contact').replace(/[^\w-]+/g, '-')}.vcf`, 'text/vcard')}
          >
            <Icon name="download" /> Save contact
          </button>
        )}
        {parsed.kind === 'email' && (
          <SafeLink
            href={`mailto:${encodeURIComponent(parsed.to).replace(/%40/g, '@')}?subject=${encodeURIComponent(parsed.subject)}&body=${encodeURIComponent(parsed.body)}`}
          >
            <Icon name="mail" /> Write email
          </SafeLink>
        )}
        {parsed.kind === 'phone' && dialable(parsed.number) && (
          <SafeLink href={`tel:${dialable(parsed.number)}`}>
            <Icon name="phone" /> Call
          </SafeLink>
        )}
        {parsed.kind === 'sms' && dialable(parsed.number) && (
          <SafeLink href={`sms:${dialable(parsed.number)}${parsed.message ? `?body=${encodeURIComponent(parsed.message)}` : ''}`}>
            <Icon name="message" /> Send text
          </SafeLink>
        )}
        {parsed.kind === 'location' && (
          <SafeLink
            href={`https://www.openstreetmap.org/?mlat=${parsed.latitude}&mlon=${parsed.longitude}#map=16/${parsed.latitude}/${parsed.longitude}`}
          >
            <Icon name="pin" /> Open map
          </SafeLink>
        )}
        {parsed.kind === 'event' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => downloadText(toCalendar(parsed), `${(parsed.title || 'event').replace(/[^\w-]+/g, '-')}.ics`, 'text/calendar')}
          >
            <Icon name="calendar" /> Add to calendar
          </button>
        )}
      </div>

      {parsed.kind !== 'text' && (
        <details className="disclosure">
          <summary>Raw data</summary>
          <pre className="result-text">
            {parsed.kind === 'wifi' && !showPassword ? code.text.replace(/(^WIFI:|;)P:(?:\\.|[^;\\])*/i, '$1P:••••••') : code.text}
          </pre>
        </details>
      )}
    </article>
  )
}

function Details({ parsed, showPassword }: { parsed: ParsedContent; showPassword: boolean }) {
  const rows: Array<[string, string]> = []
  switch (parsed.kind) {
    case 'text':
      return <pre className="result-text">{parsed.text}</pre>
    case 'url':
      return (
        <>
          <pre className="result-text">{parsed.url}</pre>
          <dl className="facts">
            <dt>Opens</dt>
            <dd className="mono">{new URL(parsed.url).hostname}</dd>
          </dl>
          {linkWarnings(parsed.url).map((warning) => (
            <p key={warning.id} className="status status-warn">
              <Icon name="alert" /> {warning.message}
            </p>
          ))}
        </>
      )
    case 'wifi':
      rows.push(['Network', parsed.ssid], ['Security', parsed.security === 'nopass' ? 'None' : parsed.security])
      if (parsed.password) rows.push(['Password', showPassword ? parsed.password : '•'.repeat(Math.min(parsed.password.length, 12))])
      if (parsed.hidden) rows.push(['Hidden', 'Yes'])
      break
    case 'contact':
      if (parsed.name) rows.push(['Name', parsed.name])
      if (parsed.organization) rows.push(['Organization', parsed.organization])
      if (parsed.title) rows.push(['Title', parsed.title])
      parsed.phones.forEach((p) => rows.push(['Phone', p]))
      parsed.emails.forEach((e) => rows.push(['Email', e]))
      parsed.urls.forEach((u) => rows.push(['Website', u]))
      if (parsed.address) rows.push(['Address', parsed.address])
      if (parsed.note) rows.push(['Note', parsed.note])
      break
    case 'email':
      rows.push(['To', parsed.to])
      if (parsed.subject) rows.push(['Subject', parsed.subject])
      if (parsed.body) rows.push(['Message', parsed.body])
      break
    case 'phone':
      rows.push(['Number', parsed.number])
      break
    case 'sms':
      rows.push(['To', parsed.number])
      if (parsed.message) rows.push(['Message', parsed.message])
      break
    case 'location':
      rows.push(['Latitude', String(parsed.latitude)], ['Longitude', String(parsed.longitude)])
      break
    case 'event':
      rows.push(['Event', parsed.title])
      if (parsed.start) rows.push(['Starts', parsed.start])
      if (parsed.end) rows.push(['Ends', parsed.end])
      if (parsed.location) rows.push(['Where', parsed.location])
      if (parsed.description) rows.push(['Details', parsed.description])
      break
  }
  return (
    <dl className="facts">
      {rows.map(([term, value], i) => (
        <div key={`${term}-${i}`} className="fact">
          <dt>{term}</dt>
          <dd className={term === 'Password' || term === 'Network' ? 'mono' : undefined}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const escapeText = (value: string) => value.replace(/([\\,;])/g, '\\$1').replace(/\r?\n/g, '\\n')

/** Rebuilt from parsed fields only, so a crafted code cannot smuggle extra properties into the file. */
function toVcard(parsed: Extract<ParsedContent, { kind: 'contact' }>): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeText(parsed.name || parsed.organization || 'Contact')}`]
  if (parsed.organization) lines.push(`ORG:${escapeText(parsed.organization)}`)
  if (parsed.title) lines.push(`TITLE:${escapeText(parsed.title)}`)
  parsed.phones.forEach((p) => lines.push(`TEL:${escapeText(p)}`))
  parsed.emails.forEach((e) => lines.push(`EMAIL:${escapeText(e)}`))
  parsed.urls.filter(isSafeLink).forEach((u) => lines.push(`URL:${escapeText(u)}`))
  if (parsed.address) lines.push(`ADR:;;${escapeText(parsed.address)};;;;`)
  if (parsed.note) lines.push(`NOTE:${escapeText(parsed.note)}`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

/** Rebuilt from parsed, validated fields only (no alarms, attendees or other extras). */
function toCalendar(parsed: Extract<ParsedContent, { kind: 'event' }>): string {
  const date = (name: string, value: string) => (/^\d{8}$/.test(value) ? `${name};VALUE=DATE:${value}` : `${name}:${value}`)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QR Studio//EN',
    'BEGIN:VEVENT',
    `UID:${stamp}-${Math.random().toString(36).slice(2)}@qr-studio`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeText(parsed.title || 'Event')}`,
  ]
  if (parsed.dtstart) lines.push(date('DTSTART', parsed.dtstart))
  if (parsed.dtend) lines.push(date('DTEND', parsed.dtend))
  if (parsed.location) lines.push(`LOCATION:${escapeText(parsed.location)}`)
  if (parsed.description) lines.push(`DESCRIPTION:${escapeText(parsed.description)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}
