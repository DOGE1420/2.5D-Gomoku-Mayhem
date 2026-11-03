/* 연출 도구 — tween(애니메이션) · 파티클 */
'use strict';

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
  if (reduceMotion) n = Math.ceil(n / 4);
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
