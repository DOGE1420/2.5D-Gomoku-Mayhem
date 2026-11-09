/* 봇 두뇌 — 원본 증강 오목(Gomoku-ARAM)의 봇 알고리즘을 규칙 엔진(Rules)에 맞춰 옮김
 * 단계 1 · 3 · 5 · 7 · 10 · 20(얼티밋). (50 '슈퍼 울트라'의 엔진2·워커·정석은 아직 옮기지 않음)
 *   1·3  : 줄 점수만 보는 단순 평가 (반경·상위 N·수비 가중치·실수 확률이 다름)
 *   5    : 패턴 인식(띈 3·4, 4-4, 3-3) + 카드를 상황에 맞게 사용
 *   7    : + 2수 앞 읽기      10: + 4수 앞 읽기 · 연속 4(VCF) 탐색
 *   20   : 반복 심화 + 치환표 + 위협 가지치기 + 상대 VCF 차단 (수당 약 2.5초)
 * 규칙은 Rules(엔진)가 판정하고, 여기서는 판을 직접 바꿔 보며(말단에서 되돌림) 점수만 계산함.
 * 바깥에는 BotAI 하나만 내보냄.
 */
'use strict';

var BOT_LEVELS = {
  1:  { radius: 1, depth: 0, width: 0,  topN: 6, defense: 0.5,  missChance: 0.4, patterns: false, smartCards: false, vcf: false },
  3:  { radius: 2, depth: 0, width: 0,  topN: 3, defense: 0.85, missChance: 0.1, patterns: false, smartCards: false, vcf: false },
  5:  { radius: 2, depth: 0, width: 0,  topN: 1, defense: 0.9,  missChance: 0,   patterns: true,  smartCards: true,  vcf: false },
  7:  { radius: 2, depth: 2, width: 12, topN: 1, defense: 1,    missChance: 0,   patterns: true,  smartCards: true,  vcf: false },
  10: { radius: 3, depth: 4, width: 10, topN: 1, defense: 1,    missChance: 0,   patterns: true,  smartCards: true,  vcf: true },
  20: { radius: 2, depth: 12, width: 14, topN: 1, defense: 1,   missChance: 0,   patterns: true,  smartCards: true,  vcf: true, ultimate: true, timeMs: 2500 }
};
var BOT_LEVEL_LIST = [1, 3, 5, 7, 10, 20];

