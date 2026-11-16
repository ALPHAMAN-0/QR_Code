import { describe, expect, it } from 'vitest'
import { buildPayload, PayloadError } from './payloads.ts'

describe('buildPayload: text', () => {
  it('returns the text unchanged', () => {
    expect(buildPayload({ type: 'text', text: '  Hello\nworld ✓ ' })).toBe('  Hello\nworld ✓ ')
  })

  it('rejects empty text', () => {
    expect(() => buildPayload({ type: 'text', text: '' })).toThrow(PayloadError)
  })
})

describe('buildPayload: url', () => {
  it('keeps a full https URL', () => {
    expect(buildPayload({ type: 'url', url: 'https://example.com/a?b=1' })).toBe('https://example.com/a?b=1')
  })

  it('adds https:// when the scheme is missing', () => {
    expect(buildPayload({ type: 'url', url: ' example.com/page ' })).toBe('https://example.com/page')
  })

  it('keeps http:// links', () => {
    expect(buildPayload({ type: 'url', url: 'http://intranet.local' })).toBe('http://intranet.local')
  })

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd'])('rejects unsafe scheme %s', (url) => {
    expect(() => buildPayload({ type: 'url', url })).toThrow(/web address/i)
  })

  it('rejects text that is not a web address', () => {
    expect(() => buildPayload({ type: 'url', url: 'not a url' })).toThrow(PayloadError)
  })
})

describe('buildPayload: wifi', () => {
  it('builds a WPA network', () => {
    expect(buildPayload({ type: 'wifi', ssid: 'Home', password: 'secret123', security: 'WPA', hidden: false })).toBe(
      'WIFI:T:WPA;S:Home;P:secret123;;',
    )
  })

  it('escapes special characters in name and password', () => {
    expect(
      buildPayload({ type: 'wifi', ssid: 'My;Net,"1"', password: 'a:b\\c', security: 'WPA', hidden: false }),
    ).toBe('WIFI:T:WPA;S:My\\;Net\\,\\"1\\";P:a\\:b\\\\c;;')
  })

  it('omits the password for open networks and marks hidden ones', () => {
    expect(buildPayload({ type: 'wifi', ssid: 'Cafe', password: 'ignored', security: 'nopass', hidden: true })).toBe(
      'WIFI:T:nopass;S:Cafe;H:true;;',
    )
  })

  it('requires a network name', () => {
    expect(() => buildPayload({ type: 'wifi', ssid: '', password: '', security: 'nopass', hidden: false })).toThrow(
      /network name/i,
    )
  })

  it('requires a password for secured networks', () => {
    expect(() => buildPayload({ type: 'wifi', ssid: 'Home', password: '', security: 'WPA', hidden: false })).toThrow(
      /password/i,
    )
  })
})

describe('buildPayload: contact', () => {
  const base = {
    type: 'contact' as const,
    firstName: '',
    lastName: '',
    organization: '',
    title: '',
    phone: '',
    email: '',
    website: '',
    street: '',
    city: '',
    region: '',
    postcode: '',
    country: '',
    note: '',
  }

  it('builds a vCard 3.0 with CRLF line endings and only filled fields', () => {
    const vcard = buildPayload({ ...base, firstName: 'Ada', lastName: 'Lovelace', phone: '+44 20 1234', email: 'ada@example.com' })
    expect(vcard).toBe(
      [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'N:Lovelace;Ada;;;',
        'FN:Ada Lovelace',
        'TEL;TYPE=CELL:+44 20 1234',
        'EMAIL:ada@example.com',
        'END:VCARD',
      ].join('\r\n'),
    )
  })

  it('escapes commas, semicolons, backslashes and newlines', () => {
    const vcard = buildPayload({ ...base, organization: 'A, B; C\\D', note: 'line1\nline2' })
    expect(vcard).toContain('ORG:A\\, B\\; C\\\\D')
    expect(vcard).toContain('NOTE:line1\\nline2')
  })

  it('includes address, title and website', () => {
    const vcard = buildPayload({ ...base, firstName: 'A', title: 'CTO', website: 'example.com', street: '1 Main St', city: 'Dhaka', country: 'BD' })
    expect(vcard).toContain('TITLE:CTO')
    expect(vcard).toContain('URL:https://example.com')
    expect(vcard).toContain('ADR;TYPE=WORK:;;1 Main St;Dhaka;;;BD')
  })

  it('requires a name, organization, phone or email', () => {
    expect(() => buildPayload({ ...base, note: 'only a note' })).toThrow(PayloadError)
  })

  it('rejects an invalid email', () => {
    expect(() => buildPayload({ ...base, firstName: 'A', email: 'nope' })).toThrow(/email/i)
  })
})

