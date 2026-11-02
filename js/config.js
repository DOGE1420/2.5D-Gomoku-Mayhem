/* ============================================================
 *  게임 설정 — 일러스트와 맵을 여기서 교체합니다.
 *  경로는 index.html 기준 상대 경로입니다. null 이면 자동 생성 그림(기본)을 씁니다.
 *  자세한 규격은 assets/README.md 를 참고하세요.
 *  ※ 이미지를 쓰려면 file:// 더블클릭이 아니라 웹/로컬 서버(run.bat / run.sh)로 열어야 합니다.
 * ============================================================ */
window.GAME_CONFIG = {

  /* ---------- 카드 ---------- */
  cards: {                      // 카드 일러스트 (권장 584x428 PNG, 투명/흰 배경 모두 가능)
    chain:    null,             // 예: 'assets/cards/chain.png'
    bomb:     null,
    teleport: null,
    wall:     null,
    sixth:    null,
    reversal: null
  },
  cardPaper: null,              // 카드 바탕 이미지 (권장 768x1152 PNG). 예: 'assets/cards/paper.png'
  artBlend: 'normal',           // 'normal' | 'multiply' (흰 배경 선화를 양피지에 스며들게 하려면 multiply)

  /* ---------- 맵 ---------- */
  // 여러 개 넣으면 화면 위쪽에 맵 선택 메뉴가 나타납니다. 첫 번째가 기본값입니다.
  maps: [
    {
      id: 'candle', name: '촛불 방'            // 아무 항목도 안 쓰면 기본 촛불 방
    },
    {
      id: 'moon', name: '달빛 방',              // 이미지 없이 색/조명만 바꾼 예시
      background: '#04060e',
      fog: { color: '#04060e', near: 22, far: 90 },
      light: { hemiSky: '#5a6e9a', hemiGround: '#05060a', hemi: 0.55, spotColor: '#a9c2ff', spot: 1.1, spotAngle: 0.9 },
      candle: { visible: false }
    }

    /* 이미지를 넣은 맵 예시 (모든 항목 선택 사항):
    ,{
      id: 'cabin', name: '오두막',
      board: 'assets/maps/cabin/board.png',     // 판 윗면 (정사각형 1024x1024 권장)
      boardGrid: true,                          // true: 이미지 위에 격자선/화점을 자동으로 그림
                                                // false: 이미지에 이미 격자가 그려져 있음 (아래 규격 참고)
      table: 'assets/maps/cabin/table.png',     // 테이블 바닥 (타일링 텍스처)
      tableRepeat: 6,
      hideTable: false,                         // true: 테이블 바닥을 숨김 (backdrop 에 바닥이 그려진 경우)
      backdrop: 'assets/maps/cabin/room.jpg',   // 방 전체 배경 (360° 파노라마, 가로세로 2:1)
      stones: { black: 'assets/maps/cabin/black.png', white: 'assets/maps/cabin/white.png' },
      background: '#07050a',
      fog: { color: '#07050a', near: 22, far: 90 },   // 또는 fog: null (안개 없음)
      light: { hemiSky: '#7a6650', hemiGround: '#0a0806', hemi: 0.45, spotColor: '#ffe2b0', spot: 0.55, spotAngle: 0.7 },
      candle: { visible: true, color: '#ffa550', intensity: 1.5 },
      camera: { pos: [0, 15.5, 13.5], look: [0, 0, 3.2] }
    }
    */
  ]
};
