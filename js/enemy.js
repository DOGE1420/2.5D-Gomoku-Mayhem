/* 캠페인 상대: 맞은편에 선 로봇 (assets/models/robot.glb — Quaternius "Animated Robot", CC0)
 * 원래 노란 장난감 색을 오두막 분위기에 맞게 녹슨 쇳빛으로 바꾸고, 눈만 상대마다 다른 색으로 은은하게 빛나게 함.
 * 평소엔 숨쉬듯 서 있다가(Idle) 상황마다 동작: 인사 · 끄덕임 · 고개 젓기 · 주먹 · 춤 · 쓰러짐 */
'use strict';

var ENEMY_Y = -6.8, ENEMY_FALL_Y = -2.2;   // 서 있을 때 높이 · 쓰러졌을 때 높이 (누운 몸이 책상 너머로 보이게)
var ENEMY_EYES = [0xffb347, 0xb070ff, 0x5ad0ff, 0xff5a2a, 0xffd24a, 0xff2a3a];   // 캠페인 상대 순서대로 눈 색
var enemy = { eyeMats: [], bones: {}, gest: null, focusUntil: 0, root: null, mixer: null, actions: {}, cur: null, eyeMat: null, eyeLight: null, want: false, stage: 0, down: false, queue: null };
(function loadEnemy() {
  if (!THREE.GLTFLoader) return;
  var file = 'assets/models/robot.glb';
  if (location.protocol === 'file:') file = 'https://raw.githubusercontent.com/DOGE1420/2.5D-Gomoku-Mayhem/main/' + file;
  new THREE.GLTFLoader().load(file, function (gltf) {
    var root = gltf.scene, holder = new THREE.Group();
    var body = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.55, metalness: 0.65, skinning: true });     // 녹슨 쇠
    var trim = new THREE.MeshStandardMaterial({ color: 0x23201c, roughness: 0.7, metalness: 0.5, skinning: true });       // 검게 그을린 금속
    var eye = new THREE.MeshStandardMaterial({ color: 0x050403, emissive: ENEMY_EYES[0], emissiveIntensity: 0.4, roughness: 0.3, skinning: true });
    enemy.eyeMats.push(eye);
    root.traverse(function (m) {
      if (!m.isMesh) return;
      // 뼈대로 움직이는 메시(SkinnedMesh)와 뼈에 그대로 붙은 메시가 섞여 있음 → skinning 설정을 메시마다 맞춤 (안 맞으면 팔이 처음 자세로 굳음)
      var sk = !!m.isSkinnedMesh, pick = function (base) { if (base.skinning === sk) return base; var k = sk ? 'sk' : 'rg'; if (!base[k]) { base[k] = base.clone(); base[k].skinning = sk; if (base === eye) enemy.eyeMats.push(base[k]); } return base[k]; };
      var swap = function (x) { var n = (x && x.name) || ''; return pick(n === 'Main' ? body : n === 'Black' ? eye : trim); };
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    });
    var box = new THREE.Box3().setFromObject(root), h = box.max.y - box.min.y;
    holder.add(root); holder.scale.setScalar(19 / h);                // 키 19. 책상 뒤에 서서 가슴부터 위가 책상 위로 보이게 (아래는 책상에 가려짐)
    holder.position.set(0, ENEMY_Y, -20.5);
    holder.visible = false; scene.add(holder);
    var light = new THREE.PointLight(ENEMY_EYES[0], 0.8, 14, 2);       // 눈빛이 얼굴 앞과 판을 살짝 비춤
    light.position.set(0, box.min.y + h * 0.78, h * 0.4); holder.add(light);
    enemy.root = holder; enemy.eyeMat = eye; enemy.eyeLight = light;
    ['UpperArmR', 'UpperArmL', 'LowerArmR', 'LowerArmL'].forEach(function (n) { var b = root.getObjectByName(n); if (b) enemy.bones[n] = { b: b, q: b.quaternion.clone() }; });
    enemy.mixer = new THREE.AnimationMixer(root);
    gltf.animations.forEach(function (a) { enemy.actions[a.name.replace(/^.*\|Robot_/, '')] = enemy.mixer.clipAction(a); });
    enemy.mixer.addEventListener('finished', function () { if (!enemy.down) enemyPlay('Idle'); });
    enemyPlay('Idle');
    if (enemy.want) enemyShow(enemy.stage);
  }, undefined, function () { /* 불러오기 실패: 상대 없이 진행 */ });
})();
function enemyPlay(name, once) {
  var a = enemy.actions[name]; if (!a) return;
  if (enemy.cur && enemy.cur !== a) enemy.cur.fadeOut(0.25);
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!once;
  a.fadeIn(0.25).play(); enemy.cur = a;
}
function enemyShow(stage, quiet) {
  enemy.want = true; enemy.stage = stage || 0; enemy.down = false; enemy.fall = -1; enemy.gest = null;
  if (enemy.root) enemy.root.position.y = ENEMY_Y;
  if (!enemy.root) return;
  var c = ENEMY_EYES[enemy.stage % ENEMY_EYES.length];
  enemy.eyeMats.forEach(function (em) { em.emissive.setHex(c); }); enemy.eyeLight.color.setHex(c);
  enemy.root.visible = true; if (!quiet) enemyPlay('Wave', true); else if (!enemy.cur || enemy.cur === enemy.actions.Death || enemy.cur === enemy.actions.Dance) enemyPlay('Idle');
}
function enemyHide() { enemy.want = false; if (enemy.root) enemy.root.visible = false; }
// 게임 이벤트에 따른 동작 (board3d.js 의 handleEvent 에서 부름)
function enemyReact(e) {
  if (!enemy.root || !enemy.root.visible || enemy.down) return;
  switch (e.t) {
    case 'place': if (e.p === botColor) enemyGesture('reach'); else if (Math.random() < 0.25) enemyPlay('No', true); break;   // 돌을 둘 땐 팔을 뻗어 놓는 동작
    case 'spend': if (e.p === botColor) enemyGesture('tear'); else enemyPlay('No', true);   // 카드를 쓸 땐 두 손으로 찢는 동작
      if (e.p === botColor && HIDDEN_CARDS.indexOf(e.id) < 0) enemy.focusUntil = performance.now() + 2600;   // 로봇이 카드를 쓰면 화면이 물러나 로봇이 보이게
      break;                                  // 카드: 내가 쓰면 주먹, 상대가 쓰면 고개 젓기
    case 'trapHit': case 'blocked': if (e.owner === botColor || (e.t === 'blocked' && e.p !== botColor)) enemyPlay('ThumbsUp', true); break;
    case 'win': case 'resign': {
      var w = e.t === 'win' ? e.p : e.winner;
      if (w === botColor) enemyPlay('Dance'); else { enemy.down = true; enemy.gest = null; enemyPlay('Death', true); enemy.fall = 0; }   // 지면 쓰러진 채로 (책상 뒤로 사라지지 않게 몸을 들어 올림)
      break;
    }
  }
}
function stepEnemy(dt) {
  if (!enemy.mixer) return;
  var on = enemy.want && curScreen === 'game' && gameMode === 'campaign';
  enemy.root.visible = on;
  if (on) {
    Object.keys(enemy.bones).forEach(function (k) { var o = enemy.bones[k]; o.b.quaternion.copy(o.q); });   // 지난 프레임에 더한 팔 동작을 되돌린 뒤 애니메이션을 진행
    enemy.mixer.update(dt);
    Object.keys(enemy.bones).forEach(function (k) { var o = enemy.bones[k]; o.q.copy(o.b.quaternion); });
    enemyArms(dt);
    if (enemy.fall >= 0 && enemy.fall < 1) { enemy.fall = Math.min(1, enemy.fall + dt / 0.9); var fe = 1 - Math.pow(1 - enemy.fall, 2); enemy.root.position.y = ENEMY_Y + (ENEMY_FALL_Y - ENEMY_Y) * fe; }
    var ei = 0.38 + Math.sin(time * 2.1) * 0.1; enemy.eyeMats.forEach(function (em) { em.emissiveIntensity = ei; });                                   // 눈빛이 천천히 맥박치듯
  }
}

