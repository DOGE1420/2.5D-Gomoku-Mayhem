/* 봇 생각 전용 작업 스레드 — 얼티밋(20단계)이 한 수에 몇 초씩 읽는 동안 화면이 멈추지 않게 함.
 * 메인 화면이 판(G)의 복사본을 보내면 BotAI 로 둘 자리를 계산해 돌려줌. (index.html 과 같은 폴더 구조에서 js/ 를 기준으로 불러옴)
 */
'use strict';
importScripts('rules.js', 'rules-legend.js', 'rules-world.js', 'bot-ai.js');
onmessage = function (e) {
  var d = e.data;
  try {
    var pick = BotAI.chooseMove(d.G, d.me, d.cfg);
    postMessage({ job: d.job, pick: pick ? { r: pick.r, c: pick.c } : null });
  } catch (err) { postMessage({ job: d.job, error: String(err) }); }
};
