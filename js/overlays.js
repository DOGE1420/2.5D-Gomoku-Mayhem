/* 보조 화면(HTML) — 알림 · 시작 능력 표시 · 전설 카드 조건 · 무소유 대응 창 · 올인 선택 · 슬롯머신 · 다시 뽑기 */
'use strict';

var elToast = document.getElementById('toast'), toastTimer = null;
function toast(text, ms) {
  elToast.innerHTML = H(text); elToast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { elToast.classList.remove('show'); }, ms || 2600);
}

// 이번 판의 맵 · 라운드 · 자기장, 시작 능력 (왼쪽 위, 마우스를 올리면 설명)
function updateTrait() { document.getElementById('trait').style.display = 'none'; }   // 맵·시작 능력은 왼쪽 위 카드로만 보여 줌 (js/hand.js 의 rebuildInfo)

// 전설 카드를 확대해서 볼 때: 사용 조건과 현재 진행 상황
var elHint = document.getElementById('legendHint');
function showLegendHint() {
  var p = viewer(), id = G.lg.card[p]; if (!id) return;
  var info = Rules.legendProgress(G, p), c = Rules.LEGEND_BY_ID[id];
  elHint.innerHTML = H(info.done ? t('hint.used') : t('hint.cond', { cond: lang === 'en' && LEGEND_COND_EN[c.id] ? LEGEND_COND_EN[c.id] : c.cond, now: lang === 'en' && info.en ? info.en.replace(/^card to copy: (\w+)$/, function (_, id) { return 'card to copy: ' + cardText(id).name; }) : info.text }) + (info.ok ? t('hint.ok') : ''));
  elHint.classList.add('show'); elHint.classList.toggle('ok', !!info.ok && !info.done);
}
function hideLegendHint() { elHint.classList.remove('show'); }

// 🧘 무소유 대응 창: 상대가 카드를 쓰려 할 때 (8초 안에 고르지 않으면 넘김)
var counterTimer = null;
function showCounterBox(holder, user, cardId, cb) {
  var box = document.getElementById('counterBox'), txt = document.getElementById('counterText'), c = Rules.CARD_BY_ID[cardId];
  var left = 8, who = t(holder === 1 ? 'who.black' : 'who.white'), other = t(user === 1 ? 'who.black' : 'who.white');
  function render() { txt.innerHTML = H(t('counter.ask', { who: who, other: other, card: c ? cardText(cardId).name : cardId, s: left })); }
  render(); box.classList.add('show');
  function done(yes) { clearInterval(counterTimer); box.classList.remove('show'); cb(yes); }
  document.getElementById('counterYes').onclick = function () { done(true); };
  document.getElementById('counterNo').onclick = function () { done(false); };
  clearInterval(counterTimer);
  counterTimer = setInterval(function () { left--; if (left <= 0) done(false); else render(); }, 1000);
}

// 🎰 올인: 무엇을 걸지
function askAllin(cb, maxStones) {
  var box = document.getElementById('choiceBox'), acts = document.getElementById('choiceActions');
  document.getElementById('choiceText').innerHTML = H(t('allin.ask'));
  acts.innerHTML = '';
  var opts = [[t('allin.cards', { n: G.hand[viewer()].length }), 'cards']];
  for (var n = 3; n <= Math.min(maxStones || 3, 6); n++) opts.push([t('allin.stones', { n: n }), 'stones:' + n]);
  opts.push([t('allin.cancel'), null]);
  opts.forEach(function (o) {
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
      if (i === 2) { res.innerHTML = H(t(win ? 'allin.win' : 'allin.lose')); res.className = win ? 'win' : 'lose'; sfx(win ? 'win' : 'boom'); setTimeout(function () { box.classList.remove('show'); }, 1400); }
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
