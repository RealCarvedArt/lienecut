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
  const response=await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle0'});
  assert.equal(response.status(),200);
  assert.ok((await page.metrics()).TaskDuration < 2,'local initial render exceeds the 2 s CPU budget');
  assert.equal(await page.$eval('#empty',el=>!el.hidden),true);
  console.log('Local static page rendered within the 2 s CPU budget.');
} finally {
  await browser.close();
  await new Promise(r=>server.close(r));
}
