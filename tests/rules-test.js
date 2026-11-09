// 규칙 엔진 시험: node tests/rules-test.js
const Rules = require('../js/rules.js');
require('../js/rules-legend.js');
require('../js/rules-world.js');
const { BLACK, WHITE, EMPTY, WALL, SIZE } = Rules;
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); }
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

console.log('[기본 규칙]');
{
  const G = Rules.create({ rng: seeded(1) });
  for (let i = 0; i < 4; i++) { Rules.place(G, 7, 3 + i); G.current === BLACK ? 0 : 0; Rules.place(G, 0, i * 3); }
  ok(G.board[7][3] === BLACK && G.board[0][0] === WHITE, '흑·백이 번갈아 착수');
  // 흑이 5목: 정확히 5
  const H = Rules.create({ rng: seeded(2) });
  [[7,3],[0,0],[7,4],[0,3],[7,5],[0,6],[7,6],[0,9]].forEach(([r,c]) => { Rules.place(H, r, c); if (H.draft) Rules.pickDraft(H, H.draft.picks[0]); });
  ok(!H.gameOver, '4목에서는 승리 아님');
  Rules.place(H, 7, 7);
  ok(H.gameOver && H.winner === BLACK, '정확히 5목 = 승리');
  // 장목(6목)은 승리 아님
  const J = Rules.create({ rng: seeded(3) });
  J.board[5][1] = J.board[5][2] = J.board[5][3] = J.board[5][5] = J.board[5][6] = BLACK;
  J.current = BLACK; J.board[5][4] = EMPTY;
  Rules.place(J, 5, 4);
  ok(!J.gameOver, '장목(6개 이어짐)은 승리가 아님');
}

console.log('[카드 뽑기 · 패 한도]');
{
  const G = Rules.create({ rng: seeded(4) });
  const cells = [[7,3],[0,0],[7,4],[0,3],[7,5]];   // 흑 3번째 착수에서 뽑기
  cells.forEach(([r,c]) => Rules.place(G, r, c));
  ok(G.draft && G.draft.player === BLACK && G.draft.picks.length === 3, '내 돌 3개째에 카드 3장 중 선택 열림');
  Rules.pickDraft(G, G.draft.picks[1]);
  ok(G.hand[BLACK].length === 1 && G.current === WHITE && !G.draft, '카드를 고르면 패에 들어가고 턴이 넘어감');
  G.hand[BLACK] = ['bomb','wall','trap','chain','shield'];
  Rules.grantRandomCard(G, BLACK);
  ok(G.hand[BLACK].length === 4, '패는 최대 4장 (넘치면 가장 오래된 카드가 사라짐)');
}

console.log('[카드: 턴당 1장 · 연속 착수 · 봉쇄]');
{
  const G = Rules.create({ rng: seeded(5) });
  G.hand[BLACK] = ['chain', 'sixsense', 'blockade'];
  G.hand[WHITE] = ['sixsense'];
  ok(Rules.useCard(G, 0).ok, '연속 착수 사용');
  ok(!Rules.useCard(G, 0).ok, '같은 턴에 두 번째 카드는 못 씀');
  Rules.place(G, 7, 7); ok(G.current === BLACK, '1번째 착수 후 아직 내 차례');
  ok(!Rules.place(G, 7, 8).ok, '이번 턴에 둔 돌의 2칸 안에는 못 둠');
  Rules.place(G, 7, 10); Rules.place(G, 7, 13);
  ok(G.current === WHITE, '3번 두면 턴 종료');
  // 봉쇄
  const H = Rules.create({ rng: seeded(6) });
  H.hand[BLACK] = ['blockade']; H.hand[WHITE] = ['sixsense', 'chain'];
  Rules.useCard(H, 0); Rules.place(H, 7, 7);
  const r = Rules.useCard(H, 0);
  ok(r.blocked && H.winLength === 5 && H.hand[WHITE].length === 1, '봉쇄: 상대가 쓴 카드는 무효(카드는 소모)');
}

