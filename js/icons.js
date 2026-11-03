/* 아이콘 — 이모지 대신 쓰는 손그림 풍 선 아이콘 (카드 그림과 같은 잉크 느낌)
 * ico('이름')  → <svg> 문자열.   H('문구 [[이름]] 문구') → [[이름]] 자리를 아이콘으로 바꾼 HTML.
 * 새 아이콘은 ICON_PATHS 에 이름: 'svg 안쪽 내용' (32×32, 선은 currentColor) 으로 추가하면 됨.
 */
'use strict';

var ICON_PATHS = {
  // 화면 · 설정
  settings: '<circle cx="16" cy="16" r="4.5"/><circle cx="16" cy="16" r="9.5"/><path d="M16 3.5v3.5M16 25v3.5M3.5 16H7M25 16h3.5M7.2 7.2l2.5 2.5M22.3 22.3l2.5 2.5M24.8 7.2l-2.5 2.5M9.7 22.3l-2.5 2.5"/>',
  volume: '<path d="M5 12h5l7-5.5v19L10 20H5z"/><path d="M21.5 11c2.2 2.4 2.2 7.6 0 10M25 7.5c4.6 4.6 4.6 12.4 0 17"/>',
  mute: '<path d="M5 12h5l7-5.5v19L10 20H5z"/><path d="M22 12l7 8M29 12l-7 8"/>',
  music: '<path d="M12 23.5V7.5l13-3v16"/><ellipse cx="9" cy="23.5" rx="3.6" ry="3"/><ellipse cx="22" cy="20.5" rx="3.6" ry="3"/>',
  book: '<path d="M3.5 7c5-2 9-1 12.5 2.5C19.5 6 23.5 5 28.5 7v18c-5-2-9-1-12.5 2.5C12.5 24 8.5 23 3.5 25z"/><path d="M16 9.5v17"/>',
  people: '<circle cx="11" cy="11" r="4"/><path d="M3 26c0-5.5 3.5-8.5 8-8.5s8 3 8 8.5"/><circle cx="23" cy="12.5" r="3.4"/><path d="M21.5 18.5c4.5-.5 7.5 2 7.5 7"/>',
  bot: '<rect x="6.5" y="11" width="19" height="14" rx="3"/><path d="M16 11V6M13.5 5.5h5M3.5 16.5v4M28.5 16.5v4"/><circle cx="12" cy="17" r="1.7"/><circle cx="20" cy="17" r="1.7"/><path d="M12 21.5h8"/>',
  globe: '<circle cx="16" cy="16" r="11.5"/><ellipse cx="16" cy="16" rx="5" ry="11.5"/><path d="M4.5 16h23M6.5 9.5h19M6.5 22.5h19"/>',
  search: '<circle cx="13.5" cy="13.5" r="8.5"/><path d="M20 20l9 9"/><path d="M9.5 12c.800-2.2 2.2-3.2 4-3.5"/>',
  cards: '<rect x="4.5" y="7.5" width="14" height="19" rx="2" transform="rotate(-9 11.5 17)"/><rect x="13" y="5.5" width="14" height="19" rx="2" transform="rotate(8 20 15)"/><path d="M17 13.5l3 3-3 3-3-3z" transform="rotate(8 20 15)"/>',
  reroll: '<path d="M27 14a11 11 0 00-20-4.5M5 4.5v6h6"/><path d="M5 18a11 11 0 0020 4.5M27 27.5v-6h-6"/>',
  dice: '<rect x="4.5" y="4.5" width="23" height="23" rx="4"/><circle cx="11" cy="11" r="1.6" fill="currentColor"/><circle cx="21" cy="11" r="1.6" fill="currentColor"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/><circle cx="11" cy="21" r="1.6" fill="currentColor"/><circle cx="21" cy="21" r="1.6" fill="currentColor"/>',
  black: '<circle cx="16" cy="16" r="11" fill="#171210"/><path d="M10.5 12.5c1-2.3 2.8-3.5 5-3.8" stroke="#e8e0cc" stroke-width="1.6"/>',
  white: '<circle cx="16" cy="16" r="11" fill="#ece4d2"/><path d="M10.5 12.5c1-2.3 2.8-3.5 5-3.8" stroke="#9a8f78" stroke-width="1.6"/>',
  flick: '<circle cx="21.5" cy="16" r="7" fill="#171210"/><path d="M3.5 11h8M2.5 16h9M3.5 21h8"/>',
  check: '<path d="M5.5 17l7 7 14-15"/>',
  // 상태 표시
  rock: '<path d="M4 25l3-11 6-7 8 1 6 7 2 10z"/><path d="M13 7.5l2 8-4 4M21 8.5l-3 7 4 4M15 15.5l1 9"/>',
  turtle: '<path d="M6.5 22a9.5 9 0 0119 0z"/><path d="M12.5 22l1.5-8M19 22l-1.5-8M9 17.5l14 0"/><path d="M25.5 18c3.5-1.5 5 .5 4.5 2.5-.5 1.5-2.5 1.5-4 .5M9 22l-2.5 4M23 22l2.5 4M6.5 20l-3 1.5"/>',
  forbid: '<circle cx="16" cy="16" r="11.5"/><path d="M8 24L24 8"/>',
  crown: '<path d="M4.5 24l-1.5-13 7.5 6 5.5-10 5.5 10 7.5-6-1.5 13z"/><path d="M5 27.5h22"/>',
  bolt: '<path d="M19 3L8 18.5h7.5L13 29l11.5-16H17z"/>',
  sun: '<circle cx="16" cy="16" r="5.5"/><path d="M16 3.5v4M16 24.5v4M3.5 16h4M24.5 16h4M7.2 7.2l2.8 2.8M22 22l2.8 2.8M24.8 7.2L22 10M10 22l-2.8 2.8"/>',
  snow: '<path d="M16 3.5v25M5.2 9.8l21.6 12.4M26.8 9.8L5.2 22.2"/><path d="M12.5 5.5L16 8.5l3.5-3M12.5 26.5L16 23.5l3.5 3"/>',
  cactus: '<path d="M16 28V8.5a2.7 2.7 0 015.4 0V28M16 17.5h-5a2.4 2.4 0 01-2.4-2.4V11.5M21.4 21.5h4.2a2.4 2.4 0 002.4-2.4V15"/><path d="M4 28.5h24"/>',
  wave: '<path d="M3 14c3-5 5.5-5 8.5 0s5.5 5 8.5 0 5.5-5 9 0"/><path d="M3 21c3-5 5.5-5 8.5 0s5.5 5 8.5 0 5.5-5 9 0"/><path d="M3 28c3-5 5.5-5 8.5 0s5.5 5 8.5 0 5.5-5 9 0"/>',
  weather: '<path d="M9 24a5.5 5.5 0 01.5-11 7 7 0 0113.5 1.5A4.8 4.8 0 0122.5 24z"/><circle cx="24" cy="8" r="3"/><path d="M24 2v1.5M29.5 8H28M27.8 4.2l-1 1"/>',
  blind: '<path d="M3 15c6 7 20 7 26 0"/><path d="M8 19.5l-2.5 4M16 22v5M24 19.5l2.5 4"/>',
  coin: '<circle cx="16" cy="16" r="11.5"/><circle cx="16" cy="16" r="7.8"/><path d="M16 11.5v9M13 14.5h6"/>',
  zen: '<path d="M24.5 9.5a11 11 0 11-5.5-4.5"/><circle cx="16" cy="16" r="1.8" fill="currentColor"/>',
  eye: '<path d="M2.5 16c5-8 22-8 27 0-5 8-22 8-27 0z"/><circle cx="16" cy="16" r="4.5"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/>',
  brick: '<rect x="3.5" y="6.5" width="25" height="19" rx="1.5"/><path d="M3.5 12.8h25M3.5 19.2h25M12 6.5v6.3M21 12.8v6.4M12 19.2v6.3"/>',
  // 전설 카드 · 슬롯
  obelisk: '<path d="M12 28l1.5-18L16 4l2.5 6L20 28z"/><path d="M8.5 28h15"/><path d="M14 14h4"/>',
  clown: '<circle cx="16" cy="18" r="9.5"/><circle cx="16" cy="19" r="2.4" fill="currentColor"/><circle cx="12" cy="15" r="1.1" fill="currentColor"/><circle cx="20" cy="15" r="1.1" fill="currentColor"/><path d="M12 23.5c2 1.7 6 1.7 8 0M10 10.5l6-7.5 6 7.5"/>',
  chicken: '<path d="M7 25l7.5-7.5"/><path d="M5.5 22.5a2.5 2.5 0 103.5 3.5M10 27.5a2.5 2.5 0 003.5-3.5"/><path d="M13 17c-3-5 1-11.5 8-12 5-.3 8 4 6.5 8.5-1.5 5-8 7-11.5 5z"/>',
  sloth: '<path d="M2.5 6h27"/><path d="M10 6l3 8.5M22 6l-3 8.5"/><ellipse cx="16" cy="22" rx="8.5" ry="6.5"/><circle cx="13" cy="21" r="1.1" fill="currentColor"/><circle cx="19" cy="21" r="1.1" fill="currentColor"/><path d="M14 25c1.2.8 2.8.8 4 0"/>',
  slot: '<rect x="4.5" y="5.5" width="20" height="21" rx="2.5"/><rect x="8" y="10" width="13" height="7" rx="1"/><path d="M12.5 10v7M16.8 10v7M24.5 11h3.5v7"/><circle cx="28" cy="9" r="1.8" fill="currentColor"/><path d="M9 22h11"/>',
  cherry: '<circle cx="9.5" cy="22" r="5"/><circle cx="21.5" cy="23" r="5"/><path d="M9.5 17c1-6 6-11 14-12M21.5 18c.5-5 .5-9.5 2-13"/><path d="M23.5 5c3 0 5 1 6 3"/>',
  lemon: '<path d="M4 17c0-6.5 6-10.5 13-10 5.5.4 10 3.5 11.5 6.5 1 2-1 3.5-3 4 1 4-4.5 8-11 8-6 0-10.5-3-10.5-8.5z"/><path d="M11 12c2-2 4.5-2.8 7-2.2"/>',
  bell: '<path d="M6.5 24c3-2 3.5-5 3.5-9.5a6 6 0 0112 0c0 4.5.5 7.5 3.5 9.5z"/><path d="M16 5.5V8.5M13 26.5a3 3 0 006 0"/>',
  diamond: '<path d="M16 4l11 8-11 16L5 12z"/><path d="M5 12h22M11 12l5 16M21 12l-5 16M11 12l5-8 5 8"/>',
  seven: '<path d="M6 6.5h20L14 27"/><path d="M11.5 16.5h9"/>',
  party: '<path d="M4.5 27.5L10.5 10.5l11 11z"/><path d="M8.2 17.5l7 7"/><path d="M17 8c1-2 .5-3.5 2-4.5M24 12.5c2.5-.5 4-1.8 5-3.5M21 4v2.5M27 18h-3"/><circle cx="25.5" cy="5.5" r="1.2" fill="currentColor"/><circle cx="28" cy="22" r="1.2" fill="currentColor"/>',
  // 시작 능력
  umbrella: '<path d="M3.5 16a12.5 11.5 0 0125 0z"/><path d="M16 4.5V3M16 16v9.5a2.8 2.8 0 005.6 0M10 16c0-5.5 2.5-9 6-11.5M22 16c0-5.5-2.5-9-6-11.5"/>',
  pouch: '<path d="M8.5 12c0-4 3-7 7.5-7s7.5 3 7.5 7"/><path d="M6 13c0-1.5 1-2.5 2.5-2.5h15c1.5 0 2.5 1 2.5 2.5v13.5c0 1.5-1 2.5-2.5 2.5h-15C7 29 6 28 6 26.5z"/><rect x="10.5" y="19" width="11" height="6" rx="1.5"/><path d="M12 15.5h8"/>',
  clover: '<circle cx="12" cy="11" r="4.8"/><circle cx="20" cy="11" r="4.8"/><circle cx="12" cy="19" r="4.8"/><circle cx="20" cy="19" r="4.8"/><path d="M16 15v14"/>',
  castle: '<path d="M5 28V10h4.5v3h3V10h2.5v3h3V10h4.5V28zM3.5 28h25"/><path d="M5 10V6.5h4.5V10M22.5 10V6.5H27V10"/><path d="M13 28v-6a3 3 0 016 0v6"/>',
  // 맵
  plain: '<path d="M2.5 26l8.5-11 6 7.5 4-4.5 8.5 8z"/><circle cx="23" cy="8" r="3.5"/><path d="M2.5 28.5h27"/>',
  space: '<path d="M21 4.5a11.5 11.5 0 100 23 9.5 9.5 0 010-23z"/><path d="M26 6v5M23.5 8.5h5M27.5 18v3M26 19.5h3"/>',
  rain: '<path d="M9 18a5.5 5.5 0 01.5-11 7 7 0 0113.5 1.5A4.8 4.8 0 0122.5 18z"/><path d="M10 22l-2 4.5M16.5 22l-2 4.5M23 22l-2 4.5"/>'
};
ICON_PATHS.retry = ICON_PATHS.reroll;

