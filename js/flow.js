/* 게임 흐름 · 입력 — 카드/칸 클릭, 시점 전환, 마우스·키보드 */
'use strict';

/* ---------------- 게임 흐름 ---------------- */
function cancelMode() {
  if (!G.pending) return;
  Rules.cancel(G); Rules.drain(G); tradeFirst = null; clearPlayed(); syncS(); updateHUD();
}
// 카드: 1번 누르면 크게 확대, 확대된 카드를 한 번 더 누르면 발동
function onCardClick(i) {
  if (G.gameOver || busy > 0 || G.draft || G.alk) return;
  if (inspectIdx !== i) { inspectIdx = i; sfx('card'); return; }
  var mesh = cardMeshes[i], id = G.hand[G.current][i];
  var snap = { id: id, x: mesh.position.x, y: mesh.position.y, s: mesh.scale.x };
  if (G.pending && G.pending.handIndex === i) { cancelMode(); inspectIdx = -1; return; }   // 대기 중인 카드를 다시 누르면 취소
  var res = Rules.useCard(G, i), evs = Rules.drain(G);
  if (!res.ok) return;
  inspectIdx = -1; setTopView(true, true);
  if (res.pending) { showPlayed(snap); syncS(); return; }          // 대상을 고르는 카드는 왼쪽 아래에서 기다림
  burnSnap(snap); runEvents(evs);                                  // 바로 발동: 가운데서 불타며 효과 실행
}
// 판의 칸 (r=행, c=열): 직부감에서만 동작
function onCell(r, c) {
  if (G.gameOver || busy > 0 || G.draft || G.alk || topGoal < 0.5 || topT < 0.85) return;
  if (G.pending) {
    var res = Rules.target(G, r, c), evs = Rules.drain(G);
    if (!res.ok) return;
    if (!res.resolved) { runEvents(evs); return; }
    busy++; burnPlayed(function () { busy--; runEvents(evs); });   // 효과는 카드가 불붙는 순간에
    return;
  }
  var res2 = Rules.place(G, r, c), evs2 = Rules.drain(G);
  if (!res2.ok) return;
  runEvents(evs2);
}

/* ---------------- 입력 ---------------- */
var pointer = new THREE.Vector2(0, 0), raycaster = new THREE.Raycaster();
var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
var hoverCell = null, hoverTable = false, hitPoint = new THREE.Vector3(), camShake = 0;
// 시점: 0 = 앉은 시점(시네마틱), 1 = 직부감(판 전체). 테이블/버튼/V키로 전환
var topT = 0, topGoal = 0, topH = 30, topDz = 2, parX = 0, parY = 0;
var elViewBtn = document.getElementById('viewbtn');
function setTopView(on, quiet) {
  topGoal = on ? 1 : 0;
  elViewBtn.textContent = on ? '🎴 카드 보기' : '🔍 판 보기';
}
var mouseN = { x: 0, y: 0 };

function setPointer(e) {
  var r = dom.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  // 카메라 시차는 마우스일 때만 (터치하면 화면이 흔들리지 않게)
  if (e.pointerType !== 'touch') { mouseN.x = pointer.x; mouseN.y = pointer.y; }
}
function updateHover() {
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);
  var dh = draftMeshes.length ? raycaster.intersectObjects(draftMeshes, false) : [];
  hoverDraft = dh.length ? dh[0].object.userData.draftIdx : -1;
  var hits = (topGoal > 0.5 || draftMeshes.length) ? [] : raycaster.intersectObjects(cardMeshes, false);
  hoverCard = hits.length ? hits[0].object.userData.i : -1;
  handUp = topGoal < 0.5 && !draftMeshes.length && (hoverCard >= 0 || (Math.abs(pointer.x) < 0.5 && pointer.y < -0.3));
  hoverCell = null; hoverTable = false;
  var hasGround = hoverCard < 0 && hoverDraft < 0 && !draftMeshes.length && raycaster.ray.intersectPlane(groundPlane, hitPoint);
  if (hasGround) {
    var x = Math.round(hitPoint.x + HALF), y = Math.round(hitPoint.z + HALF);
    if (inb(x, y) && Math.abs(hitPoint.x + HALF - x) < 0.5 && Math.abs(hitPoint.z + HALF - y) < 0.5) hoverCell = [x, y];
    else hoverTable = true;                 // 격자 밖(판 테두리·테이블) = 시점 전환 영역
  }
  dom.style.cursor = (hoverCard >= 0 || hoverDraft >= 0 || hoverCell || hoverTable) ? 'pointer' : 'default';
  if (alkUI && alkUI.dragging && raycaster.ray.intersectPlane(groundPlane, hitPoint)) aimUpdate(hitPoint);
}
dom.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch' && !(alkUI && alkUI.dragging)) return; setPointer(e); updateHover(); });
// 알까기: 새 돌을 눌러 당겼다 놓으면 발사
dom.addEventListener('pointerdown', function (e) {
  if (!G || !G.alk || G.alk.phase !== 'aim' || topT < 0.85 || busy > 0) return;
  setPointer(e); updateHover();
  if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
  var s = G.alk.stones[G.alk.newIndex];
  if (Math.hypot(hitPoint.x - s.x, hitPoint.z - s.z) <= 0.95) { alkUI.dragging = true; aimUpdate(hitPoint); sfx('card'); }
});
window.addEventListener('pointerup', function (e) {
  if (!alkUI || !alkUI.dragging) return;
  alkUI.dragging = false; setPointer(e); updateHover();
  var s = G.alk && G.alk.stones[G.alk.newIndex];
  if (s && raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
    if (Rules.alkLaunch(G, hitPoint.x - s.x, hitPoint.z - s.z)) { alkAcc = 0; sfx('boom'); }
  }
  aimBand.visible = aimDir.visible = false;
});
dom.addEventListener('click', function (e) {
  ac(); if (actx && actx.state === 'suspended') actx.resume();
  if (G.alk) return;                                                       // 알까기 중에는 클릭 대신 당기기
  setPointer(e); updateHover();
  if (draftMeshes.length) { if (hoverDraft >= 0) onDraftClick(hoverDraft); return; }
  if (hoverCard >= 0) onCardClick(hoverCard);
  else if (inspectIdx >= 0) inspectIdx = -1;                              // 확대 중 다른 곳을 누르면 닫기
  else if (hoverCell || hoverTable) {
    if (topGoal < 0.5) setTopView(true);                                  // 뒤 시점에서 판/테이블을 누르면 직부감으로
    else if (hoverCell) onCell(hoverCell[1], hoverCell[0]);               // 직부감에서만 돌을 둠 (행, 열)
    else setTopView(false);                                               // 직부감에서 테이블을 누르면 카드 화면으로
  }
  // 터치는 '호버'가 없으므로 탭이 끝나면 호버 효과를 지움
  if (e.pointerType === 'touch') { hoverCard = -1; hoverCell = null; hoverTable = false; handUp = false; }
});
window.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { if (inspectIdx >= 0) inspectIdx = -1; else if (G.pending) cancelMode(); }
  else if (e.key === 'v' || e.key === 'V') setTopView(topGoal < 0.5);
});
elViewBtn.addEventListener('click', function () { setTopView(topGoal < 0.5); });
document.getElementById('restart').addEventListener('click', function () { reset(); });
document.getElementById('again').addEventListener('click', function () { reset(); });