console.log('[카드: 폭파 · 구멍 · 풍차 · 보호막]');
{
  const G = Rules.create({ rng: seeded(7) });
  G.board[7][7] = WHITE; G.board[3][3] = BLACK;
  G.hand[BLACK] = ['bomb', 'shield'];
  Rules.useCard(G, 0);
  ok(G.pending && G.pending.type === 'remove', '폭파는 대상 고르기 상태가 됨');
  Rules.target(G, 7, 7);
  ok(G.board[7][7] === EMPTY && Rules.isBlockedForPlayer(G, 7, 7, BLACK), '상대 돌이 사라지고 그 자리는 착수 금지(구멍)');
  Rules.place(G, 0, 0);     // 흑이 두고 턴 종료 → 백 차례
  ok(Rules.isBlockedForPlayer(G, 7, 7, WHITE), '구멍은 백에게도 막힘');
  // 보호막 안의 돌은 폭파 불가
  const H = Rules.create({ rng: seeded(8) });
  H.board[7][7] = WHITE; H.board[7][8] = WHITE; H.board[2][2] = BLACK;
  H.hand[WHITE] = ['shield']; H.hand[BLACK] = ['bomb'];
  H.current = WHITE; Rules.useCard(H, 0); Rules.target(H, 7, 7);
  Rules.place(H, 12, 12);
  Rules.useCard(H, 0);
  ok(!Rules.target(H, 7, 8).ok, '보호막 안의 돌은 폭파 대상이 아님');
  // 풍차
  const W = Rules.create({ rng: seeded(9) });
  W.board[7][7] = BLACK; W.hand[BLACK] = ['windmill'];
  Rules.useCard(W, 0); Rules.target(W, 7, 7); Rules.place(W, 0, 0);
  ok(!Rules.canPlace(W, 7, 8) && !Rules.canPlace(W, 6, 6) && Rules.canPlace(W, 5, 5), '풍차 주변 8칸에는 상대가 못 둠');
}

console.log('[카드: 맞교환 · 감염 · 전세 역전]');
{
  const G = Rules.create({ rng: seeded(10) });
  G.board[7][7] = BLACK; G.board[7][8] = WHITE; G.hand[BLACK] = ['trade'];
  Rules.useCard(G, 0); Rules.target(G, 7, 7); const r = Rules.target(G, 7, 8);
  ok(r.resolved && G.board[7][7] === WHITE && G.board[7][8] === BLACK && G.current === WHITE, '맞교환: 색이 바뀌고 턴 종료');
  const H = Rules.create({ rng: seeded(11) });
  H.board[7][7] = BLACK; H.board[7][8] = WHITE; H.board[7][9] = WHITE; H.hand[BLACK] = ['infection'];
  Rules.useCard(H, 0);
  ok(H.board[7][8] === BLACK && H.current === WHITE, '감염: 맞닿은 상대 돌이 내 돌로, 턴 종료');
  const V = Rules.create({ rng: seeded(12) });
  V.board[7][7] = BLACK; V.board[8][8] = WHITE; V.hand[BLACK] = ['reversal'];
  Rules.useCard(V, 0);
  ok(V.board[7][7] === WHITE && V.board[8][8] === BLACK && V.current === WHITE, '전세 역전: 색이 뒤바뀌고 턴 종료');
}

