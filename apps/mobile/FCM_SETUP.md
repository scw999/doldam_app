# Android FCM(푸시) 자격증명 설정 — 1회성

Expo SDK 51+는 Android 푸시 알림을 위해 **Firebase Cloud Messaging (FCM v1)** 자격증명이 필요합니다.
이 파일을 그대로 따라하면 됩니다. 한 번만 하면 돼요.

---

## 1. Firebase 프로젝트 준비

1. https://console.firebase.google.com 접속 (구글 계정 로그인)
2. **프로젝트 추가** → 이름: `doldam` (또는 아무거나) → 만들기
3. Google Analytics는 선택사항 (없어도 푸시는 동작)

---

## 2. Android 앱 등록 → google-services.json 다운로드

1. Firebase 콘솔 → 프로젝트 대시보드 → **Android 아이콘 클릭** (앱 추가)
2. **Android 패키지 이름**: `com.doldam.app` (정확히 이 값)
3. **앱 닉네임**: `돌담` (자유)
4. SHA-1은 지금 건너뛰어도 됨
5. **`google-services.json` 다운로드** 클릭
6. 다운로드한 파일을 이 경로로 복사:
   ```
   C:\Users\scw99\work\doldam\dev\apps\mobile\google-services.json
   ```
7. Firebase 콘솔 나머지 단계(gradle 설정 등)는 **무시하고 "다음" 눌러 완료** —
   Expo가 자동으로 처리함

---

## 3. FCM 서비스 계정 키 생성

1. Firebase 콘솔 → 좌상단 ⚙️ → **프로젝트 설정** → **서비스 계정** 탭
2. "Firebase Admin SDK" 섹션에서 **새 비공개 키 생성** 클릭
3. 경고 팝업 → "키 생성"
4. JSON 파일이 다운로드됨 (예: `doldam-firebase-adminsdk-xxxxx-xxxxxxxxxx.json`)
5. 이 파일은 PC 어디든 저장해둬요 (커밋 금지 — .gitignore로 차단됨)

---

## 4. EAS에 서비스 계정 업로드

터미널에서:

```bash
cd C:\Users\scw99\work\doldam\dev\apps\mobile
npx eas credentials
```

대화형 메뉴:
1. `Select platform` → **Android**
2. 프로필: **preview** (먼저) — 나중에 **production**도 동일하게 반복
3. `What do you want to do?` → **Google Service Account**
4. `Google Service Account Keys for Push Notifications (FCM V1)`
5. `Manage your Google Service Account Key for Push Notifications (FCM V1)`
6. **Add a new key** → 방금 다운받은 JSON 경로 입력 (또는 파일 선택)
7. 확인 → 저장

완료되면 `preview` 프로필에 FCM V1 키가 등록됩니다.
`production` 프로필에도 쓸 거면 2번만 다르게 해서 반복.

---

## 5. APK 재빌드

```bash
cd C:\Users\scw99\work\doldam\dev\apps\mobile
npx eas build --platform android --profile preview
```

빌드 완료 후 APK 재설치 → 앱 로그인 → 마이 → 알림 설정 → "🔎 진단 실행"
3단계가 모두 ✅이면 푸시 정상 작동.

---

## 체크리스트

- [ ] Firebase 프로젝트 만듦
- [ ] `google-services.json` → `apps/mobile/` 복사
- [ ] 서비스 계정 JSON 다운로드
- [ ] `eas credentials` 로 preview 프로필에 업로드
- [ ] APK 재빌드 + 재설치
- [ ] 진단 실행 통과

---

## 트러블슈팅

### "google-services.json not found" 빌드 에러
→ 파일 경로가 정확히 `apps/mobile/google-services.json`인지 확인

### 진단에서 "FirebaseApp is not initialized" 계속 뜸
→ `google-services.json`이 빌드에 포함됐는지 확인, eas credentials 업로드 재확인

### iOS도 푸시 필요
→ Apple APNs 인증서 필요. `eas credentials` → iOS → Push Notification Key 설정 (별도 가이드 필요)

---

## 주의
- `google-services.json`과 서비스 계정 JSON은 **절대 git commit 금지** (.gitignore로 막음)
- 서비스 계정 JSON 유출 = Firebase 프로젝트 전체 제어권 탈취 가능