var BotAI = (function () {
  var SIZE = Rules.SIZE, EMPTY = Rules.EMPTY, BLACK = Rules.BLACK, WHITE = Rules.WHITE, WALL = Rules.WALL;
  var other = Rules.other, isStone = Rules.isStone, inBoard = Rules.inb;
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  var G = null, board = null, winLength = 5;
  var searchDeadline = 0;
  var P_FIVE = 10000000, P_OPEN4 = 1000000, P_FOUR = 100000, P_OPEN3 = 10000, P_THREE = 1000, P_OPEN2 = 300, P_TWO = 50;
  var WIN_SCORE = 1e9;

  function bind(g) { G = g; board = g.board; winLength = g.winLength; }
  function checkWin(r, c, p) { return Rules.core.checkWin(G, r, c, p); }
  function isProtected(r, c) { return Rules.isProtected(G, r, c); }
  function listStones(p) { return Rules.listStones(G, p); }
  function hasStoneOf(p) { return listStones(p).length > 0; }

  /* ---------------- 금지 칸 · 후보 ---------------- */
  // p 가 둘 수 없는 칸 (구멍 · 상대 풍차 주변 · 장벽/바위/자기장)
  function buildBlockedGrid(p) {
    var g = new Uint8Array(SIZE * SIZE);
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      var v = board[r][c];
      if (v === WALL || (v === EMPTY && Rules.isBlockedForPlayer(G, r, c, p))) g[r * SIZE + c] = 1;
    }
    return g;
  }
  function makeBlocked() { var o = {}; o[BLACK] = buildBlockedGrid(BLACK); o[WHITE] = buildBlockedGrid(WHITE); return o; }

  function collectCandidates(player, radius, blocked, respectChain) {
    radius = radius || 2;
    var any = false, r, c;
    for (r = 0; r < SIZE && !any; r++) for (c = 0; c < SIZE; c++) if (isStone(board[r][c])) { any = true; break; }
    var big = G.lg.big === player;                                     // 대기만성 턴은 거리 제한이 없음
    var chainActive = respectChain !== false && !big && G.done > 0 && G.placed.length > 0;
    function farEnough(rr, cc) { return !chainActive || !G.placed.some(function (p) { return Math.max(Math.abs(rr - p.r), Math.abs(cc - p.c)) <= 2; }); }
    if (!any) return [{ r: 7, c: 7 }];
    var cands = [];
    for (r = 0; r < SIZE; r++) for (c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY || blocked[player][r * SIZE + c] || !farEnough(r, c)) continue;
      var near = false;
      for (var dr = -radius; dr <= radius && !near; dr++) for (var dc = -radius; dc <= radius && !near; dc++) {
        var nr = r + dr, nc = c + dc;
        if (inBoard(nr, nc) && isStone(board[nr][nc])) near = true;
      }
      if (near) cands.push({ r: r, c: c });
    }
    if (cands.length) return cands;
    for (r = 0; r < SIZE; r++) for (c = 0; c < SIZE; c++) if (board[r][c] === EMPTY && !blocked[player][r * SIZE + c] && farEnough(r, c)) cands.push({ r: r, c: c });
    return cands;
  }

  /* ---------------- 단순 평가 (1 · 3단계) ---------------- */
  function lineScore(r, c, dr, dc, p) {
    var count = 1, open = 0, rr = r + dr, cc = c + dc;
    while (inBoard(rr, cc) && board[rr][cc] === p) { count++; rr += dr; cc += dc; }
    if (inBoard(rr, cc) && board[rr][cc] === EMPTY) open++;
    rr = r - dr; cc = c - dc;
    while (inBoard(rr, cc) && board[rr][cc] === p) { count++; rr -= dr; cc -= dc; }
    if (inBoard(rr, cc) && board[rr][cc] === EMPTY) open++;
    if (count >= winLength) return 10000000;
    var gap = winLength - count;
    if (gap === 1) return open === 2 ? 500000 : open === 1 ? 50000 : 0;
    if (gap === 2) return open === 2 ? 5000 : open === 1 ? 500 : 0;
    if (gap === 3) return open === 2 ? 200 : open === 1 ? 50 : 0;
    return count * 2 + open;
  }
  function simpleCellScore(r, c, player, defense) {
    var opp = other(player), off = 0, def = 0, i;
    board[r][c] = player; for (i = 0; i < 4; i++) off = Math.max(off, lineScore(r, c, DIRS[i][0], DIRS[i][1], player));
    board[r][c] = opp; for (i = 0; i < 4; i++) def = Math.max(def, lineScore(r, c, DIRS[i][0], DIRS[i][1], opp));
    board[r][c] = EMPTY;
    return off + def * defense;
  }

  /* ---------------- 패턴 인식 (5단계~) ---------------- */
  function realFiveAt(idx, player) {
    var r = (idx / SIZE) | 0, c = idx % SIZE;
    board[r][c] = player; var ok = !!checkWin(r, c, player); board[r][c] = EMPTY;
    return ok;
  }
  function lineShape(r, c, dr, dc, player, blk) {
    var L = winLength, best = 0, winCell = -1, winCells = 0, near = 0;
    for (var s = -(L - 1); s <= 0; s++) {
      var n = 0, ok = true, empty = -1;
      for (var k = 0; k < L; k++) {
        var rr = r + (s + k) * dr, cc = c + (s + k) * dc;
        if (!inBoard(rr, cc)) { ok = false; break; }
        var v = board[rr][cc];
        if (v === player) n++;
        else if (v === EMPTY && !blk[rr * SIZE + cc]) empty = rr * SIZE + cc;
        else { ok = false; break; }
      }
      if (!ok) continue;
      if (n > best) best = n;
      if (n === L - 1 && empty !== winCell && realFiveAt(empty, player)) { if (winCell === -1 || winCells < 2) winCells++; winCell = empty; }
      if (n === L - 2) near++;
    }
    return { best: best, winCells: winCells, near: near };
  }
  // player 가 (r,c) 에 두었을 때의 공격 가치
  function attackValue(r, c, player, blk) {
    var L = winLength, score = 0, fours = 0, open3 = 0, five = false;
    board[r][c] = player;
    for (var i = 0; i < 4; i++) {
      var s = lineShape(r, c, DIRS[i][0], DIRS[i][1], player, blk);
      if (s.best >= L) { if (checkWin(r, c, player)) { five = true; break; } continue; }   // 장목은 승리 아님
      if (s.winCells >= 2) { score += P_OPEN4; fours += 2; }
      else if (s.winCells === 1) { score += P_FOUR; fours++; }
      else if (s.best === L - 2) { if (s.near >= 2) { score += P_OPEN3; open3++; } else score += P_THREE; }
      else if (s.best === L - 3) score += s.near >= 1 ? P_OPEN2 : P_TWO;
      else score += s.best;
    }
    board[r][c] = EMPTY;
    if (five) return { score: P_FIVE, five: true, fours: 0 };
    if (fours >= 2 || (fours >= 1 && open3 >= 1)) score += P_OPEN4 / 2;      // 4-4, 4-3: 사실상 필승
    else if (open3 >= 2) score += P_OPEN3 * 5;                                // 3-3
    return { score: score, five: false, fours: fours };
  }
  function patternCellScore(r, c, player, blocked, defense) {
    var opp = other(player), a = attackValue(r, c, player, blocked[player]);
    var d = blocked[opp][r * SIZE + c] ? { score: 0, five: false } : attackValue(r, c, opp, blocked[opp]);
    return { score: a.score + d.score * defense, win: a.five, mustBlock: d.five, fours: a.fours };
  }

  /* ---------------- 판 전체 평가 · 수 읽기 ---------------- */
  function windowWeight(n) { var g = winLength - n; return g <= 0 ? 10000000 : g === 1 ? 800 : g === 2 ? 70 : g === 3 ? 8 : g === 4 ? 1 : 0; }
  function evalBoard(me, blocked) {
    var opp = other(me), L = winLength, sMe = 0, sOpp = 0;
    for (var d = 0; d < 4; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1];
      for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
        var er = r + (L - 1) * dr, ec = c + (L - 1) * dc;
        if (!inBoard(er, ec)) continue;
        var nMe = 0, nOpp = 0, bMe = false, bOpp = false;
        for (var k = 0; k < L; k++) {
          var rr = r + k * dr, cc = c + k * dc, v = board[rr][cc];
          if (v === me) nMe++;
          else if (v === opp) nOpp++;
          else { var i = rr * SIZE + cc; if (blocked[me][i]) bMe = true; if (blocked[opp][i]) bOpp = true; }
        }
        if (nOpp === 0 && nMe > 0 && !bMe) sMe += windowWeight(nMe);
        if (nMe === 0 && nOpp > 0 && !bOpp) sOpp += windowWeight(nOpp);
      }
    }
    return sMe - sOpp * 1.1;
  }
  function orderedMoves(player, blocked, cfg, width, isRoot) {
    var cands = collectCandidates(player, cfg.radius, blocked, isRoot), scored = [], blocks = [];
    for (var i = 0; i < cands.length; i++) {
      var p = cands[i], s = patternCellScore(p.r, p.c, player, blocked, cfg.defense);
      if (s.win) return { win: p, list: [p] };
      if (s.mustBlock) blocks.push({ r: p.r, c: p.c, score: s.score });
      scored.push({ r: p.r, c: p.c, score: s.score });
    }
    var list = blocks.length ? blocks : scored;                          // 상대가 다음에 이기는 자리가 있으면 막는 수만 검토
    list.sort(function (a, b) { return b.score - a.score; });
    return { win: null, list: width ? list.slice(0, width) : list, forced: blocks.length > 0 };
  }
  function negamax(player, depth, alpha, beta, blocked, cfg) {
    var moves = orderedMoves(player, blocked, cfg, cfg.width, false);
    if (moves.win) return WIN_SCORE + depth;
    if (!moves.list.length) return 0;
    if (depth <= 0 || Date.now() > searchDeadline) return evalBoard(player, blocked);
    var opp = other(player), best = -Infinity;
    for (var i = 0; i < moves.list.length; i++) {
      var m = moves.list[i];
      board[m.r][m.c] = player;
      var v = -negamax(opp, depth - 1, -beta, -alpha, blocked, cfg);
      board[m.r][m.c] = EMPTY;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  function findWinCells(player, blk) {
    var cells = [];
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY || blk[r * SIZE + c]) continue;
      board[r][c] = player; var w = checkWin(r, c, player); board[r][c] = EMPTY;
      if (w) cells.push({ r: r, c: c });
    }
    return cells;
  }
  // 연속 4(VCF): 계속 4를 만들어 상대가 막을 수밖에 없게 몰아 이기는 수순
  function vcf(player, depth, blocked, isRoot) {
    if (depth <= 0 || Date.now() > searchDeadline) return null;
    var opp = other(player);
    if (findWinCells(opp, blocked[opp]).length) return null;
    var cands = collectCandidates(player, 2, blocked, !!isRoot);
    for (var i = 0; i < cands.length; i++) {
      var p = cands[i], a = attackValue(p.r, p.c, player, blocked[player]);
      if (a.five) return p;
      if (a.fours < 1) continue;
      board[p.r][p.c] = player;
      var wins = findWinCells(player, blocked[player]), ok = false;
      if (wins.length >= 2) ok = true;
      else if (wins.length === 1) {
        var w = wins[0];
        if (!blocked[opp][w.r * SIZE + w.c]) {
          board[w.r][w.c] = opp;
          ok = !checkWin(w.r, w.c, opp) && vcf(player, depth - 1, blocked) !== null;
          board[w.r][w.c] = EMPTY;
        } else ok = true;
      }
      board[p.r][p.c] = EMPTY;
      if (ok) return p;
    }
    return null;
  }

  /* ---------------- 얼티밋(20): 반복 심화 + 치환표 + 위협 가지치기 ---------------- */
  var ZOB = (function () {
    var r32 = function () { return (Math.random() * 4294967296) >>> 0; }, z = {};
    z[BLACK] = []; z[WHITE] = [];
    for (var i = 0; i < SIZE * SIZE; i++) { z[BLACK].push([r32(), r32() & 0x7FFFF]); z[WHITE].push([r32(), r32() & 0x7FFFF]); }
    return z;
  })();
  var U_WIDTHS = [14, 10, 8, 7, 6, 5, 5, 4, 4, 4, 4, 4], uDefense = 0.95;
  var uTT = new Map(), uAborted = false, uNodes = 0;
  function uHashBoard() {
    var h1 = 0, h2 = 0;
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) { var v = board[r][c]; if (isStone(v)) { var z = ZOB[v][r * SIZE + c]; h1 ^= z[0]; h2 ^= z[1]; } }
    return [h1 >>> 0, h2];
  }
  function uKey(h, player) { return ((h[0] * 524288 + h[1]) * 2) + (player === BLACK ? 0 : 1); }
  function uPlace(h, r, c, player) { var z = ZOB[player][r * SIZE + c]; return [(h[0] ^ z[0]) >>> 0, h[1] ^ z[1]]; }
  function uOrdered(player, blocked, width, isRoot) {
    var opp = other(player), cands = collectCandidates(player, 2, blocked, isRoot), all = [], blocks = [], critical = [];
    for (var i = 0; i < cands.length; i++) {
      var p = cands[i], idx = p.r * SIZE + p.c, a = attackValue(p.r, p.c, player, blocked[player]);
      if (a.five) return { win: p, list: [p] };
      var d = blocked[opp][idx] ? { score: 0, five: false } : attackValue(p.r, p.c, opp, blocked[opp]);
      var m = { r: p.r, c: p.c, score: a.score + d.score * uDefense };
      all.push(m);
      if (d.five) blocks.push(m);
      else if (d.score >= P_OPEN4 || a.fours >= 1) critical.push(m);
    }
    var list = all, forced = false;
    if (blocks.length) { list = blocks; forced = true; }
    else if (critical.length && critical.some(function (m) { return m.score >= P_OPEN4 * 0.9; })) list = critical;
    list.sort(function (a, b) { return b.score - a.score; });
    return { win: null, list: width ? list.slice(0, width) : list, forced: forced };
  }
  function uSearch(player, depth, alpha, beta, blocked, h, ply) {
    if ((++uNodes & 255) === 0 && Date.now() > searchDeadline) uAborted = true;
    if (uAborted) return 0;
    var key = uKey(h, player), e = uTT.get(key), alpha0 = alpha;
    if (e && e.depth >= depth) {
      if (e.flag === 0) return e.value;
      if (e.flag === 1 && e.value > alpha) alpha = e.value;
      else if (e.flag === 2 && e.value < beta) beta = e.value;
      if (alpha >= beta) return e.value;
    }
    var moves = uOrdered(player, blocked, U_WIDTHS[Math.min(ply, U_WIDTHS.length - 1)], false);
    if (moves.win) return WIN_SCORE - ply;
    if (!moves.list.length) return 0;
    if (depth <= 0) return evalBoard(player, blocked);
    if (e && e.best !== undefined) {
      var bi = -1; moves.list.forEach(function (m, i) { if (m.r * SIZE + m.c === e.best) bi = i; });
      if (bi > 0) moves.list.unshift(moves.list.splice(bi, 1)[0]);
    }
    var opp = other(player), best = -Infinity, bestIdx;
    for (var i = 0; i < moves.list.length; i++) {
      var m = moves.list[i];
      board[m.r][m.c] = player;
      var v = -uSearch(opp, depth - 1, -beta, -alpha, blocked, uPlace(h, m.r, m.c, player), ply + 1);
      board[m.r][m.c] = EMPTY;
      if (uAborted) return 0;
      if (v > best) { best = v; bestIdx = m.r * SIZE + m.c; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    uTT.set(key, { depth: depth, value: best, flag: best <= alpha0 ? 2 : best >= beta ? 1 : 0, best: bestIdx });
    return best;
  }
  function ultimateChooseMove(botColor, blocked, budgetMs, cfg) {
    var opp = other(botColor);
    uDefense = 0.95;
    searchDeadline = Date.now() + budgetMs;
    var root = uOrdered(botColor, blocked, 0, true);
    if (root.win) return root.win;
    if (!root.list.length) return null;
    if (root.forced && root.list.length === 1) return root.list[0];
    if (!root.forced) { var v = vcf(botColor, 14, blocked, true); if (v) return v; }
    var moves = root.list.slice(0, 16);
    if (!root.forced && vcf(opp, 12, blocked, false)) {                    // 상대에게 연속 4로 이기는 수순이 있으면 그걸 끊는 수만
      var safe = moves.filter(function (m) {
        board[m.r][m.c] = botColor; var threat = vcf(opp, 12, blocked, false); board[m.r][m.c] = EMPTY; return !threat;
      });
      if (safe.length) moves = safe;
    }
    if (moves.length === 1) return moves[0];
    uTT = new Map(); uAborted = false; uNodes = 0;
    var h0 = uHashBoard(), bestMove = moves[0];
    for (var depth = 2; depth <= 12; depth++) {
      var iterBest = null, iterVal = -Infinity, alpha = -Infinity;
      var ordered = [bestMove].concat(moves.filter(function (m) { return m !== bestMove; }));
      for (var i = 0; i < ordered.length; i++) {
        var m = ordered[i];
        board[m.r][m.c] = botColor;
        var val = -uSearch(opp, depth - 1, -Infinity, -alpha, blocked, uPlace(h0, m.r, m.c, botColor), 1) + m.score * 1e-7;
        board[m.r][m.c] = EMPTY;
        if (uAborted) break;
        if (val > iterVal) { iterVal = val; iterBest = m; }
        if (val > alpha) alpha = val;
      }
      if (uAborted) { if (iterBest && iterVal > -WIN_SCORE / 2 && iterBest === ordered[0]) bestMove = iterBest; break; }
      bestMove = iterBest || bestMove;
      if (iterVal >= WIN_SCORE / 2) break;
      if (Date.now() > searchDeadline - budgetMs * 0.45) break;
    }
    return bestMove;
  }

  /* ---------------- 착수 선택: 시도할 칸의 우선순위 목록 ---------------- */
  function chooseMove(botColor, cfg) {
    var blocked = makeBlocked(), opp = other(botColor);
    if (!cfg.patterns) {
      var cands = collectCandidates(botColor, cfg.radius, blocked, true);
      if (!cands.length) return null;
      var defense = Math.random() < cfg.missChance ? 0.1 : cfg.defense;
      var scored = cands.map(function (p) { return { r: p.r, c: p.c, score: simpleCellScore(p.r, p.c, botColor, defense) }; });
      scored.sort(function (a, b) { return b.score - a.score; });
      var pool = scored.slice(0, Math.min(cfg.topN, scored.length));
      return pool[Math.floor(Math.random() * pool.length)];
    }
    if (cfg.ultimate) return ultimateChooseMove(botColor, blocked, G.done > 0 ? 900 : cfg.timeMs, cfg);
    searchDeadline = Date.now() + 1500;
    var root = orderedMoves(botColor, blocked, cfg, 0, true);
    if (root.win) return root.win;
    if (!root.list.length) return null;
    if (root.forced && root.list.length === 1) return root.list[0];
    if (cfg.vcf && !root.forced) { var v = vcf(botColor, 8, blocked, true); if (v) return v; }
    if (cfg.depth <= 0) return root.list[0];
    var moves = root.list.slice(0, cfg.width), best = moves[0], bestVal = -Infinity, alpha = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      board[m.r][m.c] = botColor;
      var val = -negamax(opp, cfg.depth - 1, -Infinity, -alpha, blocked, cfg) + m.score * 1e-6;   // 동점이면 패턴 점수가 높은 수
      board[m.r][m.c] = EMPTY;
      if (val > bestVal) { bestVal = val; best = m; }
      if (val > alpha) alpha = val;
      if (Date.now() > searchDeadline) break;
    }
    return best;
  }

  /* ---------------- 거대한 돌 · 보조 ---------------- */
  // 거대한 돌을 떨어뜨릴 가장 좋은 자리 (상대 돌 +1, 내 돌 -1.2, 상대가 바로 이기는 칸을 덮으면 크게)
  function bestGiantCell(p) {
    var opp = other(p), blk = makeBlocked(), oppWins = findWinCells(opp, blk[opp]), best = null;
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY || blk[p][r * SIZE + c]) continue;
      var score = 0, blocksWin = false, dr, dc, rr, cc;
      for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++) {
        rr = r + dr; cc = c + dc;
        if (!inBoard(rr, cc)) continue;
        if (board[rr][cc] === opp) score += 1; else if (board[rr][cc] === p) score -= 1.2;
      }
      if (oppWins.length) {
        var saved = [];
        for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++) { rr = r + dr; cc = c + dc; if (inBoard(rr, cc)) { saved.push([rr, cc, board[rr][cc]]); board[rr][cc] = WALL; } }
        blocksWin = findWinCells(opp, makeBlocked()[opp]).length === 0;
        saved.forEach(function (s) { board[s[0]][s[1]] = s[2]; });
        if (blocksWin) score += 10;
      }
      if (!best || score > best.score) best = { r: r, c: c, score: score, blocksWin: blocksWin };
    }
    return best;
  }
  function hasOpenFourThreat(player, blocked) {
    var cands = collectCandidates(player, 2, blocked, false);
    for (var i = 0; i < cands.length; i++) if (attackValue(cands[i].r, cands[i].c, player, blocked[player]).score >= P_OPEN4) return true;
    return false;
  }
  function orthEnemyNeighbors(player) {
    var opp = other(player), seen = {}, out = [], O = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      if (board[r][c] !== player) continue;
      for (var i = 0; i < 4; i++) {
        var nr = r + O[i][0], nc = c + O[i][1];
        if (!inBoard(nr, nc) || board[nr][nc] !== opp || isProtected(nr, nc)) continue;
        var k = nr * SIZE + nc; if (!seen[k]) { seen[k] = 1; out.push({ r: nr, c: nc }); }
      }
    }
    return out;
  }
  function swapMakesLine(r1, c1, r2, c2) {
    var v1 = board[r1][c1], v2 = board[r2][c2];
    board[r1][c1] = v2; board[r2][c2] = v1;
    var made = !!(checkWin(r1, c1, v2) || checkWin(r2, c2, v1));
    board[r1][c1] = v1; board[r2][c2] = v2;
    return made;
  }

  /* ---------------- 카드 사용 판단 (5단계~) ---------------- */
  var CARD_PRIORITY = ['chain', 'windmill', 'giant', 'wall', 'bomb', 'snipe', 'double', 'shield', 'trap', 'sixsense', 'trade', 'blockade', 'weather', 'infection', 'reversal', 'meteor', 'teleport', 'earthquake', 'alkkagi'];
  // 지금 쓸 카드와 대상: { idx, value, targets } 또는 null
  function chooseCard(me) {
    var opp = other(me), blocked = makeBlocked();
    var myWins = findWinCells(me, blocked[me]);
    if (myWins.length) return null;                                        // 바로 이길 수 있으면 카드 없이 둔다
    var oppWins = findWinCells(opp, blocked[opp]), base = evalBoard(me, blocked), hand = G.hand[me];
    var oppHasCards = G.hand[opp].length > 0, best = null;
    var consider = function (idx, value, targets) { if (value > 0 && (!best || value > best.value)) best = { idx: idx, value: value, targets: targets }; };
    var handLen = hand.length, draftSoon = G.placedCount[me] % Rules.INTERVAL === Rules.INTERVAL - 1;
    var overflowSoon = handLen >= Rules.handLimit(G, me) && draftSoon;       // 쓰지 않으면 오래된 카드가 소멸
    var scale = overflowSoon ? 0.25 : handLen >= 3 ? 0.6 : 1;                // 급할수록 사용 기준을 낮춤
    var oppCritical = oppWins.length > 0 || hasOpenFourThreat(opp, blocked);

    hand.forEach(function (id, idx) {
      var s, i, j, g, pool, sum, exp;
      switch (id) {
        case 'chain': consider(idx, 3000 + (oppWins.length >= 2 ? 50000 : 0)); break;
        case 'bomb': {                                                      // 상대 공격의 핵심 돌을 끊는 데 사용 (터진 자리는 2턴간 막힘)
          var bestT = null, bestGain = -Infinity, stones = listStones(opp);
          for (i = 0; i < stones.length; i++) {
            s = stones[i]; if (isProtected(s.r, s.c)) continue;
            var k = s.r * SIZE + s.c;
            board[s.r][s.c] = EMPTY; blocked[opp][k] = 1; blocked[me][k] = 1;
            var remain = findWinCells(opp, blocked[opp]).length;
            g = evalBoard(me, blocked) - base - remain * 1e6;
            blocked[opp][k] = 0; blocked[me][k] = 0; board[s.r][s.c] = opp;
            if (g > bestGain) { bestGain = g; bestT = s; }
          }
          if (!bestT) break;
          if (oppWins.length >= 2) consider(idx, 40000, [bestT]);
          else if (oppCritical && bestGain > 0) consider(idx, 4000 + bestGain, [bestT]);
          else if (bestGain > 700 * scale) consider(idx, 2000 + bestGain, [bestT]);
          break;
        }
        case 'windmill': {                                                  // 상대가 둬야 할 자리를 풍차로 막는다
          var bT = null, bG = 0, mine = listStones(me);
          for (i = 0; i < mine.length; i++) {
            s = mine[i]; if (Rules.isWindmill(G, s.r, s.c)) continue;
            g = 0;
            for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
              var r = s.r + dr, c = s.c + dc;
              if ((!dr && !dc) || !inBoard(r, c) || board[r][c] !== EMPTY || blocked[opp][r * SIZE + c]) continue;
              g += Math.min(attackValue(r, c, opp, blocked[opp]).score, P_OPEN4);
            }
            if (g > bG) { bG = g; bT = s; }
          }
          if (bT && bG >= P_THREE) consider(idx, Math.min(bG, 60000), [bT]);
          break;
        }
        case 'trade': {
          var bestPair = null, bg = 0, theirs = listStones(opp), mine2 = listStones(me);
          for (i = 0; i < theirs.length; i++) for (j = 0; j < mine2.length; j++) {
            var a = theirs[i], b = mine2[j];
            if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1 || isProtected(a.r, a.c) || swapMakesLine(a.r, a.c, b.r, b.c)) continue;
            board[a.r][a.c] = me; board[b.r][b.c] = opp;
            g = evalBoard(me, blocked) - base;
            board[a.r][a.c] = opp; board[b.r][b.c] = me;
            if (g > bg) { bg = g; bestPair = [a, b]; }
          }
          if (bestPair && bg > 900 * scale) consider(idx, bg, bestPair);   // 턴이 끝나므로 이득이 클 때만
          break;
        }
        case 'sixsense': {
          if (winLength === 6) break;
          winLength = 6; G.winLength = 6;
          g = evalBoard(me, blocked) - base;
          var oppWins6 = findWinCells(opp, blocked[opp]).length;
          winLength = G.winLength = 5;
          if (oppWins.length && !oppWins6) consider(idx, 45000);
          else if (g > 150 * scale) consider(idx, 300 + g);
          else if (overflowSoon && idx === 0 && g > -150) consider(idx, 200);
          break;
        }
        case 'reversal': {
          var flipped = -evalBoard(me, blocked);
          if (flipped - base > Math.max(800, 3000 * scale)) consider(idx, flipped - base);
          break;
        }
        case 'trap': {                                                      // 상대가 가장 두고 싶어하는 자리
          var tc = collectCandidates(opp, 2, blocked, false)
            .filter(function (p) { return !G.traps.some(function (t) { return t.r === p.r && t.c === p.c; }); })
            .map(function (p) { return { p: p, s: attackValue(p.r, p.c, opp, blocked[opp]).score - attackValue(p.r, p.c, me, blocked[me]).score }; })
            .sort(function (x, y) { return y.s - x.s; });
          if (tc.length) consider(idx, 1500, [tc[0].p]);
          break;
        }
        case 'blockade': if (oppHasCards) consider(idx, 1200); break;
        case 'infection': {
          if (oppWins.length) break;
          var tg = orthEnemyNeighbors(me); if (tg.length < 2) break;
          sum = 0;
          tg.forEach(function (t) { board[t.r][t.c] = me; sum += evalBoard(me, blocked) - base; board[t.r][t.c] = opp; });
          exp = (sum / tg.length) * Math.min(2, tg.length);
          if (exp > 450 * scale) consider(idx, exp);
          break;
        }
        case 'wall': {                                                      // 상대가 바로 이기는 자리를 막거나 급소를 영구 봉쇄
          var wc = collectCandidates(opp, 2, blocked, false)
            .filter(function (p) { return !G.traps.some(function (t) { return t.r === p.r && t.c === p.c; }); })
            .map(function (p) { return { p: p, s: attackValue(p.r, p.c, opp, blocked[opp]).score }; })
            .sort(function (x, y) { return y.s - x.s; });
          if (oppWins.length >= 2) consider(idx, 46000, [oppWins[0]]);
          else if (wc.length && wc[0].s >= P_OPEN3) consider(idx, 2500 + Math.min(wc[0].s, P_OPEN4) / 100, [wc[0].p]);
          else if (overflowSoon && idx === 0 && wc.length) consider(idx, 300, [wc[0].p]);
          break;
        }
        case 'snipe': {                                                     // 무작위 2개 제거 → 한 개씩 뺐을 때 이득의 평균 × 2
          pool = listStones(opp).filter(function (q) { return !isProtected(q.r, q.c); });
          if (!pool.length || oppCritical) break;
          sum = 0;
          pool.forEach(function (q) {
            board[q.r][q.c] = EMPTY; var gg = evalBoard(me, blocked) - base;
            if (oppWins.length && !findWinCells(opp, blocked[opp]).length) gg += 20000;
            board[q.r][q.c] = opp; sum += gg;
          });
          exp = sum / pool.length * Math.min(2, pool.length);
          if (exp > 1000 * scale) consider(idx, 800 + exp / 2);
          break;
        }
        case 'double': if (hand.length <= Rules.handLimit(G, me) - 1) consider(idx, 900); break;
        case 'giant': {
          var gc = bestGiantCell(me);
          if (gc && gc.blocksWin) consider(idx, 40000);
          else if (gc && gc.score >= 2) consider(idx, 900 + gc.score * 400);
          break;
        }
        case 'weather': consider(idx, overflowSoon && idx === 0 ? 150 : 40); break;
        case 'meteor': {                                                    // 무작위 돌 1개 파괴 → 어느 돌이든 사라질 때의 평균 효과
          pool = listStones(BLACK).concat(listStones(WHITE)).filter(function (q) { return !isProtected(q.r, q.c); });
          if (!pool.length) break;
          sum = 0;
          pool.forEach(function (t) {
            var v = board[t.r][t.c]; board[t.r][t.c] = EMPTY;
            var gg = evalBoard(me, blocked) - base;
            if (oppWins.length && !findWinCells(opp, blocked[opp]).length) gg += 20000;
            if (findWinCells(me, blocked[me]).length < myWins.length) gg -= 20000;
            board[t.r][t.c] = v; sum += gg;
          });
          exp = sum / pool.length;
          if (exp > 400 * scale) consider(idx, 1000 + exp);
          else if (overflowSoon && idx === 0 && exp > -200) consider(idx, 150);
          break;
        }
        case 'shield': if (overflowSoon && idx === 0 && hasStoneOf(me)) consider(idx, 200); break;
        case 'earthquake': case 'alkkagi':                                  // 불리할 때 판을 흔드는 용도, 곧 버려질 카드면 크게 이기고 있지 않을 때
          if (oppWins.length >= 2 || base < -1500) consider(idx, 800);
          else if (overflowSoon && idx === 0 && base < 1500) consider(idx, 150);
          break;
        case 'teleport': {                                                  // 곧 버려질 카드면 판에 가장 도움이 덜 되는 내 돌을 옮김
          if (!(overflowSoon || (handLen >= 3 && idx === 0))) break;
          var tT = null, least = Infinity;
          listStones(me).forEach(function (st) {
            board[st.r][st.c] = EMPTY; var loss = base - evalBoard(me, blocked); board[st.r][st.c] = me;
            if (loss < least) { least = loss; tT = st; }
          });
          if (tT && least < 60) consider(idx, 120, [tT]);
          break;
        }
      }
    });
    return best;
  }

  /* ---------------- 카드 뽑기 (5단계~) ---------------- */
  var LEGEND_PRIORITY = ['king', 'latebloom', 'obelisk', 'clown', 'turtle', 'blind', 'allin', 'nothing', 'mirror', 'sloth'];
  var ABILITY_PRIORITY = ['sturdy', 'pouch', 'clover', 'umbrella', 'retry'];
  function pickDraft(picks, me, kind) {
    if (kind === 'legend') return picks.slice().sort(function (a, b) { return LEGEND_PRIORITY.indexOf(a) - LEGEND_PRIORITY.indexOf(b); })[0];
    var opp = other(me), blk = makeBlocked(), base = 0, oppThreat = false;
    try { base = evalBoard(me, blk); oppThreat = hasOpenFourThreat(opp, blk); } catch (e) {}
    var score = function (id) {
      var v = CARD_PRIORITY.length - CARD_PRIORITY.indexOf(id);
      v -= 4 * G.hand[me].filter(function (h) { return h === id; }).length;        // 같은 카드는 겹쳐 쥐지 않음
      if (base < -1500 && (id === 'reversal' || id === 'earthquake' || id === 'alkkagi')) v += 6;
      if (oppThreat && (id === 'bomb' || id === 'sixsense' || id === 'windmill')) v += 4;
      return v;
    };
    return picks.slice().sort(function (a, b) { return score(b) - score(a); })[0];
  }

  /* ---------------- 바깥으로 ---------------- */
  return {
    // 매 판단 전에 현재 상태(G)를 연결
    bind: bind,
    chooseMove: function (g, me, cfg) { bind(g); return chooseMove(me, cfg); },
    chooseCard: function (g, me) { bind(g); return chooseCard(me); },
    pickDraft: function (g, picks, me, kind) { bind(g); return pickDraft(picks, me, kind); },
    bestGiantCell: function (g, me) { bind(g); return bestGiantCell(me); },
    winCells: function (g, p) { bind(g); return findWinCells(p, makeBlocked()[p]); },
    longestEval: function (g, me) { bind(g); return evalBoard(me, makeBlocked()); },
    ABILITY_PRIORITY: ABILITY_PRIORITY
  };
})();