console.log('[카드: 함정 · 장벽 · 거대한 돌 · 운석 · 지진 · 봉쇄]');
{
  const G = Rules.create({ rng: seeded(13) });
  G.hand[BLACK] = ['trap']; G.hand[WHITE] = [];
  Rules.useCard(G, 0); Rules.target(G, 5, 5); Rules.place(G, 0, 0);
  const before = G.hand[BLACK].length;
  Rules.place(G, 5, 5);
  ok(G.board[5][5] === EMPTY && G.hand[BLACK].length === before + 1, '함정: 상대가 두면 돌이 사라지고 나는 카드 1장');
  const W = Rules.create({ rng: seeded(14) });
  W.hand[BLACK] = ['wall']; Rules.useCard(W, 0); Rules.target(W, 4, 4);
  ok(W.board[4][4] === WALL, '장벽: 영구 장벽');
  const T = Rules.create({ rng: seeded(15) });
  T.board[6][6] = WHITE; T.board[6][7] = BLACK; T.hand[BLACK] = ['giant'];
  Rules.useCard(T, 0); Rules.place(T, 7, 7);
  ok(T.board[6][6] === WALL && T.board[7][7] === WALL && T.board[6][7] === WALL, '거대한 돌: 착수 자리 3×3이 중립 바위가 되고 돌은 깨짐');
  ok(T.giants.length === 1 && Rules.giantAt(T, 8, 8) && Rules.giantAt(T, 6, 6) && !Rules.giantAt(T, 9, 9), '거대한 돌: 3×3 칸이 하나의 돌');
  T.hand[WHITE] = ['bomb']; T.current = WHITE; T.used[WHITE] = false; T.done = 0; T.needed = 1; T.placed = [];
  const bb = Rules.useCard(T, 0);
  ok(bb.ok && bb.pending && Rules.isValidTarget(T, 6, 6) && Rules.isValidTarget(T, 8, 8) && !Rules.isValidTarget(T, 9, 9), '폭파: 거대한 돌의 어느 칸이든 대상이 됨');
  Rules.target(T, 8, 7);
  ok(T.giants.length === 0 && T.board[7][7] === EMPTY && T.board[6][6] === EMPTY && T.board[8][8] === EMPTY && Rules.isBlockedForPlayer(T, 7, 7, BLACK), '폭파: 거대한 돌이 통째로 부서지고 그 자리는 2턴간 막힘');
  const X = Rules.create({ rng: seeded(16) });
  [[3,3],[3,4],[9,9],[10,2]].forEach(([r,c], i) => X.board[r][c] = i % 2 ? WHITE : BLACK);
  X.hand[BLACK] = ['meteor'];
  Rules.useCard(X, 0);
  ok(Rules.countStones(X, BLACK) + Rules.countStones(X, WHITE) === 3, '운석: 무작위 돌 1개가 파괴됨');
  const Q = Rules.create({ rng: seeded(17) });
  [[3,3],[3,4],[9,9],[10,2],[5,5]].forEach(([r,c], i) => Q.board[r][c] = i % 2 ? WHITE : BLACK);
  const qb = Rules.countStones(Q, BLACK), qw = Rules.countStones(Q, WHITE), qOld = JSON.stringify(Q.board);
  Q.hand[BLACK] = ['earthquake']; Rules.useCard(Q, 0);
  ok(Rules.countStones(Q, BLACK) === qb && Rules.countStones(Q, WHITE) === qw && JSON.stringify(Q.board) !== qOld, '지진: 돌 수는 그대로, 위치가 모두 바뀜');
  const K = Rules.create({ rng: seeded(18), legends: false }); K.lg.card[WHITE] = 'latebloom'; K.lg.plies = 40; K.current = WHITE; K.lock[WHITE] = true;
  const kr = Rules.useLegend(K);
  ok(kr.ok && kr.blocked && K.lg.done[WHITE] && !K.lock[WHITE] && K.lg.big !== WHITE, '봉쇄: 전설 카드도 무효화');
  ok(!Rules.CARD_BY_ID.peek && !Rules.CARD_BY_ID.ghost && Rules.CARDS.length === 19, '엿보기·투명한 돌 카드는 없음 (카드 19장)');
}

console.log('[카드: 알까기]');
{
  const G = Rules.create({ rng: seeded(17) });
  G.board[7][7] = WHITE; G.hand[BLACK] = ['alkkagi'];
  Rules.useCard(G, 0);
  ok(G.alk && G.alk.order[0] === BLACK && G.alk.stones.length === 2, '알까기 시작: 새 돌 하나가 대기');
  Rules.alkLaunch(G, 0, 4 * 0.9);    // 아래로 당김 → 위로 발사
  let n = 0; while (G.alk && n++ < 2000) Rules.alkTick(G);
  ok(G.alk && G.alk.order[1] === WHITE && G.alk.idx === 1, '첫 발사가 끝나면 상대 차례');
  Rules.alkLaunch(G, 0, 4 * 0.9); n = 0; while (G.alk && n++ < 2000) Rules.alkTick(G);
  ok(!G.alk, '둘 다 쏘면 알까기 종료');
  let stones = 0; for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (G.board[r][c] === BLACK || G.board[r][c] === WHITE) stones++;
  ok(stones === 3, '새 돌 2개가 칸에 고정됨 (기존 1개 + 2개)');
}


