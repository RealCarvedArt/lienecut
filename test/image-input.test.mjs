import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateImageBytes, MAX_IMAGE_BYTES} from '../src/image-input.js';
const png=(w,h)=>{const b=new Uint8Array(33),v=new DataView(b.buffer);v.setUint32(0,0x89504e47);v.setUint32(4,0x0d0a1a0a);v.setUint32(8,13);b.set(Buffer.from('IHDR'),12);v.setUint32(16,w);v.setUint32(20,h);return b;};
const jpeg=(w,h)=>{const b=Uint8Array.from([255,216,255,224,0,4,0,0,255,192,0,11,8,h>>8,h&255,w>>8,w&255,1,1,0x11,0]);return b;};
const gif=(w,h)=>{const b=Uint8Array.from(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'));const v=new DataView(b.buffer);v.setUint16(6,w,true);v.setUint16(8,h,true);return b;};
const webp=(kind,w,h)=>{let data;if(kind==='VP8 ') {data=new Uint8Array(10);data.set([0x9d,1,0x2a],3);new DataView(data.buffer).setUint16(6,w,true);new DataView(data.buffer).setUint16(8,h,true);}else{data=new Uint8Array(6);data[0]=0x2f;new DataView(data.buffer).setUint32(1,(w-1)|((h-1)<<14),true);}const b=new Uint8Array(20+data.length),v=new DataView(b.buffer);b.set(Buffer.from('RIFF'));v.setUint32(4,b.length-8,true);b.set(Buffer.from('WEBP'+kind),8);v.setUint32(16,data.length,true);b.set(data,20);return b;};
test('image import reads dimensions from supported headers and real PNG fixtures',()=>{
 for(const b of [png(200,100),jpeg(200,100),webp('VP8 ',200,100),webp('VP8L',200,100)])assert.deepEqual(validateImageBytes(b),{width:200,height:100});
 assert.deepEqual(validateImageBytes(gif(1,1)),{width:1,height:1});
 assert.deepEqual(validateImageBytes(readFileSync(new URL('fixtures/ring-4x7.png',import.meta.url))),{width:1200,height:2100});
});
test('image import rejects excessive dimensions before decoding in every format',()=>{
 for(const b of [png(5000,5000),jpeg(5000,5000),gif(5000,5000),webp('VP8 ',5000,5000),webp('VP8L',5000,5000),png(16001,1),png(0,1)])assert.throws(()=>validateImageBytes(b),/16 megapixels/);
 assert.throws(()=>validateImageBytes(new Uint8Array(MAX_IMAGE_BYTES+1)),/20 MiB/);
});
test('image import rejects truncated headers, invalid segment lengths and unsupported files',()=>{
 for(const b of [new Uint8Array(),png(1,1).subarray(0,24),jpeg(1,1).subarray(0,18),gif(1,1).subarray(0,32),webp('VP8 ',1,1).subarray(0,24),Uint8Array.from([255,216,255,224,0,1]),new TextEncoder().encode('<svg/>')])assert.throws(()=>validateImageBytes(b));
 const frame=gif(1,1);const descriptor=frame.indexOf(0x2c);new DataView(frame.buffer).setUint16(descriptor+5,5000,true);new DataView(frame.buffer).setUint16(descriptor+7,5000,true);assert.throws(()=>validateImageBytes(frame),/16 megapixels/);
});
test('image input respects Uint8Array offsets',()=>{const b=png(30,40),buffer=new Uint8Array(b.length+10);buffer.set(b,5);assert.deepEqual(validateImageBytes(buffer.subarray(5,5+b.length)),{width:30,height:40});});
