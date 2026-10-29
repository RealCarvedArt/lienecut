import {readFileSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createLocalServer} from './server.mjs';
const htmlPath=new URL('./dist/index.html',import.meta.url);
if (!existsSync(htmlPath)) {console.error('Missing built app. Run npm run build, or extract the full release ZIP.');process.exit(1);}
const port=Number(process.env.LIENECUT_PORT ?? 5174);
if (!Number.isInteger(port) || port<1024 || port>65535) throw new Error('Invalid LIENECUT_PORT');
const url=`http://127.0.0.1:${port}`;
const server=createLocalServer(()=>readFileSync(htmlPath,'utf8'));
server.on('error',e=>{console.error(e.code==='EADDRINUSE' ? `${url} is already in use. Close the previous LieneCut server before starting this version.` : e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
 console.log(`LieneCut: ${url}\nKeep this window open. Press Ctrl+C to stop.`);
 if(process.argv.includes('--open') && process.platform==='win32') {
  const roots=[process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA].filter(Boolean);
  const browsers=roots.flatMap(root=>[`${root}/Google/Chrome/Application/chrome.exe`,`${root}/Microsoft/Edge/Application/msedge.exe`]);
  const browser=browsers.find(existsSync);
  if(browser) {const child=spawn(browser,[url],{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>console.log(`Open Chrome or Edge at ${url}`));child.unref();}
  else console.log(`Open Chrome or Edge at ${url}`);
 }
});