console.log('[시작: 전설 카드 선택 · 시작 능력 · 다시 뽑기]');
{
  const G = Rules.create({ rng: seeded(20), legends: true, ability: 'random' });
  ok(G.draft && G.draft.kind === 'legend' && G.draft.player === BLACK && G.draft.picks.length === 3, '시작: 흑이 전설 카드 3장 중 1장을 고름');
  ok(G.ab[1] && G.ab[1] === G.ab[2], '시작 능력은 양쪽에 똑같이 적용: ' + G.ab[1]);
  ok(!Rules.place(G, 7, 7).ok, '전설 카드를 고르기 전에는 돌을 못 둠');
  const before = G.draft.picks.join();
  const rr = Rules.reroll(G);
  ok(rr.ok && G.draft.picks.join() !== '' && G.refresh[BLACK] === (G.ab[1] === 'retry' ? 2 : 0), '다시 뽑기 사용 (남은 횟수 ' + G.refresh[BLACK] + ')');
  Rules.pickDraft(G, G.draft.picks[0]);
  ok(G.lg.card[BLACK] && G.draft && G.draft.player === WHITE, '흑이 고르면 백 차례로 넘어감 (흑의 선택은 비공개)');
  Rules.pickDraft(G, G.draft.picks[1]);
  ok(!G.draft && !G.startQueue && G.current === BLACK && Rules.place(G, 7, 7).ok, '둘 다 고르면 흑부터 시작');
  ok(Rules.LEGENDS.length === 10 && Rules.ABILITIES.length === 5, '전설 카드 10장 · 시작 능력 5종');
}
{
  // 시작 능력
  const P = Rules.create({ ability: 'pouch' }); P.hand[BLACK] = ['bomb','wall','trap','chain']; Rules.grantRandomCard(P, BLACK);
  ok(P.hand[BLACK].length === 5, '넉넉한 주머니: 패 5장까지');
  const K = Rules.create({ ability: 'clover', rng: seeded(21) });
  [[7,3],[0,0],[7,5],[0,3],[7,7]].forEach(([r,c]) => Rules.place(K, r, c));
  ok(K.draft && K.draft.picks.length === 4, '행운: 카드를 4장 중에서 고름');
  const T = Rules.create({ ability: 'retry' });
  ok(T.refresh[1] === 3 && T.refresh[2] === 3, '재도전: 다시 뽑기 3회');
  const S = Rules.create({ ability: 'sturdy' });
  S.hand[WHITE] = ['bomb']; Rules.place(S, 7, 7); Rules.place(S, 0, 0);
  S.current = WHITE; Rules.useCard(S, 0);
  ok(S.pending && !Rules.target(S, 7, 7).ok, '단단한 시작: 처음 둔 돌은 카드 효과로부터 보호');
}