/* ---------------- 팔 동작 (애니메이션 위에 코드로 더함) ----------------
 * 'reach': 오른팔을 판 쪽으로 뻗어 돌을 놓고 거둠 · 'tear': 두 손을 가슴 앞에 모았다가 양쪽으로 확 찢음
 * 평소에도 팔을 조금씩 흔들어 가만히 굳어 있지 않게 함. (축: 오른팔 앞=+Z, 왼팔 앞=-Z, 양팔 벌림=+X, 팔꿈치 굽힘=+X) */
var AX = { X: new THREE.Vector3(1, 0, 0), Z: new THREE.Vector3(0, 0, 1) };
function enemyGesture(type) { if (enemy.down) return; enemy.gest = { type: type, t: 0, dur: type === 'tear' ? 1.5 : 1.0, seed: Math.random() * 6 }; }
function bend(name, axis, a) { var o = enemy.bones[name]; if (o && a) o.b.rotateOnAxis(AX[axis], a); }
function bump(t, a, b) { return t <= a ? 0 : t >= b ? 0 : Math.sin((t - a) / (b - a) * Math.PI); }   // a~b 사이에서 0→1→0
function ease(t, a, b) { return t <= a ? 0 : t >= b ? 1 : 0.5 - 0.5 * Math.cos((t - a) / (b - a) * Math.PI); }
function enemyArms(dt) {
  if (enemy.down) return;
  var tt = time, sw = Math.sin(tt * 1.7), sw2 = Math.sin(tt * 1.3 + 1.1);
  // 평소: 숨쉬듯 팔이 살짝 흔들리고 팔꿈치가 조금 굽어 있음
  bend('UpperArmR', 'Z', 0.12 + sw * 0.07); bend('UpperArmL', 'Z', -0.12 - sw2 * 0.07);
  bend('LowerArmR', 'X', 0.35 + sw2 * 0.1); bend('LowerArmL', 'X', 0.35 + sw * 0.1);
  var g = enemy.gest; if (!g) return;
  g.t += dt; if (enemy.hold != null) g.t = enemy.hold * g.dur;      // hold: 테스트용으로 동작의 한 순간에 멈춤
  var u = g.t / g.dur;
  if (u >= 1) { enemy.gest = null; return; }
  if (g.type === 'reach') {                                         // 팔을 앞으로 뻗음 → 콕 놓음 → 거둠
    var out = ease(u, 0, 0.35) * (1 - ease(u, 0.65, 1)), tap = bump(u, 0.38, 0.6);
    bend('UpperArmR', 'Z', out * 0.95 - tap * 0.25); bend('LowerArmR', 'X', -out * 0.35 + tap * 0.3);
    bend('UpperArmL', 'Z', -out * 0.2);
  } else {                                                          // 찢기: 모음 → 힘줌(떨림) → 확 벌림 → 거둠
    var lift = ease(u, 0, 0.25) * (1 - ease(u, 0.8, 1)), rip = ease(u, 0.45, 0.55) * (1 - ease(u, 0.8, 1));
    var shake = bump(u, 0.25, 0.47) * Math.sin(g.t * 70 + g.seed) * 0.08;
    bend('UpperArmR', 'Z', lift * 1.1 + shake); bend('UpperArmL', 'Z', -lift * 1.1 - shake);
    bend('LowerArmR', 'X', lift * 0.9 * (1 - rip * 0.6)); bend('LowerArmL', 'X', lift * 0.9 * (1 - rip * 0.6));
    bend('UpperArmR', 'X', rip * 0.9); bend('UpperArmL', 'X', rip * 0.9);
  }
}
