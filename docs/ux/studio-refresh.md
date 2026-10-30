# LieneCut studio refresh

User-directed UI remediation, 2026-10-26.

## Design contract
A local, repeated-use print studio for the PixCut S1 owner: paper is the main object, followed by artwork, cut settings, then output. The existing sheet preview and three workflow groups are the local reference. Keep all hardware dimensions/calibration, source attribution, saved preference keys and exports. No external fonts/assets or new dependencies.

Use a dark green header, warm dotted work surface, white paper and restrained green action. Replace random colors/opacity with fixed readable tokens. Desktop keeps paper and inspector side by side; mobile stacks them with wrapping controls and vertical scrolling. Targets: 1440x1000, 390x844, 320x800.

Scope reaches index.html, app UI/state handlers, browser regression tool and this review record. Protocol, tracer, vendor files and fixtures remain unchanged.

## Behavior and verification
- Empty: choose-image action on paper; zero count and visible output prerequisite.
- Loading: import and trace status, busy list, stale exports disabled, connecting button state.
- Error: visible message and session details; failed import preserves the current sheet.
- Partial: unsupported USB explains browser requirement while layout/export remain usable.
- Success: current cut path, valid exports, explicit artwork count; clear restores focus and removes session log.
- Permission: local USB guidance; fake chooser cancellation tested with retry copy. Actual chooser/device operation untested.
- Keyboard: select any artwork through a native named button; focus canvas to nudge/rotate; preserve focused list control after rerender. Single-letter shortcuts only act on the canvas.
- Typography/contrast/reflow: core text pairs exceed 4.5:1; no faded meaningful text, mobile overflow or unreadable long filenames in tested layouts.

Run `npm test`, `npm run build`, `node tools/ui-check.mjs`. Browser check uses synthetic fixtures and disables physical WebUSB. Screenshots/results/evidence are in dist/ui-review. No USB write or print was performed. Evidence checker validates records, not conformance.

## Earlier findings
UX-01..10 have targeted implementation changes and browser checks. OS screen-reader and axe auditing remain outstanding; do not treat this as independent WCAG certification. PRIV-02 Clear log retention addressed; raw diagnostic logging PRIV-01 still needs minimization. SEC-03 job bytes now captured before awaiting JPEG encoding and failed traces rejected; dedicated hardware/concurrency validation remains outstanding. SEC-02 upload cancellation, dependency vulnerabilities and other security findings are not closed by this UI work.