function ico(name, extra) {
  if (!ICON_PATHS[name]) return '';
  return '<svg class="ic' + (extra ? ' ' + extra : '') + '" viewBox="0 0 32 32" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
}
// '[[이름]]' 을 아이콘으로 바꾼 HTML (나머지 글자는 그대로)
function H(s) { return String(s == null ? '' : s).replace(/\[\[(\w+)\]\]/g, function (m, n) { return ico(n) || m; }); }

(function mountIcons() {
  var sym = Object.keys(ICON_PATHS).map(function (n) { return '<symbol id="i-' + n + '" viewBox="0 0 32 32">' + ICON_PATHS[n] + '</symbol>'; }).join('');
  var defs = '<filter id="rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter>';
  var holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = '<svg width="0" height="0" aria-hidden="true"><defs>' + defs + '</defs>' + sym + '</svg>';
  document.body.insertBefore(holder, document.body.firstChild);
})();
// index.html 의 data-ico="이름" 요소 앞에 아이콘을 붙임 (뒤의 글자는 그대로)
function applyIcons() {
  [].forEach.call(document.querySelectorAll('[data-ico]'), function (el) {
    var old = el.querySelector(':scope > svg.ic'); if (old) old.remove();
    el.insertAdjacentHTML('afterbegin', ico(el.dataset.ico));
  });
}
