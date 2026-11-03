/* 봇 — 화면 연결 (언제 무엇을 할지 · 연출). 두뇌(돌 · 카드 선택 알고리즘)는 js/bot-ai.js 의 BotAI, 단계별 설정은 BOT_LEVELS
 * 1·3단계: 돌은 단순 점수, 카드는 50% 확률로 무작위 사용 / 5단계~: 패턴 인식 + 상황에 맞는 카드 사용 / 7·10·20: 수 읽기
 * 전설 카드: 조건이 맞고 쓸 만하면 턴 시작에 발동 / 무소유 대응 · 알까기 발사 · 거대한 돌 자리 선택 포함
 * 규칙 엔진(Rules)만 호출하고, 연출은 사람이 쓸 때와 같은 흐름(runEvents · 카드 타는 연출)을 탐.
 */
'use strict';

var botColor = 0, humanColor = 0;               // botColor 가 0 이면 봇전이 아님
var BOT = { cardChance: 0.5, delay: 0.65 };
var botLevel = 1, botPlan = null;
try { var savedLv = parseInt(localStorage.getItem('omok_bot_level'), 10); if (BOT_LEVELS[savedLv]) botLevel = savedLv; } catch (e) {}
function botCfg() { return BOT_LEVELS[botLevel] || BOT_LEVELS[1]; }
function botSetLevel(n) { botLevel = BOT_LEVELS[n] ? n : 1; try { localStorage.setItem('omok_bot_level', String(botLevel)); } catch (e) {} }
var botViewSet = false, botWait = 0, botRollKey = '', botWantCard = false, botPickKey = '';

// 화면에 패를 보여 줄 사람 (봇전에서는 늘 사람, 로컬에서는 차례인 쪽)
function viewer() { return botColor ? humanColor : G.current; }
// 사람이 조작할 수 있는 차례인지 (봇의 차례에는 입력을 막음)
function humanTurn() { return !botColor || G.current === humanColor; }
function botStart(side) {                       // side: 'first' | 'second' | 'random'
  if (side === 'random') side = Math.random() < 0.5 ? 'first' : 'second';
  humanColor = side === 'first' ? Rules.BLACK : Rules.WHITE; botColor = Rules.other(humanColor);
  botWait = 1; botRollKey = ''; botPickKey = ''; botViewSet = false;
}
function botStop() { botColor = humanColor = 0; }

function bRnd(n) { return Math.floor(Math.random() * n); }
function bPick(list) { return list[bRnd(list.length)]; }
var B_DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

