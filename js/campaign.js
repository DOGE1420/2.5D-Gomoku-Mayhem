/* 캠페인 — 상대 6명을 차례로 꺾음. 상대마다 규칙 하나를 새로 가르침 (이기면 다음 상대가 열림, 진행은 브라우저에 저장)
 * 사람은 흑(선공), 봇은 백. 보스(딜러)는 두 판: 두 번째 판은 딜러가 흑으로 전세 역전 카드를 들고 시작 */
'use strict';

var CAMPAIGN = [
  { name: '견습생', en: 'The Apprentice', lv: 1, ico: 'book', learn: '순수 오목', learnEn: 'Pure Gomoku',
    line: '"다섯 개를 먼저 잇는 쪽이 이기는 거죠?"', lineEn: '"First to five in a row wins, right?"',
    opts: { cards: false, zone: false, map: 'classic' } },
  { name: '사기꾼', en: 'The Swindler', lv: 3, ico: 'cards', learn: '일반 카드', learnEn: 'Cards',
    line: '"보이는 게 다가 아니지."', lineEn: '"What you see isn\'t all there is."',
    opts: { zone: false, map: 'classic', hand: { 2: ['trap', 'blockade'] } } },
  { name: '기상술사', en: 'The Weatherwitch', lv: 5, ico: 'weather', learn: '맵 · 날씨', learnEn: 'Maps & weather',
    line: '"바람이 어느 쪽으로 부는지 보여 주지."', lineEn: '"Let me show you which way the wind blows."',
    opts: { zone: false, map: 'weathery', hand: { 2: ['weather'] } } },
  { name: '문지기', en: 'The Gatekeeper', lv: 7, ico: 'bolt', learn: '시작 능력 · 자기장', learnEn: 'Start abilities & the zone',
    line: '"여기서부터는 길이 좁아진다."', lineEn: '"From here on, the path narrows."',
    opts: { map: 'random', ability: 'random', zoneStart: 6 } },
  { name: '몰락한 왕', en: 'The Fallen King', lv: 10, ico: 'crown', learn: '전설 카드', learnEn: 'Legend cards',
    line: '"왕좌는 다시 내 것이 된다."', lineEn: '"The throne will be mine again."',
    opts: { map: 'random', ability: 'random', legends: true, forceLegend: { 2: 'king' } } },
  { name: '딜러', en: 'The Dealer', lv: 20, ico: 'slot', learn: '모든 규칙', learnEn: 'Every rule', boss: true,
    line: '"자, 마지막 판이다."', lineEn: '"Now then. The last game."',
    opts: { map: 'random', ability: 'random', legends: true },
    phase2: { line: '"재미있군. 한 판 더. 이번엔 내가 먼저다."', lineEn: '"Amusing. One more. I go first this time."',
      opts: { map: 'random', ability: 'random', legends: true, hand: { 1: ['reversal'] } } } }
];
var camp = null;             // 지금 캠페인 { i, phase, result: 'win' | 'lose' | null }
function campCleared() { try { return Math.max(0, Math.min(CAMPAIGN.length, parseInt(localStorage.getItem('omok_campaign'), 10) || 0)); } catch (e) { return 0; } }
function campSave(n) { try { if (n > campCleared()) localStorage.setItem('omok_campaign', String(n)); } catch (e) {} }
function campText(s, key) { return lang === 'en' && s[key + 'En'] ? s[key + 'En'] : s[key]; }
function campName(s) { return lang === 'en' ? s.en : s.name; }

