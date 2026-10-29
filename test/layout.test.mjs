import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bbox, outerBounds, hitSticker, packStickers, alphaRuns } from '../src/layout.js';
const options = { width: 1200, height: 2100, edge: 36, border: 24, gap: 18, minSize: 36 };
const sticker = (id, sw, sh, rot = 0) => ({ id, sw, sh, rot, s: 1, x: 100, y: 150 });
function verify(items, result, o = options) {
  assert.ok(result, 'all images fit');
  assert.equal(result.placements.length, items.length);
  const rects = result.placements.map(p => {
    const original = items.find(k => k.id === p.id);
    assert.ok(p.s <= original.s + 1e-8, 'never upscale');
    assert.ok(Math.abs(p.s / original.s - result.scale) < 1e-8, 'common proportional scale');
    const r = outerBounds({ ...original, ...p }, o.border);
    assert.ok(r.x >= o.edge - 1e-5 && r.y >= o.edge - 1e-5);
    assert.ok(r.x + r.w <= o.width - o.edge + 1e-5 && r.y + r.h <= o.height - o.edge + 1e-5, 'border inside sheet');
    return r;
  });
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    assert.ok(a.x + a.w + o.gap <= b.x + 1e-5 || b.x + b.w + o.gap <= a.x + 1e-5 || a.y + a.h + o.gap <= b.y + 1e-5 || b.y + b.h + o.gap <= a.y + 1e-5, 'white borders remain separated');
  }
}
test('rotation bounds support arbitrary and negative angles', () => {
  const k = sticker(1, 200, 100, 45), b = bbox(k);
  assert.ok(Math.abs(b.w - 300 / Math.sqrt(2)) < 1e-8);
  assert.ok(Math.abs(b.w - b.h) < 1e-8);
  assert.ok(Math.abs(bbox({ ...k, rot: -45 }).w - b.w) < 1e-8);
  assert.ok(Math.abs(bbox({ ...k, rot: 90 }).w - 100) < 1e-8);
});
test('drag hit area includes border at any angle, but excludes outside it', () => {
  for (const rot of [0, 37.5, 90, 181, 359.5]) {
    const k = sticker(1, 200, 100, rot), b = bbox(k), a = rot * Math.PI / 180;
    const point = radius => ({ x: k.x + b.w / 2 + radius * Math.cos(a), y: k.y + b.h / 2 + radius * Math.sin(a) });
    assert.equal(hitSticker(k, point(110), 20), true);
    assert.equal(hitSticker(k, point(125), 20), false);
  }
});
test('arrange preserves sizes where possible and includes full-sheet imports', () => {
  const items = [sticker(1, 200, 300), sticker(2, 450, 250, 23)];
  const result = packStickers(items, options); verify(items, result); assert.equal(result.scale, 1);
  const sheets = [{ ...sticker(1, 1200, 2100), sheet: true }, { ...sticker(2, 1200, 2100), sheet: true }];
  const packed = packStickers(sheets, options); verify(sheets, packed); assert.ok(packed.scale < 1);
});
test('arrange tries quarter-turn orientation to fit without shrinking', () => {
  const o = { width: 400, height: 700, edge: 0, border: 0, gap: 0, minSize: 3 };
  const items = [sticker(1, 650, 350)];
  const result = packStickers(items, o); verify(items, result, o); assert.equal(result.scale, 1); assert.equal(result.placements[0].rot, 90);
});
test('mixed crowded layouts fit without overlapping, for several border widths', () => {
  for (const border of [0, 18, 60, 119]) {
    const items = Array.from({ length: border > 100 ? 8 : 18 }, (_, i) => sticker(i, 160 + (i * 137) % 680, 100 + (i * 79) % 580, i * 19.3));
    const snapshot = structuredClone(items), o = { ...options, border };
    verify(items, packStickers(items, o), o);
    assert.deepEqual(items, snapshot, 'packing is transactional');
  }
});
test('impossible or invalid layout is reported without mutating images', () => {
  const items = Array.from({ length: 80 }, (_, i) => sticker(i, 100, 100));
  assert.equal(packStickers(items, { ...options, border: 200 }), null);
  assert.equal(packStickers([sticker(1, NaN, 100)], options), null);
  assert.deepEqual(packStickers([], options), { scale: 1, placements: [] });
});

function circleShape(size) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (Math.hypot(x + .5 - size / 2, y + .5 - size / 2) <= size / 2) data[(y * size + x) * 4 + 3] = 255;
  return alphaRuns({ width: size, height: size, data });
}
test('rotated transparent corners do not enlarge visible bounds or force shrinkage', () => {
  const k = { ...sticker(1, 100, 100, 45), shape: circleShape(100) };
  assert.ok(bbox(k).w > 141);
  const b = outerBounds(k);
  assert.ok(b.w >= 99 && b.w < 103, `visible circle width ${b.w}`);
  const o = { width: 120, height: 120, edge: 2, border: 5, gap: 2, minSize: 3 };
  const result = packStickers([k], o); verify([k], result, o);
  assert.equal(result.scale, 1, 'transparent corners can cross the paper margin');
});
test('transparent holes/corners do not intercept another artwork, white border does', () => {
  const k = { ...sticker(1, 100, 100), shape: circleShape(100) };
  assert.equal(hitSticker(k, {x:101,y:151}, 4), false, 'empty corner is click-through');
  assert.equal(hitSticker(k, {x:150,y:148}, 4), true, 'border remains grabbable');
  const under = { ...sticker(2, 20, 20), x:90, y:140 };
  assert.equal([under,k].reverse().find(item=>hitSticker(item,{x:101,y:151},4)).id,2);
  const ring = { ...sticker(3, 10, 3), shape: [[0,0,10],[1,0,1,9,10],[2,0,10]], s:10 };
  assert.equal(hitSticker(ring, {x:150,y:165}, 0), false, 'transparent gap is not filled by row bounds');
});

test('nonuniform sizing preserves geometry, hit tests and per-image packing margins', () => {
  const k = { ...sticker(1, 100, 100), stretchX: 2, stretchY: .5, border: 10, shape: circleShape(100) };
  const b = outerBounds(k); assert.equal(b.w, 200); assert.equal(b.h, 50);
  assert.equal(hitSticker(k, {x:200,y:147}, 5), true);
  assert.equal(hitSticker(k, {x:200,y:140}, 5), false);
  const items = [k, { ...sticker(2, 180, 200, 30), border: 90 }];
  const result = packStickers(items, options); assert.ok(result);
  const rects = result.placements.map(p => {const original=items.find(k=>k.id===p.id);return outerBounds({...original,...p},original.border);});
  for(const r of rects) assert.ok(r.x>=options.edge-1e-6&&r.y>=options.edge-1e-6&&r.x+r.w<=options.width-options.edge+1e-6&&r.y+r.h<=options.height-options.edge+1e-6);
  const [a,c]=rects; assert.ok(a.x+a.w+options.gap<=c.x+1e-6||c.x+c.w+options.gap<=a.x+1e-6||a.y+a.h+options.gap<=c.y+1e-6||c.y+c.h+options.gap<=a.y+1e-6);
});
