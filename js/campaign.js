/* 캠페인 — 상대 6명을 차례로 꺾음. 상대마다 규칙 하나를 새로 가르침 (이기면 다음 상대가 열림, 진행은 브라우저에 저장)
 * 사람은 흑(선공), 봇은 백. 보스(딜러)는 두 판: 두 번째 판은 딜러가 흑으로 전세 역전 카드를 들고 시작 */
'use strict';

var CAMPAIGN = [
  { name: '견습생', en: 'The Apprentice', lv: 1, ico: 'book', learn: '순수 오목', learnEn: 'Pure Gomoku',
    line: '"다섯 개를 먼저 잇는 쪽이 이기는 거죠?"', lineEn: '"First to five in a row wins, right?"',
    rule: ['같은 색 돌 다섯 개를 한 줄로 먼저 놓으면 이겨.', '가로, 세로, 대각선 어느 쪽이든 상관없어.'],
    ruleEn: ['Five stones of one color in a row wins.', 'Across, down or diagonal — any line counts.'],
    win: '...제법인데. 이제 다음 차례로 넘어갈 차례군.', winEn: '...Not bad. Time to move on to the next one.',
    opts: { cards: false, zone: false, map: 'classic' } },
  { name: '사기꾼', en: 'The Swindler', lv: 3, ico: 'cards', learn: '일반 카드', learnEn: 'Cards',
    line: '"보이는 게 다가 아니지."', lineEn: '"What you see isn\'t all there is."',
    rule: ['이번엔 카드를 쓴다. 돌을 3개 둘 때마다 카드를 한 장 고르고, 턴마다 한 장 쓸 수 있지.', '패의 카드를 눌러 크게 보고, 한 번 더 누르면 발동이다.', '내가 쓰는 함정과 봉쇄는 네 눈엔 안 보일 거다. 걸리기 전까진.'],
    ruleEn: ['Now we play with cards. Pick one every 3 stones; use one per turn.', 'Click a card to look closer, click again to play it.', 'My traps and blockades stay hidden... until you walk into them.'],
    win: '쳇, 속임수가 안 통하는군. 다음 차례로 넘어가지.', winEn: 'Tch. My tricks failed. On to the next, then.',
    opts: { zone: false, map: 'classic', hand: { 2: ['trap', 'blockade'] } } },
  { name: '기상술사', en: 'The Weatherwitch', lv: 5, ico: 'weather', learn: '맵 · 날씨', learnEn: 'Maps & weather',
    line: '"바람이 어느 쪽으로 부는지 보여 주지."', lineEn: '"Let me show you which way the wind blows."',
    rule: ['판마다 날씨가 다르다. 왼쪽 위 카드를 누르면 이번 날씨를 볼 수 있지.', '여름엔 돌이 녹고, 겨울엔 얼고, 사막엔 모래폭풍이 분다.'],
    ruleEn: ['Every game has its own weather. Click the card at top left to see it.', 'Stones melt in summer, freeze in winter, and sandstorms sweep the desert.'],
    win: '하늘도 네 편이었나. 좋아, 다음 차례다.', winEn: 'Even the sky took your side. Fine — next one.',
    opts: { zone: false, map: 'weathery', hand: { 2: ['weather'] } } },
  { name: '문지기', en: 'The Gatekeeper', lv: 7, ico: 'bolt', learn: '시작 능력 · 자기장', learnEn: 'Start abilities & the zone',
    line: '"여기서부터는 길이 좁아진다."', lineEn: '"From here on, the path narrows."',
    rule: ['판을 시작할 때 둘 다 같은 시작 능력을 하나 받는다. 왼쪽 위 두 번째 카드다.', '6라운드부터 자기장이 바깥 줄을 닫는다. 흰 선이 다음에 닫힐 곳이야.'],
    ruleEn: ['At the start we both get the same start ability — the second card at top left.', 'From round 6 the zone closes the outer lines. The white line marks the next one.'],
    win: '...문이 열렸군. 지나가라, 다음 차례가 기다린다.', winEn: '...The gate is open. Go on — the next one awaits.',
    opts: { map: 'random', ability: 'random', zoneStart: 6 } },
  { name: '몰락한 왕', en: 'The Fallen King', lv: 10, ico: 'crown', learn: '전설 카드', learnEn: 'Legend cards',
    line: '"왕좌는 다시 내 것이 된다."', lineEn: '"The throne will be mine again."',
    rule: ['판을 시작할 때 전설 카드를 하나 고른다. 오른쪽 아래에 놓이지.', '조건이 맞으면 판마다 한 번 쓸 수 있다. 내 전설은... 왕의 귀환이다.'],
    ruleEn: ['At the start you pick a legend card. It sits at the bottom right.', 'Once its condition is met, use it once per game. Mine... is the Return of the King.'],
    win: '왕관이... 떨어졌군. 마지막 차례로 넘어가라.', winEn: 'The crown... has fallen. Go on to the last one.',
    opts: { map: 'random', ability: 'random', legends: true, forceLegend: { 2: 'king' } } },
  { name: '딜러', en: 'The Dealer', lv: 20, ico: 'slot', learn: '모든 규칙', learnEn: 'Every rule', boss: true,
    line: '"자, 마지막 판이다."', lineEn: '"Now then. The last game."',
    rule: ['여기까지 온 걸 칭찬하지. 이번엔 모든 규칙을 다 쓴다.'], ruleEn: ['I\'ll give you credit for getting this far. Every rule is in play now.'],
    win: '...내가 졌다. 이 오두막의 판은 이제 네 것이다.', winEn: '...I lose. The games of this cabin are yours now.',
    opts: { map: 'random', ability: 'random', legends: true },
    phase2: { line: '"재미있군. 한 판 더. 이번엔 내가 먼저다."', lineEn: '"Amusing. One more. I go first this time."',
      opts: { map: 'random', ability: 'random', legends: true, hand: { 1: ['reversal'] } } } }
];
var CAMP_LOSE = ['아직 멀었군. 다시 해 보겠나?', 'Not yet. Shall we go again?'];
var camp = null;             // 지금 캠페인 { i, phase, result: 'win' | 'lose' | null }
function campCleared() { try { return Math.max(0, Math.min(CAMPAIGN.length, parseInt(localStorage.getItem('omok_campaign'), 10) || 0)); } catch (e) { return 0; } }
function campSave(n) { try { if (n > campCleared()) localStorage.setItem('omok_campaign', String(n)); } catch (e) {} }
function campText(s, key) { return lang === 'en' && s[key + 'En'] ? s[key + 'En'] : s[key]; }
function campName(s) { return lang === 'en' ? s.en : s.name; }

