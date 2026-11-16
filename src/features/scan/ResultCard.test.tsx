// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResultCard } from './ResultCard.tsx'

const show = (text: string, format = 'QRCode', label = 'QR Code') => render(<ResultCard code={{ format, label, text }} notify={vi.fn()} />)

describe('ResultCard', () => {
  it('offers to open https links in a new tab without leaking the opener', () => {
    show('https://example.com/a')
    const link = screen.getByRole('link', { name: /Open link/ })
    expect(link).toHaveAttribute('href', 'https://example.com/a')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('warns about unencrypted http links', () => {
    show('http://example.com')
    expect(screen.getByText(/isn’t encrypted/)).toBeVisible()
  })

  it.each(['javascript:alert(document.cookie)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x'])(
    'shows %s as plain text and never as a link',
    (text) => {
      show(text)
      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.getByText(text)).toBeVisible()
    },
  )

  it('hides Wi-Fi passwords until asked', async () => {
    const user = userEvent.setup()
    show('WIFI:T:WPA;S:Cafe;P:hunter2;;')
    expect(screen.getByText('Cafe')).toBeVisible()
    expect(screen.queryByText('hunter2')).toBeNull()
    expect(screen.getByText('WIFI:T:WPA;S:Cafe;P:••••••;;')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Show password/ }))
    expect(screen.getByText('hunter2')).toBeVisible()
    expect(screen.getByText('WIFI:T:WPA;S:Cafe;P:hunter2;;')).toBeInTheDocument()
  })

  it('builds call and text links only from digits', () => {
    show('tel:+1 (555) 010-9999;javascript:x')
    expect(screen.getByRole('link', { name: /Call/ })).toHaveAttribute('href', 'tel:+15550109999')
  })

  it('opens locations on OpenStreetMap', () => {
    show('geo:23.81,90.41')
    expect(screen.getByRole('link', { name: /Open map/ }).getAttribute('href')).toMatch(
      /^https:\/\/www\.openstreetmap\.org\/\?mlat=23\.81&mlon=90\.41/,
    )
  })

  it('labels the barcode format and content type', () => {
    show('9520123456788', 'EAN13', 'EAN-13')
    expect(screen.getByText('EAN-13')).toBeVisible()
    expect(screen.getByText('Text')).toBeVisible()
  })
})

