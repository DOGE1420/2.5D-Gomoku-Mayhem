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
    chain:    { icon: '⚡', name: '연속 착수', cat: '공격',  glow: '#ffb347', color: '#8a5a1c', desc: '이번 턴에 3수까지 둠\n(같은 턴에 둔 돌의 2칸 이내 금지)' },
    bomb:     { icon: '💥', name: '폭파',     cat: '방해',  glow: '#ff5a3a', color: '#8a2a1c', desc: '상대 돌 1개를 제거' },
    teleport: { icon: '✨', name: '순간이동', cat: '무작위', glow: '#6aa8ff', color: '#3d5a8a', desc: '내 돌 1개를\n무작위 빈 칸으로 이동' },
    wall:     { icon: '🧱', name: '장벽',     cat: '지형',  glow: '#b8a58a', color: '#5a4a3a', desc: '빈 칸에 영구 장벽\n아무도 못 두고 줄도 끊김' },
    sixth:    { icon: '👁️', name: '식스센스', cat: '규칙',  glow: '#b36aff', color: '#5a2a6a', desc: '승리 조건이\n영구히 6목으로' },
    reversal: { icon: '☯️', name: '전세 역전', cat: '희귀',  glow: '#ffd24a', endsTurn: true, color: '#b8901c', desc: '판의 흑·백 돌을\n통째로 뒤바꿈' }
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
  scene.background = new THREE.Color(0x07050a);
  scene.fog = new THREE.Fog(0x07050a, 22, 90);

  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  scene.add(camera);
  var CAM_BASE = new THREE.Vector3(0, 15.5, 13.5);
  var CAM_LOOK = new THREE.Vector3(0, 0, 3.2);
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

  // 촛불
  var candle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.5, 20),
    new THREE.MeshStandardMaterial({ color: 0xd9cfae, roughness: 0.8 }));
  candle.position.set(-10.5, 0.15, -4.5); candle.castShadow = true;
  scene.add(candle);
  var flame = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffc66a }));
  flame.scale.set(1, 1.7, 1); flame.position.set(-10.5, 1.1, -4.5);
  scene.add(flame);
  var candleBase = 1.5;
  var candleLight = new THREE.PointLight(0xffa550, 1.5, 55, 1.4);
  candleLight.position.set(-10.5, 1.9, -4.5);
  candleLight.castShadow = true;
  candleLight.shadow.mapSize.set(1024, 1024);
  candleLight.shadow.bias = -0.002;
  scene.add(candleLight);

  var hemi = new THREE.HemisphereLight(0x7a6650, 0x0a0806, 0.45);
  scene.add(hemi);
  var spot = new THREE.SpotLight(0xffe2b0, 0.55, 60, 0.7, 1, 1);
  spot.position.set(0, 15, 6); spot.target.position.set(0, 0, 0);
  spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.002;
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
  var hoverCard = -1;

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

  // 카드 뒤에서 번지는 빛 (카드마다 색이 다름)
  var glowCache = {};
  function glowTexture(color) {
    if (glowCache[color]) return glowCache[color];
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 384;
    var g = cv.getContext('2d');
    g.shadowColor = color; g.shadowBlur = 42; g.fillStyle = color;
    g.fillRect(40, 56, 176, 272);
    g.shadowBlur = 20; g.fillRect(40, 56, 176, 272);
    var t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    return (glowCache[color] = t);
  }
  var glowGeo = new THREE.PlaneGeometry(2.14, 3.2);

  function visibleWidth() {
    return 2 * 6.5 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  }
  function cardTarget(i, n) {
    var spacing = Math.min(1.2, (visibleWidth() * 0.92 - 1.5) / Math.max(1, n - 1));
    var mid = (n - 1) / 2, d = i - mid;
    var sel = (S.mode && S.pendingIdx === i);
    var hov = hoverCard === i;
    var lift = (hov ? 0.85 : 0) + (sel ? 0.7 : 0);
    return {
      x: d * spacing,
      y: -2.2 + lift - Math.abs(d) * 0.02,
      z: (hov || sel ? 0.5 : 0) + i * 0.01,
      rz: -d * 0.035,
      s: hov || sel ? 1.12 : 1,
      tint: hov || sel ? 1.0 : 0.72
    };
  }
  function rebuildHand() {
    cardMeshes.forEach(function (m) { handGroup.remove(m); m.material.dispose(); });
    cardMeshes = [];
    var h = hands[S.turn];
    h.forEach(function (id, i) {
      var m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardTexture(id), transparent: true, alphaTest: 0.02 }));
      m.userData.i = i;
      var gl = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: glowTexture(CARDS[id].glow), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      gl.position.z = -0.004; m.add(gl); m.userData.glow = gl;
      m.position.set(0, -4.2, 0.2); // 아래에서 올라오는 등장 연출
      handGroup.add(m); cardMeshes.push(m);
    });
    hoverCard = -1;
  }
  function stepCards(dt) {
    var k = 1 - Math.pow(0.0006, dt), n = cardMeshes.length;
    cardMeshes.forEach(function (m, i) {
      var t = cardTarget(i, n);
      m.position.x += (t.x - m.position.x) * k;
      m.position.y += (t.y - m.position.y) * k;
      m.position.z += (t.z - m.position.z) * k;
      m.rotation.z += (t.rz - m.rotation.z) * k;
      var s = m.scale.x + (t.s - m.scale.x) * k; m.scale.set(s, s, 1);
      var c = m.material.color.r + (t.tint - m.material.color.r) * k;
      m.material.color.setRGB(c, c, c);
      var gl = m.userData.glow;
      if (gl) gl.material.opacity += ((t.tint > 0.9 ? 0.8 : 0.24) + Math.sin(performance.now() / 420 + i) * 0.05 - gl.material.opacity) * k;
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
    rebuildHand(); updateHUD();
    setMsg(cellName(S.turn) + ' 차례 — 판을 클릭해 돌을 두거나, 카드를 골라보세요');
  }

  function onCell(x, y) {
    if (S.over || busy > 0) return;
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

  /* ---------------- 입력 ---------------- */
  var pointer = new THREE.Vector2(0, 0), raycaster = new THREE.Raycaster();
  var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  var hoverCell = null, hitPoint = new THREE.Vector3();
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
    hoverCell = null;
    if (hoverCard < 0 && raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
      var x = Math.round(hitPoint.x + HALF), y = Math.round(hitPoint.z + HALF);
      if (inb(x, y) && Math.abs(hitPoint.x + HALF - x) < 0.5 && Math.abs(hitPoint.z + HALF - y) < 0.5) hoverCell = [x, y];
    }
    dom.style.cursor = (hoverCard >= 0 || hoverCell) ? 'pointer' : 'default';
  }
  dom.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; setPointer(e); updateHover(); });
  dom.addEventListener('click', function (e) {
    ac(); if (actx && actx.state === 'suspended') actx.resume();
    setPointer(e); updateHover();
    if (hoverCard >= 0) useCard(hoverCard);
    else if (hoverCell) onCell(hoverCell[0], hoverCell[1]);
    // 터치는 '호버'가 없으므로 탭이 끝나면 호버 효과(카드 빛·미리보기)를 지움
    if (e.pointerType === 'touch') { hoverCard = -1; hoverCell = null; }
  });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.mode) cancelMode(); });
  elEnd.addEventListener('click', function () { if (busy === 0) endTurn(); });
  document.getElementById('restart').addEventListener('click', reset);
  document.getElementById('again').addEventListener('click', reset);

  /* ---------------- 맵 (배경 · 판 · 조명 교체) — js/config.js 의 maps ---------------- */
  var defTableTex = table.material.map, defBoardTex = boardPlane.material.map;
  var defCam = { pos: CAM_BASE.clone(), look: CAM_LOOK.clone() };
  var backdrop = null, curMapIdx = 0;
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
      var bg = m.background || '#07050a';
      scene.background.set(bg);
      if (m.fog === null) scene.fog = null;
      else { var F = m.fog || {}; scene.fog = new THREE.Fog(F.color || bg, F.near != null ? F.near : 22, F.far != null ? F.far : 90); }
      // 조명 · 촛불
      hemi.color.set(L.hemiSky || '#7a6650'); hemi.groundColor.set(L.hemiGround || '#0a0806'); hemi.intensity = L.hemi != null ? L.hemi : 0.45;
      spot.color.set(L.spotColor || '#ffe2b0'); spot.intensity = L.spot != null ? L.spot : 0.55; spot.angle = L.spotAngle || 0.7;
      var candleOn = C.visible !== false;
      candle.visible = flame.visible = candleLight.visible = candleOn;
      candleLight.color.set(C.color || '#ffa550'); candleBase = C.intensity != null ? C.intensity : 1.5;
      spot.castShadow = !candleOn;            // 촛불이 없으면 위쪽 조명이 그림자를 만듦
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
    rebuildHand(); updateHUD();
    setMsg('흑 선공 — 판을 클릭해 돌을 두세요. 아래 카드를 눌러 증강을 쓸 수 있어요 (턴당 1장)');
  }

  /* ---------------- 루프 ---------------- */
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h;
    // 세로 화면(모바일): 시야각을 넓히고 카메라를 조금 뒤로 — 판 전체가 폭에 들어오게
    camDist = camera.aspect < 1.5 ? Math.min(1.9, 1.5 / camera.aspect) : 1;
    camera.fov = camera.aspect < 1.2 ? 62 : 45;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  var clock = new THREE.Clock(), time = 0;
  function frame() {
    var dt = Math.min(0.05, clock.getDelta()); time += dt;
    stepAnims(dt); stepParticles(dt); stepCards(dt);

    // 촛불 일렁임
    var fl = 1 + Math.sin(time * 13) * 0.05 + Math.sin(time * 31 + 1.7) * 0.04 + (Math.random() - 0.5) * 0.04;
    candleLight.intensity = candleBase * fl; flame.scale.set(1, 1.7 * fl, 1);
    candleLight.position.x = -10.5 + Math.sin(time * 5) * 0.06;

    // 카메라: 앉은 시점 + 마우스 시차
    var tx = CAM_BASE.x * camDist + mouseN.x * 0.9;
    var ty = CAM_BASE.y * camDist + mouseN.y * 0.5;
    var tz = CAM_BASE.z * camDist;
    camera.position.x += (tx - camera.position.x) * 0.06;
    camera.position.y += (ty - camera.position.y) * 0.06;
    camera.position.z += (tz - camera.position.z) * 0.06;
    camera.lookAt(CAM_LOOK);

    // 고스트 / 링 표시
    ghost.visible = false; ring.visible = false;
    if (!S.over && hoverCell && hoverCard < 0) {
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
  window.__game = { cardCanvas: function (id) { return cardTexture(id).image; }, get S() { return S; }, get board() { return board; }, hands: function () { return hands; }, onCell: onCell, useCard: useCard, endTurn: endTurn, reset: reset, busy: function () { return busy; } };

  resize(); frame();
  buildMapSelect();
  Promise.all([loadCardAssets(), applyMap(getMaps()[curMapIdx])]).then(function () {
    texCache = {}; reset(); showAssetNotice();
  });
})();
