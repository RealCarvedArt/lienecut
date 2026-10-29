# Security remediation — 2026-10-28

SEC-01: Updated and pinned Puppeteer tooling; npm audit reports zero vulnerabilities.
SEC-02: Abort checks before declaration, between documents/chunks, during ACK/poll waits; assigned jobs cancelled on abort/upload failure. Ten mocked USB/cancellation tests cover this and cleanup.
SEC-03: Synchronous raster/PLT snapshot before JPEG encoding; editor is inert during printing. Mutation regression verifies paired output bytes.
SEC-04: Hash-authorized scripts, blocked external connections, frame denial, no-sniff, no-referrer and USB self policy. Loopback HTTP rejects foreign Host/Origin, non-read methods and other paths. Server and browser checks pass.
SEC-05: PNG/JPEG/WebP/GIF header validation before decode; per-file byte/pixel and batch/sheet limits. Project images are bounded and decoded transactionally. Oversized image browser test confirms no decoder call.
SEC-06: Saved settings normalized, shared tracing/combination boundary rejects invalid pressure/border/flags. Negative unit and localStorage browser tests pass.
SEC-07: Failed configuration/claim closes device; failed identification closes returned connection; readers rejected on close. Mocked transport and browser identification tests pass.

PRIV-01/02: The session log and raw event logging in the UI were removed. Clear removes artwork and notices. No analytics or remote runtime requests; CSP connect-src none enforces the latter. Projects are explicit local downloads and retain images plus original-background pixels; users control file deletion.

UX-01..10: Targeted UI remediation and browser regressions cover keyboard selection/focus, labels, responsive layout, statuses, numeric precision and reduced motion. No WCAG certification is claimed.

Verification: npm test (50 tests), npm audit (zero findings), build, security-check, project-check, ui-check, background-check, per-image-check and layout-check. No physical USB writes. This closes the listed code defects within tested scope; it does not claim all eleven fullstack phases passed. Independent final review was not completed because its worker hit a usage limit. Physical print/cancel, screen-reader and broader platform testing remain release limitations.
