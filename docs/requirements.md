# LieneCut requirements

Scope: the user's local Liene PixCut S1 browser tool, based on RealCarvedArt/lienecut, renamed LieneCut. No hosted service or new product features.

## Security
Protect local artwork, browser USB grants, printer operation, paper/ribbon, and build integrity. Use applicable OWASP ASVS Level 1 controls as a baseline for a single-user, loopback-only tool; this is a target, not certification. Device permission and explicit print actions form the access boundary. No accounts, roles, tenancy, payments, database, cloud credentials, or public ingress are needed. Never change calibration or send firmware/factory commands during verification. Imported files and device messages are untrusted. Cancel must prevent further uploads, and a job's image and cut path must describe the same snapshot.

## Privacy
Keep artwork on this computer except the user's explicit USB transfer or downloaded files. No analytics or third-party runtime requests. Retain only four preferences in localStorage. Inventory artwork, names, diagnostic messages, device information, permissions, exports, and printer transfers. Do not promise printer-side deletion: retention is unknown. Local personal use is assumed; organizational or hosted processing needs reassessment. No formal DPIA is indicated by the current technical scope; no legal compliance certification is claimed.

## UX
Target WCAG 2.2 AA: keyboard selection and editing, stable focus, readable text, 320px reflow, named controls, announced status/error/loading states, reduced motion. Preserve existing settings through the rename. Top journeys: connect, import, select/arrange/resize, inspect cuts, export, print, cancel, clear and disconnect. Explain unavailable printing visibly.

## Success criteria
- Title/header/browser guidance and export names say LieneCut.
- Existing protocol/tracer tests and synthetic browser import pass.
- Independent privacy and UX checks have evidence before their gates pass.
- Real print/cancel testing requires user-operated hardware; do not claim mock tests establish calibration or physical behavior.

Non-goals: cloud publication, authentication systems, database, remote printing, firmware changes, new calibration values, or a visual redesign.

Backlog: [prioritized findings](backlog.md).
