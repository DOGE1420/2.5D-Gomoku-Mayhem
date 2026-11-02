/* 증강 오목 3D 프로토타입 — 인스크립션 풍 (촛불 · 어두운 방 · 손패 카드)
 * 규칙은 js/rules.js 의 엔진(원본 규칙 + 일반 카드 21장)이 처리하고, 이 파일은 3D 화면·입력·연출만 담당.
 * 로컬 2인 대전(핫시트).
 */
(function () {
  'use strict';

  var N = 15, HALF = 7;
  var EMPTY = 0, BLACK = 1, WHITE = 2, WALL = 3;
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  var TEXT_FONT = '"GameFont","Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';   // GameFont = assets/fonts/HeoSangGothicB.ttf (index.html 의 @font-face)

  /* ---------------- 카드 데이터: 엔진(js/rules.js)에서 가져옴 ---------------- */
  var Rules = window.Rules;
  var CARDS = {};
  Rules.CARDS.forEach(function (c) { CARDS[c.id] = { name: c.name, cat: c.cat, desc: c.desc, endsTurn: !!c.ends }; });
  var CARD_IDS = Rules.CARDS.map(function (c) { return c.id; });

  /* ---------------- 설정(js/config.js) · 이미지 로더 ---------------- */
  var CFG = window.GAME_CONFIG || {};
  // file:// 로 열면 브라우저가 이미지를 WebGL 에 못 올리게 막으므로 이미지는 건너뛰고 기본 그림을 씁니다.
  var CAN_IMG = location.protocol !== 'file:' || /[?&]img=1/.test(location.search);
  var IMG = {}, blockedPaths = [], failedPaths = [];
  function loadImg(path) {
    return new Promise(function (resolve) {
      if (!path) return resolve(null);
      if (!CAN_IMG) { if (blockedPaths.indexOf(path) < 0) blockedPaths.push(path); return resolve(null); }
      if (IMG[path] !== undefined) return resolve(IMG[path]);
      var im = new Image();
      im.onload = function () { IMG[path] = im; resolve(im); };
      im.onerror = function () { IMG[path] = null; failedPaths.push(path); console.warn('이미지를 불러오지 못했습니다:', path); resolve(null); };
      im.src = path;
    });
  }
  function cardArtPath(id) { return CFG.cards && CFG.cards[id]; }

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

  /* ---------------- 애니메이션 · 파티클 ---------------- */
  var anims = [], busy = 0, particles = [];
  function tween(dur, fn, done) {
    busy++; anims.push({ t: 0, dur: dur, fn: fn, done: done });
  }
  function stepAnims(dt) {
    for (var i = anims.length - 1; i >= 0; i--) {
      var a = anims[i]; a.t += dt;
      var p = Math.min(1, a.t / a.dur);
      a.fn(p);
      if (p >= 1) { anims.splice(i, 1); busy--; if (a.done) a.done(); }
    }
  }
  var partGeo = new THREE.SphereGeometry(0.07, 8, 8);
  function burst(pos, color, n) {
    for (var i = 0; i < n; i++) {
      var m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: color, transparent: true }));
      m.position.copy(pos);
      var v = new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 5 + 1, (Math.random() - 0.5) * 5);
      scene.add(m); particles.push({ m: m, v: v, life: 0.9 + Math.random() * 0.4, age: 0 });
    }
  }
  function stepParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i]; p.age += dt;
      p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt);
      p.m.material.opacity = Math.max(0, 1 - p.age / p.life);
      if (p.age >= p.life) { scene.remove(p.m); p.m.material.dispose(); particles.splice(i, 1); }
    }
  }

  /* ---------------- 소리 (WebAudio, 외부 파일 없음) ---------------- */
  var actx = null;
  function ac() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    return actx;
  }
  function tone(f0, f1, dur, type, vol) {
    var a = ac(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), a.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  function noise(dur, vol, cutoff) {
    var a = ac(); if (!a) return;
    var len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = a.createBufferSource(); s.buffer = buf;
    var f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 1200;
    var g = a.createGain(); g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  function sfx(k) {
    if (k === 'place') { tone(190, 70, 0.14, 'sine', 0.35); noise(0.05, 0.12, 2500); }
    else if (k === 'card') { noise(0.09, 0.15, 3500); tone(420, 300, 0.08, 'triangle', 0.08); }
    else if (k === 'boom') { noise(0.5, 0.45, 700); tone(110, 35, 0.45, 'sine', 0.4); }
    else if (k === 'burn') { noise(1.0, 0.28, 1600); tone(260, 50, 0.7, 'sawtooth', 0.04); }
    else if (k === 'magic') { tone(500, 1200, 0.35, 'sine', 0.12); }
    else if (k === 'win') { tone(392, 392, 0.2, 'triangle', 0.18); setTimeout(function () { tone(523, 523, 0.2, 'triangle', 0.18); }, 160); setTimeout(function () { tone(659, 659, 0.5, 'triangle', 0.2); }, 320); }
  }

  /* ---------------- 카드 3D ---------------- */
  var handGroup = new THREE.Group();
  handGroup.position.set(0, 0, -6.5);
  camera.add(handGroup);
  var cardGeo = new THREE.PlaneGeometry(1.5, 2.25);
  var texCache = {};
  var cardMeshes = [];
  var hoverCard = -1, inspectIdx = -1, handUp = false;   // handUp: 패 쪽을 보면 패 전체가 위로 올라옴       // inspectIdx: 크게 확대해서 보는 중인 카드
  // 확대 보기 때 나머지 화면을 어둡게 (일반 카드보다 앞, 확대 카드보다 뒤)
  var dimMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  dimMesh.position.z = 0.5; dimMesh.visible = false; handGroup.add(dimMesh);

  function wrapText(g, text, maxW) {
    var out = [];
    text.split('\n').forEach(function (line) {
      var cur = '';
      for (var i = 0; i < line.length; i++) {
        var t = cur + line[i];
        if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = line[i]; } else cur = t;
      }
      out.push(cur);
    });
    return out;
  }
  /* ---------- 카드 아트: 손그림 잉크 + 낡은 양피지 (인스크립션 풍) ---------- */
  var INK = '#1b1209';
  function rnd(a, b) { return a + Math.random() * (b - a); }
  // 선분을 잘게 나눠 손으로 그은 듯 흔들리게
  function roughen(pts, step, jit, closed) {
    var out = [], n = pts.length, last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(len / step));
      for (var j = 0; j < k; j++) {
        var t = j / k;
        out.push([a[0] + (b[0] - a[0]) * t + rnd(-jit, jit), a[1] + (b[1] - a[1]) * t + rnd(-jit, jit)]);
      }
    }
    if (!closed) out.push([pts[n - 1][0], pts[n - 1][1]]);
    return out;
  }
  function inkPath(g, pts, w, o) {
    o = o || {};
    var p = roughen(pts, 9, o.jit == null ? 1.3 : o.jit, o.closed);
    for (var pass = 0; pass < 2; pass++) {           // 두 번 덧그어 잉크 번짐 느낌
      g.lineWidth = pass ? w * 0.55 : w; g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = INK; g.globalAlpha = pass ? 0.55 : 0.92;
      g.beginPath();
      p.forEach(function (q, i) { var x = q[0] + (pass ? rnd(-0.9, 0.9) : 0), y = q[1] + (pass ? rnd(-0.9, 0.9) : 0); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      if (o.closed) g.closePath();
      if (o.fill && !pass) { g.fillStyle = INK; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 0.92; }
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  function circlePts(cx, cy, r, n, squish) {
    var p = []; for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * r * (squish || 1) + rnd(-1, 1), cy + Math.sin(a) * r + rnd(-1, 1)]); }
    return p;
  }
  function sparkle(g, x, y, r) {
    inkPath(g, [[x, y - r], [x + r * 0.22, y - r * 0.22], [x + r, y], [x + r * 0.22, y + r * 0.22], [x, y + r], [x - r * 0.22, y + r * 0.22], [x - r, y], [x - r * 0.22, y - r * 0.22]], 2.2, { closed: true, fill: true, jit: 0.5 });
  }
  function runeGlyph(g, cx, cy, s) {
    var n = 3 + Math.floor(Math.random() * 3), pts = [];
    inkPath(g, [[cx, cy - s], [cx, cy + s]], 3.2, { jit: 0.8 });
    for (var i = 0; i < n; i++) {
      var y = cy + rnd(-s, s * 0.6), d = Math.random() < 0.5 ? -1 : 1;
      inkPath(g, [[cx, y], [cx + d * rnd(s * 0.4, s * 0.9), y + rnd(-s * 0.5, s * 0.5)]], 3, { jit: 0.8 });
    }
  }
  var ART = {
    chain: function (g, cx, cy) {           // 번개 3줄
      function bolt(ox, oy, k) {
        inkPath(g, [[ox + 18 * k, oy - 90 * k], [ox - 28 * k, oy + 8 * k], [ox + 4 * k, oy + 8 * k], [ox - 22 * k, oy + 92 * k], [ox + 38 * k, oy - 18 * k], [ox + 6 * k, oy - 18 * k], [ox + 34 * k, oy - 90 * k]], 3.2, { closed: true, fill: true });
      }
      bolt(cx, cy, 1); bolt(cx - 78, cy + 22, 0.55); bolt(cx + 80, cy + 22, 0.55);
      [[-100, -58], [100, -58], [-62, 78], [62, 78]].forEach(function (d) { inkPath(g, [[cx + d[0], cy + d[1]], [cx + d[0] * 0.8, cy + d[1] * 0.8 + 14]], 2.4); });
    },
    bomb: function (g, cx, cy) {            // 폭발 + 폭탄
      var burst = [], n = 16;
      for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2, r = i % 2 ? 66 : 108; burst.push([cx + Math.cos(a) * r, cy + 8 + Math.sin(a) * r]); }
      inkPath(g, burst, 2.6, { closed: true, jit: 1.6 });
      inkPath(g, circlePts(cx, cy + 14, 50, 22), 3.4, { closed: true, fill: true });
      inkPath(g, [[cx + 22, cy - 28], [cx + 40, cy - 52], [cx + 62, cy - 52]], 3.6);
      sparkle(g, cx + 70, cy - 56, 15);
      g.save(); g.fillStyle = '#d9c79a'; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(cx - 18, cy + 2, 14, 8, -0.7, 0, 7); g.fill(); g.restore();
    },
    teleport: function (g, cx, cy) {        // 소용돌이 포탈 + 돌 두 개
      for (var r = 70, k = 0; k < 4; r -= 17, k++) inkPath(g, circlePts(cx, cy, r, 26, 1.2), 3.2 - k * 0.5, { closed: true, jit: 1.5 });
      inkPath(g, circlePts(cx, cy, 8, 10), 3, { closed: true, fill: true });
      inkPath(g, circlePts(cx - 98, cy + 60, 17, 14, 1.2), 3, { closed: true, fill: true });
      inkPath(g, circlePts(cx + 98, cy - 60, 17, 14, 1.2), 3, { closed: false });
      g.save(); g.setLineDash([2, 9]); inkPath(g, [[cx - 84, cy + 46], [cx - 20, cy - 96], [cx + 84, cy - 78]], 3); g.restore();
      sparkle(g, cx - 70, cy - 70, 14); sparkle(g, cx + 62, cy + 78, 11);
    },
    wall: function (g, cx, cy) {            // 벽돌 담
      var bw = 62, bh = 36, x0 = cx - 2 * bw, y0 = cy - 2 * bh;
      for (var row = 0; row < 4; row++) {
        var off = row % 2 ? bw / 2 : 0;
        for (var col = -1; col < 4; col++) {
          var x = x0 + col * bw + off, w = bw; if (x < x0) { w -= (x0 - x); x = x0; } if (x + w > x0 + 4 * bw) w = x0 + 4 * bw - x; if (w < 12) continue;
          var y = y0 + row * bh;
          inkPath(g, [[x, y], [x + w, y], [x + w, y + bh], [x, y + bh]], 3, { closed: true, jit: 1.3 });
          if ((row + col) % 3 === 0) for (var h = 0; h < 3; h++) inkPath(g, [[x + 6 + h * 8, y + bh - 5], [x + 14 + h * 8, y + 7]], 1.6, { jit: 0.4 });
        }
      }
      inkPath(g, [[x0 - 16, y0 + 4 * bh + 6], [x0 + 4 * bw + 16, y0 + 4 * bh + 6]], 4);
    },
    sixsense: function (g, cx, cy) {        // 눈 + 광선
      var top = [], bot = [];
      for (var i = 0; i <= 14; i++) { var t = i / 14, x = cx - 100 + 200 * t, y = Math.sin(t * Math.PI) * 62; top.push([x, cy - y]); bot.push([x, cy + y * 0.8]); }
      inkPath(g, top.concat(bot.reverse()), 3.6, { closed: true, jit: 1.1 });
      inkPath(g, circlePts(cx, cy, 36, 20), 3.4, { closed: true });
      inkPath(g, circlePts(cx, cy, 17, 14), 3, { closed: true, fill: true });
      g.save(); g.fillStyle = '#d9c79a'; g.globalAlpha = 0.9; g.beginPath(); g.arc(cx - 7, cy - 7, 5, 0, 7); g.fill(); g.restore();
      for (var k = 0; k < 9; k++) { var a = -Math.PI + (k + 0.5) / 9 * Math.PI; inkPath(g, [[cx + Math.cos(a) * 70, cy - 62 + Math.sin(a) * 20], [cx + Math.cos(a) * 94, cy - 70 + Math.sin(a) * 30]], 2.6); }
      inkPath(g, [[cx - 40, cy + 82], [cx - 40, cy + 108]], 2.6); inkPath(g, [[cx + 40, cy + 82], [cx + 40, cy + 108]], 2.6);
    },
    reversal: function (g, cx, cy) {        // 음양 + 화살
      var r = 78;
      inkPath(g, circlePts(cx, cy, r, 30), 3.6, { closed: true });
      g.save(); g.fillStyle = INK; g.globalAlpha = 0.92; g.beginPath();
      g.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false); g.arc(cx, cy + r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(cx, cy - r / 2, r / 2, Math.PI / 2, -Math.PI / 2, false);
      g.fill(); g.restore();
      inkPath(g, circlePts(cx, cy - r / 2, 9, 10), 2.6, { closed: true, fill: false });
      inkPath(g, circlePts(cx, cy + r / 2, 9, 10), 2.6, { closed: true, fill: true });
      g.save(); g.fillStyle = '#d9c79a'; g.beginPath(); g.arc(cx, cy + r / 2, 8, 0, 7); g.fill(); g.restore();
      inkPath(g, [[cx - 98, cy - 30], [cx - 108, cy], [cx - 98, cy + 30]], 3);
      inkPath(g, [[cx - 114, cy - 12], [cx - 108, cy], [cx - 94, cy - 4]], 3);
      inkPath(g, [[cx + 98, cy + 30], [cx + 108, cy], [cx + 98, cy - 30]], 3);
      inkPath(g, [[cx + 114, cy + 12], [cx + 108, cy], [cx + 94, cy + 4]], 3);
    }
    ,
    windmill: function (g, cx, cy) {         // 풍차: 탑 + 날개 4개
      var hx = cx, hy = cy + 12, hub = hy - 30;
      inkPath(g, [[hx - 28, hy + 92], [hx - 15, hy - 24], [hx + 15, hy - 24], [hx + 28, hy + 92]], 3.4, { closed: true });
      inkPath(g, [[hx - 40, hy + 92], [hx + 40, hy + 92]], 3.6);
      for (var k = 0; k < 4; k++) {
        var a = k * Math.PI / 2 + 0.45, ex = hx + Math.cos(a) * 84, ey = hub + Math.sin(a) * 84, nx = -Math.sin(a) * 17, ny = Math.cos(a) * 17;
        inkPath(g, [[hx, hub], [ex - nx * 0.2, ey - ny * 0.2], [ex + nx, ey + ny], [hx + nx * 0.35, hub + ny * 0.35]], 3, { closed: true });
        inkPath(g, [[hx, hub], [ex, ey]], 2);
      }
      inkPath(g, circlePts(hx, hub, 9, 10), 3, { closed: true, fill: true });
    },
    alkkagi: function (g, cx, cy) {          // 알까기: 돌이 돌을 튕김
      inkPath(g, circlePts(cx - 68, cy + 44, 36, 20), 3.4, { closed: true, fill: true });
      inkPath(g, circlePts(cx + 52, cy - 26, 36, 20), 3.4, { closed: true });
      inkPath(g, [[cx - 34, cy + 24], [cx + 8, cy + 0]], 3);
      sparkle(g, cx - 4, cy + 8, 16);
      inkPath(g, [[cx + 96, cy + 14], [cx + 124, cy - 8]], 2.6); inkPath(g, [[cx + 100, cy + 40], [cx + 130, cy + 30]], 2.6);
      g.save(); g.setLineDash([2, 9]); inkPath(g, [[cx - 118, cy + 98], [cx - 92, cy + 80]], 2.6); g.restore();
    },
    trade: function (g, cx, cy) {            // 맞교환: 두 돌이 자리를 바꿈
      inkPath(g, circlePts(cx - 64, cy + 34, 34, 20), 3.4, { closed: true, fill: true });
      inkPath(g, circlePts(cx + 64, cy + 34, 34, 20), 3.4, { closed: true });
      var top = [], bot = [];
      for (var i = 0; i <= 12; i++) { var t = i / 12; top.push([cx - 64 + 128 * t, cy - 8 - 46 * Math.sin(Math.PI * t)]); bot.push([cx + 64 - 128 * t, cy + 76 + 46 * Math.sin(Math.PI * t)]); }
      inkPath(g, top, 3); inkPath(g, bot, 3);
      inkPath(g, [[cx + 46, cy - 14], [cx + 64, cy - 8], [cx + 62, cy - 28]], 3);
      inkPath(g, [[cx - 46, cy + 98], [cx - 64, cy + 76], [cx - 44, cy + 74]], 3);
    },
    infection: function (g, cx, cy) {        // 감염: 병균에 물든 돌
      inkPath(g, circlePts(cx, cy + 6, 42, 22), 3.4, { closed: true, fill: true });
      for (var k = 0; k < 10; k++) {
        var a = k / 10 * Math.PI * 2, x1 = cx + Math.cos(a) * 42, y1 = cy + 6 + Math.sin(a) * 42, x2 = cx + Math.cos(a) * 72, y2 = cy + 6 + Math.sin(a) * 72;
        inkPath(g, [[x1, y1], [x2, y2]], 3); inkPath(g, circlePts(x2, y2, 7, 8), 2.6, { closed: true, fill: true });
      }
      g.save(); g.fillStyle = '#d9c79a'; g.globalAlpha = 0.85; g.beginPath(); g.arc(cx - 14, cy - 8, 6, 0, 7); g.arc(cx + 12, cy + 18, 4, 0, 7); g.fill(); g.restore();
    },
    earthquake: function (g, cx, cy) {       // 지진: 갈라지는 땅과 흔들리는 돌
      inkPath(g, [[cx - 128, cy + 52], [cx - 60, cy + 56], [cx - 30, cy + 78], [cx + 0, cy + 54], [cx + 38, cy + 82], [cx + 70, cy + 56], [cx + 128, cy + 60]], 3.6);
      inkPath(g, [[cx - 30, cy + 78], [cx - 40, cy + 104]], 3); inkPath(g, [[cx + 38, cy + 82], [cx + 30, cy + 108]], 3);
      inkPath(g, circlePts(cx - 70, cy + 22, 26, 16), 3.2, { closed: true, fill: true });
      inkPath(g, circlePts(cx + 8, cy - 8, 26, 16), 3.2, { closed: true });
      inkPath(g, circlePts(cx + 84, cy + 24, 26, 16), 3.2, { closed: true, fill: true });
      [[-98, 2], [-98, 20], [112, 6], [112, 24], [-10, -44], [26, -44]].forEach(function (d) { inkPath(g, [[cx + d[0], cy + d[1]], [cx + d[0] + (d[0] < 0 ? -14 : 14) * (d[1] === -44 ? 0 : 1), cy + d[1] + (d[1] === -44 ? -10 : 0)]], 2.6); });
    },
    meteor: function (g, cx, cy) {           // 운석: 불꼬리를 단 바위
      inkPath(g, [[cx + 6, cy - 4], [cx - 96, cy - 84], [cx - 60, cy - 30], [cx - 118, cy - 40], [cx - 52, cy + 6], [cx - 96, cy + 14], [cx - 32, cy + 36]], 3, { closed: true });
      inkPath(g, circlePts(cx + 38, cy + 30, 52, 14), 3.6, { closed: true, fill: true });
      g.save(); g.fillStyle = '#d9c79a'; g.globalAlpha = 0.8; g.beginPath(); g.arc(cx + 22, cy + 12, 7, 0, 7); g.arc(cx + 54, cy + 44, 5, 0, 7); g.arc(cx + 40, cy + 26, 4, 0, 7); g.fill(); g.restore();
    },
    trap: function (g, cx, cy) {             // 함정: 곰덫
      var up = [], dn = [];
      for (var i = 0; i <= 14; i++) { var t = i / 14, x = cx - 98 + 196 * t; up.push([x, cy + 14 - Math.sin(Math.PI * t) * 66]); dn.push([x, cy + 14 + Math.sin(Math.PI * t) * 52]); }
      inkPath(g, up, 3.6); inkPath(g, dn, 3.6);
      for (i = 1; i < 14; i += 2) { inkPath(g, [up[i], [up[i][0] + 8, up[i][1] + 22], up[i + 1]], 2.6, { fill: true }); inkPath(g, [dn[i], [dn[i][0] + 8, dn[i][1] - 20], dn[i + 1]], 2.6, { fill: true }); }
      inkPath(g, [[cx - 98, cy + 14], [cx + 98, cy + 14]], 2.4);
      inkPath(g, [[cx - 98, cy + 14], [cx - 124, cy + 52], [cx - 124, cy + 90]], 3);
      g.save(); g.setLineDash([2, 8]); inkPath(g, [[cx - 124, cy + 90], [cx - 40, cy + 100]], 2.4); g.restore();
    },
    snipe: function (g, cx, cy) {            // 저격: 조준경
      inkPath(g, circlePts(cx, cy + 6, 78, 30), 3.6, { closed: true });
      inkPath(g, circlePts(cx, cy + 6, 46, 24), 2.4, { closed: true });
      inkPath(g, [[cx - 108, cy + 6], [cx - 30, cy + 6]], 3); inkPath(g, [[cx + 30, cy + 6], [cx + 108, cy + 6]], 3);
      inkPath(g, [[cx, cy - 72], [cx, cy - 24]], 3); inkPath(g, [[cx, cy + 36], [cx, cy + 84]], 3);
      inkPath(g, circlePts(cx, cy + 6, 9, 10), 3, { closed: true, fill: true });
    },
    double: function (g, cx, cy) {           // 1+1: 카드 두 장
      inkPath(g, [[cx - 96, cy - 62], [cx - 8, cy - 62], [cx - 8, cy + 66], [cx - 96, cy + 66]], 3.4, { closed: true });
      inkPath(g, [[cx + 8, cy - 42], [cx + 96, cy - 42], [cx + 96, cy + 86], [cx + 8, cy + 86]], 3.4, { closed: true, fill: false });
      sparkle(g, cx - 52, cy + 2, 20); sparkle(g, cx + 52, cy + 22, 20);
      inkPath(g, [[cx - 8, cy + 8], [cx + 8, cy + 8]], 3); inkPath(g, [[cx, cy], [cx, cy + 16]], 3);
    },
    peek: function (g, cx, cy) {             // 엿보기: 돋보기 속의 눈
      inkPath(g, circlePts(cx - 14, cy - 6, 62, 28), 4, { closed: true });
      inkPath(g, [[cx + 32, cy + 38], [cx + 92, cy + 98]], 9);
      var t = [], b = [];
      for (var i = 0; i <= 10; i++) { var u = i / 10, x = cx - 14 - 40 + 80 * u, y = Math.sin(Math.PI * u) * 24; t.push([x, cy - 6 - y]); b.push([x, cy - 6 + y * 0.8]); }
      inkPath(g, t.concat(b.reverse()), 2.8, { closed: true });
      inkPath(g, circlePts(cx - 14, cy - 6, 12, 12), 2.8, { closed: true, fill: true });
    },
    giant: function (g, cx, cy) {            // 거대한 돌: 쩍 갈라진 바위
      inkPath(g, [[cx - 92, cy + 70], [cx - 108, cy + 6], [cx - 66, cy - 58], [cx - 8, cy - 78], [cx + 56, cy - 52], [cx + 104, cy + 10], [cx + 90, cy + 72]], 4, { closed: true, fill: false });
      inkPath(g, [[cx - 8, cy - 78], [cx - 22, cy - 20], [cx + 10, cy + 8], [cx - 4, cy + 72]], 3);
      inkPath(g, [[cx - 66, cy - 58], [cx - 40, cy - 8], [cx - 70, cy + 20]], 2.6);
      inkPath(g, [[cx + 56, cy - 52], [cx + 36, cy - 6], [cx + 66, cy + 28]], 2.6);
      [[-128, 84, 11], [118, 88, 9], [-112, 100, 7]].forEach(function (p) { inkPath(g, circlePts(cx + p[0], cy + p[1], p[2], 8), 2.6, { closed: true, fill: true }); });
    },
    ghost: function (g, cx, cy) {            // 투명한 돌: 유령
      var pts = [[cx - 58, cy + 86]];
      for (var i = 0; i <= 12; i++) { var a = Math.PI + i / 12 * Math.PI; pts.push([cx + Math.cos(a) * 58, cy - 8 + Math.sin(a) * 66]); }
      pts.push([cx + 58, cy + 86]);
      for (i = 0; i < 4; i++) { pts.push([cx + 58 - (i + 0.5) * 29, cy + 62]); pts.push([cx + 58 - (i + 1) * 29, cy + 86]); }
      inkPath(g, pts, 3.6, { closed: true });
      inkPath(g, circlePts(cx - 20, cy - 14, 9, 10), 2.6, { closed: true, fill: true }); inkPath(g, circlePts(cx + 20, cy - 14, 9, 10), 2.6, { closed: true, fill: true });
      inkPath(g, [[cx - 14, cy + 14], [cx, cy + 22], [cx + 14, cy + 14]], 2.8);
      g.save(); g.setLineDash([3, 8]); inkPath(g, circlePts(cx + 92, cy + 76, 22, 14), 2.6, { closed: true }); g.restore();
    },
    weather: function (g, cx, cy) {          // 기상 이변: 비구름과 번개
      var cl = [[cx - 80, cy + 20]];
      for (var i = 0; i <= 8; i++) { var a = Math.PI + i / 8 * Math.PI; cl.push([cx - 46 + Math.cos(a) * 36, cy + 4 + Math.sin(a) * 34]); }
      for (i = 0; i <= 8; i++) { var b = Math.PI * 1.25 + i / 8 * Math.PI * 0.95; cl.push([cx + 18 + Math.cos(b) * 50, cy - 6 + Math.sin(b) * 46]); }
      cl.push([cx + 90, cy + 20]);
      inkPath(g, cl, 3.6, { closed: true });
      [[-56, 44], [-26, 52], [10, 44], [44, 52], [70, 44]].forEach(function (p) { inkPath(g, [[cx + p[0], cy + p[1]], [cx + p[0] - 10, cy + p[1] + 28]], 2.8); });
      inkPath(g, [[cx + 8, cy + 30], [cx - 10, cy + 62], [cx + 4, cy + 62], [cx - 14, cy + 96]], 3.4, { fill: false });
    },
    shield: function (g, cx, cy) {           // 보호막: 방패
      inkPath(g, [[cx - 66, cy - 74], [cx + 66, cy - 74], [cx + 66, cy + 6], [cx, cy + 96], [cx - 66, cy + 6]], 4, { closed: true });
      inkPath(g, [[cx - 50, cy - 58], [cx + 50, cy - 58], [cx + 50, cy + 2], [cx, cy + 74], [cx - 50, cy + 2]], 2.4, { closed: true });
      inkPath(g, [[cx, cy - 58], [cx, cy + 74]], 2.8); inkPath(g, [[cx - 50, cy - 14], [cx + 50, cy - 14]], 2.8);
      inkPath(g, circlePts(cx, cy - 14, 14, 12), 3, { closed: true, fill: true });
    },
    blockade: function (g, cx, cy) {         // 봉쇄: 카드 위의 금지 표시
      inkPath(g, [[cx - 44, cy - 64], [cx + 44, cy - 64], [cx + 44, cy + 76], [cx - 44, cy + 76]], 3.4, { closed: true });
      inkPath(g, [[cx - 26, cy - 40], [cx + 26, cy - 40]], 2.4); inkPath(g, [[cx - 26, cy - 22], [cx + 14, cy - 22]], 2.4);
      inkPath(g, circlePts(cx, cy + 6, 84, 32), 6, { closed: true });
      inkPath(g, [[cx - 60, cy - 54], [cx + 60, cy + 66]], 6);
    }
  };

  function roughRectPts(x, y, w, h, jit, step) {
    var p = [], c = 14;
    var corners = [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]];
    return roughen(corners, step || 14, jit, true);
  }

  // 그림 칸(카드 좌표 384x576 기준): x46 y162 w292 h214 — 칸을 꽉 채우도록(cover) 맞춰 넣음
  var ART_BOX = { x: 46, y: 162, w: 292, h: 214 };
  function drawIllustration(g, img) {
    var B = ART_BOX, sc = Math.max(B.w / img.width, B.h / img.height);
    var dw = img.width * sc, dh = img.height * sc;
    g.save();
    g.beginPath(); roughRectPts(B.x, B.y, B.w, B.h, 1.2, 14).forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.clip();
    if (CFG.artBlend === 'multiply') g.globalCompositeOperation = 'multiply';
    g.drawImage(img, B.x + (B.w - dw) / 2, B.y + (B.h - dh) / 2, dw, dh);
    g.restore();
    inkPath(g, roughRectPts(B.x, B.y, B.w, B.h, 1.2, 14), 3, { closed: true, jit: 0.9 });   // 잉크 테두리
  }

  function cardTexture(id) {
    if (texCache[id]) return texCache[id];
    var c = CARDS[id], W = 384, H = 576;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);

    // 종이 모양(가장자리 거칠게)으로 잘라낸 뒤 그 안에만 그림
    var edge = roughRectPts(6, 6, W - 12, H - 12, 2.4, 12);
    g.save(); g.beginPath(); edge.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.clip();

    var paperImg = CFG.cardPaper && IMG[CFG.cardPaper];
    if (paperImg) g.drawImage(paperImg, 0, 0, W, H);
    else {
    var grad = g.createLinearGradient(0, 0, W * 0.4, H);
    grad.addColorStop(0, '#d8c697'); grad.addColorStop(0.55, '#c9b483'); grad.addColorStop(1, '#b89f6a');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    for (var i = 0; i < 7; i++) {                       // 얼룩
      var sx = rnd(0, W), sy = rnd(0, H), sr = rnd(30, 90), sg = g.createRadialGradient(sx, sy, 2, sx, sy, sr);
      sg.addColorStop(0, 'rgba(110,75,30,' + rnd(0.06, 0.16) + ')'); sg.addColorStop(1, 'rgba(110,75,30,0)');
      g.fillStyle = sg; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
    for (var k = 0; k < 1400; k++) { g.fillStyle = 'rgba(70,45,15,' + rnd(0, 0.1) + ')'; g.fillRect(rnd(0, W), rnd(0, H), rnd(1, 3), rnd(1, 3)); }
    // 접힌 자국
    g.strokeStyle = 'rgba(255,245,215,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, H * 0.46); g.lineTo(W, H * 0.5); g.stroke();
    g.strokeStyle = 'rgba(70,45,15,0.18)'; g.beginPath(); g.moveTo(0, H * 0.46 + 3); g.lineTo(W, H * 0.5 + 3); g.stroke();
    var vg = g.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);   // 가장자리 어둡게
    vg.addColorStop(0, 'rgba(50,28,8,0)'); vg.addColorStop(1, 'rgba(50,28,8,0.62)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }

    // 잉크 테두리
    inkPath(g, roughRectPts(26, 26, W - 52, H - 52, 1.5, 14), 3.2, { closed: true, jit: 1 });
    g.globalAlpha = 0.4; inkPath(g, roughRectPts(36, 36, W - 72, H - 72, 1.2, 14), 1.6, { closed: true, jit: 0.8 }); g.globalAlpha = 1;

    // 상단 룬 + 이름
    runeGlyph(g, W / 2, 70, 20);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
    g.font = '40px ' + TEXT_FONT; g.globalAlpha = 0.93; g.fillText(c.name, W / 2, 124); g.globalAlpha = 1;
    inkPath(g, [[W / 2 - 92, 150], [W / 2 + 92, 150]], 2.2, { jit: 1 });

    // 그림 영역
    var artImg = cardArtPath(id) && IMG[cardArtPath(id)];
    if (artImg) drawIllustration(g, artImg); else ART[id](g, W / 2, 262);
    for (var s = 0; s < 14; s++) { g.fillStyle = INK; g.globalAlpha = rnd(0.25, 0.7); g.beginPath(); g.arc(rnd(50, W - 50), rnd(170, 360), rnd(0.8, 3.4), 0, 7); g.fill(); }   // 잉크 튄 자국
    g.globalAlpha = 1;

    // 설명: 칸(가로 284 · 세로 100)에 맞게 글자 크기를 줄이고, 한 글자만 남는 줄은 만들지 않음
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
    var size = 25, lines = [], nExplicit = c.desc.split('\n').length;
    [25, 23, 21, 19, 17, 15].some(function (sz) {           // 줄바꿈 없이 의도한 줄 그대로 들어가는 가장 큰 글자 크기
      size = sz; g.font = sz + 'px ' + TEXT_FONT; lines = wrapText(g, c.desc, W - 100);
      return lines.length === nExplicit && lines.length * sz * 1.3 <= 100;
    });
    var lh = size * 1.3, y0 = 438 - (lines.length - 1) * lh / 2;
    g.globalAlpha = 0.9;
    lines.forEach(function (l, i) { g.fillText(l, W / 2, y0 + i * lh); });
    g.globalAlpha = 1;

    // 하단: 분류 + 턴 종료 표시 (테두리 선보다 위에 둠)
    inkPath(g, [[56, 500], [W - 56, 500]], 2, { jit: 1 });
    g.font = '21px ' + TEXT_FONT; g.fillStyle = INK;
    g.textAlign = 'left'; g.fillText(c.cat, 60, 521);
    g.textAlign = 'right'; g.globalAlpha = 0.85; g.fillText(c.endsTurn ? '턴 종료' : '턴 유지', W - 60, 521); g.globalAlpha = 1;
    g.restore();
    // 가장자리 잉크 윤곽
    g.beginPath(); edge.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath();
    g.strokeStyle = 'rgba(40,24,8,0.75)'; g.lineWidth = 2.5; g.stroke();
    return (texCache[id] = toTex(cv));
  }


  function visibleWidth() {
    return 2 * 6.5 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  }
  function viewSize() { var vh = 2 * 6.5 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); return { vw: vh * camera.aspect, vh: vh }; }

  // 직부감에서 왼쪽 아래에 떠 있는 '사용하기로 한 카드' 한 장
  var playedMesh = null;
  function showPlayed(snap) {
    clearPlayed();
    var m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardTexture(snap.id), transparent: true, alphaTest: 0.02 }));
    m.position.set(snap.x, snap.y, 1.2); m.scale.set(snap.s, snap.s, 1);
    m.userData.id = snap.id; handGroup.add(m); playedMesh = m; sfx('magic');
  }
  /* ---- 카드가 불타 사라지는 연출: 가운데로 이동 → 불길이 번지며 재가 됨 ---- */
  var burns = [];
  var burnVert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var burnFrag = [
    'uniform sampler2D map; uniform float burn; varying vec2 vUv;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
    'float fbm(vec2 p){ return noise(p) * 0.5 + noise(p * 2.0) * 0.25 + noise(p * 4.0) * 0.125 + noise(p * 8.0) * 0.0625; }',
    'void main(){',
    '  vec4 c = texture2D(map, vUv);',
    '  if (c.a < 0.05) discard;',
    '  float n = fbm(vUv * 5.0) * 0.8 + vUv.y * 0.2;',   // 아래쪽부터 타 올라감
    '  float d = n - (burn * 1.3 - 0.12);',
    '  if (d < 0.0) discard;',
    '  vec3 charred = c.rgb * mix(0.08, 1.0, smoothstep(0.03, 0.22, d));',
    '  vec3 fire = mix(vec3(1.0, 0.9, 0.35), vec3(0.95, 0.3, 0.05), smoothstep(0.0, 0.09, d));',
    '  vec3 glow = fire * (1.0 - smoothstep(0.0, 0.08, d)) * 2.2;',
    '  gl_FragColor = vec4(charred + glow, c.a);',
    '}'
  ].join('\n');
  var BURN_MOVE = 1.0, BURN_TIME = 1.25;      // BURN_MOVE: 가운데로 오는 시간 (처음엔 빠르게, 도착할 때쯤 천천히)
  var emberTex = (function () {
    var cv = document.createElement('canvas'); cv.width = cv.height = 32;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(cv);
  })();
  function startBurn(mesh, moveToCenter, onIgnite) {
    var tex = mesh.material.map;
    mesh.material.dispose();
    mesh.material = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, burn: { value: 0 } }, vertexShader: burnVert, fragmentShader: burnFrag, transparent: true, depthWrite: false });
    var n = 80, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), base = [], vel = [], delay = [];
    for (var i = 0; i < n; i++) {
      base.push([(Math.random() - 0.5) * 2.3, (Math.random() - 0.5) * 3.4]);
      vel.push(0.5 + Math.random() * 1.5); delay.push(Math.random() * 0.9);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 9, map: emberTex, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false; pts.position.set(0, 0, 1.0); handGroup.add(pts);
    var off = moveToCenter ? BURN_MOVE : 0.1;
    burns.push({ m: mesh, pts: pts, n: n, base: base, vel: vel, delay: delay, off: off, move: moveToCenter, t: 0, ignited: !moveToCenter, onIgnite: onIgnite,
      from: mesh.position.clone(), fromS: mesh.scale.x, fromR: mesh.rotation.z });
    if (!moveToCenter) sfx('burn');          // 바로 발동하는 카드: 시작과 동시에 불이 붙음
    // 날아오는 카드: 가운데에 도착해 불이 붙는 순간(stepBurns)에 소리와 효과가 나옴
  }
  function stepBurns(dt) {
    for (var bi = burns.length - 1; bi >= 0; bi--) {
      var b = burns[bi]; b.t += dt;
      var mv = b.move ? Math.min(1, b.t / BURN_MOVE) : 1, e = 1 - Math.pow(1 - mv, 3);   // ease-out: 감속하며 도착
      b.m.position.set(b.from.x * (1 - e), b.from.y * (1 - e), b.from.z + (0.9 - b.from.z) * e);   // 화면 가운데로
      var sc = b.fromS + (1.75 - b.fromS) * e; b.m.scale.set(sc, sc, 1); b.m.rotation.z = b.fromR * (1 - e);
      if (!b.ignited && b.t >= b.off) {                       // 도착 → 점화: 타는 소리 + 카드 효과를 이 순간에 맞춤
        b.ignited = true; sfx('burn');
        if (b.onIgnite) b.onIgnite();
      }
      var bt = Math.max(0, b.t - b.off) / BURN_TIME;
      b.m.material.uniforms.burn.value = Math.min(1, bt);
      var pa = b.pts.geometry.attributes.position, ca = b.pts.geometry.attributes.color;
      for (var j = 0; j < b.n; j++) {                         // 불씨: 위로 떠오르며 사라짐
        var age = (b.t - b.off) - b.delay[j] * BURN_TIME * 0.8, life = 1.3;
        if (age > 0 && age < life) {
          var f = 1 - age / life;
          pa.setXYZ(j, b.base[j][0] + Math.sin(age * 5 + j) * 0.12, b.base[j][1] + age * b.vel[j], 0);
          ca.setXYZ(j, 1.0 * f, 0.55 * f, 0.15 * f);
        } else { pa.setXYZ(j, 0, -99, 0); ca.setXYZ(j, 0, 0, 0); }
      }
      pa.needsUpdate = true; ca.needsUpdate = true;
      if (b.t > b.off + BURN_TIME + 1.4) {
        handGroup.remove(b.m); b.m.material.dispose(); handGroup.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose();
        burns.splice(bi, 1);
      }
    }
  }
  function clearBurns() {
    burns.forEach(function (b) { handGroup.remove(b.m); b.m.material.dispose(); handGroup.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); });
    burns.length = 0;
  }
  // 효과가 실행된 카드: 왼쪽 아래에서 가운데로 와서 탐
  function burnPlayed(onIgnite) {
    if (!playedMesh) { if (onIgnite) onIgnite(); return; }
    var m = playedMesh; playedMesh = null; startBurn(m, true, onIgnite);
  }
  // 바로 발동하는 카드: 확대된 자리(가운데)에서 바로 탐
  function burnSnap(snap) {
    var m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardTexture(snap.id), transparent: true, alphaTest: 0.02 }));
    m.position.set(snap.x, snap.y, 0.9); m.scale.set(snap.s, snap.s, 1); handGroup.add(m);
    startBurn(m, false);
  }
  function clearPlayed() {
    if (!playedMesh) return;
    handGroup.remove(playedMesh); playedMesh.material.dispose(); playedMesh = null;
  }

  function cardTarget(i, n) {
    var vs = viewSize(), vh = vs.vh, vw = vs.vw;
    var sel = (S.mode && S.pendingIdx === i), hov = hoverCard === i;
    if (inspectIdx === i) return { x: 0, y: 0.0, z: 0.9, rz: 0, s: 1.75, tint: 1 };   // 자세히 보기: 화면 중앙에 크게
    // 인스크립션 패: 큰 카드를 겹쳐서 부채꼴로, 평소엔 윗부분만 보이다가 패 쪽을 보면 위로 올라옴
    var up = handUp && inspectIdx < 0;
    var sc = 0.95, cw = 1.5 * sc;
    var step = up ? 1.2 : 0.95;                // 카드 사이 간격 (카드 폭 1.43)
    var mid = (n - 1) / 2, d = i - mid;
    var y = -vh / 2 + 0.1 + (up ? 1.1 : 0) + (hov ? 0.3 : 0) + (sel ? 0.3 : 0) - d * d * 0.012;
    if (topGoal > 0.5) y = -vh / 2 - 3.2;      // 직부감: 패는 전부 화면 아래로 숨김
    return {
      x: d * step,                         // 화면 아래 중앙
      y: y,
      z: (hov || sel ? 0.3 : 0) + i * 0.01,
      rz: -d * (hov ? 0.012 : 0.045),
      s: sc * (hov || sel ? 1.08 : 1),
      tint: (up || hov || sel) ? 1.0 : 0.78
    };
  }
  function rebuildHand() {
    cardMeshes.forEach(function (m) { handGroup.remove(m); m.material.dispose(); });
    cardMeshes = [];
    var h = G.hand[G.current];
    h.forEach(function (id, i) {
      var m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardTexture(id), transparent: true, alphaTest: 0.02 }));
      m.userData.i = i;

      m.position.set(0, -4.2, 0.2); // 아래에서 올라오는 등장 연출
      handGroup.add(m); cardMeshes.push(m);
    });
    hoverCard = -1; inspectIdx = -1;
  }
  function stepCards(dt) {
    var k = 1 - Math.pow(0.0006, dt), n = cardMeshes.length;
    stepDraft(k);
    var op = dimMesh.material.opacity + (((inspectIdx >= 0 || draftMeshes.length) ? 0.68 : 0) - dimMesh.material.opacity) * k;
    dimMesh.material.opacity = op; dimMesh.visible = op > 0.01;
    if (playedMesh) {                       // 사용한 카드: 직부감일 때만 왼쪽 아래에 표시
      var vs = viewSize(), sc = 0.62, ch = 2.25 * sc, cwp = 1.5 * sc, show = topGoal > 0.5;
      var px = -vs.vw / 2 + 0.4 + cwp / 2, py = show ? -vs.vh / 2 + 0.35 + ch / 2 : -vs.vh / 2 - ch;
      playedMesh.position.x += (px - playedMesh.position.x) * k;
      playedMesh.position.y += (py - playedMesh.position.y) * k;
      playedMesh.position.z += (0.4 - playedMesh.position.z) * k;
      playedMesh.rotation.z += (0.05 - playedMesh.rotation.z) * k;
      var ps = playedMesh.scale.x + (sc - playedMesh.scale.x) * k; playedMesh.scale.set(ps, ps, 1);
    }
    cardMeshes.forEach(function (m, i) {
      var t = cardTarget(i, n);
      m.position.x += (t.x - m.position.x) * k;
      m.position.y += (t.y - m.position.y) * k;
      m.position.z += (t.z - m.position.z) * k;
      m.rotation.z += (t.rz - m.rotation.z) * k;
      var s = m.scale.x + (t.s - m.scale.x) * k; m.scale.set(s, s, 1);
      var c = m.material.color.r + (t.tint - m.material.color.r) * k;
      m.material.color.setRGB(c, c, c);
    });
  }

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
  document.getElementById('restart').addEventListener('click', reset);
  document.getElementById('again').addEventListener('click', reset);

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
})();
