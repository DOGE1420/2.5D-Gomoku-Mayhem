/* 튜토리얼 — 3단계로 규칙 익히기 (메인 화면의 📖)
 * ① 돌 5개를 한 줄로 → ② 백의 열린 4를 장벽 카드와 돌로 막기 → ③ 끝, 로컬 모드로
 */
'use strict';

var tut = null;   // { step, k, b }
function tutShow(key, btnKey) {
  if (tut) { tut.k = key; tut.b = btnKey; }
  $('tutBox').classList.add('show'); $('tutText').textContent = t(key);
  var b = $('tutBtn'); b.style.display = btnKey ? 'inline-block' : 'none'; if (btnKey) b.textContent = t(btnKey);
}
function endTutorial() { tut = null; $('tutBox').classList.remove('show'); $('tutBtn').style.display = 'none'; }
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
function startTutorial() { endGameScreens(); gameMode = 'tutorial'; bgmNewGame(); showScreen('game'); tutStage(1); }
// 흑이 돌을 둬서 턴이 넘어갈 때 (②단계): 백이 이길 칸이 남았는지 확인
function tutOnTurn() {
  if (!tut || tut.step !== 2 || G.current !== Rules.WHITE) return;
  var win = false;
  for (var r = 0; r < Rules.SIZE && !win; r++) for (var c = 0; c < Rules.SIZE && !win; c++) {
    if (G.board[r][c] !== Rules.EMPTY || Rules.isBlockedForPlayer(G, r, c, Rules.WHITE)) continue;
    G.board[r][c] = Rules.WHITE; if (Rules.core.checkWin(G, r, c, Rules.WHITE)) win = true; G.board[r][c] = Rules.EMPTY;
  }
  if (!win) setTimeout(function () { if (tut) tutStage(3); }, 700);
  else { tutShow('tut.2.retry'); setTimeout(function () { if (tut) tutStage(2); }, 1500); }
}
// 승리 이벤트 (①단계): 배너 없이 다음 단계로. true 면 일반 처리를 건너뜀
function tutOnWin() {
  if (!tut) return false;
  if (tut.step === 1) { setTimeout(function () { if (tut) tutStage(2); }, 1100); return true; }
  return true;
}
$('tutBtn').addEventListener('click', function () { startLocal(); });   // ③ 끝: 로컬 모드 시작
