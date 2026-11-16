// Draws the test images (and a fake camera feed) once, before the browser tests run.
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import bwipjs from 'bwip-js/node'
import { CAMERA_TEXT, FIXTURES, fixture } from './fixtures.ts'

export default async function globalSetup() {
  mkdirSync(FIXTURES, { recursive: true })
  const png = (opts: Parameters<typeof bwipjs.toBuffer>[0]) => bwipjs.toBuffer({ scale: 4, padding: 20, backgroundcolor: 'FFFFFF', ...opts })
  writeFileSync(fixture('qr-wifi.png'), await png({ bcid: 'qrcode', text: 'WIFI:T:WPA;S:Cafe Net;P:s3cret!;;' }))
  writeFileSync(fixture('ean13.png'), await png({ bcid: 'ean13', text: '4006381333931', includetext: true }))
  writeFileSync(fixture('datamatrix.png'), await png({ bcid: 'datamatrix', text: 'Data Matrix e2e' }))
  writeFileSync(fixture('pdf417.png'), await png({ bcid: 'pdf417', text: 'PDF417 e2e' }))
  writeFileSync(fixture('not-an-image.txt'), 'hello')

  // Chromium can replay an MJPEG file as the camera: draw a QR code on a 640×480 "desk" and repeat the frame.
  const svg = bwipjs.toSVG({ bcid: 'qrcode', text: CAMERA_TEXT, scale: 6, padding: 8, backgroundcolor: 'FFFFFF' })
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const jpeg: string = await page.evaluate(async (markup) => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#8a8f98'
    ctx.fillRect(0, 0, 640, 480)
    const img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
    await img.decode()
    ctx.drawImage(img, 170, 90, 300, 300)
    return canvas.toDataURL('image/jpeg', 0.92).split(',')[1]!
  }, svg)
  await browser.close()
  const frame = Buffer.from(jpeg, 'base64')
  writeFileSync(fixture('camera.mjpeg'), Buffer.concat(Array.from({ length: 30 }, () => frame)))
}
