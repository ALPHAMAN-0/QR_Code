import { expect, test } from '@playwright/test'
import { CAMERA_TEXT, fixture } from './fixtures.ts'

test.describe('Scan from images', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./#scan')
  })

  for (const [file, format, text] of [
    ['ean13.png', 'EAN-13', '4006381333931'],
    ['datamatrix.png', 'Data Matrix', 'Data Matrix e2e'],
    ['pdf417.png', 'PDF417', 'PDF417 e2e'],
  ] as const) {
    test(`reads ${format}`, async ({ page }) => {
      await page.locator('#scan-file').setInputFiles(fixture(file))
      await expect(page.getByText('1 code found')).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('.chip', { hasText: format })).toBeVisible()
      await expect(page.locator('.result-text', { hasText: text })).toBeVisible()
    })
  }

  test('understands Wi-Fi codes and hides the password', async ({ page }) => {
    await page.locator('#scan-file').setInputFiles(fixture('qr-wifi.png'))
    await expect(page.getByText('Cafe Net')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('s3cret!')).toBeHidden()
    await page.getByRole('button', { name: 'Show password' }).click()
    await expect(page.getByText('s3cret!', { exact: true })).toBeVisible()
  })

  test('rejects a non-image file', async ({ page }) => {
    await page.locator('#scan-file').setInputFiles(fixture('not-an-image.txt'))
    await expect(page.getByText('That file is not an image')).toBeVisible()
  })
})

test.describe('Scan with the camera', () => {
  test.use({
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${fixture('camera.mjpeg')}`],
    },
  })

  test('finds a QR code in the live camera feed and releases the camera', async ({ page }) => {
    await page.goto('./#scan')
    await page.getByRole('button', { name: 'Start camera' }).click()
    await expect(page.getByText('1 code found')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', CAMERA_TEXT)
    await expect(page.getByRole('button', { name: 'Scan again' })).toBeVisible()
    const liveTracks = await page.evaluate(() => {
      const video = document.querySelector('video')
      return video?.srcObject ? (video.srcObject as MediaStream).getTracks().filter((t) => t.readyState === 'live').length : 0
    })
    expect(liveTracks).toBe(0)
  })
})
