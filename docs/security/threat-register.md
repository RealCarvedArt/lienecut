# LieneCut threat register

Date: 2026-10-26. Technical remediation owner for every open item: LieneCut maintainer (Codex in this workspace); physical validation owner: local printer operator. No risk has been accepted or waived.

| ID | Asset / actor / boundary | Risk | Severity | Status / mitigation needed |
|---|---|---|---|---|
| SEC-01 | Build workstation; compromised dependency; npm supply chain | Vulnerable development dependencies | High | Open: audit reports 9 high and 1 moderate; update/pin tooling, audit and rerun browser checks |
| SEC-02 | Printer/consumables; user cancellation; browser-to-USB | Pre-aborted request still creates and uploads job | Medium | Open: check abort before declaration and between upload chunks; cleanup created jobs; mocked regression tests |
| SEC-03 | Artwork/cut integrity; edits across async encoding | JPEG and PLT can reflect different sheets | Medium | Open: snapshot validated raster/PLT together before awaiting; reject empty/failed trace |
| SEC-04 | USB-authorized UI; malicious web page; framing | No frame denial/CSP | Medium | Open: enforced CSP and frame denial, tested response headers |
| SEC-05 | Browser memory/CPU; supplied image | Unbounded image bytes/pixels/batch | Low | Open: bounded validation before decode and allocation |
| SEC-06 | Blade control; malformed local settings | Restored pressure/margin bypass input constraints | Low | Open: finite/range validation at shared cut boundary |
| SEC-07 | USB ownership; failed interface/identify operation | Partial connection not closed | Low | Open: close device on failure and test with fake device |

Existing controls: server binds 127.0.0.1; browser chooses/authorizes USB device; names use textContent; control requests serialize; reply accumulation is bounded; no runtime cloud upload found. These controls do not close the findings above.

ASVS target: applicable Level 1 browser/input/configuration/supply-chain controls. Account/session/database requirements are not applicable to the current local-only design. Reassess before shared or hosted use.

Review evidence: [independent review](review-2026-10-26.md). Printer-side retention, physical cancellation and cut calibration were not tested.
## Remediation update — 2026-10-28
The above table records discovery findings. SEC-01..07 now have targeted fixes and regression evidence in [remediation-2026-10-28.md](remediation-2026-10-28.md). This does not certify physical hardware behavior or the complete harness.