/* ---------------- 평가 (원본 lineScore / simpleCellScore) ---------------- */
function bLine(r, c, dr, dc, p) {
  var b = G.board, N = Rules.SIZE, count = 1, open = 0, rr = r + dr, cc = c + dc;
  while (Rules.inb(rr, cc) && b[rr][cc] === p) { count++; rr += dr; cc += dc; }
  if (Rules.inb(rr, cc) && b[rr][cc] === Rules.EMPTY) open++;
  rr = r - dr; cc = c - dc;
  while (Rules.inb(rr, cc) && b[rr][cc] === p) { count++; rr -= dr; cc -= dc; }
  if (Rules.inb(rr, cc) && b[rr][cc] === Rules.EMPTY) open++;
  if (count >= G.winLength) return 10000000;
  var gap = G.winLength - count;
  if (gap === 1) return open === 2 ? 500000 : open === 1 ? 50000 : 0;
  if (gap === 2) return open === 2 ? 5000 : open === 1 ? 500 : 0;
  if (gap === 3) return open === 2 ? 200 : open === 1 ? 50 : 0;
  return count * 2 + open;
}
function bCellScore(r, c, p, defense) {
  var opp = Rules.other(p), off = 0, def = 0, i;
  G.board[r][c] = p; for (i = 0; i < 4; i++) off = Math.max(off, bLine(r, c, B_DIRS[i][0], B_DIRS[i][1], p));
  G.board[r][c] = opp; for (i = 0; i < 4; i++) def = Math.max(def, bLine(r, c, B_DIRS[i][0], B_DIRS[i][1], opp));
  G.board[r][c] = Rules.EMPTY;
  return off + def * defense;
}
function bNearStone(r, c, rad) {
  for (var dr = -rad; dr <= rad; dr++) for (var dc = -rad; dc <= rad; dc++) { var nr = r + dr, nc = c + dc; if (Rules.inb(nr, nc) && Rules.isStone(G.board[nr][nc])) return true; }
  return false;
}
function bAnyStone() { for (var r = 0; r < Rules.SIZE; r++) for (var c = 0; c < Rules.SIZE; c++) if (Rules.isStone(G.board[r][c])) return true; return false; }
function bLegalCells() {
  var out = [];
  for (var r = 0; r < Rules.SIZE; r++) for (var c = 0; c < Rules.SIZE; c++) if (Rules.canPlace(G, r, c)) out.push({ r: r, c: c });
  return out;
}
// p 가 한 수로 이기는 칸 (4목 승리·웜홀 등 현재 규칙으로 판정)
function bWinCells(p) {
  var out = [];
  for (var r = 0; r < Rules.SIZE; r++) for (var c = 0; c < Rules.SIZE; c++) {
    if (G.board[r][c] !== Rules.EMPTY || Rules.isBlockedForPlayer(G, r, c, p)) continue;
    G.board[r][c] = p; var w = Rules.core.checkWin(G, r, c, p); G.board[r][c] = Rules.EMPTY;
    if (w) out.push({ r: r, c: c });
  }
  return out;
}
function bLongestRun(p) {
  var best = { len: 0, cells: [] };
  for (var r = 0; r < Rules.SIZE; r++) for (var c = 0; c < Rules.SIZE; c++) for (var d = 0; d < 4; d++) {
    var dr = B_DIRS[d][0], dc = B_DIRS[d][1], pr = r - dr, pc = c - dc;
    if (G.board[r][c] !== p || (Rules.inb(pr, pc) && G.board[pr][pc] === p)) continue;
    var cells = [], rr = r, cc = c;
    while (Rules.inb(rr, cc) && G.board[rr][cc] === p) { cells.push({ r: rr, c: cc }); rr += dr; cc += dc; }
    if (cells.length > best.len) best = { len: cells.length, cells: cells };
  }
  return best;
}

/* ---------------- 돌 두기 ---------------- */
function bGiantCell(cands, me) {                 // 거대한 돌: 상대 돌을 가장 많이 깨고 내 돌은 덜 깨는 자리
  var opp = Rules.other(me), best = null, bv = -1e9;
  cands.forEach(function (q) {
    var v = Math.random() * 0.1;
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) { var x = G.board[q.r + dr] && G.board[q.r + dr][q.c + dc]; if (x === opp) v += 2; else if (x === me) v -= 1; }
    if (v > bv) { bv = v; best = q; }
  });
  return best;
}
function botChooseStones() {                     // 우선순위대로 후보 목록을 돌려줌 (앞에서부터 시도)
  var me = botColor, opp = Rules.other(me), all = bLegalCells();
  if (!all.length) return [];
  var order = [];
  if (G.winOver[1] || G.winOver[2] || G.map === 'space') {       // 4목 승리 · 웜홀 줄은 단순 평가가 모르므로 직접 확인
    var mine = bWinCells(me).filter(function (q) { return Rules.canPlace(G, q.r, q.c); });
    if (mine.length) order.push(mine[0]);
    else { var th = bWinCells(opp).filter(function (q) { return Rules.canPlace(G, q.r, q.c); }); if (th.length) order.push(th[0]); }
  }
  if (G.next.giant === me) { var g = BotAI.bestGiantCell(G, me); if (g) order.push(g); }       // 거대한 돌은 가장 많이 깨는 자리에
  var pick = BotAI.chooseMove(G, me, botCfg());                                                   // 단계별 알고리즘 (js/bot-ai.js)
  if (pick) order.push(pick);
  all.map(function (q) { return { r: q.r, c: q.c, s: bCellScore(q.r, q.c, me, 1) }; }).sort(function (a, b) { return b.s - a.s; }).forEach(function (q) { order.push(q); });
  return order;
}
function botPlaceStone() {
  var order = botChooseStones();
  for (var i = 0; i < order.length; i++) {
    var res = Rules.place(G, order[i].r, order[i].c);
    if (res.ok) { var evs = Rules.drain(G); runEvents(evs); return true; }
  }
  return false;
}

