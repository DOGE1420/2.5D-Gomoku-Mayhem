// 봇 두뇌 점검: node tests/bot-test.js   (규칙 엔진 위에서 단계별로 서로 대국시켜 오류·시간·승률을 봄)
const fs = require('fs'), vm = require('vm'), path = require('path');
global.Rules = require('../js/rules.js'); require('../js/rules-legend.js'); require('../js/rules-world.js');
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js/bot-ai.js'), 'utf8'));
let fail = 0; const ok = (c, m) => { if (!c) fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const { BLACK, WHITE } = Rules;

// 한 수를 두는 간단한 진행기: 카드는 5단계 이상만 쓰고, 뽑기·대상은 봇 로직/무작위
function step(G, lv) {
  const me = G.current, cfg = BOT_LEVELS[lv[me]];
  if (G.draft) { const picks = G.draft.picks; Rules.pickDraft(G, cfg.smartCards ? BotAI.pickDraft(G, picks, me, G.draft.kind) : picks[0]); Rules.drain(G); return; }
  if (G.counter) { Rules.answerCounter(G, false); Rules.drain(G); return; }
  if (G.alk) { Rules.alkLaunch(G, (Math.random() - 0.5) * 2, 1); for (let i = 0; i < 600 && G.alk; i++) { if (Rules.alkTick(G)) Rules.drain(G); } Rules.drain(G); return; }
  if (G.pending) {                                                     // 대상: 무작위 유효 칸
    const c = []; for (let r = 0; r < 15; r++) for (let k = 0; k < 15; k++) if (Rules.isValidTarget(G, r, k)) c.push([r, k]);
    if (!c.length) { Rules.cancel(G); Rules.drain(G); return; }
    const p = c[Math.floor(Math.random() * c.length)]; Rules.target(G, p[0], p[1]); Rules.drain(G); return;
  }
  if (G.done === 0 && !G.used[me] && G.hand[me].length && cfg.smartCards) {
    const ch = BotAI.chooseCard(G, me);
    if (ch) { const res = Rules.useCard(G, ch.idx); Rules.drain(G); if (res.ok) { if (G.pending && ch.targets) { ch.targets.forEach(t => { if (G.pending) { Rules.target(G, t.r, t.c); } }); if (G.pending) Rules.cancel(G); Rules.drain(G); } return; } }
  }
  const mv = BotAI.chooseMove(G, me, cfg);
  let res = mv && Rules.place(G, mv.r, mv.c);
  if (!res || !res.ok) { for (let r = 0; r < 15 && !(res && res.ok); r++) for (let c = 0; c < 15 && !(res && res.ok); c++) if (Rules.canPlace(G, r, c)) res = Rules.place(G, r, c); }
  Rules.drain(G);
}
function play(lvB, lvW, opts) {
  const G = Rules.create(opts || { legends: false, map: 'classic' });
  if (G.startQueue) { while (G.draft) { Rules.pickDraft(G, G.draft.picks[0]); Rules.drain(G); } }
  const lv = { [BLACK]: lvB, [WHITE]: lvW }; let n = 0, tmax = 0;
  while (!G.gameOver && n++ < 500) { const t0 = Date.now(); step(G, lv); tmax = Math.max(tmax, Date.now() - t0); }
  return { winner: G.winner, moves: n, tmax };
}
console.log('[봇 두뇌]');
for (const l of BOT_LEVEL_LIST) { const g = play(l, 1); ok(g.moves < 500, '단계 ' + l + ' (흑) vs 1단계: 끝까지 진행 (' + g.moves + '수, 최장 ' + g.tmax + 'ms, 승자 ' + g.winner + ')'); }
let w = 0, N = 6; for (let i = 0; i < N; i++) { const g = play(i % 2 ? 1 : 10, i % 2 ? 10 : 1); if (g.winner === (i % 2 ? WHITE : BLACK)) w++; }
ok(w >= N - 1, '10단계가 1단계를 이김 (' + w + '/' + N + ')');
let w5 = 0; for (let i = 0; i < N; i++) { const g = play(i % 2 ? 3 : 7, i % 2 ? 7 : 3); if (g.winner === (i % 2 ? WHITE : BLACK)) w5++; }
ok(w5 >= N - 2, '7단계가 3단계를 대체로 이김 (' + w5 + '/' + N + ')');
// 카드·전설·맵을 켠 판에서도 오류 없이
for (const lv of [1, 5, 10]) { let bad = 0; for (let i = 0; i < 3; i++) { try { const g = play(lv, lv, { legends: true, ability: 'random', map: 'random' }); if (g.moves >= 500) bad++; } catch (e) { bad++; console.log(e.stack); } } ok(!bad, lv + '단계 대 ' + lv + '단계 (전설·능력·맵 포함 3판): 오류·멈춤 없음'); }
console.log(fail ? '\n실패 ' + fail + '건' : '\n모두 통과'); process.exit(fail ? 1 : 0);
