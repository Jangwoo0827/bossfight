# Changelog

The in-game version of this list is under **PATCH NOTES** on the main menu (`js/data/patchNotes.js`).

## v1.10.0 — Harder Hunts

### NEW
- 모든 보스 공통 신규 패턴 3종 — 조준 부채꼴 연사 · 위치 예측 폭격 · 십자 레이저(2페이즈부터)

### CHANGED
- 보스 체력 약 +35% (최종 보스 2200 → 2950)
- 보스 공격 사이 휴식 시간 20% 감소
- 진행할수록 보스가 단단해지는 폭 증가

## v1.9.0 — Constellations

### NEW
- SOUL TREE — 영구 강화가 별자리 모양 스킬 트리로 (77노드 · 5갈래, 가지를 따라 해금). 기존 강화는 그대로 반영
- 보스 3종 추가 (총 15종) — BROOD MOTHER(잡몹 소환) · PHANTOM LANCER(돌진 + 잔상 벽) · GRAVITY SAGE(중력 우물)
- 새 보스 전용 엘리트 패턴 · 아레나 · 배경음악

## v1.8.1 — Riposte

### CHANGED
- PARRY 강화 — 회복 8 → 15, 보스에게 공격력 250% 반격 피해, 보스 1초 기절 (같은 보스는 4초간 재기절 불가)

## v1.8.0 — Gauntlet

### NEW
- BOSS RUSH 모드 — 12마리 연속 · 업그레이드 없음 · 영구 강화 미적용 순수 실력 타임어택 (이어하기 지원)
- 로컬 리더보드 — 난이도별 + BOSS RUSH TOP 10 (RECORDS → LEADERBOARD), 결과 화면에 NEW RECORD 표시
- 결과 COPY RESULT — "🟩🟩🟩💀⬜ 3/5 · 6:32" 형태로 결과를 복사해 공유
- 앱처럼 설치 (PWA) — 휴대폰 홈 화면에 추가, 한 번 접속하면 오프라인 플레이
- 업적 추가: Gauntlet (BOSS RUSH 클리어)

### CHANGED
- 메인 메뉴 · 튜토리얼 · 캐릭터 설명 · 업그레이드 · 유물 설명의 Q / E / SPACE 표기가 키 설정을 따른다
- 자동 테스트에 화면 레이아웃 검사 추가 (모든 화면이 넓은 글꼴에서도 화면 안에 들어오는지)

### FIXED
- 빌드가 매우 클 때 일시정지 화면의 버튼이 화면 밖으로 밀리던 문제

## v1.7.1 — Shop Fix

### FIXED
- SOUL 상점에서 업그레이드가 많아 BACK 버튼이 화면 밖으로 잘리던 문제 — 목록이 스크롤되고 BACK은 항상 보인다
- 구매 후에도 스크롤 위치 유지

## v1.7.0 — Deeper Roots

### NEW
- SOUL 영구 강화 8종 추가 (총 18종) — Lethality · Muscle Memory · Quickcast · Parry Instinct · Second Breath · Rare Finds · Guardian Spirit · Relic Hunter
- RUN 업그레이드 8종 추가 (총 41종) — Wide Reach · Adrenaline · Quick Step · Reaper · Focused Mind · Amplify · Bounty Hunter · Last Stand
- 자동 테스트: 모든 영구 강화가 저장 → 새로고침 후 유지되는지, 모든 RUN 업그레이드 · 유물이 이어하기 후 똑같은지 매번 검사

### CHANGED
- SOUL 상점 5열 배치

## v1.6.2 — Key Labels

### CHANGED
- HUD 스킬 원의 키 표시가 키 설정을 따라 바뀐다 (게임패드 사용 중에는 A / X / B)
- 화면 하단 조작 안내도 바뀐 키로 표시

## v1.6.1 — Real Sound

### NEW
- 실제 효과음 36종 — 타격 · 베기 · 대시 · 폭발 · 피격 · 버튼 등 (Kenney, CC0)
- PARRY 전용 효과음 (종소리)
- 같은 소리도 변형과 음높이를 바꿔가며 재생해 반복감 감소

