/* 숨겨 둔 카드가 발동할 때(함정 · 봉쇄): 카드가 어둠 속에서 뒤집히며 솟아올라 정체를 드러내고,
 * 불씨와 검은 연기를 내뿜다가 그대로 불타 사라짐 (오두막 분위기에 맞춘 어두운 연출 · 소리는 WebAudio 로 직접 만듦) */
'use strict';

var totems = [], totemParts = [];
var totemPartGeo = new THREE.PlaneGeometry(1, 1);
function totemPop(id) {
  var m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardTexture(id), transparent: true, alphaTest: 0.02, depthTest: false }));
  var back = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardBackTexture(), transparent: true, alphaTest: 0.02, depthTest: false }));
  back.rotation.y = Math.PI; m.add(back);                                        // 처음엔 뒷면이 보이다가 뒤집히며 앞면이 드러남
  m.renderOrder = back.renderOrder = 50; m.position.set(0, -2.4, 0.9); m.scale.set(0.5, 0.5, 1); m.rotation.y = Math.PI;
  handGroup.add(m); totems.push({ m: m, back: back, age: 0, emit: 0, popped: false });
  sfxTotem(); camShake = Math.max(camShake, 0.35);
  var fl = document.getElementById('totemFlash'); if (fl) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
}
// kind 'ember': 빛나는 불씨 (더해지는 빛) · 'smoke': 퍼지며 옅어지는 검은 연기
function addTotemPart(kind, x, y, burstOut) {
  var smoke = kind === 'smoke';
  var mat = new THREE.MeshBasicMaterial({ map: emberTex, transparent: true, depthTest: false, depthWrite: false,
    color: smoke ? 0x0b0705 : (Math.random() < 0.5 ? 0xff7a22 : 0xffb347), blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending });
  var p = new THREE.Mesh(totemPartGeo, mat); p.renderOrder = smoke ? 48 : 51; p.position.set(x, y, smoke ? 0.85 : 0.95);
  var s = smoke ? 0.5 + Math.random() * 0.6 : 0.05 + Math.random() * 0.07; p.scale.set(s, s, 1); handGroup.add(p);
  var a = Math.random() * Math.PI * 2, sp = burstOut ? (smoke ? 0.8 : 1.6) + Math.random() * (smoke ? 0.9 : 2.2) : 0.15 + Math.random() * 0.3;
  totemParts.push({ m: p, smoke: smoke, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 + (smoke ? 0.25 : 0.5), grow: smoke ? 0.9 + Math.random() * 0.8 : 0,
    life: smoke ? 1.4 + Math.random() * 0.9 : 0.9 + Math.random() * 1.1, age: 0, op: smoke ? 0.55 + Math.random() * 0.25 : 1, ph: Math.random() * 6 });
}
function stepTotems(dt) {
  for (var i = totems.length - 1; i >= 0; i--) {
    var o = totems[i], m = o.m, t = (o.age += dt), RISE = 0.55, HOLD = 1.45;
    if (t < RISE) {                                                        // 아래 어둠에서 솟아오르며 한 번 뒤집힘
      var u = t / RISE, e = 1 - Math.pow(1 - u, 3);
      m.position.y = -2.4 + 2.4 * e; var s = 0.5 + 1.25 * e; m.scale.set(s, s, 1); m.rotation.y = Math.PI * (1 - e);
    } else {                                                               // 정체를 드러낸 채 떨림
      m.position.set(Math.sin(t * 37) * 0.012, Math.sin(t * 29) * 0.01, 0.9); m.scale.set(1.75, 1.75, 1); m.rotation.y = 0;
    }
    if (!o.popped && t >= RISE * 0.7) {                                    // 앞면이 드러나는 순간: 불씨와 연기가 확 퍼짐
      o.popped = true;
      for (var k = 0; k < 16; k++) addTotemPart('smoke', (Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 3, true);
      for (k = 0; k < 70; k++) addTotemPart('ember', (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 3.6, true);
    }
    if (o.popped && t < HOLD) {                                            // 가장자리에서 불씨가 계속 피어오름
      o.emit += dt * 40;
      while (o.emit >= 1) { o.emit--; var side = Math.random() < 0.5 ? -1 : 1; addTotemPart('ember', side * (1.25 + Math.random() * 0.2), (Math.random() - 0.5) * 3.8, false); }
    }
    if (t >= HOLD) {                                                       // 그대로 불타 사라짐 (카드 쓰는 연출과 같은 불길)
      m.remove(o.back); o.back.material.dispose(); m.position.set(0, 0, 0.9); m.rotation.set(0, 0, 0);
      totems.splice(i, 1); startBurn(m, false, null);
    }
  }
  for (var j = totemParts.length - 1; j >= 0; j--) {
    var p = totemParts[j]; p.age += dt;
    var damp = Math.pow(p.smoke ? 0.3 : 0.4, dt); p.vx *= damp; p.vy = p.vy * damp + (p.smoke ? 0.15 : 0.5) * dt;   // 퍼졌다가 천천히 위로 떠오름
    p.m.position.x += (p.vx + (p.smoke ? 0 : Math.sin(p.age * 6 + p.ph) * 0.15)) * dt; p.m.position.y += p.vy * dt;
    if (p.smoke) { var g = p.m.scale.x + p.grow * dt; p.m.scale.set(g, g, 1); }
    var f = Math.max(0, 1 - p.age / p.life);
    p.m.material.opacity = p.op * (p.smoke ? f * Math.min(1, p.age * 6) : f * (0.6 + 0.4 * Math.sin(p.age * 20 + p.ph)));
    if (p.age >= p.life) { handGroup.remove(p.m); p.m.material.dispose(); totemParts.splice(j, 1); }
  }
}
// 효과음: 낮게 울리는 쿵 + 거꾸로 빨려 들어가는 듯한 바람 + 불길하게 어긋난 낮은 화음
function sfxTotem() {
  var a = ac(); if (!a) return;
  var now = a.currentTime, dur = 1.6;
  var len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  var src = a.createBufferSource(); src.buffer = buf;
  var bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2;
  bp.frequency.setValueAtTime(180, now); bp.frequency.exponentialRampToValueAtTime(1100, now + 0.4); bp.frequency.exponentialRampToValueAtTime(260, now + dur);
  var g = a.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.55, now + 0.38); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(bp); bp.connect(g); g.connect(a.destination); src.start(now); src.stop(now + dur);
  setTimeout(function () { tone(95, 38, 0.9, 'sine', 0.55); noise(0.35, 0.35, 500); }, 380);          // 뒤집히는 순간 쿵
  [[110, 0.07], [116.5, 0.06], [164.8, 0.05], [174.6, 0.04]].forEach(function (q) {                     // 반음씩 어긋난 낮은 음 (불길함)
    var o = a.createOscillator(), og = a.createGain(), at = now + 0.38; o.type = 'sawtooth'; o.frequency.value = q[0];
    var lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(q[1], at + 0.15); og.gain.exponentialRampToValueAtTime(0.0001, at + 1.8);
    o.connect(lp); lp.connect(og); og.connect(a.destination); o.start(at); o.stop(at + 1.9);
  });
}
