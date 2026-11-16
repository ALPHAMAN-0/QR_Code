import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Icon } from '../../components/Icon.tsx'
import type { Content } from '../../lib/payloads.ts'

interface Props<C extends Content> {
  value: C
  onChange: (next: C) => void
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string, hintId?: string) => ReactNode }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id, hintId)}
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
}

function TextInput({
  label,
  hint,
  value,
  onChange,
  ...rest
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <Field label={label} hint={hint}>
      {(id, hintId) => (
        <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hintId} {...rest} />
      )}
    </Field>
  )
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <Field label={label}>
      {(id) => <textarea id={id} className="textarea" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  )
}

export function ContentFields({ value, onChange }: Props<Content>) {
  switch (value.type) {
    case 'url':
      return (
        <TextInput
          label="Web address"
          hint="https:// is added if you leave it out."
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="example.com"
          value={value.url}
          onChange={(url) => onChange({ ...value, url })}
        />
      )
    case 'text':
      return <TextArea label="Text" value={value.text} onChange={(text) => onChange({ ...value, text })} rows={5} />
    case 'wifi':
      return <WifiFields value={value} onChange={onChange} />
    case 'contact':
      return (
        <div className="stack">
          <div className="grid-2">
            <TextInput label="First name" autoComplete="given-name" value={value.firstName} onChange={(firstName) => onChange({ ...value, firstName })} />
            <TextInput label="Last name" autoComplete="family-name" value={value.lastName} onChange={(lastName) => onChange({ ...value, lastName })} />
            <TextInput label="Phone" type="tel" inputMode="tel" autoComplete="tel" value={value.phone} onChange={(phone) => onChange({ ...value, phone })} />
            <TextInput label="Email" type="email" inputMode="email" autoComplete="email" value={value.email} onChange={(email) => onChange({ ...value, email })} />
            <TextInput label="Organization" autoComplete="organization" value={value.organization} onChange={(organization) => onChange({ ...value, organization })} />
            <TextInput label="Job title" autoComplete="organization-title" value={value.title} onChange={(title) => onChange({ ...value, title })} />
          </div>
          <details className="disclosure">
            <summary>Website, address and note</summary>
            <div className="stack">
              <TextInput label="Website" type="url" inputMode="url" value={value.website} onChange={(website) => onChange({ ...value, website })} />
              <TextInput label="Street" autoComplete="street-address" value={value.street} onChange={(street) => onChange({ ...value, street })} />
              <div className="grid-2">
                <TextInput label="City" autoComplete="address-level2" value={value.city} onChange={(city) => onChange({ ...value, city })} />
                <TextInput label="State or region" autoComplete="address-level1" value={value.region} onChange={(region) => onChange({ ...value, region })} />
                <TextInput label="Postcode" autoComplete="postal-code" value={value.postcode} onChange={(postcode) => onChange({ ...value, postcode })} />
                <TextInput label="Country" autoComplete="country-name" value={value.country} onChange={(country) => onChange({ ...value, country })} />
              </div>
              <TextArea label="Note" value={value.note} onChange={(note) => onChange({ ...value, note })} rows={3} />
            </div>
          </details>
        </div>
      )
    case 'email':
      return (
        <div className="stack">
          <TextInput label="To" type="email" inputMode="email" placeholder="name@example.com" value={value.to} onChange={(to) => onChange({ ...value, to })} />
          <TextInput label="Subject" value={value.subject} onChange={(subject) => onChange({ ...value, subject })} />
          <TextArea label="Message" value={value.body} onChange={(body) => onChange({ ...value, body })} />
        </div>
      )
    case 'phone':
      return (
        <TextInput
          label="Phone number"
          hint="Include the country code, e.g. +44 20 7946 0000."
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value.number}
          onChange={(number) => onChange({ ...value, number })}
        />
      )
    case 'sms':
      return (
        <div className="stack">
          <TextInput label="Phone number" type="tel" inputMode="tel" value={value.number} onChange={(number) => onChange({ ...value, number })} />
          <TextArea label="Message" value={value.message} onChange={(message) => onChange({ ...value, message })} rows={3} />
        </div>
      )
    case 'location':
      return <LocationFields value={value} onChange={onChange} />
    case 'event':
      return (
        <div className="stack">
          <TextInput label="Event title" value={value.title} onChange={(title) => onChange({ ...value, title })} />
          <TextInput label="Where" value={value.location} onChange={(location) => onChange({ ...value, location })} />
          <label className="check">
            <input
              type="checkbox"
              checked={value.allDay}
              onChange={(e) => onChange({ ...value, allDay: e.target.checked, start: value.start.slice(0, 10), end: value.end.slice(0, 10) })}
            />
            All-day event
          </label>
          <div className="grid-2">
            <TextInput label="Starts" type={value.allDay ? 'date' : 'datetime-local'} value={value.start} onChange={(start) => onChange({ ...value, start })} />
            <TextInput label="Ends" type={value.allDay ? 'date' : 'datetime-local'} value={value.end} onChange={(end) => onChange({ ...value, end })} />
          </div>
          <TextArea label="Description" value={value.description} onChange={(description) => onChange({ ...value, description })} rows={3} />
        </div>
      )
  }
}

