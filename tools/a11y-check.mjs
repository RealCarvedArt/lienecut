import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import puppeteer from 'puppeteer-core';
import {createLocalServer} from '../server.mjs';
const server=createLocalServer(()=>readFileSync('dist/index.html','utf8'));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage();
 await page.evaluateOnNewDocument(()=>Object.defineProperty(navigator,'usb',{value:undefined}));
 // Test-only injection for axe; security-check separately verifies enforced CSP.
 await page.setBypassCSP(true);
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
 for (const state of ['empty','loaded','mobile']) {
  if(state==='loaded') {await (await page.$('#file')).uploadFile('test/fixtures/two-shapes.png');await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);}
  await page.setViewport({width:state==='mobile'?320:1440,height:900});
  const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})));
  assert.deepEqual(violations,[],state+' accessibility violations: '+JSON.stringify(violations));
 }
 console.log('Axe WCAG A/AA checks passed for empty, loaded and mobile states.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

