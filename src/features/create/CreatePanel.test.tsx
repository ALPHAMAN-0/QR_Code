// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { stubBrowserApis } from '../../test/dom.ts'
import { CreatePanel } from './CreatePanel.tsx'

beforeEach(() => stubBrowserApis())

const setup = () => {
  const user = userEvent.setup()
  const onCreated = vi.fn()
  const notify = vi.fn()
  render(<CreatePanel onCreated={onCreated} notify={notify} />)
  return { user, onCreated, notify }
}
const preview = (text: string | RegExp) => screen.findByRole('img', { name: typeof text === 'string' ? `QR Code for: ${text}` : text })

describe('content templates', () => {
  it('text', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('radio', { name: 'Text' }))
    await user.type(screen.getByRole('textbox', { name: 'Text' }), 'Hello')
    expect(await preview('Hello')).toBeVisible()
  })

  it('contact card with the extra details section', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('radio', { name: 'Contact' }))
    await user.type(screen.getByLabelText('First name'), 'Ada')
    await user.type(screen.getByLabelText('Last name'), 'Lovelace')
    await user.type(screen.getByRole('textbox', { name: 'Phone' }), '+44 1')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'ada@example.com')
    await user.type(screen.getByLabelText('Organization'), 'Engines')
    await user.type(screen.getByLabelText('Job title'), 'CTO')
    await user.click(screen.getByText('Website, address and note'))
    await user.type(screen.getByLabelText('Website'), 'ada.dev')
    await user.type(screen.getByLabelText('Street'), '1 Main St')
    await user.type(screen.getByLabelText('City'), 'London')
    await user.type(screen.getByLabelText('State or region'), 'LDN')
    await user.type(screen.getByLabelText('Postcode'), 'N1')
    await user.type(screen.getByLabelText('Country'), 'UK')
    await user.type(screen.getByLabelText('Note'), 'Hi')
    const img = await preview(/BEGIN:VCARD/)
    expect(img.getAttribute('alt')).toContain('FN:Ada Lovelace')
  })

  it('email', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('radio', { name: 'Email' }))
    await user.type(screen.getByLabelText('To'), 'a@b.co')
    await user.type(screen.getByLabelText('Subject'), 'Hi')
    await user.type(screen.getByLabelText('Message'), 'Yo')
    expect(await preview('mailto:a@b.co?subject=Hi&body=Yo')).toBeVisible()
  })

  it('phone and SMS', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('radio', { name: 'Phone' }))
    await user.type(screen.getByLabelText('Phone number'), '+1 555')
    expect(await preview('tel:+1555')).toBeVisible()
    await user.click(screen.getByRole('radio', { name: 'SMS' }))
    await user.type(screen.getByLabelText('Phone number'), '12345')
    await user.type(screen.getByLabelText('Message'), 'On my way')
    expect(await preview('SMSTO:12345:On my way')).toBeVisible()
  })

  it('location, including "Use my location"', async () => {
    const { user } = setup()
    const getCurrentPosition = vi.fn((ok: PositionCallback) => ok({ coords: { latitude: 23.81, longitude: 90.41 } } as GeolocationPosition))
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
    await user.click(screen.getByRole('radio', { name: 'Location' }))
    await user.click(screen.getByRole('button', { name: /Use my location/ }))
    expect(screen.getByText('Location filled in.')).toBeVisible()
    expect(await preview('geo:23.81,90.41')).toBeVisible()
  })

  it('location permission denied', async () => {
    const { user } = setup()
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) => fail({} as GeolocationPositionError) },
      configurable: true,
    })
    await user.click(screen.getByRole('radio', { name: 'Location' }))
    await user.click(screen.getByRole('button', { name: /Use my location/ }))
    expect(screen.getByText(/denied or unavailable/)).toBeVisible()
  })

  it('timed and all-day events', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('radio', { name: 'Event' }))
    await user.type(screen.getByLabelText('Event title'), 'Launch')
    await user.type(screen.getByLabelText('Where'), 'Dhaka')
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-11-20T18:30' } })
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-11-20T20:00' } })
    await user.type(screen.getByLabelText('Description'), 'Cake')
    expect(await preview(/DTSTART:20261120T183000/)).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'All-day event' }))
    expect(await preview(/DTSTART;VALUE=DATE:20261120/)).toBeVisible()
  })

  it('Wi-Fi password visibility and open networks', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('radio', { name: 'Wi-Fi' }))
    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    await user.type(screen.getByLabelText('Network name (SSID)'), 'Cafe')
    await user.selectOptions(screen.getByLabelText('Security'), 'nopass')
    await user.click(screen.getByRole('checkbox', { name: 'Hidden network' }))
    expect(screen.queryByLabelText('Password')).toBeNull()
    expect(await preview('WIFI:T:nopass;S:Cafe;H:true;;')).toBeVisible()
  })
})

