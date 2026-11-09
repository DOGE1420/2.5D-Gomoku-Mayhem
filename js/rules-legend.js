/* 전설 카드 11장의 효과 (원본 Gomoku-ARAM 의 legend.js 를 규칙 엔진에 맞춰 옮김)
 * - 게임 시작 때 흑·백이 차례로 전설 카드 3장 중 1장을 고름 (상대에게는 쓰기 전까지 비공개)
 * - 전설 카드는 패와 따로 '전설 칸'에 놓이고 판마다 한 번만 씀. 일반 카드의 '턴당 1장'과 따로 셈
 * - 무소유만 '대응' 카드: 상대가 카드를 쓸 때 그 카드를 무효로 함
 * rules.js 다음에 불러와야 함.
 */
(function (R) {
  'use strict';
  var C = R.core, SIZE = R.SIZE, EMPTY = R.EMPTY, WALL = R.WALL, BLACK = R.BLACK, WHITE = R.WHITE, other = R.other;
  var ev = C.ev;
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  function countStones(G, p) { var n = 0; for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (G.board[r][c] === p) n++; return n; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  // p의 가장 긴 줄 (같은 색이 연달아 놓인 칸들)
  function longestRun(G, p) {
    var best = { len: 0, cells: [] };
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      if (G.board[r][c] !== p) continue;
      for (var d = 0; d < 4; d++) {
        var dr = DIRS[d][0], dc = DIRS[d][1], pr = r - dr, pc = c - dc;
        if (R.inb(pr, pc) && G.board[pr][pc] === p) continue;          // 줄의 시작에서만 셈
        var cells = [], rr = r, cc = c;
        while (R.inb(rr, cc) && G.board[rr][cc] === p) { cells.push({ r: rr, c: cc }); rr += dr; cc += dc; }
        if (cells.length > best.len || (cells.length === best.len && C.rnd(G) < 0.5)) best = { len: cells.length, cells: cells };
      }
    }
    return best;
  }

  /* ---------------- 조건 진행 상황 ---------------- */
  function legendProgress(G, p) {
    var id = G.lg.card[p]; if (!id) return { id: null, ok: false, text: '' };
    var opp = other(p), lg = G.lg, r;
    switch (id) {
      case 'obelisk': { var n = countStones(G, p); r = { ok: n >= 3 && countStones(G, opp) > 0, text: '내 돌 ' + Math.min(n, 3) + '/3' }; break; }
      case 'nothing': r = { ok: false, text: '내 패 ' + G.hand[p].length + '장 · 상대가 카드를 쓸 때 대응' }; break;
      case 'latebloom': r = { ok: lg.plies >= 40, text: '판에 둔 수 ' + Math.min(lg.plies, 40) + '/40' }; break;
      case 'blind': r = { ok: !R.isDark(G), text: R.isDark(G) ? '이미 어두운 중' : '조건 없음' }; break;
      case 'clown': r = { ok: lg.lost[p] >= 3, text: '잃은 돌 ' + Math.min(lg.lost[p], 3) + '/3' }; break;
      case 'sloth': r = { ok: G.hand[p].length > 0, text: '패 ' + G.hand[p].length + '장' }; break;
      case 'mirror': { var lc = lg.lastCard[opp]; var cd = lc && R.CARD_BY_ID[lc]; r = { ok: !!lc, text: lc ? '베낄 카드: ' + (cd ? cd.name : lc) : '상대가 아직 카드를 쓰지 않음' }; break; }
      case 'allin': { var h = G.hand[p].length, st = countStones(G, p); r = { ok: h > 0 || st >= 3, text: '패 ' + h + '장 · 내 돌 ' + st + '개' }; break; }
      case 'turtle': { var dd = countStones(G, opp) - countStones(G, p); r = { ok: dd >= 5 && !G.winOver[p], text: '돌 차이 ' + clamp(dd, 0, 5) + '/5' }; break; }
      case 'king': {
        var k = lg.king[p];
        r = k ? { ok: false, text: '왕 생존 ' + Math.min(lg.turnNo - k.start, 20) + '/20턴' } : { ok: countStones(G, p) > 0, text: '왕으로 지정할 돌을 고르세요' };
        break;
      }
      default: r = { ok: false, text: '' };
    }
    r.id = id; r.done = !!lg.done[p];
    return r;
  }
  function canUseLegend(G) {
    var p = G.current, c = R.LEGEND_BY_ID[G.lg.card[p]];
    if (!c || c.react || G.lg.done[p]) return false;
    if (c.id === 'allin' && G.lgUsedThisTurn) return false;
    if (c.id === 'mirror' && G.used[p]) return false;               // 따라쟁이는 카드 사용으로 침 (턴당 카드 1장)     // 올인: 한 턴에 한 번
    if (G.gameOver || G.draft || G.pending || G.alk || G.counter || G.startQueue) return false;
    return legendProgress(G, p).ok;
  }

  /* ---------------- 사용 ---------------- */
  function lgFinish(G, p) {
    if (G.lg.card[p] !== 'allin') G.lg.done[p] = true;     // 올인(도박)은 판마다 1번이 아니라 턴마다 1번
    G.lgUsedThisTurn = true;
    ev(G, { t: 'legend', p: p, id: G.lg.card[p] });
  }
  // choice: 올인에서 'cards' | 'stones'
  function useLegend(G, choice) {
    if (!canUseLegend(G)) return { ok: false };
    var p = G.current, opp = other(p), id = G.lg.card[p];
    if (G.lock[p]) { G.lock[p] = false; lgFinish(G, p); ev(G, { t: 'blocked', p: p, id: id }); return { ok: true, blocked: true }; }   // 봉쇄: 전설 카드도 무효
    switch (id) {
      case 'obelisk': G.pending = { type: 'sacrifice', forPlayer: p, legend: true, picks: [] }; return { ok: true, pending: true };
      case 'king': G.pending = { type: 'kingPick', forPlayer: p, legend: true }; return { ok: true, pending: true };
      case 'latebloom': lgFinish(G, p); G.lg.big = p; G.needed = Math.max(G.needed, 5); break;
      case 'blind': lgFinish(G, p); G.lg.darkUntil = G.lg.turnNo + 5; ev(G, { t: 'dark', turns: 5 }); break;
      case 'clown': lgFinish(G, p); clown(G, p); break;
      case 'mirror': {                                                    // 상대가 가장 최근에 쓴 카드를 내가 바로 사용
        var src = G.lg.lastCard[opp]; if (!src || G.used[p]) return { ok: false };
        G.hand[p].push(src); var mi = G.hand[p].length - 1;
        ev(G, { t: 'gain', p: p, id: src });
        var mres = R.useCard(G, mi);
        if (!mres.ok) { G.hand[p].splice(mi, 1); G.ev.pop(); return { ok: false }; }
        if (G.pending) G.pending.mirror = true;
        lgFinish(G, p);
        return mres;
      }
      case 'sloth': lgFinish(G, p); slothRunAll(G, p); return { ok: true };
      case 'allin': {
        var nSt = countStones(G, p), canCards = G.hand[p].length > 0, canStones = nSt >= 3;
        if (!choice) { if (canCards && canStones) return { ok: true, choice: true, maxStones: nSt }; choice = canCards ? 'cards' : 'stones'; }
        var need = 3;
        if (typeof choice === 'string' && choice.indexOf('stones:') === 0) { need = parseInt(choice.slice(7), 10) || 3; choice = 'stones'; }
        if (choice === 'cards' && canCards) { lgFinish(G, p); allinCards(G, p); break; }
        if (choice === 'stones' && canStones && need >= 3 && need <= nSt) { G.pending = { type: 'wager', forPlayer: p, legend: true, picks: [], need: need }; return { ok: true, pending: true }; }
        return { ok: false };
      }
      case 'turtle': lgFinish(G, p); G.winOver[p] = 4; ev(G, { t: 'rule', turtle: p }); C.passTurn(G); return { ok: true };
      default: return { ok: false };
    }
    if (!G.gameOver && !G.pending) C.endIfBoardWin(G);
    return { ok: true };
  }

  /* ---------------- 대상을 고르는 전설 카드 (거신병 · 올인 돌 걸기 · 왕의 귀환) ---------------- */
  function legendTarget(G, t, r, c) {
    var p = t.forPlayer, v = G.board[r][c];
    if (v !== p) return { ok: false };
    if (t.type === 'sacrifice' || t.type === 'wager') {
      var i = -1; t.picks.forEach(function (q, k) { if (q.r === r && q.c === c) i = k; });
      if (i !== -1) t.picks.splice(i, 1); else t.picks.push({ r: r, c: c });                // 다시 누르면 선택 취소
      if (t.picks.length < (t.need || 3)) { ev(G, { t: 'legendPick', picks: t.picks.map(function (q) { return { r: q.r, c: q.c }; }) }); return { ok: true, resolved: false }; }
      lgFinish(G, p);
      var picks = t.picks; G.pending = null;
      if (t.type === 'wager') allinStones(G, p, picks); else obeliskResolve(G, p, picks);
      C.endIfBoardWin(G);
      return { ok: true, resolved: true };
    }
    if (t.type === 'kingPick') {                                                            // 왕으로 지정 (20턴 살아남으면 귀환)
      lgFinish(G, p); G.pending = null;
      G.lg.king[p] = { r: r, c: c, start: G.lg.turnNo };
      ev(G, { t: 'king', r: r, c: c, p: p });
      return { ok: true, resolved: true };
    }
    return { ok: false };
  }
  function removeStone(G, victim, q, why) {
    C.removeStoneAt(G, q.r, q.c); C.lgLose(G, victim, q.r, q.c);
    ev(G, { t: 'remove', r: q.r, c: q.c, p: victim, why: why });
  }
  // 🗿 희생한 돌 3개를 바친 뒤: 상대 돌이 가장 많은 줄을 분쇄
  function obeliskResolve(G, p, picks) {
    var opp = other(p), lines = [], i, k, s;
    picks.forEach(function (q) { C.removeStoneAt(G, q.r, q.c); ev(G, { t: 'remove', r: q.r, c: q.c, p: p, why: 'sacrifice' }); });
    for (i = 0; i < SIZE; i++) {
      var row = [], col = [];
      for (k = 0; k < SIZE; k++) { row.push({ r: i, c: k }); col.push({ r: k, c: i }); }
      lines.push(row, col);
    }
    for (s = 0; s < SIZE * 2 - 1; s++) {
      var d1 = [], d2 = [];
      for (var r = 0; r < SIZE; r++) { var c1 = s - r, c2 = r - (s - SIZE + 1); if (R.inb(r, c1)) d1.push({ r: r, c: c1 }); if (R.inb(r, c2)) d2.push({ r: r, c: c2 }); }
      lines.push(d1, d2);
    }
    var best = [], bestN = 0;
    lines.forEach(function (line) {
      var hits = line.filter(function (q) { return G.board[q.r][q.c] === opp && !C.isProtected(G, q.r, q.c); });
      if (hits.length > bestN || (hits.length === bestN && hits.length > 0 && C.rnd(G) < 0.5)) { best = hits; bestN = hits.length; }
    });
    best.forEach(function (q) { removeStone(G, opp, q, 'smash'); });
    C.pruneTraps(G);
  }
  // (r,c)에서 가장 가까운 빈 칸 (구멍 제외, 그 돌 주인이 승리 줄을 완성하지 않는 칸)
  function nearestEmpty(G, r, c, owner) {
    for (var d = 1; d < SIZE; d++) {
      var ring = [];
      for (var rr = r - d; rr <= r + d; rr++) for (var cc = c - d; cc <= c + d; cc++) {
        if (Math.max(Math.abs(rr - r), Math.abs(cc - c)) !== d || !R.inb(rr, cc)) continue;
        if (G.board[rr][cc] !== EMPTY || C.isCrater(G, rr, cc)) continue;
        ring.push({ r: rr, c: cc });
      }
      var ok = C.shuffle(G, ring).filter(function (q) { var v = G.board[r][c]; G.board[r][c] = EMPTY; var w = C.lgWouldWin(G, q.r, q.c, owner); G.board[r][c] = v; return !w; });
      if (ok.length) return ok[0];
    }
    return null;
  }
  // 🤡 잃은 돌을 제자리로 (그 자리의 상대 돌은 가까운 빈 칸으로 밀어냄)
  function clown(G, p) {
    var opp = other(p);
    G.lg.lostPos[p].forEach(function (q) {
      var v = G.board[q.r][q.c];
      if (v === p || v === WALL) return;
      if (v === opp) {
        if (C.isProtected(G, q.r, q.c)) return;
        G.board[q.r][q.c] = EMPTY;
        if (C.lgWouldWin(G, q.r, q.c, p)) { G.board[q.r][q.c] = opp; return; }
        G.board[q.r][q.c] = opp;
        var dest = nearestEmpty(G, q.r, q.c, opp);
        if (!dest) return;
        G.board[q.r][q.c] = EMPTY; G.board[dest.r][dest.c] = opp; C.moveMeta(G, q.r, q.c, dest.r, dest.c);
        ev(G, { t: 'move', from: { r: q.r, c: q.c }, to: dest, p: opp, why: 'push' });
      } else if (C.lgWouldWin(G, q.r, q.c, p)) return;
      G.board[q.r][q.c] = p;
      G.craters = G.craters.filter(function (cr) { return !(cr.r === q.r && cr.c === q.c); });
      ev(G, { t: 'spawn', r: q.r, c: q.c, p: p });
    });
    G.lg.lostPos[p] = [];
    C.pruneTraps(G);
  }
  // 🦥 패의 카드를 모두 즉시 발동 (대상은 모두 무작위, 알까기는 제외, 턴 종료 카드는 다 끝난 뒤 한 번만)
  function resolveRandomPending(G) {
    for (var guard = 0; guard < 4 && G.pending; guard++) {
      var opts = [];
      for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (R.isValidTarget(G, r, c)) opts.push({ r: r, c: c });
      if (!opts.length) { R.cancel(G); return; }
      var q = opts[Math.floor(C.rnd(G) * opts.length)];
      R.target(G, q.r, q.c);
    }
    if (G.pending) R.cancel(G);
  }
  function slothRunAll(G, p) {
    var cards = G.hand[p].filter(function (id) { return id !== 'alkkagi'; });
    G.sloth = { p: p, passPending: false };
    cards.forEach(function (id) {
      if (G.gameOver) return;
      var idx = G.hand[p].indexOf(id); if (idx < 0) return;
      G.used[p] = false; G.lg.lastCard[p] = id;
      var res = C.execCard(G, idx);
      if (res.pending) resolveRandomPending(G);
    });
    var run = G.sloth; G.sloth = null;
    ev(G, { t: 'slothDone', n: cards.length });
    if (run.passPending && !G.gameOver) C.passTurn(G);
  }
  // 🎰 슬롯머신: 릴 3개가 같은 그림이면 잭팟(50%). 결과를 먼저 정하고 화면은 릴이 돌다 멈추는 연출만 보여 줌
  var SLOT = ['cherry', 'lemon', 'bell', 'diamond', 'seven'];
  function spinSlot(G, p) {
    var win = C.rnd(G) < 0.5, reels;
    if (win) { var s = SLOT[Math.floor(C.rnd(G) * SLOT.length)]; reels = [s, s, s]; }
    else { do { reels = [0, 1, 2].map(function () { return SLOT[Math.floor(C.rnd(G) * SLOT.length)]; }); } while (reels[0] === reels[1] && reels[1] === reels[2]); }
    ev(G, { t: 'slot', p: p, reels: reels, win: win });
    return win;
  }
  function allinCards(G, p) {
    var n = G.hand[p].length;
    G.hand[p] = [];
    ev(G, { t: 'handLost', p: p, n: n });
    if (spinSlot(G, p)) for (var k = 0; k < n * 2; k++) C.grantRandomCard(G, p);          // 패 한도를 넘으면 오래된 카드부터 버려짐
  }
  // 올인 (돌 걸기): 고른 돌을 걸고, 잭팟이면 건 개수만큼 판의 무작위 빈 칸에 새로 놓임 (승리 줄이 되는 칸은 건너뜀)
  function allinStones(G, p, picks) {
    picks.forEach(function (q) { C.removeStoneAt(G, q.r, q.c); ev(G, { t: 'remove', r: q.r, c: q.c, p: p, why: 'wager' }); });
    if (!spinSlot(G, p)) { C.pruneTraps(G); return; }
    var cells = [];
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      if (G.board[r][c] !== EMPTY || R.isBlockedForPlayer(G, r, c, p) || C.isZoneCell(G, r, c)) continue;
      cells.push({ r: r, c: c });
    }
    var put = 0;
    C.shuffle(G, cells).forEach(function (q) {
      if (put >= picks.length || G.board[q.r][q.c] !== EMPTY || C.lgWouldWin(G, q.r, q.c, p)) return;
      G.board[q.r][q.c] = p; put++; ev(G, { t: 'spawn', r: q.r, c: q.c, p: p });
    });
    C.pruneTraps(G);
  }

  /* ---------------- 무소유: 상대 카드에 대응 ---------------- */
  // yes 면 그 카드는 무효(카드는 소모, 차례는 그대로) · 대가로 내 패를 모두 버림. 아니면 그대로 발동
  function answerCounter(G, yes) {
    var cn = G.counter; if (!cn) return { ok: false };
    var holder = other(cn.user);
    G.counter = null;
    if (yes && G.lg.card[holder] === 'nothing' && !G.lg.done[holder] && G.hand[holder].length > 0) {
      var n = G.hand[holder].length;
      G.hand[holder] = []; G.lg.done[holder] = true;
      G.hand[cn.user].splice(cn.idx, 1); G.used[cn.user] = true;
      ev(G, { t: 'spend', p: cn.user, id: cn.id });
      ev(G, { t: 'counter', holder: holder, id: cn.id, n: n });
      return { ok: true, nullified: true };
    }
    var res = C.execCard(G, cn.idx);
    res.nullified = false;
    return res;
  }

  /* ---------------- 턴이 끝날 때 (passTurn 처음) ---------------- */
  function kingReturn(G, p) {
    var lg = G.lg; lg.king[p] = null;
    var n = 0;
    while (G.hand[p].length < C.handLimit(G, p) && n < 10) { C.grantRandomCard(G, p); n++; }
    var pool = R.LEGENDS.filter(function (c) { return c.id !== 'king'; });
    var next = pool[Math.floor(C.rnd(G) * pool.length)];
    lg.card[p] = next.id; lg.done[p] = false;                     // 새 전설 카드는 다시 비공개
    ev(G, { t: 'kingReturn', p: p, n: n });
  }
  R.H.turnEnd = function (G, p) {
    var lg = G.lg;
    lg.turnNo++;
    if (lg.big === p) lg.big = 0;
    if (!G.gameOver) {
      // 나무늘보: 카드를 쓰지 않고 돌을 둔 턴이 몇 번 이어졌는지
      var idle = !G.used[p] && !G.lgUsedThisTurn && G.placed.length > 0;
      lg.edge[p] = idle ? lg.edge[p] + 1 : 0;
      C.trimHand(G, p);
      var k = lg.king[p];                                         // 왕의 귀환: 왕이 쓰러지면 실패, 20턴 살아남으면 귀환
      if (k && G.board[k.r][k.c] !== p) { lg.king[p] = null; ev(G, { t: 'kingLost', p: p }); }
      else if (k && lg.turnNo - k.start >= 20) kingReturn(G, p);
    }
    G.lgUsedThisTurn = false;
  };
  R.H.legendTarget = legendTarget;

  R.legendProgress = legendProgress;
  R.canUseLegend = canUseLegend;
  R.useLegend = useLegend;
  R.answerCounter = answerCounter;
  R.countStones = countStones;
})(typeof window !== 'undefined' ? window.Rules : (typeof require === 'function' ? require('./rules.js') : self.Rules));
