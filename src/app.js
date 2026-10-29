import { validateImageBytes, MAX_IMAGE_BYTES } from './image-input.js';
import { saveProject, openProject } from './project.js';
import { PixCut, SHEET, MAX_JPEG_BYTES, describeAlerts } from './protocol.js';
import { traceSheet, combineCuts, snapshotPrint, CUT_DEFAULTS } from './cut.js';
import * as usb from './webusb.js';
import { removeBackground } from './background.js';
import { bbox, outerBounds, hitSticker, packStickers, alphaRuns } from './layout.js';

const $ = (id) => document.getElementById(id);
const PX_PER_MM = 300 / 25.4;
const EDGE = Math.round(3 * PX_PER_MM); // keep art this far from the sheet edge
const HANDLE = 44; // resize handle size, sheet px

const A = '#236348', D = '#202c29';

/* ═══ settings ═══ */
const store = {
  get(k, d) { try { const v = localStorage.getItem('brencut.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('brencut.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const settings = {
  marginMm: store.get('marginMm', CUT_DEFAULTS.marginMm),
  knifePressure: store.get('kp', CUT_DEFAULTS.knifePressure), // key renamed when the default moved 1 -> 42
  cutHoles: store.get('cutHoles', CUT_DEFAULTS.cutHoles),
  showCut: store.get('showCut', true),
};

if (!Number.isFinite(settings.marginMm) || settings.marginMm < 0 || settings.marginMm > 10) settings.marginMm = CUT_DEFAULTS.marginMm;
if (!Number.isInteger(settings.knifePressure) || settings.knifePressure < 1 || settings.knifePressure > 100) settings.knifePressure = CUT_DEFAULTS.knifePressure;
if (typeof settings.cutHoles !== 'boolean') settings.cutHoles = CUT_DEFAULTS.cutHoles;
if (typeof settings.showCut !== 'boolean') settings.showCut = true;

/* ═══ stickers ═══ */
let stickers = []; // {id, name, bmp, sw, sh, s (sheet px per source px), rot (degrees), x, y}
let selected = null;
let nextId = 1;
let importing = 0;
let compactArtwork = true;
let backgroundBusy = false;
let projectBusy = false;
const borderPx = k => Math.ceil(k.marginMm * PX_PER_MM);
const insetPx = k => EDGE + borderPx(k);

function overlaps(x, y, w, h, others, k) {
  return others.some((o) => {
    const b = outerBounds(o);
    const gap = borderPx(k) + borderPx(o) + Math.ceil(1.5 * PX_PER_MM);
    return x < b.x + b.w + gap && b.x < x + w + gap && y < b.y + b.h + gap && b.y < y + h + gap;
  });
}
function findSpot(w, h, others, k) {
  for (let y = insetPx(k); y + h <= SHEET.h - insetPx(k); y += 8) {
    for (let x = insetPx(k); x + w <= SHEET.w - insetPx(k); x += 8) {
      if (!overlaps(x, y, w, h, others, k)) return { x, y };
    }
  }
  return null;
}
function clampInto(k) {
  const b = outerBounds(k);
  k.x += Math.min(Math.max(b.x, insetPx(k)), SHEET.w - insetPx(k) - b.w) - b.x;
  k.y += Math.min(Math.max(b.y, insetPx(k)), SHEET.h - insetPx(k) - b.h) - b.y;
}
function fitScale(k) {
  // Fit visible art, not transparent rotated corners.
  const b = outerBounds(k);
  const f = Math.min(1, (SHEET.w - 2 * insetPx(k)) / b.w, (SHEET.h - 2 * insetPx(k)) / b.h);
  k.s *= f;
}

function arrange() {
  $('notice').textContent = '';
  const result = packStickers(stickers.map(k => ({ ...k, border: borderPx(k) })), { width: SHEET.w, height: SHEET.h, edge: EDGE,
    border: 0, gap: Math.ceil(1.5 * PX_PER_MM), minSize: 3 * PX_PER_MM });
  if (!result) { showError('These images cannot fit with this border at a usable size. Reduce the border or remove an image; your layout is unchanged.'); return; }
  const placements = new Map(result.placements.map(p => [p.id, p]));
  for (const k of stickers) Object.assign(k, placements.get(k.id), { sheet: false });
  changed();
  $('importStatus').textContent = `Arranged ${stickers.length} images.${result.scale < .999 ? ` Scaled to ${(result.scale * 100).toFixed(1)}% to fit.` : ''}`;
}

/** PNG pHYs chunk -> dots per inch, or null. */
function pngDpi(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 16 || v.getUint32(0) !== 0x89504e47) return null;
  for (let p = 8; p + 12 <= v.byteLength;) {
    const len = v.getUint32(p), type = v.getUint32(p + 4);
    if (type === 0x70485973 /* pHYs */ && len >= 9 && v.getUint8(p + 16) === 1) {
      const dpi = v.getUint32(p + 8) * 0.0254;
      return dpi >= 30 && dpi <= 2400 ? dpi : null;
    }
    if (type === 0x49444154 /* IDAT */) return null;
    p += 12 + len;
  }
  return null;
}

/** Crop to the opaque pixels so stickers pack tightly. Returns {bmp, w, h, opaque}. */
async function trimmed(bmp) {
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const { data } = g.getImageData(0, 0, bmp.width, bmp.height);
  let x0 = bmp.width, y0 = bmp.height, x1 = -1, y1 = -1, opaque = true;
  for (let y = 0; y < bmp.height; y++) {
    for (let x = 0; x < bmp.width; x++) {
      const a = data[(y * bmp.width + x) * 4 + 3];
      if (a < 255) opaque = false;
      if (a >= CUT_DEFAULTS.alphaThreshold) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const sourceShape = alphaRuns({ width: bmp.width, height: bmp.height, data }, CUT_DEFAULTS.alphaThreshold);
  if (x0 === 0 && y0 === 0 && x1 === bmp.width - 1 && y1 === bmp.height - 1) return { bmp, w: bmp.width, h: bmp.height, opaque, shape: sourceShape, sourceShape };
  const cropped = await createImageBitmap(bmp, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  return { bmp: cropped, w: cropped.width, h: cropped.height, opaque, sourceShape,
    shape: sourceShape.map(row => row.map((v, i) => v - (i === 0 ? y0 : x0))) };
}

async function addFiles(files) {
  if (printing || projectBusy || importing) return;
  if (files.length > 100 || files.reduce((n,f)=>n+f.size,0) > 100*1024*1024) { showError('Import at most 100 images / 100 MB at once.'); return; }
  const project = files.find(f => /\.lienecut$/i.test(f.name));
  if (project) { await loadProject(project); return; }
  $('notice').textContent = '';
  importing++;
  $('importStatus').textContent = 'Opening artwork…';
  $('list').setAttribute('aria-busy', 'true');
  updateButtons();
  await new Promise((resolve) => setTimeout(resolve, 30));
  for (const f of files) {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(f.type) && !(f.type === '' && /\.(png|jpe?g|webp|gif)$/i.test(f.name))) { showError('Choose a JPEG, PNG, WebP, or GIF image.'); continue; }
    try {
      if (f.size > MAX_IMAGE_BYTES) throw new Error('Images must be at most 20 MiB.');
      const buf = await f.arrayBuffer();
      const dimensions = validateImageBytes(new Uint8Array(buf));
      const pixels = stickers.reduce((n,k)=>n+k.sw*k.sh*(k.originalBackground ? 2 : 1),0);
      if (stickers.length >= 500 || pixels + dimensions.width*dimensions.height > 64000000) throw new Error('This sheet exceeds 500 images or 64 megapixels.');
      let src = await createImageBitmap(new Blob([buf], { type: f.type }));
      if (!((src.width === dimensions.width && src.height === dimensions.height) || (src.width === dimensions.height && src.height === dimensions.width))) { src.close(); throw new Error('Decoded image dimensions differ from its header.'); }
      const name = f.name.replace(/\.[^.]+$/, '') || 'pasted';
      // A whole 4x7 sheet (either orientation) is placed exactly as drawn: no trim, no repacking.
      if (src.width === SHEET.rasterW && src.height === SHEET.rasterH) {
        src = await createImageBitmap(src, SHEET.padX, SHEET.padY, SHEET.w, SHEET.h); // already padded: drop it
      }
      const aspect = src.width / src.height;
      const land = Math.abs(aspect - 7 / 4) < 0.01;
      if ((land || Math.abs(aspect - 4 / 7) < 0.01) && Math.max(src.width, src.height) >= 700) {
        const k = { id: nextId++, name, marginMm: settings.marginMm, cutHoles: settings.cutHoles, linked: true, stretchX: 1, stretchY: 1, bmp: src, sw: src.width, sh: src.height, s: SHEET.h / Math.max(src.width, src.height), rot: land ? 90 : 0, x: 0, y: 0, sheet: true };
        const t = await trimmed(src);
        if (!t) { showError(`${f.name}: fully transparent, skipped`); continue; }
        k.shape = t.sourceShape;
        stickers.push(k);
        selected = k;
        continue;
      }
      const t = await trimmed(src);
      if (!t) { showError(`${f.name}: fully transparent, skipped`); continue; }
      const dpi = pngDpi(buf) ?? 300;
      const k = { id: nextId++, name, marginMm: settings.marginMm, cutHoles: settings.cutHoles, linked: true, stretchX: 1, stretchY: 1, bmp: t.bmp, shape: t.shape, sw: t.w, sh: t.h, s: 300 / dpi, rot: 0, x: 0, y: 0 };
      fitScale(k);
      const b = outerBounds(k);
      const spot = findSpot(b.w, b.h, stickers, k);
      if (spot) { k.x += spot.x - b.x; k.y += spot.y - b.y; }
      else { k.x = insetPx(k); k.y = insetPx(k); showError(`${f.name}: no free space left, placed on top; try arrange or resize`); }
      stickers.push(k);
      selected = k;
    } catch (e) {
      showError(`${f.name}: ${e.message}`);
    }
  }
  importing--;
  $('list').setAttribute('aria-busy', String(importing > 0));
  $('importStatus').textContent = importing ? 'Opening artwork…' : `${stickers.length} artwork item${stickers.length === 1 ? '' : 's'} on your sheet.`;
  changed();
}

/* ═══ drawing ═══ */
const view = $('sheet');
const vg = view.getContext('2d');
const comp = new OffscreenCanvas(SHEET.w, SHEET.h);
const cg = comp.getContext('2d', { willReadFrequently: true });

function drawStickers(g, items = stickers) {
  for (const k of items) {
    const b = bbox(k);
    g.save();
    g.translate(k.x + b.w / 2, k.y + b.h / 2);
    g.rotate((k.rot * Math.PI) / 180);
    g.imageSmoothingQuality = 'high';
    g.drawImage(k.bmp, (-k.sw * k.s * (k.stretchX ?? 1)) / 2, (-k.sh * k.s * (k.stretchY ?? 1)) / 2, k.sw * k.s * (k.stretchX ?? 1), k.sh * k.s * (k.stretchY ?? 1));
    g.restore();
  }
}

let importedCut = null;
let cut = null; // last trace result
let cutStale = true;
let dragPreview = null;

function outlinePath(contours) {
  const path = new Path2D();
  for (const c of contours) for (const poly of [c.outer, ...c.inners]) {
    poly.forEach((p, i) => i ? path.lineTo(p.x + .5, p.y + .5) : path.moveTo(p.x + .5, p.y + .5));
    if (!c.open) path.closePath();
  }
  return path;
}
function strokeOutline(path, dx = 0, dy = 0, angle = 0, cx = 0, cy = 0) {
  vg.save(); vg.translate(dx, dy);
  vg.translate(cx, cy); vg.rotate(angle * Math.PI / 180); vg.translate(-cx, -cy); vg.lineJoin = 'round';
  vg.strokeStyle = D; vg.lineWidth = 5; vg.stroke(path);
  vg.strokeStyle = A; vg.lineWidth = 2.5; vg.setLineDash([12, 8]); vg.stroke(path);
  vg.restore();
}

function render() {
  vg.fillStyle = '#fff';
  vg.fillRect(0, 0, SHEET.w, SHEET.h);
  drawStickers(vg);

  // printable-area guide
  vg.save();
  vg.setLineDash([10, 10]);
  vg.strokeStyle = 'rgba(0,0,0,.15)';
  vg.lineWidth = 2;
  vg.strokeRect(EDGE, EDGE, SHEET.w - 2 * EDGE, SHEET.h - 2 * EDGE);
  vg.restore();

  if (settings.showCut) {
    if (dragPreview) {
      strokeOutline(dragPreview.background);
      const b = bbox(dragPreview.k);
      strokeOutline(dragPreview.foreground, dragPreview.k.x + b.w / 2 - dragPreview.cx, dragPreview.k.y + b.h / 2 - dragPreview.cy, dragPreview.k.rot - dragPreview.rot, dragPreview.cx, dragPreview.cy);
    } else if (!cutStale && cut?.contours.length) strokeOutline(outlinePath(cut.contours));
  }

  if (selected) {
    const b = outerBounds(selected, borderPx(selected));
    vg.save();
    vg.strokeStyle = D; vg.lineWidth = 4; vg.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    vg.strokeStyle = A; vg.lineWidth = 2; vg.setLineDash([8, 6]); vg.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    vg.setLineDash([]);
    vg.fillStyle = A; vg.strokeStyle = D; vg.lineWidth = 3;
    vg.fillRect(b.x + b.w - HANDLE / 2, b.y + b.h - HANDLE / 2, HANDLE, HANDLE);
    vg.strokeRect(b.x + b.w - HANDLE / 2, b.y + b.h - HANDLE / 2, HANDLE, HANDLE);
    const h = rotationHandle(selected);
    vg.lineWidth = 2; vg.strokeStyle = A;
    vg.beginPath(); vg.moveTo(b.x + b.w / 2, b.y); vg.lineTo(h.x, h.y); vg.stroke();
    vg.beginPath(); vg.arc(h.x, h.y, h.r, 0, Math.PI * 2); vg.fillStyle = '#fff'; vg.fill(); vg.stroke();
    vg.fillStyle = A; vg.font = `${h.r * 1.5}px Segoe UI`; vg.textAlign = 'center'; vg.textBaseline = 'middle'; vg.fillText('↻', h.x, h.y);

    vg.restore();
  }
  $('empty').hidden = stickers.length > 0 || !!importedCut;
}

/* ═══ trace (debounced) ═══ */
let traceTimer = 0;
function scheduleTrace(ms = 120) {
  cutStale = true;
  $('cutStats').textContent = stickers.length ? 'Updating cut outline…' : 'Add artwork to preview your cut.';
  updateButtons();
  clearTimeout(traceTimer);
  traceTimer = setTimeout(runTrace, ms);
}
function compositeRaster(items = stickers) {
  cg.clearRect(0, 0, SHEET.w, SHEET.h);
  drawStickers(cg, items);
  const img = cg.getImageData(0, 0, SHEET.w, SHEET.h);
  return { width: img.width, height: img.height, data: img.data };
}
const tracedArtwork = new WeakMap();
function traceArtwork(items = stickers) {
  const results = items.map(k => {
    const key = [k.x, k.y, k.s, k.stretchX, k.stretchY, k.rot, k.marginMm, k.cutHoles, settings.knifePressure].join(',');
    const cached = tracedArtwork.get(k);
    if (cached?.key === key && cached.bmp === k.bmp) return cached.result;
    const result = traceSheet(compositeRaster([k]), { ...settings, marginMm: k.marginMm, cutHoles: k.cutHoles });
    tracedArtwork.set(k, { key, bmp: k.bmp, result });
    return result;
  });
  return combineCuts(results, settings.knifePressure);
}
function runTrace() {
  clearTimeout(traceTimer);
  traceTimer = 0;
  dragPreview = null;
  try {
    cut = importedCut ?? traceArtwork();
    cutStale = false;
    const s = cut.stats;
    $('cutStats').textContent = s
      ? `${s.pathCount} path${s.pathCount === 1 ? '' : 's'} · ${s.pointCount} points · ${(s.cutLengthMm / 10).toFixed(1)} cm of cut`
      : stickers.length ? 'No cut paths. Try an image with visible, non-transparent artwork.' : 'Add artwork to preview your cut.';
  } catch (e) {
    cut = null;
    $('cutStats').textContent = `trace failed: ${e.message}`;
  }
  render();
  updateButtons();
}

function changed() {
  cutStale = true;
  renderList();
  render();
  scheduleTrace();
  updateButtons();
}

/* ═══ list ═══ */
function renderList() {
  const ul = $('list');
  const focusKey = ul.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
  ul.textContent = '';
  $('count').textContent = String(stickers.length);
  $('toggleArtwork').textContent = compactArtwork ? 'Expand list' : 'Compact list';
  $('toggleArtwork').setAttribute('aria-expanded', String(!compactArtwork));
  if (!importing) $('importStatus').textContent = stickers.length ? `${stickers.length} artwork item${stickers.length === 1 ? '' : 's'} on your sheet.` : 'Add individual stickers or a complete sheet.';
  for (const k of stickers) {
    const b = outerBounds({ ...k, rot: 0 });
    const li = document.createElement('li');
    li.className = `${k === selected ? 'sel' : ''} ${compactArtwork ? 'compact' : ''}`;
    const th = document.createElement('canvas');
    th.width = th.height = 68;
    const tg = th.getContext('2d');
    const thumbnailBounds = bbox(k);
    const f = Math.min(68 / thumbnailBounds.w, 68 / thumbnailBounds.h);
    tg.translate(34, 34); tg.rotate((k.rot * Math.PI) / 180);
    tg.drawImage(k.bmp, (-k.sw * k.s * (k.stretchX ?? 1) * f) / 2, (-k.sh * k.s * (k.stretchY ?? 1) * f) / 2, k.sw * k.s * (k.stretchX ?? 1) * f, k.sh * k.s * (k.stretchY ?? 1) * f);
    const mid = document.createElement('div');
    mid.innerHTML = `<button class="name" type="button"></button><div class="dims"><input type="number" step="0.1" min="3" aria-label="width mm"> × <input type="number" step="0.1" min="3" aria-label="height mm"> mm</div>`;
    const selectButton = mid.querySelector('.name');
    selectButton.textContent = k.name;
    selectButton.setAttribute('aria-label', `Select ${k.name}`);
    selectButton.setAttribute('aria-pressed', String(k === selected));
    selectButton.onclick = () => { selected = k; renderList(); render(); view.focus(); };
    const [wIn, hIn] = mid.querySelectorAll('input');
    const angleLabel = document.createElement('label');
    angleLabel.className = 'dims';
    angleLabel.textContent = 'Rotation ';
    const angleIn = document.createElement('input');
    angleIn.type = 'number'; angleIn.step = 'any'; angleIn.value = String(k.rot);
    angleIn.setAttribute('aria-label', `Rotation of ${k.name} in degrees`);
    angleIn.onchange = () => { if (angleIn.value !== '' && Number.isFinite(+angleIn.value)) rotate(k, +angleIn.value); else renderList(); };
    angleLabel.append(angleIn, '°'); mid.append(angleLabel);
    wIn.value = (b.w / PX_PER_MM).toFixed(1);
    hIn.value = (b.h / PX_PER_MM).toFixed(1);
    const resize = (mm, axis) => {
      const cur = outerBounds({ ...k, rot: 0 })[axis];
      if (!Number.isFinite(mm) || mm < 3) { renderList(); return; }
      const ratio = (mm * PX_PER_MM) / cur;
      if (k.linked) k.s *= ratio;
      else if (axis === 'w') k.stretchX *= ratio;
      else k.stretchY *= ratio;
      fitScale(k); clampInto(k); changed();
    };
    wIn.onchange = () => resize(+wIn.value, 'w');
    hIn.onchange = () => resize(+hIn.value, 'h');
    const acts = document.createElement('div');
    acts.className = 'acts';
    acts.innerHTML = `<button class="btn icon" title="rotate (R)">Rotate</button><button class="btn icon" title="duplicate (D)">Duplicate</button><button class="btn icon" title="remove (del)">Remove</button>`;
    const [rotB, dupB, delB] = acts.children;
    [selectButton, wIn, hIn, rotB, dupB, delB, angleIn].forEach((el, i) => { el.dataset.focusKey = `${k.id}-${i}`; });
    [rotB, dupB, delB].forEach((el) => el.setAttribute('aria-label', `${el.textContent} ${k.name}`));
    wIn.setAttribute('aria-label', `Width of ${k.name} in millimeters`);
    hIn.setAttribute('aria-label', `Height of ${k.name} in millimeters`);
    rotB.onclick = (e) => { e.stopPropagation(); rotate(k); };
    dupB.onclick = (e) => { e.stopPropagation(); duplicate(k); };
    delB.onclick = (e) => { e.stopPropagation(); remove(k); };
    const fields = document.createElement('div'); fields.className = 'fields';
    for (const [text, input] of [['Width · mm', wIn], ['Height · mm', hIn], ['Angle · °', angleIn]]) {
      const label = document.createElement('label'); label.textContent = text; label.append(input); fields.append(label);
    }
    const imageOptions = document.createElement('div'); imageOptions.className = 'image-options';
    const link = document.createElement('button'); link.className = 'btn'; link.textContent = k.linked ? 'W / H linked' : 'W / H unlinked';
    link.setAttribute('aria-label', `Link width and height for ${k.name}`); link.setAttribute('aria-pressed', String(k.linked));
    link.dataset.focusKey = `${k.id}-link`; link.onclick = () => { k.linked = !k.linked; renderList(); };
    const borderLabel = document.createElement('label'); borderLabel.textContent = 'White border · mm';
    const border = document.createElement('input'); border.type = 'number'; border.min = 0; border.max = 10; border.step = .5; border.value = k.marginMm;
    border.setAttribute('aria-label', `White border for ${k.name} in millimeters`); border.dataset.focusKey = `${k.id}-border`;
    border.onchange = () => { k.marginMm = Math.max(0, Math.min(10, +border.value || 0)); if (!k.sheet) { fitScale(k); clampInto(k); } changed(); };
    borderLabel.append(border);
    const holeLabel = document.createElement('label'); holeLabel.className = 'hole-option';
    const holes = document.createElement('input'); holes.type = 'checkbox'; holes.checked = k.cutHoles;
    holes.setAttribute('aria-label', `Cut inner holes for ${k.name}`); holes.dataset.focusKey = `${k.id}-holes`;
    holes.onchange = () => { k.cutHoles = holes.checked; changed(); };
    holeLabel.append(holes, 'Cut inner holes'); imageOptions.append(link, borderLabel, holeLabel);
    mid.querySelector('.dims').remove(); angleLabel.remove();
    const meta = document.createElement('span'); meta.className = 'item-meta'; meta.textContent = k === selected ? 'Selected artwork' : 'Select to edit'; mid.append(meta);
    const background = document.createElement('div'); background.className = 'background-tools';
    const removeBg = document.createElement('button'); removeBg.className = 'btn';
    removeBg.textContent = 'Remove background'; removeBg.setAttribute('aria-label', `Remove background from ${k.name}`);
    removeBg.dataset.focusKey = `${k.id}-background`; removeBg.disabled = backgroundBusy || !!printing;
    removeBg.onclick = () => editBackground(k, k.backgroundTolerance ?? 32);
    background.append(removeBg);
    if (k.originalBackground) {
      const restore = document.createElement('button'); restore.className = 'btn'; restore.textContent = 'Restore original';
      restore.disabled = backgroundBusy || !!printing; restore.dataset.focusKey = `${k.id}-restore`;
      restore.onclick = () => { Object.assign(k, k.originalBackground); delete k.originalBackground; delete k.backgroundTolerance; changed(); };
      const label = document.createElement('label'); label.textContent = 'Tolerance';
      const tolerance = document.createElement('input'); tolerance.type = 'range'; tolerance.min = 0; tolerance.max = 100; tolerance.value = k.backgroundTolerance;
      tolerance.setAttribute('aria-label', `Background tolerance for ${k.name}`); tolerance.disabled = backgroundBusy || !!printing;
      tolerance.dataset.focusKey = `${k.id}-tolerance`;
      tolerance.onchange = () => editBackground(k, +tolerance.value);
      label.append(tolerance); background.append(restore, label);
    }
    const help = document.createElement('span'); help.className = 'hint'; help.textContent = 'For solid backgrounds · processed on your device'; background.append(help);
    li.append(th, mid, fields, imageOptions, acts, background);
    ul.append(li);
  }
  if (focusKey) (ul.querySelector(`[data-focus-key="${focusKey}"]`) ?? ul.querySelector('.name') ?? $('addBtn')).focus({ preventScroll: true });
}

async function editBackground(k, tolerance) {
  if (backgroundBusy || printing || projectBusy) return;
  backgroundBusy = true;
  $('notice').textContent = '';
  renderList(); updateButtons();
  $('importStatus').textContent = 'Removing background…';
  await new Promise(resolve => setTimeout(resolve, 30));
  try {
    const original = k.originalBackground ?? { bmp: k.bmp, shape: k.shape };
    if (k.sw * k.sh > 16000000) throw new Error('Resize this image below 16 megapixels before removing its background.');
    const canvas = new OffscreenCanvas(k.sw, k.sh), context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(original.bmp, 0, 0);
    const result = removeBackground(context.getImageData(0, 0, k.sw, k.sh), tolerance);
    if (!result.removed) throw new Error('No edge background found. This image may already be transparent.');
    const shape = alphaRuns({ width: k.sw, height: k.sh, data: result.data }, CUT_DEFAULTS.alphaThreshold);
    if (!shape.length) throw new Error('This would remove the entire image. Try an image with a distinct subject and background.');
    const bitmap = await createImageBitmap(new ImageData(result.data, k.sw, k.sh));
    if (!stickers.includes(k)) { bitmap.close(); return; }
    k.originalBackground = original; k.bmp = bitmap; k.shape = shape; k.backgroundTolerance = tolerance;
  } catch (e) { showError(e.message); }
  finally { backgroundBusy = false; changed(); }
}

function rotate(k, degrees = k.rot + 90) {
  const b0 = bbox(k);
  const cx = k.x + b0.w / 2, cy = k.y + b0.h / 2;
  k.rot = ((degrees % 360) + 360) % 360;
  k.sheet = false;
  fitScale(k);
  const b = bbox(k);
  k.x = cx - b.w / 2; k.y = cy - b.h / 2;
  clampInto(k); changed();
}
function duplicate(k) {
  const c = { ...k, id: nextId++, sheet: false };
  fitScale(c);
  const b = outerBounds(c);
  const spot = findSpot(b.w, b.h, stickers, c);
  if (spot) { c.x += spot.x - b.x; c.y += spot.y - b.y; }
  else { c.x += 40; c.y += 40; clampInto(c); showError('no free space for the copy; placed on top'); }
  stickers.push(c); selected = c; changed();
}
function remove(k) {
  stickers = stickers.filter((o) => o !== k);
  if (selected === k) selected = null;
  changed();
}

/* ═══ pointer ═══ */
const toSheet = (e) => {
  const r = view.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * SHEET.w) / r.width, y: ((e.clientY - r.top) * SHEET.h) / r.height };
};
function rotationHandle(k) {
  const b = outerBounds(k, borderPx(k)), r = 11 * SHEET.w / view.clientWidth;
  return { x: b.x + b.w / 2, y: Math.max(r + 4, b.y - r * 3), r };
}
function onRotationHandle(k, p) {
  const h = rotationHandle(k);
  return Math.hypot(p.x - h.x, p.y - h.y) <= h.r * 1.35;
}
let drag = null;
view.addEventListener('pointerdown', (e) => {
  if (printing) return;
  const p = toSheet(e);
  dragPreview = null;
  view.focus();
  if (selected) {
    const b = bbox(selected);
    if (onRotationHandle(selected, p)) {
      const cx = selected.x + b.w / 2, cy = selected.y + b.h / 2;
      drag = { mode: 'rotate', k: selected, cx, cy, start: Math.atan2(p.y - cy, p.x - cx), rot: selected.rot, s0: selected.s };
      view.setPointerCapture(e.pointerId); view.style.cursor = 'grabbing'; return;
    }
    const bounds = outerBounds(selected);
    if (Math.abs(p.x - (bounds.x + bounds.w + borderPx(selected))) < HANDLE && Math.abs(p.y - (bounds.y + bounds.h + borderPx(selected))) < HANDLE) {
      drag = { mode: 'resize', k: selected, s0: selected.s, b0: bounds, p0: p, sx0: selected.stretchX, sy0: selected.stretchY, cx: selected.x + b.w / 2, cy: selected.y + b.h / 2, local: outerBounds({ ...selected, rot: 0 }) };
      view.setPointerCapture(e.pointerId);
      return;
    }
  }
  const hit = [...stickers].reverse().find(k => hitSticker(k, p, borderPx(k)));
  selected = hit ?? null;
  if (hit) {
    stickers = [...stickers.filter((k) => k !== hit), hit]; // bring to front
    drag = { mode: 'move', k: hit, dx: p.x - hit.x, dy: p.y - hit.y };
    view.setPointerCapture(e.pointerId);
  }
  renderList(); render();
});
view.addEventListener('pointermove', (e) => {
  if (printing) return;
  const p = toSheet(e);
  if (!drag) {
    let cur = 'default';
    if (selected) {
      const b = outerBounds(selected);
      if (Math.abs(p.x - (b.x + b.w + borderPx(selected))) < HANDLE && Math.abs(p.y - (b.y + b.h + borderPx(selected))) < HANDLE) cur = 'nwse-resize';
    }
    if (selected && onRotationHandle(selected, p)) cur = 'grab';
    if (cur === 'default' && stickers.some(k => hitSticker(k, p, borderPx(k)))) cur = 'move';
    view.style.cursor = cur;
    return;
  }
  const k = drag.k;
  if (drag.mode === 'move') {
    k.x = p.x - drag.dx; k.y = p.y - drag.dy;
  } else if (drag.mode === 'rotate') {
    k.rot = Math.round((((drag.rot + (Math.atan2(p.y - drag.cy, p.x - drag.cx) - drag.start) * 180 / Math.PI) % 360 + 360) % 360) * 10) / 10 % 360;
    k.s = drag.s0; fitScale(k);
    const b = bbox(k); k.x = drag.cx - b.w / 2; k.y = drag.cy - b.h / 2;
  } else if (!k.linked) {
    const a = k.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
    const startX = (drag.p0.x - drag.cx) * c + (drag.p0.y - drag.cy) * s;
    const startY = -(drag.p0.x - drag.cx) * s + (drag.p0.y - drag.cy) * c;
    k.stretchX = drag.sx0 * Math.max(3 * PX_PER_MM, drag.local.w + 2 * (dx * c + dy * s) * (Math.sign(startX) || 1)) / drag.local.w;
    k.stretchY = drag.sy0 * Math.max(3 * PX_PER_MM, drag.local.h + 2 * (-dx * s + dy * c) * (Math.sign(startY) || 1)) / drag.local.h;
    k.s = drag.s0; fitScale(k);
    const b = bbox(k); k.x = drag.cx - b.w / 2; k.y = drag.cy - b.h / 2;
  } else {
    const f = Math.max((p.x - drag.b0.x - borderPx(k)) / drag.b0.w, (p.y - drag.b0.y - borderPx(k)) / drag.b0.h, (3 * PX_PER_MM) / Math.min(drag.b0.w, drag.b0.h));
    k.s = drag.s0 * f;
    const b = outerBounds(k);
    k.x += drag.b0.x - b.x; k.y += drag.b0.y - b.y;
  }
  k.sheet = false;
  fitScale(k); clampInto(k);
  cutStale = true;
  updateButtons();
  if (importedCut) {
    cutStale = false;
  } else if (drag.mode === 'move' || drag.mode === 'rotate') {
    clearTimeout(traceTimer); traceTimer = 0;
    if (!dragPreview || dragPreview.scale !== k.s) {
      try {
        const b = bbox(k);
        dragPreview = { k, cx: k.x + b.w / 2, cy: k.y + b.h / 2, rot: k.rot, scale: k.s,
          background: outlinePath(traceArtwork(stickers.filter(item => item !== k)).contours),
          foreground: outlinePath(traceArtwork([k]).contours) };
      } catch (e) { dragPreview = null; showError(`Preview failed: ${e.message}`); }
    }
  } else if (!traceTimer) traceTimer = setTimeout(runTrace, 100);
  render();
});
const endDrag = () => { if (drag) { drag = null; changed(); } };
view.addEventListener('pointerup', endDrag);
view.addEventListener('pointercancel', endDrag);

document.addEventListener('keydown', (e) => {
  if (printing || e.target !== view || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = selected;
  if (!k) return;
  const step = (e.shiftKey ? 5 : 1) * PX_PER_MM;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) { k.x += moves[e.key][0]; k.y += moves[e.key][1]; k.sheet = false; fitScale(k); clampInto(k); changed(); e.preventDefault(); }
  else if (e.key === 'r' || e.key === 'R') rotate(k);
  else if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey) duplicate(k);
  else if (e.key === 'Delete' || e.key === 'Backspace') { remove(k); e.preventDefault(); }
  else if (e.key === 'Escape') { selected = null; renderList(); render(); }
});

/* ═══ file input, drop, paste ═══ */
$('addBtn').onclick = $('emptyAddBtn').onclick = () => $('file').click();
$('file').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
const stage = $('stage');
for (const t of ['dragenter', 'dragover']) document.addEventListener(t, (e) => { e.preventDefault(); stage.classList.add('drag'); });
for (const t of ['dragleave', 'drop']) document.addEventListener(t, (e) => { e.preventDefault(); if (t === 'drop' || e.target === document.documentElement) stage.classList.remove('drag'); });
document.addEventListener('drop', (e) => addFiles([...(e.dataTransfer?.files ?? [])]));
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); addFiles(files); }
});
$('toggleArtwork').onclick = () => { compactArtwork = !compactArtwork; renderList(); };
$('arrangeBtn').onclick = arrange;
$('clearBtn').onclick = () => {
  if (printing || importing || backgroundBusy || projectBusy) return;
  if ((stickers.length || importedCut) && !confirm('Remove all artwork and imported cuts from the sheet?')) return;
  importedCut = null; updateCutSource();
  stickers = []; selected = null; drag = null; dragPreview = null; cut = null;
  cg.clearRect(0, 0, SHEET.w, SHEET.h);
  $('notice').textContent = '';
  $('importStatus').textContent = 'Add individual stickers or a complete sheet.';
  changed(); $('addBtn').focus();
};

