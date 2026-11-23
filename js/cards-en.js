/* 카드 영어 번역 — 언어가 English 일 때 카드 앞면(이름 · 분류 · 설명 · 아래 문구)에 씀 */
'use strict';

var CARD_EN = {
  chain: ['Chain Move', 'Place 3 stones this turn\n(not within 2 cells of\nthis turn\'s stones)'],
  windmill: ['Windmill', 'Turn one of your stones\ninto a windmill. The foe\ncan\'t play in the 8 cells\naround it.'],
  alkkagi: ['Flick', 'Enter flick mode\nfor two of your turns.'],
  bomb: ['Bomb', 'Remove 1 enemy stone.\nThat cell is blocked\nfor 2 turns.'],
  trade: ['Swap', 'Swap colors of an adjacent\nblack-white pair\n(not on a winning line)'],
  infection: ['Infection', 'Turn 2 adjacent\nenemy stones into yours\n(not on a winning line)'],
  reversal: ['Reversal', 'Swap every black\nand white stone\n(shielded ones stay)'],
  teleport: ['Teleport', 'Move 1 of your stones\nto a random empty cell'],
  earthquake: ['Earthquake', 'Shake the board and\nscatter every stone.'],
  meteor: ['Meteor', 'Destroy 1\nrandom stone.'],
  sixsense: ['Sixth Sense', 'Winning now needs\n6 in a row, for good'],
  wall: ['Wall', 'Raise one\npermanent wall.'],
  trap: ['Trap', 'Set a hidden trap. If the\nfoe plays on it, the stone\nis destroyed and you get\na random normal card.'],
  snipe: ['Snipe', 'Remove 2 random\nenemy stones'],
  double: ['1+1', 'Get 2 random\nnormal cards.'],
  giant: ['Giant Stone', 'Your next stone becomes\na 3x3 neutral boulder.'],
  weather: ['Freak Weather', 'Change the map to\nanother random map'],
  shield: ['Shield', 'Protect the 3×3 area\naround your stone.'],
  blockade: ['Blockade', 'Cancel the foe\'s\nnext card.'],
  obelisk: ['Gomoku Colossus', 'Sacrifice 3 of your\nstones to destroy\na whole line'],
  nothing: ['Nonpossession', 'When the foe plays a card,\ndiscard your whole hand\nto cancel it.'],
  latebloom: ['Late Bloomer', 'Usable after 40+ moves\nthis game. Place\n5 stones in a row.'],
  blind: ['Blindness', 'For 5 turns the foe\ncan\'t see the board.'],
  clown: ['Clown\'s Gambit', 'If the foe took 3+ of\nyour stones, put every\nlost stone back.'],
  sloth: ['Sloth', 'Play every card in\nyour hand at once.'],
  mirror: ['Copycat', 'Use the card the\nfoe played last.'],
  allin: ['All In', 'Bet your hand or 3+ stones\nand spin the slots. On a\njackpot, that many stones\nland on random cells.'],
  turtle: ['Tortoise & Hare', 'Usable if the foe has 5+\nmore stones than you.\nYou then win\nwith 4 in a row.'],
  king: ['Return of the King', 'Make one stone a king.\nIf it survives 20 turns,\nfill your hand and get\na new legend card.'],
  map_classic: ['Plains', 'A calm field\nwith no disasters'],
  map_summer: ['Summer', 'Every 5 rounds one black\nand one white stone\nmelt away'],
  map_winter: ['Winter', 'Every 5 rounds a stone\nfreezes for 2 rounds'],
  map_space: ['Space', 'Board edges wrap\nto the other side\n(wormhole)'],
  map_desert: ['Desert', 'Sandstorm every\n4 rounds from\nround 8'],
  map_rain: ['Monsoon', 'Flicks are slippery and\nearthquakes bring a\ntsunami to the edges'],
  ab_umbrella: ['Disaster Immunity', 'Map disasters\ndon\'t happen'],
  ab_pouch: ['Deep Pouch', 'Hold up to\n5 cards'],
  ab_clover: ['Lucky', 'Pick cards\nfrom 4 choices'],
  ab_sturdy: ['Sturdy Start', 'Your first 3 stones are\nforever safe from cards'],
  ab_retry: ['Second Chance', 'Reroll\nup to 3 times']
};
var CAT_EN = { '공격': 'Attack', '방해': 'Disrupt', '희귀': 'Rare', '무작위': 'Random', '규칙': 'Rule', '지형': 'Terrain', '보급': 'Supply', '수비': 'Defense', '전설': 'Legend', '대응': 'Counter', '날씨': 'Weather', '시작 능력': 'Start ability' };
var FOOT_EN = { '턴 종료': 'Ends turn', '턴 유지': 'Keeps turn', '상대 카드에 대응': 'Counter', '턴마다 1번': 'Once per turn', '판마다 1번': 'Once per game', '이번 판의 날씨': 'This game', '양쪽 모두': 'Both sides' };

// 지금 언어에 맞는 카드 글자 (분류 색은 원래 분류로 고름)
function cardText(id) {
  var c = CARDS[id], foot = c.foot ? c.foot : c.legend ? (c.react ? '상대 카드에 대응' : id === 'allin' ? '턴마다 1번' : '판마다 1번') : (c.endsTurn ? '턴 종료' : '턴 유지');
  var en = lang === 'en' && CARD_EN[id];
  return en ? { name: en[0], desc: en[1], cat: CAT_EN[c.cat] || c.cat, foot: FOOT_EN[foot] || foot }
            : { name: c.name, desc: c.desc, cat: c.cat, foot: foot };
}

// 전설 카드 사용 조건 · 맵 한 줄 설명 (영어)
var LEGEND_COND_EN = { obelisk: '3+ of my stones', nothing: 'the foe plays a card', latebloom: '40+ moves this game', blind: 'none', clown: 'lost 3+ stones to the foe',
  sloth: '1+ card in hand', mirror: 'the foe has played a card', allin: 'a card in hand or 3+ stones', turtle: 'the foe has 5+ more stones', king: 'a stone of mine on the board' };
var MAP_SHORT_EN = { classic: 'no disasters', summer: 'every 5 rounds one black and one white stone melt', winter: 'every 5 rounds a stone freezes for 2 rounds',
  space: 'wormhole: board edges wrap around', desert: 'sandstorm every 4 rounds from round 8', rain: 'slippery flicks · tsunami after earthquakes' };
function mapShort(mp) { return lang === 'en' && MAP_SHORT_EN[mp.id] ? MAP_SHORT_EN[mp.id] : mp.short; }
