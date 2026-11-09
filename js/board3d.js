/* 판 연출 — HUD · 풍차/보호막/함정/구멍 표시 · 돌·벽 조작 · 엔진 이벤트 → 3D 연출 */
'use strict';

/* ---------------- HUD ---------------- */
var elTurn = document.getElementById('turn');
var elEnd = document.getElementById('endturn');
var elBanner = document.getElementById('banner');
function setMsg() { /* 상단 안내 문구는 표시하지 않음 (차례만 보여줌) */ }
function updateHUD() {
  if (!G) return;
  var who = function (p) { return t(p === BLACK ? 'who.black' : 'who.white'); };
  var tx = G.alk ? t('turn.alk', { who: who(G.alk.order[G.alk.idx]) }) : t(G.current === BLACK ? 'turn.black' : 'turn.white');
  var b = [];                                   // 작은 상태 표시만
  if (G.next.giant === G.current) b.push('[[rock]]');
  if (G.winOver[G.current]) b.push('[[turtle]]4목');
  if (G.lock[G.current]) b.push('[[forbid]]');
  if (G.winLength === 6) b.push('6목');
  elTurn.innerHTML = H(tx + (b.length ? '  ' + b.join(' ') : ''));
  elEnd.style.display = 'none';
}
function syncS() {
  S.turn = G.current; S.over = G.gameOver;
  S.mode = G.pending ? G.pending.type : null; S.pendingIdx = G.pending && humanTurn() ? G.pending.handIndex : -1;
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
var darkMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ color: 0x03030a, transparent: true, opacity: 0.55, depthWrite: false }));
darkMesh.rotation.x = -Math.PI / 2; darkMesh.position.y = 0.5; darkMesh.visible = false; scene.add(darkMesh);
function crownSprite() {
  var cv = document.createElement('canvas'); cv.width = cv.height = 128; var g = cv.getContext('2d');
  g.fillStyle = '#e0b030'; g.strokeStyle = '#3a2408'; g.lineWidth = 6; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(18, 92); g.lineTo(12, 44); g.lineTo(40, 66); g.lineTo(64, 28); g.lineTo(88, 66); g.lineTo(116, 44); g.lineTo(110, 92); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#c0392b'; [[64, 74], [38, 78], [90, 78]].forEach(function (q) { g.beginPath(); g.arc(q[0], q[1], 5, 0, 7); g.fill(); });
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  sp.scale.set(0.8, 0.8, 1); return sp;
}
function syncMarkersExtra() {
  if (G.zoneWarn && G.zone < Rules.ZONE.MAX) {                           // 자기장 예고: 다음에 닫힐 바깥 줄을 붉게
    var z = G.zone, lo = z - HALF - 0.5, hi = (N - 1 - z) - HALF + 0.5, lo2 = lo + 1, hi2 = hi - 1;
    [[lo, hi], [lo2, hi2]].forEach(function (q) {
      var pts = [new THREE.Vector3(q[0], 0.07, q[0]), new THREE.Vector3(q[1], 0.07, q[0]), new THREE.Vector3(q[1], 0.07, q[1]), new THREE.Vector3(q[0], 0.07, q[1])];
      markerGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff4a3a })));
    });
  }
  if (G.map === 'space') {                                               // 우주: 이어진 판의 가장자리를 빛으로 표시 (위↔아래 보라, 좌↔우 청록)
    [[0, -8.2, 16.4, 0.4, 0xa070ff], [0, 8.2, 16.4, 0.4, 0xa070ff], [-8.2, 0, 0.4, 16.4, 0x40e0d0], [8.2, 0, 0.4, 16.4, 0x40e0d0]].forEach(function (e2) {
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(e2[2], e2[3]), new THREE.MeshBasicMaterial({ color: e2[4], transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      pl.rotation.x = -Math.PI / 2; pl.position.set(e2[0], 0.04, e2[1]); markerGroup.add(pl);
    });
  }
  [BLACK, WHITE].forEach(function (p) {                                  // 왕으로 지정된 돌: 👑 + 금빛 고리 (양쪽에 보임)
    var k = G.lg.king[p];
    if (!k || G.board[k.r][k.c] !== p || Rules.isDark(G)) return;
    var q = cellAt(k.r, k.c);
    var rg = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.56, 28), new THREE.MeshBasicMaterial({ color: 0xe8b923, side: THREE.DoubleSide }));
    rg.rotation.x = -Math.PI / 2; rg.position.set(q.x, 0.05, q.z); markerGroup.add(rg);
    var sp = crownSprite(); sp.position.set(q.x, 0.85, q.z); markerGroup.add(sp);
  });
  if (G.pending && G.pending.picks) G.pending.picks.forEach(function (q) {   // 거신병·올인: 고른 돌 표시
    var c = cellAt(q.r, q.c), rg = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.58, 28), new THREE.MeshBasicMaterial({ color: 0xff5a36, side: THREE.DoubleSide }));
    rg.rotation.x = -Math.PI / 2; rg.position.set(c.x, 0.06, c.z); markerGroup.add(rg);
  });
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
    if (tr.owner !== viewer() || G.board[tr.r][tr.c] !== EMPTY) return;
    var p = cellAt(tr.r, tr.c), grp = new THREE.Group(); grp.position.set(p.x, 0.04, p.z);
    addBox(grp, 0.62, 0.03, 0.08, 0x8c4614, 0, 0, 0, 0.785); addBox(grp, 0.62, 0.03, 0.08, 0x8c4614, 0, 0, 0, -0.785);
    var rg = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 20), new THREE.MeshBasicMaterial({ color: 0x8c4614, side: THREE.DoubleSide }));
    rg.rotation.x = -Math.PI / 2; grp.add(rg); markerGroup.add(grp);
  });
  G.windmills.forEach(function (w) {                                  // 풍차: 돌 위의 작은 풍차
    if (!Rules.isStone(G.board[w.r][w.c]) || Rules.isDark(G)) return;
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
// 벽의 종류: 장벽(바위) · 겨울의 얼음 · 닫힌 자기장 (거대한 돌은 아래에서 따로)
function wallStyle(r, c) {
  if (G.frozen.some(function (f) { return f.r === r && f.c === c; })) return 'ice';
  if (Rules.isZoneCell(G, r, c)) return 'zone';
  if (Rules.giantAt(G, r, c)) return 'giant';
  return 'rock';
}
function wallMaterial(style) {
  if (style === 'ice') return new THREE.MeshStandardMaterial({ color: 0xbfe4ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.8, emissive: 0x3a6a9a, emissiveIntensity: 0.3 });
  if (style === 'zone') return new THREE.MeshStandardMaterial({ color: 0x241638, roughness: 0.8, emissive: 0x4a1a88, emissiveIntensity: 0.45 });
  return new THREE.MeshStandardMaterial({ color: 0x4d443a, roughness: 1 });
}
function addWallMesh(r, c, animate) {
  if (wallStyle(r, c) === 'giant') return ensureGiant(Rules.giantAt(G, r, c), animate);
  var style = wallStyle(r, c), h = style === 'ice' ? 0.7 : 0.8;
  var w = new THREE.Mesh(new THREE.BoxGeometry(0.86, h, 0.86), wallMaterial(style));
  w.castShadow = true; w.receiveShadow = true; w.userData.kind = 'wall'; w.userData.style = style;
  var q = cellAt(r, c), top = h / 2;
  if (animate) { w.position.set(q.x, -h / 2, q.z); tween(0.5, function (t) { w.position.y = -h / 2 + h * t; }, function () { w.position.y = top; }); }
  else w.position.set(q.x, top, q.z);
  scene.add(w); meshes[r][c] = w; return w;
}
// 거대한 돌은 3×3 칸이 하나의 모델을 함께 가리키므로, 한 칸만 비울 때는 장면에서 지우지 않음
function dropMesh(r, c) {
  var m = meshes[r][c];
  if (m && m.userData.style === 'giant') { meshes[r][c] = null; return m; }
  if (m) { scene.remove(m); meshes[r][c] = null; }
  return m;
}

/* ---------------- 거대한 돌: 3×3 칸을 차지하는 바위 하나 (울퉁불퉁한 돌 모델) ---------------- */
var giantMeshes = {};
function rockNoise(x, y, z, seed) { var v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453; return v - Math.floor(v); }
function makeRockGeometry(seed) {
  var geo = new THREE.IcosahedronGeometry(1, 2), pos = geo.attributes.position, v = new THREE.Vector3();
  for (var i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    var k = 0.8 + 0.34 * rockNoise(Math.round(v.x * 40), Math.round(v.y * 40), Math.round(v.z * 40), seed) + 0.1 * Math.sin(v.x * 3 + seed) * Math.cos(v.z * 3);   // 같은 자리의 점은 같은 값 → 틈 없이 울퉁불퉁
    v.multiplyScalar(k); pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return geo;
}
function createGiantRock(g, animate) {
  var key = g.r + ',' + g.c, seed = g.r * 31 + g.c + 7;
  var grp = new THREE.Group(); grp.userData.kind = 'wall'; grp.userData.style = 'giant'; grp.userData.giantKey = key;
  var mat = new THREE.MeshStandardMaterial({ color: 0x6f675d, roughness: 1, metalness: 0, flatShading: true });
  var big = new THREE.Mesh(makeRockGeometry(seed), mat);
  big.scale.set(1.32, 0.8, 1.32); big.position.y = 0.42; big.rotation.y = seed; big.castShadow = true; big.receiveShadow = true; grp.add(big);
  [[1.15, 1.0, 0.34], [-1.1, 0.8, 0.3], [0.3, -1.25, 0.36], [-0.7, 1.2, 0.26], [1.3, -0.5, 0.22]].forEach(function (d, i) {   // 바위 곁의 작은 돌 조각
    var sm = new THREE.Mesh(makeRockGeometry(seed + i * 5 + 1), mat);
    sm.scale.set(d[2], d[2] * 0.7, d[2]); sm.position.set(d[0], d[2] * 0.4, d[1]); sm.rotation.y = i * 1.7; sm.castShadow = true; grp.add(sm);
  });
  var q = cellAt(g.r, g.c); grp.position.set(q.x, 0, q.z);
  scene.add(grp); giantMeshes[key] = grp; assignGiantCells(g, grp);
  if (animate) {
    grp.position.y = 7;
    tween(0.45, function (t) { grp.position.y = 7 * (1 - t * t); }, function () { grp.position.y = 0; camShake = 1; burst(new THREE.Vector3(q.x, 0.3, q.z), 0xb09a80, 26); });
  }
  return grp;
}
function assignGiantCells(g, grp) {
  for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
    var rr = g.r + dr, cc = g.c + dc;
    if (!Rules.inb(rr, cc) || G.board[rr][cc] !== WALL || Rules.isZoneCell(G, rr, cc)) continue;
    meshes[rr][cc] = grp;
  }
}
function ensureGiant(g, animate) {
  var key = g.r + ',' + g.c, grp = giantMeshes[key];
  if (grp) { assignGiantCells(g, grp); return grp; }
  return createGiantRock(g, animate);
}
function removeGiantMesh(key) {
  var grp = giantMeshes[key]; if (!grp) return null;
  scene.remove(grp); delete giantMeshes[key];
  grp.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
  for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (meshes[r][c] === grp) meshes[r][c] = null;
  return grp;
}
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
    if (want === WALL) { if (!m || m.userData.kind !== 'wall' || m.userData.style !== wallStyle(r, c)) { dropMesh(r, c); addWallMesh(r, c, false); } continue; }
    if (!m || m.userData.kind !== 'stone') { dropMesh(r, c); m = addStoneMesh(r, c, want, false); }
    else if (m.userData.color !== want) { m.userData.color = want; m.material = want === BLACK ? matBlack : matWhite; }
    m.scale.y = 0.45; m.position.copy(cellAt(r, c));
    m.visible = !Rules.isDark(G);                                     // 눈 감고 두기: 판이 어두운 동안 돌이 안 보임
  }
  darkMesh.visible = Rules.isDark(G);
  Object.keys(giantMeshes).forEach(function (k) {                       // 사라진 거대한 돌의 모델 정리
    var q = k.split(',');
    if (!G.giants.some(function (g) { return g.r === +q[0] && g.c === +q[1]; })) removeGiantMesh(k);
  });
}
function highlightLine(line, cells) {
  if (!line) return;
  var list = cells;
  if (!list) {
    list = []; var a = line[0], b = line[1], dr = Math.sign(b.r - a.r), dc = Math.sign(b.c - a.c), r = a.r, c = a.c;
    for (var i = 0; i < 20; i++) { list.push({ r: r, c: c }); if (r === b.r && c === b.c) break; r += dr; c += dc; }
  }
  list.forEach(function (q) {
    var m = meshes[q.r][q.c];
    if (m) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0xffaa33); m.material.emissiveIntensity = 0.7; }
  });
}