function updateCutSource() {
  $('autoCutBtn').hidden = !importedCut;
  $('cutFileInfo').hidden = !importedCut;
  $('kp').disabled = !!importedCut;
  $('cutFileInfo').textContent = importedCut
    ? `${importedCut.name} · pressure ${importedCut.knifePressure}. Fixed sheet paths replace automatic outlines. Load matching artwork; border/hole controls do not change this file.`
    : '';
}
$('autoCutBtn').onclick = () => { if (printing) return; importedCut = null; updateCutSource(); scheduleTrace(0); };

/* ═══ cut settings ═══ */
$('kp').value = settings.knifePressure;
$('kp').onchange = () => {
  settings.knifePressure = Math.max(1, Math.min(100, Math.round(+$('kp').value || 42)));
  $('kp').value = settings.knifePressure;
  store.set('kp', settings.knifePressure);
  scheduleTrace(0);
};
$('showCut').checked = settings.showCut;
$('showCut').onchange = () => { settings.showCut = $('showCut').checked; store.set('showCut', settings.showCut); render(); };

/* ═══ output files ═══ */
async function buildJpeg(r) {
  const c = new OffscreenCanvas(r.width, r.height);
  c.getContext('2d').putImageData(new ImageData(r.data, r.width, r.height), 0, 0);
  for (const q of [0.95, 0.92, 0.9, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5]) {
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: q });
    if (blob.size <= MAX_JPEG_BYTES) return new Uint8Array(await blob.arrayBuffer());
  }
  throw new Error('could not get the print image under 1 MiB');
}
function download(bytes, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
$('saveProjectBtn').onclick = async () => {
  if (projectBusy || importing || backgroundBusy || printing) return;
  projectBusy = true; updateButtons();
  try { download(await saveProject(stickers, settings, importedCut), `lienecut-${stamp()}.lienecut`, 'application/json'); }
  catch (e) { showError(`Save failed: ${e.message}`); }
  finally { projectBusy = false; updateButtons(); }
};
async function loadProject(file) {
  if (projectBusy || importing || backgroundBusy || printing) return;
  projectBusy = true; updateButtons();
  try {
    const result = await openProject(file);
    if ((stickers.length || importedCut) && !confirm('Replace the current layout with this project? Save it first if you want to keep it.')) {
      for (const k of result.items) { k.bmp.close(); k.originalBackground?.bmp.close(); }
      return;
    }
    stickers = result.items.map(k => ({...k,id:nextId++}));
    selected = null;
    importedCut = result.importedCut;
    Object.assign(settings, result.settings);
    $('kp').value = settings.knifePressure; $('showCut').checked = settings.showCut;
    updateCutSource(); $('notice').textContent = '';
    changed(); runTrace();
  } catch (e) { showError(`Open failed: ${e.message} Your current layout is unchanged.`); }
  finally { projectBusy = false; updateButtons(); }
}
$('openProjectBtn').onclick = () => $('projectFile').click();
$('projectFile').onchange = e => { const file = e.target.files[0]; if (file) loadProject(file); e.target.value = ''; };

/* ═══ printer ═══ */
let conn = null; // {io, close, device, px: PixCut, info}
let printing = null; // {abort: AbortController, jobId}
let pollTimer = 0;
let connecting = false;

function showError(msg) {
  $('notice').textContent = msg;
  updateButtons();
}
function setPill(text, mode) {
  $('printerText').textContent = text;
  $('printerPill').className = 'pill ' + (mode ?? '');
}
const MEDIA = { 5013: '4×7 sticker', 5012: '4×6 photo' };

async function connect(dev) {
  $('notice').textContent = '';
  connecting = true;
  updateButtons();
  let c;
  try {
    c = await usb.openPrinter(dev);
    const px = new PixCut(c.io);
    const info = await px.identify();
    conn = { ...c, px, info };
    await pollStatus();
  } catch (e) {
    await c?.close();
    showError(`connect failed: ${e.message}${/access denied|Unable to claim/i.test(e.message) ? ' (is the Liene app or another tab using the printer?)' : ''}`);
    setPill('Printer not connected');
    conn = null;
  }
  connecting = false;
  updateButtons();
}
async function disconnect() {
  clearTimeout(pollTimer);
  const c = conn;
  conn = null;
  await c?.close();
  setPill('Printer not connected');
  updateButtons();
}
async function pollStatus() {
  clearTimeout(pollTimer);
  if (!conn) return;
  if (!printing) {
    try {
      const s = await conn.px.status();
      const media = MEDIA[conn.info['media-size']] ?? `media ${conn.info['media-size']}`;
      const alert = s.alerts.length ? ` · ${describeAlerts(s.alerts)}` : '';
      setPill(`${conn.info.model} · ${s.label}${alert}`, s.state === 40 ? 'busy' : 'on');
      conn.status = s;
      $('connectBtn').title = `${conn.info.sku} · fw ${conn.info['firmware-revision']} · ${media}`;
    } catch (e) {
      showError(`status: ${e.message}`);
    }
  }
  pollTimer = setTimeout(pollStatus, 4000);
}

$('connectBtn').onclick = async () => {
  if (!usb.supported() || connecting) return;
  if (conn) return disconnect();
  connecting = true;
  updateButtons();
  try { await connect(await usb.requestPrinter()); }
  catch (e) { showError(e.name === 'NotFoundError' ? 'No printer selected. Connect by USB, then choose Connect printer to try again.' : e.message); }
  finally { connecting = false; updateButtons(); }
};

$('printBtn').onclick = async () => {
  if (!conn || !cut?.plt || printing) return;
  const abort = new AbortController();
  printing = { abort, jobId: null };
  updateButtons();
  setPill(`${conn.info.model} · printing`, 'busy');
  const bar = $('progress').firstElementChild;
  $('jobText').textContent = 'Preparing your sheet…';
  try {
    if (cutStale) runTrace();
    if (!cut?.plt) throw new Error('No valid cut path. Review your artwork and try again.');
    const printer = conn.px;
    const {raster, plt} = snapshotPrint(compositeRaster(), cut);
    const jpeg = await buildJpeg(raster);
    abort.signal.throwIfAborted();
    const res = await printer.printAndCut(jpeg, plt, {
      signal: abort.signal,
      onStatus: (s) => {
        if (s.jobId) printing.jobId = s.jobId;
        $('jobText').textContent = s.text;
        if (s.progress != null) bar.style.width = `${Math.round(s.progress * 100)}%`;
        else if (s.phase === 'run') bar.style.width = '100%';
        $('progress').setAttribute('aria-valuenow', String(parseFloat(bar.style.width) || 0));
      },
    });
    $('jobText').textContent = res.cut ? 'Print and cut complete.' : 'Print complete. No cut phase was reported; check your sheet.';
  } catch (e) {
    showError(`print failed: ${e.message}`);
    $('jobText').textContent = e.message;
  } finally {
    printing = null;
    bar.style.width = '0';
    $('progress').setAttribute('aria-valuenow', '0');
    updateButtons();
    pollStatus();
  }
};
$('cancelBtn').onclick = async () => {
  if (!printing) return;
  printing.abort.abort();
  if (printing.jobId && conn) {
    try { await conn.px.cancel(printing.jobId); $('jobText').textContent = 'Cancellation requested.'; } catch (e) { showError(`cancel: ${e.message}`); }
  }
};

function updateButtons() {
  $('list').inert = !!printing;
  $('kp').disabled = !!printing || !!importedCut;
  const hasPaths = !!cut?.plt && !cutStale && !importing && !backgroundBusy;
  const hasCut = hasPaths && stickers.length > 0;
  $('autoCutBtn').disabled = !!printing || !!importing || projectBusy;
  $('saveProjectBtn').disabled = cutStale || (!stickers.length && !importedCut) || !!printing || !!importing || backgroundBusy || projectBusy;
  $('openProjectBtn').disabled = !!printing || !!importing || backgroundBusy || projectBusy;
  $('printBtn').disabled = !conn || !hasCut || !!printing || projectBusy;
  $('printBtn').title = !conn ? 'connect the printer first' : !hasCut ? 'add a sticker first' : '';
  $('cancelBtn').hidden = !printing;
  $('progress').hidden = !printing;
  $('arrangeBtn').disabled = !stickers.length || !!importing || !!printing || backgroundBusy || projectBusy;
  $('clearBtn').disabled = (!stickers.length && !importedCut && !$('notice').textContent) || !!importing || !!printing || backgroundBusy || projectBusy;
  $('addBtn').disabled = $('emptyAddBtn').disabled = !!importing || !!printing || backgroundBusy || projectBusy;
  $('printHint').textContent = printing ? 'Your job is in progress. Keep this tab open.' : importing ? 'Opening artwork…' : !conn ? 'Connect your printer to print. You can still save your project.' : !hasCut ? 'Add artwork and wait for a valid cut preview.' : 'Ready to print on 4 × 7 in sticker paper.';
  $('connectBtn').textContent = connecting ? 'Connecting…' : conn ? 'Disconnect' : 'Connect printer';
  $('connectBtn').disabled = !usb.supported() || !!printing || connecting;
}

if (!usb.supported()) {
  const n = $('usbNote');
  n.hidden = false;
  n.textContent = window.isSecureContext
    ? 'This browser can’t talk to USB printers. Open LieneCut in Chrome or Edge to print, or save your project to print later.'
    : 'USB needs a secure page: open LieneCut over https or localhost.';
} else {
  navigator.usb.addEventListener('disconnect', (e) => {
    if (conn && e.device === conn.device) { conn = null; printing?.abort.abort(); clearTimeout(pollTimer); setPill('Printer not connected'); updateButtons(); }
  });
  navigator.usb.addEventListener('connect', async (e) => {
    if (!conn && !connecting && e.device.vendorId === 0x302c) connect(e.device);
  });
  usb.findGranted().then((d) => d && !conn && !connecting && connect(d)).catch(() => showError('Printer access is unavailable. Try Connect printer again.'));
}
window.addEventListener('beforeunload', (e) => { if (printing) e.preventDefault(); });

changed();
