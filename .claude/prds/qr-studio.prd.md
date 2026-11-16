# QR Studio — universal QR & barcode generator and scanner

## Problem
People who need to make or read a QR code or barcode jump between single-purpose websites and phone apps:
one makes QR codes but not barcodes, another scans but only from the camera, many are ad-heavy or upload
the user's data to a server. The cost is wasted time, codes that fail in other apps, and private data
(Wi-Fi passwords, contact details) handed to third parties.

## Evidence
- Owner request (2026-11-16): "generate QR code and decode any QR code and show the result … generate any
  code in the world and I can use this QR code in any application", usable "anywhere like web, mobile, any device".
- Assumption: existing free tools are fragmented (QR-only, camera-only, or server-based) — needs validation
  via a short comparison of 5 popular free generators/scanners.

## Users
- **Primary**: the repo owner (developer/student) and anyone they share the link with, on phone or laptop,
  who needs to create a code for a link, Wi-Fi network, contact, product label or event, or read a code
  from a camera, screenshot or image file.
- **Not for**: businesses needing dynamic/trackable QR codes, scan analytics, or server-side bulk APIs.

## Hypothesis
We believe **one offline-capable, installable web app that creates and reads QR codes and all common
barcode formats** will **replace several single-purpose tools** for **people who make or read codes on
any device**. We'll know we're right when **every code it generates is read back correctly by its own
scanner and by a standard phone camera app, for every supported format**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Round-trip correctness (generate → decode) | 100% of supported formats | Automated tests |
| Works on phone + desktop browsers | Chrome, Safari, Firefox, Edge; Android + iOS | Manual check on the live link |
| Works offline after first visit | Yes | Reload with network disabled |
| Accessibility | WCAG 2.2 AA, no axe violations | Automated audit + keyboard walk-through |
| Data leaving the device | None | Network panel shows no requests with user data |

## Scope
**MVP**
- Generate QR codes for: plain text, URL, Wi-Fi, contact card, email, phone, SMS, location, calendar event.
- Generate common 1D/2D barcodes: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, Code 93, ITF,
  Codabar, Data Matrix, PDF417, Aztec, plus other standard symbologies where feasible.
- Input validation per format (e.g. EAN check digits, numeric-only formats) with clear messages.
- Styling: foreground/background color, size, margin, QR error-correction level, optional center logo.
- Output: download PNG and SVG, copy image, share (where the device supports it), print.
- Scan from: live camera, image upload, drag-and-drop, paste from clipboard.
- Scan result shows the format and decoded content, with smart actions (open link, copy, call, email,
  show Wi-Fi details, save contact).
- History of recent generated and scanned codes, stored only on the device, with clear-all.
- Batch: many lines in, all codes out as a ZIP.
- Installable (add to home screen / desktop) and usable offline.
- Published on a public URL that updates automatically when code is pushed.

**Out of scope**
- Accounts, cloud sync, dynamic/redirecting QR codes, scan analytics — need a server; conflicts with privacy goal.
- Native app-store builds — the installable web app covers all devices from one codebase.
- Decoding of proprietary/licensed symbologies with no open decoder.

## Delivery Milestones
| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Generate | User makes any supported QR/barcode, styles it, downloads/shares it | complete | .claude/plans/qr-studio.plan.md |
| 2 | Scan | User reads any supported code from camera, file, drop or paste and acts on it | complete | .claude/plans/qr-studio.plan.md |
| 3 | History + batch | User revisits recent codes and generates many at once | complete | .claude/plans/qr-studio.plan.md |
| 4 | Ship | Installable, offline, live on a public URL, accessible | complete | .claude/plans/qr-studio.plan.md |

## Open Questions
- [ ] Should a custom domain be used instead of the default GitHub Pages address? (TBD — owner decision)
- [ ] Is any symbology the owner needs missing from the MVP list? (TBD — validate after first release)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Camera access blocked (no HTTPS, denied permission, iOS quirks) | Medium | High | Serve over HTTPS; always offer file/paste fallback; clear permission messages |
| Styled QR codes (low contrast, large logo) stop scanning | Medium | High | Warn on low contrast; force high error correction with a logo; verify by decoding the output |
| Heavy decoding engine slows first load on phones | Medium | Medium | Load the scanner engine only when the scan screen opens; cache offline |
| Some barcode formats need strict input (lengths, check digits) | High | Low | Per-format validation and helpful error text |

---
*Status: v1.0 delivered. Plan: `.claude/plans/qr-studio.plan.md`; evidence: `.claude/tdd/qr-studio.tdd.md`.*