function WifiFields({ value, onChange }: Props<Extract<Content, { type: 'wifi' }>>) {
  const [show, setShow] = useState(false)
  const passwordId = useId()
  return (
    <div className="stack">
      <div className="grid-2">
        <TextInput label="Network name (SSID)" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={value.ssid} onChange={(ssid) => onChange({ ...value, ssid })} />
        <Field label="Security">
          {(id) => (
            <select id={id} className="select" value={value.security} onChange={(e) => onChange({ ...value, security: e.target.value as typeof value.security })}>
              <option value="WPA">WPA / WPA2 / WPA3</option>
              <option value="WEP">WEP (old)</option>
              <option value="nopass">None (open network)</option>
            </select>
          )}
        </Field>
      </div>
      {value.security !== 'nopass' && (
        <div className="field">
          <label htmlFor={passwordId}>Password</label>
          <div className="color-row">
            <input
              id={passwordId}
              className="input"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={value.password}
              onChange={(e) => onChange({ ...value, password: e.target.value })}
            />
            <button type="button" className="btn btn-icon" aria-pressed={show} onClick={() => setShow((s) => !s)}>
              <Icon name={show ? 'eyeOff' : 'eye'} label={show ? 'Hide password' : 'Show password'} />
            </button>
          </div>
        </div>
      )}
      <label className="check">
        <input type="checkbox" checked={value.hidden} onChange={(e) => onChange({ ...value, hidden: e.target.checked })} />
        Hidden network
      </label>
    </div>
  )
}

function LocationFields({ value, onChange }: Props<Extract<Content, { type: 'location' }>>) {
  const [status, setStatus] = useState('')
  const locate = () => {
    if (!navigator.geolocation) {
      setStatus('This browser cannot share its location.')
      return
    }
    setStatus('Finding your location…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange({ ...value, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })
        setStatus('Location filled in.')
      },
      () => setStatus('Location permission was denied or unavailable.'),
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }
  return (
    <div className="stack">
      <div className="grid-2">
        <TextInput label="Latitude" inputMode="decimal" placeholder="23.8103" value={value.latitude} onChange={(latitude) => onChange({ ...value, latitude })} />
        <TextInput label="Longitude" inputMode="decimal" placeholder="90.4125" value={value.longitude} onChange={(longitude) => onChange({ ...value, longitude })} />
      </div>
      <div className="btn-row">
        <button type="button" className="btn" onClick={locate}>
          <Icon name="pin" /> Use my location
        </button>
      </div>
      <p className="hint" aria-live="polite">
        {status}
      </p>
    </div>
  )
}
