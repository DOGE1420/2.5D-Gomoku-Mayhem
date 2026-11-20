/* 튜토리얼 — 3단계로 규칙 익히기 (캠페인 1단계 견습생과 처음 붙기 전에 한 번)
 * ① 돌 5개를 한 줄로 → ② 백의 열린 4를 장벽 카드와 돌로 막기 → ③ 끝, 로컬 모드로
 */
'use strict';

var tut = null;   // { step, k, b }
function tutShow(key, btnKey) {
  if (tut) { tut.k = key; tut.b = btnKey; }
  $('tutBox').classList.add('show'); $('tutBox').classList.toggle('full', !!(tut && tut.step === 3)); $('tutText').innerHTML = H(t(key));
  var b = $('tutBtn'); b.style.display = btnKey ? 'inline-block' : 'none'; if (btnKey) b.textContent = t(btnKey);
}
function endTutorial() { tut = null; $('tutBox').classList.remove('show', 'full'); $('tutBtn').style.display = 'none'; }
function tutStage(step) {
  reset({});                                              // 시작 카드·능력 없이 빈 평원 판
  tut = { step: step };
  var B = Rules.BLACK, W = Rules.WHITE, put = function (list, v) { list.forEach(function (q) { G.board[q[0]][q[1]] = v; }); };
  if (step === 1) {
    put([[7, 5], [7, 6], [7, 7], [7, 8]], B); put([[6, 6], [8, 7], [6, 8], [8, 5]], W);
    tutShow('tut.1'); setTopView(true, true);
  } else if (step === 2) {
    put([[6, 5], [6, 6], [6, 7], [6, 8]], W); put([[7, 6], [7, 7], [5, 7], [8, 9]], B);
    G.hand[B] = ['wall']; tutShow('tut.2');
  } else {
    tutShow('tut.3', 'tut.play');
  }
  handDirty = true; syncAll();
}
function tutDone() { try { return localStorage.getItem('omok_tut_done') === '1'; } catch (e) { return false; } }
function tutMarkDone() { try { localStorage.setItem('omok_tut_done', '1'); } catch (e) {} }
function startTutorial() { endGameScreens(); botStop(); gameMode = 'tutorial'; bgmNewGame(); showScreen('game'); tutStage(1); }
// 흑이 돌을 둬서 턴이 넘어갈 때 (②단계): 백이 이길 칸이 남았는지 확인
function tutOnTurn() {
  if (tut && tut.step === 1 && G.current === Rules.WHITE && !G.gameOver) { tutRetry('tut.1.retry'); return; }   // ①단계: 5목을 못 만들면 다시
  if (!tut || tut.step !== 2 || G.current !== Rules.WHITE) return;
  var win = false;
  for (var r = 0; r < Rules.SIZE && !win; r++) for (var c = 0; c < Rules.SIZE && !win; c++) {
    if (G.board[r][c] !== Rules.EMPTY || Rules.isBlockedForPlayer(G, r, c, Rules.WHITE)) continue;
    G.board[r][c] = Rules.WHITE; if (Rules.core.checkWin(G, r, c, Rules.WHITE)) win = true; G.board[r][c] = Rules.EMPTY;
  }
  if (!win) setTimeout(function () { if (tut) tutStage(3); }, 700);
  else tutRetry();
}
// ②단계: 장벽은 백의 4 양 끝((6,4) 또는 (6,9)) 중 한 곳에만. 다른 곳에 두면 바로 다시
var TUT_ENDS = [[6, 4], [6, 9]];
function tutRetry(key) { if (!tut || tut.retrying) return; tut.retrying = true; tutShow(key || 'tut.2.retry'); var s = tut.step; setTimeout(function () { if (tut && tut.step === s) tutStage(s); }, 1300); }
function tutOnWall(r, c) {
  if (!tut || tut.step !== 2) return;
  if (!TUT_ENDS.some(function (q) { return q[0] === r && q[1] === c; })) tutRetry('tut.2.wall');
}
// 승리 이벤트 (①단계): 배너 없이 다음 단계로. true 면 일반 처리를 건너뜀
function tutOnWin() {
  if (!tut) return false;
  if (tut.step === 1) { setTimeout(function () { if (tut) tutStage(2); }, 1100); return true; }
  return true;
}
$('tutBtn').addEventListener('click', function () { tutMarkDone(); if (camp) campEnter(); else startLocal(); });   // ③ 끝: 캠페인 1단계(견습생)와 대결
