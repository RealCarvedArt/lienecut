import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import puppeteer from 'puppeteer-core';
import {createLocalServer} from '../server.mjs';
const server=createLocalServer(()=>readFileSync('dist/index.html','utf8'));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage();
 await page.evaluateOnNewDocument(()=>{
   localStorage.setItem('brencut.kp','999');localStorage.setItem('brencut.marginMm','-9');
   const device={configuration:{},open:async()=>{},claimInterface:async()=>{},transferIn:()=>new Promise(()=>{}),transferOut:async()=>{throw new Error('Mock identification failed');},close:async()=>{window.closedCount=(window.closedCount||0)+1;}};
   Object.defineProperty(navigator,'usb',{value:{getDevices:async()=>[],requestDevice:async()=>device,addEventListener:()=>{}},configurable:true});
 });
 const response=await page.goto(`http://127.0.0.1:${server.address().port}`);
 assert.equal(response.headers()['x-frame-options'],'DENY');
 await page.waitForSelector('#kp');assert.equal(await page.$eval('#kp',el=>el.value),'42');
 await page.evaluate(()=>{const s=document.createElement('script');s.textContent='window.injected=true';document.head.append(s);});
 assert.equal(await page.evaluate(()=>window.injected),undefined,'CSP blocks unapproved scripts');
 await page.click('#connectBtn');await page.waitForFunction(()=>window.closedCount===1);
 assert.match(await page.$eval('#notice',el=>el.textContent),/Mock identification failed/);
 await page.evaluate(()=>{window.decodes=0;const original=createImageBitmap;window.createImageBitmap=(...args)=>{window.decodes++;return original(...args);};
 const bytes=new Uint8Array(33),v=new DataView(bytes.buffer);v.setUint32(0,0x89504e47);v.setUint32(4,0x0d0a1a0a);v.setUint32(8,13);v.setUint32(12,0x49484452);v.setUint32(16,100000);v.setUint32(20,100000);
 const dt=new DataTransfer();dt.items.add(new File([bytes],'huge.png',{type:'image/png'}));const f=document.querySelector('#file');f.files=dt.files;f.dispatchEvent(new Event('change'));});
 await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('16 megapixels'));
 assert.equal(await page.evaluate(()=>window.decodes),0,'oversized image rejected before decoder');
 await (await page.$('#file')).uploadFile('test/fixtures/square-4x7.png');
 await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
 assert.equal(await page.$eval('input[aria-label^="White border"]',el=>el.value),'1.5');
 console.log('CSP/headers, malformed stored settings, predecode rejection and failed identification cleanup passed with fake USB.');
}finally{await browser.close();server.close();}
