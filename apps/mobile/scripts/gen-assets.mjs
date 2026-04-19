/**
 * 돌담 앱 아이콘/스플래시 플레이스홀더 생성
 * node scripts/gen-assets.mjs
 *
 * sharp 없이 순수 PNG 바이너리로 단색 이미지 생성.
 * 실제 출시 전 디자이너 제작 파일로 교체 필요.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { deflateSync } from 'zlib';

const BRAND = { r: 0xC4, g: 0x95, b: 0x6A }; // #C4956A
const BG    = { r: 0xFA, g: 0xF6, b: 0xF1 }; // #FAF6F1

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return ((crc ^ 0xFFFFFFFF) >>> 0);
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crcVal]);
}

function makePng(w, h, fill, centerColor) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  // Raw scanlines
  const scanline = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) {
    const cx = x * 3 + 1;
    if (centerColor) {
      const cx2 = w / 2, cy2 = h / 2;
      const r = Math.min(w, h) * 0.35;
      const dx = x - cx2;
      // Just use a gradient-like fill for center square
      const inCenter = Math.abs(dx) < r * 0.6;
      scanline[cx]   = inCenter ? centerColor.r : fill.r;
      scanline[cx+1] = inCenter ? centerColor.g : fill.g;
      scanline[cx+2] = inCenter ? centerColor.b : fill.b;
    } else {
      scanline[cx] = fill.r; scanline[cx+1] = fill.g; scanline[cx+2] = fill.b;
    }
  }

  const rows = [];
  for (let y = 0; y < h; y++) {
    if (centerColor) {
      const cy2 = h / 2;
      const r = Math.min(w, h) * 0.35;
      const dy = y - cy2;
      const inCenterRow = Math.abs(dy) < r;
      const row = Buffer.alloc(1 + w * 3);
      for (let x = 0; x < w; x++) {
        const dx = x - w / 2;
        const inCenter = Math.abs(dx) < r && inCenterRow;
        row[1 + x * 3]   = inCenter ? centerColor.r : fill.r;
        row[1 + x * 3+1] = inCenter ? centerColor.g : fill.g;
        row[1 + x * 3+2] = inCenter ? centerColor.b : fill.b;
      }
      rows.push(row);
    } else {
      rows.push(scanline);
    }
  }

  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG sig
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('assets', { recursive: true });

// icon.png 1024x1024 — 크림 배경에 브랜드 컬러 중앙 블록
writeFileSync('assets/icon.png', makePng(1024, 1024, BG, BRAND));
console.log('✓ assets/icon.png (1024x1024)');

// adaptive-icon.png 1024x1024
writeFileSync('assets/adaptive-icon.png', makePng(1024, 1024, BG, BRAND));
console.log('✓ assets/adaptive-icon.png (1024x1024)');

// splash.png 1284x2778 — 배경색만
writeFileSync('assets/splash.png', makePng(1284, 2778, BG, BRAND));
console.log('✓ assets/splash.png (1284x2778)');

console.log('\n이미지 생성 완료. 실제 출시 전 디자이너 제작 파일로 교체하세요.');
