/* 증강 오목 규칙 엔진 — 화면(DOM·3D)과 완전히 분리된 순수 로직.
 * 원본(Gomoku-ARAM)의 기본 규칙과 일반 카드 21장을 옮긴 것입니다.
 *   포함: 정확히 N목 승리, 3수마다 카드 뽑기(3장 중 1장), 패 4장, 턴당 카드 1장,
 *         카드 20장(알까기 포함), 풍차·함정·폭파 구멍·보호막·봉쇄·거대한 돌·엿보기,
 *         전설 카드 11장 · 시작 능력 5종 · 다시 뽑기 (전설 카드 효과는 js/rules-legend.js)
 *   제외(다음 단계): 맵·자기장, 봇, 멀티플레이
 * 사용: Rules.create({ legends: true, ability: 'random' }) → G, 이후 Rules.place / useCard / target / pickDraft ...
 *       호출하고 Rules.drain(G) 로 화면이 연출할 이벤트를 받아 감.
 */
(function (root) {
  'use strict';

  var SIZE = 15, EMPTY = 0, BLACK = 1, WHITE = 2, WALL = 3, HAND_LIMIT = 4, INTERVAL = 3;

  /* ---------------- 카드 21장 (원본 CARDS.md) ---------------- */
  // ends: 사용하면 턴이 끝남 / target: 사용 뒤 판에서 대상을 고름
  var CARDS = [
    { id: 'chain',      name: '연속 착수', cat: '공격',   weight: 10, desc: '이번 턴에 3번 착수\n(이번 턴 돌의\n2칸 안엔 못 둠)' },
    { id: 'windmill',   name: '풍차',      cat: '공격',   weight: 10, target: true, desc: '내 돌 하나를 풍차로\n주변 8칸에\n상대가 못 둠' },
    { id: 'alkkagi',    name: '알까기',    cat: '공격',   weight: 8,  desc: '흑·백이 한 번씩\n알까기로 새 돌 발사\n돌은 가까운 칸에 고정' },
    { id: 'bomb',       name: '폭파',      cat: '방해',   weight: 5,  target: true, desc: '상대 돌 1개 제거\n그 자리는 2턴간\n아무도 못 둠' },
    { id: 'trade',      name: '맞교환',    cat: '방해',   weight: 10, target: true, ends: true, desc: '맞닿은 흑·백 돌 한 쌍의\n색을 서로 바꿈\n(승리 줄이 되면 불가)' },
    { id: 'infection',  name: '감염',      cat: '방해',   weight: 8,  ends: true, desc: '맞닿은 상대 돌\n2개를 내 돌로\n(승리 줄은 제외)' },
    { id: 'reversal',   name: '전세 역전', cat: '희귀',   weight: 2,  ends: true, desc: '판의 흑·백을\n통째로 뒤바꿈\n(보호막 안은 그대로)' },
    { id: 'teleport',   name: '순간이동',  cat: '무작위', weight: 12, target: true, desc: '내 돌 1개를\n무작위 빈 칸으로 이동' },
    { id: 'earthquake', name: '지진',      cat: '무작위', weight: 8,  desc: '모든 돌이 각자\n주변 빈 칸으로 흔들림' },
    { id: 'meteor',     name: '운석',      cat: '무작위', weight: 5,  desc: '무작위 돌 1개가\n무작위 칸으로 날아감\n(내 돌일 수도!)' },
    { id: 'sixsense',   name: '식스센스',  cat: '규칙',   weight: 8,  desc: '승리 조건이\n영구히 6목으로' },
    { id: 'wall',       name: '장벽',      cat: '지형',   weight: 7,  target: true, desc: '빈 칸에 영구 장벽\n(아무도 못 두고\n줄도 끊김)' },
    { id: 'trap',       name: '함정',      cat: '지형',   weight: 10, target: true, desc: '빈 칸에 숨은 함정\n상대가 두면 돌이 사라지고\n나는 카드 1장' },
    { id: 'snipe',      name: '저격',      cat: '방해',   weight: 4,  ends: true, desc: '상대 돌 무작위\n2개 제거' },
    { id: 'double',     name: '1+1',       cat: '보급',   weight: 6,  desc: '무작위 카드\n2장 받기' },
    { id: 'peek',       name: '엿보기',    cat: '정보',   weight: 6,  desc: '이번 턴 동안\n상대 패를 봄' },
    { id: 'giant',      name: '거대한 돌', cat: '희귀',   weight: 3,  desc: '다음 착수 자리에\n3×3 중립 바위\n(그 9칸의 돌은 깨짐)' },
    { id: 'weather',    name: '기상 이변', cat: '지형',   weight: 4,  desc: '맵을 다른\n무작위 맵으로 바꿈' },
    { id: 'shield',     name: '보호막',    cat: '수비',   weight: 7,  target: true, desc: '내 돌 주변 3×3 보호\n(상대의 다음 2턴)' },
    { id: 'blockade',   name: '봉쇄',      cat: '수비',   weight: 3,  desc: '상대가 다음에\n쓰는 카드 1장 무효' }
  ];
  var CARD_BY_ID = {};
  CARDS.forEach(function (c) { CARD_BY_ID[c.id] = c; });
  // 전설 카드 11장: 게임 시작 때 3장 중 1장을 고르는 카드 (상대에게는 쓰기 전까지 비공개). react = 상대 카드에 대응
  var LEGENDS = [
    { id: 'obelisk',   name: '오목의 거신병',  cat: '전설', desc: '내 돌 3개를 바치면\n상대 돌이 가장 많은\n한 줄을 분쇄', cond: '내 돌 3개 이상' },
    { id: 'nothing',   name: '무소유',         cat: '대응', react: true, desc: '상대가 카드를 쓸 때\n그 카드를 무효로\n(내 패 전부 버림)', cond: '상대 카드에 대응 · 내 패 1장 이상' },
    { id: 'latebloom', name: '대기만성',       cat: '전설', desc: '이번 턴에 5번 착수\n거리 제한 없음\n(이번 턴 승리 불가)', cond: '판에 둔 수 40수 이상' },
    { id: 'blind',     name: '눈 감고 두기',   cat: '전설', desc: '3턴 동안 양쪽 판이\n어두워져 돌이\n보이지 않음', cond: '상대 돌과 3칸 이상 떨어진 착수 3번' },
    { id: 'clown',     name: '광대의 한 수',   cat: '전설', desc: '잃은 내 돌이\n모두 제자리로 귀환\n(상대 돌은 밀려남)', cond: '카드로 내 돌 3개 이상 잃음' },
    { id: 'chicken',   name: '치킨 게임',      cat: '전설', desc: '동전 던지기 — 진 쪽의\n가장 긴 줄이\n사라짐', cond: '양쪽 모두 3개 이상 이어진 줄' },
    { id: 'sloth',     name: '나무늘보',       cat: '전설', desc: '패의 카드를\n모두 즉시 발동\n(대상은 무작위)', cond: '카드 없이 6턴 (쥐고 있는 동안 카드 선택은 무작위)' },
    { id: 'mirror',    name: '따라쟁이',       cat: '전설', desc: '상대가 가장 최근에\n쓴 카드를\n내 패로 복사', cond: '상대가 카드를 1장 이상 씀' },
    { id: 'allin',     name: '올인',           cat: '전설', desc: '패 전부 또는 돌 3개를\n걸고 슬롯머신\n같은 그림 3개면 2배', cond: '패 1장 이상 또는 내 돌 3개 이상' },
    { id: 'turtle',    name: '토끼와 거북이',  cat: '전설', desc: '이후 나만 4목으로도\n승리 (턴 종료)', cond: '내 돌이 상대보다 5개 이상 적음' },
    { id: 'king',      name: '왕의 귀환',      cat: '전설', desc: '내 돌 하나를 왕으로\n20턴 살아남으면\n패 가득 + 새 전설', cond: '내 돌이 1개 이상' }
  ];
  var LEGEND_BY_ID = {}; LEGENDS.forEach(function (c) { c.legend = true; LEGEND_BY_ID[c.id] = c; });
  // 시작 능력 5종: 판마다 무작위 1개가 양쪽에 똑같이 적용
  var ABILITIES = [
    { id: 'umbrella', icon: '☂️', name: '자연재해 면역',  desc: '맵 자연재해가 일어나지 않음 (맵은 다음 단계)' },
    { id: 'pouch',    icon: '🎒', name: '넉넉한 주머니',  desc: '패를 5장까지 쥘 수 있음' },
    { id: 'clover',   icon: '🍀', name: '행운',           desc: '카드를 4장 중에서 고름' },
    { id: 'sturdy',   icon: '🏰', name: '단단한 시작',    desc: '처음 둔 돌 3개는 카드 효과로부터 영구 보호' },
    { id: 'retry',    icon: '🔁', name: '재도전',         desc: '다시 뽑기를 3번 쓸 수 있음' }
  ];
  var ABILITY_BY_ID = {}; ABILITIES.forEach(function (c) { ABILITY_BY_ID[c.id] = c; });
  var H = {};   // rules-legend.js 가 채우는 훅
  var MAPS = ['candle', 'moon'];   // 기상 이변으로 바뀌는 (임시) 맵 — 맵 효과는 다음 단계

  /* ---------------- 유틸 ---------------- */
  function other(p) { return p === BLACK ? WHITE : BLACK; }
  function isStone(v) { return v === BLACK || v === WHITE; }
  function inb(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function rnd(G) { return (G && G.rng) ? G.rng() : Math.random(); }
  function shuffle(G, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd(G) * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // 가중치 기반 비복원 추출 (Efraimidis–Spirakis)
  function weightedSample(G, k) {
    var keyed = CARDS.map(function (c) { return { c: c, key: Math.pow(rnd(G), 1 / (c.weight || 10)) }; });
    keyed.sort(function (a, b) { return b.key - a.key; });
    return keyed.slice(0, k).map(function (x) { return x.c.id; });
  }
  function ev(G, e) { G.ev.push(e); return e; }
  function drain(G) { var e = G.ev; G.ev = []; return e; }

  /* ---------------- 상태 ---------------- */
  function lgPair(v) { return { 1: v, 2: v }; }
  function lgFresh() {
    return { card: lgPair(null), done: lgPair(false), plies: 0, last: lgPair(null), lastCard: lgPair(null),
      lost: lgPair(0), lostPos: { 1: [], 2: [] }, far: lgPair(0), edge: lgPair(0), big: 0, turnNo: 0, darkUntil: 0, king: lgPair(null) };
  }
  function create(opts) {
    opts = opts || {};
    var G = {
      rng: opts.rng || null,
      board: [], current: BLACK, winLength: 5, gameOver: false, winner: 0, winLine: null, lastMove: null,
      placedCount: { 1: 0, 2: 0 }, hand: { 1: [], 2: [] }, used: { 1: false, 2: false },
      done: 0, needed: 1, placed: [],            // 이번 턴 착수 수 / 필요한 수 / 이번 턴에 둔 자리
      pending: null,                              // 대상 고르는 중인 카드 { type, forPlayer, handIndex, stage, firstPos }
      draft: null,                                // { player, picks[] }
      draftAfterTurn: null,
      windmills: [], traps: [], craters: [], shields: [],
      lock: { 1: false, 2: false }, skip: { 1: false, 2: false },
      next: { giant: 0 }, giants: [], peek: null,
      lg: lgFresh(), winOver: {}, immune: [], sturdy: { 1: 0, 2: 0 }, ab: { 1: null, 2: null }, refresh: { 1: 1, 2: 1 },
      startQueue: null, counter: null, sloth: null, lgUsedThisTurn: false,
      round: 0, noMoveStreak: 0, map: 'candle',
      alk: null, ev: [], log: []
    };
    for (var r = 0; r < SIZE; r++) { G.board.push([]); for (var c = 0; c < SIZE; c++) G.board[r].push(EMPTY); }
    if (opts.ability) {                                    // 시작 능력: 판마다 무작위 1개가 양쪽에 똑같이
      var ab = opts.ability === 'random' ? ABILITIES[Math.floor(rnd(G) * ABILITIES.length)].id : opts.ability;
      G.ab = { 1: ab, 2: ab };
      if (ab === 'retry') G.refresh = { 1: 3, 2: 3 };
      ev(G, { t: 'ability', id: ab });
    }
    if (opts.legends) {                                    // 시작: 흑 → 백 순서로 전설 카드 3장 중 1장
      G.startQueue = [BLACK, WHITE];
      openDraft(G, BLACK, 'legend');
    }
    return G;
  }

  /* ---------------- 조회 ---------------- */
  function listStones(G, color) {
    var out = [];
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (G.board[r][c] === color) out.push({ r: r, c: c });
    return out;
  }
  function hasStoneOf(G, p) { return listStones(G, p).length > 0; }
  function hasEmptyCell(G) {
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (G.board[r][c] === EMPTY) return true;
    return false;
  }
  function isCrater(G, r, c) { return G.craters.some(function (x) { return x.r === r && x.c === c; }); }
  function isWindmill(G, r, c) { return G.windmills.some(function (w) { return w.r === r && w.c === c; }); }
  function isProtected(G, r, c) {
    var v = G.board[r][c];
    if (!isStone(v)) return false;
    if (G.shields.some(function (s) { return s.owner === v && Math.abs(s.r - r) <= 1 && Math.abs(s.c - c) <= 1; })) return true;
    return G.immune.some(function (s) { return s.owner === v && s.r === r && s.c === c; });   // 단단한 시작
  }
  function isBlockedForPlayer(G, r, c, player) {
    if (isCrater(G, r, c)) return true;
    for (var i = 0; i < G.windmills.length; i++) {
      var w = G.windmills[i];
      if (!isStone(G.board[w.r][w.c]) || G.board[w.r][w.c] === player) continue;
      var dr = Math.abs(w.r - r), dc = Math.abs(w.c - c);
      if (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)) return true;
    }
    return false;
  }
  function pruneTraps(G) { G.traps = G.traps.filter(function (t) { return G.board[t.r][t.c] === EMPTY; }); }
  function pruneCraters(G) { G.craters = G.craters.filter(function (x) { return G.board[x.r][x.c] === EMPTY; }); }
  function removeStoneAt(G, r, c) {
    G.board[r][c] = EMPTY;
    G.windmills = G.windmills.filter(function (w) { return !(w.r === r && w.c === c); });
    G.immune = G.immune.filter(function (s) { return !(s.r === r && s.c === c); });
  }
  // 돌이 (r,c) → (nr,nc) 로 옮겨질 때 풍차·보호·왕 표시도 함께 이동
  function moveMeta(G, r, c, nr, nc) {
    G.windmills.forEach(function (w) { if (w.r === r && w.c === c) { w.r = nr; w.c = nc; } });
    G.immune.forEach(function (s) { if (s.r === r && s.c === c) { s.r = nr; s.c = nc; } });
    [1, 2].forEach(function (p) { var k = G.lg.king[p]; if (k && k.r === r && k.c === c) G.lg.king[p] = { r: nr, c: nc, start: k.start }; });
  }
  // 카드 효과로 p의 돌이 사라짐 (광대의 한 수가 기록)
  function lgLose(G, p, r, c) {
    if (p !== BLACK && p !== WHITE) return;
    var lg = G.lg; lg.lost[p]++;
    if (!lg.lostPos[p].some(function (q) { return q.r === r && q.c === c; })) lg.lostPos[p].push({ r: r, c: c });
  }
  // 착수 기록 (판의 수 · 상대 돌과 떨어진 거리 · 마지막 자리)
  function lgOnPlace(G, r, c, p) {
    var lg = G.lg, opp = other(p), near = SIZE;
    lg.plies++;
    for (var rr = 0; rr < SIZE; rr++) for (var cc = 0; cc < SIZE; cc++) if (G.board[rr][cc] === opp) near = Math.min(near, Math.max(Math.abs(rr - r), Math.abs(cc - c)));
    lg.far[p] = near >= 3 ? lg.far[p] + 1 : 0;
    lg.last[p] = { r: r, c: c };
  }
  function handLimit(G, p) { return HAND_LIMIT + (G.ab[p] === 'pouch' ? 1 : 0); }
  function draftSize(G, p) { return G.ab[p] === 'clover' ? 4 : 3; }
  function isDark(G) { return G.lg.turnNo < G.lg.darkUntil; }          // 눈 감고 두기: 판이 어두운 중
  function lgWouldWin(G, r, c, p) {
    var keep = G.board[r][c]; G.board[r][c] = p;
    var w = checkWin(G, r, c, p); G.board[r][c] = keep; return !!w;
  }

  /* ---------------- 승리 판정 ---------------- */
  function checkWin(G, r, c, player) {
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var d = 0; d < 4; d++) {
      var dr = dirs[d][0], dc = dirs[d][1], count = 1, start = { r: r, c: c }, end = { r: r, c: c };
      var rr = r + dr, cc = c + dc;
      while (inb(rr, cc) && G.board[rr][cc] === player && count < SIZE) { end = { r: rr, c: cc }; count++; rr += dr; cc += dc; }
      rr = r - dr; cc = c - dc;
      while (inb(rr, cc) && G.board[rr][cc] === player && count < SIZE) { start = { r: rr, c: cc }; count++; rr -= dr; cc -= dc; }
      if (count === G.winLength || (G.winOver[player] && count === G.winOver[player])) return { start: start, end: end, n: count };   // 정확히 N개만 승리 (장목은 승리 아님), 토끼와 거북이는 4개도
    }
    return null;
  }
  function scanBoardForWin(G) {
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      if (isStone(G.board[r][c])) { var w = checkWin(G, r, c, G.board[r][c]); if (w) return { player: G.board[r][c], win: w }; }
    }
    return null;
  }
  function finish(G, winner, line) {
    G.gameOver = true; G.winner = winner; G.winLine = line || null;
    ev(G, winner ? { t: 'win', p: winner, line: line } : { t: 'draw' });
  }
  function endIfBoardWin(G) {
    var f = scanBoardForWin(G);
    if (f) { finish(G, f.player, [f.win.start, f.win.end]); return true; }
    return false;
  }

  /* ---------------- 턴 진행 ---------------- */
  function tickCraters(G) {
    G.craters = G.craters.filter(function (x) { if (x.fresh) { x.fresh = false; return true; } x.turns--; return x.turns > 0; });
  }
  function tickShields(G) {
    G.shields = G.shields.filter(function (s) { if (s.fresh) { s.fresh = false; return true; } s.turns--; return s.turns > 0; });
  }
  function canPlaceAnywhere(G, player) {
    var big = G.lg.big === player, chain = !big && G.done > 0 && G.placed.length > 0;
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      if (G.board[r][c] !== EMPTY || isBlockedForPlayer(G, r, c, player)) continue;
      if (chain && G.placed.some(function (q) { return Math.max(Math.abs(r - q.r), Math.abs(c - q.c)) <= 2; })) continue;
      if (big && lgWouldWin(G, r, c, player)) continue;      // 대기만성 턴: 승리 줄을 만드는 칸은 못 둠
      return true;
    }
    return false;
  }
  function endTurnIfStuck(G) {
    if (G.done >= G.needed || canPlaceAnywhere(G, G.current)) return false;
    G.needed = G.done;      // 둘 곳이 없으면 이번 턴의 착수를 여기서 끝냄
    return true;
  }
  function passTurn(G) {
    if (G.sloth) { G.sloth.passPending = true; return; }   // 나무늘보 연속 발동 중 턴 종료 카드는 다 끝난 뒤 한 번만
    var prev = G.current;
    if (H.turnEnd) H.turnEnd(G, prev);                    // 전설 카드: 턴 수 · 나무늘보 · 왕의 귀환
    G.next = { giant: 0 };                                // 다음 착수에 붙는 효과는 이번 턴에만
    if (G.peek && G.peek.by === prev) { G.peek = null; ev(G, { t: 'peek', by: 0 }); }
    G.draftAfterTurn = null;
    tickCraters(G); tickShields(G);
    G.current = other(prev);
    if (G.current === BLACK) {                            // 백 턴이 끝나 흑 차례 = 1라운드
      G.round++;
      pruneTraps(G);
      if (endIfBoardWin(G)) return;
    }
    G.done = 0; G.needed = 1; G.placed = [];
    G.used[G.current] = false;
    ev(G, { t: 'turn', p: G.current });
    if (G.skip[G.current]) { G.skip[G.current] = false; passTurn(G); return; }
    // 둘 수 있는 자리가 하나도 없으면 턴을 넘기고, 양쪽 다 없으면 무승부
    if (!G.gameOver && !G.alk && !canPlaceAnywhere(G, G.current)) {
      if (!hasEmptyCell(G) || G.noMoveStreak >= 1) { G.noMoveStreak = 0; finish(G, 0); return; }
      G.noMoveStreak++;
      passTurn(G); return;
    }
    G.noMoveStreak = 0;
  }

  /* ---------------- 카드 획득 ---------------- */
  function trimHand(G, p) {
    while (G.hand[p].length > handLimit(G, p)) { var d = G.hand[p].shift(); ev(G, { t: 'overflow', p: p, id: d }); }
  }
  function grantRandomCard(G, p) {
    var id = weightedSample(G, 1)[0];
    G.hand[p].push(id); trimHand(G, p);
    ev(G, { t: 'gain', p: p, id: id });
    return id;
  }
  function draftPicks(G, p, kind) {
    if (kind === 'legend') return shuffle(G, LEGENDS.map(function (c) { return c.id; })).slice(0, 3);
    return weightedSample(G, draftSize(G, p));
  }
  function openDraft(G, p, kind) {
    kind = kind || 'card';
    var picks = draftPicks(G, p, kind);
    if (kind === 'card' && G.lg.card[p] === 'sloth' && !G.lg.done[p]) {   // 나무늘보를 쥐면 카드를 고를 수 없고 무작위로 받음
      G.draft = { player: p, picks: picks, kind: kind };
      pickDraft(G, picks[Math.floor(rnd(G) * picks.length)]);
      return;
    }
    G.draft = { player: p, picks: picks, kind: kind };
    ev(G, { t: 'draft', p: p, picks: picks.slice(), kind: kind, refresh: G.refresh[p] });
  }
  function startNext(G) {
    G.startQueue.shift();
    if (G.startQueue.length) openDraft(G, G.startQueue[0], 'legend');
    else { G.startQueue = null; ev(G, { t: 'start' }); }
  }
  function pickDraft(G, id) {
    if (!G.draft || G.draft.picks.indexOf(id) < 0) return { ok: false };
    var d = G.draft, p = d.player;
    G.draft = null;
    if (d.kind === 'legend') {                              // 전설 카드: 패가 아니라 전설 칸에 (상대에게는 비공개)
      G.lg.card[p] = id; ev(G, { t: 'legendPicked', p: p });
      startNext(G);
      return { ok: true };
    }
    G.hand[p].push(id); trimHand(G, p);
    ev(G, { t: 'gain', p: p, id: id });
    if (G.done >= G.needed) passTurn(G);
    return { ok: true };
  }
  // 다시 뽑기 (판마다 1번, 재도전 능력이면 3번)
  function reroll(G) {
    var d = G.draft;
    if (!d || G.refresh[d.player] <= 0) return { ok: false };
    G.refresh[d.player]--;
    d.picks = draftPicks(G, d.player, d.kind);
    ev(G, { t: 'draft', p: d.player, picks: d.picks.slice(), kind: d.kind, refresh: G.refresh[d.player], rerolled: true });
    return { ok: true };
  }

  /* ---------------- 착수 ---------------- */
  function canPlace(G, r, c) {
    if (G.gameOver || G.draft || G.alk || G.pending || G.counter || G.startQueue) return false;
    if (!inb(r, c) || G.board[r][c] !== EMPTY) return false;
    if (isBlockedForPlayer(G, r, c, G.current)) return false;
    var big = G.lg.big === G.current;                       // 대기만성 턴: 거리 제한 없음, 승리 줄 완성 불가
    if (big && lgWouldWin(G, r, c, G.current)) return false;
    if (!big && G.done > 0 && G.placed.length > 0 && G.placed.some(function (p) { return Math.max(Math.abs(r - p.r), Math.abs(c - p.c)) <= 2; })) return false;
    return true;
  }
  function place(G, r, c) {
    if (!canPlace(G, r, c)) return { ok: false };
    var cur = G.current, countsForDraft = G.done === 0;
    G.board[r][c] = cur; G.lastMove = { r: r, c: c };
    G.placed.push({ r: r, c: c });
    ev(G, { t: 'place', r: r, c: c, p: cur });
    lgOnPlace(G, r, c, cur);

    var trap = G.traps.filter(function (t) { return t.r === r && t.c === c && t.owner !== cur; })[0];
    if (trap) {                                             // 함정: 돌이 사라지고 함정 주인은 카드 1장
      G.board[r][c] = EMPTY;
      G.traps = G.traps.filter(function (t) { return t !== trap; });
      ev(G, { t: 'trapHit', r: r, c: c, p: cur, owner: trap.owner });
      lgLose(G, cur, r, c);
      grantRandomCard(G, trap.owner);
      G.done++;
      endTurnIfStuck(G);
      if (G.done >= G.needed && G.draftAfterTurn === cur) { G.draftAfterTurn = null; openDraft(G, cur); }
      else if (G.done >= G.needed) passTurn(G);
      return { ok: true, trap: true };
    }
    G.traps = G.traps.filter(function (t) { return !(t.r === r && t.c === c); });   // 내 함정 위에 두면 함정은 소멸
    onPlaceEffects(G, r, c, cur);

    var win = checkWin(G, r, c, cur);
    if (win) { finish(G, cur, [win.start, win.end]); return { ok: true, win: true }; }
    if (!hasEmptyCell(G)) { finish(G, 0); return { ok: true, draw: true }; }

    if (countsForDraft) G.placedCount[cur]++;
    G.done++;
    var milestone = countsForDraft && G.placedCount[cur] % INTERVAL === 0;
    endTurnIfStuck(G);
    if (milestone && G.done < G.needed) G.draftAfterTurn = cur;   // 연속 착수 중이면 카드 선택은 마지막 수 뒤로
    if (G.done >= G.needed && (milestone || G.draftAfterTurn === cur)) { G.draftAfterTurn = null; openDraft(G, cur); }
    else if (G.done >= G.needed) passTurn(G);
    return { ok: true };
  }
  // 단단한 시작 · 거대한 돌 (착수 직후에 붙는 효과)
  function onPlaceEffects(G, r, c, p) {
    if (G.ab[p] === 'sturdy' && G.sturdy[p] < 3) { G.sturdy[p]++; G.immune.push({ r: r, c: c, owner: p }); }
    if (G.next.giant === p) {
      G.next.giant = 0;
      var broken = [];
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        var rr = r + dr, cc = c + dc;
        if (!inb(rr, cc)) continue;
        var v = G.board[rr][cc];
        if (isStone(v)) { removeStoneAt(G, rr, cc); broken.push({ r: rr, c: cc, p: v }); if (dr || dc) lgLose(G, v, rr, cc); }
        G.board[rr][cc] = WALL;
      }
      G.giants.push({ r: r, c: c });
      G.craters = G.craters.filter(function (x) { return Math.max(Math.abs(x.r - r), Math.abs(x.c - c)) > 1; });
      pruneTraps(G);
      if (G.lastMove && G.lastMove.r === r && G.lastMove.c === c) G.lastMove = null;
      ev(G, { t: 'giant', r: r, c: c, broken: broken });
    }
  }

  /* ---------------- 카드 사용 ---------------- */
  function flipBoard(G, user) {
    var keep = {}, flipped = [];
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (isStone(G.board[r][c]) && G.board[r][c] !== user && isProtected(G, r, c)) keep[r * SIZE + c] = 1;
    for (r = 0; r < SIZE; r++) for (c = 0; c < SIZE; c++) {
      if (keep[r * SIZE + c]) continue;
      if (G.board[r][c] === BLACK) { G.board[r][c] = WHITE; flipped.push({ r: r, c: c }); }
      else if (G.board[r][c] === WHITE) { G.board[r][c] = BLACK; flipped.push({ r: r, c: c }); }
    }
    ev(G, { t: 'flip', cells: flipped });
  }
  function pickRandomEmptyCell(G, forPlayer) {
    var preferred = [], any = [];
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (G.board[r][c] === EMPTY) {
      any.push({ r: r, c: c });
      if (!isBlockedForPlayer(G, r, c, forPlayer)) preferred.push({ r: r, c: c });
    }
    var pool = preferred.length ? preferred : any;
    return pool.length ? pool[Math.floor(rnd(G) * pool.length)] : null;
  }
  var ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function hasOppositeNeighbor(G, r, c) {
    var v = G.board[r][c];
    if (!isStone(v)) return false;
    return ORTHO.some(function (d) { var rr = r + d[0], cc = c + d[1]; return inb(rr, cc) && isStone(G.board[rr][cc]) && G.board[rr][cc] !== v; });
  }
  function hasTradablePair(G) {
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (hasOppositeNeighbor(G, r, c)) return true;
    return false;
  }
  function swapMakesLine(G, r1, c1, r2, c2) {
    var v1 = G.board[r1][c1], v2 = G.board[r2][c2];
    G.board[r1][c1] = v2; G.board[r2][c2] = v1;
    var made = !!(checkWin(G, r1, c1, v2) || checkWin(G, r2, c2, v1));
    G.board[r1][c1] = v1; G.board[r2][c2] = v2;
    return made;
  }
  function orthogonalEnemyNeighbors(G, player) {
    var opp = other(player), seen = {}, out = [];
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) {
      if (G.board[r][c] !== player) continue;
      for (var i = 0; i < 4; i++) {
        var nr = r + ORTHO[i][0], nc = c + ORTHO[i][1];
        if (!inb(nr, nc) || G.board[nr][nc] !== opp || isProtected(G, nr, nc)) continue;
        var k = nr * SIZE + nc;
        if (!seen[k]) { seen[k] = 1; out.push({ r: nr, c: nc }); }
      }
    }
    return out;
  }
  function runEarthquake(G) {
    var stones = [], occ = {}, walls = [], r, c;
    for (r = 0; r < SIZE; r++) for (c = 0; c < SIZE; c++) {
      if (isStone(G.board[r][c])) { stones.push({ r: r, c: c, color: G.board[r][c], mill: isWindmill(G, r, c) }); occ[r * SIZE + c] = 1; }
      else if (G.board[r][c] === WALL) { walls.push({ r: r, c: c }); occ[r * SIZE + c] = 1; }
    }
    var claimed = {}, order = shuffle(G, stones.map(function (_, i) { return i; })), np = [];
    order.forEach(function (i) {
      var s = stones[i], cand = [];
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var nr = s.r + dr, nc = s.c + dc, k = nr * SIZE + nc;
        if (!inb(nr, nc) || occ[k] || claimed[k] || isCrater(G, nr, nc)) continue;
        cand.push({ r: nr, c: nc, k: k });
      }
      if (cand.length) { var pk = cand[Math.floor(rnd(G) * cand.length)]; claimed[pk.k] = 1; np[i] = { r: pk.r, c: pk.c }; }
      else np[i] = { r: s.r, c: s.c };
    });
    for (r = 0; r < SIZE; r++) for (c = 0; c < SIZE; c++) G.board[r][c] = EMPTY;
    walls.forEach(function (w) { G.board[w.r][w.c] = WALL; });
    G.windmills = [];
    var moves = [];
    stones.forEach(function (s, i) {
      G.board[np[i].r][np[i].c] = s.color;
      if (s.mill) G.windmills.push({ r: np[i].r, c: np[i].c });
      moves.push({ from: { r: s.r, c: s.c }, to: np[i], p: s.color });
    });
    G.lastMove = null;
    pruneTraps(G);
    ev(G, { t: 'quake', moves: moves });
  }
  function spend(G, idx) {
    var p = G.current, id = G.hand[p].splice(idx, 1)[0];
    G.used[p] = true;
    ev(G, { t: 'spend', p: p, id: id });
    return id;
  }
  // 이번 턴 카드를 쓸 수 있는 상태인지
  function canUseCard(G) { return !G.gameOver && !G.draft && !G.pending && !G.alk && !G.counter && !G.startQueue && !G.used[G.current]; }

  /* 카드 사용: { ok, pending?, blocked?, counter? } — 대상을 고르는 카드는 pending 이 되고 target() 으로 마무리.
     상대가 무소유를 쥐고 있으면 counter: answerCounter() 로 대응 여부를 정함 */
  function useCard(G, idx) {
    if (!canUseCard(G)) return { ok: false };
    var p = G.current, id = G.hand[p][idx], holder = other(p);
    if (!id) return { ok: false };
    G.lg.lastCard[p] = id;                                  // 따라쟁이가 베낄 카드
    if (G.lg.card[holder] === 'nothing' && !G.lg.done[holder] && G.hand[holder].length > 0) {
      G.counter = { user: p, idx: idx, id: id };
      ev(G, { t: 'counterAsk', holder: holder, user: p, id: id });
      return { ok: true, counter: true };
    }
    return execCard(G, idx);
  }
  function execCard(G, idx) {
    var p = G.current, opp = other(p), id = G.hand[p][idx];
    if (!id) return { ok: false };

    if (G.lock[p]) {                                        // 봉쇄: 카드는 소모되고 효과는 무효
      G.lock[p] = false; spend(G, idx);
      ev(G, { t: 'blocked', p: p, id: id });
      return { ok: true, blocked: true };
    }
    switch (id) {
      case 'chain':
        spend(G, idx); G.needed = Math.max(G.needed, G.done + 3, 3);
        return { ok: true };
      case 'sixsense':
        if (G.winLength === 6) return { ok: false, reason: 'already' };
        spend(G, idx); G.winLength = 6; ev(G, { t: 'rule', winLength: 6 });
        endIfBoardWin(G);
        return { ok: true };
      case 'reversal':
        spend(G, idx); flipBoard(G, p);
        if (!endIfBoardWin(G)) passTurn(G);
        return { ok: true };
      case 'windmill':
        if (!listStones(G, p).some(function (q) { return !isWindmill(G, q.r, q.c); })) return { ok: false, reason: 'noTarget' };
        G.pending = { type: 'windmill', forPlayer: p, handIndex: idx }; return { ok: true, pending: true };
      case 'bomb':
        if (!hasStoneOf(G, opp)) return { ok: false, reason: 'noTarget' };
        G.pending = { type: 'remove', forPlayer: p, opponent: opp, handIndex: idx }; return { ok: true, pending: true };
      case 'trade':
        if (!hasTradablePair(G)) return { ok: false, reason: 'noTarget' };
        G.pending = { type: 'trade', forPlayer: p, handIndex: idx, stage: 'first', firstPos: null }; return { ok: true, pending: true };
      case 'teleport':
        if (!hasStoneOf(G, p) || !hasEmptyCell(G)) return { ok: false, reason: 'noTarget' };
        G.pending = { type: 'teleport', forPlayer: p, handIndex: idx }; return { ok: true, pending: true };
      case 'trap': case 'wall':
        if (!hasEmptyCell(G)) return { ok: false, reason: 'noTarget' };
        G.pending = { type: id, forPlayer: p, handIndex: idx }; return { ok: true, pending: true };
      case 'shield':
        if (!hasStoneOf(G, p)) return { ok: false, reason: 'noTarget' };
        G.pending = { type: 'shield', forPlayer: p, handIndex: idx }; return { ok: true, pending: true };
      case 'alkkagi':
        spend(G, idx); startAlk(G, p);
        return { ok: true, alk: true };
      case 'earthquake':
        spend(G, idx); runEarthquake(G);
        if (!hasEmptyCell(G)) finish(G, 0); else endIfBoardWin(G);
        return { ok: true };
      case 'blockade':
        spend(G, idx); G.lock[opp] = true; ev(G, { t: 'lock', p: opp });
        return { ok: true };
      case 'meteor': {
        var pool = listStones(G, 1).concat(listStones(G, 2)).filter(function (q) { return !isProtected(G, q.r, q.c); });
        if (!pool.length) return { ok: false, reason: 'noTarget' };
        var hit = pool[Math.floor(rnd(G) * pool.length)], victim = G.board[hit.r][hit.c];
        var dest = pickRandomEmptyCell(G, victim);
        if (!dest) return { ok: false, reason: 'noTarget' };
        var mill = isWindmill(G, hit.r, hit.c);
        G.board[hit.r][hit.c] = EMPTY; G.board[dest.r][dest.c] = victim;
        moveMeta(G, hit.r, hit.c, dest.r, dest.c);
        G.lastMove = { r: dest.r, c: dest.c };
        pruneTraps(G); pruneCraters(G);
        spend(G, idx);
        ev(G, { t: 'move', from: hit, to: dest, p: victim, why: 'meteor', mill: mill });
        endIfBoardWin(G);
        return { ok: true };
      }
      case 'infection': {
        var targets = orthogonalEnemyNeighbors(G, p), conv = [];
        shuffle(G, targets).forEach(function (t) {
          if (conv.length >= 2) return;
          G.board[t.r][t.c] = p;
          if (checkWin(G, t.r, t.c, p)) { G.board[t.r][t.c] = opp; return; }   // 승리 줄이 되는 감염은 제외
          conv.push(t);
        });
        if (!conv.length) return { ok: false, reason: 'noTarget' };
        spend(G, idx);
        conv.forEach(function (q) { lgLose(G, opp, q.r, q.c); ev(G, { t: 'convert', r: q.r, c: q.c, from: opp, to: p, why: 'infection' }); });
        passTurn(G);
        return { ok: true };
      }
      case 'snipe': {
        var cand = shuffle(G, listStones(G, opp).filter(function (q) { return !isProtected(G, q.r, q.c); }));
        if (!cand.length) return { ok: false, reason: 'noTarget' };
        spend(G, idx);
        cand.slice(0, 2).forEach(function (q) { removeStoneAt(G, q.r, q.c); lgLose(G, opp, q.r, q.c); ev(G, { t: 'remove', r: q.r, c: q.c, p: opp, why: 'snipe' }); });
        pruneTraps(G);
        if (!endIfBoardWin(G)) passTurn(G);
        return { ok: true };
      }
      case 'double':
        spend(G, idx); grantRandomCard(G, p); grantRandomCard(G, p);
        return { ok: true };
      case 'peek':
        spend(G, idx); G.peek = { by: p, cards: G.hand[opp].slice() }; ev(G, { t: 'peek', by: p, cards: G.peek.cards.slice() });
        return { ok: true };
      case 'giant':
        spend(G, idx); G.next.giant = p; ev(G, { t: 'next', what: 'giant', p: p });
        return { ok: true };
      case 'weather': {
        spend(G, idx);
        var others = MAPS.filter(function (m) { return m !== G.map; });
        G.map = others[Math.floor(rnd(G) * others.length)];
        ev(G, { t: 'weather', map: G.map });
        endIfBoardWin(G);
        return { ok: true };
      }
    }
    return { ok: false };
  }

  /* ---------------- 대상 고르기 ---------------- */
  // (r,c)가 지금 고를 수 있는 대상인지 (화면의 하이라이트용)
  function isValidTarget(G, r, c) {
    var t = G.pending;
    if (!t || !inb(r, c)) return false;
    var v = G.board[r][c];
    switch (t.type) {
      case 'sacrifice': case 'wager': case 'kingPick': return v === t.forPlayer;       // 전설 카드: 내 돌 고르기
      case 'windmill': return v === t.forPlayer && !isWindmill(G, r, c);
      case 'remove': return v === t.opponent && !isProtected(G, r, c);
      case 'teleport': case 'shield': return v === t.forPlayer;
      case 'wall': return v === EMPTY;
      case 'trap': return v === EMPTY && !G.traps.some(function (x) { return x.r === r && x.c === c; });
      case 'trade':
        if (!isStone(v)) return false;
        if (v !== t.forPlayer && isProtected(G, r, c)) return false;
        if (t.stage === 'first') return hasOppositeNeighbor(G, r, c);
        var a = t.firstPos;
        if (v === a.color || Math.abs(a.r - r) + Math.abs(a.c - c) !== 1) return false;
        return !swapMakesLine(G, a.r, a.c, r, c);
    }
    return false;
  }
  function finishPending(G, t) {
    if (!t.legend) spend2(G, t);
    G.pending = null;
  }
  function spend2(G, t) { G.hand[t.forPlayer].splice(t.handIndex, 1); G.used[t.forPlayer] = true; ev(G, { t: 'spend', p: t.forPlayer, id: t.cardId }); }

  function target(G, r, c) {
    var t = G.pending;
    if (!t || !inb(r, c)) return { ok: false };
    if (t.legend) return H.legendTarget(G, t, r, c);          // 전설 카드의 대상 고르기 (rules-legend.js)
    t.cardId = G.hand[t.forPlayer][t.handIndex];
    var v = G.board[r][c], p = t.forPlayer;
    if ((t.type === 'remove' || t.type === 'trade') && isStone(v) && v !== p && isProtected(G, r, c)) return { ok: false, reason: 'shielded' };

    if (t.type === 'trade' && t.stage === 'first') {           // 첫 번째 돌 고르기 (아직 끝나지 않음)
      if (hasOppositeNeighbor(G, r, c)) { t.firstPos = { r: r, c: c, color: v }; t.stage = 'second'; ev(G, { t: 'tradeFirst', r: r, c: c }); return { ok: true, resolved: false }; }
      return { ok: false };
    }
    if (t.type === 'trade') {                                  // 두 번째 돌 고르기
      var a = t.firstPos;
      if (!(isStone(v) && v !== a.color && Math.abs(a.r - r) + Math.abs(a.c - c) === 1)) {
        if (hasOppositeNeighbor(G, r, c)) { t.firstPos = { r: r, c: c, color: v }; ev(G, { t: 'tradeFirst', r: r, c: c }); return { ok: true, resolved: false }; }
        return { ok: false };
      }
      if (swapMakesLine(G, a.r, a.c, r, c)) return { ok: false, reason: 'line' };
      lgLose(G, other(p), a.color === other(p) ? a.r : r, a.color === other(p) ? a.c : c);
      G.board[a.r][a.c] = v; G.board[r][c] = a.color;
      ev(G, { t: 'convert', r: a.r, c: a.c, from: a.color, to: v, why: 'trade' });
      ev(G, { t: 'convert', r: r, c: c, from: v, to: a.color, why: 'trade' });
      finishPending(G, t);
      if (!endIfBoardWin(G)) passTurn(G);
      return { ok: true, resolved: true };
    }
    if (!isValidTarget(G, r, c)) return { ok: false };

    switch (t.type) {
      case 'remove':
        lgLose(G, t.opponent, r, c);
        removeStoneAt(G, r, c);
        G.traps = G.traps.filter(function (x) { return !(x.r === r && x.c === c); });
        G.craters.push({ r: r, c: c, turns: 2, fresh: true });
        ev(G, { t: 'remove', r: r, c: c, p: t.opponent, why: 'bomb' });
        ev(G, { t: 'crater', r: r, c: c });
        break;
      case 'teleport': {
        var dest = pickRandomEmptyCell(G, p);
        if (!dest) return { ok: false };
        var mill = isWindmill(G, r, c);
        G.board[r][c] = EMPTY; G.board[dest.r][dest.c] = p;
        moveMeta(G, r, c, dest.r, dest.c);
        G.lastMove = dest; pruneTraps(G);
        ev(G, { t: 'move', from: { r: r, c: c }, to: dest, p: p, why: 'teleport', mill: mill });
        break;
      }
      case 'shield':
        G.shields.push({ r: r, c: c, owner: p, turns: 3, fresh: true });
        ev(G, { t: 'shield', r: r, c: c, owner: p });
        break;
      case 'wall':
        G.board[r][c] = WALL;
        G.traps = G.traps.filter(function (x) { return !(x.r === r && x.c === c); });
        G.craters = G.craters.filter(function (x) { return !(x.r === r && x.c === c); });
        ev(G, { t: 'wall', r: r, c: c });
        break;
      case 'trap':
        G.traps.push({ r: r, c: c, owner: p });
        ev(G, { t: 'trap', r: r, c: c, owner: p });
        break;
      case 'windmill':
        G.windmills.push({ r: r, c: c });
        ev(G, { t: 'windmill', r: r, c: c });
        break;
    }
    finishPending(G, t);
    if (t.type === 'teleport') endIfBoardWin(G);
    return { ok: true, resolved: true };
  }
  function cancel(G) {
    if (!G.pending) return false;
    G.pending = null; ev(G, { t: 'cancel' }); return true;
  }

  /* ---------------- 알까기 (물리는 셀 단위, 판 중앙이 (0,0)) ---------------- */
  var ALK = {
    R: 0.42, FRICTION: 0.965, POWER: 0.32, MAXPULL: 4, MIN_SPEED: 0.05 / 34, MAX_FRAMES: 480,
    XMAX: 8.47, ZMIN: -7.82, ZMAX: 9.7, START: { x: 0, z: 7.94 }
  };
  function buildPhys(G) {
    var list = [];
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (isStone(G.board[r][c]))
      list.push({ x: c - 7, z: r - 7, vx: 0, vz: 0, color: G.board[r][c], isNew: false, mill: isWindmill(G, r, c) });
    return list;
  }
  function addFlickStone(G, player) {
    var a = G.alk;
    a.stones.push({ x: ALK.START.x, z: ALK.START.z, vx: 0, vz: 0, color: player, isNew: true, mill: false });
    a.newIndex = a.stones.length - 1; a.phase = 'aim'; a.frames = 0;
    ev(G, { t: 'alkTurn', p: player, idx: a.idx });
  }
  function startAlk(G, player) {
    G.alk = { order: [player, other(player)], idx: 0, stones: buildPhys(G), newIndex: -1, phase: 'aim', frames: 0 };
    addFlickStone(G, player);
  }
  // 발사: pull = 당긴 벡터(셀 단위, 새 돌 기준). 너무 약하면 false
  function alkLaunch(G, pullX, pullZ) {
    var a = G.alk; if (!a || a.phase !== 'aim') return false;
    var d = Math.hypot(pullX, pullZ);
    if (d > ALK.MAXPULL) { pullX *= ALK.MAXPULL / d; pullZ *= ALK.MAXPULL / d; d = ALK.MAXPULL; }
    if (d < 6 / 34) return false;
    var s = a.stones[a.newIndex];
    s.vx = -pullX * ALK.POWER; s.vz = -pullZ * ALK.POWER;
    a.phase = 'sim'; a.frames = 0;
    return true;
  }
  function alkStep(stones) {
    var R2 = ALK.R * 2, i, j, s;
    for (i = 0; i < stones.length; i++) { s = stones[i]; s.x += s.vx; s.z += s.vz; s.vx *= ALK.FRICTION; s.vz *= ALK.FRICTION; }
    for (i = 0; i < stones.length; i++) { s = stones[i]; s.x += s.vx; s.z += s.vz; s.vx *= ALK.FRICTION; s.vz *= ALK.FRICTION; }
    for (i = 0; i < stones.length; i++) {
      s = stones[i];
      if (s.x < -ALK.XMAX + ALK.R) { s.x = -ALK.XMAX + ALK.R; s.vx = Math.abs(s.vx) * 0.6; }
      if (s.x > ALK.XMAX - ALK.R) { s.x = ALK.XMAX - ALK.R; s.vx = -Math.abs(s.vx) * 0.6; }
      if (s.z < ALK.ZMIN + ALK.R) { s.z = ALK.ZMIN + ALK.R; s.vz = Math.abs(s.vz) * 0.6; }
      if (s.z > ALK.ZMAX - ALK.R) { s.z = ALK.ZMAX - ALK.R; s.vz = -Math.abs(s.vz) * 0.6; }
    }
    for (i = 0; i < stones.length; i++) for (j = i + 1; j < stones.length; j++) {
      var a = stones[i], b = stones[j], dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz) || 0.0001;
      if (dist < R2) {
        var nx = dx / dist, nz = dz / dist, ov = (R2 - dist) / 2;
        a.x -= nx * ov; a.z -= nz * ov; b.x += nx * ov; b.z += nz * ov;
        var avn = a.vx * nx + a.vz * nz, bvn = b.vx * nx + b.vz * nz;
        var atx = a.vx - avn * nx, atz = a.vz - avn * nz, btx = b.vx - bvn * nx, btz = b.vz - bvn * nz;
        a.vx = atx + bvn * nx; a.vz = atz + bvn * nz; b.vx = btx + avn * nx; b.vz = btz + avn * nz;
      }
    }
  }
  function alkMaxSpeed(stones) { var m = 0; for (var i = 0; i < stones.length; i++) m = Math.max(m, Math.hypot(stones[i].vx, stones[i].vz)); return m; }
  // 한 프레임 진행. 멈췄으면 finishAlk 까지 처리하고 true 반환
  function alkTick(G) {
    var a = G.alk; if (!a || a.phase !== 'sim') return false;
    alkStep(a.stones); a.frames++;
    if (alkMaxSpeed(a.stones) < ALK.MIN_SPEED || a.frames > ALK.MAX_FRAMES) { finishAlk(G); return true; }
    return false;
  }
  function snapToGrid(G, stones) {
    var cands = [], taken = {}, res = new Array(stones.length), left = stones.length, si, r, c;
    for (r = 0; r < SIZE; r++) for (c = 0; c < SIZE; c++) if (G.board[r][c] === WALL) taken[r * SIZE + c] = 1;
    for (si = 0; si < stones.length; si++) for (r = 0; r < SIZE; r++) for (c = 0; c < SIZE; c++)
      cands.push({ si: si, r: r, c: c, d: Math.hypot(stones[si].x - (c - 7), stones[si].z - (r - 7)) });
    cands.sort(function (a, b) { return a.d - b.d; });
    var done = {};
    for (var i = 0; i < cands.length && left > 0; i++) {
      var q = cands[i], k = q.r * SIZE + q.c;
      if (done[q.si] || taken[k]) continue;
      done[q.si] = 1; taken[k] = 1; res[q.si] = { r: q.r, c: q.c }; left--;
    }
    return res;
  }
  function finishAlk(G) {
    var a = G.alk, assign = snapToGrid(G, a.stones), r, c, walls = [];
    for (r = 0; r < SIZE; r++) for (c = 0; c < SIZE; c++) if (G.board[r][c] === WALL) walls.push({ r: r, c: c });
    for (r = 0; r < SIZE; r++) for (c = 0; c < SIZE; c++) G.board[r][c] = EMPTY;
    walls.forEach(function (w) { G.board[w.r][w.c] = WALL; });
    G.windmills = [];
    var snaps = [];
    a.stones.forEach(function (s, i) {
      var pos = assign[i]; if (!pos) return;
      G.board[pos.r][pos.c] = s.color;
      if (s.mill) G.windmills.push({ r: pos.r, c: pos.c });
      if (s.isNew) G.lastMove = pos;
      snaps.push({ r: pos.r, c: pos.c, p: s.color, mill: s.mill, isNew: s.isNew });
    });
    pruneTraps(G); pruneCraters(G);
    ev(G, { t: 'alkSnap', stones: snaps });
    var next = a.idx + 1;
    if (next < a.order.length) {
      a.idx = next; a.stones = buildPhys(G); addFlickStone(G, a.order[next]);
    } else {
      G.alk = null;
      ev(G, { t: 'alkEnd' });
      if (!hasEmptyCell(G)) finish(G, 0); else endIfBoardWin(G);
    }
  }

  var core = { ev: ev, rnd: rnd, shuffle: shuffle, weightedSample: weightedSample, removeStoneAt: removeStoneAt, moveMeta: moveMeta,
    pruneTraps: pruneTraps, pruneCraters: pruneCraters, isCrater: isCrater, listStones: listStones, hasEmptyCell: hasEmptyCell,
    grantRandomCard: grantRandomCard, trimHand: trimHand, endIfBoardWin: endIfBoardWin, finish: finish, checkWin: checkWin,
    passTurn: passTurn, execCard: execCard, lgLose: lgLose, lgWouldWin: lgWouldWin, handLimit: handLimit, draftPicks: draftPicks,
    isProtected: isProtected, isWindmill: isWindmill, pickRandomEmptyCell: pickRandomEmptyCell, isDark: isDark };
  root.Rules = {
    SIZE: SIZE, EMPTY: EMPTY, BLACK: BLACK, WHITE: WHITE, WALL: WALL, HAND_LIMIT: HAND_LIMIT, INTERVAL: INTERVAL,
    CARDS: CARDS, CARD_BY_ID: CARD_BY_ID, ALK: ALK, other: other, isStone: isStone, inb: inb,
    create: create, drain: drain, place: place, canPlace: canPlace, useCard: useCard, canUseCard: canUseCard,
    target: target, isValidTarget: isValidTarget, cancel: cancel, pickDraft: pickDraft,
    isProtected: isProtected, core: core, H: H, LEGENDS: LEGENDS, LEGEND_BY_ID: LEGEND_BY_ID, ABILITIES: ABILITIES, ABILITY_BY_ID: ABILITY_BY_ID,
    reroll: reroll, isDark: isDark, handLimit: handLimit, isWindmill: isWindmill, isBlockedForPlayer: isBlockedForPlayer,
    listStones: listStones, alkLaunch: alkLaunch, alkTick: alkTick, alkStep: alkStep, hasEmptyCell: hasEmptyCell,
    weightedSample: weightedSample, grantRandomCard: grantRandomCard
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Rules;
})(typeof window !== 'undefined' ? window : this);
