# Plan: QR Studio

**Source PRD**: .claude/prds/qr-studio.prd.md
**Selected Milestone**: 1–4 (greenfield repo; delivered together as v1.0)
**Complexity**: Large

## Summary
A Vite + React + TypeScript installable PWA. `bwip-js` renders every symbology it ships (111, incl. QR,
Micro QR, rMQR, Data Matrix, Aztec, PDF417, MaxiCode, Han Xin, DotCode, EAN/UPC, Code 128/39/93, ITF,
Codabar, GS1 DataBar, postal and healthcare codes). `zxing-wasm/reader` decodes from camera frames and
images, with its `.wasm` bundled locally (no CDN). All data stays on the device.

## Patterns to Mirror
Greenfield repository: no existing code, so no in-repo patterns. Conventions chosen here:

| Category | Convention |
|---|---|
| Naming | `src/lib/*.ts` pure logic (camelCase functions); `src/features/<area>/*.tsx` PascalCase components |
| Errors | Library functions throw `Error` with user-readable messages; UI catches and shows them in an `role="alert"` region |
| Logging | None in production (no telemetry); errors surface in UI only |
| Data access | `localStorage` only via `src/lib/history.ts`, every access wrapped in try/catch |
| Tests | Co-located `*.test.ts(x)`, Vitest; node env for lib, `// @vitest-environment jsdom` for components; Playwright e2e in `e2e/` |

## Files to Change
| File | Action | Why |
|---|---|---|
| `package.json`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, `playwright.config.ts` | CREATE | Toolchain |
| `src/lib/payloads.ts` | CREATE | Build QR content strings: text, URL, Wi-Fi, vCard, email, phone, SMS, geo, event |
| `src/lib/parse.ts` | CREATE | Classify decoded text into typed results with safe actions |
| `src/lib/symbologies.ts` | CREATE | Catalog from `bwip-js` `symbolList` + categories + zxing format mapping |
| `src/lib/render.ts` | CREATE | SVG/PNG rendering, colors, size, margin, ECC, logo overlay |
| `src/lib/decode.ts` | CREATE | `zxing-wasm` reader wrapper + read-back self-check |
| `src/lib/history.ts`, `src/lib/batch.ts`, `src/lib/contrast.ts`, `src/lib/files.ts` | CREATE | History store, ZIP batch, contrast warning, download/copy/share helpers |
| `src/features/{create,scan,batch,history}/*` | CREATE | UI |
| `public/*` icons, `index.html` | CREATE | PWA manifest icons, CSP (build only) |
| `.github/workflows/deploy.yml` | CREATE | CI (lint, typecheck, test, build) + GitHub Pages deploy |
| `README.md`, `LICENSE` | CREATE | Docs |

## Tasks
### Task 1: Toolchain
- **Action**: Vite 8 + React 19 + TS 6, Vitest 5, ESLint 9 (typescript-eslint, react-hooks, jsx-a11y), PWA plugin, base `/QR_Code/`.
- **Validate**: `npm run typecheck && npm run lint && npm test`

### Task 2: Pure logic, test-first (payloads, parse, symbologies, contrast, history, batch)
- **Action**: RED tests per function → implement → refactor.
- **Validate**: `npm run coverage` ≥ 80% on `src/lib`

### Task 3: Render + decode round-trip
- **Action**: `render.ts` over `bwip-js`; `decode.ts` over `zxing-wasm`. Test: every decodable symbology's sample
  renders, decodes back, and matches; every one of the 111 symbologies renders without throwing.
- **Validate**: `npm test`

### Task 4: UI
- **Action**: Create (format picker, content templates, style controls, preview, self-check badge, downloads),
  Scan (camera, upload, drop, paste, result actions), Batch (lines → ZIP), History. Component tests for key flows.
- **Validate**: `npm test`, manual run in browser

### Task 5: PWA + deploy
- **Action**: Manifest, icons, Workbox precache incl. `.wasm`; GitHub Actions → Pages.
- **Validate**: `npm run build && npm run preview`; offline reload works; Pages URL loads

### Task 6: QA + review
- **Action**: Accessibility, security and React reviews; Playwright e2e + axe; verification loop.
- **Validate**: `npm run e2e`

## Validation
```bash
npm run lint && npm run typecheck && npm run coverage && npm run build && npm run e2e
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| `zxing-wasm` fetches wasm from CDN by default | Certain | `prepareZXingModule({ overrides: { locateFile } })` with Vite `?url` import |
| Styled/logo QR stops scanning | Medium | Force ECC H with logo, cap logo size, contrast warning, automatic read-back self-check |
| Decoded text is untrusted (e.g. `javascript:` links) | High | Only `http(s)`/`mailto`/`tel`/`sms` become links; everything rendered as text; SVG previews shown via `<img>` |
| Camera left running | Medium | Stop tracks on tab change/unmount/result |
| Supply chain (repos had a worm in 2026) | Medium | Exact pins, `--before` age cutoff, `npm ci --ignore-scripts`, Actions pinned by SHA |

## Acceptance
- [x] All tasks complete
- [x] Validation passes
- [x] Every generated code that the decoder supports reads back identically