console.log('[전설 카드 10장]');
function legendGame(card, seed) {
  const G = Rules.create({ rng: seeded(seed || 30) });
  G.lg.card[BLACK] = card; G.lg.card[WHITE] = 'turtle'; G.current = BLACK;
  return G;
}
{
  // 거신병
  const G = legendGame('obelisk');
  [[7,7],[8,8],[9,9]].forEach(([r,c]) => G.board[r][c] = BLACK);
  [[2,1],[2,2],[2,3],[2,4]].forEach(([r,c]) => G.board[r][c] = WHITE);
  ok(Rules.canUseLegend(G), '거신병: 내 돌 3개 이상이면 사용 가능');
  Rules.useLegend(G); Rules.target(G, 7, 7); Rules.target(G, 8, 8); const r = Rules.target(G, 9, 9);
  ok(r.resolved && [1,2,3,4].every(c => G.board[2][c] === EMPTY) && G.board[7][7] === EMPTY && G.lg.done[BLACK], '거신병: 3개를 바치면 상대 돌이 가장 많은 줄이 사라짐');
  ok(!Rules.canUseLegend(G), '전설 카드는 판마다 한 번만');
}
{
  // 무소유 (대응)
  const G = legendGame('chain'); G.lg.card[WHITE] = 'nothing'; G.hand[BLACK] = ['sixsense']; G.hand[WHITE] = ['bomb', 'wall'];
  const r = Rules.useCard(G, 0);
  ok(r.counter && G.counter && G.winLength === 5, '무소유: 상대가 카드를 쓰려 하면 대응 여부를 물음');
  const a = Rules.answerCounter(G, true);
  ok(a.nullified && G.winLength === 5 && G.hand[WHITE].length === 0 && G.lg.done[WHITE] && G.hand[BLACK].length === 0 && G.current === BLACK && G.used[BLACK], '무소유: 카드 무효(소모) · 내 패 전부 버림 · 차례는 그대로');
  const H = legendGame('chain'); H.lg.card[WHITE] = 'nothing'; H.hand[BLACK] = ['sixsense']; H.hand[WHITE] = ['bomb'];
  Rules.useCard(H, 0); Rules.answerCounter(H, false);
  ok(H.winLength === 6 && H.hand[WHITE].length === 1, '무소유: 넘기면 카드가 그대로 발동');
  const N = legendGame('chain'); N.lg.card[WHITE] = 'nothing'; N.hand[BLACK] = ['sixsense']; N.hand[WHITE] = [];
  ok(!Rules.useCard(N, 0).counter, '무소유: 패가 없으면 대응 불가');
}
{
  // 대기만성
  const G = legendGame('latebloom'); G.lg.plies = 40;
  ok(Rules.canUseLegend(G) && Rules.useLegend(G).ok && G.needed === 5, '대기만성: 40수 이후 이번 턴 5번 착수');
  Rules.place(G, 7, 7); ok(Rules.canPlace(G, 7, 8), '대기만성: 거리 제한 없음');
  G.board[3][1] = G.board[3][2] = G.board[3][3] = G.board[3][4] = BLACK;
  ok(!Rules.canPlace(G, 3, 5), '대기만성: 이번 턴에는 승리 줄을 만드는 칸에 못 둠');
}
{
  // 눈 감고 두기
  const G = legendGame('blind'); G.board[0][0] = WHITE;
  [[7,7],[8,8],[9,9]].forEach(([r,c], i) => { G.current = BLACK; G.done = 0; G.needed = 1; G.placed = []; Rules.place(G, r, c); });
  if (G.draft) Rules.pickDraft(G, G.draft.picks[0]);        // 3번째 돌에서 카드 뽑기가 열림
  G.current = BLACK; G.done = 0; G.needed = 1; G.placed = [];
  ok(Rules.canUseLegend(G), '실명: 조건 없이 사용 가능');
  Rules.useLegend(G);
  ok(Rules.isDark(G), '실명: 판이 어두워짐');
  for (let i = 0; i < 4; i++) { Rules.core.passTurn(G); }
  ok(Rules.isDark(G), '실명: 4턴 뒤에도 어두움');
  for (let i = 0; i < 2; i++) { Rules.core.passTurn(G); }
  ok(!Rules.isDark(G), '실명: 5턴 뒤 끝남');
}
{
  // 광대
  const G = legendGame('clown'); G.board[7][7] = BLACK; G.board[6][6] = BLACK; G.board[8][8] = BLACK; G.board[1][1] = WHITE;
  G.hand[WHITE] = ['snipe', 'bomb'];
  G.current = WHITE; Rules.useCard(G, 0);   // 저격: 흑 돌 2개 제거
  G.current = WHITE; G.used[WHITE] = false; Rules.useCard(G, 0); if (G.pending) Rules.target(G, ...(() => { for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) if (Rules.isValidTarget(G, r, c)) return [r, c]; return [0, 0]; })());
  G.current = BLACK;
  ok(G.lg.lost[BLACK] >= 3 && Rules.canUseLegend(G), '광대의 한 수: 카드로 돌 3개를 잃으면 사용 가능');
  Rules.useLegend(G);
  ok(Rules.countStones(G, BLACK) === 3 && G.board[7][7] === BLACK, '광대의 한 수: 잃은 돌이 모두 제자리로 귀환');
}
{
  // 나무늘보
  const G = legendGame('sloth'); G.board[1][1] = BLACK; G.board[1][2] = WHITE;
  G.hand[BLACK] = ['sixsense', 'chain', 'teleport'];
  ok(Rules.canUseLegend(G), '나무늘보: 조건 없이 패가 있으면 사용 가능');
  Rules.useLegend(G);
  ok(G.hand[BLACK].length === 0 && G.winLength === 6 && G.board[1][1] === EMPTY || G.winLength === 6, '나무늘보: 패의 카드를 모두 즉시 발동');
  const D = Rules.create({ rng: seeded(33) }); D.lg.card[BLACK] = 'sloth';
  [[7,3],[0,0],[7,5],[0,3],[7,7]].forEach(([r,c]) => Rules.place(D, r, c));
  ok(!!D.draft, '나무늘보: 쥐고 있어도 카드는 직접 고름');
}
{
  // 따라쟁이
  const G = legendGame('mirror'); ok(!Rules.canUseLegend(G), '따라쟁이: 상대가 카드를 쓰기 전에는 못 씀');
  G.lg.lastCard[WHITE] = 'bomb'; ok(Rules.canUseLegend(G), '따라쟁이: 상대가 카드를 쓴 뒤 사용 가능');
  G.board[7][7] = WHITE;
  const mr = Rules.useLegend(G); ok(mr.ok && mr.pending && G.pending.type === 'remove' && G.hand[BLACK].join() === 'bomb', '따라쟁이: 상대의 가장 최근 카드(폭파)를 바로 사용 — 대상 고르기');
  Rules.cancel(G); ok(G.hand[BLACK].length === 0 && !G.lg.done[BLACK], '따라쟁이: 취소하면 복사한 카드도 전설 사용도 없던 일로');
  Rules.useLegend(G); Rules.target(G, 7, 7);
  ok(G.board[7][7] === EMPTY && G.hand[BLACK].length === 0 && G.lg.done[BLACK], '따라쟁이: 폭파가 발동하고 전설 카드는 사용됨')
}
{
  // 올인
  const G = legendGame('allin', 41); G.hand[BLACK] = ['bomb', 'wall']; [[7,7],[8,8],[9,9]].forEach(([r,c]) => G.board[r][c] = BLACK);
  const c = Rules.useLegend(G); ok(c.ok && c.choice && !G.lg.done[BLACK], '올인: 패와 돌 둘 다 걸 수 있으면 무엇을 걸지 고름');
  const r = Rules.useLegend(G, 'cards');
  const slot = Rules.drain(G).find(e => e.t === 'slot');
  ok(slot && slot.reels.length === 3 && (slot.win ? G.hand[BLACK].length === 4 : G.hand[BLACK].length === 0), '올인(패): 슬롯 3개 — ' + (slot.win ? '잭팟 → 패 2배' : '꽝 → 패 잃음'));
  ok(!G.lg.done[BLACK] && !Rules.canUseLegend(G), '올인: 같은 턴에는 한 번만 (판마다가 아니라 턴마다)');
  G.lgUsedThisTurn = false; G.hand[BLACK] = ['bomb']; G.current = BLACK;
  ok(Rules.canUseLegend(G), '올인: 다음 턴에 다시 사용 가능');
  const S = legendGame('allin', 42); [[7,7],[8,8],[9,9]].forEach(([r,c]) => S.board[r][c] = BLACK);
  Rules.useLegend(S, 'stones'); Rules.target(S, 7, 7); Rules.target(S, 8, 8); Rules.target(S, 9, 9);
  const n = Rules.countStones(S, BLACK), s2 = Rules.drain(S).find(e => e.t === 'slot');
  ok(s2 && (s2.win ? n === 3 : n === 0), '올인(돌): ' + (s2.win ? '잭팟 → 건 개수만큼(3개) 무작위 칸에 배치' : '꽝 → 돌 잃음'));
  const S4 = legendGame('allin', 43); [[7,7],[8,8],[9,9],[3,3]].forEach(([r,c]) => S4.board[r][c] = BLACK);
  const w4 = Rules.useLegend(S4, 'stones:4'); ok(w4.ok && w4.pending && S4.pending.need === 4, '올인: 돌은 3개 이상 원하는 만큼 걸 수 있음 (4개)');
  [[7,7],[8,8],[9,9]].forEach(([r,c]) => Rules.target(S4, r, c)); ok(!!S4.pending, '올인: 건 개수를 다 고를 때까지 대기');
  Rules.target(S4, 3, 3); const n4 = Rules.countStones(S4, BLACK); ok(n4 === 0 || n4 === 4, '올인(4개): 잭팟이면 4개 배치, 꽝이면 전부 잃음');
}
{
  // 토끼와 거북이
  const G = legendGame('turtle'); for (let i = 0; i < 6; i++) G.board[1][i] = WHITE; G.board[10][10] = BLACK;
  ok(Rules.canUseLegend(G), '토끼와 거북이: 돌이 5개 이상 적으면 사용 가능');
  Rules.useLegend(G);
  ok(G.winOver[BLACK] === 4 && G.current === WHITE, '토끼와 거북이: 사용 즉시 턴 종료');
  G.current = BLACK; G.done = 0; G.needed = 1; G.placed = []; G.board = G.board.map(r => r.map(() => 0));
  [[5,1],[5,2],[5,3]].forEach(([r,c]) => G.board[r][c] = BLACK); Rules.place(G, 5, 4);
  ok(G.gameOver && G.winner === BLACK, '토끼와 거북이: 나만 4목으로 승리');
}
{
  // 왕의 귀환
  const G = legendGame('king'); G.board[7][7] = BLACK;
  Rules.useLegend(G); Rules.target(G, 7, 7);
  ok(G.lg.king[BLACK] && G.lg.done[BLACK], '왕의 귀환: 내 돌을 왕으로 지정');
  for (let i = 0; i < 40; i++) Rules.core.passTurn(G);
  ok(!G.lg.done[BLACK] && G.lg.card[BLACK] !== 'king' && G.lg.card[BLACK] && G.hand[BLACK].length === 4, '왕의 귀환: 20턴 생존 → 패 가득 + 새 전설 카드');
  const F = legendGame('king'); F.board[7][7] = BLACK; Rules.useLegend(F); Rules.target(F, 7, 7); F.board[7][7] = EMPTY; Rules.core.passTurn(F);
  ok(F.lg.king[BLACK] === null, '왕의 귀환: 왕이 쓰러지면 실패');
}


