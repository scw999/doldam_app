export const INTERESTS = [
  '맛집', '카페탐방', '요리', '베이킹',
  '등산', '자전거', '낚시', '캠핑',
  '독서', '전시', '영화', '드라마',
  '음악', '운동', '요가', '명상',
  '여행', '사진', '그림', '보드게임',
  '게임', '반려동물', '인테리어', '재테크',
] as const;

export type Interest = typeof INTERESTS[number];
