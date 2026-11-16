// Rasterizes public/favicon.svg into the PWA icons and draws the social preview image.
// Run with: node scripts/make-icons.mjs   (needs `npx playwright install chromium` once)
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import bwipjs from 'bwip-js/node'

const svg = readFileSync('public/favicon.svg', 'utf8')
const maskable = svg.replace('rx="14"', 'rx="0"').replace(/<path|<rect x/g, (m) => m).replace(
  '<path',
  '<g transform="translate(32 32) scale(0.72) translate(-32 -32)"><path',
).replace('</svg>', '</g></svg>').replace('<rect x="29" y="29" width="6" height="6" fill="#fff"/>\n</g></svg>', '<rect x="29" y="29" width="6" height="6" fill="#fff"/></g>\n</svg>')

const qr = bwipjs.toSVG({ bcid: 'qrcode', text: 'https://alphaman-0.github.io/QR_Code/', scale: 1, padding: 0, barcolor: '0B0C0E' })

const browser = await chromium.launch()
const page = await browser.newPage()
const shot = async (html, w, h, path) => {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${html}</body></html>`)
  await page.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } })
}
const icon = (s, size) => s.replace('<svg ', `<svg width="${size}" height="${size}" `)
await shot(icon(svg, 192), 192, 192, 'public/pwa-192.png')
await shot(icon(svg, 512), 512, 512, 'public/pwa-512.png')
await shot(icon(maskable, 512), 512, 512, 'public/maskable-512.png')
await shot(icon(maskable, 180), 180, 180, 'public/apple-touch-icon.png')
await shot(
  `<div style="width:1200px;height:630px;box-sizing:border-box;padding:72px 80px;background:#eef0f3;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;color:#0b0c0e">
     <div style="max-width:620px">
       <div style="display:flex;align-items:center;gap:16px;font-size:34px;font-weight:600">${icon(svg, 56)}QR Studio</div>
       <div style="margin-top:36px;font-size:62px;line-height:1.05;letter-spacing:-0.03em;font-weight:500">Make and scan QR codes and 100+ barcode types.</div>
       <div style="margin-top:28px;font-size:28px;color:#5d6470">Free, offline, nothing leaves your device.</div>
     </div>
     <div style="background:#fff;padding:28px;border:1px solid #c9ced6;border-radius:8px">${qr.replace('<svg ', '<svg width="300" height="300" shape-rendering="crispEdges" ')}</div>
   </div>`,
  1200,
  630,
  'public/og.png',
)
await browser.close()
console.log('icons written')
