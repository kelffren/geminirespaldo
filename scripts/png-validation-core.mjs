import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const PNG_SIGNATURE = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}

export function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validBitDepth(colorType, bitDepth) {
  const allowed = new Map([[0,[1,2,4,8,16]],[2,[8,16]],[3,[1,2,4,8]],[4,[8,16]],[6,[8,16]]]);
  return allowed.get(colorType)?.includes(bitDepth) === true;
}

function validateInflatedImageData(ihdr, idatParts, label) {
  assert(ihdr.interlace === 0, `${label}: interlaced PNGs are not permitted in the runtime art pipeline`);
  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idatParts));
  } catch (error) {
    throw new Error(`${label}: IDAT zlib stream cannot be decoded (${error.message})`);
  }
  const channels = new Map([[0,1],[2,3],[3,1],[4,2],[6,4]]).get(ihdr.colorType);
  const rowBytes = Math.ceil((ihdr.width * channels * ihdr.bitDepth) / 8);
  const expected = ihdr.height * (rowBytes + 1);
  assert(raw.length === expected, `${label}: decoded scanline bytes=${raw.length} expected=${expected}`);
  for (let row = 0, offset = 0; row < ihdr.height; row += 1, offset += rowBytes + 1) {
    assert(raw[offset] <= 4, `${label}: invalid PNG filter=${raw[offset]} at row=${row}`);
  }
  return {decodedBytes: raw.length, rowBytes};
}

export function inspectPng(buffer, label = 'PNG') {
  assert(Buffer.isBuffer(buffer), `${label}: expected Buffer`);
  assert(buffer.length >= 33, `${label}: truncated before IHDR`);
  assert(buffer.subarray(0, 8).equals(PNG_SIGNATURE), `${label}: invalid PNG signature`);

  let offset = 8;
  let chunkIndex = 0;
  let ihdr = null;
  let sawPLTE = false;
  let sawIDAT = false;
  let idatClosed = false;
  let sawIEND = false;
  let hasTRNS = false;
  const chunks = [];
  const idatParts = [];

  while (offset < buffer.length) {
    assert(offset + 12 <= buffer.length, `${label}: truncated chunk header at byte ${offset}`);
    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    const next = crcOffset + 4;
    assert(next <= buffer.length, `${label}: truncated chunk payload at byte ${offset}`);

    const type = buffer.toString('ascii', typeStart, typeStart + 4);
    assert(/^[A-Za-z]{4}$/.test(type), `${label}: invalid chunk type at byte ${offset}`);
    const expectedCrc = buffer.readUInt32BE(crcOffset);
    const actualCrc = crc32(buffer.subarray(typeStart, crcOffset));
    assert(expectedCrc === actualCrc, `${label}: CRC mismatch in ${type}`);

    if (chunkIndex === 0) assert(type === 'IHDR', `${label}: IHDR must be first chunk`);
    if (type === 'IHDR') {
      assert(chunkIndex === 0 && ihdr === null, `${label}: duplicate or misplaced IHDR`);
      assert(length === 13, `${label}: IHDR length must be 13`);
      const width = buffer.readUInt32BE(dataStart);
      const height = buffer.readUInt32BE(dataStart + 4);
      const bitDepth = buffer[dataStart + 8];
      const colorType = buffer[dataStart + 9];
      const compression = buffer[dataStart + 10];
      const filter = buffer[dataStart + 11];
      const interlace = buffer[dataStart + 12];
      assert(width > 0 && height > 0, `${label}: width/height must be positive`);
      assert(validBitDepth(colorType, bitDepth), `${label}: invalid bitDepth=${bitDepth} for colorType=${colorType}`);
      assert(compression === 0, `${label}: unsupported compression method=${compression}`);
      assert(filter === 0, `${label}: unsupported filter method=${filter}`);
      assert(interlace === 0 || interlace === 1, `${label}: invalid interlace method=${interlace}`);
      ihdr = {width,height,bitDepth,colorType,compression,filter,interlace};
    } else {
      assert(ihdr !== null, `${label}: chunk before IHDR`);
    }

    if (type === 'PLTE') {
      assert(!sawIDAT, `${label}: PLTE must precede IDAT`);
      assert(length > 0 && length % 3 === 0 && length <= 768, `${label}: invalid PLTE length=${length}`);
      sawPLTE = true;
    } else if (type === 'tRNS') {
      assert(!sawIDAT, `${label}: tRNS must precede IDAT`);
      hasTRNS = true;
    } else if (type === 'IDAT') {
      assert(!idatClosed, `${label}: IDAT chunks must be consecutive`);
      sawIDAT = true;
      idatParts.push(buffer.subarray(dataStart, crcOffset));
    } else if (sawIDAT && type !== 'IEND') {
      idatClosed = true;
    }

    if (type === 'IEND') {
      assert(length === 0, `${label}: IEND length must be 0`);
      assert(sawIDAT, `${label}: IEND before IDAT`);
      sawIEND = true;
      offset = next;
      chunks.push({type,length});
      chunkIndex += 1;
      break;
    }

    chunks.push({type,length});
    offset = next;
    chunkIndex += 1;
  }

  assert(ihdr !== null, `${label}: missing IHDR`);
  assert(sawIDAT, `${label}: missing IDAT`);
  assert(sawIEND, `${label}: missing IEND`);
  assert(offset === buffer.length, `${label}: trailing bytes after IEND`);
  if (ihdr.colorType === 3) assert(sawPLTE, `${label}: indexed-color PNG requires PLTE`);
  if (ihdr.colorType === 0 || ihdr.colorType === 4) assert(!sawPLTE, `${label}: PLTE forbidden for grayscale PNG`);
  const decoded = validateInflatedImageData(ihdr, idatParts, label);

  return {
    ...ihdr,
    ...decoded,
    hasTransparency: ihdr.colorType === 4 || ihdr.colorType === 6 || hasTRNS,
    chunks
  };
}

export function walkFiles(root, predicate = () => true) {
  const out = [];
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (predicate(full)) out.push(full);
    }
  };
  visit(root);
  return out;
}