### CHANGED
- 파일을 불러올 수 없는 환경(file:// 실행, 구형 Safari)에서는 기존 합성 효과음으로 자동 대체

## v1.6.0 — Fair Fights

### FIXED
- 전 보스 회피 가능성 점검 — 피할 수 없던 패턴 5개 수정
- Frost Witch 얼음 길: 안전한 줄이 너무 멀리 생기던 문제 (항상 닿을 수 있는 거리로)
- Storm Caller 내려찍기: 원을 피한 직후 고리를 피할 수 없던 문제 (고리에 빈틈 + 시차)
- Clockwork Warden 진자: 사거리 440 → 340 (아레나 높이보다 길어 물러설 수 없던 문제)
- Void Hunter 2페이즈 순간이동 베기: 예고 0.55초 → 0.65초
- Dire Alpha 광란 돌진: 연속 돌진 예고 0.36초 → 0.42초

### NEW
- 4번째 캐릭터 ARCANIST — 유도 마법탄 · Arcane Bomb · Blink (아무 난이도 1회 클리어로 해금)
- 엘리트 전용 패턴 — 중간 보스 10종마다 엘리트일 때만 쓰는 공격 1개씩
- 키 설정 변경 (설정 → Controls)
- 색약 모드 — 모든 위험 예고를 고대비 주황색 + 굵은 테두리로
- 번쩍임 줄이기 · 데미지 숫자 크기(S/M/L)
- tests.html — 모든 보스·모드·저장을 자동 검사 (?audit=1로 회피 가능성 점검)

## v1.5.1 — Golem Fix

### FIXED
- Stone Golem 2페이즈 충격파 2연타를 피할 수 없던 문제 — 대시 쿨다운(1.2초)보다 고리 간격(0.6초)이 짧았다

### CHANGED
- Stone Golem: 두 번째 충격파 고리에 플레이어 방향으로 빈틈이 생긴다 — 빈틈에 서 있거나 걸어가서 피한다
- Stone Golem: 충격파 고리 간격 0.6초 → 1.0초

## v1.5.0 — Daily Hunts

### NEW
- DAILY CHALLENGE — 매일 모두가 같은 보스 순서 · 보상 · 유물 · 변이로 도전, 오늘의 최고 기록 저장
- 변이(Modifier) 7종 — RUN 시작 전 위험을 걸고 SOUL 보너스 획득
- 엘리트 보스 — 12% 확률로 등장 (체력 +30%, 더 빠름, SOUL ×1.5)
- 보스 처치 킬캠 — 마지막 일격에 줌 + 레터박스, 보스 색깔 사망 연출
- 보스 등장 대사
- 저장 코드 EXPORT / IMPORT — 다른 기기·브라우저로 진행 상황 옮기기
- 결과 화면 SAVE IMAGE — 결과 카드를 이미지로 저장해 공유
- 링크 공유 시 미리보기 카드(OG 이미지) · 파비콘

### CHANGED
- 메인 메뉴의 "FIVE BOSSES" 문구 삭제 (보스가 12종이 되었으므로)
- 효과음에 약간의 음높이 변화를 줘 반복감 감소

## v1.4.1 — Save Fixes

### NEW
- RUN 자동 저장 — 게임을 닫아도 메인 메뉴의 CONTINUE로 이어하기
- 저장 시점: 보스전 시작 · 보상 화면 · 다음 보스 선택 (보스전 도중에 나가면 그 보스전 시작부터)
- 일시정지에 SAVE & QUIT 추가 (ABANDON RUN은 RUN 포기)

### FIXED
- v1.3에서 추가된 SOUL 영구 강화(Precision · Focus · Resilience · Fortune · Second Thought · Head Start)가 새로고침 후 사라지던 문제
- 메인 메뉴 PRACTICE / TUTORIAL 버튼이 칸 밖으로 삐져나오던 문제

## v1.4.0 — Practice & Polish

### NEW
- PRACTICE 모드 — 원하는 보스를 원하는 페이즈부터 연습 (기록·SOUL 없음)
- TUTORIAL — 이동 · 공격 · 대시 · 회피 · 충전 · PARRY를 2분 만에 익히기
- 배경음악 — 아레나마다 다른 음악, 보스 페이즈가 오를수록 격해진다
- 유물(Relic) 8종 — 1번째 보스 후 / 최종 보스 직전에 선택
- 시너지 8종 — 특정 업그레이드 2개를 모으면 진화 효과 자동 해금
- 게임패드 지원 (트윈 스틱, 메뉴 조작) · 모바일 터치 컨트롤
- 일시정지 화면에 현재 스탯 · 유물 · 시너지 · 빌드 표시
- 패치 노트 화면

### CHANGED
- 설정에 음악 볼륨 / 효과음 볼륨 분리
- 첫 RUN 전에 튜토리얼 안내

### FIXED
- 터치 사용 후 마우스 조준이 돌아오지 않던 문제

## v1.3.0 — Deeper Builds

### NEW
- RUN 업그레이드 13종 추가 (총 33종) — TECHNIQUE 카테고리 신설
- Glass Cannon · Phoenix Feather(부활) · Aegis(보호막) · 흡혈 · 반사 피해
- SOUL 영구 강화 6종 추가 (총 10종) — 보상 다시 뽑기, Head Start 등
- GitHub Pages로 웹에서 바로 플레이

### FIXED
- 업데이트 후 브라우저가 옛 파일을 쓰던 캐시 문제
- SOUL 상점이 화면을 넘치던 문제

## v1.2.0 — Twelve Bosses

### NEW
- 캐릭터 3종 — BLADEMASTER · GUNSLINGER · IRON GUARDIAN
- 3타 콤보 피니셔 · Q 꾹 눌러 충전 · 타이밍 맞춘 E로 PARRY
- 보스 4종 추가 — Western Shooter · Clockwork Warden · Dune Wyrm · Dire Alpha (총 12종)
- 난이도 4단계 — EASY(4전) · NORMAL(5전) · HARD(7전) · NIGHTMARE(10전)
- RECORDS — 통계 · 보스 도감 · 업적 22종

### BALANCE
- Gunslinger 공격력 하향, Western Shooter 근접 방어 빈도 하향

### FIXED
- HUD 글자 간격 때문에 프레임이 크게 떨어지던 성능 문제

## v1.1.0 — New Challengers

### NEW
- 보스 3종 추가 — Frost Witch · Storm Caller · Blood Count
- 보스 선택이 매번 무작위 3택으로 바뀌어 판마다 다른 루트

## v1.0.0 — Five Bosses

### NEW
- 첫 출시 — 보스 5종 · 보상 3택 · 다음 보스 선택 · SOUL 영구 성장
