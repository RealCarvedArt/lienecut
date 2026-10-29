# Phase 01: Discovery & Planning

Project: LieneCut. Date: 2026-10-26. Lead: main session. Status: gate failed.

## Objective
Adopt the requested fullstack-harness for the existing local printer tool, establish security/privacy/UX requirements, and verify readiness before later lifecycle phases.

## Key Activities
- [SEC] Inspect app, local server, protocol, cut generation, dependency audit; independent security review with mocked cancellation reproduction.
- [PRIV] Independent review of artwork, settings, diagnostics, USB, download and deletion flows.
- [UX] Independent source and isolated browser review of keyboard, focus, contrast, layout and status semantics.
- Rename visible brand/browser guidance/downloads/package identity to LieneCut, preserving preference keys and upstream attribution.
- Plan/routing: main session coordinates and implements branding; independent security, privacy and UX agents review their boundaries. Skill's Claude model names are unavailable in this Codex runtime; agents inherit the available model rather than claiming those models were used.

## Deliverables
| Deliverable | Path | Priority |
|---|---|---|
| Requirements and scope | ../requirements.md | SEC/PRIV/UX |
| Threat register and independent evidence | ../security/threat-register.md; ../security/review-2026-10-26.md | SEC |
| Data inventory | ../privacy/data-inventory.md | PRIV |
| Personas/journeys and review | ../ux/personas-and-journeys.md | UX |
| Prioritized local backlog | ../backlog.md | SEC/PRIV/UX |
| Gate state | STATE.md | SEC/PRIV/UX |

## Tools/Best Practices
| Tool / standard | Use | Priority |
|---|---|---|
| ASVS L1 target, trust-boundary analysis | Scope controls to local app without claiming certification | SEC |
| npm audit and node tests | Dependency findings and protocol/tracer evidence | SEC |
| Data minimization inventory | Explicit storage/access/retention and device unknowns | PRIV |
| Chrome/Puppeteer, WCAG 2.2 AA target | Synthetic import and independent keyboard/reflow/contrast evidence | UX |

## Reasoning
### 1. Security (paramount)
Loopback binding limits remote access, but a USB-authorized browser still controls a physical device and consumes stock. Files, stored settings, event messages and build dependencies cross trust boundaries. Applicable ASVS L1 controls are proportionate to one local operator without accounts or remote services. Independent review found unresolved dependency, cancellation, snapshot integrity, browser policy, bounds and cleanup findings. Existing successful tests do not cover them. Because the skill says an open security finding fails the phase gate, later phases cannot be certified or started through this gate.

### 2. Privacy
Artwork stays in browser memory until explicit USB/download, so introducing a server database or cloud processor would increase exposure without serving scope. Four preference keys remain for compatibility. Source filenames and arbitrary device events currently enter a visible persistent-for-page log; Clear does not remove them. Inventory documentation improves transparency but does not fix this behavior. Printer-side retention is unknown. No formal DPIA indicated for assumed personal local use; organizational/shared processing requires reassessment.

### 3. UI/UX
The core connect/import/layout/print workflow exists, and branding changes retain settings. Independent testing demonstrates keyboard selection/focus, contrast, reflow and announcement failures. These need fixes and automated/manual checks before claiming AA. Destructive Clear has confirmation; printing/cancellation need especially trustworthy feedback because they affect hardware and materials.

### Engineering considerations
All 111 topics were scanned at adoption. Applicable work due now is threat/requirement identification; implementation evidence remains in the open backlog.

| Topics | Status | Decision / evidence or revisit trigger |
|---|---|---|
| 1-2, 10-14, 17, 36-44 | Applicable | Bound local work, serialize USB, safe cancellation/snapshots; SEC-02/03/05/07. Owner maintainer; resolve before advancement |
| 6, 51, 55-59, 61-66, 107-111 | Applicable / deferred execution | Tests exist; CI, rollback, health/performance budgets and operations require later passed prerequisites; backlog tracks gaps |
| 67-80 | Applicable screening | Browser permission is access control; loopback HTTP, input validation/XSS/framing/privacy boundaries reviewed. No accounts/tokens/SQL/outbound service fetch. SEC-04/06 remain open |
| 83-85, 87-88, 91-96, 102-103, 108 | Applicable | Ephemeral sheets, local exports, USB failures, latency, versioned protocol/tool dependencies; document recovery and test failures before release |
| 3-5, 7-9, 15-16, 18-35, 45-50, 52-54, 60, 81-82, 86, 89-90, 97-101, 104-106 | Not applicable currently | No hosted infrastructure, distributed service/database/queue, cloud deployment, CDN, webhooks, or infrastructure orchestration. Local HTTP and USB are retained. Revisit if hosted/shared scope is requested |

### Trade-offs
No cloud stack, extra auth system, or unrelated redesign is added. Security gate honesty takes precedence over presenting the existing working UI as fully certified. Compatibility preserves brencut.* storage keys; visible brand is LieneCut.

## Summary/Conclusions
Discovery artifacts and independent reviews are complete, but the gate fails on unresolved security findings. Scope derives from the user's local-site and rename/harness requests; no new cloud or hardware-operation scope is inferred. Phase 2 onward remains pending, not retroactively passed. Remediation backlog is concrete; no risk acceptance recorded.

## Exit Gate
- [x] [SEC] Threat register has assets, actors, top risks and owners.
- [x] [SEC] Applicable ASVS Level 1 target chosen and justified.
- [x] [PRIV] Every data category has purpose/basis/retention; DPIA screening recorded.
- [x] [UX] Persona, top journeys and WCAG target documented.
- [x] User-approved scope: existing local printer site, rename, harness review; no expanded features.
- [ ] No open security findings under the skill's overriding gate rule.
- [ ] Applicable considerations have satisfactory evidence; identified gaps remain open.

Reviewed independently: security_review, privacy_review, ux_review on 2026-10-26. None issued implementation/architecture/release sign-off. Do not advance until the failed gate is resolved.