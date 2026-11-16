// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { strFromU8, unzipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as files from '../../lib/files.ts'
import { stubBrowserApis } from '../../test/dom.ts'
import { BatchPanel } from './BatchPanel.tsx'

beforeEach(() => stubBrowserApis())

describe('BatchPanel', () => {
  it('makes one SVG per line, reports bad lines, and downloads a ZIP', async () => {
    const user = userEvent.setup()
    const download = vi.spyOn(files, 'downloadBlob').mockImplementation(() => undefined)
    const notify = vi.fn()
    render(<BatchPanel notify={notify} />)
    await user.selectOptions(screen.getByLabelText('Format'), 'ean13')
    await user.selectOptions(screen.getByLabelText('File type'), 'svg')
    await user.type(screen.getByLabelText('Values'), '9520123456788{enter}123{enter}4006381333931')
    await user.click(screen.getByRole('button', { name: /Make 3 codes/ }))

    expect(await screen.findByText(/2 of 3 made; 1 skipped/)).toBeVisible()
    expect(screen.getByText(/Line 2/)).toHaveTextContent('EAN-13 must be 12 or 13 digits')
    expect(download).toHaveBeenCalledTimes(1)
    const [blob, name] = download.mock.calls[0]!
    expect(name).toBe('ean13-codes.zip')
    const zip = unzipSync(new Uint8Array(await (blob as Blob).arrayBuffer()))
    expect(Object.keys(zip)).toEqual(['1-9520123456788.svg', '3-4006381333931.svg'])
    expect(strFromU8(zip['1-9520123456788.svg']!)).toMatch(/^<svg/)
    expect(notify).toHaveBeenCalledWith('ZIP saved with 2 codes')
  })
})