console.log('[맵 · 자기장]');
function passes(G, n) { for (let i = 0; i < n; i++) Rules.core.passTurn(G); }
function fill(G) { [[3,3],[3,5],[5,3],[10,10]].forEach(([r,c]) => G.board[r][c] = BLACK); [[4,4],[4,6],[6,4],[11,11]].forEach(([r,c]) => G.board[r][c] = WHITE); }
{
  ok(Rules.MAP_LIST.length === 6, '맵 6종');
  const R6 = new Set(); for (let i = 1; i <= 120; i++) R6.add(Rules.create({ map: 'random' }).map);
  ok(R6.size >= 5, '맵은 판마다 무작위: ' + [...R6].join(','));
  // 여름
  const G = Rules.create({ map: 'summer', rng: seeded(50) }); fill(G);
  const nb = Rules.countStones(G, BLACK), nw = Rules.countStones(G, WHITE);
  passes(G, 8); ok(Rules.countStones(G, BLACK) === nb && Rules.countStones(G, WHITE) === nw, '여름: 4라운드까지는 아무 일도 없음');
  passes(G, 2);
  ok(Rules.countStones(G, BLACK) === nb - 1 && Rules.countStones(G, WHITE) === nw - 1 && G.round === 5, '여름: 5라운드에 흑·백 돌이 하나씩 녹음');
  // 겨울
  const W = Rules.create({ map: 'winter', rng: seeded(51) }); fill(W);
  passes(W, 10);
  ok(W.frozen.length === 1 && W.board[W.frozen[0].r][W.frozen[0].c] === WALL, '겨울: 5라운드에 돌 하나가 얼음(중립)이 됨');
  const fz = W.frozen[0]; passes(W, 4);
  ok(W.frozen.length === 0 && W.board[fz.r][fz.c] === fz.owner, '겨울: 2라운드 뒤 녹아 원래 주인에게 돌아옴');
  // 우주: 웜홀
  const S = Rules.create({ map: 'space' }); [13,14,0,1].forEach(c => S.board[7][c] = BLACK);
  Rules.place(S, 7, 2);
  ok(S.gameOver && S.winner === BLACK, '우주: 판의 끝을 넘어 이어진 5목이 승리 (웜홀)');
  const P = Rules.create({ map: 'classic' }); [13,14,0,1].forEach(c => P.board[7][c] = BLACK); Rules.place(P, 7, 2);
  ok(!P.gameOver, '평원: 끝을 넘는 줄은 이어지지 않음');
  // 사막
  const D = Rules.create({ map: 'desert', rng: seeded(52) }); fill(D);
  passes(D, 14); const before = JSON.stringify(D.board);
  passes(D, 2);
  ok(D.round === 8 && JSON.stringify(D.board) !== before && Rules.countStones(D, BLACK) === 4 && Rules.countStones(D, WHITE) === 4, '사막: 8라운드에 모래폭풍 — 돌이 밀림(개수는 그대로)');
  // 장마: 지진 뒤 쓰나미
  const T = Rules.create({ map: 'rain', rng: seeded(53) });
  [[0,0],[0,5],[1,1],[2,2],[7,7],[12,12],[14,14],[8,3],[3,9]].forEach(([r,c], i) => T.board[r][c] = i % 2 ? BLACK : WHITE);
  T.hand[BLACK] = ['earthquake']; Rules.useCard(T, 0);
  const evs = Rules.drain(T);
  ok(evs.some(e => e.t === 'disaster' && e.kind === 'tsunami'), '장마: 지진 뒤 쓰나미가 일어남');
  // 자기장
  const Z = Rules.create({ map: 'classic', rng: seeded(54) }); Z.board[0][5] = BLACK; Z.board[7][7] = WHITE;
  passes(Z, 28); ok(Z.zoneWarn && Z.zone === 0, '자기장: 14라운드에 예고');
  passes(Z, 2);
  ok(Z.zone === 1 && Z.board[0][5] === WALL && Rules.countStones(Z, BLACK) === 0 && Z.board[7][7] === WHITE, '자기장: 15라운드에 바깥 한 줄이 닫히고 그 줄의 돌이 사라짐');
  ok(!Rules.canPlace(Z, 0, 3) && !Rules.canPlace(Z, 14, 14) && Rules.canPlace(Z, 1, 1), '자기장: 닫힌 줄에는 둘 수 없음');
  passes(Z, 10 + 10); ok(Z.zone === 3, '자기장: 5라운드마다 한 줄씩, 최대 3줄 (9×9까지)');
  passes(Z, 20); ok(Z.zone === 3, '자기장: 3줄을 넘어 닫히지 않음');
  // 자연재해 면역
  const U = Rules.create({ map: 'summer', ability: 'umbrella', rng: seeded(55) }); fill(U); passes(U, 10);
  ok(Rules.countStones(U, BLACK) === 4 && Rules.countStones(U, WHITE) === 4, '자연재해 면역: 여름에도 돌이 녹지 않음');
  const U2 = Rules.create({ map: 'classic', ability: 'umbrella', rng: seeded(56) }); U2.board[0][5] = BLACK; passes(U2, 30);
  ok(U2.zone === 1 && Rules.countStones(U2, BLACK) === 0, '자연재해 면역: 자기장은 막지 못함');
  // 기상 이변
  const X = Rules.create({ map: 'winter', rng: seeded(57) }); fill(X); passes(X, 10);
  const fz2 = X.frozen[0]; X.hand[X.current] = ['weather']; Rules.useCard(X, 0);
  ok(X.map !== 'winter' && X.frozen.length === 0 && X.board[fz2.r][fz2.c] === fz2.owner, '기상 이변: 다른 맵으로 바뀌고 얼음은 모두 녹음 → ' + X.map);
}

