/* 판 연출 — HUD · 풍차/보호막/함정/구멍 표시 · 돌·벽 조작 · 엔진 이벤트 → 3D 연출 */
'use strict';

/* ---------------- HUD ---------------- */
var elTurn = document.getElementById('turn');
var elEnd = document.getElementById('endturn');
var elBanner = document.getElementById('banner');
function setMsg() { /* 상단 안내 문구는 표시하지 않음 (차례만 보여줌) */ }
function updateHUD() {
  if (!G) return;
  var who = function (p) { return p === BLACK ? '⚫ 흑' : '⚪ 백'; };
  var t = G.alk ? ('🪀 ' + who(G.alk.order[G.alk.idx]) + ' 알까기') : (who(G.current) + ' 차례');
  var b = [];                                   // 작은 상태 표시만
  if (G.next.giant === G.current) b.push('🪨');
  if (G.next.ghost === G.current) b.push('👻');
  if (G.lock[G.current]) b.push('🚫');
  if (G.winLength === 6) b.push('6목');
  elTurn.textContent = t + (b.length ? '  ' + b.join(' ') : '');
  elEnd.style.display = 'none';
}
function syncS() {
  S.turn = G.current; S.over = G.gameOver;
  S.mode = G.pending ? G.pending.type : null; S.pendingIdx = G.pending ? G.pending.handIndex : -1;
}

/* ---------------- 판 위의 표시: 풍차 · 보호막 · 함정 · 구멍 ---------------- */
var markerGroup = new THREE.Group(); scene.add(markerGroup);
var spinners = [], tradeFirst = null;
function clearMarkers() {
  while (markerGroup.children.length) {
    var o = markerGroup.children.pop();
    o.traverse(function (n) { if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); });
  }
  spinners.length = 0;
}
function addBox(parent, w, h, d, color, x, y, z, ry) {
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: color, roughness: 0.9 }));
  m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; parent.add(m); return m;
}
function syncMarkers() {
  clearMarkers();
  G.craters.forEach(function (cr) {                                   // 폭파 구멍
    var p = cellAt(cr.r, cr.c);
    var d = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), new THREE.MeshBasicMaterial({ color: 0x0a0604, transparent: true, opacity: 0.85 }));
    d.rotation.x = -Math.PI / 2; d.position.set(p.x, 0.012, p.z); markerGroup.add(d);
    var rg = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 24), new THREE.MeshBasicMaterial({ color: 0x7a3a18, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    rg.rotation.x = -Math.PI / 2; rg.position.set(p.x, 0.014, p.z); markerGroup.add(rg);
  });
  G.shields.forEach(function (sh) {                                   // 보호막: 3×3 푸른 막
    var p = cellAt(sh.r, sh.c);
    var pl = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: sh.owner === BLACK ? 0x5aa9ff : 0x9ad9ff, transparent: true, opacity: 0.16, depthWrite: false }));
    pl.rotation.x = -Math.PI / 2; pl.position.set(p.x, 0.02, p.z); markerGroup.add(pl);
    var ln = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(3, 3)), new THREE.LineBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.7 }));
    ln.rotation.x = -Math.PI / 2; ln.position.set(p.x, 0.03, p.z); markerGroup.add(ln);
  });
  G.traps.forEach(function (tr) {                                     // 함정: 설치한 사람(= 지금 차례)에게만 보임
    if (tr.owner !== G.current || G.board[tr.r][tr.c] !== EMPTY) return;
    var p = cellAt(tr.r, tr.c), grp = new THREE.Group(); grp.position.set(p.x, 0.04, p.z);
    addBox(grp, 0.62, 0.03, 0.08, 0x8c4614, 0, 0, 0, 0.785); addBox(grp, 0.62, 0.03, 0.08, 0x8c4614, 0, 0, 0, -0.785);
    var rg = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 20), new THREE.MeshBasicMaterial({ color: 0x8c4614, side: THREE.DoubleSide }));
    rg.rotation.x = -Math.PI / 2; grp.add(rg); markerGroup.add(grp);
  });
  G.windmills.forEach(function (w) {                                  // 풍차: 돌 위의 작은 풍차
    if (!Rules.isStone(G.board[w.r][w.c]) || Rules.isHiddenFor(G, w.r, w.c, G.current)) return;
    var p = cellAt(w.r, w.c), grp = new THREE.Group(); grp.position.set(p.x, 0.36, p.z);
    addBox(grp, 0.05, 0.4, 0.05, 0xcdbd95, 0, 0.15, 0);
    var blades = new THREE.Group(); blades.position.y = 0.36;
    for (var k = 0; k < 4; k++) { var b = addBox(blades, 0.34, 0.02, 0.1, 0xe8d8a8, 0.18, 0, 0); b.parent.remove(b); var pv = new THREE.Group(); pv.rotation.y = k * Math.PI / 2; pv.add(b); blades.add(pv); }
    grp.add(blades); markerGroup.add(grp); spinners.push(blades);
  });
}

