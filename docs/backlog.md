# LieneCut prioritized backlog

Historical discovery backlog. Items 1–6 now have targeted remediation; see security/remediation-2026-10-28.md. Full harness, independent review, and physical/accessibility sign-off remain outstanding.

1. [security] SEC-01 update/pin audited build/browser tooling; verify audit, build, tests and browser runner.
2. [security] SEC-02/03 cancellation and immutable job preparation; add mocked regressions without consuming printer stock.
3. [security] SEC-04 browser response protections; verify policy without breaking canvas/download/WebUSB.
4. [security] SEC-05/06/07 bounded image/settings validation and USB failure cleanup with negative tests.
5. [privacy] PRIV-01/02 allowlist diagnostics, remove source names from logs, clear session log with sheet; verify storage/traffic behavior.
6. [ux] UX-01..10 keyboard/focus, contrast, reflow, accessible names/status, valid inputs, loading and reduced-motion fixes with browser regressions.
7. [security][privacy][ux] Repeat independent phase-1 gate review; advance to architecture only once its prerequisite passes.
8. [security] Phase 3: choose locally appropriate executable quality gates, secrets scan, dependency pinning/SBOM, a11y checks; do not claim CI or branch protection exists.
9. [ux][security] Later QA: screen-reader/browser checks, rollback rehearsal, and user-operated physical print/cancel verification. No cloud deployment in scope.