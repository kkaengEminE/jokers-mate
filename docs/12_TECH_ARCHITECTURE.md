# 12 · 기술 구조

## 구성

React19 + TypeScript + Vite6, chess.js1.4를 사용한다. lockfile로 실제 의존성을 고정한다. Vitest5로 규칙과 회귀 사례를 검증한다. API 서버나 외부 AI SDK는 없다.

- `src/main.tsx`: 화면, 입력, 로컬 저장, 비동기 컴퓨터 작업 생명주기.
- `src/engine.ts`: 배정, 수 적용, 종료, 베팅 상태 전이, 정산, 제한된 컴퓨터 입력·탐색.
- `src/poker.ts`: 자연 패 비교, 조커 치환, 최적5장 선택과 분할 실행.
- `src/persistence.ts`: 저장 검증/복구.
- `src/style.css`: 반응형 정원 테이블과 연출.
- `src/fixtures.ts`: 개발 전용 QA 상태, 프로덕션 빌드에서 제외.
- `scripts/serve.mjs`, `start.mjs`, `stop.mjs`: Node 표준 라이브러리 기반 로컬 실행·종료.

## 실행 안정성

초기에는 별도 Worker를 필요할 때 로드했으나 첫 수 뒤 파일 로딩 실패로 진행이 막힐 수 있었다. 현재는 계산 코드를 초기 번들에 포함한다. 체스는 지연된 로컬 작업으로 실행하고, 포커는 탐색 중 주기적으로 화면에 제어를 반환한다. 외부 요청 없이도 연산한다.

`npm run play`는 빌드 산출물을 계속 제공하는 로컬 프로세스를 띄운다. 개발용 HMR 연결에 의존하지 않는다. 서버는 루프백만 사용하며 소스·환경 파일을 제공하지 않는다. 정적 파일은 no-cache로 갱신하고 경로가 dist 밖으로 나가면 거절한다.

## 검증과 제약

자동 테스트, TypeScript 검사, 프로덕션 빌드, 브라우저 조작을 수행한다. 자세한 결과는16 문서. 서버 간 동기화·인증·결제·온라인 멀티플레이·Steam 포장은 없으며 가상 골드만 다룬다. 라이브러리 근거: [chess.js 공식 문서](https://github.com/jhlywa/chess.js/blob/master/website/docs/index.md).
