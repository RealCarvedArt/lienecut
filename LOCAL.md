# Run LieneCut locally

Install Node.js 22.18 or newer, download and extract the Windows release ZIP, then double-click **LieneCut.exe**. A dedicated Chrome or Edge app window opens at http://127.0.0.1:5219 without a terminal window. No npm install or build is needed. **Start Printer.cmd** is also included. Closing the last LieneCut app window shuts down the server and frees its port. The dedicated browser profile needs printer permission once.

Launching the same version again reuses its running server. A different app or build on the port produces an error; close that app or set LIENECUT_PORT to a free port before starting LieneCut. Port 5219 avoids the Windows reservation that blocked port 5174 on the reported PC. The server binds only to 127.0.0.1 and serves only the built page.

Use **Save project** before closing/reloading the browser. Later, use **Open project** to restore images, positions, sizes, rotation, borders, holes, and pressure. Save files are local downloads and may contain original image pixels retained for Restore original; delete them through your operating system when no longer needed.

Connect the PixCut S1 by USB, close other printer applications, and choose Connect printer in Chrome or Edge. Keep the tab open during printing. Cancellation stops further transfers and requests device cancellation, but cannot undo a cut or interrupt a USB operation already in flight.

Build from source: `npm ci`, `npm test`, `npm run build`, then `npm start`. Physical printer behavior and alignment have not been independently verified.
