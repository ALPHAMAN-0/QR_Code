# TDD evidence: QR Studio v1.0

**Source plan:** `.claude/plans/qr-studio.plan.md` (from `.claude/prds/qr-studio.prd.md`).
Plan content was treated as data; validation commands were limited to `vitest`, `tsc`, `eslint`, `vite build` and `playwright test`.

## User journeys
1. As a user, I want to turn a link, Wi-Fi login, contact, email, phone, SMS, location or event into a QR code that any phone camera understands.
2. As a user, I want to pick any barcode type, get clear errors for invalid input, and download, copy, share or print the result.
3. As a user, I want to scan a code from my camera or an image and see what it says, with safe one-tap actions.
4. As a user, I want recent codes remembered on my device only, and to make many codes at once as a ZIP.

## Task report (RED → GREEN, on branch `main`)

| Commit | Stage | Command | Result |
|---|---|---|---|
| `c72e07a` | RED: specs for payloads, parse, catalog, render, decode, history, batch | `npx vitest run` | 8 files failed (modules missing) |
| `5280fe4` | GREEN: library implemented | `npx vitest run` | 299 passed |
| (in `829e129`) | RED → GREEN: scanner-to-editor format mapping | `npx vitest run src/lib/readback-format.test.ts` | 13 failed → passed |
| `829e129` | GREEN: UI, component tests | `npx vitest run --coverage` | 378 passed; lines 90.3% |
| `ec179f1` | RED: React and security review findings reproduced | `npx vitest run` | 20 failed, 380 passed |
| `3bcc8f7` | GREEN: review fixes | `npx vitest run` | 401 passed |
| `ddf8868` | Browser QA fixes | `npx playwright test` | 45 passed, 1 skipped |

## What the tests guarantee

| # | Guarantee | Where | Type |
|---|---|---|---|
| 1 | Every symbology the scanner can read round-trips: rendered by bwip-js, decoded by zxing-wasm, same data | `src/lib/decode.test.ts` | integration |
| 2 | All 111 symbology samples render without errors | `src/lib/render.test.ts` | unit |
| 3 | Wi-Fi, vCard, mailto, tel, SMSTO, geo and VEVENT payloads match the formats camera apps parse, with escaping | `src/lib/payloads.test.ts` | unit |
| 4 | Scanned text is parsed back; `javascript:`/`data:`/`vbscript:` never become links | `src/lib/parse.test.ts`, `ResultCard.test.tsx` | unit / component |
| 5 | Malformed percent-escapes cannot crash the app; each section has an error boundary | `review-fixes.test.ts`, `ErrorBoundary.test.tsx` | unit / component |
| 6 | Camera streams are released after Stop, switch, unmount and a successful scan | `ScanPanel.test.tsx`, `e2e/camera.spec.ts` | component / e2e |
| 7 | Wi-Fi passwords are never written to history and are masked in results until revealed | `review-fixes.test.ts`, `ResultCard.test.tsx` | unit / component |
| 8 | Deceptive links (user-info, punycode, http) are flagged; .vcf/.ics are rebuilt without smuggled fields | `review-fixes.test.ts`, `ResultCard.test.tsx` | unit / component |
| 9 | History is capped, deduplicated, survives broken storage, can be switched off | `history.test.ts`, `App.test.tsx` | unit / component |
| 10 | Batch builds a valid ZIP, reports bad lines by number and yields so progress paints | `batch.test.ts`, `BatchPanel.test.tsx` | unit / component |
| 11 | A downloaded PNG scans back to the same link in a real browser | `e2e/create.spec.ts` | e2e |
| 12 | No axe WCAG 2.2 AA violations on any section; no sideways scroll at 320 px | `e2e/quality.spec.ts` | e2e |
| 13 | Works offline after the first visit; no requests to other origins; CSP has no violations | `e2e/quality.spec.ts` | e2e |

## Coverage and known gaps
`npm run coverage`: statements 88.7%, branches 84.7%, functions 86.8%, lines 90.6% (thresholds 80/75/80/80).
Gap: the canvas/PNG path in `src/lib/render.ts` needs a real browser and is covered by the Playwright tests (PNG download round trip, logo self-check), not by Vitest.
