# 돌담 홈페이지 (homepage/)

`doldam.app`에 배포되는 정적 마케팅 사이트.

## 구조

```
homepage/
├── index.html              랜딩 (Hero, 4가지 약속, 기능 6개, 안전, FAQ)
├── style.css               공통 스타일 (앱 디자인 토큰 적용)
├── legal/
│   ├── privacy.html        개인정보 처리방침
│   └── terms.html          이용약관
└── img/                    ASO 이미지 (01_hook ~ 06_rebuild + contact)
```

## 로컬 확인

빌드 단계 없음. 정적 파일이라 다음 중 어느 거든 OK:

```powershell
# 옵션 1: Python http.server
cd homepage
python -m http.server 8000
# → http://localhost:8000

# 옵션 2: VS Code Live Server 확장
# index.html 우클릭 → "Open with Live Server"
```

## 배포 — Cloudflare Pages

1. `dash.cloudflare.com` → Workers & Pages → Create application → Pages → Connect to Git
2. `scw999/doldam_app` 저장소 선택
3. 빌드 설정:
   - Production branch: `main`
   - Build command: (비움)
   - Build output directory: `homepage`
   - Root directory: (비움 또는 `/`)
4. Save and Deploy
5. 빌드 완료 후 Custom domains → `doldam.app` 추가

## 콘텐츠 수정 시 동기화 필수

법적 일관성을 위해 다음 3곳의 내용이 항상 동일해야 합니다:

| 위치 | 형식 | 용도 |
|---|---|---|
| `homepage/legal/*.html` | HTML | 외부 공개 (스토어 등록 URL) |
| `docs/legal/*.md` | Markdown | 마스터 문서 (편집의 기준) |
| `apps/mobile/src/legal/content.ts` | TS | 앱 내 표시 |

수정 시 셋 다 갱신하세요.
