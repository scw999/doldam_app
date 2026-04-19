const ADJECTIVES = [
  '따뜻한', '조용한', '용감한', '솔직한', '단단한', '덤덤한', '성실한',
  '다정한', '차분한', '당당한', '느긋한', '단호한', '섬세한', '포근한',
];

const NOUNS = [
  '돌담', '등대', '바람', '새벽', '달빛', '오솔길', '벤치', '난로',
  '별빛', '구름', '파도', '언덕', '나루', '정원', '사슴', '우체통',
];

export function randomNickname(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${a}${n}${num}`;
}
