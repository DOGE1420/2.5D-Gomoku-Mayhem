/* 증강 오목 3D — 공통 상수 · 카드 데이터 · 설정(config.js) · 이미지 로더 */
'use strict';

var N = 15, HALF = 7;
var EMPTY = 0, BLACK = 1, WHITE = 2, WALL = 3;
var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
var TEXT_FONT = '"GameFont","Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';   // GameFont = assets/fonts/HeoSangGothicB.ttf (index.html 의 @font-face)

/* ---------------- 카드 데이터: 엔진(js/rules.js)에서 가져옴 ---------------- */
var Rules = window.Rules;
var CARDS = {};
Rules.CARDS.forEach(function (c) { CARDS[c.id] = { name: c.name, cat: c.cat, desc: c.desc, endsTurn: !!c.ends }; });
Rules.LEGENDS.forEach(function (c) { CARDS[c.id] = { name: c.name, cat: c.cat, desc: c.desc, endsTurn: false, legend: true, react: !!c.react }; });
var CARD_IDS = Rules.CARDS.map(function (c) { return c.id; }).concat(Rules.LEGENDS.map(function (c) { return c.id; }));   // 일러스트를 지정할 수 있는 모든 카드

/* ---------------- 설정(js/config.js) · 이미지 로더 ---------------- */
var CFG = window.GAME_CONFIG || {};
// file:// 로 열면 브라우저가 이미지를 WebGL 에 못 올리게 막으므로 이미지는 건너뛰고 기본 그림을 씁니다.
var CAN_IMG = location.protocol !== 'file:' || /[?&]img=1/.test(location.search);
var IMG = {}, blockedPaths = [], failedPaths = [];
function loadImg(path) {
  return new Promise(function (resolve) {
    if (!path) return resolve(null);
    if (!CAN_IMG) { if (blockedPaths.indexOf(path) < 0) blockedPaths.push(path); return resolve(null); }
    if (IMG[path] !== undefined) return resolve(IMG[path]);
    var im = new Image();
    im.onload = function () { IMG[path] = im; resolve(im); };
    im.onerror = function () { IMG[path] = null; failedPaths.push(path); console.warn('이미지를 불러오지 못했습니다:', path); resolve(null); };
    im.src = path;
  });
}
function cardArtPath(id) { return CFG.cards && CFG.cards[id]; }
