/* 맵 — 배경 · 판 · 조명 교체 (js/config.js 의 maps) · 맵 선택 메뉴 */
'use strict';

/* ---------------- 맵 (배경 · 판 · 조명 교체) — js/config.js 의 maps ---------------- */
var defTableTex = table.material.map, defBoardTex = boardPlane.material.map;
var defCam = { pos: CAM_BASE.clone(), look: CAM_LOOK.clone() };
var backdrop = null, curMapIdx = 0, fogBase = { near: 21, far: 54 };
var elNotice = document.getElementById('notice');

function texFromImg(img, repeat) {
  var t = new THREE.Texture(img);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.needsUpdate = true;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
function getMaps() { return (CFG.maps && CFG.maps.length) ? CFG.maps : [{ id: 'candle', name: '촛불 방' }]; }
function mapPaths(m) {
  var st = m.stones || {};
  return [m.board, m.table, m.backdrop, st.black, st.white].filter(Boolean);
}
function skinStone(mat, path, defColor) {
  var img = path && IMG[path];
  mat.map = img ? texFromImg(img) : null;
  mat.color.setHex(img ? 0xffffff : defColor);
  mat.needsUpdate = true;
}
function applyMap(m) {
  m = m || {};
  return Promise.all(mapPaths(m).map(loadImg)).then(function () {
    var L = m.light || {}, C = m.candle || {}, st = m.stones || {};
    // 판 · 테이블 · 배경 이미지
    var bi = m.board && IMG[m.board];
    boardPlane.material.map = bi ? boardTexture(bi, !!m.boardGrid) : defBoardTex;
    boardPlane.material.needsUpdate = true;
    var ti = m.table && IMG[m.table];
    table.material.map = ti ? texFromImg(ti, m.tableRepeat || 6) : defTableTex;
    table.material.needsUpdate = true;
    table.visible = !m.hideTable;
    var di = m.backdrop && IMG[m.backdrop];
    if (di) {
      if (!backdrop) {
        var geo = new THREE.SphereGeometry(70, 48, 32); geo.scale(-1, 1, 1);
        backdrop = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ fog: false }));
        scene.add(backdrop);
      }
      backdrop.material.map = texFromImg(di); backdrop.material.needsUpdate = true; backdrop.visible = true;
    } else if (backdrop) backdrop.visible = false;
    // 배경색 · 안개
    var bg = m.background || '#000000';
    scene.background.set(bg);
    if (m.fog === null) scene.fog = null;
    else { var F = m.fog || {}; fogBase.near = F.near != null ? F.near : 21; fogBase.far = F.far != null ? F.far : 54; scene.fog = new THREE.Fog(F.color || bg, fogBase.near, fogBase.far); }
    // 조명 · 촛불
    hemi.color.set(L.hemiSky || '#3a2a1a'); hemi.groundColor.set(L.hemiGround || '#050403'); hemi.intensity = L.hemi != null ? L.hemi : 0.05;
    spot.color.set(L.spotColor || '#ff9a40'); spot.intensity = L.spot != null ? L.spot : 1.5; spot.angle = L.spotAngle || 0.62;
    var candleOn = C.visible !== false;
    candles.forEach(function (c) { c.body.visible = c.flame.visible = c.light.visible = candleOn; c.light.color.set(C.color || '#ffa550'); });
    candleBase = C.intensity != null ? C.intensity : 1.2;
    stars.visible = m.stars !== false && !di;
    // 카메라
    var cam = m.camera || {};
    CAM_BASE.fromArray(cam.pos || defCam.pos.toArray()); CAM_LOOK.fromArray(cam.look || defCam.look.toArray());
    // 돌 표면
    skinStone(matBlack, st.black, 0x17130f); skinStone(matWhite, st.white, 0xece4d2);
  });
}
function buildMapSelect() {
  var sel = document.getElementById('mapSel'), ms = getMaps();
  try { var sv = parseInt(localStorage.getItem('gomoku3d.map'), 10); if (sv >= 0 && sv < ms.length) curMapIdx = sv; } catch (e) {}
  if (ms.length < 2) { sel.style.display = 'none'; return; }
  ms.forEach(function (m, i) { var o = document.createElement('option'); o.value = i; o.textContent = '🗺 ' + (m.name || m.id || ('맵 ' + (i + 1))); sel.appendChild(o); });
  sel.value = curMapIdx; sel.style.display = 'block';
  sel.addEventListener('change', function () {
    curMapIdx = parseInt(sel.value, 10);
    try { localStorage.setItem('gomoku3d.map', curMapIdx); } catch (e) {}
    applyMap(ms[curMapIdx]).then(showAssetNotice);
  });
}
function showAssetNotice() {
  var t = '';
  if (blockedPaths.length) t = '이미지 에셋은 웹/로컬 서버에서만 로드돼요 (run.bat · run.sh 로 열기). 지금은 기본 그림으로 표시 중입니다.';
  else if (failedPaths.length) t = '불러오지 못한 이미지: ' + failedPaths.join(', ');
  elNotice.textContent = t; elNotice.style.display = t ? 'block' : 'none';
}
function loadCardAssets() {
  var list = [CFG.cardPaper].concat(CARD_IDS.map(cardArtPath)).filter(Boolean);
  return Promise.all(list.map(loadImg));
}