/* ---------------- 상대 고르기 화면 ---------------- */
function renderCampaign() {
  var cleared = campCleared();
  $('campOptions').innerHTML = CAMPAIGN.map(function (s, i) {
    var locked = i > cleared, done = i < cleared;
    var desc = locked ? t('camp.locked') : t('camp.learn') + ' ' + campText(s, 'learn') + ' · ' + botLevelName(s.lv);
    return '<button class="mode-btn' + (locked ? ' locked' : '') + '" data-stage="' + i + '"' + (locked ? ' disabled' : '') + '>' +
      '<div class="mode-icon">' + ico(locked ? 'forbid' : s.ico) + '</div><div class="mode-name">' + (i + 1) + '. ' + campName(s) + '</div>' +
      '<div class="mode-desc">' + desc + '</div>' + (done ? '<div class="camp-done">' + ico('check') + '</div>' : '') + '</button>';
  }).join('');
}
$('modeCamp').addEventListener('click', function () { setMenuNote(null); renderCampaign(); showScreen('campaign'); });
$('campBack').addEventListener('click', function () { showScreen('menu'); });
$('campOptions').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-stage]'); if (!b || b.disabled) return;
  campIntro(parseInt(b.dataset.stage, 10), 1);
});

/* ---------------- 상대 소개 (이름 · 한 줄 대사 · 새 규칙) → 시작 ---------------- */
function campIntro(i, phase) {
  var s = CAMPAIGN[i], p2 = phase === 2;
  camp = { i: i, phase: phase, result: null };
  $('campIntroIco').innerHTML = ico(s.ico);
  $('campIntroName').textContent = campName(s) + (s.boss ? ' · ' + t(p2 ? 'camp.round2' : 'camp.round1') : '');
  $('campIntroLine').textContent = p2 ? campText(s.phase2, 'line') : campText(s, 'line');
  $('campIntroLearn').textContent = t('camp.learn') + ' ' + campText(s, 'learn');
  $('campIntro').classList.add('show');
}
$('campGo').addEventListener('click', function () {
  $('campIntro').classList.remove('show');
  if (camp.i === 0 && camp.phase === 1 && !tutDone()) startTutorial(); else campStart();   // 견습생: 처음이면 튜토리얼부터
});
function campOpts(s, phase) {
  var o = JSON.parse(JSON.stringify(phase === 2 ? s.phase2.opts : s.opts));
  if (o.map === 'weathery') { var ms = Rules.MAP_LIST.filter(function (m) { return m.id !== 'classic'; }); o.map = ms[Math.floor(Math.random() * ms.length)].id; }   // 기상술사: 평원이 아닌 맵
  return o;
}
function campStart() {
  var s = CAMPAIGN[camp.i];
  endGameScreens(); gameMode = 'campaign';
  botLevel = s.lv;                                          // 봇전에서 고른 단계는 건드리지 않음 (저장 안 함)
  botStart(camp.phase === 2 ? 'second' : 'first');
  bgmNewGame(); showScreen('game'); reset(campOpts(s, camp.phase));
}

/* ---------------- 판이 끝났을 때: 이기면 다음 상대 · 지면 다시 도전 ---------------- */
function campOnEnd(winner) {
  if (gameMode !== 'campaign' || !camp) return;
  var s = CAMPAIGN[camp.i], won = winner === humanColor;
  camp.result = won ? 'win' : 'lose';
  var label = 'camp.retry';
  if (won && s.boss && camp.phase === 1) label = 'camp.continue';
  else if (won) { campSave(camp.i + 1); label = camp.i + 1 < CAMPAIGN.length ? 'camp.next' : 'camp.end'; }
  $('again').textContent = t(label);
}
function campAfterBanner() {                                 // 배너의 버튼(다시 하기 자리)을 눌렀을 때
  var s = CAMPAIGN[camp.i];
  if (camp.result === 'win' && s.boss && camp.phase === 1) return campIntro(camp.i, 2);
  if (camp.result === 'win') {
    if (camp.i + 1 < CAMPAIGN.length) return campIntro(camp.i + 1, 1);
    endGameScreens(); botStop(); gameMode = 'local'; reset({}); renderCampaign(); showScreen('campaign'); return;   // 딜러까지 꺾음
  }
  campIntro(camp.i, camp.phase);                              // 졌으면 같은 상대(같은 판)를 다시
}