/* ---------------- 카드 · 전설 카드 ---------------- */
var B_SNAP = function (id) { return { id: id, x: 0, y: 0, s: 1.75 }; };
function botAfterUse(res, evs, snap) { afterUse(res, evs, snap); }
function botUseCard() {
  var h = G.hand[botColor], idx = [], i, j, t;
  if (botCfg().smartCards) {                                      // 5단계~: 상황을 보고 쓸 카드와 대상을 정함
    var choice = BotAI.chooseCard(G, botColor);
    if (!choice) return false;
    var id0 = h[choice.idx], r0 = Rules.useCard(G, choice.idx);
    if (!r0.ok) return false;
    botPlan = { targets: choice.targets ? choice.targets.slice() : null };
    botAfterUse(r0, Rules.drain(G), B_SNAP(id0)); return true;
  }
  for (i = 0; i < h.length; i++) idx.push(i);
  for (i = idx.length - 1; i > 0; i--) { j = bRnd(i + 1); t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  for (i = 0; i < idx.length; i++) {
    var id = h[idx[i]], res = Rules.useCard(G, idx[i]);
    if (!res.ok) continue;
    botPlan = null;
    botAfterUse(res, Rules.drain(G), B_SNAP(id)); return true;
  }
  return false;
}
function botLegendOk() {                          // 전설 카드를 지금 쓸지 (원본 botLegendTry 의 판단)
  var p = botColor, opp = Rules.other(p), id = G.lg.card[p], c = Rules.LEGEND_BY_ID[id];
  if (!c || c.react || G.lg.done[p] || G.done > 0 || !Rules.canUseLegend(G)) return false;
  if (id === 'mirror' && G.used[p]) return false;
  if (id === 'obelisk') {                         // 상대 돌이 3개 이상 모인 줄
    for (var r = 0; r < Rules.SIZE; r++) for (var cc = 0; cc < Rules.SIZE; cc++) for (var d = 0; d < 4; d++) {
      var dr = B_DIRS[d][0], dc = B_DIRS[d][1];
      if (Rules.inb(r - dr, cc - dc)) continue;
      var n = 0, rr = r, c2 = cc;
      while (Rules.inb(rr, c2)) { if (G.board[rr][c2] === opp && !Rules.isProtected(G, rr, c2)) n++; rr += dr; c2 += dc; }
      if (n >= 3) return true;
    }
    return false;
  }
  if (id === 'chicken') return bLongestRun(opp).len > bLongestRun(p).len || bWinCells(opp).length > 0;
  if (id === 'mirror') return ['chain', 'windmill', 'bomb', 'shield', 'trap', 'wall', 'blockade', 'infection', 'sixsense'].indexOf(G.lg.lastCard[opp]) >= 0;
  if (id === 'allin') return BotAI.longestEval(G, p) < -800;                       // 크게 밀릴 때만
  return true;
}
function botUseLegend() {
  var id = G.lg.card[botColor], res = Rules.useLegend(G);
  if (!res.ok) return false;
  if (res.choice) res = Rules.useLegend(G, G.hand[botColor].length ? 'cards' : 'stones');
  if (!res.ok) return false;
  var evs = Rules.drain(G); botAfterUse(res, evs, B_SNAP(id)); return true;
}

/* ---------------- 대상 고르기 ---------------- */
function botPendingTarget() {
  var t = G.pending, me = botColor, cands = [];
  for (var r = 0; r < Rules.SIZE; r++) for (var c = 0; c < Rules.SIZE; c++) if (Rules.isValidTarget(G, r, c)) cands.push({ r: r, c: c });
  if (!cands.length) { cancelMode(); return; }
  var pick;
  if (botPlan && !t.legend) {                                          // 미리 정해 둔 대상 (5단계~)
    var pl = botPlan.targets;
    if (pl) { if (!pl.length) { cancelMode(); botPlan = null; return; } pick = pl.shift(); cands = [pick]; }
  }
  if (pick) { /* 정해 둔 대상 */ }
  else if (t.type === 'sacrifice' || t.type === 'wager') {                // 덜 중요한 돌(주변에 내 돌이 적은 돌, 가장 긴 줄은 마지막)부터
    var run = bLongestRun(me).cells, chosen = (t.picks || []).map(function (q) { return q.r + ',' + q.c; });
    var score = function (q) {
      var n = 0; for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) if ((dr || dc) && Rules.inb(q.r + dr, q.c + dc) && G.board[q.r + dr][q.c + dc] === me) n++;
      return n + (run.some(function (x) { return x.r === q.r && x.c === q.c; }) ? 100 : 0) + Math.random();
    };
    cands = cands.filter(function (q) { return chosen.indexOf(q.r + ',' + q.c) < 0; });
    if (!cands.length) { cancelMode(); return; }
    pick = cands.slice().sort(function (a, b) { return score(a) - score(b); })[0];
  } else pick = bPick(cands);
  var res = Rules.target(G, pick.r, pick.c), evs = Rules.drain(G);
  if (!res.ok) { cancelMode(); botPlan = null; return; }
  if (!res.resolved) { runEvents(evs); return; }
  botPlan = null;
  busy++; burnPlayed(function () { busy--; runEvents(evs); });
}