/* ---------------- 엔진 이벤트 → 연출 (순서대로 하나씩) ---------------- */
var handDirty = false, peekMeshes = [];
// 여러 돌을 동시에 옮김 (지진 · 모래폭풍). jitter: 흔들림 세기
function moveMany(moves, jitter) {
  var old = meshes, nm = [];
  for (var r = 0; r < N; r++) { nm.push(new Array(N).fill(null)); for (var c = 0; c < N; c++) if (old[r][c] && old[r][c].userData.kind === 'wall') nm[r][c] = old[r][c]; }
  moves.forEach(function (mv) {
    var mm = old[mv.from.r][mv.from.c]; if (!mm) return;
    nm[mv.to.r][mv.to.c] = mm;
    var a = mm.position.clone(), b = cellAt(mv.to.r, mv.to.c);
    tween(0.5, function (t) { mm.position.x = a.x + (b.x - a.x) * t; mm.position.z = a.z + (b.z - a.z) * t; mm.position.y = a.y + Math.sin(t * Math.PI * jitter) * 0.12; }, function () { mm.position.copy(b); });
  });
  meshes = nm;
}
function mapIndexOf(name) { var ms = getMaps(); for (var i = 0; i < ms.length; i++) if (ms[i].id === name) return i; return -1; }
// 이벤트 하나를 연출하고, 다음 이벤트까지 기다릴 시간(초)을 돌려줌
function handleEvent(e) {
  var p, m, i;
  switch (e.t) {
    case 'place': addStoneMesh(e.r, e.c, e.p, true); sfx('place'); return 0.3;
    case 'trapHit': m = dropMesh(e.r, e.c); burst(cellAt(e.r, e.c), 0xb070ff, 18); sfx('boom'); return 0.35;
    case 'remove':
      m = dropMesh(e.r, e.c);
      burst(cellAt(e.r, e.c), { snipe: 0xff4a3a, melt: 0xff9a3a, tsunami: 0x5aa8ff, zone: 0xb070ff, smash: 0xd0b080 }[e.why] || 0xff8a2a, e.why === 'snipe' ? 14 : 22); sfx(e.why === 'snipe' ? 'place' : 'boom');
      return e.why === 'snipe' ? 0.3 : (e.why === 'zone' || e.why === 'melt' || e.why === 'tsunami') ? 0.15 : 0.45;
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
    case 'quake': moveMany(e.moves, 3); sfx('boom'); camShake = 0.6; return 0.6;
    case 'sandstorm': moveMany(e.moves, 1); sfx('boom'); camShake = 0.5; for (i = 0; i < 18; i++) burst(new THREE.Vector3((Math.random() - 0.5) * 14, 0.4, (Math.random() - 0.5) * 14), 0xd8b070, 2); return 0.65;
    case 'freeze': dropMesh(e.r, e.c); burst(cellAt(e.r, e.c), 0xbfe4ff, 14); addWallMesh(e.r, e.c, true); sfx('card'); return 0.5;
    case 'thaw': dropMesh(e.r, e.c); burst(cellAt(e.r, e.c), 0x9ad0ff, 12); addStoneMesh(e.r, e.c, e.owner, true); sfx('place'); return 0.4;
    case 'zone':
      for (var zr = 0; zr < N; zr++) for (var zc = 0; zc < N; zc++) if (Rules.ringOf(zr, zc) === e.zone - 1) { if (meshes[zr][zc]) dropMesh(zr, zc); addWallMesh(zr, zc, true); }
      sfx('boom'); camShake = 1; toast(e.n ? '[[bolt]] 자기장이 줄어듭니다 — 바깥 줄의 돌 ' + e.n + '개가 사라졌습니다' : '[[bolt]] 자기장이 줄어듭니다 (바깥 줄은 이제 둘 수 없음)', 3000); return 0.8;
    case 'zoneWarn': toast('[[bolt]] 다음 라운드에 자기장이 줄어듭니다 (바깥 한 줄)', 3000); sfx('card'); return 0.2;
    case 'disaster': {
      var who = e.owner === BLACK ? '흑' : '백';
      var msg = e.kind === 'melt' ? '[[sun]] 더위로 돌 ' + e.n + '개가 녹아 사라졌습니다'
        : e.kind === 'freeze' ? '[[snow]] ' + who + '의 돌 하나가 얼어붙었습니다 (2라운드)'
        : e.kind === 'sandstorm' ? '[[cactus]] 모래폭풍! 돌 ' + e.n + '개가 ' + e.dir + '으로 밀렸습니다'
        : '[[wave]] 쓰나미! ' + e.dir + ' 가장자리 3줄의 돌 ' + e.n + '개가 휩쓸려 갔습니다';
      toast(msg, 3000); return 0.2;
    }
    case 'map': applyThemeFor(e.id); return 0;
    case 'wall': addWallMesh(e.r, e.c, true); sfx('boom'); burst(cellAt(e.r, e.c), 0x8a7a66, 10); return 0.5;
    case 'giant':                                                          // 바위 하나가 떨어져 3×3 칸의 돌을 깨뜨림
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        var rr = e.r + dr, cc = e.c + dc; if (!Rules.inb(rr, cc)) continue;
        if (meshes[rr][cc] && meshes[rr][cc].userData.style !== 'giant') { burst(cellAt(rr, cc), 0xb09a80, 8); dropMesh(rr, cc); }
      }
      createGiantRock({ r: e.r, c: e.c }, true); sfx('boom'); return 0.8;
    case 'giantBreak': {                                                   // 폭파: 바위가 산산이 부서짐
      var gk = e.r + ',' + e.c; removeGiantMesh(gk);
      var gc = cellAt(e.r, e.c);
      for (i = 0; i < 4; i++) burst(new THREE.Vector3(gc.x + (Math.random() - 0.5) * 2.2, 0.5, gc.z + (Math.random() - 0.5) * 2.2), i % 2 ? 0xb09a80 : 0x8a7a66, 14);
      sfx('boom'); camShake = 1; return 0.6;
    }
    case 'windmill': case 'shield': case 'trap': case 'crater': sfx('magic'); return 0.15;
    case 'blocked': sfx('boom'); return 0.3;
    case 'weather': {
      var mp = Rules.MAP_BY_ID[e.map]; applyThemeFor(e.map);
      toast('[[weather]] 기상 이변! 맵이 ' + '[[' + mp.icon + ']] ' + mp.name + '(으)로 바뀌었습니다 — ' + mp.short, 3400); sfx('magic'); return 0.8;
    }
    case 'gain': case 'overflow': case 'spend': handDirty = true; if (e.t === 'gain') sfx('card'); return 0;
    case 'tradeFirst': tradeFirst = { r: e.r, c: e.c }; sfx('card'); return 0;
    case 'cancel': tradeFirst = null; return 0;
    case 'spawn': addStoneMesh(e.r, e.c, e.p, true); sfx('place'); burst(cellAt(e.r, e.c), 0xffe08a, 8); return 0.25;
    case 'legend': {
      var lc = Rules.LEGEND_BY_ID[e.id]; handDirty = true; sfx('magic');
      toast((lc ? lc.name : '전설 카드') + ' 발동!', 2400); return 0.2;
    }
    case 'legendPick': sfx('card'); return 0;
    case 'dark': toast('[[blind]] ' + (e.turns || 5) + '턴 동안 판의 상태를 확인할 수 없습니다', 3000); sfx('magic'); return 0.3;
    case 'coin': toast(e.win ? '[[coin]] 동전: 앞면! 상대의 가장 긴 줄이 사라집니다' : '[[coin]] 동전: 뒷면… 내 가장 긴 줄이 사라집니다', 2800); sfx('card'); return 0.6;
    case 'slot': return playSlot(e.reels, e.win);
    case 'handLost': handDirty = true; return 0;
    case 'counter': toast('[[zen]] 무소유! 카드가 무효가 되었고 패 ' + e.n + '장을 버렸습니다', 3000); handDirty = true; sfx('boom'); return 0.4;
    case 'counterAsk': if (botColor && e.holder === botColor) return 0.2; showCounterBox(e.holder, e.user, e.id, answerCounterUI); return 0;
    case 'king': sfx('magic'); toast('[[crown]] 왕으로 지정! 20턴 살아남으면 귀환합니다', 2600); return 0.3;
    case 'kingLost': toast('[[crown]] 왕이 쓰러졌습니다…', 2400); return 0.2;
    case 'kingReturn': handDirty = true; sfx('win'); toast('[[crown]] 왕의 귀환! 패가 가득 차고 새 전설 카드를 받았습니다', 3200); return 0.5;
    case 'rule': if (e.turtle) toast('[[turtle]] 이제 한쪽은 4목으로도 승리합니다', 2600); else toast('[[eye]] 이제 6목이 되어야 승리합니다', 2600); return 0.2;
    case 'slothDone': return 0;
    case 'legendPicked': case 'start': case 'ability': handDirty = true; return 0;
    case 'turn': onTurnChanged(); tutOnTurn(); return 0.15;
    case 'draft': if (botColor && e.p === botColor) return 0.3; openDraftUI(e.picks, e.kind, e.refresh, e.p); return 0.3;
    case 'alkTurn': startAlkUI(); return 0;
    case 'alkSnap': finishAlkUI(e.stones); return 0.4;
    case 'win': highlightLine(e.line, e.cells); sfx('win'); if (tutOnWin()) return 0; tween(0.9, function () {}, function () { document.getElementById('bannerText').innerHTML = H(t('banner.win', { who: t(e.p === BLACK ? 'who.black' : 'who.white') })); elBanner.style.display = 'flex'; }); return 0;
    case 'resign': sfx('boom'); tween(0.5, function () {}, function () { document.getElementById('bannerText').innerHTML = H(t('banner.resign', { who: t(e.p === BLACK ? 'who.black' : 'who.white'), winner: t(e.winner === BLACK ? 'who.black' : 'who.white') })); elBanner.style.display = 'flex'; }); return 0;
    case 'draw': tween(0.9, function () {}, function () { document.getElementById('bannerText').textContent = t('banner.draw'); elBanner.style.display = 'flex'; }); return 0;
  }
  return 0;
}
function onTurnChanged() {
  tradeFirst = null; inspectIdx = -1; clearPlayed(); handDirty = true;
  // 시점은 저절로 바꾸지 않음 (사용자가 직접 누르거나, 카드를 사용할 때만 바뀜)
}
function syncAll() {
  syncBoard(); syncMarkers(); syncMarkersExtra(); syncPeek(); syncS(); updateHUD(); updateTrait();
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
