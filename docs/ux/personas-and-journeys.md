# LieneCut personas and journeys

Persona: one local Windows printer owner using Chrome/Edge and a Liene PixCut S1. Include keyboard-only and low-vision use; do not assume mouse access. Accessibility target: WCAG 2.2 AA.

1. Connect: see disconnected state, click Connect, choose device in browser permission UI, see connection/status or actionable error. Disconnect and permission revocation differ.
2. Import: file picker/drop/paste; see empty/loading/error states and resulting list. Unsupported or oversized art must explain rejection.
3. Edit: select any sticker by keyboard, resize/rotate/duplicate/remove, keep focus, arrange, inspect cut outline and bounds.
4. Export: deliberate JPEG/PLT download reflecting current sheet, with meaningful filenames.
5. Print/cancel: explicit operation consumes stock; show preparation/upload/printing/cutting/completion/error. Cancellation must stop future uploads. Image and path must be one snapshot.
6. Clear/recover: confirm destructive clearing, remove in-memory artwork and diagnostic names, explain preferences and permission retention.

Trust moments: USB consent, print click, cancellation, invalid images, cut failure, disconnect, and deletion. No sign-up/payment/consent banner is needed for absent accounts, payments, and analytics.

## Independent review, 2026-10-26

| ID | Severity | Evidence | Required change |
|---|---|---|---|
| UX-01 | High | Older list items lack keyboard selection | Native named selection control |
| UX-02 | High | Rotate via Enter moves focus to BODY after list rebuild | Restore focus by sticker/control; deletion focuses neighbor/Add |
| UX-03 | High | Sample base contrast 6.03 becomes 2.50 for .55-opacity text | Remove opacity from meaningful text or guarantee rendered contrast |
| UX-04 | Medium | 320px viewport has scrollWidth 390; Connect ends at x374 | Header wrapping and shrinkable layout |
| UX-05 | Medium | Status/log/progress lack live semantics | Named progress and status/error announcements |
| UX-06 | Medium | Icon accessibility names are glyphs | Explicit descriptive aria-labels |
| UX-07 | Medium | step=.5 with 101.6/177.8 values yields invalid controls | Align step to supported precision |
| UX-08 | Low | Margin number max=10, slider max=6 | Align maxima |
| UX-09 | Medium | Import/trace loading and disabled-print reasons unclear | Visible status and disabled reason |
| UX-10 | Low | Blink animation ignores reduced motion | Respect prefers-reduced-motion |

Evidence: independent isolated headless Chrome/Puppeteer with synthetic fixtures and USB disabled. No axe scan, OS screen-reader test, full browser matrix, or physical printer test; no WCAG conformance sign-off.