/* 3D 장면 — 렌더러 · 카메라 · 텍스처 · 테이블 · 판 · 촛불 · 별 · 조명 */
'use strict';

/* ---------------- 렌더러 · 씬 ---------------- */
var container = document.getElementById('game');
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);
var dom = renderer.domElement;

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 21, 54);

var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
scene.add(camera);
var CAM_BASE = new THREE.Vector3(0, 8.6, 21.5);
var CAM_LOOK = new THREE.Vector3(0, 0.7, -0.4);
var camDist = 1;

/* ---------------- 텍스처 ---------------- */
function woodCanvas(w, h, base, streak) {
  var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  var g = cv.getContext('2d');
  g.fillStyle = 'rgb(' + base.join(',') + ')'; g.fillRect(0, 0, w, h);
  for (var i = 0; i < 260; i++) {
    var y = Math.random() * h, a = Math.random() * 0.12 + 0.02;
    g.strokeStyle = 'rgba(' + streak + ',' + a + ')';
    g.lineWidth = Math.random() * 3 + 0.5;
    g.beginPath(); g.moveTo(0, y);
    g.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 14, w * 0.7, y + (Math.random() - 0.5) * 14, w, y + (Math.random() - 0.5) * 8);
    g.stroke();
  }
  return cv;
}
function toTex(cv, repeat) {
  var t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}

// img 가 있으면 그 이미지를 판 바탕으로, grid 가 true 면 그 위에 격자를 그림. img 가 없으면 나무판 + 격자.
function boardTexture(img, grid) {
  var S = 1024, U = S / 16, cv, g;
  if (img) {
    cv = document.createElement('canvas'); cv.width = cv.height = S;
    g = cv.getContext('2d'); g.drawImage(img, 0, 0, S, S);
    if (!grid) return toTex(cv);
  } else {
    cv = woodCanvas(S, S, [176, 128, 72], '60,36,14'); g = cv.getContext('2d');
  }
  g.strokeStyle = 'rgba(28,16,6,0.9)'; g.lineWidth = 2.2;
  for (var i = 0; i < N; i++) {
    var p = (i + 1) * U;
    g.beginPath(); g.moveTo(U, p); g.lineTo(15 * U, p); g.stroke();
    g.beginPath(); g.moveTo(p, U); g.lineTo(p, 15 * U); g.stroke();
  }
  g.lineWidth = 4; g.strokeRect(U, U, 14 * U, 14 * U);
  g.fillStyle = 'rgba(28,16,6,0.95)';
  [3, 7, 11].forEach(function (a) { [3, 7, 11].forEach(function (b) {
    g.beginPath(); g.arc((a + 1) * U, (b + 1) * U, 5, 0, 7); g.fill();
  }); });
  return toTex(cv);
}

/* ---------------- 테이블 · 판 · 촛불 ---------------- */
var tableTex = toTex(woodCanvas(512, 512, [58, 38, 24], '20,10,4'), 6);
var table = new THREE.Mesh(new THREE.PlaneGeometry(90, 90),
  new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.95 }));
table.rotation.x = -Math.PI / 2; table.position.y = -0.6; table.receiveShadow = true;
scene.add(table);

var slabTex = toTex(woodCanvas(256, 256, [120, 84, 46], '40,22,8'));
var slab = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.6, 16.5),
  new THREE.MeshStandardMaterial({ map: slabTex, roughness: 0.9 }));
slab.position.y = -0.3; slab.receiveShadow = true; slab.castShadow = true;
scene.add(slab);

var boardPlane = new THREE.Mesh(new THREE.PlaneGeometry(16, 16),
  new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.75 }));
boardPlane.rotation.x = -Math.PI / 2; boardPlane.position.y = 0.002; boardPlane.receiveShadow = true;
scene.add(boardPlane);

// 촛불: 오른쪽 뒤쪽에 두 개 (인스크립션 풍). 첫 번째만 그림자를 만듦
var candles = [], candleBase = 1.2;
function makeCandle(x, z, h, shadow) {
  var body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, h, 20),
    new THREE.MeshStandardMaterial({ color: 0xcfc3a0, roughness: 0.8 }));
  body.position.set(x, -0.6 + h / 2, z); body.castShadow = true; scene.add(body);
  var fy = -0.6 + h + 0.24;
  var flame = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffd08a }));
  flame.scale.set(1, 1.8, 1); flame.position.set(x, fy, z); scene.add(flame);
  var light = new THREE.PointLight(0xffa550, candleBase, 42, 1.5);
  light.position.set(x, fy + 0.4, z);
  if (shadow) { light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -0.002; }
  scene.add(light);
  candles.push({ body: body, flame: flame, light: light, x: x, phase: Math.random() * 6, k: shadow ? 1 : 0.8 });
}
makeCandle(9.6, -2.4, 2.4, true);
makeCandle(11.2, -4.4, 3.5, false);

// 어두운 하늘의 별
var stars = (function () {
  var n = 260, pos = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) {
    var a = Math.random() * Math.PI * 2, e = Math.random() * 0.95, r = 75;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = 3 + Math.sin(e) * r * 0.6; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.55, fog: false, depthWrite: false }));
  scene.add(pts); return pts;
})();

// 조명: 거의 어둠 속에서 테이블 한 곳만 주황빛으로 밝게
var hemi = new THREE.HemisphereLight(0x3a2a1a, 0x050403, 0.05);
scene.add(hemi);
var spot = new THREE.SpotLight(0xff9a40, 1.5, 70, 0.62, 1, 1.1);
spot.position.set(1, 14, 9); spot.target.position.set(0, 0, 0.5);
spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0015;
scene.add(spot); scene.add(spot.target);
