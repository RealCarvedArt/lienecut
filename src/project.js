import { alphaRuns } from './layout.js';
import { importCut, CUT_DEFAULTS } from './cut.js';

const MAX_BYTES = 100 * 1024 * 1024;
const fields = ['name', 'sw', 'sh', 's', 'rot', 'x', 'y', 'stretchX', 'stretchY', 'marginMm', 'cutHoles', 'linked', 'sheet', 'backgroundTolerance'];
const fail = () => { throw new Error('Invalid LieneCut project.'); };
const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

async function imageData(bitmap) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({type:'image/png'});
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
  });
}

export async function saveProject(items, settings, importedCut) {
  // Snapshot metadata before asynchronous image encoding so edits cannot mix layouts.
  const snapshot = items.map(k => ({values:Object.fromEntries(fields.filter(f => k[f] !== undefined).map(f => [f,k[f]])), bmp:k.bmp, original:k.originalBackground?.bmp}));
  const project = {format:'LieneCut',version:1,settings:{knifePressure:settings.knifePressure,showCut:settings.showCut},
    importedCut: importedCut ? {name:importedCut.name,plt:importedCut.plt} : null, artwork:[]};
  for (const item of snapshot) {
    project.artwork.push({...item.values,image:await imageData(item.bmp), ...(item.original ? {originalImage:await imageData(item.original)} : {})});
  }
  const text = JSON.stringify(project);
  // Apply the same limits on save and open; never download a file we cannot reopen.
  validateProject(text);
  return text;
}

export function validateProject(text) {
  if (text.length > MAX_BYTES) throw new Error('Project exceeds the 100 MB limit.');
  const p = JSON.parse(text);
  if (!p || p.format !== 'LieneCut' || p.version !== 1 || !Array.isArray(p.artwork) || p.artwork.length > 500) fail();
  if (!p.settings || !number(p.settings.knifePressure,1,100) || !Number.isInteger(p.settings.knifePressure) || typeof p.settings.showCut !== 'boolean') fail();
  let pixels=0;
  for (const k of p.artwork) {
    if (!k || typeof k.name !== 'string' || k.name.length > 1000) fail();
    if (!Number.isInteger(k.sw) || !Number.isInteger(k.sh) || !number(k.sw,1,16000) || !number(k.sh,1,16000) || k.sw*k.sh > 16000000) throw new Error('Project images must be at most 16 megapixels each.');
    pixels += k.sw*k.sh*(k.originalImage ? 2 : 1);
    for (const f of ['s','stretchX','stretchY']) if (!number(k[f],0.000001,10000)) fail();
    for (const f of ['x','y']) if (!number(k[f],-100000,100000)) fail();
    if (!number(k.rot,-360,360) || !number(k.marginMm,0,10)) fail();
    if (typeof k.cutHoles !== 'boolean' || typeof k.linked !== 'boolean' || (k.sheet !== undefined && typeof k.sheet !== 'boolean')) fail();
    if (k.backgroundTolerance !== undefined && !number(k.backgroundTolerance,0,100)) fail();
    for (const image of [k.image,...(k.originalImage !== undefined ? [k.originalImage] : [])]) {
      if (typeof image !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) fail();
      const header = Uint8Array.from(atob(image.slice(22,66)), c=>c.charCodeAt(0));
      if (header.length < 24) fail();
      const view=new DataView(header.buffer);
      if(view.getUint32(0)!==0x89504e47 || view.getUint32(4)!==0x0d0a1a0a || view.getUint32(12)!==0x49484452 || view.getUint32(16)!==k.sw || view.getUint32(20)!==k.sh) fail();
    }
  }
  if (pixels > 64000000) throw new Error('Project exceeds 64 megapixels of stored artwork.');
  if (p.importedCut !== null) {
    if (!p.importedCut || typeof p.importedCut.name !== 'string' || typeof p.importedCut.plt !== 'string') fail();
    importCut(p.importedCut.plt);
  }
  return p;
}

export async function openProject(file) {
  if (file.size > MAX_BYTES) throw new Error('Project exceeds the 100 MB limit.');
  const project=validateProject(await file.text()), bitmaps=[];
  async function decode(data, k) {
    const bytes=Uint8Array.from(atob(data.slice(22)), c=>c.charCodeAt(0));
    const bmp=await createImageBitmap(new Blob([bytes],{type:'image/png'})); bitmaps.push(bmp);
    if (bmp.width !== k.sw || bmp.height !== k.sh) fail();
    const canvas=new OffscreenCanvas(k.sw,k.sh), g=canvas.getContext('2d');g.drawImage(bmp,0,0);
    const shape=alphaRuns(g.getImageData(0,0,k.sw,k.sh),CUT_DEFAULTS.alphaThreshold);
    if (!shape.length) throw new Error('Project contains fully transparent artwork.');
    return {bmp,shape};
  }
  try {
    const items=[];
    for (const k of project.artwork) {
      const item={...Object.fromEntries(fields.filter(f=>k[f]!==undefined).map(f=>[f,k[f]])),...await decode(k.image,k)};
      if (k.originalImage) item.originalBackground=await decode(k.originalImage,k);
      items.push(item);
    }
    return {items,settings:project.settings,importedCut:project.importedCut ? {...importCut(project.importedCut.plt),name:project.importedCut.name} : null};
  } catch(e) { for(const bmp of bitmaps) bmp.close(); throw e; }
}
