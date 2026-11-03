/* 오두막 방 — 판 주변을 둘러싼 어두운 방 (벽 · 바닥 · 테이블 · 의자 · 쇠사슬 문 · 괘종시계 · 책장 · 금고 · 서랍장 · 규칙서 · 세계 지도)
 * 도구 없이 기본 도형과 캔버스 그림으로 만든 장면. js/config.js 의 맵에 room: true 를 주면 그 맵에서 나타남 (기본: 평원).
 * 좌표: 테이블 윗면 y = -0.6, 바닥 y = -18, 뒤쪽 벽 z = -32, 좌우 벽 x = ±26. 카메라는 +z 쪽에서 바라봄.
 */
'use strict';

var roomGroup = new THREE.Group(); roomGroup.visible = false; scene.add(roomGroup);
var roomLight = new THREE.PointLight(0xff9a50, 0, 80, 1.2); roomLight.position.set(0, 14, -16); scene.add(roomLight);
var roomPendulum = null, roomT = 0;
(function buildRoom() {
  var FLOOR = -18, TOP = -0.6, BACK = -32, SIDE = 26;
  function canvas(w, h, fn) { var c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
  function std(color, rough, map) { return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.9 : rough, map: map || null }); }
  function add(mesh, x, y, z) { mesh.position.set(x, y, z); roomGroup.add(mesh); return mesh; }
  function box(w, h, d, mat, x, y, z) { return add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  var wood = std(0x3a2616, 0.95), woodDark = std(0x241608, 0.95), woodLight = std(0x5a3d22, 0.9), iron = std(0x1a1a1c, 0.5), brass = std(0x7a6030, 0.45), black = std(0x020202, 0.9);

  // 판자 무늬 (세로/가로)
  function planks(vertical, base, w, h) {
    return canvas(512, 512, function (g, W, H) {
      g.fillStyle = base; g.fillRect(0, 0, W, H);
      var n = 9, step = (vertical ? W : H) / n;
      for (var i = 0; i < n; i++) {
        g.fillStyle = 'rgba(' + (i % 2 ? '255,200,140' : '0,0,0') + ',' + (0.03 + Math.random() * 0.05) + ')';
        if (vertical) g.fillRect(i * step, 0, step, H); else g.fillRect(0, i * step, W, step);
        g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = 3; g.beginPath();
        if (vertical) { g.moveTo(i * step, 0); g.lineTo(i * step, H); } else { g.moveTo(0, i * step); g.lineTo(W, i * step); }
        g.stroke();
        for (var k = 0; k < 14; k++) {                       // 나뭇결
          g.strokeStyle = 'rgba(0,0,0,' + rnd(0.05, 0.2) + ')'; g.lineWidth = rnd(0.6, 2); g.beginPath();
          var o = i * step + rnd(2, step - 2), s = rnd(0, 480);
          if (vertical) { g.moveTo(o, s); g.lineTo(o + rnd(-3, 3), s + rnd(20, 90)); } else { g.moveTo(s, o); g.lineTo(s + rnd(20, 90), o + rnd(-3, 3)); }
          g.stroke();
        }
      }
    });
  }
  function repeat(tex, x, y) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(x, y); return tex; }

  /* ---- 바닥 · 벽 ---- */
  var floor = add(new THREE.Mesh(new THREE.PlaneGeometry(80, 80), std(0xffffff, 0.95, repeat(planks(false, '#2c1c0f'), 4, 4))), 0, FLOOR, -4); floor.rotation.x = -Math.PI / 2;
  var back = add(new THREE.Mesh(new THREE.PlaneGeometry(SIDE * 2, 44), std(0xffffff, 0.95, repeat(planks(false, '#33200f'), 3, 3))), 0, FLOOR + 22, BACK);
  var wl = add(new THREE.Mesh(new THREE.PlaneGeometry(80, 44), std(0xffffff, 0.95, repeat(planks(false, '#2e1c0d'), 4, 3))), -SIDE, FLOOR + 22, -4); wl.rotation.y = Math.PI / 2;
  var wr = add(new THREE.Mesh(new THREE.PlaneGeometry(80, 44), std(0xffffff, 0.95, repeat(planks(false, '#2e1c0d'), 4, 3))), SIDE, FLOOR + 22, -4); wr.rotation.y = -Math.PI / 2;
  [-SIDE + 0.6, SIDE - 0.6].forEach(function (x) { box(1.6, 44, 1.6, woodDark, x, FLOOR + 22, BACK + 0.8); });      // 모서리 기둥
  box(SIDE * 2, 1.4, 1.6, woodDark, 0, FLOOR + 0.7, BACK + 0.8);                                                     // 걸레받이
  box(1.6, 44, 1.6, woodDark, -11, FLOOR + 22, BACK + 0.8);                                                           // 가운데 기둥
  // 판자로 막은 벽 (비스듬한 널빤지)
  [[-15.5, 4, 0.5], [-15.5, -1, -0.45], [-15.5, 9, -0.3]].forEach(function (p) { var b = box(13, 1.5, 0.5, woodLight, p[0], p[1], BACK + 0.4); b.rotation.z = p[2]; });

  /* ---- 테이블 · 의자 ---- */
  box(40, 1.4, 28, std(0xffffff, 0.9, repeat(planks(false, '#4a301c'), 1, 1)), 0, TOP - 0.7, 0);
  [[-18, -12], [18, -12], [-18, 12], [18, 12]].forEach(function (p) { box(2, TOP - 1.4 - FLOOR, 2, woodDark, p[0], (TOP - 1.4 + FLOOR) / 2, p[1]); });
  box(34, 0.8, 1, woodDark, 0, FLOOR + 5, 12); box(34, 0.8, 1, woodDark, 0, FLOOR + 5, -12);
  // 맞은편 안락의자 (까만 윤곽)
  var cz = -24, cx = 4, seat = FLOOR + 8.5;
  box(7, 1.4, 7, black, cx, seat, cz);
  box(7, 11, 1.4, black, cx, seat + 6.2, cz - 3.5);
  box(1.5, 4, 6.4, black, cx - 3.6, seat + 2.6, cz); box(1.5, 4, 6.4, black, cx + 3.6, seat + 2.6, cz);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { box(1, 7.8, 1, black, cx + p[0] * 3.1, FLOOR + 3.9, cz + p[1] * 3.1); });
  var wingL = box(1.8, 6, 2.4, black, cx - 3.6, seat + 9, cz - 3), wingR = box(1.8, 6, 2.4, black, cx + 3.6, seat + 9, cz - 3); wingL.rotation.y = 0.35; wingR.rotation.y = -0.35;

  // 테이블 위: 종 · 카드 몇 장 · 열쇠
  var bell = add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, 6.283, 0, 1.5), brass), -13, TOP + 0.9, 8); bell.scale.set(1, 1.2, 1);
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.2, 16), brass), -13, TOP + 0.1, 8);
  var cardBack = canvas(64, 96, function (g, W, H) { g.fillStyle = '#9b8458'; g.fillRect(0, 0, W, H); g.strokeStyle = '#4a3a1c'; g.lineWidth = 3; g.strokeRect(5, 5, W - 10, H - 10); g.beginPath(); g.arc(W / 2, H / 2, 14, 0, 7); g.stroke(); });
  for (var i = 0; i < 5; i++) { var c = add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), std(0xffffff, 0.9, cardBack)), 12 + rnd(-2, 3), TOP + 0.02 + i * 0.01, 9 + rnd(-1, 1.5)); c.rotation.x = -Math.PI / 2; c.rotation.z = rnd(-0.6, 0.6); }

  /* ---- 뒤쪽 벽: 세계 지도 · 메모 · 괘종시계 · 쇠사슬 문 ---- */
  var mapTex = canvas(512, 330, function (g, W, H) {
    g.fillStyle = '#b79a68'; g.fillRect(0, 0, W, H);
    for (var k = 0; k < 90; k++) { g.fillStyle = 'rgba(80,50,20,' + rnd(0.02, 0.07) + ')'; g.beginPath(); g.arc(rnd(0, W), rnd(0, H), rnd(10, 50), 0, 7); g.fill(); }
    g.fillStyle = '#5a4a2c';
    [[120, 120, 70, 50], [150, 220, 30, 60], [290, 110, 50, 45], [310, 190, 45, 60], [400, 120, 80, 50], [440, 230, 30, 20]].forEach(function (b) { g.beginPath(); g.ellipse(b[0], b[1], b[2], b[3], rnd(-0.4, 0.4), 0, 7); g.fill(); });
    g.strokeStyle = 'rgba(40,24,8,.8)'; g.lineWidth = 4; g.strokeRect(6, 6, W - 12, H - 12);
    g.beginPath(); g.arc(64, 262, 26, 0, 7); g.moveTo(64, 232); g.lineTo(64, 292); g.moveTo(34, 262); g.lineTo(94, 262); g.stroke();
  });
  var mapMesh = add(new THREE.Mesh(new THREE.PlaneGeometry(15, 9.7), std(0xffffff, 0.9, mapTex)), -19, FLOOR + 25, BACK + 0.05);
  [[-24, 20, -0.08], [-23.5, 15, 0.1], [-13.5, 21, 0.06]].forEach(function (p) { var n = add(new THREE.Mesh(new THREE.PlaneGeometry(3, 3.8), std(0xc8b88a, 0.9)), p[0], p[1], BACK + 0.06); n.rotation.z = p[2]; });
  // 괘종시계
  box(4.4, 10, 1.8, woodDark, -5, FLOOR + 22, BACK + 0.9);
  var face = canvas(128, 128, function (g, W) {
    g.fillStyle = '#d8c9a0'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#2a1a0a'; g.lineWidth = 6; g.stroke();
    for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; g.beginPath(); g.moveTo(64 + Math.sin(a) * 48, 64 - Math.cos(a) * 48); g.lineTo(64 + Math.sin(a) * 56, 64 - Math.cos(a) * 56); g.lineWidth = 4; g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 28); g.moveTo(64, 64); g.lineTo(88, 74); g.stroke();
  });
  add(new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), std(0xffffff, 0.8, face)), -5, FLOOR + 25, BACK + 1.82);
  box(2.6, 4.4, 0.2, black, -5, FLOOR + 20.2, BACK + 1.82);
  roomPendulum = new THREE.Group(); roomPendulum.position.set(-5, FLOOR + 21.8, BACK + 1.9); roomGroup.add(roomPendulum);
  var rod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3, 0.1), brass); rod.position.y = -1.5; roomPendulum.add(rod);
  var bob = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16), brass); bob.rotation.x = Math.PI / 2; bob.position.y = -3.1; roomPendulum.add(bob);
  // 쇠사슬로 잠긴 문
  var doorTex = canvas(256, 512, function (g, W, H) {
    g.fillStyle = '#2a190b'; g.fillRect(0, 0, W, H);
    for (var i = 0; i < 6; i++) { g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(i * 43, 0); g.lineTo(i * 43, H); g.stroke(); }
    g.fillStyle = '#0e0a06'; for (var y = 40; y < H; y += 110) for (var x = 22; x < W; x += 43) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 0, W, 14);
  });
  box(11.6, 20.6, 1, woodDark, 14, FLOOR + 10.3, BACK + 0.5);
  add(new THREE.Mesh(new THREE.PlaneGeometry(9.6, 19), std(0xffffff, 0.9, doorTex)), 14, FLOOR + 9.9, BACK + 1.02);
  box(9.6, 0.7, 0.3, iron, 14, FLOOR + 14, BACK + 1.2); box(9.6, 0.7, 0.3, iron, 14, FLOOR + 5, BACK + 1.2);
  [[34, 1], [-34, -1]].forEach(function (a) {                                            // X 자로 감긴 쇠사슬
    var ch = box(15, 0.55, 0.45, iron, 14, FLOOR + 9.5, BACK + 1.5); ch.rotation.z = a[0] * Math.PI / 180;
    for (var k = -6; k <= 6; k++) { var l = add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 6, 10), iron), 14 + Math.cos(a[0] * Math.PI / 180) * k * 1.1, FLOOR + 9.5 + Math.sin(a[0] * Math.PI / 180) * k * 1.1, BACK + 1.75); l.rotation.z = a[0] * Math.PI / 180; l.rotation.x = k % 2 ? 1.4 : 0; }
  });
  box(1.9, 2.3, 1, brass, 14, FLOOR + 9.5, BACK + 2.2);                                    // 자물쇠
  var shackle = add(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.15, 8, 14, Math.PI), iron), 14, FLOOR + 10.6, BACK + 2.2);

  /* ---- 오른쪽 벽: 선반(늑대 · 새장 · 책 · 병) · 서랍장 · 금고 ---- */
  var RZ = BACK + 6;
  box(1, 0.6, 12, woodLight, SIDE - 0.7, FLOOR + 22, RZ + 2); box(1, 0.6, 12, woodLight, SIDE - 0.7, FLOOR + 17, RZ + 2);
  for (var b = 0; b < 8; b++) { var h = rnd(2.2, 3.6), bk = box(0.9, h, 0.55, std([0x5a2a1a, 0x2a3a4a, 0x4a3a1a, 0x3a1a2a][b % 4], 0.8), SIDE - 1.1, FLOOR + 17.3 + h / 2, RZ + 2 + b * 0.62 - 1); bk.rotation.x = b === 7 ? 0.3 : 0; }
  for (var q = 0; q < 3; q++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.8, 10), std(0x2a4a3a, 0.4)), SIDE - 1.2, FLOOR + 22.9, RZ + 5 + q * 1.1);
  var wolfM = std(0x6a5a48, 0.8);                                                         // 늑대 조각상
  box(2.8, 1.3, 1.1, wolfM, SIDE - 1.2, FLOOR + 23.4, RZ - 1.5); box(1, 1, 0.9, wolfM, SIDE - 1.2, FLOOR + 24.1, RZ - 0.4); [[-1, -.4], [1, -.4], [-1, .4], [1, .4]].forEach(function (p) { box(0.3, 0.8, 0.3, wolfM, SIDE - 1.2 + p[1], FLOOR + 22.8, RZ - 1.5 + p[0]); });
  var cage = add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 2.6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x8a7a50, wireframe: true })), SIDE - 1.5, FLOOR + 18.6, RZ + 6.5);
  box(11, 9, 6, woodDark, SIDE - 3.4, FLOOR + 4.5, RZ - 1);                                // 서랍장
  for (var d = 0; d < 3; d++) { box(0.3, 2.4, 5, woodLight, SIDE - 6.9, FLOOR + 2 + d * 2.8, RZ - 1); add(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.1, 6, 10), brass), SIDE - 7.2, FLOOR + 2 + d * 2.8, RZ - 1); }
  box(8.5, 8.5, 8, iron, SIDE - 4.6, FLOOR + 4.25, RZ + 8);                                // 금고
  var dial = add(new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.2, 8, 20), brass), SIDE - 8.9, FLOOR + 5, RZ + 8); dial.rotation.y = Math.PI / 2;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.4, 12), brass), SIDE - 8.9, FLOOR + 5, RZ + 8).rotation.z = Math.PI / 2;

  /* ---- 왼쪽 벽: 규칙서가 놓인 독서대 ---- */
  var LZ = -22;
  box(3.4, 8, 3.4, woodDark, -SIDE + 4, FLOOR + 4, LZ); box(5, 0.8, 5, woodLight, -SIDE + 4, FLOOR + 8.4, LZ);
  var bookTex = canvas(128, 96, function (g, W, H) { g.fillStyle = '#4a2a14'; g.fillRect(0, 0, W, H); g.strokeStyle = '#c8a860'; g.lineWidth = 3; g.strokeRect(8, 8, W - 16, H - 16); g.beginPath(); g.arc(W / 2, H / 2, 16, 0, 7); g.stroke(); });
  var rb = add(new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.7, 3.6), [std(0xd8c8a0), std(0xd8c8a0), std(0xffffff, 0.8, bookTex), std(0xd8c8a0), std(0xd8c8a0), std(0xd8c8a0)]), -SIDE + 4, FLOOR + 9.4, LZ); rb.rotation.z = -0.35;
  box(0.7, 2, 0.7, std(0xcfc3a0, 0.8), -SIDE + 2.8, FLOOR + 10.2, LZ + 2.6);               // 독서대 위 촛불
  add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd08a })), -SIDE + 2.8, FLOOR + 11.4, LZ + 2.6);
})();
function setRoom(on) {
  roomGroup.visible = !!on; roomLight.intensity = on ? 0.55 : 0;
  slab.visible = true;
}
function stepRoom(dt) { if (roomPendulum && roomGroup.visible) { roomT += dt; roomPendulum.rotation.z = Math.sin(roomT * 2.4) * 0.28; } }
