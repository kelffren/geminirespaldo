import fs from 'node:fs';
import zlib from 'node:zlib';
import {crc32} from './png-validation-core.mjs';

const file = process.argv[2];
if (!file) throw new Error('usage: node scripts/repair-png-crcs.mjs <png>');
const png = fs.readFileSync(file);
const signature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
if (!png.subarray(0, 8).equals(signature)) throw new Error(`${file}: invalid PNG signature`);

const chunks = [];
let offset = 8;
let sawIEND = false;
while (offset < png.length) {
  if (offset + 12 > png.length) throw new Error(`${file}: truncated chunk header at ${offset}`);
  const length = png.readUInt32BE(offset);
  const typeStart = offset + 4;
  const dataStart = offset + 8;
  const crcOffset = dataStart + length;
  const next = crcOffset + 4;
  if (next > png.length) throw new Error(`${file}: truncated chunk payload at ${offset}`);
  const type = png.toString('ascii', typeStart, typeStart + 4);
  chunks.push({type, dataStart, crcOffset, length});
  offset = next;
  if (type === 'IEND') { sawIEND = true; break; }
}
if (!sawIEND || offset !== png.length) throw new Error(`${file}: structural end invalid; repair refused`);

const idatChunks = chunks.filter(chunk => chunk.type === 'IDAT');
if (!idatChunks.length) throw new Error(`${file}: no IDAT chunks`);
const idat = Buffer.concat(idatChunks.map(chunk => png.subarray(chunk.dataStart, chunk.crcOffset)));
if (idat.length < 7) throw new Error(`${file}: zlib stream too short`);
const cmf = idat[0];
const flg = idat[1];
if ((cmf & 0x0f) !== 8 || ((cmf << 8) + flg) % 31 !== 0 || (flg & 0x20)) {
  throw new Error(`${file}: unsupported zlib header; refusing lossy reconstruction`);
}
const deflate = idat.subarray(2, idat.length - 4);
let raw;
try {
  raw = zlib.inflateRawSync(deflate);
} catch (error) {
  throw new Error(`${file}: DEFLATE payload is damaged; checksum-only repair refused (${error.message})`);
}
function adler32(buffer) {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (const byte of buffer) {
    a = (a + byte) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}
const repairedIdat = Buffer.from(idat);
repairedIdat.writeUInt32BE(adler32(raw), repairedIdat.length - 4);
let cursor = 0;
for (const chunk of idatChunks) {
  repairedIdat.copy(png, chunk.dataStart, cursor, cursor + chunk.length);
  cursor += chunk.length;
}
for (const chunk of chunks) {
  png.writeUInt32BE(crc32(png.subarray(chunk.dataStart - 4, chunk.crcOffset)), chunk.crcOffset);
}
fs.writeFileSync(file, png);
console.log(`PNG_CHECKSUMS_REPAIRED file=${file} chunks=${chunks.length} decodedBytes=${raw.length}`);
