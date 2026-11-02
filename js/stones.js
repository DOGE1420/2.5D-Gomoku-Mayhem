/* 게임 상태(G) · 돌 3D 모델 */
'use strict';

/* ---------------- 상태 (규칙 상태는 엔진 G 가 가짐) ---------------- */
var G = Rules.create(), meshes = [];
for (var _r = 0; _r < N; _r++) meshes.push(new Array(N).fill(null));
var S = { turn: 1, mode: null, pendingIdx: -1, over: false };   // 화면 쪽 요약 (카드 강조 등에 사용)

function inb(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }

/* ---------------- 돌 ---------------- */
var stoneGeo = new THREE.SphereGeometry(0.43, 28, 18);
var STONE_Y = 0.43 * 0.45;
var matBlack = new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: 0.32, metalness: 0.12 });
var matWhite = new THREE.MeshStandardMaterial({ color: 0xece4d2, roughness: 0.5, metalness: 0.02 });
function makeStone(c, mat) {
  var m = new THREE.Mesh(stoneGeo, mat || (c === BLACK ? matBlack : matWhite));
  m.scale.set(1, 0.45, 1); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cellAt(r, c) { return new THREE.Vector3(c - HALF, STONE_Y, r - HALF); }   // 행 r, 열 c

var ghost = makeStone(BLACK, new THREE.MeshStandardMaterial({ color: 0x17130f, transparent: true, opacity: 0.45 }));
ghost.castShadow = false; ghost.visible = false; scene.add(ghost);
var ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.52, 36),
  new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false; scene.add(ring);
var ring2 = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.52, 36), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.035; ring2.visible = false; scene.add(ring2);
var PEND_COLOR = { remove: 0xff5a3a, trade: 0xffd27a, wall: 0xffd27a, trap: 0xb070ff, windmill: 0x7ad0ff, shield: 0x7ad0ff, teleport: 0x7ad0ff };
