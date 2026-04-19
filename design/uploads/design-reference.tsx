// 돌담 초기 디자인 레퍼런스 (2026-04-18)
// 사용자가 Claude 웹에서 받아온 단일 파일 전체 앱 프로토타입.
// 화면별 RN 포팅 시 비주얼 베이스라인으로 사용.
// 이 파일은 실행되지 않음 — 참고용.

import { useState } from "react";

const COLORS = {
  bg: "#FAF6F1",
  card: "#FFFFFF",
  primary: "#C4956A",
  primaryDark: "#A07850",
  accent: "#E8D5C0",
  text: "#2C2420",
  textSub: "#8C7B6B",
  textLight: "#B5A494",
  border: "#EDE4DA",
  tabBg: "#FFFFFF",
  tabActive: "#C4956A",
  tabInactive: "#C0B5A8",
  badge: "#E85D4A",
  votePro: "#5B9BD5",
  voteCon: "#E07B6B",
  male: "#5B8FC9",
  female: "#D4728C",
  tag: "#F5EDE4",
  green: "#6BAF7B",
};

const TABS = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "board", label: "게시판", icon: "📋" },
  { id: "vote", label: "투표", icon: "⚖️" },
  { id: "chat", label: "채팅", icon: "💬" },
  { id: "my", label: "마이", icon: "👤" },
];

const REACTIONS = [
  { emoji: "💛", label: "공감돼요" },
  { emoji: "🫂", label: "안아줄게요" },
  { emoji: "💪", label: "힘내요" },
  { emoji: "😂", label: "웃겨요" },
];

const hotTopics = [
  { title: "전 시댁 부모님 장례식, 가야 할까?", votes: 847, hot: true },
  { title: "아이 면접일에 새 여친 데려가도 될까?", votes: 623 },
  { title: "소개팅에서 돌싱 사실 첫 만남에 말해야 할까?", votes: 512 },
];

const boardPosts = [
  { id: 1, cat: "속마음", catColor: "#D4728C", nick: "따뜻한 고양이 #4821", time: "32분 전",
    title: "이혼 8개월차, 드디어 웃는 날이 더 많아졌다",
    body: "처음엔 매일 울었는데... 어제 혼자 카페에서 책 읽다가 문득 웃고 있는 나를 발견했어요. 시간이 약이라더니 정말인가 봐요.",
    reactions: { "💛": 89, "🫂": 45, "💪": 67 }, comments: 34 },
  { id: 2, cat: "자유톡", catColor: "#6BAF7B", nick: "용감한 커피 #7203", time: "1시간 전",
    title: "혼자 여행 처음 가봤는데 생각보다 괜찮다",
    body: "제주도 혼자 왔는데 아무도 신경 안 쓰더라고요. 오히려 자유로워서 좋았어요. 돌싱 여행 강추합니다.",
    reactions: { "💛": 52, "😂": 12, "💪": 28 }, comments: 18 },
  { id: 3, cat: "양육일기", catColor: "#5B8FC9", nick: "별빛 나무 #3156", time: "2시간 전",
    title: "아이가 '아빠는 왜 안 와?' 라고 물을 때",
    body: "매번 면접교섭일 끝나고 이 질문 들으면 가슴이 무너져요. 어떻게 대답하시나요...",
    reactions: { "🫂": 124, "💛": 78, "💪": 56 }, comments: 67 },
];

const chatRooms = [
  { id: 1, name: "자유톡 #482", members: 7, timeLeft: "2일 13시간",
    lastMsg: "저도 같은 경험 있어요 ㅎㅎ", unread: 5, ageRange: "30대 초~40대 초",
    regions: "서울, 경기", isTheme: false },
  { id: 2, name: "🔥 핫토픽: 전 배우자 SNS 차단 논쟁", members: 8, timeLeft: "1일 7시간",
    lastMsg: "차단이 답이죠...", unread: 12, ageRange: "30대",
    regions: "전국", isTheme: true },
  { id: 3, name: "양육 고민방 #91", members: 6, timeLeft: "22시간",
    lastMsg: "양육비 관련 판례 공유합니다", unread: 0, ageRange: "30대~40대 중반",
    regions: "서울, 인천", isTheme: false },
];

const voteData = [
  { id: 1, question: "전 시댁/처가 부모님 돌아가셨을 때 장례식 가야 할까?",
    pro: "가야 한다", con: "안 가도 된다",
    proPercent: 73, totalVotes: 847, comments: 234, hot: true, userVoted: null },
  { id: 2, question: "아이 면접교섭일에 새 여자친구 데려가도 될까?",
    pro: "괜찮다", con: "아직 이르다",
    proPercent: 31, totalVotes: 623, comments: 187, hot: false, userVoted: null },
  { id: 3, question: "소개팅에서 이혼 사실 첫 만남에 말해야 할까?",
    pro: "첫 만남에 말한다", con: "좀 더 알고 말한다",
    proPercent: 58, totalVotes: 512, comments: 156, hot: false, userVoted: null },
  { id: 4, question: "양육비 안 주는 전 남편, 아이한테 솔직히 말해도 될까?",
    pro: "솔직히 말한다", con: "아이한테는 숨긴다",
    proPercent: 44, totalVotes: 401, comments: 198, hot: true, userVoted: null },
];

// (스크린 컴포넌트들은 원본 파일 참조 — 필요시 사용자가 전체 전달)

export default function App() {
  // 전체 구현은 사용자 첨부 원본 참고
  return null;
}
