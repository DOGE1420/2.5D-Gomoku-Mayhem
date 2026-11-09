/* 맵 자연재해 · 자기장 (원본 Gomoku-ARAM 의 world.js 를 규칙 엔진에 맞춰 옮김)
 * - 라운드 = 흑·백이 한 번씩 둔 것. 백의 턴이 끝나 흑 차례가 될 때 1 증가하고 그때 아래 효과가 일어남
 * - 맵: 여름(녹음) · 겨울(얼음) · 우주(웜홀, 승리 판정은 rules.js) · 사막(모래폭풍) · 장마(쓰나미)
 * - 자기장(모든 맵): 15라운드부터 5라운드마다 바깥 한 줄씩 닫힘, 최대 3줄
 * rules.js 다음에 불러와야 함.
 */
(function (R) {
  'use strict';
  var C = R.core, SIZE = R.SIZE, EMPTY = R.EMPTY, WALL = R.WALL, BLACK = R.BLACK, WHITE = R.WHITE;
  var ev = C.ev, ZONE = C.ZONE;
  var DIR4 = [{ k: 'up', dr: -1, dc: 0 }, { k: 'down', dr: 1, dc: 0 }, { k: 'left', dr: 0, dc: -1 }, { k: 'right', dr: 0, dc: 1 }];
  var DIR_KO = { up: '위쪽', down: '아래쪽', left: '왼쪽', right: '오른쪽' };

  // 자기장 안이 아닌 p의 돌
  function stonesOf(G, p) { return C.listStones(G, p).filter(function (q) { return !C.isZoneCell(G, q.r, q.c); }); }

  // ☀️ 여름: 흑돌·백돌이 하나씩 무작위로 녹아 사라짐
  function melt(G) {
    var n = 0;
    [BLACK, WHITE].forEach(function (p) {
      if (!C.disasterHits(G, p)) return;
      var list = stonesOf(G, p); if (!list.length) return;
      var q = list[Math.floor(C.rnd(G) * list.length)];
      C.removeStoneAt(G, q.r, q.c); C.lgLose(G, p, q.r, q.c, 0); n++;
      ev(G, { t: 'remove', r: q.r, c: q.c, p: p, why: 'melt' });
    });
    if (n) ev(G, { t: 'disaster', kind: 'melt', n: n });
  }
  // ❄️ 겨울: 무작위 돌 하나가 2라운드 동안 얼음(누구의 돌도 아님) → 녹으면 원래 주인에게
  function freeze(G) {
    var list = [];
    [BLACK, WHITE].filter(function (p) { return C.disasterHits(G, p); }).forEach(function (p) { stonesOf(G, p).forEach(function (q) { list.push({ r: q.r, c: q.c, owner: p }); }); });
    if (!list.length) return;
    var q = list[Math.floor(C.rnd(G) * list.length)];
    G.board[q.r][q.c] = WALL;
    G.frozen.push({ r: q.r, c: q.c, owner: q.owner, rounds: 2 });
    ev(G, { t: 'freeze', r: q.r, c: q.c, owner: q.owner });
    ev(G, { t: 'disaster', kind: 'freeze', owner: q.owner });
  }
  // 🏜️ 사막: 모래폭풍 — 모든 돌이 무작위 방향으로 한 칸씩 (승리 줄이 되는 이동은 없음)
  function sandstorm(G) {
    var d = DIR4[Math.floor(C.rnd(G) * 4)], moves = [];
    var stones = [];
    [BLACK, WHITE].filter(function (p) { return C.disasterHits(G, p); }).forEach(function (p) { stones = stones.concat(C.listStones(G, p)); });
    stones.sort(function (a, b) { return (b.r * d.dr + b.c * d.dc) - (a.r * d.dr + a.c * d.dc); });   // 바람이 향하는 쪽 앞의 돌부터 움직여야 뒤의 돌이 따라 밀림
    stones.forEach(function (q) {
      var v = G.board[q.r][q.c], nr = q.r + d.dr, nc = q.c + d.dc;
      if (!R.inb(nr, nc) || G.board[nr][nc] !== EMPTY || C.isCrater(G, nr, nc)) return;
      G.board[nr][nc] = v; G.board[q.r][q.c] = EMPTY; C.moveMeta(G, q.r, q.c, nr, nc);
      if (C.checkWin(G, nr, nc, v)) { G.board[q.r][q.c] = v; G.board[nr][nc] = EMPTY; C.moveMeta(G, nr, nc, q.r, q.c); return; }
      moves.push({ from: { r: q.r, c: q.c }, to: { r: nr, c: nc }, p: v });
    });
    G.lastMove = null;
    ev(G, { t: 'sandstorm', dir: d.k, moves: moves });
    ev(G, { t: 'disaster', kind: 'sandstorm', n: moves.length, dir: DIR_KO[d.k] });
  }
  // 🌧️ 장마: 지진 뒤 쓰나미가 한쪽 가장자리 3줄의 돌을 쓸어 감
  function tsunami(G) {
    var d = DIR4[Math.floor(C.rnd(G) * 4)], n = 0;
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      var v = G.board[r][c];
      if (!R.isStone(v) || !C.disasterHits(G, v)) continue;
      var dist = d.k === 'up' ? r : d.k === 'down' ? SIZE - 1 - r : d.k === 'left' ? c : SIZE - 1 - c;
      if (dist >= 3) continue;
      C.removeStoneAt(G, r, c); C.lgLose(G, v, r, c, 0); n++;
      ev(G, { t: 'remove', r: r, c: c, p: v, why: 'tsunami' });
    }
    C.pruneTraps(G);
    ev(G, { t: 'disaster', kind: 'tsunami', n: n, dir: DIR_KO[d.k] });
  }
  // ⚡ 자기장: 바깥 한 줄이 닫힘 — 그 줄의 돌은 사라지고 아무도 둘 수 없음
  function zoneShrink(G) {
    var z = G.zone, n = 0;
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      if (R.ringOf(r, c) !== z) continue;
      if (R.isStone(G.board[r][c])) { var v = G.board[r][c]; C.removeStoneAt(G, r, c); C.lgLose(G, v, r, c, 0); n++; ev(G, { t: 'remove', r: r, c: c, p: v, why: 'zone' }); }
      G.board[r][c] = WALL;
    }
    G.zone = z + 1; G.zoneWarn = false;
    G.frozen = G.frozen.filter(function (f) { return !C.isZoneCell(G, f.r, f.c); });
    G.craters = G.craters.filter(function (cr) { return !C.isZoneCell(G, cr.r, cr.c); });
    ev(G, { t: 'zone', zone: G.zone, n: n });
  }

  // 라운드가 끝날 때마다 (passTurn 에서 흑 차례가 될 때)
  R.H.roundTick = function (G) {
    var Rn = G.round;
    G.frozen = G.frozen.filter(function (f) {                          // 얼음 녹기
      if (--f.rounds > 0) return true;
      if (G.board[f.r][f.c] === WALL && !C.isZoneCell(G, f.r, f.c)) { G.board[f.r][f.c] = f.owner; ev(G, { t: 'thaw', r: f.r, c: f.c, owner: f.owner }); }
      return false;
    });
    if (G.map === 'summer' && Rn % 5 === 0) melt(G);                  // 맵 자연재해
    if (G.map === 'winter' && Rn % 5 === 0) freeze(G);
    if (G.map === 'desert' && Rn >= 8 && (Rn - 8) % 4 === 0) sandstorm(G);
    if (G.zone < ZONE.MAX) {                                          // 자기장: 1라운드 전에 예고
      if (Rn >= ZONE.START - 1 && (Rn - (ZONE.START - 1)) % ZONE.EVERY === 0) { G.zoneWarn = true; ev(G, { t: 'zoneWarn', ring: G.zone }); }
      if (Rn >= ZONE.START && (Rn - ZONE.START) % ZONE.EVERY === 0) zoneShrink(G);
    }
  };
  R.H.tsunami = tsunami;
})(typeof window !== 'undefined' ? window.Rules : require('./rules.js'));
