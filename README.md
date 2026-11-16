# QR Studio

Make and scan QR codes and **111 barcode formats** in your browser, on any device. Works offline and installs like an app. Nothing you make or scan ever leaves your device.

**Open it:** https://alphaman-0.github.io/QR_Code/

![QR Studio: make and scan QR codes and 100+ barcode types](public/og.png)

## What it does

### Create
- **Every common code**, including QR Code, Micro QR, rMQR, Data Matrix, Aztec, PDF417, MaxiCode, Han Xin, DotCode, EAN-13/8, UPC-A/E, ISBN, Code 128, Code 39, Code 93, ITF-14, Codabar and GS1-128.
- **GS1 DataBar** and composites.
- **Postal codes:** USPS Intelligent Mail, Royal Mail, Australia Post, Japan Post and KIX.
- **Healthcare codes:** HIBC, PZN and Pharmacode.
- **111 formats** in total, drawn with [bwip-js](https://github.com/metafloor/bwip-js).
- **Ready-made QR content** that phone cameras understand: links, text, Wi-Fi logins, contact cards (vCard), email, phone calls, SMS, map locations and calendar events.
- **Style:** colors, transparent background, size up to print resolution, quiet zone, error correction (L/M/Q/H) and a logo in the middle.
- **Self-check:** every code is read back by the built-in scanner, so you know it works before you print it.
- **Output:** download PNG or SVG, copy the image, share it or print it.
- **Batch:** paste up to 500 values and download a ZIP of PNG or SVG files.

### Scan
- **Live camera** (front or back), **image upload**, **drag and drop**, or **paste a screenshot**.
- Reads QR, Micro QR, rMQR, Data Matrix, Aztec, PDF417, MaxiCode, EAN/UPC, Code 128/39/93, ITF, Codabar, GS1 DataBar and Telepen, using [zxing-wasm](https://github.com/Sec-ant/zxing-wasm).
- **Smart actions:** open a link (showing its real destination and warning about tricks), copy a Wi-Fi password, save a contact (.vcf), add an event (.ics), call, text, email or open a map.

### History
Recent codes are kept **only in this browser**. You can switch history off or clear it at any time. Wi-Fi passwords are never saved.

## Install it as an app

| Device | How |
|---|---|
| Android (Chrome) | Open the link, then tap **Install app** (or ⋮ → *Install app*) |
| iPhone / iPad (Safari) | Open the link, tap **Share** → **Add to Home Screen** |
| Windows, macOS, Linux (Chrome / Edge) | Click **Install app** in the top bar, or the install icon in the address bar |

After the first visit it works **without internet**.

## Privacy and security
- No server, no accounts, no analytics. All generation and decoding happen on your device.
- The barcode reader's WebAssembly and the fonts are bundled with the app. It never contacts a CDN.
- A strict Content Security Policy (`default-src 'self'`) is applied to the production build.
- Scanned content is treated as untrusted:
  - Only `http(s)`, `mailto`, `tel` and `sms` ever become links.
  - Contact and calendar files are rebuilt from checked fields.
  - Uploaded logos are re-encoded as plain PNG.

## Development

Requires Node.js 20.19+ (22 recommended).

```bash
npm ci --ignore-scripts    # install exact, locked versions without running install scripts
npm run dev                # http://localhost:5173/QR_Code/
npm test                   # unit + component tests (Vitest)
npm run coverage           # tests with coverage report (80% thresholds)
npm run lint               # ESLint incl. react-hooks and jsx-a11y
npm run typecheck          # TypeScript
npm run build              # production build in dist/
npx playwright install chromium && npm run e2e   # browser tests on the production build
```

### How it is built
- **React 19 + TypeScript + Vite 8**, packaged as a PWA with `vite-plugin-pwa` (Workbox precache).
- **`src/lib/`**: pure, fully tested logic.
  - `payloads.ts`: QR content formats
  - `parse.ts`: reads scanned content
  - `symbologies.ts`: the 111-format catalog
  - `render.ts`: SVG/PNG drawing
  - `decode.ts` / `readback.ts`: scanning and the self-check
  - `history.ts`, `batch.ts`, `files.ts`
- **`src/features/`**: the Create, Scan, Batch and History screens.
- **`e2e/`**: Playwright tests on desktop and phone viewports:
  - real round trips and a fake webcam feed
  - axe WCAG 2.2 AA checks and 320 px layout checks
  - offline mode, no third-party requests and CSP checks
- **Deployment:** GitHub Actions (`.github/workflows/deploy.yml`) lints, type-checks, tests, builds and runs the browser tests on every push, then publishes `main` to GitHub Pages.

## Credits
- [bwip-js](https://github.com/metafloor/bwip-js) (MIT): barcode generation (Barcode Writer in Pure PostScript).
- [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (MIT), built on [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp) (Apache-2.0): barcode reading.
- [fflate](https://github.com/101arrowz/fflate) (MIT): ZIP files.
- Fonts: [Epilogue](https://fonts.google.com/specimen/Epilogue) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL Open Font License), self-hosted.

## License
[MIT](LICENSE)
