import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePng } from '../vendor/pixcut-trace/png.ts';
import { generateCutPath } from '../vendor/pixcut-trace/generate.ts';
import { fromStockConfig } from '../vendor/pixcut-trace/config.ts';
import { parsePlt } from '../vendor/pixcut-trace/plt.ts';
import { frameJson, frameData, takeJson, alertCodes, describeAlerts, SHEET, PixCut } from '../src/protocol.js';
import { traceSheet, combineCuts, padToRaster, importCut } from '../src/cut.js';

const fx = (f) => new URL(`./fixtures/${f}`, import.meta.url);
const png = (f) => decodePng(readFileSync(fx(f)));
const manifest = JSON.parse(readFileSync(fx('manifest.json'), 'utf8'));

test('JSON commands are framed as captured: cmd json line, compact JSON, no trailing newline', () => {
  const s = new TextDecoder().decode(frameJson({ id: 7, method: 'get-prop', params: ['model'] }));
  assert.equal(s, 'cmd json\n{"id":7,"method":"get-prop","params":["model"]}');
});

test('data chunks carry EXTLEN, little-endian job id, and split at 4071 payload bytes', () => {
  const payload = new Uint8Array(5000).map((_, i) => i & 0xff);
  const chunks = [...frameData(payload, 0x01020304)];
  assert.equal(chunks.length, 2);
  const head = 'cmd data EXTLEN=4075\n';
  assert.equal(new TextDecoder().decode(chunks[0].subarray(0, head.length)), head);
  assert.deepEqual([...chunks[0].subarray(head.length, head.length + 4)], [4, 3, 2, 1]);
  assert.equal(chunks[0].length, head.length + 4075);
  const tail = `cmd data EXTLEN=${5000 - 4071 + 4}\n`;
  assert.equal(new TextDecoder().decode(chunks[1].subarray(0, tail.length)), tail);
  const body = new Uint8Array([...chunks[0].subarray(head.length + 4), ...chunks[1].subarray(tail.length + 4)]);
  assert.deepEqual(body, payload);
});

test('reply parser handles split transfers, NULs, and braces inside strings', () => {
  const [a, rest] = takeJson('{"id":1,"result":["{x}"]}\0{"id":2,"res');
  assert.deepEqual(a, [{ id: 1, result: ['{x}'] }]);
  const [b, rest2] = takeJson(rest + 'ult":[1]}');
  assert.deepEqual(b, [{ id: 2, result: [1] }]);
  assert.equal(rest2, '');
});

test('alert codes parse and ::0 means none', () => {
  assert.deepEqual(alertCodes('::0'), []);
  assert.deepEqual(alertCodes(['::8102']), [8102]);
});

// The vendored tracer against the vendor generator's own output (exact cases only).
for (const c of manifest.cases.filter((c) => c.expectation === 'exact' && ['square-exact', 'fullbleed-4x7-exact'].includes(c.name))) {
  test(`vendored tracer reproduces stock ${c.name}`, () => {
    const opts = { ...fromStockConfig(c.config), knifePressure: c.kp ?? 1 };
    if (c.dilation) opts.dilation = c.dilation;
    const want = readFileSync(fx(c.plt), 'latin1');
    assert.equal(generateCutPath(png(c.image), opts).plt, want);
  });
}

test('traceSheet: square sticker gives one closed path inside the 4x7 canvas, with margin', () => {
  const img = png('square-4x7.png'); // opaque square on transparent 1200x2100
  assert.equal(img.width, SHEET.w);
  const tight = traceSheet(img, { marginMm: 0 });
  const wide = traceSheet(img, { marginMm: 2 });
  for (const r of [tight, wide]) {
    assert.match(r.plt, /^IN VER0\.1\.0 KP42 U/);
    assert.match(r.plt, / U6476,0 {2}@ $/);
    const doc = parsePlt(r.plt);
    assert.equal(doc.paths.length, 1);
    for (const p of doc.paths[0]) {
      assert.ok(p.x >= 0 && p.x <= 4064 && p.y >= 0 && p.y <= 7112, `point ${p.x},${p.y} off canvas`);
    }
  }
  const span = (r) => {
    const xs = parsePlt(r.plt).paths[0].map((p) => p.x);
    return Math.max(...xs) - Math.min(...xs);
  };
  // 2 mm margin on each side = 160 units wider (40 units/mm), within a few units of ramps/rounding.
  assert.ok(Math.abs(span(wide) - span(tight) - 160) < 30, `margin grew span by ${span(wide) - span(tight)}`);
});

test('traceSheet: empty sheet gives no cut', () => {
  const blank = { width: SHEET.w, height: SHEET.h, data: new Uint8Array(SHEET.w * SHEET.h * 4) };
  assert.equal(traceSheet(blank).plt, '');
});

test('traceSheet: knife pressure reaches the header', () => {
  assert.match(traceSheet(png('square-4x7.png'), { knifePressure: 55 }).plt, /^IN VER0\.1\.0 KP55 /);
});

