/**
 * The Red Bull rule book's Appendix 2 (DD formula) and Appendix 3 (DD table) are
 * scanned bitmaps with no text layer, so they cannot be read by pdftotext. This
 * script pulls the raw image XObjects out of the PDF and rewrites them as PNGs so
 * the tables can be read and transcribed by eye.
 *
 * Deliberately dependency-free: the streams are all FlateDecode, which Node's zlib
 * handles, and writing a PNG is just a few length-prefixed, CRC'd chunks.
 *
 * Run: npm run data:rb-images -- [outDir]
 */
import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PDF = join(ROOT, 'RED BULL CLIFF DIVING WORLD SERIES 2026 RULE BOOK_final.pdf');
const outDir = resolve(process.argv[2] ?? join(ROOT, 'tmp', 'rb-pages'));

const buf = readFileSync(PDF);
const text = buf.toString('latin1');

/** Crude but sufficient object index: `N G obj` ... `endobj`. */
function indexObjects() {
  const objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    const end = text.indexOf('endobj', start);
    if (end === -1) continue;
    objs.set(Number(m[1]), { start, end, num: Number(m[1]) });
  }
  return objs;
}

const objects = indexObjects();

/** Resolve `12 0 R` indirect references to a primitive, one hop at a time. */
function deref(value) {
  let v = value;
  for (let i = 0; i < 8; i++) {
    const m = /^(\d+)\s+\d+\s+R$/.exec(String(v).trim());
    if (!m) return v;
    const o = objects.get(Number(m[1]));
    if (!o) return v;
    v = text.slice(o.start, o.end).trim();
  }
  return v;
}

