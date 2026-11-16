// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary.tsx'

let shouldThrow = true
function Fragile() {
  if (shouldThrow) throw new Error('boom')
  return <p>Recovered</p>
}

describe('ErrorBoundary', () => {
  it('contains a crash and lets the user try again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(
      <ErrorBoundary section="Scan">
        <Fragile />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong in Scan')
    shouldThrow = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Recovered')).toBeVisible()
  })
})
