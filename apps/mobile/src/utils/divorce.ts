export interface DivorceTier {
  name: string;
  femaleName?: string;
  emoji: string;
  minMonths: number;
  maxMonths: number | null;
  period: string;
  description: string;
}

export const DIVORCE_TIERS: DivorceTier[] = [
  { name: '돌생아', emoji: '🌱', minMonths: 0,   maxMonths: 12,  period: '이혼 1년 미만', description: '이제 막 새 출발을 시작했어요' },
  { name: '돌린이', emoji: '🌿', minMonths: 12,  maxMonths: 36,  period: '이혼 1~3년',    description: '조금씩 적응 중이에요' },
  { name: '돌춘기', emoji: '🍃', minMonths: 36,  maxMonths: 72,  period: '이혼 3~6년',    description: '나만의 삶을 만들어가고 있어요' },
  { name: '돌른이', emoji: '🌲', minMonths: 72,  maxMonths: 120, period: '이혼 6~10년',   description: '경험으로 단단해졌어요' },
  { name: '돌버지', femaleName: '돌머니', emoji: '🏔️', minMonths: 120, maxMonths: null, period: '이혼 10년+', description: '이 길의 든든한 선배예요' },
];

export function getDivorceTitle(
  year: number | null,
  month: number | null,
  gender?: 'M' | 'F' | null,
): string | null {
  if (!year) return null;
  const now = new Date();
  const totalMonths = (now.getFullYear() - year) * 12 + (now.getMonth() + 1) - (month ?? 6);
  if (totalMonths < 0) return '이혼 예정';
  for (const tier of DIVORCE_TIERS) {
    if (totalMonths >= tier.minMonths && (tier.maxMonths === null || totalMonths < tier.maxMonths)) {
      const name = gender === 'F' && tier.femaleName ? tier.femaleName : tier.name;
      return `${tier.emoji} ${name}`;
    }
  }
  return null;
}
