# doldam_app — gh-pages 브랜치

이 브랜치는 GitHub Pages로 자동 배포되는 공개 사이트입니다.

URL: <https://scw999.github.io/doldam_app/>

## 구조

```
/                     → 랜딩 페이지
/legal/privacy/       → 개인정보 처리방침
/legal/terms/         → 이용약관
```

## 콘텐츠 수정 방법

`docs/legal/*.md` (main 브랜치)와 동일 내용을 유지해야 법적 일관성이 확보됩니다.
수정 시 다음 순서:

1. main 브랜치의 `docs/legal/*.md` 수정
2. 같은 변경을 `gh-pages` 브랜치의 `legal/*.md`에도 반영
3. push → 1~3분 후 GitHub Pages가 자동 재배포

워크트리 사용 예시:
```bash
git worktree add ../doldam-pages gh-pages
cd ../doldam-pages
# 편집
git commit -am "..."
git push
git worktree remove ../doldam-pages
```
