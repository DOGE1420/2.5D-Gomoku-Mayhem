/* 증강 오목 3D 프로토타입 — 인스크립션 풍 (촛불 · 어두운 방 · 손패 카드)
 * 판 15x15, 돌, 카드 6장. 로컬 2인 대전(핫시트). 정확히 5목(식스센스 후 6목)이면 승리.
 */
(function () {
  'use strict';

  var N = 15, HALF = 7;
  var EMPTY = 0, BLACK = 1, WHITE = 2, WALL = 3;
  var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  var TEXT_FONT = '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';

  /* ---------------- 카드 정의 (CARDS.md 의 21장 중 6장) ---------------- */
  var CARDS = {
    chain:    { icon: '⚡', name: '연속 착수', cat: '공격',  color: '#8a5a1c', desc: '이번 턴에 3수까지 둠\n(같은 턴에 둔 돌의 2칸 이내 금지)' },
    bomb:     { icon: '💥', name: '폭파',     cat: '방해',  color: '#8a2a1c', desc: '상대 돌 1개를 제거' },
    teleport: { icon: '✨', name: '순간이동', cat: '무작위', color: '#3d5a8a', desc: '내 돌 1개를\n무작위 빈 칸으로 이동' },
    wall:     { icon: '🧱', name: '장벽',     cat: '지형',  color: '#5a4a3a', desc: '빈 칸에 영구 장벽\n아무도 못 두고 줄도 끊김' },
    sixth:    { icon: '👁️', name: '식스센스', cat: '규칙',  color: '#5a2a6a', desc: '승리 조건이\n영구히 6목으로' },
    reversal: { icon: '☯️', name: '전세 역전', cat: '희귀',  endsTurn: true, color: '#b8901c', desc: '판의 흑·백 돌을\n통째로 뒤바꿈' }
  };
  var CARD_IDS = Object.keys(CARDS);

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
  scene.fog = new THREE.Fog(0x000000, 16, 46);

  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  scene.add(camera);
  var CAM_BASE = new THREE.Vector3(0, 7.2, 16.5);
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

  /* ---------------- 상태 ---------------- */
  var board = [], meshes = [];
  var hands = {};
  var S = {};
  var sixth = false;
  var walls = [];

  function inb(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }
  function opp(c) { return c === BLACK ? WHITE : BLACK; }
  function cellName(c) { return c === BLACK ? '흑' : '백'; }

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
  function cellPos(x, y) { return new THREE.Vector3(x - HALF, STONE_Y, y - HALF); }

  var ghost = makeStone(BLACK, new THREE.MeshStandardMaterial({ color: 0x17130f, transparent: true, opacity: 0.45 }));
  ghost.castShadow = false; ghost.visible = false; scene.add(ghost);
  var ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.52, 36),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false; scene.add(ring);

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
    sixth: function (g, cx, cy) {           // 눈 + 광선
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
    g.font = 'bold 40px ' + TEXT_FONT; g.globalAlpha = 0.93; g.fillText(c.name, W / 2, 124); g.globalAlpha = 1;
    inkPath(g, [[W / 2 - 92, 150], [W / 2 + 92, 150]], 2.2, { jit: 1 });

    // 그림 영역
    var artImg = cardArtPath(id) && IMG[cardArtPath(id)];
    if (artImg) drawIllustration(g, artImg); else ART[id](g, W / 2, 262);
    for (var s = 0; s < 14; s++) { g.fillStyle = INK; g.globalAlpha = rnd(0.25, 0.7); g.beginPath(); g.arc(rnd(50, W - 50), rnd(170, 360), rnd(0.8, 3.4), 0, 7); g.fill(); }   // 잉크 튄 자국
    g.globalAlpha = 1;

    // 설명
    g.fillStyle = INK; g.font = '25px ' + TEXT_FONT; g.globalAlpha = 0.9;
    var lines = wrapText(g, c.desc, W - 112);
    var y0 = 410 + (4 - Math.min(4, lines.length)) * 10;
    lines.forEach(function (l, i) { g.fillText(l, W / 2, y0 + i * 32); });
    g.globalAlpha = 1;

    // 하단: 분류 + 턴 종료 표시
    inkPath(g, [[56, 512], [W - 56, 512]], 2, { jit: 1 });
    g.font = 'bold 22px ' + TEXT_FONT; g.textAlign = 'left'; g.fillStyle = INK; g.fillText(c.cat, 58, 540);
    g.textAlign = 'right'; g.globalAlpha = 0.85; g.fillText(c.endsTurn ? '턴 종료' : '턴 유지', W - 58, 540); g.globalAlpha = 1;
    g.restore();
    // 가장자리 잉크 윤곽
    g.beginPath(); edge.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath();
    g.strokeStyle = 'rgba(40,24,8,0.75)'; g.lineWidth = 2.5; g.stroke();
    return (texCache[id] = toTex(cv));
  }


  function visibleWidth() {
    return 2 * 6.5 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  }
  function cardTarget(i, n) {
    var vh = 2 * 6.5 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), vw = vh * camera.aspect;
    var sel = (S.mode && S.pendingIdx === i), hov = hoverCard === i;
    if (inspectIdx === i) return { x: 0, y: 0.0, z: 0.9, rz: 0, s: 1.75, tint: 1 };   // 자세히 보기: 화면 중앙에 크게
    // 인스크립션 패: 큰 카드를 겹쳐서 부채꼴로, 평소엔 윗부분만 보이다가 패 쪽을 보면 위로 올라옴
    var up = handUp && inspectIdx < 0;
    var sc = 0.95, cw = 1.5 * sc;
    var step = up ? 0.82 : 0.62;
    var mid = (n - 1) / 2, d = i - mid;
    var y = -vh / 2 + 0.1 + (up ? 1.1 : 0) + (hov ? 0.3 : 0) + (sel ? 0.3 : 0) - d * d * 0.012;
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
    var h = hands[S.turn];
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
    var op = dimMesh.material.opacity + ((inspectIdx >= 0 ? 0.68 : 0) - dimMesh.material.opacity) * k;
    dimMesh.material.opacity = op; dimMesh.visible = op > 0.01;
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
  var elMsg = document.getElementById('msg');
  var elEnd = document.getElementById('endturn');
  var elBanner = document.getElementById('banner');
  function setMsg(t) { elMsg.textContent = t || ''; }
  function updateHUD() {
    var left = S.maxStones - S.placed;
    elTurn.textContent = (S.turn === BLACK ? '⚫ 흑' : '⚪ 백') + ' 차례 · 착수 ' + left + '회 남음' +
      (sixth ? ' · 6목 규칙' : '') + (S.cardUsed ? ' · 카드 사용함' : '');
    elEnd.style.display = (!S.over && S.maxStones > 1 && S.placed >= 1) ? 'block' : 'none';
  }

  /* ---------------- 승리 판정 ---------------- */
  var DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  function findWin(c) {
    var target = sixth ? 6 : 5;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (board[y][x] !== c) continue;
      for (var d = 0; d < 4; d++) {
        var dx = DIRS[d][0], dy = DIRS[d][1], px = x - dx, py = y - dy;
        if (inb(px, py) && board[py][px] === c) continue;
        var cells = [], cx = x, cy = y;
        while (inb(cx, cy) && board[cy][cx] === c) { cells.push([cx, cy]); cx += dx; cy += dy; }
        if (cells.length === target) return cells;
      }
    }
    return null;
  }
  function checkWin() {
    var order = [S.turn, opp(S.turn)];
    for (var i = 0; i < 2; i++) {
      var cells = findWin(order[i]);
      if (cells) { finish(order[i], cells); return true; }
    }
    return false;
  }
  function finish(winner, cells) {
    S.over = true; S.mode = null; S.pendingIdx = -1;
    cells.forEach(function (p) {
      var m = meshes[p[1]][p[0]]; if (!m) return;
      m.material = m.material.clone();
      m.material.emissive = new THREE.Color(0xffaa33); m.material.emissiveIntensity = 0.7;
    });
    sfx('win'); updateHUD();
    setTimeout(function () {
      document.getElementById('bannerText').textContent = (winner === BLACK ? '⚫ 흑' : '⚪ 백') + ' 승리!';
      elBanner.style.display = 'flex';
    }, 900);
  }

  /* ---------------- 보드 조작 ---------------- */
  function placeStone(x, y, c, cb) {
    board[y][x] = c;
    var m = makeStone(c), p = cellPos(x, y);
    m.position.set(p.x, p.y + 2.2, p.z);
    scene.add(m); meshes[y][x] = m;
    tween(0.26, function (t) { m.position.y = p.y + 2.2 * (1 - t * t); }, function () {
      m.position.y = p.y; sfx('place'); if (cb) cb();
    });
  }
  function removeStone(x, y) {
    var m = meshes[y][x]; if (m) scene.remove(m);
    meshes[y][x] = null; board[y][x] = EMPTY;
  }
  function listCells(pred) {
    var out = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (pred(board[y][x], x, y)) out.push([x, y]);
    return out;
  }

  function consumeCard(i) {
    hands[S.turn].splice(i, 1);
    S.cardUsed = true; S.mode = null; S.pendingIdx = -1;
    rebuildHand(); updateHUD();
  }
  function cancelMode() { S.mode = null; S.pendingIdx = -1; setMsg(''); }

  function afterAction() {
    if (checkWin()) return;
    if (S.placed >= S.maxStones) endTurn(); else updateHUD();
  }
  function endTurn() {
    if (S.over) return;
    S.turn = opp(S.turn); S.placed = 0; S.maxStones = 1; S.cardUsed = false;
    S.mode = null; S.pendingIdx = -1; S.turnCells = [];
    setTopView(false);
    rebuildHand(); updateHUD();
    setMsg(cellName(S.turn) + ' 차례 — 카드를 확인하거나, 판을 눌러 돌을 두세요');
  }

  function onCell(x, y) {
    if (S.over || busy > 0 || topGoal < 0.5 || topT < 0.85) return;   // 돌은 직부감 시점에서만 둘 수 있음
    if (S.mode === 'bomb') {
      if (board[y][x] !== opp(S.turn)) { setMsg('제거할 상대 돌을 고르세요'); return; }
      var p = cellPos(x, y); removeStone(x, y); burst(p.clone(), 0xff8a2a, 22); sfx('boom');
      consumeCard(S.pendingIdx); setMsg('폭파! 상대 돌이 사라졌습니다');
      return;
    }
    if (S.mode === 'wall') {
      if (board[y][x] !== EMPTY) { setMsg('빈 칸에 설치하세요'); return; }
      board[y][x] = WALL;
      var w = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.8, 0.86),
        new THREE.MeshStandardMaterial({ color: 0x4d443a, roughness: 1 }));
      w.castShadow = true; w.receiveShadow = true;
      var q = cellPos(x, y); w.position.set(q.x, -0.4, q.z); scene.add(w); meshes[y][x] = w;
      tween(0.5, function (t) { w.position.y = -0.4 + 0.8 * t; });
      sfx('boom'); burst(new THREE.Vector3(q.x, 0.1, q.z), 0x8a7a66, 10);
      consumeCard(S.pendingIdx); setMsg('장벽이 솟아올랐습니다');
      return;
    }
    if (board[y][x] !== EMPTY) { setMsg('이미 돌이 있는 자리입니다'); return; }
    if (S.maxStones > 1 && S.placed >= 1) {
      for (var i = 0; i < S.turnCells.length; i++) {
        var tc = S.turnCells[i];
        if (Math.max(Math.abs(tc[0] - x), Math.abs(tc[1] - y)) <= 2) { setMsg('연속 착수: 같은 턴에 둔 돌의 2칸 이내에는 둘 수 없어요'); return; }
      }
    }
    S.placed++; S.turnCells.push([x, y]);
    placeStone(x, y, S.turn, afterAction);
    setMsg('');
  }

  function useCard(i) {
    if (S.over || busy > 0) return;
    var id = hands[S.turn][i]; if (!id) return;
    if (S.mode && S.pendingIdx === i) { cancelMode(); return; }
    if (S.mode) cancelMode();
    if (S.cardUsed) { setMsg('카드는 턴에 1장만 쓸 수 있어요'); return; }
    sfx('card');
    if (id === 'chain') {
      S.maxStones = 3; consumeCard(i); setMsg('연속 착수! 이번 턴에 3수까지 둘 수 있어요 (최소 1수 후 "턴 종료" 가능)');
    } else if (id === 'sixth') {
      sixth = true; consumeCard(i); sfx('magic'); setMsg('식스센스! 이제 정확히 6목이 되어야 승리합니다');
      checkWin();
    } else if (id === 'bomb') {
      if (!listCells(function (v) { return v === opp(S.turn); }).length) { setMsg('제거할 상대 돌이 없어요'); return; }
      S.mode = 'bomb'; S.pendingIdx = i; setMsg('폭파: 제거할 상대 돌을 클릭하세요 (카드를 다시 누르면 취소)');
    } else if (id === 'wall') {
      S.mode = 'wall'; S.pendingIdx = i; setMsg('장벽: 설치할 빈 칸을 클릭하세요 (카드를 다시 누르면 취소)');
    } else if (id === 'teleport') {
      var mine = listCells(function (v) { return v === S.turn; });
      var empt = listCells(function (v) { return v === EMPTY; });
      if (!mine.length) { setMsg('옮길 내 돌이 없어요'); return; }
      var from = mine[Math.floor(Math.random() * mine.length)];
      var to = empt[Math.floor(Math.random() * empt.length)];
      var m = meshes[from[1]][from[0]], a = cellPos(from[0], from[1]), b = cellPos(to[0], to[1]);
      board[from[1]][from[0]] = EMPTY; meshes[from[1]][from[0]] = null;
      board[to[1]][to[0]] = S.turn; meshes[to[1]][to[0]] = m;
      consumeCard(i); sfx('magic'); burst(a.clone(), 0x9ad0ff, 14);
      tween(0.6, function (t) {
        m.position.x = a.x + (b.x - a.x) * t; m.position.z = a.z + (b.z - a.z) * t;
        m.position.y = a.y + Math.sin(t * Math.PI) * 2.6;
      }, function () { m.position.copy(b); burst(b.clone(), 0x9ad0ff, 14); sfx('place'); checkWin(); });
      setMsg('순간이동!');
    } else if (id === 'reversal') {
      var all = listCells(function (v) { return v === BLACK || v === WHITE; });
      consumeCard(i); sfx('magic'); setMsg('전세 역전! 모든 돌의 색이 뒤바뀝니다');
      tween(0.6, function (t) {
        var s = Math.abs(Math.cos(t * Math.PI)); // 1 → 0 → 1
        all.forEach(function (p) {
          var mm = meshes[p[1]][p[0]]; if (!mm) return;
          mm.scale.y = 0.45 * Math.max(0.05, s);
          if (t >= 0.5 && !mm.userData.flipped) {
            mm.userData.flipped = true;
            var nc = opp(board[p[1]][p[0]]); board[p[1]][p[0]] = nc;
            mm.material = nc === BLACK ? matBlack : matWhite;
          }
        });
      }, function () {
        all.forEach(function (p) { var mm = meshes[p[1]][p[0]]; if (mm) { mm.userData.flipped = false; mm.scale.y = 0.45; } });
        if (!checkWin()) endTurn();
      });
    }
  }

  // 카드가 실제로 쓰였는지(소모됨/대상 선택 대기) 알려주는 래퍼
  function activateCard(i) {
    var turn = S.turn, before = hands[turn].length;
    useCard(i);
    return hands[turn].length < before || (S.mode && S.pendingIdx === i);
  }
  // 발동 연출: 확대된 카드가 커지며 사라짐
  function flourish(snap) {
    var m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardTexture(snap.id), transparent: true, alphaTest: 0.02 }));
    m.position.set(snap.x, snap.y, 1.2); m.scale.set(snap.s, snap.s, 1); handGroup.add(m);
    sfx('magic');
    tween(0.55, function (t) {
      var e = 1 - Math.pow(1 - t, 3);
      m.scale.set(snap.s * (1 + 0.45 * e), snap.s * (1 + 0.45 * e), 1);
      m.position.y = snap.y + 0.5 * e; m.material.opacity = 1 - t;
    }, function () { handGroup.remove(m); m.material.dispose(); });
  }
  function onCardClick(i) {
    if (S.over || busy > 0) return;
    if (inspectIdx !== i) { inspectIdx = i; sfx('card'); return; }        // 1번: 자세히 보기
    var mesh = cardMeshes[i];
    var snap = { id: hands[S.turn][i], x: mesh.position.x, y: mesh.position.y, s: mesh.scale.x };
    if (!activateCard(i)) return;                                          // 못 쓰는 경우: 메시지 표시, 확대 유지
    inspectIdx = -1;                                                       // 2번: 능력 발동 → 직부감으로 이동
    setTopView(true, true);                                                // 카드 효과 메시지는 그대로 둠
    if (!S.mode) flourish(snap);
  }

  /* ---------------- 입력 ---------------- */
  var pointer = new THREE.Vector2(0, 0), raycaster = new THREE.Raycaster();
  var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  var hoverCell = null, hoverTable = false, hitPoint = new THREE.Vector3();
  // 시점: 0 = 앉은 시점(시네마틱), 1 = 직부감(판 전체). 테이블/버튼/V키로 전환
  var topT = 0, topGoal = 0, topH = 30, topDz = 2, parX = 0, parY = 0;
  var elViewBtn = document.getElementById('viewbtn');
  function setTopView(on, quiet) {
    topGoal = on ? 1 : 0;
    elViewBtn.textContent = on ? '🎴 카드 보기' : '🔍 판 보기';
    if (!quiet && !S.mode && !S.over) setMsg(on ? '판을 눌러 돌을 두세요 (테이블을 누르면 카드 화면으로 돌아가요)' : '카드를 눌러 확인 · 한 번 더 누르면 발동 · 판을 누르면 돌을 둘 수 있어요');
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
    var hits = raycaster.intersectObjects(cardMeshes, false);
    hoverCard = hits.length ? hits[0].object.userData.i : -1;
    handUp = hoverCard >= 0 || (Math.abs(pointer.x) < 0.42 && pointer.y < -0.3);
    hoverCell = null; hoverTable = false;
    if (hoverCard < 0 && raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
      var x = Math.round(hitPoint.x + HALF), y = Math.round(hitPoint.z + HALF);
      if (inb(x, y) && Math.abs(hitPoint.x + HALF - x) < 0.5 && Math.abs(hitPoint.z + HALF - y) < 0.5) hoverCell = [x, y];
      else hoverTable = true;                 // 격자 밖(판 테두리·테이블) = 시점 전환 영역
    }
    dom.style.cursor = (hoverCard >= 0 || hoverCell || hoverTable) ? 'pointer' : 'default';
  }
  dom.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; setPointer(e); updateHover(); });
  dom.addEventListener('click', function (e) {
    ac(); if (actx && actx.state === 'suspended') actx.resume();
    setPointer(e); updateHover();
    if (hoverCard >= 0) onCardClick(hoverCard);
    else if (inspectIdx >= 0) inspectIdx = -1;                              // 확대 중 다른 곳을 누르면 닫기
    else if (hoverCell || hoverTable) {
      if (topGoal < 0.5) setTopView(true);                                  // 뒤 시점에서 판/테이블을 누르면 직부감으로
      else if (hoverCell) onCell(hoverCell[0], hoverCell[1]);               // 직부감에서만 돌을 둠
      else setTopView(false);                                               // 직부감에서 테이블을 누르면 카드 화면으로
    }
    // 터치는 '호버'가 없으므로 탭이 끝나면 호버 효과(카드 빛·미리보기)를 지움
    if (e.pointerType === 'touch') { hoverCard = -1; hoverCell = null; hoverTable = false; handUp = false; }
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (inspectIdx >= 0) inspectIdx = -1; else if (S.mode) cancelMode(); }
    else if (e.key === 'v' || e.key === 'V') setTopView(topGoal < 0.5);
  });
  elViewBtn.addEventListener('click', function () { setTopView(topGoal < 0.5); });
  elEnd.addEventListener('click', function () { if (busy === 0) endTurn(); });
  document.getElementById('restart').addEventListener('click', reset);
  document.getElementById('again').addEventListener('click', reset);

  /* ---------------- 맵 (배경 · 판 · 조명 교체) — js/config.js 의 maps ---------------- */
  var defTableTex = table.material.map, defBoardTex = boardPlane.material.map;
  var defCam = { pos: CAM_BASE.clone(), look: CAM_LOOK.clone() };
  var backdrop = null, curMapIdx = 0, fogBase = { near: 16, far: 46 };
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
      else { var F = m.fog || {}; fogBase.near = F.near != null ? F.near : 16; fogBase.far = F.far != null ? F.far : 46; scene.fog = new THREE.Fog(F.color || bg, fogBase.near, fogBase.far); }
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
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (meshes[y] && meshes[y][x]) scene.remove(meshes[y][x]);
    }
    board = []; meshes = [];
    for (var j = 0; j < N; j++) { board.push(new Array(N).fill(EMPTY)); meshes.push(new Array(N).fill(null)); }
    anims.length = 0; busy = 0;
    hands = { 1: CARD_IDS.slice(), 2: CARD_IDS.slice() };
    sixth = false;
    S = { turn: BLACK, placed: 0, maxStones: 1, cardUsed: false, mode: null, pendingIdx: -1, over: false, turnCells: [] };
    elBanner.style.display = 'none';
    setTopView(false);
    rebuildHand(); updateHUD();
    setMsg('흑 선공 — 카드를 눌러 확인(한 번 더 누르면 발동), 판을 누르면 위에서 보며 돌을 둘 수 있어요');
  }

  /* ---------------- 루프 ---------------- */
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h;
    // 세로 화면(모바일): 시야각을 넓히고 카메라를 조금 뒤로 — 판 전체가 폭에 들어오게
    camDist = camera.aspect < 1.5 ? Math.min(1.9, 1.5 / camera.aspect) : 1;
    camera.fov = camera.aspect < 1.2 ? 62 : 45;
    camera.updateProjectionMatrix();
    // 직부감: 위쪽 HUD와 아래쪽 손패를 피해 판(17칸 폭)이 화면 66% 높이·94% 폭 안에 들어오는 높이
    var th = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    topH = Math.max((17 / 0.66) / (2 * th), (17 / 0.94) / (2 * th * camera.aspect));
    topDz = 0.09 * 2 * topH * th;      // 판을 살짝 위로 올려 손패 자리를 확보
  }
  window.addEventListener('resize', resize);

  var clock = new THREE.Clock(), time = 0;
  function frame() {
    var dt = Math.min(0.05, clock.getDelta()); time += dt;
    stepAnims(dt); stepParticles(dt); stepCards(dt);

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
    camera.lookAt(CAM_LOOK.x * k, CAM_LOOK.y * k, CAM_LOOK.z * k + topDz * topT);
    if (scene.fog) { scene.fog.near = fogBase.near + 30 * topT; scene.fog.far = fogBase.far + 70 * topT; }

    // 고스트 / 링 표시
    ghost.visible = false; ring.visible = false;
    if (!S.over && hoverCell && hoverCard < 0 && topT > 0.85 && inspectIdx < 0) {
      var x = hoverCell[0], y = hoverCell[1], v = board[y][x], p = cellPos(x, y);
      if (!S.mode && v === EMPTY) {
        ghost.visible = true; ghost.position.copy(p);
        ghost.material.color.set(S.turn === BLACK ? 0x17130f : 0xece4d2);
      } else if (S.mode === 'bomb' && v === opp(S.turn)) {
        ring.visible = true; ring.position.set(p.x, 0.05, p.z); ring.material.color.set(0xff5a3a);
      } else if (S.mode === 'wall' && v === EMPTY) {
        ring.visible = true; ring.position.set(p.x, 0.05, p.z); ring.material.color.set(0xffd27a);
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // 테스트/디버그용 접근
  window.__game = { setTopView: setTopView, view: function () { return topT; }, inspect: function () { return inspectIdx; }, cardCanvas: function (id) { return cardTexture(id).image; }, get S() { return S; }, get board() { return board; }, hands: function () { return hands; }, onCell: onCell, useCard: useCard, endTurn: endTurn, reset: reset, busy: function () { return busy; } };

  resize(); frame();
  buildMapSelect();
  Promise.all([loadCardAssets(), applyMap(getMaps()[curMapIdx])]).then(function () {
    texCache = {}; reset(); showAssetNotice();
  });
})();
