/* 카드별 큰 연출 — 운석이 실제로 떨어지고, 지진은 판이 흔들리고, 폭파는 터지고, 저격은 총알이 날아오는 식
 * handleEvent(js/board3d.js)에서 부르고, 돌려주는 값(초)만큼 다음 이벤트를 기다림 */
'use strict';

var fxGroup = new THREE.Group(); scene.add(fxGroup);
var fxLive = [];                                                     // 매 프레임 갱신할 짧은 효과 { t, dur, fn, done }
function fxAdd(dur, fn, done) { fxLive.push({ t: 0, dur: dur, fn: fn, done: done }); }
function stepCardFx(dt) {
  for (var i = fxLive.length - 1; i >= 0; i--) {
    var f = fxLive[i]; f.t += dt; var u = Math.min(1, f.t / f.dur);
    f.fn(u, dt); if (u >= 1) { fxLive.splice(i, 1); if (f.done) f.done(); }
  }
}
// 번쩍이는 불빛 (터지는 순간 주변을 밝힘)
function fxFlash(pos, color, power, dur) {
  var l = new THREE.PointLight(color, power, 26, 2); l.position.copy(pos).setY(pos.y + 1.2); fxGroup.add(l);
  fxAdd(dur || 0.6, function (u) { l.intensity = power * Math.pow(1 - u, 2); }, function () { fxGroup.remove(l); });
}
// 판 위로 퍼지는 충격파 고리
function fxRing(pos, color, maxR, dur, y) {
  var m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: color, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, y || 0.08, pos.z); fxGroup.add(m);
  fxAdd(dur || 0.7, function (u) { var s = 0.2 + maxR * (1 - Math.pow(1 - u, 3)); m.scale.set(s, s, 1); m.material.opacity = 0.9 * (1 - u); },
    function () { fxGroup.remove(m); m.geometry.dispose(); m.material.dispose(); });
}
// 그을린 자국 (천천히 사라짐)
function fxScorch(pos, r) {
  var m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ map: emberTex, color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.012, pos.z); fxGroup.add(m);
  fxAdd(4, function (u) { m.material.opacity = 0.85 * (1 - u * u); }, function () { fxGroup.remove(m); m.geometry.dispose(); m.material.dispose(); });
}
// 연기 (검은 덩어리가 부풀며 올라감)
function fxSmoke(pos, n, color) {
  for (var i = 0; i < n; i++) (function () {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emberTex, color: color || 0x1a1410, transparent: true, opacity: 0.7, depthWrite: false }));
    var vx = (Math.random() - 0.5) * 1.6, vz = (Math.random() - 0.5) * 1.6, vy = 1 + Math.random() * 1.4, s0 = 0.8 + Math.random() * 0.8;
    s.position.set(pos.x, 0.4, pos.z); fxGroup.add(s);
    fxAdd(1.4 + Math.random() * 0.8, function (u, dt) { s.position.x += vx * dt; s.position.z += vz * dt; s.position.y += vy * dt * (1 - u); var k = s0 * (1 + u * 2.2); s.scale.set(k, k, 1); s.material.opacity = 0.7 * (1 - u); },
      function () { fxGroup.remove(s); s.material.dispose(); });
  })();
}

