// Sheet raster -> PLT cut file. Pure (no DOM), so it runs in the browser and under node tests.
import { generateCutPath } from '../vendor/pixcut-trace/generate.ts';
import { encodePlt, pltStats, parsePlt } from '../vendor/pixcut-trace/plt.ts';
import { pathToPixels } from '../vendor/pixcut-trace/transform.ts';
import { SHEET } from './protocol.js';

export const CUT_DEFAULTS = {
  marginMm: 1.5, // white border grown around each sticker's opaque pixels
  // Knife pressure, 1..100. The official app sends 42 for Liene sticker media (per popcornhax);
  // verified on our printer 2026-10-08: KP1 never lowers the blade.
  knifePressure: 42,
  cutHoles: false, // also cut along transparent holes inside a sticker
  alphaThreshold: 128,
};

export function validateCutSettings(o) {
  if (!Number.isInteger(o.knifePressure) || o.knifePressure < 1 || o.knifePressure > 100) throw new Error('Knife pressure must be an integer from 1 to 100.');
  if (!Number.isFinite(o.marginMm) || o.marginMm < 0 || o.marginMm > 10) throw new Error('White border must be between 0 and 10 mm.');
  if (typeof o.cutHoles !== 'boolean') throw new Error('Cut inner holes must be on or off.');
  if (!Number.isInteger(o.alphaThreshold) || o.alphaThreshold < 1 || o.alphaThreshold > 255) throw new Error('Invalid transparency threshold.');
}

/**
 * Trace the composited sheet (1200x2100 RGBA, transparent where nothing is placed) into a cut.
 * Returns { plt, contours (sheet-pixel space, after margin), paths, stats }.
 */
export function traceSheet(raster, opts = {}) {
  const o = { ...CUT_DEFAULTS, ...opts };
  validateCutSettings(o);
  if (raster.width !== SHEET.w || raster.height !== SHEET.h) {
    throw new Error(`sheet raster must be ${SHEET.w}x${SHEET.h}, got ${raster.width}x${raster.height}`);
  }
  let any = false;
  for (let i = 3; i < raster.data.length; i += 4) if (raster.data[i] >= o.alphaThreshold) { any = true; break; }
  if (!any) return { plt: '', contours: [], paths: [], stats: null };

  const r = generateCutPath(raster, {
    binarize: { mode: 'alpha', alphaThreshold: o.alphaThreshold },
    dilation: Math.max(0, o.marginMm),
    knifePressure: Math.round(o.knifePressure),
    includeHoles: o.cutHoles,
    fillMethod: 'fit',
    scaleRatio: 1, // The JPEG uses this exact sheet raster; stock overscan would shift cuts away from its centre.
    ...(o.overrides ?? {}),
  });
  return { plt: r.plt, contours: r.contours, paths: r.document.paths, stats: r.stats };
}

/** Pad a 1200x2100 RGB(A) sheet to the printer's 1216x2128 raster on white. Returns RGBA bytes. */
export function padToRaster(raster) {
  const { w, h, padX, padY, rasterW, rasterH } = SHEET;
  const out = new Uint8ClampedArray(rasterW * rasterH * 4).fill(255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = ((y + padY) * rasterW + x + padX) * 4;
      const a = raster.data[s + 3] / 255; // composite onto white paper
      out[d] = 255 + (raster.data[s] - 255) * a;
      out[d + 1] = 255 + (raster.data[s + 1] - 255) * a;
      out[d + 2] = 255 + (raster.data[s + 2] - 255) * a;
    }
  }
  return { width: rasterW, height: rasterH, data: out };
}

/** Combine already-positioned per-image paths into one printer job. */
export function combineCuts(cuts, knifePressure) {
  validateCutSettings({...CUT_DEFAULTS, knifePressure});
  const paths = cuts.flatMap(c => c.paths);
  const contours = cuts.flatMap(c => c.contours);
  if (!paths.length) return { plt: '', paths, contours, stats: null };
  const document = { knifePressure, paths };
  return { plt: encodePlt(document), paths, contours, stats: pltStats(document) };
}

/** Import only the PixCut dialect, preserving coordinates and pressure exactly. */
export function importCut(text) {
  if (text.length > 1024 * 1024) throw new Error('Cut file must be under 1 MiB.');
  if (!/^IN\s+VER0\.1\.0\s+KP\d+(?:\s+[UD]-?\d+,-?\d+)+\s+@\s*$/.test(text.trim())) {
    throw new Error('Choose a PixCut .plt file (IN VER0.1.0 KP…). Other HPGL formats are not supported.');
  }
  const document = parsePlt(text);
  if (document.knifePressure < 1 || document.knifePressure > 100) throw new Error('Cut file knife pressure must be 1–100.');
  if (!document.paths.length || document.paths.some(path => path.length < 2)) throw new Error('Cut file has no usable paths.');
  const points = [...document.paths.flat(), ...(document.park ? [document.park] : [])];
  if (points.some(p => p.x < 0 || p.x > 4064 || p.y < 0 || p.y > 7112)) {
    throw new Error('Cut file coordinates extend outside the 4 × 7 in sheet.');
  }
  return { plt: text, paths: document.paths, stats: pltStats(document), knifePressure: document.knifePressure,
    contours: document.paths.map(path => ({ outer: pathToPixels(path, SHEET.w, SHEET.h, { scaleRatio: 1 }), inners: [], open: true })) };
}

/** Capture both printer documents before any asynchronous encoding or UI edits. */
export function snapshotPrint(raster, cut) {
  if (!cut?.plt) throw new Error('No valid cut path.');
  importCut(cut.plt);
  if (raster.width !== SHEET.w || raster.height !== SHEET.h || raster.data.length !== SHEET.w*SHEET.h*4) throw new Error('Invalid print raster.');
  return {raster:padToRaster(raster), plt:new TextEncoder().encode(cut.plt)};
}
