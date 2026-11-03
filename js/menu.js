/* 메인 화면 — 모드 선택 · 설정(움직임 줄이기, 배경 음악) · 언어 · 멀티플레이 로비 · 화면 전환
 * 화면: 'menu'(메인) → 'game'(게임) / 'lobby'(멀티플레이 방). 게임 화면에서만 판 입력을 받음.
 * 봇전·온라인 연결은 아직 없음 (버튼과 화면만).
 */
'use strict';

var curScreen = 'menu', gameMode = 'local';   // gameMode: 'local' | 'tutorial'
function $(id) { return document.getElementById(id); }

/* ---------------- 화면 전환 ---------------- */
function showScreen(name) {
  curScreen = name;
  $('menu').classList.toggle('show', name === 'menu');
  $('lobby').classList.toggle('show', name === 'lobby');
  $('side').classList.toggle('show', name === 'side');
  $('level').classList.toggle('show', name === 'level');
  document.body.classList.toggle('in-game', name === 'game');
  $('tutBox').classList.toggle('show', name === 'game' && !!tut);
  syncBgm();
}

/* ---------------- 번역 ---------------- */
function applyStaticI18n() {
  document.documentElement.lang = lang; document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach(function (el) { el.innerHTML = H(t(el.dataset.i18n)); });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.dataset.i18nPh); });
  $('langBtn').textContent = t('lang.toggle'); $('langBtn').setAttribute('aria-label', t('lang.aria'));
  $('bgmMute').setAttribute('aria-label', t('settings.bgmMute'));
  renderLevelButtons(); applyIcons(); setTopView(topGoal > 0.5, true);      // 판 보기 / 카드 보기 버튼
  if (menuNoteKey) $('menuNote').textContent = t(menuNoteKey);
  if (lobbyNoteKey) $('lobbyStatus').textContent = t(lobbyNoteKey);
  if (typeof updateHUD === 'function' && G) updateHUD();
  if (tut) tutShow(tut.k, tut.b);
}
$('langBtn').addEventListener('click', function () {
  lang = lang === 'ko' ? 'en' : 'ko';
  try { localStorage.setItem('omok_lang', lang); } catch (e) {}
  applyStaticI18n();
});

/* ---------------- 설정: 움직임 줄이기 · 배경 음악 ---------------- */
$('settingsBtn').addEventListener('click', function (e) { e.stopPropagation(); $('settingsPanel').classList.toggle('show'); });
$('settingsPanel').addEventListener('click', function (e) { e.stopPropagation(); });
document.addEventListener('click', function () { $('settingsPanel').classList.remove('show'); });
var bgm = $('bgm'), bgmVol = 40, bgmMuted = false;
try { var sv = localStorage.getItem('omok_bgm_vol'); if (sv !== null) bgmVol = Math.max(0, Math.min(100, parseInt(sv, 10) || 0)); bgmMuted = localStorage.getItem('omok_bgm_muted') === '1'; } catch (e) {}
function renderBgmUi() {
  $('bgmVolume').value = bgmVol; $('volValue').textContent = bgmVol + '%';
  $('bgmMute').innerHTML = ico((bgmMuted || bgmVol === 0) ? 'mute' : 'volume');
  bgm.volume = bgmMuted ? 0 : bgmVol / 100;
}
$('bgmVolume').addEventListener('input', function () {
  bgmVol = parseInt(this.value, 10); if (bgmVol > 0) bgmMuted = false;
  try { localStorage.setItem('omok_bgm_vol', String(bgmVol)); localStorage.setItem('omok_bgm_muted', bgmMuted ? '1' : '0'); } catch (e) {}
  renderBgmUi(); syncBgm();
});
$('bgmMute').addEventListener('click', function () {
  bgmMuted = !bgmMuted;
  try { localStorage.setItem('omok_bgm_muted', bgmMuted ? '1' : '0'); } catch (e) {}
  renderBgmUi(); syncBgm();
});
// 메뉴·로비는 메뉴 곡, 게임은 판마다 무작위 게임 곡 1곡. 브라우저 정책상 첫 클릭 뒤에 재생이 시작될 수 있음
var userGesture = false;
var BGM_MENU = 'assets/audio/bgm-menu.mp3', BGM_GAME = ['assets/audio/bgm-keycard.mp3', 'assets/audio/bgm-climax.mp3'], bgmTrack = BGM_MENU;
function setBgmTrack(src, restart) {              // 곡이 바뀌거나 restart 면 처음부터
  if (bgmTrack === src && !restart && bgm.getAttribute('src')) return;
  bgmTrack = src; bgm.setAttribute('src', src); bgm.currentTime = 0;
}
function bgmNewGame() { setBgmTrack(BGM_GAME[Math.floor(Math.random() * BGM_GAME.length)], true); }   // 판마다 게임 곡 중 무작위 1곡
function syncBgm() {
  var game = curScreen === 'game';
  if (!game && BGM_GAME.indexOf(bgmTrack) >= 0) setBgmTrack(BGM_MENU, true);    // 메인으로 돌아오면 처음부터
  var want = !bgmMuted && bgmVol > 0;
  if (want) { var p = bgm.play(); if (p && p.catch) p.catch(function () {}); } else bgm.pause();
}
// 로드 즉시 재생을 시도하고, 브라우저가 막으면 첫 클릭·키 입력 때 바로 재생
bgm.addEventListener('canplay', syncBgm); bgm.addEventListener('pause', function () { if (!userGesture && (curScreen === 'menu' || curScreen === 'lobby')) retry = true; });
var retry = false;
window.addEventListener('pointerdown', function () { if (!userGesture) { userGesture = true; syncBgm(); } }, true);
window.addEventListener('keydown', function () { if (!userGesture) { userGesture = true; syncBgm(); } }, true);
renderBgmUi(); syncBgm();

