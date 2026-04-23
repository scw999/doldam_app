# k6 부하 테스트

돌담 API의 기본 스모크 부하 테스트. [k6](https://k6.io/) 사용.

## 설치

### Windows
```powershell
winget install k6 --source winget
```
혹은 Chocolatey:
```powershell
choco install k6
```

### macOS
```bash
brew install k6
```

### Linux (Debian/Ubuntu)
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update && sudo apt install k6
```

설치 후 `k6 version` 으로 확인.

## 실행

### 기본 (운영 환경 대상)
```bash
cd apps/api/loadtest
k6 run smoke.js
```

기본 베이스 URL: `https://doldam-api.scw999.workers.dev`

### 다른 환경 대상 실행
```bash
# 로컬 wrangler dev (http://localhost:8787)
k6 run -e API_BASE=http://localhost:8787 smoke.js

# 스테이징 등
k6 run -e API_BASE=https://staging.doldam.example smoke.js
```

## 테스트 내용

- **VU**: 10 (동시 가상 사용자)
- **지속 시간**: 30초
- **엔드포인트**:
  - `GET /votes`
  - `GET /posts?category=all`
  - `GET /posts?category=all&sort=hot`
- **SLO 임계값**:
  - p95 응답 시간 < 800ms (실패 시 빌드 실패)
  - 실패율 < 1%

모두 비인증 GET이므로 토큰이 필요 없다. 캐시 레이어와 Cloudflare Workers 콜드 스타트 영향을 한눈에 본다.

## 리포트 내보내기

```bash
k6 run --out json=result.json smoke.js
# 혹은 JSON 요약만
k6 run --summary-export=summary.json smoke.js
```