/** Read `/Key value` out of a dictionary slice, for the scalar keys we need. */
function dictGet(dict, key) {
  const re = new RegExp(`/${key}\\s*(<<|\\[[^\\]]*\\]|/[A-Za-z0-9]+|\\d+\\s+\\d+\\s+R|-?[\\d.]+|true|false)`);
  const m = re.exec(dict);
  return m ? m[1].trim() : null;
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (b) => {
    let c = -1;
    for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(path, width, height, colorType, bitDepth, raw, palette) {
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  const expect = rowBytes * height;
  if (raw.length < expect) {
    throw new Error(`short image data: have ${raw.length}, need ${expect}`);
  }
  // PNG wants a filter byte at the start of every scanline; PDF image data has none.
  const framed = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    framed[y * (rowBytes + 1)] = 0;
    raw.copy(framed, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  const parts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
  ];
  if (colorType === 3) parts.push(chunk('PLTE', palette));
  parts.push(chunk('IDAT', deflateSync(framed, { level: 6 })), chunk('IEND', Buffer.alloc(0)));
  writeFileSync(path, Buffer.concat(parts));
}

/** Map a PDF colour space onto a PNG colour type, following ICCBased /N. */
function colorTypeFor(csRaw, bpc) {
  const cs = String(deref(csRaw) ?? '').trim();
  if (/DeviceGray|CalGray/.test(cs)) return { colorType: 0 };
  if (/DeviceRGB|CalRGB|Lab/.test(cs)) return { colorType: 2 };
  if (/DeviceCMYK/.test(cs)) return { colorType: null, reason: 'CMYK unsupported' };
  if (/ICCBased/.test(cs)) {
    const ref = /ICCBased\s+(\d+)\s+\d+\s+R/.exec(cs);
    if (ref) {
      const o = objects.get(Number(ref[1]));
      const n = o ? dictGet(text.slice(o.start, o.end), 'N') : null;
      if (n === '1') return { colorType: 0 };
      if (n === '4') return { colorType: null, reason: 'CMYK (ICC N=4) unsupported' };
      return { colorType: 2 };
    }
    return { colorType: 2 };
  }
  if (/Indexed/.test(cs)) {
    // /Indexed base hival lookup — lookup is usually a stream or a hex string.
    const m = /Indexed\s+(.+?)\s+(\d+)\s+(\d+\s+\d+\s+R|\([^)]*\)|<[0-9A-Fa-f\s]*>)/s.exec(cs);
    if (!m) return { colorType: null, reason: 'Indexed: cannot parse lookup' };
    let lut;
    const ref = /^(\d+)\s+\d+\s+R$/.exec(m[3].trim());
    if (ref) {
      lut = streamOf(objects.get(Number(ref[1])));
    } else if (m[3].startsWith('<')) {
      lut = Buffer.from(m[3].replace(/[^0-9A-Fa-f]/g, ''), 'hex');
    } else {
      lut = Buffer.from(m[3].slice(1, -1), 'latin1');
    }
    if (!lut) return { colorType: null, reason: 'Indexed: lookup unavailable' };
    const entries = Number(m[2]) + 1;
    const palette = Buffer.alloc(entries * 3);
    lut.copy(palette, 0, 0, Math.min(lut.length, entries * 3));
    return { colorType: 3, palette };
  }
  return { colorType: bpc === 1 ? 0 : 2, reason: `unrecognised colour space ${cs.slice(0, 40)}` };
}

/** Inflate an object's stream, honouring an indirect /Length. */
function streamOf(obj) {
  if (!obj) return null;
  const slice = text.slice(obj.start, obj.end);
  const sIdx = slice.indexOf('stream');
  if (sIdx === -1) return null;
  let dataStart = obj.start + sIdx + 'stream'.length;
  if (text[dataStart] === '\r') dataStart++;
  if (text[dataStart] === '\n') dataStart++;
  const dict = slice.slice(0, sIdx);
  let len = Number(deref(dictGet(dict, 'Length')));
  if (!Number.isFinite(len) || len <= 0) {
    const e = text.indexOf('endstream', dataStart);
    len = e - dataStart;
  }
  const raw = buf.subarray(dataStart, dataStart + len);
  const filter = String(dictGet(dict, 'Filter') ?? '');
  if (/FlateDecode/.test(filter)) {
    try {
      return inflateSync(raw);
    } catch {
      // Some writers overstate /Length; retry on everything up to endstream.
      const e = text.indexOf('endstream', dataStart);
      try {
        return inflateSync(buf.subarray(dataStart, e));
      } catch (err) {
        return null;
      }
    }
  }
  return raw;
}

mkdirSync(outDir, { recursive: true });

const results = [];
for (const obj of objects.values()) {
  const slice = text.slice(obj.start, obj.end);
  const sIdx = slice.indexOf('stream');
  const dict = sIdx === -1 ? slice : slice.slice(0, sIdx);
  if (!/\/Subtype\s*\/Image/.test(dict)) continue;

  const width = Number(deref(dictGet(dict, 'Width')));
  const height = Number(deref(dictGet(dict, 'Height')));
  const bpc = Number(deref(dictGet(dict, 'BitsPerComponent')) ?? 8);
  const filter = String(dictGet(dict, 'Filter') ?? '');
  const name = `obj${String(obj.num).padStart(4, '0')}_${width}x${height}`;

  if (!/FlateDecode/.test(filter)) {
    results.push({ name, status: `skipped (filter ${filter || 'none'})` });
    continue;
  }
  const data = streamOf(obj);
  if (!data) {
    results.push({ name, status: 'skipped (inflate failed)' });
    continue;
  }
  const { colorType, palette, reason } = colorTypeFor(dictGet(dict, 'ColorSpace'), bpc);
  if (colorType == null) {
    results.push({ name, status: `skipped (${reason})` });
    continue;
  }
  try {
    const path = join(outDir, `${name}.png`);
    writePng(path, width, height, colorType, bpc, data, palette);
    results.push({ name, status: `ok -> ${path}`, bytes: data.length });
  } catch (err) {
    results.push({ name, status: `failed (${err.message})` });
  }
}

console.log(`${results.length} image XObject(s) in ${PDF.split(/[\\/]/).pop()}`);
for (const r of results) console.log(`  ${r.name.padEnd(26)} ${r.status}`);
console.log(`\nOutput dir: ${outDir}`);