/* ---------------- 캠페인 버튼: 단계를 고르지 않고 이어서 바로 시작 (처음이면 1단계, 다 깼으면 다시 1단계) ---------------- */
function renderCampaign() {}
$('modeCamp').addEventListener('click', function () {
  setMenuNote(null);
  var i = campCleared(); if (i >= CAMPAIGN.length) i = 0;
  camp = { i: i, phase: 1, result: null };
  if (i === 0 && !tutDone()) startTutorial(); else campEnter();     // 견습생과 처음이면 튜토리얼부터
});

/* ---------------- 대화창: 화면 아래 글 상자 (누르면 다음 줄) ---------------- */
var dlg = { open: false, lines: [], idx: 0, shown: 0, full: '', done: null, acc: 0 };
function dlgOpen() { return dlg.open; }
// lines: [{ who, text, anim }] — anim 은 로봇 동작 (Wave, Yes, No, Punch, ThumbsUp ...)
function dialog(lines, done) {
  dlg.open = true; dlg.lines = lines; dlg.idx = 0; dlg.done = done || null;
  $('dlg').classList.add('show'); dlgLine();
}
function dlgLine() {
  var l = dlg.lines[dlg.idx];
  $('dlgWho').textContent = l.who || ''; $('dlgWho').style.display = l.who ? 'block' : 'none';
  dlg.full = l.text; dlg.shown = 0; dlg.acc = 0; $('dlgText').textContent = '';
  if (l.anim && typeof enemyPlay === 'function' && enemy.root && !enemy.down) enemyPlay(l.anim, true);
}
function dlgNext() {
  if (!dlg.open) return;
  if (dlg.shown < dlg.full.length) { dlg.shown = dlg.full.length; $('dlgText').textContent = dlg.full; return; }   // 글이 다 안 나왔으면 한 번에 다 보여 줌
  if (++dlg.idx < dlg.lines.length) return dlgLine();
  dlg.open = false; $('dlg').classList.remove('show');
  var cb = dlg.done; dlg.done = null; if (cb) cb();
}
function stepDialog(dt) {                                            // 글자가 한 자씩 나옴
  if (!dlg.open || dlg.shown >= dlg.full.length) return;
  dlg.acc += dt * 38; var n = Math.min(dlg.full.length, Math.floor(dlg.acc));
  if (n !== dlg.shown) { dlg.shown = n; $('dlgText').textContent = dlg.full.slice(0, n); }
}
$('dlg').addEventListener('click', function (e) { e.stopPropagation(); dlgNext(); });
window.addEventListener('keydown', function (e) { if (dlg.open && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); dlgNext(); } });
function campSay(s, text, anim) { return { who: campName(s), text: text, anim: anim }; }

