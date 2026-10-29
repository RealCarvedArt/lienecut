# Security

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/RealCarvedArt/lienecut/security/advisories/new). If the reporting form is unavailable, open an issue asking for a private contact without including exploit details, artwork, credentials, or device identifiers.

The current localhost preview is the supported release line. The maintainer triages reports and publishes fixes through GitHub releases; no response-time guarantee is offered.

LieneCut serves only loopback HTTP and processes artwork locally. Explicit printing transfers artwork to the selected USB printer. Downloaded projects contain artwork, including original pixels retained for background restoration; delete these files using your operating system. Printer-side retention is unknown.

Never use testing to send firmware, calibration, factory, or property-setting commands. Automated checks use synthetic images and fake or unavailable USB. Physical print, cancellation, and alignment require operator validation.
