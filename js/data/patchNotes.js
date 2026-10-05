/* Version history shown in the PATCH NOTES screen. Newest first. */
(function () {
  'use strict';

  BR.PATCH_NOTES = [
    {
      version: '1.5.0',
      title: 'Daily Hunts',
      sections: [
        ['NEW', [
          'DAILY CHALLENGE — 매일 모두가 같은 보스 순서 · 보상 · 유물 · 변이로 도전, 오늘의 최고 기록 저장',
          '변이(Modifier) 7종 — RUN 시작 전 위험을 걸고 SOUL 보너스 획득',
          '엘리트 보스 — 12% 확률로 등장 (체력 +30%, 더 빠름, SOUL ×1.5)',
          '보스 처치 킬캠 — 마지막 일격에 줌 + 레터박스, 보스 색깔 사망 연출',
          '보스 등장 대사',
          '저장 코드 EXPORT / IMPORT — 다른 기기·브라우저로 진행 상황 옮기기',
          '결과 화면 SAVE IMAGE — 결과 카드를 이미지로 저장해 공유',
          '링크 공유 시 미리보기 카드(OG 이미지) · 파비콘',
        ]],
        ['CHANGED', [
          '메인 메뉴의 "FIVE BOSSES" 문구 삭제 (보스가 12종이 되었으므로)',
          '효과음에 약간의 음높이 변화를 줘 반복감 감소',
        ]],
      ],
    },
    {
      version: '1.4.1',
      title: 'Save Fixes',
      sections: [
        ['NEW', [
          'RUN 자동 저장 — 게임을 닫아도 메인 메뉴의 CONTINUE로 이어하기',
          '저장 시점: 보스전 시작 · 보상 화면 · 다음 보스 선택 (보스전 도중에 나가면 그 보스전 시작부터)',
          '일시정지에 SAVE & QUIT 추가 (ABANDON RUN은 RUN 포기)',
        ]],
        ['FIXED', [
          'v1.3에서 추가된 SOUL 영구 강화(Precision · Focus · Resilience · Fortune · Second Thought · Head Start)가 새로고침 후 사라지던 문제',
          '메인 메뉴 PRACTICE / TUTORIAL 버튼이 칸 밖으로 삐져나오던 문제',
        ]],
      ],
    },
    {
      version: '1.4.0',
      title: 'Practice & Polish',
      sections: [
        ['NEW', [
          'PRACTICE 모드 — 원하는 보스를 원하는 페이즈부터 연습 (기록·SOUL 없음)',
          'TUTORIAL — 이동 · 공격 · 대시 · 회피 · 충전 · PARRY를 2분 만에 익히기',
          '배경음악 — 아레나마다 다른 음악, 보스 페이즈가 오를수록 격해진다',
          '유물(Relic) 8종 — 1번째 보스 후 / 최종 보스 직전에 선택',
          '시너지 8종 — 특정 업그레이드 2개를 모으면 진화 효과 자동 해금',
          '게임패드 지원 (트윈 스틱, 메뉴 조작) · 모바일 터치 컨트롤',
          '일시정지 화면에 현재 스탯 · 유물 · 시너지 · 빌드 표시',
          '패치 노트 화면',
        ]],
        ['CHANGED', [
          '설정에 음악 볼륨 / 효과음 볼륨 분리',
          '첫 RUN 전에 튜토리얼 안내',
        ]],
        ['FIXED', [
          '터치 사용 후 마우스 조준이 돌아오지 않던 문제',
        ]],
      ],
    },
    {
      version: '1.3.0',
      title: 'Deeper Builds',
      sections: [
        ['NEW', [
          'RUN 업그레이드 13종 추가 (총 33종) — TECHNIQUE 카테고리 신설',
          'Glass Cannon · Phoenix Feather(부활) · Aegis(보호막) · 흡혈 · 반사 피해',
          'SOUL 영구 강화 6종 추가 (총 10종) — 보상 다시 뽑기, Head Start 등',
          'GitHub Pages로 웹에서 바로 플레이',
        ]],
        ['FIXED', [
          '업데이트 후 브라우저가 옛 파일을 쓰던 캐시 문제',
          'SOUL 상점이 화면을 넘치던 문제',
        ]],
      ],
    },
    {
      version: '1.2.0',
      title: 'Twelve Bosses',
      sections: [
        ['NEW', [
          '캐릭터 3종 — BLADEMASTER · GUNSLINGER · IRON GUARDIAN',
          '3타 콤보 피니셔 · Q 꾹 눌러 충전 · 타이밍 맞춘 E로 PARRY',
          '보스 4종 추가 — Western Shooter · Clockwork Warden · Dune Wyrm · Dire Alpha (총 12종)',
          '난이도 4단계 — EASY(4전) · NORMAL(5전) · HARD(7전) · NIGHTMARE(10전)',
          'RECORDS — 통계 · 보스 도감 · 업적 22종',
        ]],
        ['BALANCE', [
          'Gunslinger 공격력 하향, Western Shooter 근접 방어 빈도 하향',
        ]],
        ['FIXED', [
          'HUD 글자 간격 때문에 프레임이 크게 떨어지던 성능 문제',
        ]],
      ],
    },
    {
      version: '1.1.0',
      title: 'New Challengers',
      sections: [
        ['NEW', [
          '보스 3종 추가 — Frost Witch · Storm Caller · Blood Count',
          '보스 선택이 매번 무작위 3택으로 바뀌어 판마다 다른 루트',
        ]],
      ],
    },
    {
      version: '1.0.0',
      title: 'Five Bosses',
      sections: [
        ['NEW', [
          '첫 출시 — 보스 5종 · 보상 3택 · 다음 보스 선택 · SOUL 영구 성장',
        ]],
      ],
    },
  ];

  BR.GAME_VERSION = BR.PATCH_NOTES[0].version;
})();
