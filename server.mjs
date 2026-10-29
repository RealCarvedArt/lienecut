import {createServer} from 'node:http';

export function createLocalServer(htmlProvider) {
  return createServer(async (req,res)=>{
    const host=req.headers.host ?? '';
    const origin=req.headers.origin;
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) || (origin && origin !== `http://${host}`)) {res.writeHead(403);res.end('Forbidden');return;}
    if (req.method !== 'GET' && req.method !== 'HEAD') {res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    if (req.url !== '/' && !req.url.startsWith('/?')) {res.writeHead(404);res.end();return;}
    try {
      const html=await htmlProvider();
      const policy=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1];
      if (!policy) throw new Error('Missing security policy');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
        'Content-Security-Policy':policy+"; frame-ancestors 'none'",'X-Frame-Options':'DENY',
        'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'usb=(self)'});
      res.end(req.method === 'HEAD' ? undefined : html);
    } catch {res.writeHead(500,{'Content-Type':'text/plain'});res.end('Unable to load LieneCut. Check the local installation.');}
  });
}
