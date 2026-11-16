import { expect, test } from '@playwright/test'

test.describe('Create', () => {
  test('a typed link becomes a QR code that our own reader verifies', async ({ page }) => {
    await page.goto('./')
    await page.getByLabel('Web address').fill('example.com/hello')
    await expect(page.getByRole('img', { name: 'QR Code for: https://example.com/hello' })).toBeVisible()
    await expect(page.getByText('Scans correctly')).toBeVisible({ timeout: 15_000 })
  })

  test('the downloaded PNG scans back to the same link', async ({ page }) => {
    await page.goto('./')
    await page.getByLabel('Web address').fill('example.com/round-trip')
    await expect(page.getByText('Scans correctly')).toBeVisible({ timeout: 15_000 })
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PNG' }).click()])
    expect(download.suggestedFilename()).toBe('example-com-round-trip-qrcode.png')
    const file = test.info().outputPath('code.png')
    await download.saveAs(file)

    await page.getByRole('tab', { name: 'Scan' }).click()
    await page.locator('#scan-file').setInputFiles(file)
    await expect(page.getByText('1 code found')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', 'https://example.com/round-trip')
  })

  test('every quick format draws and passes the read-back check', async ({ page }) => {
    await page.goto('./')
    for (const name of ['Data Matrix', 'Aztec Code', 'PDF417', 'EAN-13', 'UPC-A', 'Code 128', 'Code 39']) {
      await page.getByRole('radio', { name, exact: true }).check()
      await expect(page.getByRole('img', { name: new RegExp(`^${name} for:`) })).toBeVisible()
      await expect(page.getByText('Scans correctly')).toBeVisible({ timeout: 15_000 })
    }
  })

  test('a QR code with a logo still scans', async ({ page }) => {
    await page.goto('./')
    await page.getByLabel('Web address').fill('example.com/logo')
    await page.locator('input[type=file][accept^="image/png"]').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      // 1×1 red pixel
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'),
    })
    await expect(page.getByRole('img', { name: 'Current logo' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'High (30%)' })).toBeChecked()
    await expect(page.getByText('Scans correctly')).toBeVisible({ timeout: 15_000 })
  })

  test('a batch of values downloads as a ZIP', async ({ page }) => {
    await page.goto('./#batch')
    await page.getByLabel('Values').fill('https://a.example\nhttps://b.example\nhttps://c.example')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Make 3 codes/ }).click()])
    expect(download.suggestedFilename()).toBe('qrcode-codes.zip')
    await expect(page.getByText('3 of 3 made.')).toBeVisible()
  })
})