describe('style controls', () => {
  it('changes colors, warns on low contrast, swaps and resets', async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText('Web address'), 'example.com')
    await preview('https://example.com')
    fireEvent.change(screen.getByLabelText('Code color'), { target: { value: '#cccccc' } })
    expect(await screen.findByText(/Low contrast/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Swap colors' }))
    expect(await screen.findByText(/Light-on-dark codes/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Reset style' }))
    expect(screen.queryByText(/Low contrast|Light-on-dark/)).toBeNull()
  })

  it('supports a transparent background, size, quiet zone and error correction', async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText('Web address'), 'example.com')
    const before = (await preview('https://example.com')).getAttribute('width')
    await user.click(screen.getByRole('checkbox', { name: 'Transparent background' }))
    expect(screen.getByLabelText('Background')).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Image size'), '256')
    const after = (await preview('https://example.com')).getAttribute('width')
    expect(Number(after)).toBeLessThan(Number(before))
    fireEvent.change(screen.getByRole('slider', { name: /Quiet zone/ }), { target: { value: '0' } })
    expect(screen.getByRole('slider', { name: /Quiet zone/ })).toHaveValue('0')
    await user.click(screen.getByRole('radio', { name: 'High (30%)' }))
    expect(screen.getByRole('radio', { name: 'High (30%)' })).toBeChecked()
  })

  it('adds and removes a logo, forcing high error correction', async () => {
    const { user } = setup()
    const files = await import('../../lib/files.ts')
    vi.spyOn(files, 'logoFromFile').mockResolvedValue('data:image/png;base64,AAAA')
    await user.type(screen.getByLabelText('Web address'), 'example.com')
    await user.upload(screen.getByLabelText(/Add logo/), new File(['x'], 'logo.png', { type: 'image/png' }))
    expect(await screen.findByRole('img', { name: 'Current logo' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'High (30%)' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Low (7%)' })).toBeDisabled()
    fireEvent.change(screen.getByRole('slider', { name: /Logo size/ }), { target: { value: '30' } })
    expect(screen.getByText('30%')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Remove/ }))
    expect(screen.queryByRole('img', { name: 'Current logo' })).toBeNull()
  })

  it('shows a readable error when the logo cannot be used', async () => {
    const { user } = setup()
    const files = await import('../../lib/files.ts')
    vi.spyOn(files, 'logoFromFile').mockRejectedValue(new Error('That image could not be opened.'))
    await user.upload(screen.getByLabelText(/Add logo/), new File(['x'], 'logo.png', { type: 'image/png' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That image could not be opened.')
  })

  it('hides the human-readable text on linear codes when asked', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('radio', { name: 'Code 128' }))
    const box = screen.getByRole('checkbox', { name: /Show the value as text/ })
    expect(box).toBeChecked()
    await user.click(box)
    expect(box).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Use example' }))
    expect(screen.getByLabelText('Value to encode')).toHaveValue('Count01234567!')
  })
})

describe('actions', () => {
  it('saves SVG, copies the encoded text, records history and confirms', async () => {
    const { user, onCreated, notify } = setup()
    const files = await import('../../lib/files.ts')
    const download = vi.spyOn(files, 'downloadBlob').mockImplementation(() => undefined)
    const copy = vi.spyOn(files, 'copyText').mockResolvedValue()
    const print = vi.spyOn(files, 'printPage').mockImplementation(() => undefined)
    await user.type(screen.getByLabelText('Web address'), 'example.com')
    await preview('https://example.com')
    await user.click(screen.getByRole('button', { name: 'SVG' }))
    expect(download.mock.calls[0]?.[1]).toBe('example-com-qrcode.svg')
    expect(onCreated).toHaveBeenCalledWith({ kind: 'created', format: 'QR Code', symbology: 'qrcode', text: 'https://example.com' })
    expect(notify).toHaveBeenCalledWith('SVG saved')
    await user.click(screen.getByRole('button', { name: /Copy text/ }))
    expect(copy).toHaveBeenCalledWith('https://example.com')
    await user.click(screen.getByRole('button', { name: /Print/ }))
    expect(print).toHaveBeenCalled()
  })

  it('reports failures from actions instead of crashing', async () => {
    const { user, notify } = setup()
    const files = await import('../../lib/files.ts')
    vi.spyOn(files, 'copyText').mockRejectedValue(new Error('Clipboard blocked'))
    await user.type(screen.getByLabelText('Web address'), 'example.com')
    await preview('https://example.com')
    await user.click(screen.getByRole('button', { name: /Copy text/ }))
    expect(notify).toHaveBeenCalledWith('Clipboard blocked')
  })
})
