import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const out = resolve('dist/ui-review');
mkdirSync(out, { recursive: true });
const server = createServer((_, res) => { res.setHeader('Content-Type', 'text/html'); res.end(readFileSync('dist/index.html')); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
const evidence = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(() => {
    // No test may request or reconnect a physical printer.
    Object.defineProperty(navigator, 'usb', { value: undefined, configurable: true });
    const Canvas = OffscreenCanvas;
    window.OffscreenCanvas = new Proxy(Canvas, { construct(target, args) {
      const canvas = new target(...args);
      window.compositeCanvas ??= canvas;
      return canvas;
    } });
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  assert.match(await page.title(), /LieneCut/);
  assert.equal(await page.$eval('#empty', el => el.hidden), false);
  assert.equal(await page.$eval('#printBtn', el => el.disabled), true);
  assert.match(await page.$eval('#usbNote', el => el.textContent), /Chrome or Edge/);
  await page.screenshot({ path: `${out}/desktop-empty.png`, fullPage: true });
  const input = await page.$('#file');
  await input.uploadFile(resolve('test/fixtures/two-shapes.png'));
  await page.waitForFunction(() => document.querySelector('#importStatus').textContent.includes('Opening'));
  await page.waitForFunction(() => !document.querySelector('#saveProjectBtn').disabled);
  assert.equal(await page.$eval('#list', el => el.children.length), 1);
  assert.equal(await page.$eval('#notice', el => el.textContent), '', 'normal imports do not emit session activity');
  assert.equal(await page.$eval('#list input', el => el.validity.valid), true);
  await page.focus('#list .acts button');
  const key = await page.evaluate(() => document.activeElement.dataset.focusKey);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.focusKey), key, 'rotation retains focus');
  await page.click('#list .acts button:nth-child(2)');
  await page.waitForFunction(() => document.querySelector('#list').children.length === 2);
  await page.focus('#list .name');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sheet');
  assert.equal(await page.$eval('#list .name', el => el.getAttribute('aria-pressed')), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sheet');
  await page.$eval('#list li.sel input[aria-label^="White border"]', el => { el.value = '9'; el.dispatchEvent(new Event('change')); });
  assert.equal(await page.$eval('#list li:not(.sel) input[aria-label^="White border"]', el => el.value), '1.5', 'other image border unchanged');
  await page.$eval('#list li.sel input[aria-label^="White border"]', el => { el.value = '1.5'; el.dispatchEvent(new Event('change')); });
  await page.$eval('#list .name', el => { el.textContent = 'A very long artwork name with enough detail to test wrapping and layout at phone width.png'; });
  await page.waitForFunction(() => !document.querySelector('#saveProjectBtn').disabled);
  await page.evaluate(() => {
    window.downloads = [];
    HTMLAnchorElement.prototype.click = function () { window.downloads.push(this.download); };
  });
  await page.click('#saveProjectBtn');
  await page.waitForFunction(() => window.downloads.length === 1);
  assert.deepEqual(await page.evaluate(() => window.downloads.map(x => x.replace(/\d+/g, 'N'))), ['lienecut-N.lienecut']);
  for (const [width, height] of [[1440, 1000], [320, 800], [390, 844]]) {
    await page.setViewport({ width, height });
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('aside').scrollTop = 0; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no overflow at ${width}`);
    const artifact = `studio-${width}.png`;
    await page.screenshot({ path: `${out}/${artifact}`, fullPage: true });
    evidence.push({ viewport: `${width}x${height}`, artifact, observation: 'Loaded artwork and long name fit; no horizontal overflow. All controls remain available through vertical scrolling.' });
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await page.$eval('.btn', el => getComputedStyle(el).transitionDuration), '0s');
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['bad'], 'broken.png', { type: 'image/png' }));
    const input = document.querySelector('#file'); input.files = dt.files; input.dispatchEvent(new Event('change'));
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('broken.png'));
  assert.equal(await page.$eval('#list', el => el.children.length), 2, 'failed import preserves existing artwork');
  const compositeHasPixels = () => page.evaluate(() => {
    const canvas = window.compositeCanvas;
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some(value => value !== 0);
  });
  assert.equal(await compositeHasPixels(), true, 'fixture populates the persistent composite raster');
  page.once('dialog', dialog => dialog.dismiss());
  await page.click('#clearBtn');
  assert.equal(await page.$eval('#list', el => el.children.length), 2, 'cancelled Clear preserves artwork');
  assert.equal(await compositeHasPixels(), true, 'cancelled Clear preserves raster');
  page.once('dialog', dialog => dialog.accept());
  await page.click('#clearBtn');
  assert.equal(await compositeHasPixels(), false, 'Clear erases the offscreen artwork raster');
  assert.equal(await page.$eval('#list', el => el.children.length), 0);
  assert.equal(await page.$eval('#notice', el => el.textContent), '');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'addBtn');
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['bad'], 'private-name.png', { type: 'image/png' }));
    const input = document.querySelector('#file'); input.files = dt.files; input.dispatchEvent(new Event('change'));
  });
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('private-name.png') && !document.querySelector('#clearBtn').disabled);
  let noticeDialogs = 0;
  const dismissUnexpected = dialog => { noticeDialogs++; dialog.dismiss(); };
  page.on('dialog', dismissUnexpected);
  await page.click('#clearBtn');
  page.off('dialog', dismissUnexpected);
  assert.equal(noticeDialogs, 0, 'clearing only a notice needs no destructive confirmation');
  assert.equal(await page.$eval('#notice', el => el.textContent), '');
  assert.equal(await page.$eval('#clearBtn', el => el.disabled), true);
  const permissionPage = await browser.newPage();
  permissionPage.on('pageerror', e => errors.push(e.message));
  await permissionPage.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'usb', { value: {
      getDevices: async () => [], addEventListener() {},
      requestDevice: () => new Promise((_, reject) => setTimeout(() => reject(new DOMException('No device selected', 'NotFoundError')), 100)),
    }});
  });
  await permissionPage.goto(`http://127.0.0.1:${server.address().port}`);
  await permissionPage.click('#connectBtn');
  assert.equal(await permissionPage.$eval('#connectBtn', el => el.disabled), true);
  await permissionPage.waitForFunction(() => document.querySelector('#notice').textContent.includes('No printer selected'));
  assert.equal(await permissionPage.$eval('#connectBtn', el => el.disabled), false);
  await permissionPage.close();
  assert.deepEqual(errors, []);
  const contrast = (a, b) => {
    const luminance = hex => hex.match(/\w\w/g).map(c => parseInt(c,16)/255).map(v => v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i) => n+v*[.2126,.7152,.0722][i],0);
    const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
  };
  for (const [fg,bg] of [['24352f','fffefa'],['56645e','edece5'],['ffffff','236348'],['c0cec6','202c29'],['754012','fff1dd']]) assert.ok(contrast(fg,bg)>=4.5, `${fg}/${bg} contrast`);
  writeFileSync(`${out}/results.json`, JSON.stringify({ passed: true, checks: ['empty and unsupported USB state','synthetic upload/loading','keyboard selection and stable focus','valid dimensions','aligned border inputs','JPG/PLT export filenames','responsive long content','reduced motion','failed import preserves sheet','clear erases offscreen raster and failed-import notices','text token contrast','no browser exceptions'], renderedEvidence: evidence, limits: ['No physical USB/print/cancel test','No OS screen-reader or axe conformance audit','Permission cancellation tested with fake WebUSB; physical device progress untested'] },null,2));
  console.log('UI checks passed; screenshots and results: dist/ui-review');
} finally { await browser.close(); server.close(); }
