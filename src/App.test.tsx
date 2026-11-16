// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App.tsx'
import { stubBrowserApis } from './test/dom.ts'

beforeEach(() => {
  stubBrowserApis()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('App shell', () => {
  it('opens on Create with four sections in a tab list', () => {
    render(<App />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Create', 'Scan', 'Batch', 'History'])
    expect(screen.getByRole('tab', { name: 'Create' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { level: 1, name: 'Make a QR code or barcode' })).toBeVisible()
  })

  it('moves between tabs with arrow keys, Home and End', async () => {
    const user = userEvent.setup()
    render(<App />)
    screen.getByRole('tab', { name: 'Create' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Scan' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Scan' })).toHaveAttribute('aria-selected', 'true')
    expect(window.location.hash).toBe('#scan')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'History' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Create' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}{Home}')
    expect(screen.getByRole('tab', { name: 'Create' })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens the section named in the URL hash', () => {
    window.history.replaceState(null, '', '/#history')
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeVisible()
  })
})

describe('Create', () => {
  it('draws a QR code as the user types a link', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText('Your code appears here as you type.')).toBeVisible()
    await user.type(screen.getByLabelText('Web address'), 'example.com')
    const image = await screen.findByRole('img', { name: /QR Code for: https:\/\/example\.com/ })
    expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
    expect(screen.getByRole('button', { name: /Download PNG/ })).toBeEnabled()
  })

  it('explains invalid input instead of drawing', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Web address'), 'javascript:alert(1)')
    expect(await screen.findByText(/Only http:\/\/ and https:\/\//)).toBeVisible()
    expect(screen.queryByRole('img', { name: /QR Code for/ })).toBeNull()
  })

  it('switches to a barcode format and validates its value', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('radio', { name: 'EAN-13' }))
    const value = screen.getByLabelText('Value to encode')
    expect(value).toHaveValue('9520123456788')
    expect(await screen.findByRole('img', { name: /EAN-13 for: 9520123456788/ })).toBeVisible()
    await user.clear(value)
    await user.type(value, '123')
    expect(await screen.findByText('EAN-13 must be 12 or 13 digits')).toBeVisible()
    expect(value).toHaveAttribute('aria-invalid', 'true')
  })

  it('builds Wi-Fi codes from the form', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('radio', { name: 'Wi-Fi' }))
    await user.type(screen.getByLabelText('Network name (SSID)'), 'Home')
    await user.type(screen.getByLabelText('Password'), 'secret')
    expect(await screen.findByRole('img', { name: 'QR Code for: WIFI:T:WPA;S:Home;P:secret;;' })).toBeVisible()
  })

  it('offers every format in the full list, grouped by category', () => {
    render(<App />)
    const select = screen.getByLabelText('All formats')
    expect(within(select).getAllByRole('option').length).toBeGreaterThanOrEqual(100)
    expect(within(select).getByRole('group', { name: 'Postal' })).toBeInTheDocument()
  })
})

describe('History', () => {
  it('reopens a scanned barcode in the editor with its own format', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      'qr-studio:history:v1',
      JSON.stringify([{ id: 'a', kind: 'scanned', format: 'EAN-13', symbology: 'ean13', text: '4006381333931', createdAt: 1 }]),
    )
    window.history.replaceState(null, '', '/#history')
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Open “4006381333931” in the editor/ }))
    expect(screen.getByRole('tab', { name: 'Create' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Value to encode')).toHaveValue('4006381333931')
    expect(screen.getByLabelText('All formats')).toHaveValue('ean13')
  })

  it('clears everything only after a second press', async () => {
    const user = userEvent.setup()
    localStorage.setItem('qr-studio:history:v1', JSON.stringify([{ id: 'a', kind: 'created', format: 'QR Code', text: 'hi', createdAt: 1 }]))
    window.history.replaceState(null, '', '/#history')
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Clear all/ }))
    expect(screen.getByText('hi')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Press again to clear all/ }))
    expect(screen.queryByText('hi')).toBeNull()
    expect(localStorage.getItem('qr-studio:history:v1')).toBeNull()
  })

  it('stops saving when switched off', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/#history')
    render(<App />)
    await user.click(screen.getByRole('checkbox', { name: 'Save history' }))
    expect(screen.getByText('History is off. Nothing is being saved.')).toBeVisible()
    expect(localStorage.getItem('qr-studio:history-enabled:v1')).toBe('false')
  })
})
