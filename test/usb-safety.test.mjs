import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PixCut, DATA, CTRL} from '../src/protocol.js';
import {openPrinter} from '../src/webusb.js';
const bytes = new Uint8Array(1);
const abortError = {name:'AbortError'};
function printer(io={}) {
 const px=new PixCut(io), calls=[];
 px.status=async()=>{calls.push('status');return {state:20,alerts:[]};};
 px.createComboJob=async()=>{calls.push('create');return 35;};
 px.cancel=async id=>{calls.push(`cancel:${id}`);};
 return {px,calls};
}

test('pre-aborted print performs no printer operations',async()=>{
 const {px,calls}=printer(), abort=new AbortController();abort.abort();
 await assert.rejects(px.printAndCut(bytes,bytes,{signal:abort.signal}),abortError);
 assert.deepEqual(calls,[]);
});
test('abort during preflight or declaration status prevents job creation',async()=>{
 for(const stage of ['preflight','declare']) {
  const {px,calls}=printer(), abort=new AbortController();
  if(stage==='preflight')px.status=async()=>{abort.abort();return {state:20,alerts:[]};};
  await assert.rejects(px.printAndCut(bytes,bytes,{signal:abort.signal,onStatus:()=>abort.abort()}),abortError);
  assert.ok(!calls.includes('create'));
 }
});
test('abort while declaration is in flight cancels assigned job without upload',async()=>{
 const {px,calls}=printer(), abort=new AbortController();
 px.createComboJob=async()=>{abort.abort();return 35;};
 px.upload=()=>assert.fail('must not upload');
 await assert.rejects(px.printAndCut(bytes,bytes,{signal:abort.signal}),abortError);
 assert.deepEqual(calls,['status','cancel:35']);
});
test('abort during a chunk stops later chunks and the image file',async()=>{
 const abort=new AbortController(),writes=[];
 const {px,calls}=printer({write:async(ep,data)=>{writes.push(ep);abort.abort();},read:()=>assert.fail('must stop after in-flight write')});
 await assert.rejects(px.printAndCut(bytes,new Uint8Array(5000),{signal:abort.signal}),abortError);
 assert.deepEqual(writes,[DATA.out]);assert.equal(calls.at(-1),'cancel:35');
});
test('abort during acknowledgement wait is checked without another write',async()=>{
 const abort=new AbortController();let writes=0;
 const {px,calls}=printer({write:async()=>writes++,read:async(_ep,_len,timeout)=>{assert.ok(timeout<=100);abort.abort();return new Uint8Array();}});
 await assert.rejects(px.printAndCut(bytes,new Uint8Array(5000),{signal:abort.signal}),abortError);
 assert.equal(writes,1);assert.equal(calls.at(-1),'cancel:35');
});
test('upload failures cancel the assigned job and retain the original error',async()=>{
 const error=new Error('transfer failed'),{px,calls}=printer();
 px.upload=async()=>{throw error;};px.cancel=async id=>{calls.push(`cancel:${id}`);throw new Error('disconnected');};
 await assert.rejects(px.printAndCut(bytes,bytes),e=>e===error);
 assert.equal(calls.at(-1),'cancel:35');
});
test('abort between documents prevents the image upload',async()=>{
 const {px,calls}=printer(),abort=new AbortController();let uploads=0;
 px.upload=async()=>{uploads++;abort.abort();};
 await assert.rejects(px.printAndCut(bytes,bytes,{signal:abort.signal}),abortError);
 assert.equal(uploads,1);assert.equal(calls.at(-1),'cancel:35');
});

function device(failAt) {
 const calls=[];const error=new Error('setup failed');
 const run=async label=>{calls.push(label);if(label===failAt)throw error;};
 return {calls,error,open:()=>run('open'),selectConfiguration:()=>run('select'),claimInterface:n=>run(`claim:${n}`),close:()=>run('close'),transferIn:()=>new Promise(()=>{}),transferOut:async()=>({status:'ok'})};
}
test('configuration and either interface claim failure close the device',async()=>{
 for(const stage of ['select',`claim:${CTRL.iface}`,`claim:${DATA.iface}`]) {
  const dev=device(stage);await assert.rejects(openPrinter(dev),e=>e===dev.error);
  assert.equal(dev.calls.at(-1),'close');assert.equal(dev.calls.filter(c=>c==='close').length,1);
 }
});
test('USB setup cleanup does not mask the original failure',async()=>{
 const dev=device('select');dev.close=async()=>{throw new Error('close failed');};
 await assert.rejects(openPrinter(dev),e=>e===dev.error);
});
test('closing USB rejects pending and future reads immediately',async()=>{
 const dev=device(),conn=await openPrinter(dev);
 const pending=conn.io.read(CTRL.in,4096,10000);
 const rejected=assert.rejects(pending,/connection closed/);
 await conn.close();await rejected;
 await assert.rejects(conn.io.read(DATA.in,4096,10000),/connection closed/);
 assert.equal(dev.calls.at(-1),'close');
});
