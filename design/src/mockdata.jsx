// 목업 데이터 — API 구조 그대로 유지 (RN 포팅 시 api.get으로 교체)

const ME = {
  id: 'me',
  nickname: '따뜻한 고양이 #4821',
  gender: 'F',
  age_range: '30대 후반',
  region: '서울',
  verified: 1,
  points: 187,
  temp: 36.5,
  divorceYears: '이혼 2년차',
};

const REACTIONS = [
  { emoji: '💛', label: '공감돼요' },
  { emoji: '🫂', label: '안아줄게요' },
  { emoji: '💪', label: '힘내요' },
  { emoji: '😂', label: '웃겨요' },
];

const MOODS = [
  { e: '🌤️', label: '괜찮아요' },
  { e: '😔', label: '울적해요' },
  { e: '😤', label: '답답해요' },
  { e: '😭', label: '무너져요' },
  { e: '🔥', label: '열받아요' },
  { e: '🌱', label: '희망보여요' },
  { e: '😶', label: '멍해요' },
];

const CATEGORIES = [
  { id: 'all', label: '전체', color: '#8C7B6B' },
  { id: 'free', label: '자유톡', color: '#6BAF7B' },
  { id: 'heart', label: '속마음', color: '#D4728C' },
  { id: 'kids', label: '양육일기', color: '#5B8FC9' },
  { id: 'love', label: '연애/관계', color: '#C4956A' },
  { id: 'law', label: '법률/돈', color: '#8C7B6B' },
  { id: 'men', label: '남성방', color: '#5B8FC9' },
  { id: 'women', label: '여성방', color: '#D4728C' },
];

const HOT_TOPICS = [
  { rank: 1, title: '전 시댁 부모님 장례식, 가야 할까?', votes: 847, hot: true, pro: 73 },
  { rank: 2, title: '아이 면접일에 새 여친 데려가도 될까?', votes: 623, hot: false, pro: 31 },
  { rank: 3, title: '소개팅에서 이혼 사실 첫 만남에 말해야 할까?', votes: 512, hot: false, pro: 58 },
];

const BOARD_POSTS = [
  {
    id: 1, cat: 'heart', catLabel: '속마음', catColor: '#D4728C',
    nick: '따뜻한 고양이 #4821', gender: 'F', age: '30대 후반', time: '32분 전',
    title: '이혼 8개월차, 드디어 웃는 날이 더 많아졌다',
    body: '처음엔 매일 울었어요. 이혼서류에 도장 찍던 그 날이 아직도 생생한데... 어제 혼자 카페에서 책 읽다가 문득 웃고 있는 나를 발견했어요. 시간이 약이라더니 정말인가 봐요. 여러분도 언젠가는 괜찮아질 거예요.',
    reactions: { '💛': 89, '🫂': 45, '💪': 67, '😂': 0 },
    comments: 34, scrap: false,
  },
  {
    id: 2, cat: 'free', catLabel: '자유톡', catColor: '#6BAF7B',
    nick: '용감한 커피 #7203', gender: 'M', age: '40대 초반', time: '1시간 전',
    title: '혼자 제주도 여행 처음 가봤는데 생각보다 괜찮다',
    body: '3박 4일 혼자 왔는데 아무도 신경 안 쓰더라고요. 오히려 자유로워서 좋았어요. 돌싱 혼행 강추합니다. 다음엔 강릉 가려구요.',
    reactions: { '💛': 52, '🫂': 0, '💪': 28, '😂': 12 },
    comments: 18, scrap: true,
  },
  {
    id: 3, cat: 'kids', catLabel: '양육일기', catColor: '#5B8FC9',
    nick: '별빛 나무 #3156', gender: 'F', age: '30대 초반', time: '2시간 전',
    title: "아이가 '아빠는 왜 안 와?' 라고 물을 때",
    body: '매번 면접교섭일 끝나고 이 질문 들으면 가슴이 무너져요. 일곱 살 딸인데 이제 눈치도 보는 것 같고... 어떻게 대답하시나요? 상담받아봤지만 막상 집에 오면 또 답답해져요.',
    reactions: { '💛': 78, '🫂': 124, '💪': 56, '😂': 0 },
    comments: 67, scrap: false,
  },
  {
    id: 4, cat: 'law', catLabel: '법률/돈', catColor: '#8C7B6B',
    nick: '조용한 바람 #0912', gender: 'M', age: '40대 중반', time: '4시간 전',
    title: '양육비 3개월 밀렸는데 이행명령 신청 후기',
    body: '법원 이행명령 신청부터 실제 압류까지 제가 겪은 과정 공유합니다. 다들 포기하지 마세요.',
    reactions: { '💛': 34, '🫂': 18, '💪': 91, '😂': 0 },
    comments: 45, scrap: false,
  },
];

