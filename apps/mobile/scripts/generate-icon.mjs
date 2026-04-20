/**
 * 돌담 앱 아이콘 생성 스크립트
 * 실행: node scripts/generate-icon.mjs
 * 필요: sharp (루트 node_modules에 이미 설치됨)
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../assets');

/**
 * 전통 돌담 벽 패턴 아이콘
 * 따뜻한 갈색 그라디언트 배경에 흰색 돌들이 교차 배열로 전체를 채움
 */
/**
 * 사고석담 (coursed ashlar) 패턴
 * 각 행마다 돌 너비가 불규칙하게 달라 자연스러운 석담 질감을 냄
 */
function makeBrickWallSvg(size = 1024) {
  const mortar = 11;
  const rx = 7;

  // 행 높이 + 행별 돌 너비 비율 (합계 = 1.0)
  const rowDefs = [
    { h: 105, ws: [0.30, 0.22, 0.35, 0.13] },
    { h: 88,  ws: [0.24, 0.38, 0.19, 0.19] },
    { h: 118, ws: [0.36, 0.26, 0.38] },
    { h: 93,  ws: [0.19, 0.28, 0.24, 0.29] },
    { h: 110, ws: [0.42, 0.22, 0.36] },
    { h: 85,  ws: [0.25, 0.19, 0.32, 0.24] },
    { h: 100, ws: [0.33, 0.37, 0.30] },
    { h: 115, ws: [0.20, 0.30, 0.26, 0.24] },
    { h: 92,  ws: [0.38, 0.22, 0.40] },
    { h: 108, ws: [0.24, 0.28, 0.22, 0.26] },
  ];

  const opacities = [0.95, 0.75, 0.88, 0.65, 0.92, 0.78, 0.85, 0.70, 0.90, 0.73, 0.82, 0.68];

  let rects = '';
  let y = 0;
  let opIdx = 0;

  for (const row of rowDefs) {
    if (y > size) break;
    const totalStoneW = size - (row.ws.length - 1) * mortar;
    let x = 0;
    for (let i = 0; i < row.ws.length; i++) {
      const w = Math.round(row.ws[i] * totalStoneW / row.ws.reduce((a, b) => a + b, 0) * row.ws.reduce((a, b) => a + b, 0));
      // 실제 돌 너비 = 비율 / 합계 * 총너비
      const sw = Math.round((row.ws[i] / 1.0) * totalStoneW);
      const op = opacities[opIdx % opacities.length];
      opIdx++;
      rects += `  <rect x="${x}" y="${y}" width="${sw}" height="${row.h}" rx="${rx}" fill="white" opacity="${op}"/>\n`;
      x += sw + mortar;
    }
    y += row.h + mortar;
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#C4956A"/>
      <stop offset="100%" stop-color="#7A4A18"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
${rects}</svg>`;
}

function makeSplashSvg(w = 1284, h = 2778) {
  const cx = w / 2;

  // 돌담 로고 비례
  const ls = 44;
  const lx = cx - 9 * ls;
  const r  = ls * 1.5;

  // 로고 전체 높이: 15*ls (viewBox 0→15 단위)
  // 텍스트 영역: 제목 fontSize + gap + 부제목 fontSize
  const titleSize = 118;
  const subSize   = 44;
  const logoH     = 15 * ls;            // 660
  const gap1      = 52;                  // 로고 → 제목
  const gap2      = 32;                  // 제목 → 부제목
  const totalH    = logoH + gap1 + titleSize + gap2 + subSize;
  const startY    = (h - totalH) / 2;   // 수직 중앙 정렬

  const ly        = startY;
  const titleY    = startY + logoH + gap1 + titleSize;   // 텍스트 baseline
  const subY      = titleY + gap2 + subSize;

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="#FAF6F1"/>

  <!-- 돌담 로고 (위에서 아래: capstone → 중간 돌 → 하단 두 돌) -->
  <circle cx="${lx + 9*ls}" cy="${ly + 2*ls}" r="${ls * 1.3}" fill="#C4956A" opacity="0.72"/>
  <rect x="${lx + 5.5*ls}" y="${ly + 4*ls}"  width="${7*ls}" height="${5*ls}" rx="${r}" fill="#C4956A" opacity="0.88"/>
  <rect x="${lx + 1*ls}"   y="${ly + 10*ls}" width="${7*ls}" height="${5*ls}" rx="${r}" fill="#C4956A" opacity="0.90"/>
  <rect x="${lx + 10*ls}"  y="${ly + 10*ls}" width="${7*ls}" height="${5*ls}" rx="${r}" fill="#C4956A" opacity="0.76"/>

  <!-- 앱 이름 -->
  <text x="${cx}" y="${titleY}"
    font-family="sans-serif" font-size="${titleSize}" font-weight="800"
    fill="#2C2420" text-anchor="middle" opacity="0.92">돌담</text>

  <!-- 서브타이틀 -->
  <text x="${cx}" y="${subY}"
    font-family="sans-serif" font-size="${subSize}" font-weight="500"
    fill="#8C7B6B" text-anchor="middle" letter-spacing="6">인증된 돌싱 커뮤니티</text>
</svg>`;
}

async function generate() {
  console.log('아이콘 생성 중...');

  const wallSvg = makeBrickWallSvg(1024);

  await sharp(Buffer.from(wallSvg))
    .resize(1024, 1024)
    .png()
    .toFile(resolve(assetsDir, 'icon.png'));
  console.log('✅ assets/icon.png 생성 완료');

  await sharp(Buffer.from(wallSvg))
    .resize(1024, 1024)
    .png()
    .toFile(resolve(assetsDir, 'adaptive-icon.png'));
  console.log('✅ assets/adaptive-icon.png 생성 완료');

  const splashSvg = makeSplashSvg(1284, 2778);
  await sharp(Buffer.from(splashSvg))
    .resize(1284, 2778)
    .png()
    .toFile(resolve(assetsDir, 'splash.png'));
  console.log('✅ assets/splash.png 생성 완료');

  console.log('\n완료! EAS 빌드로 앱에 반영하세요.');
}

generate().catch(console.error);
