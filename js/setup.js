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
// 날씨(맵) · 시작 능력도 카드 모양으로 보여 줌 (map_<맵 id>, ab_<능력 id>)
var INFO_DESC = {
  map_classic: '자연재해가 없는\n평온한 들판', map_summer: '5라운드마다\n흑·백 돌이 하나씩\n녹아 사라짐', map_winter: '5라운드마다\n돌 하나가 2라운드 동안\n얼어붙음',
  map_space: '판의 양 끝이\n반대편과 이어짐\n(웜홀)', map_desert: '8라운드부터\n4라운드마다\n모래폭풍', map_rain: '알까기가 미끄럽고\n지진 때 쓰나미가\n가장자리를 쓸어 감',
  ab_umbrella: '맵 자연재해가\n일어나지 않음', ab_pouch: '패를 5장까지\n쥘 수 있음', ab_clover: '카드를 4장 중에서\n고름', ab_sturdy: '처음 둔 돌 3개는\n카드 효과로부터\n영구 보호', ab_retry: '다시 뽑기를\n3번 쓸 수 있음'
};
Rules.MAP_LIST.forEach(function (m) { CARDS['map_' + m.id] = { name: m.name, cat: '날씨', desc: INFO_DESC['map_' + m.id] || m.short, foot: '이번 판의 날씨' }; });
Rules.ABILITIES.forEach(function (a) { CARDS['ab_' + a.id] = { name: a.name, cat: '시작 능력', desc: INFO_DESC['ab_' + a.id] || a.desc, foot: '양쪽 모두' }; });
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
var IS_TOUCH = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);   // 터치 화면(폰·태블릿)
