# REPORT · Joker’s Gambit v0.2

- 체스→5장 선택→베팅→단일 정산→다음 판을 구현. 내장 초급 컴퓨터, 조커 평가,20골드 보호, 불균등 올인/폴드, 기록·업적·복구·반응형 화면 포함.
- 첫 수 뒤 멈춤 수정: 개발 서버 중단 시 필요 시점에 Worker 파일을 못 불러오는 의존성을 제거. 상대 로직은 초기 번들에서 실행하며 외부 AI/API 불필요.
- 검증: 자동 테스트72개, 타입 검사·프로덕션 빌드, 브라우저 응수·선택·올인·정산, 모바일 폭 검사. 상세는 docs/16_VALIDATION.md.
- 실행: npm ci → npm run build → npm run play, 또는 macOS START_GAME.command. 로컬 주소 http://127.0.0.1:5173/. 종료는 npm run stop.
- 문서:07~14를 구현 상태로 갱신,15 적용 규칙/기본값,16 검증 기록 추가. Phase1 보고서는 docs/PHASE_1_REPORT.md에 보존.
- 한계: 싱글플레이 프로토타입. 정식 캐릭터 아트·온라인 대전·Steam·전체 FIDE 청구 규칙은 범위 밖.
- 게시 대상: 개인 비공개 kkaengEminE/jokers-gambit. 작업 완료 후 회사 CLI 계정 cclss-9kiwoon 복원.

추가 반영: 체스 최종판 결과 확인→포커 이동, 정산 순손익·원장 표시, 다음 판 체스 시작 명시. 경제 개편(5/15 권고,10/10 대안)은 docs/17_ECONOMY_REDESIGN.md에서 분석했고 기존20G보장과 충돌하므로 선택 대기. 아직 돈 규칙을 변경하지 않았다.
