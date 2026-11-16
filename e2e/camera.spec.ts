import { expect, test } from '@playwright/test'
import { CAMERA_TEXT, fixture } from './fixtures.ts'

// Chromium replays e2e/.fixtures/camera.mjpeg (drawn in global-setup) as the webcam.
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
