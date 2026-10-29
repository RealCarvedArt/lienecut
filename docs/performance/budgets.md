# LieneCut performance budget

The delivered localhost HTML is 78 KiB. On a Windows GitHub runner and local Chrome, the empty static page must serve successfully, show its initial state, and report less than two seconds of JavaScript task duration. `tools/performance-check.mjs` is the blocking automated check.

There is no authenticated response, CDN, server cache, database, rate-limit service, or shared user data. The local server sends `Cache-Control: no-store`; this avoids stale local builds and any cross-user cache concern. Browser image limits bound decode work. Reassess this small local budget if hosting, large assets, or background processing is added.
