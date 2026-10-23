# 12 · 기술 구조

## 구성

React 19 + TypeScript + Vite 6, chess.js 1.4. lockfile로 의존성을 고정한다. Vitest로 규칙과 회귀 사례를 검증한다. API 서버나 외부 AI SDK는 없다. 패키지 이름은 `jokers-mate`.

- `src/main.tsx`: 화면, 입력, 로컬 저장, 비동기 컴퓨터 작업 생명주기.
- `src/engine.ts`: 카드 배정, 수 적용, 종료 판정, 베팅 상태 전이, 정산, 컴퓨터 입력 제한·탐색.
- `src/poker.ts`: 패 비교, 조커 치환, 최적 5장 선택과 분할 실행.
- `src/campaign.ts`: 로언/황제, 다음 판, 파산·엔딩, 도주 정산.
- `src/persistence.ts`: 저장 검증/복구.
- `src/style.css`: 정원 테이블과 연출.
- `src/fixtures.ts`: 개발 전용 QA 상태. 프로덕션 빌드에서 제외.
- `scripts/serve.mjs`, `start.mjs`, `stop.mjs`: Node 표준 라이브러리 기반 로컬 실행·종료.
- `scripts/design/verify_r3_economy.py`: 정산 설계 원장 검증, 결과를 `docs/23_R3_VERIFICATION.json`에 기록.

## 실행

- 컴퓨터 상대 계산은 초기 번들에 포함한다. 체스는 지연된 로컬 작업으로, 포커는 탐색 중 주기적으로 화면에 제어를 돌려주며 실행한다. 외부 요청 없이 동작한다.
- `npm run play`는 빌드 결과를 제공하는 로컬 서버를 띄운다. 개발용 HMR에 의존하지 않는다. 루프백(127.0.0.1)만 사용하고, 소스·환경 파일은 제공하지 않으며, dist 밖 경로 요청은 거절한다. 정적 파일은 no-cache.
- 금액은 JS 안전 정수 범위에서 다루며 32비트 비트 연산을 쓰지 않는다(황제 금고 21억).

## 검증 방식

자동 테스트, TypeScript 검사, 프로덕션 빌드, 브라우저 조작으로 확인한다.

## 범위 밖

서버 동기화, 인증, 결제, 온라인 멀티플레이, Steam 패키징. 가상 금화만 다룬다. 참고: [chess.js 문서](https://github.com/jhlywa/chess.js/blob/master/website/docs/index.md).
