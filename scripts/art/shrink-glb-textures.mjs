// scripts/art/shrink-glb-textures.mjs
// Scales the embedded textures of UNPACKED .glb files down to at most <px> pixels a side and
// re-encodes them as WebP (sharp), rewriting the binary chunk; geometry, names and materials stay
// byte for byte. For battle art that a phone shows a few hundred pixels across (a civic hall's
// 2048 atlas set is 2 MB; at 1024 it is about a quarter). Run BEFORE npm run pack:models (a packed
// file's meshopt views are left alone: the script refuses it).
//   node scripts/art/shrink-glb-textures.mjs <px> <file.glb> [more.glb ...]
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const readGlb = (buf) => {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a binary glTF file');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
  return { json, bin };
};

const writeGlb = (json, bin) => {
  let jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12); const jh = Buffer.alloc(8); const bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + bin.length, 8);
  jh.writeUInt32LE(jsonBytes.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, jsonBytes, bh, bin]);
};

const shrink = async (file, px) => {
  const { json, bin } = readGlb(readFileSync(file));
  if ((json.extensionsUsed || []).includes('EXT_meshopt_compression')) throw new Error(`${file}: already packed, shrink before packing`);
  const normalImages = new Set((json.materials || []).map((m) => m.normalTexture?.index).filter((i) => i != null).map((t) => json.textures[t].source));
  const replace = new Map(); // bufferView -> new bytes
  for (const [i, img] of (json.images || []).entries()) {
    if (img.bufferView == null) continue;
    const v = json.bufferViews[img.bufferView];
    const src = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const meta = await sharp(src).metadata();
    if (Math.max(meta.width, meta.height) <= px) continue;
    const out = await sharp(src).resize(px, px, { fit: 'inside', kernel: 'lanczos3' })
      .webp(normalImages.has(i) ? { quality: 92 } : { quality: 85 }).toBuffer();
    replace.set(img.bufferView, out);
    img.mimeType = 'image/webp';
  }
  if (!replace.size) return null;
  const parts = []; let offset = 0;
  json.bufferViews.forEach((v, k) => {
    const bytes = replace.get(k) || bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); offset += pad; }
    v.byteOffset = offset; v.byteLength = bytes.length;
    parts.push(Buffer.from(bytes)); offset += bytes.length;
  });
  const padEnd = (4 - (offset % 4)) % 4;
  if (padEnd) { parts.push(Buffer.alloc(padEnd)); offset += padEnd; }
  json.buffers[0].byteLength = offset;
  const before = readFileSync(file).length;
  writeFileSync(file, writeGlb(json, Buffer.concat(parts)));
  return [before, readFileSync(file).length];
};

const [px, ...files] = process.argv.slice(2);
if (!Number(px) || !files.length) { console.log('usage: node scripts/art/shrink-glb-textures.mjs <px> <file.glb> ...'); process.exit(1); }
for (const f of files) {
  const r = await shrink(f, Number(px));
  console.log(r ? `${f}: ${(r[0] / 1e6).toFixed(2)} MB -> ${(r[1] / 1e6).toFixed(2)} MB` : `${f}: textures already at most ${px}`);
}
