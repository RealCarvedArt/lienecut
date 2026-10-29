import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createLocalServer} from '../server.mjs';
import {traceSheet,combineCuts,CUT_DEFAULTS,snapshotPrint} from '../src/cut.js';
import {PixCut,SHEET} from '../src/protocol.js';

test('invalid pressure, borders and flags are rejected at tracing boundary',()=>{
 const raster={width:SHEET.w,height:SHEET.h,data:new Uint8Array(SHEET.w*SHEET.h*4)};
 for(const opts of [{knifePressure:0},{knifePressure:101},{knifePressure:NaN},{knifePressure:1.5},{marginMm:Infinity},{marginMm:-1},{marginMm:'2'},{cutHoles:'false'},{alphaThreshold:0}]) assert.throws(()=>traceSheet(raster,opts));
 assert.throws(()=>combineCuts([],0));
});
test('print snapshot remains paired after source artwork and cut are edited',()=>{
 const raster={width:SHEET.w,height:SHEET.h,data:new Uint8Array(SHEET.w*SHEET.h*4)};raster.data.set([100,50,20,255],0);
 const cut={plt:'IN VER0.1.0 KP42 U100,100 D100,100 D200,200 U6476,0  @ '};
 const job=snapshotPrint(raster,cut);const before=cut.plt;
 raster.data.fill(0);cut.plt='changed';
 const p=(SHEET.padY*SHEET.rasterW+SHEET.padX)*4;
 assert.deepEqual([...job.raster.data.slice(p,p+4)],[100,50,20,255]);assert.equal(new TextDecoder().decode(job.plt),before);
});
test('localhost serves security headers, rejects foreign hosts/origins and unsafe methods',async()=>{
 const html='<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head>';
 const server=createLocalServer(()=>html);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const get=(headers={},method='GET',path='/')=>new Promise((resolve,reject)=>{const r=request({host:'127.0.0.1',port:server.address().port,path,method,headers},res=>{res.resume();res.on('end',()=>resolve(res));});r.on('error',reject);r.end();});
 try {
  const good=await get();assert.equal(good.statusCode,200);assert.equal(good.headers['x-frame-options'],'DENY');assert.match(good.headers['content-security-policy'],/frame-ancestors 'none'/);assert.equal(good.headers['x-content-type-options'],'nosniff');
  assert.equal((await get({host:'attacker.example'})).statusCode,403);assert.equal((await get({origin:'https://attacker.example'})).statusCode,403);
  assert.equal((await get({},'POST')).statusCode,405);assert.equal((await get({},'GET','/../package.json')).statusCode,404);
 }finally{await new Promise(r=>server.close(r));}
});

test('device error messages omit arbitrary event payloads',async()=>{
 const px=new PixCut({write:async()=>{},read:async()=>new TextEncoder().encode(JSON.stringify({method:'event.rpt_err',params:{'error-code':5306,privateDetail:'do-not-display'}}))});
 await assert.rejects(px.request('get-prop',[]),e=>e.message.includes('5306')&&!e.message.includes('do-not-display'));
});
