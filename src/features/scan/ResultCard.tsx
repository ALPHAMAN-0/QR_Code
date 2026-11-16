import { useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon.tsx'
import type { DecodedCode } from '../../lib/readback.ts'
import { copyText, downloadText } from '../../lib/files.ts'
import { isSafeLink, parseContent, type ParsedContent } from '../../lib/parse.ts'

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

function SafeLink({ href, children }: { href: string; children: ReactNode }) {
  if (!isSafeLink(href)) return null
  const external = /^https?:/i.test(href)
  return (
    <a className="btn btn-primary" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
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
          <SafeLink href={parsed.url}>
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
            onClick={() => downloadText(toVcard(code.text, parsed), `${(parsed.name || 'contact').replace(/[^\w-]+/g, '-')}.vcf`, 'text/vcard')}
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
            onClick={() => downloadText(toCalendar(code.text), `${(parsed.title || 'event').replace(/[^\w-]+/g, '-')}.ics`, 'text/calendar')}
          >
            <Icon name="calendar" /> Add to calendar
          </button>
        )}
      </div>

      {parsed.kind !== 'text' && (
        <details className="disclosure">
          <summary>Raw data</summary>
          <pre className="result-text">{code.text}</pre>
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
          {!parsed.secure && (
            <p className="status status-warn">
              <Icon name="alert" /> This link isn’t encrypted (http). Only open it if you trust where the code came from.
            </p>
          )}
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

function toVcard(raw: string, parsed: Extract<ParsedContent, { kind: 'contact' }>): string {
  if (/^BEGIN:VCARD/i.test(raw.trim())) return raw
  const esc = (v: string) => v.replace(/([\\,;])/g, '\\$1').replace(/\r?\n/g, '\\n')
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(parsed.name || parsed.organization || 'Contact')}`]
  if (parsed.organization) lines.push(`ORG:${esc(parsed.organization)}`)
  parsed.phones.forEach((p) => lines.push(`TEL:${esc(p)}`))
  parsed.emails.forEach((e) => lines.push(`EMAIL:${esc(e)}`))
  parsed.urls.forEach((u) => lines.push(`URL:${esc(u)}`))
  if (parsed.address) lines.push(`ADR:;;${esc(parsed.address)};;;;`)
  if (parsed.note) lines.push(`NOTE:${esc(parsed.note)}`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

function toCalendar(raw: string): string {
  const text = raw.trim()
  if (/^BEGIN:VCALENDAR/i.test(text)) return text
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//QR Studio//EN', text.replace(/\r?\n/g, '\r\n'), 'END:VCALENDAR'].join('\r\n')
}
