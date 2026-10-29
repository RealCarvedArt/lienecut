# CI gates

Prepared 2026-10-29 for the existing localhost application. Configuration is not evidence of a completed GitHub run. Require these exact check names on main after successful runs:

| Required check | Blocking checks |
|---|---|
| Windows checks | Lockfile installation, npm audit at low severity, Node syntax, unit tests, build, security/project/UI/background/per-image/layout/axe accessibility browser regressions, CycloneDX SBOM generation |
| Full-history secrets | Gitleaks 8.30.1 scans all fetched history; a synthetic token must cause exit 1 |
| JavaScript security | CodeQL security-extended analysis; every returned finding blocks through the SARIF gate; malformed or missing results also block |

Actions are pinned to commit SHAs. Gitleaks is pinned to an exact release and the SHA256 from its official GitHub asset metadata. Default token permissions are contents:read; only CodeQL receives security-events:write. Checkout does not retain credentials. No PR comments or notifications are sent. Dependabot proposes npm and action updates weekly. CODEOWNERS names the current repository owner; actual review/branch-protection enforcement must be configured and verified separately.

Windows runners use installed Chrome. Browser tests disable or fake USB and use repository synthetic fixtures. Artifacts retain the built HTML, SBOM, and synthetic UI evidence for 14 days. No real artwork, physical USB access, secrets, or production credentials belong in CI.

The small quality-check script only enforces CodeQL SARIF results; it is not a custom security scanner. Its self-test rejects a seeded finding and malformed output. The Gitleaks seeded check uses a temporary, explicit synthetic-only rule and value, proving its failure wiring without placing a real secret in the repository. The dependency audit and browser security checks already contain boundary rejection cases; separate end-to-end seeded CI failures for those jobs remain unverified until exercised on GitHub.

No container, infrastructure, database, authentication, or cloud deployment exists in scope, so container/IaC scanning and service type checks are not added. JavaScript syntax checks replace a nonexistent TypeScript compiler. The axe accessibility check covers the existing empty, loaded and mobile states; it does not replace screen-reader or physical-device validation. Manual physical print/cancel, screen reader, rollback rehearsal, release provenance and branch protection remain separate gates. No gate passage is claimed by this file.

Sources: [GitHub CodeQL action](https://github.com/github/codeql-action), [Gitleaks release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1), [npm SBOM](https://docs.npmjs.com/cli/v11/commands/npm-sbom/).
