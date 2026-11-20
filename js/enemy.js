/* 캠페인 상대: 맞은편에 선 로봇 (assets/models/robot.glb — Quaternius "Animated Robot", CC0)
 * 원래 노란 장난감 색을 오두막 분위기에 맞게 녹슨 쇳빛으로 바꾸고, 눈만 상대마다 다른 색으로 은은하게 빛나게 함.
 * 평소엔 숨쉬듯 서 있다가(Idle) 상황마다 동작: 인사 · 끄덕임 · 고개 젓기 · 주먹 · 춤 · 쓰러짐 */
'use strict';

var ENEMY_EYES = [0xffb347, 0xb070ff, 0x5ad0ff, 0xff5a2a, 0xffd24a, 0xff2a3a];   // 캠페인 상대 순서대로 눈 색
var enemy = { focusUntil: 0, root: null, mixer: null, actions: {}, cur: null, eyeMat: null, eyeLight: null, want: false, stage: 0, down: false, queue: null };
(function loadEnemy() {
  if (!THREE.GLTFLoader) return;
  var file = 'assets/models/robot.glb';
  if (location.protocol === 'file:') file = 'https://raw.githubusercontent.com/DOGE1420/2.5D-Gomoku-Mayhem/main/' + file;
  new THREE.GLTFLoader().load(file, function (gltf) {
    var root = gltf.scene, holder = new THREE.Group();
    var body = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.55, metalness: 0.65, skinning: true });     // 녹슨 쇠
    var trim = new THREE.MeshStandardMaterial({ color: 0x23201c, roughness: 0.7, metalness: 0.5, skinning: true });       // 검게 그을린 금속
    var eye = new THREE.MeshStandardMaterial({ color: 0x050403, emissive: ENEMY_EYES[0], emissiveIntensity: 0.4, roughness: 0.3, skinning: true });
    root.traverse(function (m) {
      if (!m.isMesh) return;
      var swap = function (x) { var n = (x && x.name) || ''; return n === 'Main' ? body : n === 'Black' ? eye : trim; };
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    });
    var box = new THREE.Box3().setFromObject(root), h = box.max.y - box.min.y;
    holder.add(root); holder.scale.setScalar(19 / h);                // 키 19. 책상 뒤에 서서 가슴부터 위가 책상 위로 보이게 (아래는 책상에 가려짐)
    holder.position.set(0, -11, -20.5);
    holder.visible = false; scene.add(holder);
    var light = new THREE.PointLight(ENEMY_EYES[0], 0.8, 14, 2);       // 눈빛이 얼굴 앞과 판을 살짝 비춤
    light.position.set(0, box.min.y + h * 0.78, h * 0.4); holder.add(light);
    enemy.root = holder; enemy.eyeMat = eye; enemy.eyeLight = light;
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
  enemy.want = true; enemy.stage = stage || 0; enemy.down = false;
  if (!enemy.root) return;
  var c = ENEMY_EYES[enemy.stage % ENEMY_EYES.length];
  enemy.eyeMat.emissive.setHex(c); enemy.eyeLight.color.setHex(c);
  enemy.root.visible = true; if (!quiet) enemyPlay('Wave', true); else if (!enemy.cur || enemy.cur === enemy.actions.Death || enemy.cur === enemy.actions.Dance) enemyPlay('Idle');
}
function enemyHide() { enemy.want = false; if (enemy.root) enemy.root.visible = false; }
// 게임 이벤트에 따른 동작 (board3d.js 의 handleEvent 에서 부름)
function enemyReact(e) {
  if (!enemy.root || !enemy.root.visible || enemy.down) return;
  switch (e.t) {
    case 'place': if (e.p === botColor && Math.random() < 0.3) enemyPlay('Yes', true); break;              // 가끔 끄덕임
    case 'spend': enemyPlay(e.p === botColor ? 'Punch' : 'No', true);
      if (e.p === botColor && HIDDEN_CARDS.indexOf(e.id) < 0) enemy.focusUntil = performance.now() + 2600;   // 로봇이 카드를 쓰면 화면이 물러나 로봇이 보이게
      break;                                  // 카드: 내가 쓰면 주먹, 상대가 쓰면 고개 젓기
    case 'trapHit': case 'blocked': if (e.owner === botColor || (e.t === 'blocked' && e.p !== botColor)) enemyPlay('ThumbsUp', true); break;
    case 'win': case 'resign': {
      var w = e.t === 'win' ? e.p : e.winner;
      if (w === botColor) enemyPlay('Dance'); else { enemy.down = true; enemyPlay('Death', true); }           // 지면 쓰러진 채로
      break;
    }
  }
}
function stepEnemy(dt) {
  if (!enemy.mixer) return;
  var on = enemy.want && curScreen === 'game' && gameMode === 'campaign';
  enemy.root.visible = on;
  if (on) {
    enemy.mixer.update(dt);
    enemy.eyeMat.emissiveIntensity = 0.38 + Math.sin(time * 2.1) * 0.1;                                   // 눈빛이 천천히 맥박치듯
  }
}