/* ---------------- 메인 화면 버튼 ---------------- */
var menuNoteKey = null, lobbyNoteKey = null;
function setMenuNote(key) { menuNoteKey = key; $('menuNote').textContent = key ? t(key) : ''; }
function setLobbyNote(key) { lobbyNoteKey = key; $('lobbyStatus').textContent = key ? t(key) : ''; }
function endGameScreens() {                      // 진행 중이던 게임 화면 요소를 모두 정리
  endTutorial(); hideLegendHint(); hideDraftCaption(); toast('', 1);
  ['counterBox', 'choiceBox', 'slotBox'].forEach(function (id) { $(id).classList.remove('show'); });
  $('banner').style.display = 'none';
}
function startLocal() { endGameScreens(); botStop(); gameMode = 'local'; setMenuNote(null); bgmNewGame(); showScreen('game'); reset(); }
function showMenu() {
  endGameScreens(); botStop(); gameMode = 'local'; reset({}); showScreen('menu');   // 빈 판을 배경으로 보여 줌
}
function restartGame() { if (gameMode === 'bot') { endGameScreens(); showScreen('side'); } else if (gameMode === 'tutorial' && tut) tutStage(tut.step); else { bgmNewGame(); syncBgm(); reset(); } }
$('modeLocal').addEventListener('click', startLocal);
$('modeTut').addEventListener('click', function () { setMenuNote(null); startTutorial(); });
function botLevelName(n) { return n === 20 ? t('bot.ultimate') : t('bot.lv', { n: n }); }
function renderLevelButtons() {
  $('levelOptions').innerHTML = BOT_LEVEL_LIST.map(function (n) { return '<button class="mode-btn" data-level="' + n + '"><div class="mode-name">' + botLevelName(n) + '</div></button>'; }).join('');
}
$('modeBot').addEventListener('click', function () { setMenuNote(null); showScreen('level'); });
$('levelBack').addEventListener('click', function () { showScreen('menu'); });
$('levelOptions').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-level]'); if (!b) return;
  botSetLevel(parseInt(b.dataset.level, 10)); showScreen('side');
});
$('sideBack').addEventListener('click', function () { showScreen(gameMode === 'bot' ? 'menu' : 'level'); });
$('sideOptions').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-side]'); if (!b) return;
  endGameScreens(); gameMode = 'bot'; botStart(b.dataset.side); bgmNewGame(); showScreen('game'); reset();
});
$('modeMp').addEventListener('click', function () { setLobbyNote(null); $('roomCodeBox').classList.remove('show'); $('joinCode').value = ''; setMenuNote(null); showScreen('lobby'); });
$('backBtn').addEventListener('click', showMenu);
$('bannerMenu').addEventListener('click', showMenu);

