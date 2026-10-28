# Joker’s Mate · The Royal Garden

브라우저 2D 싱글플레이 프로토타입. 내장 컴퓨터와 체스·포커를 한 판으로 진행한다. 외부 AI API나 키는 필요하지 않다.

## 현재 게임

각자50G 예치 → 체스 → 마지막 판·결과 확인 → 생존5장과 공개 순서 확정 → 1/2/3장 공개마다 베팅 → 최종2장 공개 또는 폴드 → 한 번 정산. 체스 배당40G, 포커 배당60G와 유효 추가베팅. 체스무승부면100G 전부 포커로 이월. 최소잔액 보장 없음,50G 미만이면 파산.

## 설계 문서

01~14 문서가 현행 설계다. 규칙과 구현 상태를 구분한다.

- [통합 규칙](docs/02_GAME_RULES.md) · [카드](docs/03_CARD_SYSTEM.md) · [체스](docs/04_CHESS_SYSTEM.md)
- [포커](docs/05_POKER_SYSTEM.md) · [경제](docs/06_ECONOMY_SYSTEM.md) · [컴퓨터](docs/07_AI_DESIGN.md)
- [게임 흐름](docs/08_GAME_FLOW.md) · [화면](docs/09_UI_UX_SPEC.md) · [데이터](docs/11_DATA_MODEL.md)
- [미술 방향](docs/13_ART_DIRECTION.md) · [구현 현황과 남은 작업](docs/14_ROADMAP.md) · [미결 사항](docs/OPEN_QUESTIONS.md)

## 실행

Node.js 22.12 이상이 필요합니다(검증: 22.22.2).

```sh
npm ci
npm run build
npm run play
```

브라우저에서 [게임 열기](http://127.0.0.1:5173/)를 선택합니다. `play`는 터미널 작업과 분리된 로컬 서버를 시작합니다. 이미 실행 중이면 중복 실행하지 않습니다. 종료는 `npm run stop`입니다. 다른 프로그램이 5173을 사용하면 종료하거나 `JOKERS_PORT`로 별도 포트를 선택하세요. 포트가 달라지면 브라우저 저장 영역도 달라집니다.

macOS에서는 [START_GAME.command](START_GAME.command)를 실행해 설치 확인·빌드·시작을 한 번에 할 수 있습니다. Node가 설치되어 있어야 하며 최초 의존성 설치에는 네트워크가 필요합니다. 로컬 서버는 127.0.0.1에만 열립니다. 인터넷 공개 배포는 하지 않았습니다.

개발은 `npm run dev`, 검증은 `npm test`, 배포 파일 생성은 `npm run build`입니다. `dist/`와 `node_modules/`는 Git에 포함하지 않습니다.

## 저장과 중단

미완료 판을 닫거나 새로고침한 뒤 복귀하면 저장된 체스·카드 선택·포커 단계에서 이어한다. 이미 확정·저장한 정산은 보존한다. 저장은 브라우저·주소별 로컬 저장소이며 클라우드 동기화는 없다. 개발 검증 주소의 fixture는 테스트 데이터를 사용한다.

## 검증과 제공 상태

자동 테스트114개와 프로덕션 빌드가 통과했다. 소스 저장소는 [kkaengEminE/jokers-mate](https://github.com/kkaengEminE/jokers-mate)이며 비공개다. 외부 웹 공개·Steam·앱스토어 배포 및 도메인 구매는 완료되지 않았다.

## 아트 구현 범위

정원 배경과 체카드 시안·확대·idle은 구현되어 있다. 참고 이미지의 가로 발코니 구도, 체스 탑뷰, 손·상대 인물·중앙 석조 금화 받침과 최종 펜화 자산은 남아 있다. 현재 세로 배치 화면을 최종 완성 화면으로 보지 않는다.
