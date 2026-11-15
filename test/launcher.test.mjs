import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {once} from 'node:events';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const run=promisify(execFile);
const html='<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head>LieneCut';
async function installation(t) {
 const root=await mkdtemp(join(tmpdir(),'lienecut-launcher-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'dist'));
 await writeFile(join(root,'dist','index.html'),html);
 for(const name of ['serve.mjs','server.mjs']) await copyFile(new URL(`../${name}`,import.meta.url),join(root,name));
 return join(root,'serve.mjs');
}
async function listener(t,body,compatible=true) {
 const server=createServer((req,res)=>{if(compatible) res.setHeader('X-LieneCut-Launcher','app-window-v1');res.end(body);});
 t.after(()=>{server.closeAllConnections();server.close();});
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 return server;
}
for(const [name,body,reuse,compatible] of [['LieneCut',html,true,true],['another app','Other application',false,true],['older LieneCut',html,false,false]]) {
 test(`occupied port: ${name}`,async t=>{
  const script=await installation(t),server=await listener(t,body,compatible);
  const options={env:{...process.env,LIENECUT_PORT:String(server.address().port)},timeout:10000};
  if(reuse) {
   const {stdout,stderr}=await run(process.execPath,[script],options);
   assert.match(stdout,/LieneCut is already running at http:\/\/127\.0\.0\.1:/);
   assert.equal(stderr,'');
   assert.equal((await fetch(`http://127.0.0.1:${server.address().port}`)).status,200,'existing server remains available');
  } else {
   await assert.rejects(run(process.execPath,[script],options),error=>{
    assert.equal(error.code,1);assert.match(error.stderr,/already in use/);return true;
   });
  }
 });
}
test('closing the app browser releases its server port',{skip:process.platform!=='win32'},async t=>{
 const script=await installation(t),reservation=await listener(t,'');
 const port=reservation.address().port;
 await new Promise(resolve=>reservation.close(resolve));
 // Replace only the browser process; exercise the real server and exit handling.
 const preload=`import cp from 'node:child_process';
 import {syncBuiltinESMExports} from 'node:module';
 import {EventEmitter} from 'node:events';
 import assert from 'node:assert/strict';
 cp.spawn=(file,args)=>{
  assert.match(file,/(chrome|msedge)\\.exe$/i);
  assert.ok(args.some(a=>a.startsWith('--user-data-dir=')));
  assert.ok(args.includes('--disable-background-mode'));
  const child=new EventEmitter();
  setTimeout(async()=>{
   try {
    const response=await fetch(args.find(a=>a.startsWith('--app=')).slice(6));
    assert.equal(await response.text(),${JSON.stringify(html)});
    console.log('App window loaded');child.emit('exit',0);
   } catch(error) {console.error(error);child.emit('exit',1);}
  },100);
  return child;
 };
 syncBuiltinESMExports();`;
 const {stdout,stderr}=await run(process.execPath,['--import',`data:text/javascript,${encodeURIComponent(preload)}`,script,'--open'],{
  env:{...process.env,LIENECUT_PORT:String(port)},timeout:10000
 });
 assert.match(stdout,/App window loaded/);assert.equal(stderr,'');
 await assert.rejects(fetch(`http://127.0.0.1:${port}`),/fetch failed/);
});
