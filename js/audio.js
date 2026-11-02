/* 소리 — WebAudio 로 만든 효과음 (외부 파일 없음) */
'use strict';

/* ---------------- 소리 (WebAudio, 외부 파일 없음) ---------------- */
var actx = null;
function ac() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
  return actx;
}
function tone(f0, f1, dur, type, vol) {
  var a = ac(); if (!a) return;
  var o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f0, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), a.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.2, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
}
function noise(dur, vol, cutoff) {
  var a = ac(); if (!a) return;
  var len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  var s = a.createBufferSource(); s.buffer = buf;
  var f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 1200;
  var g = a.createGain(); g.gain.value = vol || 0.3;
  s.connect(f); f.connect(g); g.connect(a.destination); s.start();
}
function sfx(k) {
  if (k === 'place') { tone(190, 70, 0.14, 'sine', 0.35); noise(0.05, 0.12, 2500); }
  else if (k === 'card') { noise(0.09, 0.15, 3500); tone(420, 300, 0.08, 'triangle', 0.08); }
  else if (k === 'boom') { noise(0.5, 0.45, 700); tone(110, 35, 0.45, 'sine', 0.4); }
  else if (k === 'burn') { noise(1.0, 0.28, 1600); tone(260, 50, 0.7, 'sawtooth', 0.04); }
  else if (k === 'magic') { tone(500, 1200, 0.35, 'sine', 0.12); }
  else if (k === 'win') { tone(392, 392, 0.2, 'triangle', 0.18); setTimeout(function () { tone(523, 523, 0.2, 'triangle', 0.18); }, 160); setTimeout(function () { tone(659, 659, 0.5, 'triangle', 0.2); }, 320); }
}
