# Run LieneCut locally

Download and double-click **LieneCut.exe** from the Windows release. Chrome or Edge opens at http://127.0.0.1:5174 and the local server runs without a terminal window. No Node.js or npm dependencies are needed. Close it from Task Manager as **LieneCut-runtime.exe** when you are finished.

If another server uses port 5174, close that server first. For a different port, set LIENECUT_PORT before running `node serve.mjs`. The server binds only to 127.0.0.1 and serves only the built page.

Use **Save project** before closing/reloading the browser. Later, use **Open project** to restore images, positions, sizes, rotation, borders, holes, and pressure. Save files are local downloads and may contain original image pixels retained for Restore original; delete them through your operating system when no longer needed.

Connect the PixCut S1 by USB, close other printer applications, and choose Connect printer in Chrome or Edge. Keep the tab open during printing. Cancellation stops further transfers and requests device cancellation, but cannot undo a cut or interrupt a USB operation already in flight.

Build from source: `npm ci`, `npm test`, `npm run build`, then `npm start`. Physical printer behavior and alignment have not been independently verified.