/* ---------------- 알까기 · 무소유 대응 · 뽑기 ---------------- */
function botAlkFlick() {                          // 상대 돌의 무게중심을 대충 겨냥 (±2칸 편차)
  var a = G.alk, ns = a.stones[a.newIndex], opp = Rules.other(botColor), sx = 0, sz = 0, n = 0;
  a.stones.forEach(function (s, i) { if (i !== a.newIndex && s.color === opp) { sx += s.x; sz += s.z; n++; } });
  var tx = (n ? sx / n : 0) + (Math.random() - 0.5) * 4, tz = (n ? sz / n : 0) + (Math.random() - 0.5) * 4;
  var dx = tx - ns.x, dz = tz - ns.z, dist = Math.hypot(dx, dz) || 1;
  var pull = Math.max(0.3, Math.min(Rules.ALK.MAXPULL, dist / 18 * (0.6 + Math.random() * 0.8)));
  if (Rules.alkLaunch(G, -dx / dist * pull, -dz / dist * pull)) { alkAcc = 0; sfx('boom'); }
}
function botCounterYes(cardId) {
  var h = G.hand[Rules.other(G.counter.user)];
  if (['reversal', 'giant', 'trade', 'chain', 'snipe', 'bomb', 'infection', 'sixsense', 'alkkagi', 'earthquake'].indexOf(cardId) < 0) return false;
  return h.length <= 2 || ['reversal', 'giant', 'trade', 'chain'].indexOf(cardId) >= 0;
}

/* ---------------- 매 프레임: 봇이 할 일이 있으면 한 가지씩 ---------------- */
function botTick(dt) {
  if (!botColor || curScreen !== 'game' || !G || G.gameOver || busy > 0) return;
  if ((botWait -= dt) > 0) return;
  var me = botColor, act = false;
  if (G.draft) {
    if (G.draft.player !== me) return;
    var dpicks = G.draft.picks, dchoice = botCfg().smartCards ? BotAI.pickDraft(G, dpicks, me, G.draft.kind) : bPick(dpicks);
    var res = Rules.pickDraft(G, dchoice);
    if (res.ok) { var e0 = Rules.drain(G); closeDraftUI(); runEvents(e0); botWait = BOT.delay; }
    return;
  }
  if (G.counter) {
    if (Rules.other(G.counter.user) !== me) return;
    answerCounterUI(botCounterYes(G.counter.id)); botWait = BOT.delay; return;
  }
  if (G.alk) {
    if (G.alk.phase === 'aim' && G.alk.order[G.alk.idx] === me) { botAlkFlick(); botWait = BOT.delay; }
    return;
  }
  if (G.startQueue || G.current !== me) return;
  if (!botViewSet) { botViewSet = true; setTopView(true, true); }     // 봇 차례가 시작되면 판 시점으로 (한 번만)
  if (G.pending) { if (G.pending.forPlayer === me) { botPendingTarget(); botWait = BOT.delay; } return; }
  // 턴 시작: 전설 카드 → (50%) 카드 한 장 → 돌
  if (G.done === 0 && !G.used[me] && botLegendOk()) act = botUseLegend();
  if (!act && G.done === 0 && !G.used[me] && G.hand[me].length && Rules.canUseCard(G)) {
    var key = G.round + ':' + G.placedCount[1] + ':' + G.placedCount[2] + ':' + me;
    if (botRollKey !== key) { botRollKey = key; botWantCard = Math.random() < BOT.cardChance; }
    if (botWantCard) { botWantCard = false; act = botUseCard(); }
  }
  if (!act) act = botPlaceStone();
  botWait = BOT.delay;
}