console.log('[무작위 대국 — 오류·멈춤 확인]');
{
  const Rules2 = Rules; let games = 0, finished = 0, steps = 0, maxSteps = 0, errors = 0;
  const used = {}, usedL = {};
  for (let seed = 1; seed <= 400; seed++) {
    const rng = seeded(seed * 7919);
    const G = Rules2.create({ rng, legends: true, ability: 'random', map: 'random' });
    let n = 0;
    try {
      while (!G.gameOver && n < 3000) {
        n++;
        if (G.counter) Rules2.answerCounter(G, rng() < 0.5);
        else if (G.alk) {
          if (G.alk.phase === 'aim') Rules2.alkLaunch(G, (rng() - 0.5) * 4, 1 + rng() * 3);
          else { let k = 0; while (G.alk && G.alk.phase === 'sim' && k++ < 1000) Rules2.alkTick(G); }
        } else if (G.draft) { if (rng() < 0.2) Rules2.reroll(G); Rules2.pickDraft(G, G.draft.picks[Math.floor(rng() * G.draft.picks.length)]); }
        else if (G.pending) {
          const opts = []; for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (Rules2.isValidTarget(G, r, c)) opts.push([r, c]);
          if (!opts.length) Rules2.cancel(G); else { const [r, c] = opts[Math.floor(rng() * opts.length)]; Rules2.target(G, r, c); }
        } else if (Rules2.canUseLegend(G) && rng() < 0.5) {
          const lid = G.lg.card[G.current]; usedL[lid] = 1; Rules2.useLegend(G, rng() < 0.5 ? 'cards' : 'stones');
        } else if (G.hand[G.current].length && Rules2.canUseCard(G) && rng() < 0.45) {
          const i = Math.floor(rng() * G.hand[G.current].length); used[G.hand[G.current][i]] = 1; Rules2.useCard(G, i);
        } else {
          const cells = []; for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (Rules2.canPlace(G, r, c)) cells.push([r, c]);
          if (!cells.length) { G.gameOver = true; break; }
          const [r, c] = cells[Math.floor(rng() * cells.length)]; Rules2.place(G, r, c);
        }
        Rules2.drain(G);
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) { const v = G.board[r][c]; if (v < 0 || v > 3) throw new Error('bad cell ' + v); }
      }
    } catch (e) { errors++; if (errors < 4) console.log('  오류', seed, e.stack.split('\n').slice(0, 3).join(' | ')); }
    games++; if (G.gameOver) finished++; steps += n; maxSteps = Math.max(maxSteps, n);
  }
  ok(errors === 0, `무작위 ${games}판: 예외 ${errors}건`);
  ok(finished / games > 0.97, `끝까지 진행된 판 ${finished}/${games} (최대 ${maxSteps}스텝)`);
  ok(Object.keys(usedL).length >= 8, '사용된 전설 카드 종류 ' + Object.keys(usedL).length + '/11');
  ok(Object.keys(used).length >= 19, '사용된 카드 종류 ' + Object.keys(used).length + '/19');
}
console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과');
process.exit(fails ? 1 : 0);
