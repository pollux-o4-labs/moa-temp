# 모아 프론트엔드

커리어 공개용 모아 브라우저 프론트엔드입니다. 내부 운영 문서·서버 전용 코드·
비공개 Git 이력은 [TP-body](https://github.com/pollux-o4-labs/TP-body)에 두며,
이 저장소에는 공개 가능한 UI와 도메인·품질 코드만 둡니다.

## 개발

```sh
mise run install
mise run dev
```

검증은 `mise run check`로 실행합니다. Node.js와 Yarn 버전은 `mise.toml`과
`package.json`에 고정하고, Yarn Berry PnP cache는 커밋하지 않습니다.

로그인 전에는 브라우저 localStorage 초안을 사용하고, 로그인 후에는 Firebase
Authentication·Firestore Adapter로 계정별 계획을 저장합니다. 두 경로 모두
`PlanRepository` interface 뒤에 있으므로 UI·session·domain은 저장 구현을 알지 않습니다.

Firebase Web 설정은 `.env.example`을 복사해 로컬에 넣습니다. 서비스 계정 JSON,
private key, 토큰과 `.env` 파일은 커밋하지 않습니다. Firebase는 Authentication과
Firestore에만 사용하며, 배포는 GitHub Pages가 검증된 정적 산출물을 호스팅합니다.
GitHub Pages 배포에서는 `github-pages` Environment에 동일한 `VITE_FIREBASE_*` 웹 설정을
Actions Variables로 등록합니다. workflow는 이전 설정과의 호환을 위해 같은 이름의
Actions Secret도 fallback으로 읽지만, 서비스 계정·private key·토큰은 등록하지 않습니다.
프로젝트 Pages 주소의 base path는 workflow가 `configure-pages`에서 받아 build에 주입합니다.
로컬 에뮬레이터는 `mise exec -- yarn firebase:emulators`로 실행합니다.

## 저장소 경계

- 공개: UI, 브라우저 입력 Adapter, Plan domain/session, 공개 테스트·Firebase Rules
- 비공개: PRD·PMT·ADR 원본, 운영 메모, 서버 전용 코드와 관리자 자격증명

이 디렉터리는 비공개 `TP-body`에서 subtree로 export하는 공개 경계입니다. 공개 전
검사는 비공개 원본의 PMT ADR-003과 루트 품질 게이트를 따릅니다.
