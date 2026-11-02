// 규칙 엔진 시험: node tests/rules-test.js
const Rules = require('../js/rules.js');
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

console.log('[카드: 함정 · 장벽 · 거대한 돌 · 투명한 돌 · 엿보기]');
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
  const X = Rules.create({ rng: seeded(16) });
  X.hand[BLACK] = ['ghost', 'peek']; X.hand[WHITE] = ['bomb', 'wall'];
  Rules.useCard(X, 0); Rules.place(X, 3, 3);
  ok(X.hidden.length === 1 && Rules.isHiddenFor(X, 3, 3, WHITE) && !Rules.isHiddenFor(X, 3, 3, BLACK), '투명한 돌: 상대에게만 안 보임');
  const f = Rules.place(X, 3, 3);
  ok(f.found && X.hidden.length === 0 && X.current === WHITE, '투명한 돌을 누르면 들킴 (차례는 그대로)');
  Rules.place(X, 9, 9);
  Rules.useCard(X, 0);   // 흑: 엿보기
  ok(X.peek && X.peek.by === BLACK && X.peek.cards.length === 2, '엿보기: 상대 패 확인');
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

console.log('[무작위 대국 — 오류·멈춤 확인]');
{
  const Rules2 = Rules; let games = 0, finished = 0, steps = 0, maxSteps = 0, errors = 0;
  const used = {};
  for (let seed = 1; seed <= 400; seed++) {
    const rng = seeded(seed * 7919);
    const G = Rules2.create({ rng });
    let n = 0;
    try {
      while (!G.gameOver && n < 3000) {
        n++;
        if (G.alk) {
          if (G.alk.phase === 'aim') Rules2.alkLaunch(G, (rng() - 0.5) * 4, 1 + rng() * 3);
          else { let k = 0; while (G.alk && G.alk.phase === 'sim' && k++ < 1000) Rules2.alkTick(G); }
        } else if (G.draft) Rules2.pickDraft(G, G.draft.picks[Math.floor(rng() * 3)]);
        else if (G.pending) {
          const opts = []; for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (Rules2.isValidTarget(G, r, c)) opts.push([r, c]);
          if (!opts.length) Rules2.cancel(G); else { const [r, c] = opts[Math.floor(rng() * opts.length)]; Rules2.target(G, r, c); }
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
  ok(Object.keys(used).length >= 20, '사용된 카드 종류 ' + Object.keys(used).length + '/21');
}
console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과');
process.exit(fails ? 1 : 0);