/* ---------------- 돌·벽 3D 조작 ---------------- */
function addStoneMesh(r, c, color, animate) {
  var m = makeStone(color), p = cellAt(r, c);
  m.userData.kind = 'stone'; m.userData.color = color;
  if (animate) { m.position.set(p.x, p.y + 2.2, p.z); tween(0.26, function (t) { m.position.y = p.y + 2.2 * (1 - t * t); }, function () { m.position.y = p.y; }); }
  else m.position.copy(p);
  scene.add(m); meshes[r][c] = m; return m;
}
function addWallMesh(r, c, animate) {
  var w = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.8, 0.86), new THREE.MeshStandardMaterial({ color: 0x4d443a, roughness: 1 }));
  w.castShadow = true; w.receiveShadow = true; w.userData.kind = 'wall';
  var q = cellAt(r, c);
  if (animate) { w.position.set(q.x, -0.4, q.z); tween(0.5, function (t) { w.position.y = -0.4 + 0.8 * t; }, function () { w.position.y = 0.4; }); }
  else w.position.set(q.x, 0.4, q.z);
  scene.add(w); meshes[r][c] = w; return w;
}
function dropMesh(r, c) { var m = meshes[r][c]; if (m) { scene.remove(m); meshes[r][c] = null; } return m; }
function flipMesh(m, newColor) {
  tween(0.5, function (t) {
    m.scale.y = 0.45 * Math.max(0.05, Math.abs(Math.cos(t * Math.PI)));
    if (t >= 0.5 && m.userData.color !== newColor) { m.userData.color = newColor; m.material = newColor === BLACK ? matBlack : matWhite; }
  }, function () { m.scale.y = 0.45; m.userData.color = newColor; m.material = newColor === BLACK ? matBlack : matWhite; });
}
function arcMove(m, a, b, dur) {
  tween(dur, function (t) { m.position.x = a.x + (b.x - a.x) * t; m.position.z = a.z + (b.z - a.z) * t; m.position.y = a.y + Math.sin(t * Math.PI) * 2.4; }, function () { m.position.copy(b); });
}
// 엔진 상태에 맞춰 3D 돌·벽을 맞춤 (연출 도중 어긋난 것을 바로잡는 안전장치)
function syncBoard() {
  for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
    var want = G.board[r][c], m = meshes[r][c];
    if (want === EMPTY) { if (m) dropMesh(r, c); continue; }
    if (want === WALL) { if (!m || m.userData.kind !== 'wall') { dropMesh(r, c); addWallMesh(r, c, false); } continue; }
    if (!m || m.userData.kind !== 'stone') { dropMesh(r, c); m = addStoneMesh(r, c, want, false); }
    else if (m.userData.color !== want) { m.userData.color = want; m.material = want === BLACK ? matBlack : matWhite; }
    m.scale.y = 0.45; m.position.copy(cellAt(r, c));
    m.visible = !Rules.isHiddenFor(G, r, c, G.current);              // 투명한 돌은 상대에게 안 보임
  }
}
function highlightLine(line) {
  if (!line) return;
  var a = line[0], b = line[1], dr = Math.sign(b.r - a.r), dc = Math.sign(b.c - a.c), r = a.r, c = a.c;
  for (var i = 0; i < 20; i++) {
    var m = meshes[r][c];
    if (m) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0xffaa33); m.material.emissiveIntensity = 0.7; }
    if (r === b.r && c === b.c) break; r += dr; c += dc;
  }
}

