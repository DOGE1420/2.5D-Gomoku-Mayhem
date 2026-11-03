/* 보조 화면(HTML) — 알림 · 시작 능력 표시 · 전설 카드 조건 · 무소유 대응 창 · 올인 선택 · 슬롯머신 · 다시 뽑기 */
'use strict';

var elToast = document.getElementById('toast'), toastTimer = null;
function toast(text, ms) {
  elToast.innerHTML = H(text); elToast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { elToast.classList.remove('show'); }, ms || 2600);
}

// 이번 판의 맵 · 라운드 · 자기장, 시작 능력 (왼쪽 위, 마우스를 올리면 설명)
function updateTrait() {
  var el = document.getElementById('trait'), ab = G.ab[1] && Rules.ABILITY_BY_ID[G.ab[1]], mp = Rules.MAP_BY_ID[G.map];
  var lines = [];
  if (mp) lines.push('<div title="' + mp.desc + ' 자기장: 15라운드부터 5라운드마다 바깥 한 줄씩 닫힘(최대 3줄)">' + '[[' + mp.icon + ']] ' + mp.name + ' · ' + G.round + '라운드' + (G.zone ? ' · [[bolt]]자기장 ' + G.zone + '줄' : '') + '</div>');
  if (ab) lines.push('<div title="' + ab.desc + '">' + H('[[' + ab.icon + ']] ') + ab.name + '</div>');
  el.innerHTML = H(lines.join('')); el.style.display = lines.length ? 'block' : 'none';
}

// 전설 카드를 확대해서 볼 때: 사용 조건과 현재 진행 상황
var elHint = document.getElementById('legendHint');
function showLegendHint() {
  var p = viewer(), id = G.lg.card[p]; if (!id) return;
  var info = Rules.legendProgress(G, p), c = Rules.LEGEND_BY_ID[id];
  elHint.innerHTML = H(info.done ? '이미 사용함' : '조건: ' + c.cond + '  —  현재: ' + info.text + (info.ok ? '  [[check]] 사용 가능' : ''));
  elHint.classList.add('show'); elHint.classList.toggle('ok', !!info.ok && !info.done);
}
function hideLegendHint() { elHint.classList.remove('show'); }

// 🧘 무소유 대응 창: 상대가 카드를 쓰려 할 때 (8초 안에 고르지 않으면 넘김)
var counterTimer = null;
function showCounterBox(holder, user, cardId, cb) {
  var box = document.getElementById('counterBox'), txt = document.getElementById('counterText'), c = Rules.CARD_BY_ID[cardId];
  var left = 8, who = holder === 1 ? '[[black]] 흑' : '[[white]] 백', other = user === 1 ? '[[black]] 흑' : '[[white]] 백';
  function render() { txt.innerHTML = H(who + ' — [[zen]] 무소유! ' + other + '이(가) "' + (c ? c.name : cardId) + '" 카드를 씁니다. 막을까요? (내 패 전부 버림) · ' + left + '초'); }
  render(); box.classList.add('show');
  function done(yes) { clearInterval(counterTimer); box.classList.remove('show'); cb(yes); }
  document.getElementById('counterYes').onclick = function () { done(true); };
  document.getElementById('counterNo').onclick = function () { done(false); };
  clearInterval(counterTimer);
  counterTimer = setInterval(function () { left--; if (left <= 0) done(false); else render(); }, 1000);
}

// 🎰 올인: 무엇을 걸지
function askAllin(cb) {
  var box = document.getElementById('choiceBox'), acts = document.getElementById('choiceActions');
  document.getElementById('choiceText').innerHTML = H('[[slot]] 올인 — 무엇을 거시겠어요? 슬롯 3개가 같으면 2배!');
  acts.innerHTML = '';
  [['패 전부 걸기 (' + G.hand[viewer()].length + '장)', 'cards'], ['내 돌 3개 걸기', 'stones'], ['취소', null]].forEach(function (o) {
    var b = document.createElement('button'); b.className = 'btn'; b.textContent = o[0];
    b.onclick = function () { box.classList.remove('show'); cb(o[1]); };
    acts.appendChild(b);
  });
  box.classList.add('show');
}

// 🎰 슬롯머신: 결과는 정해져 있고, 릴이 돌다 하나씩 멈추는 연출만 보여 줌. 끝날 때까지 걸리는 시간(초)을 돌려줌
var SLOT_FACES = ['cherry', 'lemon', 'bell', 'diamond', 'seven'];
function playSlot(reels, win) {
  var box = document.getElementById('slotBox'), els = box.querySelectorAll('.reel'), res = document.getElementById('slotResult');
  res.textContent = ''; res.className = ''; box.classList.add('show');
  var timers = [].map.call(els, function (el) { el.classList.add('spin'); return setInterval(function () { el.innerHTML = ico(SLOT_FACES[Math.floor(Math.random() * SLOT_FACES.length)]); }, 70); });
  [900, 1400, 1900].forEach(function (ms, i) {
    setTimeout(function () {
      clearInterval(timers[i]); els[i].classList.remove('spin'); els[i].innerHTML = ico(reels[i]); sfx('card');
      if (i === 2) { res.innerHTML = H(win ? '[[party]] 잭팟! 2배로 돌려받아요' : '꽝… 건 것을 잃었어요'); res.className = win ? 'win' : 'lose'; sfx(win ? 'win' : 'boom'); setTimeout(function () { box.classList.remove('show'); }, 1400); }
    }, ms);
  });
  return 3.4;
}

// 카드 뽑기 안내와 🔄 다시 뽑기
function showDraftCaption(text, refresh, onReroll) {
  document.getElementById('draftCapText').textContent = '';           // 안내 문구는 표시하지 않음 (다시 뽑기 버튼만)
  var b = document.getElementById('reroll');
  b.style.display = refresh > 0 ? 'inline-block' : 'none'; b.innerHTML = H(t('reroll', { n: refresh }));
  b.onclick = onReroll;
  document.getElementById('draftCap').classList.add('show');
}
function hideDraftCaption() { document.getElementById('draftCap').classList.remove('show'); }
