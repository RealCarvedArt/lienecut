import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeBackground } from '../src/background.js';
function raster(w=7,h=7) {
  const data=new Uint8ClampedArray(w*h*4).fill(255);
  return {width:w,height:h,data};
}
function pixel(r,x,y,color) {r.data.set(color,(y*r.width+x)*4);}
test('removes edge background, preserves subject and enclosed matching details',()=>{
  const r=raster();
  for(let y=2;y<5;y++)for(let x=2;x<5;x++)pixel(r,x,y,[200,20,20,255]);
  pixel(r,3,3,[255,255,255,255]);
  const before=r.data.slice(),out=removeBackground(r);
  assert.equal(out.data[3],0);assert.equal(out.data[(3*7+3)*4+3],255);
  assert.equal(out.data[(2*7+2)*4+3],255);assert.equal(out.removed,40);
  assert.deepEqual(r.data,before,'original is unchanged for restore');
});
test('tolerance removes near-color fringe only when requested',()=>{
  const r=raster();pixel(r,1,1,[235,235,235,255]);pixel(r,3,3,[0,0,0,255]);
  assert.equal(removeBackground(r,5).data[(1*7+1)*4+3],255);
  assert.equal(removeBackground(r,30).data[(1*7+1)*4+3],0);
  assert.equal(removeBackground(r,30).data[(3*7+3)*4+3],255);
});
test('supports colored backgrounds and existing transparency',()=>{
  const r=raster();for(let i=0;i<r.data.length;i+=4)r.data.set([20,180,40,255],i);
  pixel(r,3,3,[240,20,10,255]);pixel(r,0,0,[0,0,0,0]);
  const out=removeBackground(r);assert.equal(out.data[7],0);assert.equal(out.data[(3*7+3)*4+3],255);
  const blank=raster();blank.data.fill(0);assert.equal(removeBackground(blank).removed,0);
});
test('rejects unsafe dimensions and invalid tolerance',()=>{
  assert.throws(()=>removeBackground({width:20000,height:20000,data:[]}),/16 megapixels/);
  assert.throws(()=>removeBackground(raster(),NaN),/tolerance/);
  assert.throws(()=>removeBackground(raster(),101),/tolerance/);
});
