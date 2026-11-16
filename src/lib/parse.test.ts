import { describe, expect, it } from 'vitest'
import { buildPayload } from './payloads.ts'
import { isSafeLink, parseContent } from './parse.ts'

describe('parseContent', () => {
  it('recognizes web links', () => {
    expect(parseContent('https://example.com/x')).toEqual({ kind: 'url', url: 'https://example.com/x', secure: true })
    expect(parseContent('HTTP://EXAMPLE.COM')).toMatchObject({ kind: 'url', secure: false })
  })

  it('treats www. addresses as links', () => {
    expect(parseContent('www.example.com')).toEqual({ kind: 'url', url: 'https://www.example.com', secure: true })
  })

  it.each(['javascript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:msgbox', 'file:///etc/passwd'])(
    'never treats %s as a link',
    (text) => {
      expect(parseContent(text)).toEqual({ kind: 'text', text })
    },
  )

  it('parses Wi-Fi payloads it built, including escapes', () => {
    const payload = buildPayload({ type: 'wifi', ssid: 'My;Net', password: 'p:w"d', security: 'WPA', hidden: true })
    expect(parseContent(payload)).toEqual({ kind: 'wifi', ssid: 'My;Net', password: 'p:w"d', security: 'WPA', hidden: true })
  })

  it('parses Wi-Fi fields in any order', () => {
    expect(parseContent('WIFI:S:Cafe;T:nopass;;')).toEqual({
      kind: 'wifi',
      ssid: 'Cafe',
      password: '',
      security: 'nopass',
      hidden: false,
    })
  })

  it('parses vCards', () => {
    const vcard = buildPayload({
      type: 'contact',
      firstName: 'Ada',
      lastName: 'Lovelace',
      organization: 'Engines, Ltd',
      title: '',
      phone: '+44 1',
      email: 'ada@example.com',
      website: 'https://ada.dev',
      street: '',
      city: '',
      region: '',
      postcode: '',
      country: '',
      note: '',
    })
    expect(parseContent(vcard)).toMatchObject({
      kind: 'contact',
      name: 'Ada Lovelace',
      organization: 'Engines, Ltd',
      phones: ['+44 1'],
      emails: ['ada@example.com'],
      urls: ['https://ada.dev'],
    })
  })

  it('parses MECARD contacts', () => {
    expect(parseContent('MECARD:N:Doe,John;TEL:12345;EMAIL:j@d.com;;')).toMatchObject({
      kind: 'contact',
      name: 'John Doe',
      phones: ['12345'],
      emails: ['j@d.com'],
    })
  })

  it('parses mailto and MATMSG email', () => {
    expect(parseContent('mailto:a@b.com?subject=Hi%20there&body=Yo')).toEqual({
      kind: 'email',
      to: 'a@b.com',
      subject: 'Hi there',
      body: 'Yo',
    })
    expect(parseContent('MATMSG:TO:a@b.com;SUB:Hi;BODY:Yo;;')).toEqual({ kind: 'email', to: 'a@b.com', subject: 'Hi', body: 'Yo' })
  })

  it('parses phone numbers', () => {
    expect(parseContent('tel:+8801712345678')).toEqual({ kind: 'phone', number: '+8801712345678' })
  })

  it('parses SMSTO and sms: links', () => {
    expect(parseContent('SMSTO:+1555:On my way: soon')).toEqual({ kind: 'sms', number: '+1555', message: 'On my way: soon' })
    expect(parseContent('sms:+1555?body=Hi%21')).toEqual({ kind: 'sms', number: '+1555', message: 'Hi!' })
  })

  it('parses geo URIs', () => {
    expect(parseContent('geo:23.8103,90.4125?q=Dhaka')).toEqual({ kind: 'location', latitude: 23.8103, longitude: 90.4125 })
  })

  it('parses calendar events', () => {
    const event = buildPayload({
      type: 'event',
      title: 'Launch',
      location: 'Dhaka',
      start: '2026-11-20T18:30',
      end: '2026-11-20T21:00',
      allDay: false,
      description: 'Bring cake',
    })
    expect(parseContent(event)).toEqual({
      kind: 'event',
      title: 'Launch',
      location: 'Dhaka',
      description: 'Bring cake',
      start: '2026-11-20 18:30',
      end: '2026-11-20 21:00',
    })
  })

  it('falls back to plain text', () => {
    expect(parseContent('9520123456788')).toEqual({ kind: 'text', text: '9520123456788' })
  })
})

describe('isSafeLink', () => {
  it.each([
    ['https://a.com', true],
    ['http://a.com', true],
    ['mailto:a@b.com', true],
    ['tel:+1', true],
    ['sms:+1', true],
    ['javascript:alert(1)', false],
    [' JavaScript:alert(1)', false],
    ['data:text/html,x', false],
    ['not a url', false],
  ])('%s -> %s', (href, expected) => {
    expect(isSafeLink(href)).toBe(expected)
  })
})
