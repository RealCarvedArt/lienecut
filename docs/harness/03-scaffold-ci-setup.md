# Phase 03: Scaffold & CI Setup

## Objective
Turn the existing source checks into blocking, repeatable GitHub checks without placing artwork, USB access, or secrets in CI.

## Key Activities
Added pinned GitHub Actions for Windows tests/build/browser checks/SBOM, full-history Gitleaks, CodeQL, Dependabot, SECURITY reporting, CODEOWNERS, and the SARIF failure gate.

## Deliverables
`.github/workflows/ci.yml`, `.github/dependabot.yml`, `.github/CODEOWNERS`, `SECURITY.md`, `ci-gates.md`, `tools/a11y-check.mjs`, and `tools/quality-check.mjs`.

## Tools/Best Practices
Exact dependency versions and lockfile; GitHub actions pinned to SHAs; least-privilege workflow permissions; synthetic fixtures and fake/disabled USB; SBOM and full-history secret scan.

## Reasoning
Security: every configured check fails the workflow; credentials are not persisted and CodeQL alone gets security-event upload permission. Privacy: CI uses only repository fixtures and generated synthetic artifacts. UI/UX: axe runs against empty, loaded and mobile views with the existing browser state tests.

## Summary/Conclusions
The scaffold is implemented but this record is pending until the workflow succeeds on GitHub and the three named checks are required on `main`.