test('padToRaster centres the sheet on white at 8,14', () => {
  const r = { width: SHEET.w, height: SHEET.h, data: new Uint8Array(SHEET.w * SHEET.h * 4) };
  r.data.set([10, 20, 30, 255], 0);
  const out = padToRaster(r);
  assert.equal(out.width, 1216);
  assert.equal(out.height, 2128);
  assert.deepEqual([...out.data.subarray(0, 4)], [255, 255, 255, 255]);
  const d = (14 * 1216 + 8) * 4;
  assert.deepEqual([...out.data.subarray(d, d + 3)], [10, 20, 30]);
});

test('per-image hole and border paths combine into one valid cut file', () => {
  const image=png('ring-4x7.png');
  const outside=traceSheet(image,{marginMm:0,cutHoles:false});
  const holes=traceSheet(image,{marginMm:2,cutHoles:true});
  assert.equal(outside.paths.length,1);assert.equal(holes.paths.length,2);
  const result=combineCuts([outside,holes],42), parsed=parsePlt(result.plt);
  assert.equal(parsed.paths.length,3);assert.equal(parsed.knifePressure,42);
  assert.deepEqual(parsed.paths[0],outside.paths[0]);
  assert.deepEqual(parsed.paths.slice(1),holes.paths);
  assert.equal(result.stats.pathCount,3);
  assert.equal((result.plt.match(/IN VER/g)||[]).length,1);
  assert.equal(combineCuts([],42).plt,'');
});


test('numeric printer alerts are retained by preflight', async () => {
  assert.deepEqual(alertCodes([0, 8011, '::8102', '8011']), [8011, 8102]);
  const px = new PixCut({});
  px.getProps = async () => ({'printer-state': 20, 'printer-sub-state': 2000, 'printer-state-alerts': 8011});
  px.createComboJob = () => assert.fail('must not submit while an alert is active');
  await assert.rejects(px.printAndCut(new Uint8Array(1), new Uint8Array(1)), /8011.*Turn it off and back on/);
});

test('8011 rejection gives recovery guidance and never uploads or retries', async () => {
  for (const code of [8011, '8011']) {
    const px = new PixCut({});
    let declarations = 0;
    px.status = async () => ({state: 20, alerts: []});
    px.request = async (method) => {
      assert.equal(method, 'combo-job');
      declarations++;
      return {result: [{'error-code': code}]};
    };
    px.upload = () => assert.fail('rejected job must not upload');
    await assert.rejects(px.printAndCut(new Uint8Array(1), new Uint8Array(1)), /error 8011:.*Turn it off and back on/);
    assert.equal(declarations, 1);
  }
});

test('5306 identifies the missing paper cassette', () => {
  assert.match(describeAlerts([5306]), /5306 paper cassette not detected/);
});


test('cut centres and equal borders match the print raster across the sheet', () => {
  for (const [x, y] of [[100,100], [900,100], [100,1800], [900,1800]]) {
    const data = new Uint8Array(SHEET.w * SHEET.h * 4);
    for (let row=y;row<y+100;row++) for(let col=x;col<x+100;col++) data[(row*SHEET.w+col)*4+3]=255;
    const result = traceSheet({width:SHEET.w,height:SHEET.h,data}, {marginMm:2,overrides:{overcut:false}});
    const preview = importCut(result.plt).contours[0].outer;
    const xs=preview.map(p=>p.x), ys=preview.map(p=>p.y);
    const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    assert.ok(Math.abs((left+right)/2-(x+49.5))<.3, 'horizontal registration');
    assert.ok(Math.abs((top+bottom)/2-(y+49.5))<.3, 'vertical registration');
    assert.ok(Math.abs((x-left)-(right-(x+99)))<.3, 'equal side borders');
    assert.ok(Math.abs((y-top)-(bottom-(y+99)))<.3, 'equal top/bottom borders');
    assert.ok(Math.abs((x-left)*25.4/300-2)<.15, 'border size in mm');
  }
});

test('PLT import preserves exact bytes, pressure, coordinates and feed-axis orientation', () => {
  const text='IN VER0.1.0 KP42 U6000,100 D6000,100 D5900,200 U6476,0  @ ';
  const cut=importCut(text);
  assert.equal(cut.plt,text);assert.equal(cut.knifePressure,42);assert.equal(cut.stats.pathCount,1);
  assert.deepEqual(cut.paths[0],[{x:100,y:6000},{x:200,y:5900}]);
  assert.ok(cut.contours[0].outer[0].y < cut.contours[0].outer[1].y);
  assert.equal(cut.contours[0].open,true);
});

test('PLT import rejects unsupported, unsafe, truncated and empty cut files', () => {
  for(const text of ['IN;PU0,0;PD1,1;', 'IN VER0.1.0 KP42 U6476,0 @',
    'IN VER0.1.0 KP42 U0,0 D0,5000 @', 'IN VER0.1.0 KP42 U0,0 D-1,20 @',
    'IN VER0.1.0 KP101 U0,0 D10,10 @','IN VER0.1.0 KP42 U0,0 D10,10',
    'IN VER0.1.0 KP42 U0,0 D10,10 @ trailing', 'x'.repeat(1024*1024+1)]) {
    assert.throws(()=>importCut(text));
  }
});
