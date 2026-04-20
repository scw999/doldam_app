/**
 * 돌담 앱 아이콘 생성 스크립트
 * 실행: node scripts/generate-icon.mjs
 * 필요: sharp (루트 node_modules에 이미 설치됨)
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../assets');

// DoldamLogo 디자인 (BrandBar와 동일한 SVG 로직)
// 원본 viewBox: 0 0 18 16
// scale=44, translate=(116, 200) → 792x704 → 1024x1024 중앙
// 하단 두 돌, 중간 한 돌, 상단 원형 capstone

function makeDoldamSvg(size = 1024, withText = true) {
  // DoldamLogo 원본 viewBox: 0 0 18 16
  // 로고가 아이콘 높이의 ~62% 차지하도록 스케일
  const ls = size * 0.038; // 1024 → ls=38.9 → 로고 높이 ≈ 15*ls = 583px
  const cx = size / 2;
  const lx = cx - 9 * ls;       // x 기준점 (왼쪽)
  const ly = size * 0.115;       // y 기준점 (위쪽 여백)
  const r  = ls * 1.5;           // border-radius

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0%" stop-color="#C9A07A"/>
      <stop offset="100%" stop-color="#9A6535"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" rx="${size * 0.18}"/>

  <!-- 하단 왼쪽 돌 -->
  <rect x="${lx + 1*ls}"   y="${ly + 10*ls}" width="${7*ls}" height="${5*ls}" rx="${r}" fill="white" opacity="0.95"/>
  <!-- 하단 오른쪽 돌 -->
  <rect x="${lx + 10*ls}"  y="${ly + 10*ls}" width="${7*ls}" height="${5*ls}" rx="${r}" fill="white" opacity="0.90"/>
  <!-- 중간 돌 -->
  <rect x="${lx + 5.5*ls}" y="${ly + 4*ls}"  width="${7*ls}" height="${5*ls}" rx="${r}" fill="white" opacity="0.97"/>
  <!-- 상단 capstone 원 -->
  <circle cx="${lx + 9*ls}" cy="${ly + 2*ls}" r="${ls * 1.3}" fill="white" opacity="0.88"/>
  ${withText ? `<!-- doldam 텍스트 -->
  <text x="${cx}" y="${size * 0.95}"
    font-family="sans-serif" font-size="${Math.round(size * 0.085)}" font-weight="700"
    fill="rgba(255,255,255,0.75)" text-anchor="middle" letter-spacing="4">doldam</text>` : ''}
</svg>`;
}

const iconSvg = makeDoldamSvg(1024, true);
const adaptiveSvg = makeDoldamSvg(1024, false);

async function generate() {
  console.log('아이콘 생성 중...');

  // 메인 아이콘 (1024x1024)
  await sharp(Buffer.from(iconSvg))
    .resize(1024, 1024)
    .png()
    .toFile(resolve(assetsDir, 'icon.png'));
  console.log('✅ assets/icon.png 생성 완료');

  // adaptive icon foreground (1024x1024, 배경 투명)
  await sharp(Buffer.from(adaptiveSvg))
    .resize(1024, 1024)
    .png()
    .toFile(resolve(assetsDir, 'adaptive-icon.png'));
  console.log('✅ assets/adaptive-icon.png 생성 완료');

  // splash 배경색은 그대로 두고 로고만 작게 중앙에
  const splashSvg = `<svg width="1284" height="2778" viewBox="0 0 1284 2778" xmlns="http://www.w3.org/2000/svg">
    <rect width="1284" height="2778" fill="#FAF6F1"/>
    <!-- 중앙 로고 -->
    <rect x="432" y="1189" width="420" height="400" rx="70" fill="#C4956A"/>
    <!-- 미니 돌담 -->
    <rect x="462" y="1360" width="140" height="56" rx="11" fill="rgba(255,255,255,0.85)"/>
    <rect x="618" y="1360" width="100" height="56" rx="11" fill="rgba(255,255,255,0.70)"/>
    <rect x="734" y="1360" width="88" height="56" rx="11" fill="rgba(255,255,255,0.85)"/>
    <rect x="462" y="1296" width="90" height="52" rx="10" fill="rgba(255,255,255,0.70)"/>
    <rect x="568" y="1296" width="130" height="52" rx="10" fill="rgba(255,255,255,0.85)"/>
    <rect x="714" y="1296" width="108" height="52" rx="10" fill="rgba(255,255,255,0.70)"/>
    <!-- 텍스트 -->
    <text x="642" y="1259"
      font-family="sans-serif" font-size="72" font-weight="800"
      fill="white" text-anchor="middle" opacity="0.95">돌담</text>
    <!-- 서브 -->
    <text x="642" y="1650"
      font-family="sans-serif" font-size="36" font-weight="500"
      fill="#8C7B6B" text-anchor="middle" letter-spacing="3">인증된 돌싱 커뮤니티</text>
  </svg>`;

  await sharp(Buffer.from(splashSvg))
    .resize(1284, 2778)
    .png()
    .toFile(resolve(assetsDir, 'splash.png'));
  console.log('✅ assets/splash.png 생성 완료');

  console.log('\n완료! EAS 빌드로 앱에 반영하세요.');
}

generate().catch(console.error);
