/* KELO-INDEX
 * area: BUILD
 * keys: PNG VALIDATION CORRUPTION CRC FIXTURE CI
 * hace: prueba que el validador PNG rechaza binarios corruptos usando un asset runtime vigente
 * online: N/A; test estatico de CI
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {crc32, inspectPng} from './png-validation-core.mjs';

const source = fs.readFileSync('assets/cesped-runtime.PNG');
const baseline = inspectPng(source, 'baseline');
assert.equal(baseline.width, 160);
assert.equal(baseline.height, 160);

function mustReject(name, mutate, pattern) {
  const copy = Buffer.from(source);
  const candidate = mutate(copy) || copy;
  assert.throws(() => inspectPng(candidate, name), pattern, `${name} mutation must be rejected`);
  console.log(`PNG_MUTATION_PASS ${name}`);
}

mustReject('bad-signature', copy => { copy[0] ^= 0xff; }, /signature/);
mustReject('truncated', copy => copy.subarray(0, copy.length - 1), /truncated|IEND/);

mustReject('bad-crc', copy => {
  let offset = 8;
  while (offset + 12 <= copy.length) {
    const length = copy.readUInt32BE(offset);
    const type = copy.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT' && length > 0) {
      copy[offset + 8] ^= 0x01;
      return;
    }
    offset += 12 + length;
  }
  throw new Error('test fixture has no IDAT payload');
}, /CRC mismatch/);

mustReject('invalid-interlace', copy => {
  copy[28] = 2;
  copy.writeUInt32BE(crc32(copy.subarray(12, 29)), 29);
}, /interlace/);

mustReject('trailing-data', copy => Buffer.concat([copy, Buffer.from([0])]), /trailing bytes/);

console.log(`PNG_MUTATION_OK baseline=${baseline.width}x${baseline.height} cases=5`);
