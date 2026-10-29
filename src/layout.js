// Layout geometry uses degrees and the art's axis-aligned bounds; border is in sheet pixels.
export function bbox(k) {
  const a = k.rot * Math.PI / 180;
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return { w: k.s * (k.sw * (k.stretchX ?? 1) * c + k.sh * (k.stretchY ?? 1) * s), h: k.s * (k.sw * (k.stretchX ?? 1) * s + k.sh * (k.stretchY ?? 1) * c) };
}
// Store opaque runs once on import; transparent gaps remain available for selection.
export function alphaRuns({ width, height, data }, threshold = 128) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = [y]; let start = -1;
    for (let x = 0; x <= width; x++) {
      const solid = x < width && data[(y * width + x) * 4 + 3] >= threshold;
      if (solid && start < 0) start = x;
      if (!solid && start >= 0) { row.push(start, x); start = -1; }
    }
    if (row.length > 1) rows.push(row);
  }
  return rows;
}
export function outerBounds(k, border = 0) {
  const b = bbox(k);
  if (!k.shape?.length) return { x: k.x - border, y: k.y - border, w: b.w + 2 * border, h: b.h + 2 * border };
  const angle = k.rot * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const row of k.shape) for (const x of [row[1], row[row.length - 1]]) for (const y of [row[0], row[0] + 1]) {
    const dx = (x - k.sw / 2) * k.s * (k.stretchX ?? 1), dy = (y - k.sh / 2) * k.s * (k.stretchY ?? 1);
    const px = dx * c - dy * s, py = dx * s + dy * c;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  return { x: k.x + b.w / 2 + x0 - border, y: k.y + b.h / 2 + y0 - border, w: x1 - x0 + 2 * border, h: y1 - y0 + 2 * border };
}
export function hitSticker(k, p, border) {
  const b = bbox(k), a = -k.rot * Math.PI / 180;
  const dx = p.x - k.x - b.w / 2, dy = p.y - k.y - b.h / 2;
  const sx = k.s * (k.stretchX ?? 1), sy = k.s * (k.stretchY ?? 1);
  const x = (dx * Math.cos(a) - dy * Math.sin(a)) / sx + k.sw / 2;
  const y = (dx * Math.sin(a) + dy * Math.cos(a)) / sy + k.sh / 2;
  if (!k.shape) return x >= -border / sx && x <= k.sw + border / sx && y >= -border / sy && y <= k.sh + border / sy;
  for (const row of k.shape) {
    const dy = Math.max(row[0] - y, y - row[0] - 1, 0) * sy;
    if (dy > border) continue;
    for (let i = 1; i < row.length; i += 2) {
      const dx = Math.max(row[i] - x, x - row[i + 1], 0) * sx;
      if (dx * dx + dy * dy <= border * border) return true;
    }
  }
  return false;
}

// shortcut: packs bounding rectangles, not interlocking silhouettes; use contour nesting if dense irregular art needs it.
export function packStickers(items, { width, height, edge, border, gap, minSize }) {
  if (!items.length) return { scale: 1, placements: [] };
  if (![width, height, edge, border, gap, minSize].every(Number.isFinite)
    || width <= 2 * edge || height <= 2 * edge || Math.min(edge, border, gap, minSize) < 0
    || items.some(k => ![k.sw, k.sh, k.s, k.rot, k.stretchX ?? 1, k.stretchY ?? 1, k.border ?? border].every(Number.isFinite) || Math.min(k.sw, k.sh, k.s, k.stretchX ?? 1, k.stretchY ?? 1) <= 0 || (k.border ?? border) < 0)) return null;
  const spaceW = width - 2 * edge + gap, spaceH = height - 2 * edge + gap;
  const orders = [k => { const b = outerBounds(k); return b.w * b.h; }, k => { const b = outerBounds(k); return Math.max(b.w, b.h); }, k => outerBounds(k).h];
  function attempt(scale, score) {
    let free = [{ x: edge, y: edge, w: spaceW, h: spaceH }];
    const placements = [];
    for (const k of [...items].sort((a, b) => score(b) - score(a))) {
      let best = null;
      const margin = k.border ?? border;
      for (const turn of [0, 90]) {
        const rot = (k.rot + turn) % 360, s = k.s * scale;
        const b = outerBounds({ ...k, rot, s, x: 0, y: 0 });
        const w = b.w + 2 * margin + gap, h = b.h + 2 * margin + gap;
        for (const f of free) {
          if (w > f.w + 1e-7 || h > f.h + 1e-7) continue;
          const short = Math.min(f.w - w, f.h - h), long = Math.max(f.w - w, f.h - h);
          if (!best || short < best.short || (short === best.short && long < best.long)) best = { x: f.x, y: f.y, w, h, rot, s, short, long, offsetX: b.x, offsetY: b.y };
        }
      }
      if (!best) return null;
      placements.push({ id: k.id, x: best.x + margin - best.offsetX, y: best.y + margin - best.offsetY, s: best.s, rot: best.rot });
      const next = [];
      for (const f of free) {
        if (best.x >= f.x + f.w || best.x + best.w <= f.x || best.y >= f.y + f.h || best.y + best.h <= f.y) { next.push(f); continue; }
        if (best.x > f.x) next.push({ ...f, w: best.x - f.x });
        if (best.x + best.w < f.x + f.w) next.push({ ...f, x: best.x + best.w, w: f.x + f.w - best.x - best.w });
        if (best.y > f.y) next.push({ ...f, h: best.y - f.y });
        if (best.y + best.h < f.y + f.h) next.push({ ...f, y: best.y + best.h, h: f.y + f.h - best.y - best.h });
      }
      free = next.filter((f, i) => !next.some((o, j) => j !== i && o.x <= f.x && o.y <= f.y && o.x + o.w >= f.x + f.w && o.y + o.h >= f.y + f.h && (j < i || o.x !== f.x || o.y !== f.y || o.w !== f.w || o.h !== f.h)));
    }
    return { scale, placements };
  }
  const pack = scale => { for (const order of orders) { const result = attempt(scale, order); if (result) return result; } return null; };
  const full = pack(1);
  if (full) return full;
  let lo = Math.max(...items.map(k => Math.min(1, minSize / (Math.min(k.sw * (k.stretchX ?? 1), k.sh * (k.stretchY ?? 1)) * k.s)))), hi = 1;
  let best = pack(lo);
  if (!best) return null;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2, result = pack(mid);
    if (result) { best = result; lo = mid; } else hi = mid;
  }
  return best;
}
