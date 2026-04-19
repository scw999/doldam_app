// 투표 공유카드 SVG 생성 — 1080x1350 (세로형 소셜 최적)
// 파일 저장 없이 응답에서 바로 스트리밍.

interface CardInput {
  question: string;
  agree: number;      // 0~100
  disagree: number;   // 0~100
  total: number;
}

const BG = '#FAF6F1';
const PRIMARY = '#C4956A';
const TEXT = '#2C2420';
const SUB = '#8C7B6B';
const AGREE = '#C4956A';
const DIS = '#8C7B6B';

export function buildVoteCardSvg(input: CardInput): string {
  const { question, agree, disagree, total } = input;
  const wrapped = wrapKo(question, 18);
  const lines = wrapped.map((line, i) =>
    `<text x="540" y="${420 + i * 72}" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="58" font-weight="700" fill="${TEXT}">${escape(line)}</text>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="${BG}"/>

  <text x="540" y="180" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="42" font-weight="600" fill="${PRIMARY}">돌싱 딜레마</text>
  <line x1="440" y1="220" x2="640" y2="220" stroke="${PRIMARY}" stroke-width="3"/>

  ${lines}

  <g transform="translate(140, 820)">
    <rect x="0" y="0" width="380" height="280" rx="24" fill="${AGREE}"/>
    <text x="190" y="110" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="48" font-weight="700" fill="#fff">찬성</text>
    <text x="190" y="210" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="120" font-weight="800" fill="#fff">${agree}%</text>
  </g>

  <g transform="translate(560, 820)">
    <rect x="0" y="0" width="380" height="280" rx="24" fill="${DIS}"/>
    <text x="190" y="110" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="48" font-weight="700" fill="#fff">반대</text>
    <text x="190" y="210" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="120" font-weight="800" fill="#fff">${disagree}%</text>
  </g>

  <text x="540" y="1180" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="32" fill="${SUB}">총 ${total}명 참여</text>
  <text x="540" y="1260" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="28" fill="${SUB}">돌담 · 인증된 돌싱의 공간</text>
</svg>`;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 한글 글자 단위로 줄바꿈(간이). maxChars = 한 줄 최대 글자수
function wrapKo(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}
