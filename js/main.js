/* 증강 오목 3D 프로토타입 — 시작 · 초기화 · 메인 루프
 * 규칙은 js/rules.js(엔진), 화면은 setup/scene/stones/fx/audio/card-art/hand/board3d/draft-alk/flow/maps 가 담당.
 * (모두 같은 전역 공간을 쓰는 일반 스크립트라서 index.html 의 불러오는 순서가 중요함)
 */
'use strict';

/* ---------------- 초기화 ---------------- */
function reset() {
  for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) { if (meshes[r][c]) scene.remove(meshes[r][c]); meshes[r][c] = null; }
  if (alkUI) alkUI.meshes.forEach(function (m) { if (m) scene.remove(m); });
  G = Rules.create(); anims.length = 0; busy = 0; tradeFirst = null; alkUI = null; alkAcc = 0;
  closeDraftUI(); aimBand.visible = aimDir.visible = false;
  elBanner.style.display = 'none'; setTopView(false, true); clearPlayed(); clearBurns();
  handDirty = false; inspectIdx = -1; syncAll(); rebuildHand();
}

/* ---------------- 루프 ---------------- */
function resize() {
  var w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h;
  // 세로 화면(모바일): 시야각을 넓히고 카메라를 조금 뒤로 — 판 전체가 폭에 들어오게
  camDist = camera.aspect < 1.5 ? Math.min(1.9, 1.5 / camera.aspect) : 1;
  camera.fov = camera.aspect < 1.2 ? 62 : 45;
  camera.updateProjectionMatrix();
  // 직부감: 패는 숨기므로 판(17칸 폭)이 화면 86% 높이·94% 폭 안에 들어오는 높이
  var th = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  topH = Math.max((17 / 0.86) / (2 * th), (17 / 0.94) / (2 * th * camera.aspect));
  topDz = -0.025 * 2 * topH * th;     // 위쪽 안내 문구를 피해 살짝 아래로
}
window.addEventListener('resize', resize);

var clock = new THREE.Clock(), time = 0;
function frame() {
  var dt = Math.min(0.05, clock.getDelta()); time += dt;
  stepAnims(dt); stepParticles(dt); stepCards(dt); stepBurns(dt);

  // 촛불 일렁임
  candles.forEach(function (c) {
    var fl = 1 + Math.sin(time * 13 + c.phase) * 0.06 + Math.sin(time * 31 + 1.7 + c.phase) * 0.05 + (Math.random() - 0.5) * 0.05;
    c.light.intensity = candleBase * c.k * fl; c.flame.scale.set(1, 1.8 * fl, 1);
    c.light.position.x = c.x + Math.sin(time * 5 + c.phase) * 0.06;
  });
  stars.material.opacity = 0.5 + Math.sin(time * 1.3) * 0.08;

  // 카메라: 앉은 시점(마우스 시차) ↔ 직부감 부드럽게 전환
  topT += (topGoal - topT) * (1 - Math.pow(0.002, dt));
  if (Math.abs(topGoal - topT) < 0.0008) topT = topGoal;
  parX += (mouseN.x * 0.9 - parX) * 0.06; parY += (mouseN.y * 0.5 - parY) * 0.06;
  var k = 1 - topT;
  camera.position.set(
    (CAM_BASE.x * camDist + parX * k) * k,
    (CAM_BASE.y * camDist + parY * k) * k + topH * topT,
    (CAM_BASE.z * camDist) * k + topDz * topT);
  camera.up.set(0, k, -topT).normalize();
  if (camShake > 0) { camera.position.x += (Math.random() - 0.5) * camShake * 0.35; camera.position.y += (Math.random() - 0.5) * camShake * 0.25; camShake = Math.max(0, camShake - dt * 2.2); }
  camera.lookAt(CAM_LOOK.x * k, CAM_LOOK.y * k, CAM_LOOK.z * k + topDz * topT);
  if (scene.fog) { scene.fog.near = fogBase.near + 30 * topT; scene.fog.far = fogBase.far + 70 * topT; }

  // 고스트 / 링 표시
  ghost.visible = false; ring.visible = false; ring2.visible = false;
  if (!G.gameOver && hoverCell && hoverCard < 0 && topT > 0.85 && inspectIdx < 0 && !draftMeshes.length && !G.alk && busy === 0) {
    var rr = hoverCell[1], cc = hoverCell[0], hp = cellAt(rr, cc);
    if (G.pending) {
      if (Rules.isValidTarget(G, rr, cc)) { ring.visible = true; ring.position.set(hp.x, 0.05, hp.z); ring.material.color.set(PEND_COLOR[G.pending.type] || 0xffd27a); }
    } else if (Rules.canPlace(G, rr, cc)) { ghost.visible = true; ghost.position.copy(hp); ghost.material.color.set(G.current === BLACK ? 0x17130f : 0xece4d2); }
  }
  if (tradeFirst && G.pending) { var tp = cellAt(tradeFirst.r, tradeFirst.c); ring2.visible = true; ring2.position.set(tp.x, 0.055, tp.z); }
  spinners.forEach(function (bl) { bl.rotation.y += dt * 2.4; });
  if (G.alk && G.alk.phase === 'sim' && busy === 0) {                       // 알까기 물리 (60Hz 고정 간격)
    alkAcc += dt; var steps = Math.min(10, Math.floor(alkAcc * 60)); alkAcc -= steps / 60;
    for (var si = 0; si < steps; si++) {
      if (Rules.alkTick(G)) { runEvents(Rules.drain(G)); break; }
      updateAlkMeshes();
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// 테스트/디버그용 접근
window.__game = { get G() { return G; }, get S() { return S; }, Rules: Rules, onCardClick: onCardClick, onCell: onCell, onDraftClick: onDraftClick, cancelMode: cancelMode, sync: function () { syncAll(); rebuildHand(); }, runEvents: runEvents, setTopView: setTopView, view: function () { return topT; }, inspect: function () { return inspectIdx; }, played: function () { return playedMesh ? playedMesh.userData.id : null; }, cardCanvas: function (id) { return cardTexture(id).image; }, reset: reset, busy: function () { return busy; }, draftOpen: function () { return draftMeshes.length; }, meshGrid: function () { return meshes.map(function (row) { return row.map(function (m) { return !m ? 0 : m.userData.kind === 'wall' ? 3 : m.userData.color; }); }); }, markers: function () { return markerGroup.children.length; }, alkUI: function () { return alkUI; } };

resize(); frame();
buildMapSelect();
var fontReady = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('40px GameFont', '가나다 연속 착수'), document.fonts.load('21px GameFont', '공격 턴 유지')]).catch(function () {}) : Promise.resolve();
Promise.all([loadCardAssets(), applyMap(getMaps()[curMapIdx]), fontReady]).then(function () {
  texCache = {}; reset(); showAssetNotice();
});
