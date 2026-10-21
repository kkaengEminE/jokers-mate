# 11 · 데이터 모델 v2

## 주요 타입

| 타입 | 내용 |
|---|---|
| Card | 고유 실물id, rank, suit. 조커는 J1/J2 |
| Game | version2, id, round, phase, SAN moves, square→Card 매핑, 캡처 카드, banks, committed, 결과·선택 패·베팅·정산·업적 |
| Betting | turn, acted, lastRaise, raiseLocked, done, folded, 행동 로그 |
| Settlement | final, returned, award, protection, pot |
| RecordEntry | 날짜·판·결과·PGN·공개 카드·업적·정산 |

색 `w`는 플레이어, `b`는 컴퓨터다. `banks`는 참가금 이전 잔액이며 진행 중 금고는 `banks−committed`다. `identities`는 생존 칸만 보유하고 캡처 시 제거한다. chess.js 상태는 SAN 수순을 재생하여 재구성하므로 반복 이력을 잃지 않는다.

## 복구 검증

버전, 수순 합법성, 생존 칸과 카드 수, 총32장 고유 카드, 정규 덱 정체성, 정수 원장과 총량, 생존 패 자격, 상태별 결과 유무, 체스 종료 결과, 정산 수식의 일치를 검사한다. 깨진 상태는 부분 복구하지 않는다. 원본을 recovery 키에 보관할 수 있을 때 보관하고 새 세션을 시작한다.

정산된 판은 추가 행동을 거절한다. 완료 기록은 같은 판id로 한 번만 추가한다. 공개 기록에는 폴드 패를 넣지 않지만 진행 저장은 완전한 로컬 상태다. 이 구조는 싱글플레이용이며 다중 탭 동시 플레이·서버 권위 판정·치트 방지는 범위 밖이다.
