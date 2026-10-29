// shortcut: removes an edge-connected background color, not semantic photo subjects; use segmentation for complex scenes.
export function removeBackground({ width, height, data }, tolerance = 32) {
  const size = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || size > 16000000 || data.length !== size * 4) throw new Error('Use an image up to 16 megapixels for background removal.');
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 100) throw new Error('Background tolerance must be between 0 and 100.');
  const bins = new Map();
  function sample(p) {
    const i = p * 4;
    if (data[i + 3] < 128) return;
    const key = (data[i] >> 4) * 256 + (data[i + 1] >> 4) * 16 + (data[i + 2] >> 4);
    const bin = bins.get(key) ?? { count: 0, rgb: [0, 0, 0] };
    bin.count++; for (let c = 0; c < 3; c++) bin.rgb[c] += data[i + c];
    bins.set(key, bin);
  }
  for (let x = 0; x < width; x++) { sample(x); if (height > 1) sample((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { sample(y * width); if (width > 1) sample(y * width + width - 1); }
  const dominant = [...bins.values()].sort((a, b) => b.count - a.count)[0];
  const output = new Uint8ClampedArray(data);
  if (!dominant) return { data: output, removed: 0 };
  const color = dominant.rgb.map(v => v / dominant.count);
  const visited = new Uint8Array(size), queue = new Uint32Array(size);
  let head = 0, tail = 0, removed = 0;
  function visit(p) {
    if (visited[p]) return;
    visited[p] = 1;
    const i = p * 4;
    if (data[i + 3] > 0 && color.some((v, c) => Math.abs(v - data[i + c]) > tolerance)) return;
    if (output[i + 3]) removed++;
    output[i + 3] = 0; queue[tail++] = p;
  }
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const p = queue[head++], x = p % width;
    if (x) visit(p - 1); if (x < width - 1) visit(p + 1);
    if (p >= width) visit(p - width); if (p < size - width) visit(p + width);
  }
  return { data: output, removed };
}
