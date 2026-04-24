export const POINTS = {
  DAILY_CAP: 500,
  EXPIRY_DAYS: 30,

  // 적립
  REWARD_MISSION_COMPLETE: 100,
  REWARD_POST_CREATE: 10,
  REWARD_VOTE_CAST: 2,
  REWARD_COMMENT: 5,

  // 소비
  COST_UNLOCK_PROFILE_ITEM: 30,
  COST_REVIVE_ROOM: 200,
} as const;

export const ROOM = {
  MIN_MEMBERS: 6,
  MAX_MEMBERS: 8,
  LIFESPAN_HOURS: 72,       // 3일 자동 폭파
  KEEP_VOTE_THRESHOLD: 0.6, // 60% 찬성 시 유지
} as const;

export const MISSION = {
  QUESTIONS_PER_ROUND: 10,
  ROUND_DAYS: 3,
} as const;

export const CATEGORIES = [
  'free', 'heart', 'kids', 'dating', 'legal', 'remarriage', 'men_only', 'women_only',
] as const;

export type Category = typeof CATEGORIES[number];
