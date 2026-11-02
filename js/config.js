/* ============================================================
 *  게임 설정 — 일러스트와 맵을 여기서 교체합니다.
 *  경로는 index.html 기준 상대 경로입니다. null 이면 자동 생성 그림(기본)을 씁니다.
 *  자세한 규격은 assets/README.md 를 참고하세요.
 *  ※ 이미지를 쓰려면 file:// 더블클릭이 아니라 웹/로컬 서버(run.bat / run.sh)로 열어야 합니다.
 * ============================================================ */
window.GAME_CONFIG = {

  /* ---------- 카드 ---------- */
  cards: {                      // 카드 일러스트 (권장 584x428 PNG, 투명/흰 배경 모두 가능). 일반 카드 20장 + 전설 카드 11장
    chain: null,
    windmill: null,
    alkkagi: null,
    bomb: null,
    trade: null,
    infection: null,
    reversal: null,
    teleport: null,
    earthquake: null,
    meteor: null,
    sixsense: null,
    wall: null,
    trap: null,
    snipe: null,
    double: null,
    peek: null,
    giant: null,
    weather: null,
    shield: null,
    blockade: null,
    // 전설 카드
    obelisk: null,
    nothing: null,
    latebloom: null,
    blind: null,
    clown: null,
    chicken: null,
    sloth: null,
    mirror: null,
    allin: null,
    turtle: null,
    king: null
  },


  cardPaper: null,              // 카드 바탕 이미지 (권장 768x1152 PNG). 예: 'assets/cards/paper.png'
  artBlend: 'normal',           // 'normal' | 'multiply' (흰 배경 선화를 양피지에 스며들게 하려면 multiply)

  /* ---------- 맵 ---------- */
  // 게임 규칙의 맵 6종(평원·여름·겨울·우주·사막·장마)마다 3D 장면의 분위기를 정합니다. 맵은 판마다 무작위로 정해지고
  // (기상 이변 카드로 바뀜) 해당 id 의 설정이 적용됩니다. 이미지를 쓰려면 항목에 board/table/backdrop/stones 를 추가하세요.
  maps: [
    { id: 'classic', name: '평원' },                                   // 기본 촛불 방
    { id: 'summer', name: '여름', background: '#150a03', fog: { color: '#150a03', near: 21, far: 54 },
      light: { hemiSky: '#8a6a3a', hemiGround: '#120a04', hemi: 0.16, spotColor: '#ffb050', spot: 1.9, spotAngle: 0.7 },
      candle: { visible: true, color: '#ff9a30', intensity: 1.4 } },
    { id: 'winter', name: '겨울', background: '#02050c', fog: { color: '#02050c', near: 21, far: 54 }, snow: true,
      light: { hemiSky: '#4a6a9a', hemiGround: '#04070d', hemi: 0.2, spotColor: '#cfe2ff', spot: 1.35, spotAngle: 0.66 },
      candle: { visible: true, color: '#9fc4ff', intensity: 0.85 } },
    { id: 'space', name: '우주', background: '#05010d', fog: { color: '#05010d', near: 26, far: 70 }, stars: 'bright',
      light: { hemiSky: '#4a3a8a', hemiGround: '#05030c', hemi: 0.22, spotColor: '#b488ff', spot: 1.25, spotAngle: 0.7 },
      candle: { visible: false } },
    { id: 'desert', name: '사막', background: '#1a0f04', fog: { color: '#1a0f04', near: 21, far: 54 },
      light: { hemiSky: '#9a7a44', hemiGround: '#120a03', hemi: 0.2, spotColor: '#ffd28a', spot: 2.0, spotAngle: 0.72 },
      candle: { visible: true, color: '#ffc060', intensity: 1.2 } },
    { id: 'rain', name: '장마', background: '#02060a', fog: { color: '#02060a', near: 20, far: 50 }, rain: true,
      light: { hemiSky: '#3a5a7a', hemiGround: '#03060a', hemi: 0.18, spotColor: '#9ab8d8', spot: 1.1, spotAngle: 0.66 },
      candle: { visible: true, color: '#88aacc', intensity: 0.8 } }
  ]
};
