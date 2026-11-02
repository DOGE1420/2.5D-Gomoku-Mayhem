/* 카드 뽑기(3장 중 1장) · 엿보기 · 알까기(3D 물리) 화면 */
'use strict';

/* ---------------- 엿보기: 상대 패를 위쪽에 펼쳐 보여줌 ---------------- */
function syncPeek() {
  peekMeshes.forEach(function (m) { handGroup.remove(m); m.material.dispose(); });
  peekMeshes = [];
  if (!G.peek || G.peek.by !== G.current) return;
  var vs = viewSize();
  G.peek.cards.forEach(function (id, i) {
    var m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardTexture(id), transparent: true, alphaTest: 0.02 }));
    m.scale.set(0.42, 0.42, 1); m.position.set(-vs.vw / 2 + 0.55 + i * 0.7, vs.vh / 2 - 0.85, 0.3);
    handGroup.add(m); peekMeshes.push(m);
  });
}

/* ---------------- 카드 뽑기 (3장 중 1장) ---------------- */
var draftMeshes = [], draftIds = [], hoverDraft = -1;
function openDraftUI(picks) {
  closeDraftUI(); draftIds = picks.slice(); inspectIdx = -1;
  picks.forEach(function (id, i) {
    var m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardTexture(id), transparent: true, alphaTest: 0.02 }));
    m.userData.draftIdx = i; m.position.set((i - 1) * 2.4, -4.6, 1.0); m.scale.set(1.5, 1.5, 1);
    handGroup.add(m); draftMeshes.push(m);
  });
  sfx('card');
}
function closeDraftUI() {
  draftMeshes.forEach(function (m) { handGroup.remove(m); m.material.dispose(); });
  draftMeshes = []; draftIds = []; hoverDraft = -1;
}
function stepDraft(k) {
  draftMeshes.forEach(function (m, i) {
    var hov = hoverDraft === i, tx = (i - 1) * 2.45, ty = hov ? 0.32 : 0.1, ts = hov ? 1.62 : 1.5;
    m.position.x += (tx - m.position.x) * k; m.position.y += (ty - m.position.y) * k; m.position.z = 1.0 + (hov ? 0.1 : 0);
    var s = m.scale.x + (ts - m.scale.x) * k; m.scale.set(s, s, 1);
    var c = m.material.color.r + ((hov ? 1 : 0.8) - m.material.color.r) * k; m.material.color.setRGB(c, c, c);
  });
}
function onDraftClick(i) {
  if (busy > 0 || !G.draft) return;
  var res = Rules.pickDraft(G, draftIds[i]); if (!res.ok) return;
  var evs = Rules.drain(G); sfx('card'); closeDraftUI(); runEvents(evs);
}

/* ---------------- 알까기 (3D 물리: 당겨서 쏘기) ---------------- */
var alkUI = null, alkAcc = 0;
var aimBand = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xff6a3a }));
var aimDir = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffd27a }));
aimBand.visible = aimDir.visible = false; scene.add(aimBand); scene.add(aimDir);
function startAlkUI() {
  setTopView(true, true);
  var ms = [];
  G.alk.stones.forEach(function (s) {
    var m;
    if (s.isNew) { m = makeStone(s.color); m.userData.kind = 'stone'; m.userData.color = s.color; m.position.set(s.x, STONE_Y, s.z); scene.add(m); }
    else m = meshes[Math.round(s.z + HALF)][Math.round(s.x + HALF)];
    ms.push(m);
  });
  alkUI = { meshes: ms, dragging: false };
  alkAcc = 0; updateHUD();
}
function updateAlkMeshes() {
  if (!alkUI || !G.alk) return;
  G.alk.stones.forEach(function (s, i) { var m = alkUI.meshes[i]; if (m) m.position.set(s.x, STONE_Y, s.z); });
}
function finishAlkUI(snaps) {
  if (!alkUI) return;
  var nm = [];
  for (var r = 0; r < N; r++) { nm.push(new Array(N).fill(null)); for (var c = 0; c < N; c++) if (meshes[r][c] && meshes[r][c].userData.kind === 'wall') nm[r][c] = meshes[r][c]; }
  snaps.forEach(function (sn, i) {
    var m = alkUI.meshes[i]; if (!m) return;
    nm[sn.r][sn.c] = m;
    var a = m.position.clone(), b = cellAt(sn.r, sn.c);
    tween(0.3, function (t) { m.position.x = a.x + (b.x - a.x) * t; m.position.z = a.z + (b.z - a.z) * t; }, function () { m.position.copy(b); });
  });
  meshes = nm; alkUI = null; aimBand.visible = aimDir.visible = false; sfx('place');
}
function aimUpdate(pos) {
  var s = G.alk.stones[G.alk.newIndex], px = pos.x - s.x, pz = pos.z - s.z, d = Math.hypot(px, pz), mx = Rules.ALK.MAXPULL;
  if (d > mx) { px *= mx / d; pz *= mx / d; }
  aimBand.geometry.setFromPoints([new THREE.Vector3(s.x, 0.15, s.z), new THREE.Vector3(s.x + px, 0.15, s.z + pz)]);
  aimDir.geometry.setFromPoints([new THREE.Vector3(s.x, 0.15, s.z), new THREE.Vector3(s.x - px * 1.5, 0.15, s.z - pz * 1.5)]);
  aimBand.visible = aimDir.visible = true;
}
