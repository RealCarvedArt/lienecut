import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
const server = createServer((_, res) => { res.setHeader('Content-Type','text/html'); res.end(readFileSync('dist/index.html')); });
await new Promise(r => server.listen(0,'127.0.0.1',r));
const browser = await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(()=>Object.defineProperty(navigator,'usb',{value:undefined}));
  await page.setViewport({width:1440,height:1000});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  assert.match(await page.$eval('#file',el=>el.accept), /image\/jpeg/);
  async function addJpegs(count) {
    await page.evaluate(async count=>{
      const dt=new DataTransfer();
      for(let i=0;i<count;i++) {
        const c=document.createElement('canvas'); c.width=200+i*30; c.height=120+i*25;
        const g=c.getContext('2d'); g.fillStyle=i===0?'#ee2020':`hsl(${i*60},70%,45%)`; g.fillRect(0,0,c.width,c.height);
        const blob=await new Promise(r=>c.toBlob(r,'image/jpeg'));
        dt.items.add(new File([blob],`photo-${i}.jpg`,{type:'image/jpeg'}));
      }
      const el=document.querySelector('#file');el.files=dt.files;el.dispatchEvent(new Event('change'));
    },count);
    await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
  }
  await addJpegs(1);
  assert.equal(await page.$$eval('#list li',els=>els.length),1);
  await page.$eval('#list li.sel input[aria-label^="White border"]',el=>{el.value=4;el.dispatchEvent(new Event('change'));});
  await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
  const redBounds=()=>page.$eval('#sheet',c=>{
    const {data}=c.getContext('2d').getImageData(0,0,c.width,c.height);let x0=c.width,y0=c.height,x1=-1,y1=-1;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(data[i]>170&&data[i+1]<80&&data[i+2]<80){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
    return {x0,y0,x1,y1};
  });
  const before=await redBounds();
  const canvas=await page.$eval('#sheet',el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,scale:r.width/el.width};});
  const px=x=>canvas.x+x*canvas.scale,py=y=>canvas.y+y*canvas.scale;
  const y=(before.y0+before.y1)/2;
  await page.mouse.move(px(before.x0-24),py(y));
  await page.mouse.down();await page.mouse.move(px(before.x0-24+180),py(y+160),{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
  const after=await redBounds();
  assert.ok(Math.abs(after.x0-before.x0-180)<3,'drag starts in white border');
  assert.ok(Math.abs(after.y0-before.y0-160)<3,'border moves with art');
  await page.mouse.move(px(after.x0+70),py(after.y0+50));await page.mouse.down();await page.mouse.move(px(-500),py(-500),{steps:3});await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
  const clamped=await redBounds();
  assert.ok(clamped.x0>=83&&clamped.y0>=83,'edge clearance includes 4mm border plus 3mm safe margin');
  await page.$eval('input[aria-label^="Rotation"]',el=>{el.value='37.5';el.dispatchEvent(new Event('change'));});
  await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
  assert.equal(await page.$eval('input[aria-label^="Rotation"]',el=>el.value),'37.5');
  const rotated=await redBounds();
  const rad=37.5*Math.PI/180;
  assert.ok(Math.abs(rotated.x1-rotated.x0-(200*Math.cos(rad)+120*Math.sin(rad)))<6,'raster uses arbitrary angle');
  await page.$eval('input[aria-label^="Rotation"]',el=>{el.value='-22.25';el.dispatchEvent(new Event('change'));});
  assert.equal(await page.$eval('input[aria-label^="Rotation"]',el=>el.value),'337.75');
  await addJpegs(5);
  const input=await page.$('#file');await input.uploadFile(resolve('test/fixtures/two-shapes.png'));
  await page.waitForFunction(()=>document.querySelector('#list').children.length===7&&!document.querySelector('#saveProjectBtn').disabled);
  await page.click('#arrangeBtn');
  await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
  assert.equal(await page.$$eval('#list li',els=>els.length),7,'arrange includes all artwork');
  assert.match(await page.$eval('#importStatus',el=>el.textContent),/Arranged 7/);
  assert.equal(await page.$$eval('#list input',els=>els.every(el=>el.validity.valid)),true);
  mkdirSync('dist/ui-review',{recursive:true});
  await page.screenshot({path:'dist/ui-review/arranged-jpegs.png',fullPage:true});
  await page.setViewport({width:320,height:800});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewport({width:1440,height:1000});

  assert.equal(await page.$eval('#toggleArtwork',el=>el.getAttribute('aria-expanded')),'false');
  for (const id of ['addBtn','arrangeBtn','clearBtn']) assert.equal(await page.$eval('#'+id,el=>el.getBoundingClientRect().height>0&&!el.disabled),true,'toolbar stays available');
  assert.equal(await page.$eval('#list li.sel .fields',el=>el.getBoundingClientRect().height>0),true,'active image stays expanded');
  assert.equal(await page.$eval('#list li:not(.sel) .fields',el=>el.getBoundingClientRect().height),0,'inactive controls compact');
  await page.click('#list li:not(.sel) .name');
  assert.equal(await page.$eval('#list li.sel .fields',el=>el.getBoundingClientRect().height>0),true,'new selection expands');
  await page.$eval('#list li.sel input[aria-label^="White border"]',el=>{el.value=4;el.dispatchEvent(new Event('change'));});
  assert.equal(await page.$eval('#toggleArtwork',el=>el.getAttribute('aria-expanded')),'false','compact state survives edits');
  await page.screenshot({path:'dist/ui-review/compact-artwork.png',fullPage:true});
  await page.click('#toggleArtwork');
  assert.equal(await page.$$eval('#list .fields',els=>els.every(el=>el.getBoundingClientRect().height>0)),true);
  page.once('dialog',d=>d.accept()); await page.click('#clearBtn');
  await page.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=c.height=200;
    const g=c.getContext('2d');g.fillStyle='#ee2020';g.beginPath();g.arc(100,100,60,0,Math.PI*2);g.fill();
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    const dt=new DataTransfer();dt.items.add(new File([blob],'circle.png',{type:'image/png'}));
    const input=document.querySelector('#file');input.files=dt.files;input.dispatchEvent(new Event('change'));
  });
  await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
  await page.$eval('#list li.sel input[aria-label^="White border"]',el=>{el.value=4;el.dispatchEvent(new Event('change'));});
  await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
  const circle=await redBounds();
  const center={x:(circle.x0+circle.x1)/2,y:(circle.y0+circle.y1)/2};
  const sheet=await page.$eval('#sheet',el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,s:r.width/el.width};});
  const outlineAt=(x,y)=>page.$eval('#sheet',(el,{x,y})=>{
    const d=el.getContext('2d').getImageData(Math.round(x)-5,Math.round(y)-5,11,11).data;
    let dark=0;for(let i=0;i<d.length;i+=4)if(d[i]<100&&d[i+1]<140&&d[i+2]<120)dark++;return dark;
  },{x,y});
  // Circle's diagonal outline is distinct from its rectangular selection bounds.
  assert.ok(await outlineAt(center.x+76,center.y-76)>5,'initial curved border');
  await page.mouse.move(sheet.x+center.x*sheet.s,sheet.y+center.y*sheet.s);
  await page.mouse.down();
  await page.mouse.move(sheet.x+(center.x+180)*sheet.s,sheet.y+(center.y+160)*sheet.s);
  assert.ok(await outlineAt(center.x+180+76,center.y+160-76)>5,'curved border stays visible before mouseup');
  assert.equal(await page.$eval('#saveProjectBtn',el=>el.disabled),true,'export waits for final merged trace');
  await page.mouse.move(sheet.x+(center.x+240)*sheet.s,sheet.y+(center.y+200)*sheet.s);
  assert.ok(await outlineAt(center.x+240+76,center.y+200-76)>5,'curved border follows subsequent moves');
  await page.screenshot({path:'dist/ui-review/live-border-drag.png',fullPage:true});
  await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
  assert.ok(await outlineAt(center.x+240+76,center.y+200-76)>5,'final cut agrees after release');
  const rotatedCenter={x:center.x+240,y:center.y+200};
  const radius=11/sheet.s;
  const hy=Math.max(radius+4,rotatedCenter.y-60-Math.ceil(4*300/25.4)-radius*3);
  const arm=rotatedCenter.y-hy, angle=43*Math.PI/180;
  await page.mouse.move(sheet.x+rotatedCenter.x*sheet.s,sheet.y+hy*sheet.s);
  await page.mouse.down();
  await page.mouse.move(sheet.x+(rotatedCenter.x+arm*Math.sin(angle))*sheet.s,sheet.y+(rotatedCenter.y-arm*Math.cos(angle))*sheet.s,{steps:5});
  await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
  const degrees=await page.$eval('input[aria-label^="Rotation"]',el=>Number(el.value));
  assert.ok(Math.abs(degrees-43)<2,`free rotation follows pointer: ${degrees}`);
  await page.screenshot({path:'dist/ui-review/free-rotation.png',fullPage:true});
  const rb=await redBounds(), cx=(rb.x0+rb.x1)/2,cy=(rb.y0+rb.y1)/2;
  await page.mouse.move(sheet.x+cx*sheet.s,sheet.y+cy*sheet.s);
  await page.mouse.down();await page.mouse.move(sheet.x-200,sheet.y-200,{steps:3});await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
  const edgeCircle=await redBounds();
  assert.ok(edgeCircle.x0>=82&&edgeCircle.x0<=86,`visible circle, not rotated box, meets left margin: ${edgeCircle.x0}`);
  assert.ok(edgeCircle.y0>=82&&edgeCircle.y0<=86,`visible circle meets top margin: ${edgeCircle.y0}`);
  assert.ok(Math.abs((edgeCircle.x1-edgeCircle.x0)-(rb.x1-rb.x0))<3,'moving keeps artwork size');
  await page.screenshot({path:'dist/ui-review/shape-placement.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Free rotation handle, active-card expansion, persistent compact list with toolbar, live curved border, JPEG, 37.5/-22.25 degree rotation, border dragging/clamping, mixed full-sheet packing and mobile controls passed.');
} finally {await browser.close();server.close();}