/* ---------------- 멀티플레이 로비 ---------------- */
$('lobbyBack').addEventListener('click', function () { $('roomCodeBox').classList.remove('show'); showScreen('menu'); });
$('firstOptions').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-first]'); if (!b) return;
  [].forEach.call($('firstOptions').children, function (x) { x.setAttribute('aria-checked', String(x === b)); });
});
$('createRoom').addEventListener('click', function () { setLobbyNote('lobby.unavailable'); });   // 온라인 서버는 아직 없음
$('joinRoom').addEventListener('click', function () { fixCodeInput(); setLobbyNote($('joinCode').value ? 'lobby.unavailable' : 'lobby.noCode'); });
// 방 코드 입력: 대문자 영문·숫자만. 한글(두벌식)·러시아어·일본어 자판으로 쳐도 같은 자리의 영문으로 바꿈
var KO_KEY = { 'ㅂ': 'Q', 'ㅈ': 'W', 'ㄷ': 'E', 'ㄱ': 'R', 'ㅅ': 'T', 'ㅛ': 'Y', 'ㅕ': 'U', 'ㅑ': 'I', 'ㅐ': 'O', 'ㅔ': 'P',
  'ㅁ': 'A', 'ㄴ': 'S', 'ㅇ': 'D', 'ㄹ': 'F', 'ㅎ': 'G', 'ㅗ': 'H', 'ㅓ': 'J', 'ㅏ': 'K', 'ㅣ': 'L',
  'ㅋ': 'Z', 'ㅌ': 'X', 'ㅊ': 'C', 'ㅍ': 'V', 'ㅠ': 'B', 'ㅜ': 'N', 'ㅡ': 'M',
  'ㅃ': 'Q', 'ㅉ': 'W', 'ㄸ': 'E', 'ㄲ': 'R', 'ㅆ': 'T', 'ㅒ': 'O', 'ㅖ': 'P',
  'ㅘ': 'HK', 'ㅙ': 'HO', 'ㅚ': 'HL', 'ㅝ': 'NJ', 'ㅞ': 'NP', 'ㅟ': 'NL', 'ㅢ': 'ML',
  'ㄳ': 'RT', 'ㄵ': 'SW', 'ㄶ': 'SG', 'ㄺ': 'FR', 'ㄻ': 'FA', 'ㄼ': 'FQ', 'ㄽ': 'FT', 'ㄾ': 'FX', 'ㄿ': 'FV', 'ㅀ': 'FG', 'ㅄ': 'QT' };
var KO_CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', KO_JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
var KO_JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
var RU_KEY = { 'Й': 'Q', 'Ц': 'W', 'У': 'E', 'К': 'R', 'Е': 'T', 'Н': 'Y', 'Г': 'U', 'Ш': 'I', 'Щ': 'O', 'З': 'P',
  'Ф': 'A', 'Ы': 'S', 'В': 'D', 'А': 'F', 'П': 'G', 'Р': 'H', 'О': 'J', 'Л': 'K', 'Д': 'L',
  'Я': 'Z', 'Ч': 'X', 'С': 'C', 'М': 'V', 'И': 'B', 'Т': 'N', 'Ь': 'M' };
var KANA = { 'あ': 'A', 'い': 'I', 'う': 'U', 'え': 'E', 'お': 'O', 'か': 'KA', 'き': 'KI', 'く': 'KU', 'け': 'KE', 'こ': 'KO',
  'さ': 'SA', 'し': 'SI', 'す': 'SU', 'せ': 'SE', 'そ': 'SO', 'た': 'TA', 'ち': 'TI', 'つ': 'TU', 'て': 'TE', 'と': 'TO',
  'な': 'NA', 'に': 'NI', 'ぬ': 'NU', 'ね': 'NE', 'の': 'NO', 'は': 'HA', 'ひ': 'HI', 'ふ': 'HU', 'へ': 'HE', 'ほ': 'HO',
  'ま': 'MA', 'み': 'MI', 'む': 'MU', 'め': 'ME', 'も': 'MO', 'や': 'YA', 'ゆ': 'YU', 'よ': 'YO',
  'ら': 'RA', 'り': 'RI', 'る': 'RU', 'れ': 'RE', 'ろ': 'RO', 'わ': 'WA', 'を': 'WO', 'ん': 'N',
  'が': 'GA', 'ぎ': 'GI', 'ぐ': 'GU', 'げ': 'GE', 'ご': 'GO', 'ざ': 'ZA', 'じ': 'ZI', 'ず': 'ZU', 'ぜ': 'ZE', 'ぞ': 'ZO',
  'だ': 'DA', 'ぢ': 'DI', 'づ': 'DU', 'で': 'DE', 'ど': 'DO', 'ば': 'BA', 'び': 'BI', 'ぶ': 'BU', 'べ': 'BE', 'ぼ': 'BO',
  'ぱ': 'PA', 'ぴ': 'PI', 'ぷ': 'PU', 'ぺ': 'PE', 'ぽ': 'PO' };
