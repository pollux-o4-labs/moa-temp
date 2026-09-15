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

현재 공개 초기본은 Firebase Auth/Firestore Adapter를 연결하기 전에도 화면과 도메인
동작을 확인할 수 있도록 브라우저 localStorage Adapter를 사용합니다. 저장 경계는
`PlanRepository` interface 뒤에 있으므로 Google 로그인·Firestore 연결 시 공개 앱의
UI와 session·domain 코드를 바꾸지 않고 Adapter만 교체합니다.

Firebase Web 설정은 `.env.example`을 복사해 로컬에 넣습니다. 서비스 계정 JSON,
private key, 토큰과 `.env` 파일은 커밋하지 않습니다. Hosting 배포는 검증된 정적
산출물에만 `mise run deploy`를 실행합니다.

## 저장소 경계

- 공개: UI, 브라우저 입력 Adapter, Plan domain/session, 공개 테스트·Firebase Rules
- 비공개: PRD·PMT·ADR 원본, 운영 메모, 서버 전용 코드와 관리자 자격증명

분리 원칙과 공개 전 검사는 비공개 원본의 [PMT ADR-003](https://github.com/pollux-o4-labs/TP-body/blob/main/docs/PMT/ADR/ADR-003-public-frontend-private-body-repositories.md)에 기록합니다.