const CHAT_ROOMS = [
  {
    id: 1, name: '자유톡 방 #482', kind: 'normal',
    members: 7, max: 8, unread: 5,
    timeLeft_h: 61, // 2일 13시간
    lastMsg: '저도 같은 경험 있어요 ㅎㅎ',
    lastTime: '방금',
    ageRange: '30대 초 ~ 40대 초', regions: '서울, 경기',
    gender_mix: { M: 3, F: 4 },
  },
  {
    id: 2, name: '전 배우자 SNS 차단 논쟁', kind: 'themed',
    members: 8, max: 8, unread: 12,
    timeLeft_h: 31,
    lastMsg: '차단이 답이죠... 보면 마음만 어지러워요',
    lastTime: '3분 전',
    ageRange: '30대', regions: '전국',
    gender_mix: { M: 4, F: 4 },
  },
  {
    id: 3, name: '양육 고민방 #91', kind: 'normal',
    members: 6, max: 8, unread: 0,
    timeLeft_h: 22,
    lastMsg: '양육비 관련 판례 공유합니다',
    lastTime: '어제',
    ageRange: '30대 ~ 40대 중반', regions: '서울, 인천',
    gender_mix: { M: 2, F: 4 },
  },
];

const VOTES = [
  {
    id: 1, question: '전 시댁/처가 부모님 돌아가셨을 때 장례식 가야 할까?',
    description: '10년 결혼 생활. 이혼 후에도 연락 종종. 지금 부고 연락 받았다면?',
    pro: '가야 한다', con: '안 가도 된다',
    proPct: 73, total: 847, comments: 234, hot: true, userVoted: null,
    byGender: { M: { pro: 68 }, F: { pro: 77 } },
  },
  {
    id: 2, question: '아이 면접교섭일에 새 여자친구 데려가도 될까?',
    description: '아이 8살. 소개한다면 몇 달째부터가 적절할까?',
    pro: '괜찮다', con: '아직 이르다',
    proPct: 31, total: 623, comments: 187, hot: false, userVoted: null,
    byGender: { M: { pro: 42 }, F: { pro: 19 } },
  },
  {
    id: 3, question: '소개팅에서 이혼 사실 첫 만남에 말해야 할까?',
    description: '아이 있음 기준. 숨기는 건 기만일까, 전략일까?',
    pro: '첫 만남에 말한다', con: '좀 더 알고 말한다',
    proPct: 58, total: 512, comments: 156, hot: false, userVoted: null,
    byGender: { M: { pro: 52 }, F: { pro: 64 } },
  },
  {
    id: 4, question: '양육비 안 주는 전 배우자, 아이한테 솔직히 말해도 될까?',
    description: '아이 10살. 왜 생활이 빠듯한지 물어볼 때.',
    pro: '솔직히 말한다', con: '아이한테는 숨긴다',
    proPct: 44, total: 401, comments: 198, hot: true, userVoted: null,
    byGender: { M: { pro: 38 }, F: { pro: 49 } },
  },
];

const COMMENTS = [
  { id: 1, nick: '조용한 호수 #2284', gender: 'F', age: '40대 초반', time: '20분 전',
    body: '저도 8개월차예요. 혼자 밥 먹는 게 처음엔 그렇게 쓸쓸했는데 이젠 오히려 편해요. 같이 힘내요.',
    likes: 23, mine: false },
  { id: 2, nick: '용감한 바다 #0055', gender: 'M', age: '30대 후반', time: '15분 전',
    body: '시간이 약이라는 말 정말 싫었는데 진짜더라구요. 3년차 지나니까 이혼이 제 인생에 그렇게 큰 사건도 아니었구나 싶어요.',
    likes: 41, mine: false },
  { id: 3, nick: '따뜻한 고양이 #4821', gender: 'F', age: '30대 후반', time: '방금',
    body: '두 분 댓글 읽고 또 울컥했어요. 감사해요 🙏',
    likes: 5, mine: true },
];

const BADGES = [
  { e: '✓', label: '본인인증', color: '#6BAF7B', unlocked: true },
  { e: '🌱', label: '첫 글', color: '#C4956A', unlocked: true },
  { e: '💬', label: '100댓글', color: '#5B8FC9', unlocked: true },
  { e: '🔥', label: '핫글 주인', color: '#E85D4A', unlocked: false },
  { e: '🏆', label: '7일 연속', color: '#D4728C', unlocked: false },
];

Object.assign(window, {
  ME, REACTIONS, MOODS, CATEGORIES, HOT_TOPICS,
  BOARD_POSTS, CHAT_ROOMS, VOTES, COMMENTS, BADGES,
});