describe('ResultCard structured content', () => {
  it('saves contacts as .vcf files', async () => {
    const files = await import('../../lib/files.ts')
    const save = vi.spyOn(files, 'downloadText').mockImplementation(() => undefined)
    const user = userEvent.setup()
    show('MECARD:N:Doe,John;TEL:123;EMAIL:j@d.com;URL:https://j.dev;ADR:Main St;NOTE:Hi;;')
    expect(screen.getByText('John Doe')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Save contact/ }))
    const [text, name, type] = save.mock.calls[0]!
    expect(text).toContain('FN:John Doe')
    expect(text).toContain('TEL:123')
    expect(name).toBe('John-Doe.vcf')
    expect(type).toBe('text/vcard')
  })

  it('keeps name, organization and title when saving a vCard', async () => {
    const files = await import('../../lib/files.ts')
    const save = vi.spyOn(files, 'downloadText').mockImplementation(() => undefined)
    const user = userEvent.setup()
    show('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ada\r\nORG:Engines\r\nTITLE:CTO\r\nEND:VCARD')
    await user.click(screen.getByRole('button', { name: /Save contact/ }))
    expect(save.mock.calls[0]![0]).toBe(['BEGIN:VCARD', 'VERSION:3.0', 'FN:Ada', 'ORG:Engines', 'TITLE:CTO', 'END:VCARD'].join('\r\n'))
  })

  it('writes emails and texts with encoded content', () => {
    show('MATMSG:TO:a@b.com;SUB:Hi there;BODY:Yo & co;;')
    expect(screen.getByRole('link', { name: /Write email/ })).toHaveAttribute(
      'href',
      'mailto:a@b.com?subject=Hi%20there&body=Yo%20%26%20co',
    )
  })

  it('sends texts to sanitized numbers', () => {
    show('SMSTO:+1 555:See you')
    expect(screen.getByRole('link', { name: /Send text/ })).toHaveAttribute('href', 'sms:+1555?body=See%20you')
  })

  it('adds events to the calendar as .ics', async () => {
    const files = await import('../../lib/files.ts')
    const save = vi.spyOn(files, 'downloadText').mockImplementation(() => undefined)
    const user = userEvent.setup()
    show('BEGIN:VEVENT\nSUMMARY:Launch\nDTSTART:20261120T183000\nDTEND:20261120T200000\nLOCATION:Dhaka\nDESCRIPTION:Cake\nEND:VEVENT')
    expect(screen.getByText('2026-11-20 18:30')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Add to calendar/ }))
    const [text, name] = save.mock.calls[0]!
    expect(text).toMatch(/^BEGIN:VCALENDAR\r\nVERSION:2.0/)
    expect(name).toBe('Launch.ics')
  })

  it('copies the decoded text and reports blocked clipboards', async () => {
    const files = await import('../../lib/files.ts')
    const user = userEvent.setup()
    const notify = vi.fn()
    vi.spyOn(files, 'copyText').mockResolvedValueOnce().mockRejectedValueOnce(new Error('no'))
    render(<ResultCard code={{ format: 'QRCode', label: 'QR Code', text: 'hello' }} notify={notify} />)
    await user.click(screen.getByRole('button', { name: /^Copy$/ }))
    expect(notify).toHaveBeenLastCalledWith('Text copied')
    await user.click(screen.getByRole('button', { name: /^Copy$/ }))
    expect(notify).toHaveBeenLastCalledWith(expect.stringMatching(/blocked/))
  })

  it('copies Wi-Fi passwords and shows raw data for structured content', async () => {
    const files = await import('../../lib/files.ts')
    const copy = vi.spyOn(files, 'copyText').mockResolvedValue()
    const user = userEvent.setup()
    show('WIFI:T:WEP;S:Old;P:abc;H:true;;')
    expect(screen.getByText('Hidden')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Copy password/ }))
    expect(copy).toHaveBeenCalledWith('abc')
    expect(screen.getByText('Raw data')).toBeVisible()
  })
})

describe('review fix: hardened results', () => {
  it('shows where a link really goes and warns about user-info tricks', () => {
    show('https://paypal.com@evil.example/login')
    expect(screen.getByText('evil.example')).toBeVisible()
    expect(screen.getByText(/really goes to/i)).toBeVisible()
  })

  it('rebuilds calendar files from the parsed event so extra fields are dropped', async () => {
    const files = await import('../../lib/files.ts')
    const save = vi.spyOn(files, 'downloadText').mockImplementation(() => undefined)
    const user = userEvent.setup()
    show('BEGIN:VEVENT\nSUMMARY:Launch\nDTSTART:20261120T183000\nATTENDEE:mailto:evil@example.com\nBEGIN:VALARM\nACTION:DISPLAY\nEND:VALARM\nEND:VEVENT')
    await user.click(screen.getByRole('button', { name: /Add to calendar/ }))
    const ics = save.mock.calls[0]![0] as string
    expect(ics).toContain('SUMMARY:Launch')
    expect(ics).toContain('DTSTART:20261120T183000')
    expect(ics).not.toMatch(/ATTENDEE|VALARM/)
  })

  it('rebuilds contact files from the parsed fields', async () => {
    const files = await import('../../lib/files.ts')
    const save = vi.spyOn(files, 'downloadText').mockImplementation(() => undefined)
    const user = userEvent.setup()
    show('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ada\r\nX-EVIL:payload\r\nPHOTO;VALUE=URI:https://tracker.example/p.png\r\nEND:VCARD')
    await user.click(screen.getByRole('button', { name: /Save contact/ }))
    const vcf = save.mock.calls[0]![0] as string
    expect(vcf).toContain('FN:Ada')
    expect(vcf).not.toMatch(/X-EVIL|PHOTO|tracker/)
  })
})
