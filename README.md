# LieneCut

A local sticker-layout and print-and-cut app for the Liene PixCut S1. Artwork stays in your browser; printing uses USB. No account or cloud service is required.

## Windows localhost release

1. Download **LieneCut.exe** from [Releases](https://github.com/RealCarvedArt/lienecut/releases).
2. Double-click it. It starts the server at **http://127.0.0.1:5174** and opens Chrome or Edge without a terminal window.

The release is a single self-contained executable: no Node.js, npm install, build, or terminal is needed. It listens only on your computer. Close a previous server before starting an updated release; save your project before refreshing an older tab.

## Make a sheet

Add JPEG, PNG, WebP or GIF artwork. Move, freely rotate, resize, unlink width/height, and arrange it on a 4 × 7 in sheet. Each image has its own white border and inner-hole cutting option. Background removal works on edge-connected solid colors; it is not photographic subject segmentation.

**Save project** downloads one `.lienecut` file with artwork, layout, and cut settings. **Open project** restores it for editing and later printing. Projects also retain original pixels for restoring a removed background. There are no standalone JPG/PLT export or PLT import controls.

Connect the PixCut S1 over USB in Chrome or Edge. Close other printer apps/tabs, select **Connect printer**, then **Print & cut sheet**. Printer compatibility and alignment depend on the device, media and firmware. The default knife pressure is 42; check your media before a full run.

## Limits and release status

Images: 20 MiB and 16 megapixels each, 100 files / 100 MB per import, 64 megapixels of artwork per sheet. Projects: 100 MB, 500 items, 64 megapixels including original backgrounds. Unsupported or malformed imports are rejected without replacing an existing project.

Automated tests cover cancellation, print snapshots, USB cleanup, input limits, security headers and project round-trips. Physical printing/cancellation, screen-reader testing and the complete fullstack harness have not been certified. WebUSB cannot forcibly interrupt an already-running USB transfer; cancellation stops subsequent chunks and requests printer cancellation.

See [local instructions](LOCAL.md), [security remediation](docs/security/remediation-2026-10-28.md), and [harness status](docs/harness/STATE.md).

## Development

```sh
npm ci
npm test
npm run build
npm start
# Or rebuild on each request:
npm run dev
```

Browser checks in `tools/*check.mjs` use Chrome with mocked or disabled USB; they never print. They currently use the Windows Chrome installation path.

## Credits and license

Based on [BrenCut by LTKMN](https://github.com/LTKMN/brencut). Cut-path tracer: [honeymaro/pixcut](https://github.com/honeymaro/pixcut), vendored with its MIT license. USB protocol research: [popcornhax/PixCut-App](https://github.com/popcornhax/PixCut-App), MIT.

MIT; see [LICENSE](LICENSE). Not affiliated with Liene or Hannto.
