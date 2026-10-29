# LieneCut architecture and frozen local contract
Date: 2026-10-29. Scope: existing Windows localhost app, with browser WebUSB printing. No hosted deployment.

## Boundaries and decisions
Browser files -> image-input/project validation -> in-memory artwork -> cut/raster snapshot -> browser-granted WebUSB -> PixCut S1.
Local HTTP server -> single built HTML -> browser. Save project -> explicit local download.
The server binds 127.0.0.1, accepts only localhost/127.0.0.1 Host with matching Origin, GET/HEAD at /, and never receives artwork. Headers deny framing, external connections, sniffing and referrers. Hash-authorized bundled script executes; inline styles support the existing canvas UI.
Browser USB permission is the access control; no accounts, cookies, bearer tokens, secrets, backend data store or cloud encryption keys exist. Loopback HTTP supports secure-context WebUSB without a certificate. A compromised local OS/browser remains outside this boundary.
Device input queues and ACKs are limited to 64 KiB, parser remainders are bounded, transport failures surface to the UI, assigned upload jobs are cancelled on failure. In-flight WebUSB transfers cannot be forcibly interrupted.
Images are bounded before decode. Project opening is transactional; malformed data preserves the current sheet. Printing snapshots raster and cuts before asynchronous encoding and locks editing.

## Contract v1
This app has no service API requiring OpenAPI. Executable contracts are src/project.js, src/image-input.js, src/protocol.js and server.mjs with test/project.test.mjs, test/image-input.test.mjs, test/core.test.mjs, test/security.test.mjs and test/usb-safety.test.mjs.
HTTP GET / returns self-contained HTML; HEAD returns headers; invalid Host/Origin 403, nonread method 405, unknown path 404, unavailable build 500 with generic error.
Project JSON format=LieneCut, version=1; settings, embedded PNG artwork and optional legacy importedCut are validated by validateProject before decode. Existing v1 projects remain compatible.
USB io.write(endpoint, Uint8Array), io.read(endpoint, maximumLength, timeoutMs); PixCut serializes control requests. No firmware, calibration or factory commands are allowed.
No new contract fields or protocol version introduced.

## Privacy and UI
Data inventory: ../privacy/data-inventory.md. Artwork stays in tab memory until explicit save/print. Clear erases the working composite and references; browser-managed settings/USB grants and downloaded files have separate deletion paths. No third-party runtime processor or analytics.
Existing index.html tokens and src/app.js interaction states are retained. Empty, importing, error, disconnected, permission-cancelled, printing and cancellation states are covered by tools/ui-check.mjs and tools/security-check.mjs. Keyboard focus and responsive design are verified at 320/390/1440 pixels. No separate component framework or prototype is needed for the existing app.
Decision: retain vanilla JS, one bundled HTML, local Node server and existing WebUSB protocol; introducing a backend would add storage and attack surface without serving scope.

