export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16000000;

/** Read allocation bounds before giving untrusted compressed images to the browser decoder. */
export function validateImageBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error('Image file is empty.');
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('Each image must be at most 20 MiB.');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const malformed = () => { throw new Error('Unsupported or malformed image. Choose a PNG, JPEG, WebP or GIF.'); };
  const has = (offset, length) => offset >= 0 && offset + length <= bytes.length;
  const ascii = (offset, text) => has(offset, text.length) && [...text].every((c,i) => bytes[offset+i] === c.charCodeAt(0));
  const dimensions = (width,height) => {
    if (!width || !height || width > 16000 || height > 16000 || width * height > MAX_IMAGE_PIXELS) {
      throw new Error('Each image must be at most 16 megapixels, with no side over 16000 pixels.');
    }
    return {width,height};
  };
  if (has(0,8) && v.getUint32(0) === 0x89504e47 && v.getUint32(4) === 0x0d0a1a0a) {
    if (!has(0,33) || v.getUint32(8) !== 13 || !ascii(12,'IHDR')) malformed();
    return dimensions(v.getUint32(16),v.getUint32(20));
  }
  if (has(0,2) && bytes[0] === 255 && bytes[1] === 216) {
    for (let p=2; p<bytes.length;) {
      if (bytes[p++] !== 255) malformed();
      while (bytes[p] === 255) p++;
      const marker=bytes[p++];
      if (marker === 0xd9 || marker === 0xda || marker === undefined) malformed();
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (!has(p,2)) malformed();
      const length=v.getUint16(p);
      if (length<2 || !has(p,length)) malformed();
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4,0xc8,0xcc].includes(marker)) {
        if (length<8 || length !== 8+3*bytes[p+7]) malformed();
        return dimensions(v.getUint16(p+5),v.getUint16(p+3));
      }
      p+=length;
    }
    malformed();
  }
  if (ascii(0,'GIF87a') || ascii(0,'GIF89a')) {
    if (!has(0,13)) malformed();
    const size=dimensions(v.getUint16(6,true),v.getUint16(8,true));
    let p=13+(bytes[10]&128 ? 3*(1<<((bytes[10]&7)+1)) : 0), images=0;
    const blocks = () => {
      for (;;) { if (!has(p,1)) malformed(); const n=bytes[p++]; if (!n) return; if (!has(p,n)) malformed(); p+=n; }
    };
    while (has(p,1)) {
      const type=bytes[p++];
      if (type === 0x3b) { if (!images) malformed(); return size; }
      if (type === 0x21) { if (!has(p,1)) malformed(); p++; blocks(); continue; }
      if (type !== 0x2c || !has(p,9)) malformed();
      const w=v.getUint16(p+4,true), h=v.getUint16(p+6,true);
      dimensions(w,h);
      if (v.getUint16(p,true)+w>size.width || v.getUint16(p+2,true)+h>size.height) malformed();
      const table=bytes[p+8];p+=9+(table&128 ? 3*(1<<((table&7)+1)) : 0);
      if (!has(p,1) || bytes[p]<2 || bytes[p]>8) malformed();
      p++;blocks();images++;
    }
    malformed();
  }
  if (ascii(0,'RIFF') && ascii(8,'WEBP')) {
    const end=v.getUint32(4,true)+8;
    if (end<20 || end>bytes.length) malformed();
    let size, image=false;
    const u24 = p => bytes[p]+bytes[p+1]*256+bytes[p+2]*65536;
    function chunks(start,limit,frame=false) {
      for(let p=start;p<limit;) {
        if(p+8>limit) malformed();
        const length=v.getUint32(p+4,true), q=p+8;
        if(q+length>limit) malformed();
        let found;
        if(ascii(p,'VP8X')) {
          if(frame || length!==10 || size) malformed();
          size=dimensions(u24(q+4)+1,u24(q+7)+1);
        } else if(ascii(p,'VP8L')) {
          if(length<5 || bytes[q]!==0x2f) malformed();
          found=dimensions(1+((bytes[q+1]|bytes[q+2]<<8)&0x3fff),1+((bytes[q+2]>>6|bytes[q+3]<<2|bytes[q+4]<<10)&0x3fff));
        } else if(ascii(p,'VP8 ')) {
          if(length<10 || bytes[q]&1 || bytes[q+3]!==0x9d || bytes[q+4]!==1 || bytes[q+5]!==0x2a) malformed();
          found=dimensions(v.getUint16(q+6,true)&0x3fff,v.getUint16(q+8,true)&0x3fff);
        } else if(ascii(p,'ANMF')) {
          if(frame || !size || length<16) malformed();
          const f=dimensions(u24(q+6)+1,u24(q+9)+1);
          if(u24(q)*2+f.width>size.width || u24(q+3)*2+f.height>size.height) malformed();
          chunks(q+16,q+length,true);
        }
        if(found) { image=true; if(!size) size=found; if(found.width>size.width || found.height>size.height) malformed(); }
        p=q+length+(length&1);
        if(p>limit) malformed();
      }
    }
    chunks(12,end);
    if(!size || !image) malformed();
    return size;
  }
  malformed();
}
