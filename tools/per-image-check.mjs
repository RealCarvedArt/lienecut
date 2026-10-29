import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import puppeteer from 'puppeteer-core';
import {parsePlt} from '../vendor/pixcut-trace/plt.ts';
const server=createServer((_,res)=>{res.setHeader('Content-Type','text/html');res.end(readFileSync('dist/index.html'));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.evaluateOnNewDocument(()=>Object.defineProperty(navigator,'usb',{value:undefined}));
 await page.setViewport({width:1440,height:1000});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.evaluate(async()=>{
   const dt=new DataTransfer();
   for(let i=0;i<2;i++){
     const c=document.createElement('canvas');c.width=c.height=240;const g=c.getContext('2d');
     g.fillStyle=i?'#2030ee':'#ee2020';g.beginPath();g.arc(120,120,110,0,Math.PI*2);g.arc(120,120,60,0,Math.PI*2,true);g.fill('evenodd');
     const blob=await new Promise(r=>c.toBlob(r,'image/png'));dt.items.add(new File([blob],`ring-${i}.png`,{type:'image/png'}));
   }
   const input=document.querySelector('#file');input.files=dt.files;input.dispatchEvent(new Event('change'));
 });
 const ready=()=>page.waitForFunction(()=>!document.querySelector('#saveProjectBtn').disabled);
 await ready();
 const change=async(selector,value)=>{await page.$eval(selector,(el,value)=>{el.value=value;el.dispatchEvent(new Event('change'));},value);await ready();};
 await page.click('#list li:first-child .name');
 await change('#list li.sel input[aria-label^="White border"]',0);
 await page.click('#list li:last-child .name');
 await change('#list li.sel input[aria-label^="White border"]',3);
 assert.equal(await page.$eval('#list li:first-child input[aria-label^="White border"]',el=>el.value),'0');
 await page.evaluate(()=>{window.exportBlob=null;URL.createObjectURL=blob=>{window.exportBlob=blob;return 'blob:test';};HTMLAnchorElement.prototype.click=()=>{};});
 const pathCount=()=>page.$eval('#cutStats',el=>parseInt(el.textContent));
 assert.equal(await pathCount(),2);
 await page.click('#list li.sel input[aria-label^="Cut inner holes"]');await ready();
 assert.equal(await pathCount(),3,'only second ring adds inner cut');
 assert.equal(await page.$eval('#list li:first-child input[aria-label^="Cut inner holes"]',el=>el.checked),false);
 await page.click('#list li:first-child .name');
 const dims=()=>page.$eval('#list li.sel',el=>({w:+el.querySelector('input[aria-label^="Width"]').value,h:+el.querySelector('input[aria-label^="Height"]').value}));
 const original=await dims();
 await page.click('#list li.sel button[aria-label^="Link width"]');
 await change('#list li.sel input[aria-label^="Width"]',(original.w*1.5).toFixed(1));
 const wide=await dims();assert.equal(wide.h,original.h);assert.ok(wide.w>original.w*1.4);
 await change('#list li.sel input[aria-label^="Height"]',(original.h*.75).toFixed(1));
 assert.equal((await dims()).w,wide.w,'unlinked height preserves width');
 await page.click('#list li.sel button[aria-label^="Link width"]');
 const linked=await dims();await change('#list li.sel input[aria-label^="Width"]',(linked.w*1.2).toFixed(1));
 assert.ok(Math.abs((await dims()).h-linked.h*1.2)<.2,'relink preserves current aspect ratio');
 await page.click('#list li.sel button[aria-label^="Link width"]');
 const preDrag=await dims();
 const bounds=await page.$eval('#sheet',c=>{
   const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(data[i]>170&&data[i+1]<80&&data[i+2]<80){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
   const r=c.getBoundingClientRect();return{x0,y0,x1,y1,left:r.x,top:r.y,scale:r.width/c.width};
 });
 await page.mouse.move(bounds.left+(bounds.x1+1)*bounds.scale,bounds.top+(bounds.y1+1)*bounds.scale);await page.mouse.down();
 await page.mouse.move(bounds.left+(bounds.x1+31)*bounds.scale,bounds.top+(bounds.y1+1)*bounds.scale,{steps:3});await page.mouse.up();await ready();
 const stretched=await dims();assert.ok(stretched.w>preDrag.w+3,'unlinked handle widens');assert.ok(Math.abs(stretched.h-preDrag.h)<.2,'unlinked horizontal drag leaves height');
 await change('#list li.sel input[aria-label^="Rotation"]',31.5);
 await page.click('#arrangeBtn');await ready();
 assert.equal(await page.$eval('#list li:first-child input[aria-label^="White border"]',el=>el.value),'0');
 assert.equal(await page.$eval('#list li:last-child input[aria-label^="White border"]',el=>el.value),'3');
 assert.equal(await pathCount(),3);
 await page.screenshot({path:'dist/per-image-settings.png',fullPage:true});
 await page.setViewport({width:320,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('Independent borders/holes verified in cut preview; unlinked fields and pointer resize, relinking, rotation, packing and mobile layout passed.');
} finally {await browser.close();server.close();}
