import {readFileSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {createLocalServer} from './server.mjs';
const htmlPath=new URL('./dist/index.html',import.meta.url);
if (!existsSync(htmlPath)) {console.error('Missing built app. Run npm run build, or extract the full release ZIP.');process.exit(1);}
const port=Number(process.env.LIENECUT_PORT ?? 5219);
if (!Number.isInteger(port) || port<1024 || port>65535) throw new Error('Invalid LIENECUT_PORT');
const url=`http://127.0.0.1:${port}`;
const server=createLocalServer(()=>readFileSync(htmlPath,'utf8'));
server.prependListener('request',(req,res)=>res.setHeader('X-LieneCut-Launcher','app-window-v1'));
function openApp(ownsServer) {
 if (!process.argv.includes('--open') || process.platform!=='win32') return;
 const roots=[process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean);
 const browsers=roots.flatMap(root=>[`${root}/Google/Chrome/Application/chrome.exe`,`${root}/Microsoft/Edge/Application/msedge.exe`]);
 const browser=browsers.find(existsSync);
 const fail=message=>{console.error(message);process.exitCode=1;if(ownsServer) server.close();};
 if (!browser) {fail('Install Chrome or Edge to open LieneCut.');return;}
 // A separate browser process lets closing the app window stop its server.
 const profile=join(process.env.LOCALAPPDATA ?? process.cwd(),'LieneCut',`browser-profile-${port}`);
 const child=spawn(browser,[`--app=${url}`,`--user-data-dir=${profile}`,'--disable-background-mode','--no-first-run','--no-default-browser-check'],{stdio:'ignore',windowsHide:true});
 child.once('error',e=>fail(`Unable to open LieneCut: ${e.message}`));
 child.once('exit',code=>{
  if(code) fail(`LieneCut browser exited with code ${code}.`);
  else if(ownsServer) server.close();
 });
}
server.on('error',async e=>{
 if(e.code==='EADDRINUSE') {
  try {
   const response=await fetch(url,{signal:AbortSignal.timeout(3000),redirect:'error'});
   if(response.ok && response.headers.get('X-LieneCut-Launcher')==='app-window-v1' && await response.text()===readFileSync(htmlPath,'utf8')) {
    console.log(`LieneCut is already running at ${url}`);
    openApp(false);
    return;
   }
  } catch {}
 }
 console.error(e.code==='EADDRINUSE' ? `${url} is already in use by another app or version of LieneCut.` : e.message);
 process.exitCode=1;
});
server.listen(port,'127.0.0.1',()=>{
 console.log(`LieneCut: ${url}\nClose the LieneCut app window to stop, or press Ctrl+C here.`);
 openApp(true);
});
