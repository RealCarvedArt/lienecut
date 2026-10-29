# LieneCut data inventory

Updated 2026-10-29. Scope: local personal use. Purpose/basis below describes user-directed processing, not a legal determination for organizational processing. No runtime third-party processor or analytics was found in inspected code. Browser and operating-system services remain under the user's control.

| Data | Purpose / basis | Storage / access | Retention / deletion |
|---|---|---|---|
| Artwork, source basenames, layout, rotation, retained original backgrounds | User-requested layout and Restore original | Browser tab memory, local user | Clear drops sheet/selection/drag/cut references and erases the persistent composite canvas; reload discards the tab session |
| brencut.marginMm, brencut.kp, brencut.cutHoles, brencut.showCut | Necessary saved preferences | Origin localStorage | Until site data cleared; old namespace deliberately preserved |
| Current import/printer error notice | Explain failures and recovery | Visible tab DOM; may identify a failed source file | Replaced by subsequent notice or cleared with Clear, including on an empty sheet; no session log |
| Model, SKU, firmware/hardware/media/job status | Compatibility/status | USB to browser memory and current status UI | Page lifetime; no raw event log |
| USB permission | User-authorized device access | Browser-managed | Disconnect does not revoke; revoke in browser site/USB permissions |
| .lienecut project with embedded artwork, original backgrounds, layout/settings and optional legacy cut paths | Explicit Save project / Open project | User download folder and browser during use | User manages file retention/deletion; Clear does not delete downloaded files |
| JPEG, PLT, random document name, fixed protocol constants | Explicit print/cut | Browser to physical printer over USB | Printer retention unknown; cannot guarantee deletion |

No artwork is sent to the local HTTP server. Previously granted devices may reconnect automatically. Clear removes current artwork and notices; it preserves saved preferences and USB permission. Manage those through browser site settings and exported files through the operating system. Dropping references lets the browser reclaim memory; this is not a forensic secure-erasure guarantee.

PRIV-01 raw session logging was removed on 2026-10-28. The 2026-10-29 review found residual pixels in the offscreen composite canvas and an uncleared failed-import notice when the sheet was empty. Both now have explicit Clear handling and browser regressions in tools/ui-check.mjs. Earlier inventory claims about diagnostic logs and separate JPEG/PLT downloads describe historical behavior and are superseded by this inventory.

DPIA screening: no systematic monitoring, accounts, or remote processing is planned. A formal DPIA is not indicated by this technical personal-use design. Reassess for organizational personal data, sharing, cloud hosting, or tracking. Printer-side retention remains an explicit unknown.
