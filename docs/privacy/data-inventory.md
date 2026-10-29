# LieneCut data inventory

Scope: local personal use. Purpose/basis below describes user-directed processing, not a legal determination for organizational processing. No runtime third-party processor or analytics was found in inspected code. Browser and operating-system services remain under the user's control.

| Data | Purpose / basis | Storage / access | Retention / deletion |
|---|---|---|---|
| Artwork, source basenames, layout, rotation | User-requested layout | Browser tab memory, local user | Remove/Clear/reload; filenames currently also survive Clear in log |
| brencut.marginMm, brencut.kp, brencut.cutHoles, brencut.showCut | Necessary saved preferences | Origin localStorage | Until site data cleared; old namespace deliberately preserved |
| Import/printer diagnostic log | Troubleshooting | Visible tab DOM | Until reload; currently unbounded and includes filenames/raw events |
| Model, SKU, firmware/hardware/media/job status | Compatibility/status | USB to browser memory/log | Page lifetime; see log caveat |
| USB permission | User-authorized device access | Browser-managed | Disconnect does not revoke; revoke in browser site/USB permissions |
| JPEG and PLT downloads | Explicit export | User download folder | User manages retention/deletion |
| JPEG, PLT, random document name, fixed protocol constants | Explicit print/cut | Browser to physical printer over USB | Printer retention unknown; cannot guarantee deletion |

No artwork is sent to the local HTTP server. Previously granted devices may reconnect automatically. Reload clears the current in-memory sheet/log; clearing browser site data removes saved preferences. Manage USB permissions separately. Delete exported files through the operating system.

Open findings: PRIV-01 raw filename/device logging violates the harness minimization requirement; PRIV-02 Clear retains log. Reduce event/error fields and clear session log alongside sheet. Keep source names in the sticker list where they serve the requested workflow.

DPIA screening: no systematic monitoring, accounts, or remote processing is planned. A formal DPIA is not indicated by this technical personal-use design. Reassess for organizational personal data, sharing, cloud hosting, or tracking. Printer-side retention remains an explicit unknown.
## Current behavior — 2026-10-28
The earlier log and JPEG/PLT download rows are historical. Session logging is removed. Save project downloads a .lienecut file containing embedded artwork, layout/settings and retained original backgrounds; user manages deletion. Clear removes artwork/notices from the tab; preferences and USB permissions remain separately managed. PRIV-01/02 are remediated in the current UI.
