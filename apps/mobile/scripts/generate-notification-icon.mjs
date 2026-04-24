import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../assets');

// 돌담 = 돌(stone) 3개 쌓은 심플 실루엣 (알림 영역용)
// 모든 픽셀 흰색, 배경 투명 (Android 시스템 요구사항)
function makeNotifSvg(size = 256) {
  const s = size;
  // 3개의 둥근 돌이 계단식으로 쌓인 모양
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 256 256">
    <g fill="#ffffff">
      <!-- 바닥돌 (넓고 낮음) -->
      <rect x="28" y="168" width="200" height="60" rx="24" />
      <!-- 중간돌 (중간 너비, 살짝 좌측) -->
      <rect x="52" y="98" width="136" height="60" rx="22" />
      <!-- 맨위돌 (작고 동그라미에 가까움) -->
      <rect x="92" y="36" width="80" height="58" rx="24" />
    </g>
  </svg>`;
}

async function main() {
  const svg = makeNotifSvg(256);
  await sharp(Buffer.from(svg))
    .resize(256, 256)
    .png()
    .toFile(resolve(assetsDir, 'notification-icon.png'));
  console.log('Generated notification-icon.png (256x256 monochrome)');
}

main().catch((e) => { console.error(e); process.exit(1); });