/* ---------------- 운석: 하늘에서 불타는 바위가 비스듬히 떨어져 돌을 박살냄 ---------------- */
function fxMeteor(r, c, onHit) {
  var q = cellAt(r, c), from = new THREE.Vector3(q.x - 7, 16, q.z - 9);
  var rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: 0x3a2418, emissive: 0xff5a10, emissiveIntensity: 1.4, roughness: 0.8, flatShading: true }));
  var glow = new THREE.PointLight(0xff7a2a, 2.2, 18, 2); rock.add(glow); rock.position.copy(from); fxGroup.add(rock);
  sfxWhoosh(0.75);
  fxAdd(0.75, function (u) {
    var e = u * u; rock.position.lerpVectors(from, new THREE.Vector3(q.x, 0.3, q.z), e); rock.rotation.x += 0.3; rock.rotation.z += 0.2;
    if (Math.random() < 0.9) burst(rock.position.clone(), Math.random() < 0.5 ? 0xff8a2a : 0xffd070, 2);       // 불꼬리
  }, function () {
    fxGroup.remove(rock); rock.geometry.dispose(); rock.material.dispose();
    if (onHit) onHit();
    burst(new THREE.Vector3(q.x, 0.3, q.z), 0xff7a2a, 34); burst(new THREE.Vector3(q.x, 0.3, q.z), 0x5a3a2a, 18);
    fxFlash(q, 0xff8a3a, 6, 0.8); fxRing(q, 0xffa050, 3.2, 0.7); fxSmoke(q, 8); fxScorch(q, 1.1);
    camShake = Math.max(camShake, 0.9); sfx('boom'); tone(70, 30, 0.9, 'sine', 0.5);
  });
  return 1.2;
}
/* ---------------- 폭파: 심지가 타들어가다 터짐 ---------------- */
function fxBomb(r, c, onHit) {
  var q = cellAt(r, c);
  for (var i = 0; i < 6; i++) setTimeout(function () { burst(new THREE.Vector3(q.x, 0.55, q.z), 0xffe08a, 2); }, i * 60);   // 치지직 불똥
  tone(1800, 900, 0.35, 'square', 0.03);
  fxAdd(0.4, function () {}, function () {
    if (onHit) onHit();
    burst(new THREE.Vector3(q.x, 0.3, q.z), 0xff8a2a, 30); burst(new THREE.Vector3(q.x, 0.3, q.z), 0xffe08a, 12);
    fxFlash(q, 0xffa040, 5, 0.6); fxRing(q, 0xffc070, 2.4, 0.5); fxSmoke(q, 6); fxScorch(q, 0.8);
    camShake = Math.max(camShake, 0.6); sfx('boom');
  });
  return 0.95;
}
/* ---------------- 저격: 맞은편 어둠에서 총알이 날아와 꽂힘 ---------------- */
function fxSnipe(r, c, onHit) {
  var q = cellAt(r, c), from = new THREE.Vector3((Math.random() - 0.5) * 8, 4.5, -19);
  var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, from.clone()]), new THREE.LineBasicMaterial({ color: 0xffe0b0, transparent: true, blending: THREE.AdditiveBlending }));
  fxGroup.add(line); fxFlash(from, 0xffd080, 3, 0.25);
  tone(2400, 120, 0.12, 'sawtooth', 0.12); noise(0.08, 0.3, 4000);
  var to = new THREE.Vector3(q.x, 0.25, q.z);
  fxAdd(0.12, function (u) { var p2 = line.geometry.attributes.position; var h = from.clone().lerp(to, u); p2.setXYZ(1, h.x, h.y, h.z); p2.needsUpdate = true; }, function () {
    if (onHit) onHit(); burst(to, 0xff4a3a, 12); fxRing(q, 0xff6a4a, 1.2, 0.35);
    fxAdd(0.35, function (u) { line.material.opacity = 1 - u; }, function () { fxGroup.remove(line); line.geometry.dispose(); line.material.dispose(); });
  });
  return 0.45;
}
/* ---------------- 지진: 판 전체가 흔들리고 돌이 들썩인 뒤 흩어짐 ---------------- */
function fxQuake(then) {
  var objs = [boardPlane, slab, markerGroup], base = objs.map(function (o) { return o.position.clone(); });
  var stones = []; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) { var m = meshes[r][c]; if (m && m.userData.kind === 'stone') stones.push({ m: m, y: m.position.y, ph: Math.random() * 6 }); }
  tone(48, 30, 1.4, 'sawtooth', 0.25); noise(1.2, 0.5, 300);
  fxAdd(1.0, function (u) {
    var a = Math.sin(u * Math.PI) * 0.22, t2 = u * 60;
    objs.forEach(function (o, i) { o.position.set(base[i].x + Math.sin(t2 * 1.7) * a, base[i].y + Math.abs(Math.sin(t2 * 2.3)) * a * 0.3, base[i].z + Math.cos(t2 * 1.3) * a); });
    stones.forEach(function (s) { s.m.position.y = s.y + Math.max(0, Math.sin(t2 * 1.1 + s.ph)) * a * 1.6; });
    camShake = Math.max(camShake, 0.5 * Math.sin(u * Math.PI));
    if (Math.random() < 0.5) burst(new THREE.Vector3((Math.random() - 0.5) * 15, 0.1, (Math.random() - 0.5) * 15), 0x8a7050, 2);   // 먼지
  }, function () {
    objs.forEach(function (o, i) { o.position.copy(base[i]); }); stones.forEach(function (s) { s.m.position.y = s.y; });
    then();
  });
  return 1.75;
}
/* ---------------- 전세 역전: 가운데서 바깥으로 물결치듯 차례로 뒤집힘 ---------------- */
function fxReversal(cells) {
  fxRing(new THREE.Vector3(0, 0, 0), 0xffd27a, 11, 1.2); fxFlash(new THREE.Vector3(0, 0, 0), 0xffd27a, 3, 1);
  var maxD = 0;
  cells.forEach(function (q) {
    var m = meshes[q.r][q.c]; if (!m) return;
    var p = cellAt(q.r, q.c), d = Math.hypot(p.x, p.z) * 0.07; maxD = Math.max(maxD, d);
    var to = m.userData.color === BLACK ? WHITE : BLACK, y0 = m.position.y, done = false;
    fxAdd(d + 0.5, function (u, dt) {
      var lt = u * (d + 0.5) - d; if (lt < 0) return; var k = Math.min(1, lt / 0.5);
      m.position.y = y0 + Math.sin(k * Math.PI) * 0.7; m.rotation.x = k * Math.PI;
      if (k >= 0.5 && !done) { done = true; m.userData.color = to; m.material = to === BLACK ? matBlack : matWhite; }
    }, function () { m.position.y = y0; m.rotation.x = 0; m.userData.color = to; m.material = to === BLACK ? matBlack : matWhite; });
  });
  sfx('magic'); tone(220, 880, 1.0, 'triangle', 0.08);
  return maxD + 0.7;
}
/* ---------------- 순간이동: 소용돌이치며 사라졌다가 다른 곳에서 나타남 ---------------- */
function fxTeleport(m, from, to) {
  var a = cellAt(from.r, from.c), b = cellAt(to.r, to.c), s0 = m.scale.clone();
  burst(a, 0x9ad0ff, 14); fxRing(a, 0x7ac0ff, 1.4, 0.4); sfx('magic');
  fxAdd(0.35, function (u) { m.scale.set(s0.x * (1 - u), s0.y * (1 + u * 3), s0.z * (1 - u)); m.rotation.y += 0.5; }, function () {
    m.position.copy(b); burst(b, 0x9ad0ff, 14); fxRing(b, 0x7ac0ff, 1.4, 0.4); fxFlash(b, 0x7ac0ff, 2.5, 0.4);
    fxAdd(0.3, function (u) { m.scale.set(s0.x * u, s0.y * (1 + (1 - u) * 3), s0.z * u); }, function () { m.scale.copy(s0); m.rotation.y = 0; });
  });
  return 0.75;
}
// 휙 바람 소리 (운석이 떨어질 때)
function sfxWhoosh(dur) {
  var a = ac(); if (!a) return;
  var len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (i / len);
  var s = a.createBufferSource(); s.buffer = buf;
  var f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(400, a.currentTime); f.frequency.exponentialRampToValueAtTime(2200, a.currentTime + dur);
  var g = a.createGain(); g.gain.value = 0.35; s.connect(f); f.connect(g); g.connect(a.destination); s.start();
}
