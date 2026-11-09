/* 패(손에 든 카드) — 부채꼴 배치 · 확대 · 쓴 카드 · 불타는 연출 */
'use strict';

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
// onDone: 카드가 다 타서 사라진 뒤에 부르는 함수 — 카드 효과는 연출이 끝난 다음에 적용됨
function startBurn(mesh, moveToCenter, onDone) {
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
  burns.push({ m: mesh, pts: pts, n: n, base: base, vel: vel, delay: delay, off: off, move: moveToCenter, t: 0, ignited: !moveToCenter, done: false, onDone: onDone,
    from: mesh.position.clone(), fromS: mesh.scale.x, fromR: mesh.rotation.z });
  if (!moveToCenter) sfx('burn');          // 바로 발동하는 카드: 시작과 동시에 불이 붙음
  // 날아오는 카드: 가운데에 도착해 불이 붙는 순간(stepBurns)에 타는 소리가 나고, 효과는 다 탄 뒤에 적용됨
}
function stepBurns(dt) {
  for (var bi = burns.length - 1; bi >= 0; bi--) {
    var b = burns[bi]; b.t += dt;
    var mv = b.move ? Math.min(1, b.t / BURN_MOVE) : 1, e = 1 - Math.pow(1 - mv, 3);   // ease-out: 감속하며 도착
    b.m.position.set(b.from.x * (1 - e), b.from.y * (1 - e), b.from.z + (0.9 - b.from.z) * e);   // 화면 가운데로
    var sc = b.fromS + (1.75 - b.fromS) * e; b.m.scale.set(sc, sc, 1); b.m.rotation.z = b.fromR * (1 - e);
    if (!b.ignited && b.t >= b.off) { b.ignited = true; sfx('burn'); }          // 도착 → 점화: 타는 소리
    var bt = Math.max(0, b.t - b.off) / BURN_TIME;
    b.m.material.uniforms.burn.value = Math.min(1, bt);
    if (!b.done && bt >= 1) { b.done = true; if (b.onDone) b.onDone(); }           // 다 탔다 → 이제 카드 효과 적용
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
function burnPlayed(onDone) {
  if (!playedMesh) { if (onDone) onDone(); return; }
  var m = playedMesh; playedMesh = null; startBurn(m, true, onDone);
}
// 바로 발동하는 카드: 확대된 자리(가운데)에서 바로 탐
function burnSnap(snap, onDone) {
  var m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardTexture(snap.id), transparent: true, alphaTest: 0.02 }));
  m.position.set(snap.x, snap.y, 0.9); m.scale.set(snap.s, snap.s, 1); handGroup.add(m);
  startBurn(m, false, onDone);
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
  var sc = 0.95;
  var step = up ? 1.2 : 0.95;                // 카드 사이 간격 (카드 폭 1.43)
  var total = (n - 1) * step + 1.5 * sc, avail = vw * 0.94;       // 좁은 화면(폰)에서는 패 전체가 폭에 들어오게 줄임
  if (total > avail) { var f = avail / total; sc *= f; step *= f; }
  var mid = (n - 1) / 2, d = i - mid, lift = IS_TOUCH ? (camera.aspect < 0.95 ? 0.9 : 0.5) : 0;      // 터치는 마우스 올리기가 없으니 처음부터 카드가 더 보이게
  var y = -vh / 2 + 0.1 + lift + (up ? 1.1 : 0) + (hov ? 0.3 : 0) + (sel ? 0.3 : 0) - d * d * 0.012;
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
  var h = G.hand[viewer()];
  h.forEach(function (id, i) {
    var m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: cardTexture(id), transparent: true, alphaTest: 0.02 }));
    m.userData.i = i;

    m.position.set(0, -4.2, 0.2); // 아래에서 올라오는 등장 연출
    handGroup.add(m); cardMeshes.push(m);
  });
  hoverCard = -1; inspectIdx = -1; inspectLegend = false; hoverLegend = false;
  rebuildLegend();
}
function stepCards(dt) {
  var k = 1 - Math.pow(0.0006, dt), n = cardMeshes.length;
  stepDraft(k); stepLegend(k);
  var op = dimMesh.material.opacity + (((inspectIdx >= 0 || inspectLegend || draftMeshes.length) ? 0.68 : 0) - dimMesh.material.opacity) * k;
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

/* ---------------- 전설 칸: 패와 따로 오른쪽 아래에 놓이는 전설 카드 ---------------- */
// 내 전설 카드는 앞면(눌러서 확대·사용), 상대 전설 카드는 쓰기 전까지 뒷면
var legendMeshes = [], hoverLegend = false, inspectLegend = false;
function rebuildLegend() {
  legendMeshes.forEach(function (o) { handGroup.remove(o.m); o.m.material.dispose(); });
  legendMeshes = [];
  var lg = G.lg, cur = viewer(), opp = Rules.other(cur);
  [cur, opp].forEach(function (p) {
    var id = lg.card[p]; if (!id) return;
    var own = p === cur, face = own || lg.done[p];
    var m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: face ? cardTexture(id) : cardBackTexture(), transparent: true, alphaTest: 0.02 }));
    var vs = viewSize();
    m.position.set(vs.vw / 2 - 0.8, -vs.vh / 2 - 3, 0.2); m.scale.set(own ? 0.6 : 0.42, own ? 0.6 : 0.42, 1);
    m.userData.legendOwn = own; handGroup.add(m);
    legendMeshes.push({ m: m, own: own, done: !!lg.done[p], p: p });
  });
}
function legendSlotTarget(o) {
  var vs = viewSize(), hov = o.own && hoverLegend;
  if (o.own && inspectLegend) return { x: 0, y: 0, z: 0.9, rz: 0, s: 1.75, tint: 1 };            // 자세히 보기: 화면 중앙에 크게
  var portrait = camera.aspect < 0.95, sc = (o.own ? 0.6 : 0.42) * (portrait ? 0.82 : 1), ch = 2.25 * sc;
  var y = o.own ? -vs.vh / 2 + ch / 2 + 0.25 + (hov ? 0.25 : 0) : -vs.vh / 2 + 1.75 + ch / 2;
  if (portrait) y = -vs.vh / 2 + 3.25 + ch / 2 + (hov ? 0.25 : 0);                                // 세로 화면: 패 위쪽에 두어 패와 겹치지 않게 (내 것은 오른쪽, 상대 것은 왼쪽)
  if (topGoal > 0.5) y = -vs.vh / 2 - 3.2;                                                         // 직부감: 패와 함께 숨김
  return { x: portrait && !o.own ? -(vs.vw / 2 - 0.6) : vs.vw / 2 - (portrait ? 0.6 : 0.8), y: y, z: hov ? 0.3 : 0.05, rz: o.own ? -0.04 : 0.05, s: sc * (hov ? 1.08 : 1), tint: o.done ? 0.5 : (o.own ? (hov ? 1 : 0.9) : 0.75) };
}
function stepLegend(k) {
  legendMeshes.forEach(function (o) {
    var t = legendSlotTarget(o), m = o.m;
    m.position.x += (t.x - m.position.x) * k; m.position.y += (t.y - m.position.y) * k; m.position.z += (t.z - m.position.z) * k;
    m.rotation.z += (t.rz - m.rotation.z) * k;
    var sc = m.scale.x + (t.s - m.scale.x) * k; m.scale.set(sc, sc, 1);
    var c = m.material.color.r + (t.tint - m.material.color.r) * k; m.material.color.setRGB(c, c, c);
  });
}