describe('buildPayload: email', () => {
  it('builds a mailto link with encoded subject and body', () => {
    expect(buildPayload({ type: 'email', to: 'hi@example.com', subject: 'Hello & bye', body: 'Line 1\nLine 2' })).toBe(
      'mailto:hi@example.com?subject=Hello%20%26%20bye&body=Line%201%0ALine%202',
    )
  })

  it('omits empty subject and body', () => {
    expect(buildPayload({ type: 'email', to: 'hi@example.com', subject: '', body: '' })).toBe('mailto:hi@example.com')
  })

  it('rejects an invalid address', () => {
    expect(() => buildPayload({ type: 'email', to: 'hi@', subject: '', body: '' })).toThrow(/email/i)
  })
})

describe('buildPayload: phone and sms', () => {
  it('builds a tel link without spaces or dashes', () => {
    expect(buildPayload({ type: 'phone', number: '+880 17-1234 5678' })).toBe('tel:+8801712345678')
  })

  it('rejects numbers with letters', () => {
    expect(() => buildPayload({ type: 'phone', number: 'call me' })).toThrow(/phone/i)
  })

  it('builds an SMSTO payload', () => {
    expect(buildPayload({ type: 'sms', number: '+1 (555) 010-9999', message: 'On my way' })).toBe(
      'SMSTO:+15550109999:On my way',
    )
  })

  it('builds an SMSTO payload with no message', () => {
    expect(buildPayload({ type: 'sms', number: '12345', message: '' })).toBe('SMSTO:12345:')
  })
})

describe('buildPayload: location', () => {
  it('builds a geo URI', () => {
    expect(buildPayload({ type: 'location', latitude: '23.8103', longitude: '90.4125' })).toBe('geo:23.8103,90.4125')
  })

  it.each([
    ['91', '0'],
    ['0', '181'],
    ['abc', '0'],
    ['', ''],
  ])('rejects out-of-range or non-numeric coordinates (%s, %s)', (latitude, longitude) => {
    expect(() => buildPayload({ type: 'location', latitude, longitude })).toThrow(PayloadError)
  })
})

describe('buildPayload: event', () => {
  it('builds a VEVENT with local times', () => {
    expect(
      buildPayload({
        type: 'event',
        title: 'Launch; party',
        location: 'Dhaka',
        start: '2026-11-20T18:30',
        end: '2026-11-20T21:00',
        allDay: false,
        description: '',
      }),
    ).toBe(
      [
        'BEGIN:VEVENT',
        'SUMMARY:Launch\\; party',
        'DTSTART:20261120T183000',
        'DTEND:20261120T210000',
        'LOCATION:Dhaka',
        'END:VEVENT',
      ].join('\r\n'),
    )
  })

  it('builds an all-day event with an exclusive end date', () => {
    const event = buildPayload({
      type: 'event',
      title: 'Holiday',
      location: '',
      start: '2026-12-16',
      end: '',
      allDay: true,
      description: 'Victory Day',
    })
    expect(event).toContain('DTSTART;VALUE=DATE:20261216')
    expect(event).toContain('DTEND;VALUE=DATE:20261217')
    expect(event).toContain('DESCRIPTION:Victory Day')
  })

  it('rejects an end before the start', () => {
    expect(() =>
      buildPayload({
        type: 'event',
        title: 'X',
        location: '',
        start: '2026-11-20T18:30',
        end: '2026-11-20T08:00',
        allDay: false,
        description: '',
      }),
    ).toThrow(/end/i)
  })

  it('requires a title and a start', () => {
    expect(() =>
      buildPayload({ type: 'event', title: '', location: '', start: '', end: '', allDay: false, description: '' }),
    ).toThrow(PayloadError)
  })
})