/* ---------------- 한 상대와의 판: 대사 → 판 시작 ---------------- */
function campEnter() {                                                // 게임 화면으로 들어와 로봇이 말을 걸고 시작
  var s = CAMPAIGN[camp.i];
  if (curScreen !== 'game') { endGameScreens(); gameMode = 'campaign'; botStop(); bgmNewGame(); showScreen('game'); reset({ cards: false, zone: false, map: 'classic' }); }
  gameMode = 'campaign'; enemyShow(camp.i, true);
  var p2 = camp.phase === 2, lines = [campSay(s, (p2 ? campText(s.phase2, 'line') : campText(s, 'line')).replace(/^"|"$/g, ''), 'Wave')];
  if (!p2) (lang === 'en' ? s.ruleEn : s.rule).forEach(function (t2, k) { lines.push(campSay(s, t2, k === 0 ? 'Yes' : null)); });
  dialog(lines, campStart);
}
function campOpts(s, phase) {
  var o = JSON.parse(JSON.stringify(phase === 2 ? s.phase2.opts : s.opts));
  if (o.map === 'weathery') { var ms = Rules.MAP_LIST.filter(function (m) { return m.id !== 'classic'; }); o.map = ms[Math.floor(Math.random() * ms.length)].id; }   // 기상술사: 평원이 아닌 맵
  return o;
}
function campStart() {
  var s = CAMPAIGN[camp.i];
  endGameScreens(); gameMode = 'campaign'; camp.result = null;
  botLevel = s.lv;                                          // 봇전에서 고른 단계는 건드리지 않음 (저장 안 함)
  botStart(camp.phase === 2 ? 'second' : 'first');
  if (curScreen !== 'game') { bgmNewGame(); showScreen('game'); }
  reset(campOpts(s, camp.phase));
  enemyShow(camp.i, true);
}

/* ---------------- 판이 끝났을 때: 결과 창 대신 로봇의 대사 → 다음 상대(또는 다시) ---------------- */
function campOnEnd(winner) {
  if (gameMode !== 'campaign' || !camp || camp.result) return;
  var s = CAMPAIGN[camp.i], won = winner === humanColor;
  camp.result = won ? 'win' : 'lose';
  setTimeout(function () {
    if (gameMode !== 'campaign' || !camp) return;
    if (!won) return dialog([campSay(s, CAMP_LOSE[lang === 'en' ? 1 : 0])], function () { campStart(); });
    if (s.boss && camp.phase === 1) { camp.phase = 2; return campEnter(); }
    campSave(camp.i + 1);
    dialog([campSay(s, campText(s, 'win'))], function () {
      if (camp.i + 1 < CAMPAIGN.length) { camp.i++; camp.phase = 1; campEnter(); }
      else { camp = null; showMenu(); }                       // 딜러까지 꺾음 → 메뉴로
    });
  }, 1600);
}
function campAfterBanner() { if (camp) campStart(); }
