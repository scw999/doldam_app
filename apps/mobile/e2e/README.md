# Maestro E2E 테스트

돌담 모바일 앱의 end-to-end 스모크 테스트. [Maestro](https://maestro.mobile.dev/) 사용.

## 설치

### macOS / Linux
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### Windows (WSL 권장)
WSL2 + Android Studio 에뮬레이터 조합이 가장 안정적이다. 네이티브 Windows는 지원이 제한됨.
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

설치 후 `maestro --version` 으로 확인.

## 전제 조건

- Android 에뮬레이터 또는 연결된 실기기 (개발자 옵션 켜져 있어야 함)
- 돌담 앱이 설치되어 있어야 함 (`eas build` 또는 로컬 `expo run:android`)
- 앱 패키지명은 `com.doldam.app` (eas.json / app.json 기준)

## 실행

```bash
cd apps/mobile/e2e/maestro

# 신규 사용자 — 로그인 화면까지
maestro test login-and-browse.yaml

# 로그인된 사용자 — 탭 네비게이션 스모크
maestro test tab-navigation.yaml
```

전체 실행:
```bash
maestro test .
```

## 각 플로우가 검증하는 것

### `login-and-browse.yaml`
- 앱이 크래시 없이 실행되는지
- 로그인 화면이 올바르게 렌더링되는지 (타이틀/서브타이틀/CTA 노출)
- 전화번호 입력 필드가 동작하는지
- **멈추는 지점**: 실제 OTP 검증은 다날/NHN 외부 API 의존성 때문에 자동화하지 않음

### `tab-navigation.yaml`
- 5개 탭 (홈/게시판/투표/채팅/마이) 모두에 크래시 없이 진입 가능한지
- 각 탭에서 대표 텍스트가 렌더링되는지
- 탭 간 이동이 원활한지

## CI 연동

GitHub Actions 등에서 실행하려면 Maestro Cloud (`maestro cloud`) 사용을 권장. 에뮬레이터 프로비저닝이 내장됨.

```bash
maestro cloud --app-file=app.apk .
```