function codeToLatin(str) {
  var out = '';
  Array.from(String(str || '').normalize('NFC')).forEach(function (ch0) {
    var ch = ch0.toUpperCase(), k = ch0.charCodeAt(0);
    if (k >= 0xAC00 && k <= 0xD7A3) {                // 완성형 한글 → 자모 → 두벌식 자판
      var x = k - 0xAC00, jong = x % 28, jung = ((x - jong) / 28) % 21, cho = Math.floor(x / 588);
      out += KO_KEY[KO_CHO[cho]] + KO_KEY[KO_JUNG[jung]] + (jong ? KO_KEY[KO_JONG[jong]] : ''); return;
    }
    if (KO_KEY[ch0]) { out += KO_KEY[ch0]; return; }
    if (RU_KEY[ch]) { out += RU_KEY[ch]; return; }
    var kana = k >= 0x30A1 && k <= 0x30F6 ? String.fromCharCode(k - 0x60) : ch0;   // 가타카나 → 히라가나
    if (KANA[kana]) { out += KANA[kana]; return; }
    if (/[A-Z0-9]/.test(ch)) out += ch;
    else if (/[０-９Ａ-Ｚａ-ｚ]/.test(ch0)) out += String.fromCharCode(k - 0xFEE0).toUpperCase();   // 전각 영숫자
  });
  return out.slice(0, 5);
}
var codeComposing = false, joinCode = $('joinCode');
function fixCodeInput() { var v = codeToLatin(joinCode.value); if (v !== joinCode.value) joinCode.value = v; }
joinCode.addEventListener('compositionstart', function () { codeComposing = true; });
joinCode.addEventListener('compositionend', function () { codeComposing = false; setTimeout(fixCodeInput, 0); });
joinCode.addEventListener('input', function (e) { if (!codeComposing && !e.isComposing) fixCodeInput(); });
joinCode.addEventListener('blur', fixCodeInput);
joinCode.addEventListener('keydown', function (e) {   // 영문 이외 자판은 누른 자리(e.code)의 영문으로 바로 입력
  if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1 || /[A-Za-z0-9]/.test(e.key)) return;
  var m = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(e.code || '');
  if (!m || codeToLatin(e.key)) return;
  e.preventDefault();
  var el = joinCode, a = el.selectionStart, b = el.selectionEnd;
  el.value = codeToLatin(el.value.slice(0, a) + (m[1] || m[2]) + el.value.slice(b));
  el.setSelectionRange(Math.min(a + 1, el.value.length), Math.min(a + 1, el.value.length));
});

/* ---------------- 메인 화면 배경: 어둠 속에 흩어진 돌과 카드 ---------------- */
var menuBg = (function () {
  var items = null, W = 0, H = 0, cvs = [$('menuBg'), $('menuBg2'), $('menuBg3'), $('menuBg4')], last = 0;
  function seed(w, h) {
    items = []; var n = 46, s = 7;
    function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    for (var i = 0; i < n; i++) {
      var kind = rnd() < 0.55 ? (rnd() < 0.5 ? 'b' : 'w') : 'c', big = rnd() < 0.3;
      items.push({ kind: kind, x: rnd() * w, y: rnd() * h, r: (big ? 60 + rnd() * 60 : 22 + rnd() * 32), a: rnd() * 6.28, va: (rnd() - 0.5) * 0.12, d: 0.16 + rnd() * 0.3 });
    }
  }
  function stone(g, it) {
    var r = it.r, black = it.kind === 'b';
    var gr = g.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r);
    if (black) { gr.addColorStop(0, '#5a5047'); gr.addColorStop(.35, '#1d1814'); gr.addColorStop(1, '#050403'); }
    else { gr.addColorStop(0, '#9a8f78'); gr.addColorStop(.5, '#6a604d'); gr.addColorStop(1, '#2a2519'); }
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill();
  }
  function card(g, it) {
    var w = it.r * 1.3, h = it.r * 1.85;
    g.fillStyle = '#7a6746'; g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = '#6a5026'; g.lineWidth = Math.max(2, it.r * .05); g.strokeRect(-w / 2 + it.r * .09, -h / 2 + it.r * .09, w - it.r * .18, h - it.r * .18);
    g.strokeStyle = 'rgba(50,34,14,.8)'; g.lineWidth = Math.max(2, it.r * .045); g.beginPath(); g.arc(0, -h * .08, w * .24, 0, 6.2832); g.moveTo(-w * .22, h * .22); g.lineTo(w * .22, h * .22); g.stroke();
  }
  function draw(dt) {
    var el = $('menu').classList.contains('show') ? cvs[0] : $('lobby').classList.contains('show') ? cvs[1] : $('side').classList.contains('show') ? cvs[2] : $('level').classList.contains('show') ? cvs[3] : null; if (!el) return;
    var w = el.clientWidth, h = el.clientHeight; if (!w) return;
    if (el.width !== w || el.height !== h || !items) { el.width = w; el.height = h; seed(w, h); }
    var g = el.getContext('2d'); g.clearRect(0, 0, w, h);
    items.forEach(function (it) {
      it.a += it.va * dt;
      g.save(); g.translate(it.x, it.y); g.rotate(it.a); g.globalAlpha = it.d;
      if (it.kind === 'c') card(g, it); else stone(g, it);
      g.restore();
    });
  }
  function loop(ts) { draw(Math.min(0.1, (ts - last) / 1000 || 0)); last = ts; requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
})();