/* ---------------- 엔진 이벤트 → 연출 (순서대로 하나씩) ---------------- */
var handDirty = false, peekMeshes = [];
function mapIndexOf(name) { var ms = getMaps(); for (var i = 0; i < ms.length; i++) if (ms[i].id === name) return i; return -1; }
// 이벤트 하나를 연출하고, 다음 이벤트까지 기다릴 시간(초)을 돌려줌
function handleEvent(e) {
  var p, m, i;
  switch (e.t) {
    case 'place': addStoneMesh(e.r, e.c, e.p, true); sfx('place'); return 0.3;
    case 'trapHit': m = dropMesh(e.r, e.c); burst(cellAt(e.r, e.c), 0xb070ff, 18); sfx('boom'); return 0.35;
    case 'remove':
      m = dropMesh(e.r, e.c);
      burst(cellAt(e.r, e.c), e.why === 'snipe' ? 0xff4a3a : 0xff8a2a, e.why === 'snipe' ? 14 : 22); sfx(e.why === 'snipe' ? 'place' : 'boom');
      return e.why === 'snipe' ? 0.3 : 0.45;
    case 'move':
      m = meshes[e.from.r][e.from.c]; if (!m) return 0;
      meshes[e.from.r][e.from.c] = null; meshes[e.to.r][e.to.c] = m;
      burst(cellAt(e.from.r, e.from.c), 0x9ad0ff, 12); sfx('magic');
      arcMove(m, m.position.clone(), cellAt(e.to.r, e.to.c), 0.7);
      return 0.75;
    case 'convert': m = meshes[e.r][e.c]; if (m) flipMesh(m, e.to); sfx('magic'); return e.why === 'trade' ? 0.05 : 0.15;
    case 'flip':
      sfx('magic');
      e.cells.forEach(function (q) { var mm = meshes[q.r][q.c]; if (mm) flipMesh(mm, mm.userData.color === BLACK ? WHITE : BLACK); });
      return 0.6;
    case 'quake': {
      var old = meshes, nm = [];
      for (var r = 0; r < N; r++) { nm.push(new Array(N).fill(null)); for (var c = 0; c < N; c++) if (old[r][c] && old[r][c].userData.kind === 'wall') nm[r][c] = old[r][c]; }
      e.moves.forEach(function (mv) {
        var mm = old[mv.from.r][mv.from.c]; if (!mm) return;
        nm[mv.to.r][mv.to.c] = mm;
        var a = mm.position.clone(), b = cellAt(mv.to.r, mv.to.c);
        tween(0.5, function (t) { mm.position.x = a.x + (b.x - a.x) * t; mm.position.z = a.z + (b.z - a.z) * t; mm.position.y = a.y + Math.sin(t * Math.PI * 3) * 0.12; }, function () { mm.position.copy(b); });
      });
      meshes = nm; sfx('boom'); camShake = 0.6; return 0.6;
    }
    case 'wall': addWallMesh(e.r, e.c, true); sfx('boom'); burst(cellAt(e.r, e.c), 0x8a7a66, 10); return 0.5;
    case 'giant':
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        var rr = e.r + dr, cc = e.c + dc; if (!Rules.inb(rr, cc)) continue;
        if (meshes[rr][cc]) { burst(cellAt(rr, cc), 0xb09a80, 8); dropMesh(rr, cc); }
        addWallMesh(rr, cc, true);
      }
      sfx('boom'); camShake = 1; return 0.7;
    case 'windmill': case 'shield': case 'trap': case 'crater': sfx('magic'); return 0.15;
    case 'blocked': sfx('boom'); return 0.3;
    case 'weather': {
      var mi = mapIndexOf(e.map); if (mi >= 0) { curMapIdx = mi; var sel = document.getElementById('mapSel'); if (sel) sel.value = mi; applyMap(getMaps()[mi]); }
      sfx('magic'); return 0.8;
    }
    case 'gain': case 'overflow': case 'spend': handDirty = true; if (e.t === 'gain') sfx('card'); return 0;
    case 'tradeFirst': tradeFirst = { r: e.r, c: e.c }; sfx('card'); return 0;
    case 'cancel': tradeFirst = null; return 0;
    case 'reveal': sfx('magic'); return 0.2;
    case 'turn': onTurnChanged(); return 0.15;
    case 'draft': openDraftUI(e.picks); return 0.3;
    case 'alkTurn': startAlkUI(); return 0;
    case 'alkSnap': finishAlkUI(e.stones); return 0.4;
    case 'win': highlightLine(e.line); sfx('win'); tween(0.9, function () {}, function () { document.getElementById('bannerText').textContent = (e.p === BLACK ? '⚫ 흑' : '⚪ 백') + ' 승리!'; elBanner.style.display = 'flex'; }); return 0;
    case 'draw': tween(0.9, function () {}, function () { document.getElementById('bannerText').textContent = '무승부'; elBanner.style.display = 'flex'; }); return 0;
  }
  return 0;
}
function onTurnChanged() {
  tradeFirst = null; inspectIdx = -1; clearPlayed(); handDirty = true; setTopView(false, true);
}
function syncAll() {
  syncBoard(); syncMarkers(); syncPeek(); syncS(); updateHUD();
  if (handDirty) { rebuildHand(); handDirty = false; }
}
function runEvents(evs, after) {
  var i = 0; busy++;
  (function next() {
    if (i >= evs.length) { syncAll(); busy--; if (after) after(); return; }
    var d = handleEvent(evs[i++]);
    if (d > 0) tween(d, function () {}, next); else next();
  })();
}
