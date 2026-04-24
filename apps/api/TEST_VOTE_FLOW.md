# 채팅방 유지/폭파 투표 테스트 방법

1. `wrangler.toml`의 `TEST_MODE = "true"`로 변경
2. `npx wrangler deploy`
3. 매칭으로 새 방 생성 (최소 6명 유저 필요, 없으면 수동으로 room_members INSERT)
4. 방 생성 후 5분 뒤 vote_deadline 도래
5. 마감 10분 전 → 불가능 (5분 모드라서 패스)
   마감 5분 전 → 불가능 (시작 시점과 동일)
   마감 1분 전 → 알림 전송
   마감 10초 전 → 클라이언트 카운트다운 오버레이
6. 마감 시 resolver cron이 결과 확정:
   - 폭파 1표 이상 → status='expired'
   - 유지 2표 이상 + 폭파 0 → expires_at 72h 연장 + 비투표자 제거
   - 그 외 → 폭파

테스트 끝나면 `TEST_MODE = "false"`로 되돌리기.
