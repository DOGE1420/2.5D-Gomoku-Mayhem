/* 언어(한국어/English) · 설정 상태(움직임 줄이기) — 메인 화면과 기본 버튼·차례 표시를 번역함
 * (카드 앞면은 js/cards-en.js 로 번역 · 토스트 같은 게임 메시지는 한국어 그대로) */
'use strict';

var lang = 'ko';
try { lang = localStorage.getItem('omok_lang') === 'en' ? 'en' : 'ko'; } catch (e) {}

var I18N = {
  ko: {
    'title': '증강 오목', 'loading': '방을 불러오는 중…', 'sub': '3수마다 카드 1장 · 턴마다 카드 1장 사용',
    'lang.toggle': 'English', 'lang.aria': '언어 바꾸기', 'settings': '설정',
    'settings.bgm': '[[music]] 배경 음악', 'settings.bgmMute': '배경 음악 끄기/켜기',
    'mode.tut': '튜토리얼', 'mode.tut.desc': '1분 만에 규칙 익히기',
    'mode.local': '로컬 모드', 'mode.local.desc': '한 기기에서 둘이',
    'mode.camp': '캠페인', 'mode.camp.desc': '상대를 차례로 꺾기', 'camp.learn': '배울 것:', 'camp.locked': '앞의 상대를 이기면 열림', 'camp.go': '시작', 'camp.next': '다음 상대', 'camp.retry': '다시 도전', 'camp.continue': '계속', 'camp.end': '캠페인 완료', 'camp.round1': '첫 번째 판', 'camp.round2': '두 번째 판',
    'mode.bot': '울트라 짱짱 봇전', 'note.botLocked': '캠페인 마지막 상대(딜러)를 이기면 열립니다.', 'camp.unlock': '…그래, 약속대로다. 울트라 짱짱 봇전이 열렸다. 언제든 다시 덤벼라.', 'mode.bot.desc': 'AI와 대결', 'mode.bot.soon': '준비 중',
    'mode.mp': '멀티플레이', 'mode.mp.desc': '온라인 대결',
    'note.bot': '봇 대전은 아직 준비 중입니다. 지금은 로컬 모드나 튜토리얼을 이용해 주세요.',
    'bot.lv': '{n}단계', 'bot.ultimate': '얼티밋', 'side.first': '선공 (흑)', 'side.second': '후공 (백)', 'side.random': '랜덤', 'back': '← 메뉴로', 'first': '선공', 'first.random': '[[dice]] 랜덤', 'first.me': '내가 먼저', 'first.opp': '상대 먼저',
    'room.create': '새 방 만들기', 'or': '또는', 'room.code': '방 코드 입력', 'room.join': '코드로 참가하기', 'room.codeLabel': '방 코드 (상대에게 알려 주세요)',
    'lobby.unavailable': '온라인 서버 연결은 아직 준비 중입니다. 지금은 로컬 모드로 즐겨 주세요.', 'lobby.noCode': '방 코드를 입력해 주세요.',
    'tut.1': '① 같은 색 돌 5개를 한 줄로 놓으면 승리! 판의 빈 칸을 눌러 위에서 내려다보는 화면으로 가서 흑 5개를 완성하세요.',
    'tut.2': '② 백이 양쪽이 열린 4! 돌 하나로는 못 막아요. 아래 패의 [[brick]] 장벽 카드를 눌러 확대하고, 한 번 더 눌러 발동해 한쪽을 막은 뒤 돌로 다른 쪽을 막으세요.',
    'tut.1.retry': '5개가 한 줄로 이어지지 않았어요. 다시 해 봐요!', 'tut.2.retry': '아직 백이 이길 수 있어요. 다시 해 봐요!', 'tut.2.wall': '장벽은 백의 4 양 끝 중 한 곳에 둬야 해요. 다시 해 봐요!',
    'tut.3': '③ 끝! 3수마다 카드 1장을 고르고, 턴마다 1장 쓸 수 있어요. 카드는 패에서 눌러 확대한 뒤 한 번 더 누르면 발동합니다.', 'tut.play': '견습생과 대결',
    'settings.lang': '언어', 'settings.giveup': '새 게임', 'settings.giveup.sure': '정말 포기할까요?', 'settings.menu': '메뉴로 나가기', 'banner.resign': '{who} 포기 — {winner} 승리', 'btn.restart': '새 게임', 'btn.viewBoard': '[[search]] 판 보기', 'btn.viewCards': '[[cards]] 카드 보기', 'btn.again': '다시 하기', 'btn.menu': '메뉴로',
    'turn.black': '[[black]] 흑 차례', 'turn.white': '[[white]] 백 차례', 'turn.alk': '[[flick]] {who} 알까기', 'who.black': '[[black]] 흑', 'who.white': '[[white]] 백',
    'banner.win': '{who} 승리!', 'banner.draw': '무승부', 'reroll': '[[reroll]] 다시 뽑기 ({n}회 남음)'
  },
  en: {
    'title': 'Gomoku-Mayhem', 'loading': 'Loading the room…', 'sub': 'A card every 3 stones · one card per turn',
    'lang.toggle': '한국어', 'lang.aria': 'Change language', 'settings': 'Settings',
    'settings.bgm': '[[music]] Music', 'settings.bgmMute': 'Mute / unmute music',
    'mode.tut': 'Tutorial', 'mode.tut.desc': 'Learn the rules in a minute',
    'mode.local': 'Local', 'mode.local.desc': 'Two players, one device',
    'mode.camp': 'Campaign', 'mode.camp.desc': 'Defeat each opponent in turn', 'camp.learn': 'Learn:', 'camp.locked': 'Beat the previous opponent to unlock', 'camp.go': 'Start', 'camp.next': 'Next opponent', 'camp.retry': 'Try again', 'camp.continue': 'Continue', 'camp.end': 'Campaign complete', 'camp.round1': 'Game 1', 'camp.round2': 'Game 2',
    'mode.bot': 'Ultra Mega Bot Battle', 'note.botLocked': 'Beat the last campaign opponent (the Dealer) to unlock.', 'camp.unlock': '…As promised. The Ultra Mega Bot Battle is open. Come at me any time.', 'mode.bot.desc': 'Play against the AI', 'mode.bot.soon': 'Coming soon',
    'mode.mp': 'Multiplayer', 'mode.mp.desc': 'Play online',
    'note.bot': 'Bot matches are coming soon. Try Local mode or the Tutorial for now.',
    'bot.lv': 'Level {n}', 'bot.ultimate': 'Ultimate', 'side.first': 'First (Black)', 'side.second': 'Second (White)', 'side.random': 'Random', 'back': '← Menu', 'first': 'First', 'first.random': '[[dice]] Random', 'first.me': 'Me first', 'first.opp': 'Opponent first',
    'room.create': 'Create room', 'or': 'or', 'room.code': 'Enter room code', 'room.join': 'Join with code', 'room.codeLabel': 'Room code (share with your opponent)',
    'lobby.unavailable': 'Online play is not available yet. Try Local mode for now.', 'lobby.noCode': 'Please enter a room code.',
    'tut.1': '① Put 5 stones of one color in a row to win! Click the board to look down on it, then complete 5 black stones.',
    'tut.2': '② White has an open four! One stone cannot stop it. Click the [[brick]] Wall card to enlarge it, click again to use it and block one end, then block the other end with a stone.',
    'tut.1.retry': 'That is not 5 in a row. Try again!', 'tut.2.retry': 'White can still win. Try again!', 'tut.2.wall': 'Put the wall on one end of White\'s four. Try again!',
    'tut.3': '③ Done! Pick a card every 3 stones and use one per turn. Click a card to enlarge it, click again to play it.', 'tut.play': 'Face the Apprentice',
    'settings.lang': 'Language', 'settings.giveup': 'New game', 'settings.giveup.sure': 'Really give up?', 'settings.menu': 'Back to menu', 'banner.resign': '{who} gave up — {winner} wins', 'btn.restart': 'New game', 'btn.viewBoard': '[[search]] Board', 'btn.viewCards': '[[cards]] Cards', 'btn.again': 'Play again', 'btn.menu': 'Menu',
    'turn.black': '[[black]] Black to play', 'turn.white': '[[white]] White to play', 'turn.alk': '[[flick]] {who} flick', 'who.black': '[[black]] Black', 'who.white': '[[white]] White',
    'banner.win': '{who} wins!', 'banner.draw': 'Draw', 'reroll': '[[reroll]] Reroll ({n} left)'
  }
};
function t(key, p) {
  var s = (I18N[lang] && I18N[lang][key]) || I18N.ko[key] || key;
  if (p) for (var k in p) s = s.split('{' + k + '}').join(p[k]);
  return s;
}
