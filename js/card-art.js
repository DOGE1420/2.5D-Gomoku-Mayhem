/* 카드 그림 — 손그림 잉크 · 양피지 · 카드 21장 텍스처 (인스크립션 풍) */
'use strict';

/* ---------------- 카드 3D ---------------- */
var handGroup = new THREE.Group();
handGroup.position.set(0, 0, -6.5);
camera.add(handGroup);
var cardGeo = new THREE.PlaneGeometry(1.5, 2.25);
var texCache = {};
var cardMeshes = [];
var hoverCard = -1, inspectIdx = -1, handUp = false;   // handUp: 패 쪽을 보면 패 전체가 위로 올라옴       // inspectIdx: 크게 확대해서 보는 중인 카드
// 확대 보기 때 나머지 화면을 어둡게 (일반 카드보다 앞, 확대 카드보다 뒤)
var dimMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
dimMesh.position.z = 0.5; dimMesh.visible = false; handGroup.add(dimMesh);

function wrapText(g, text, maxW) {
  var out = [];
  text.split('\n').forEach(function (line) {
    var cur = '';
    for (var i = 0; i < line.length; i++) {
      var t = cur + line[i];
      if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = line[i]; } else cur = t;
    }
    out.push(cur);
  });
  return out;
}
/* ---------- 카드 아트: 손그림 잉크 + 낡은 양피지 (인스크립션 풍) ---------- */
var INK = '#1b1209';
function rnd(a, b) { return a + Math.random() * (b - a); }
// 선분을 잘게 나눠 손으로 그은 듯 흔들리게
function roughen(pts, step, jit, closed) {
  var out = [], n = pts.length, last = closed ? n : n - 1;
  for (var i = 0; i < last; i++) {
    var a = pts[i], b = pts[(i + 1) % n];
    var len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(len / step));
    for (var j = 0; j < k; j++) {
      var t = j / k;
      out.push([a[0] + (b[0] - a[0]) * t + rnd(-jit, jit), a[1] + (b[1] - a[1]) * t + rnd(-jit, jit)]);
    }
  }
  if (!closed) out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}
function inkPath(g, pts, w, o) {
  o = o || {};
  var p = roughen(pts, 9, o.jit == null ? 1.3 : o.jit, o.closed);
  for (var pass = 0; pass < 2; pass++) {           // 두 번 덧그어 잉크 번짐 느낌
    g.lineWidth = pass ? w * 0.55 : w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = INK; g.globalAlpha = pass ? 0.55 : 0.92;
    g.beginPath();
    p.forEach(function (q, i) { var x = q[0] + (pass ? rnd(-0.9, 0.9) : 0), y = q[1] + (pass ? rnd(-0.9, 0.9) : 0); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    if (o.closed) g.closePath();
    if (o.fill && !pass) { g.fillStyle = INK; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 0.92; }
    g.stroke();
  }
  g.globalAlpha = 1;
}
function circlePts(cx, cy, r, n, squish) {
  var p = []; for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * r * (squish || 1) + rnd(-1, 1), cy + Math.sin(a) * r + rnd(-1, 1)]); }
  return p;
}
function sparkle(g, x, y, r) {
  inkPath(g, [[x, y - r], [x + r * 0.22, y - r * 0.22], [x + r, y], [x + r * 0.22, y + r * 0.22], [x, y + r], [x - r * 0.22, y + r * 0.22], [x - r, y], [x - r * 0.22, y - r * 0.22]], 2.2, { closed: true, fill: true, jit: 0.5 });
}
function runeGlyph(g, cx, cy, s) {
  var n = 3 + Math.floor(Math.random() * 3), pts = [];
  inkPath(g, [[cx, cy - s], [cx, cy + s]], 3.2, { jit: 0.8 });
  for (var i = 0; i < n; i++) {
    var y = cy + rnd(-s, s * 0.6), d = Math.random() < 0.5 ? -1 : 1;
    inkPath(g, [[cx, y], [cx + d * rnd(s * 0.4, s * 0.9), y + rnd(-s * 0.5, s * 0.5)]], 3, { jit: 0.8 });
  }
}
var ART = {
  chain: function (g, cx, cy) {           // 번개 3줄
    function bolt(ox, oy, k) {
      inkPath(g, [[ox + 18 * k, oy - 90 * k], [ox - 28 * k, oy + 8 * k], [ox + 4 * k, oy + 8 * k], [ox - 22 * k, oy + 92 * k], [ox + 38 * k, oy - 18 * k], [ox + 6 * k, oy - 18 * k], [ox + 34 * k, oy - 90 * k]], 3.2, { closed: true, fill: true });
    }
    bolt(cx, cy, 1); bolt(cx - 78, cy + 22, 0.55); bolt(cx + 80, cy + 22, 0.55);
    [[-100, -58], [100, -58], [-62, 78], [62, 78]].forEach(function (d) { inkPath(g, [[cx + d[0], cy + d[1]], [cx + d[0] * 0.8, cy + d[1] * 0.8 + 14]], 2.4); });
  },
  bomb: function (g, cx, cy) {            // 폭발 + 폭탄
    var burst = [], n = 16;
    for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2, r = i % 2 ? 66 : 108; burst.push([cx + Math.cos(a) * r, cy + 8 + Math.sin(a) * r]); }
    inkPath(g, burst, 2.6, { closed: true, jit: 1.6 });
    inkPath(g, circlePts(cx, cy + 14, 50, 22), 3.4, { closed: true, fill: true });
    inkPath(g, [[cx + 22, cy - 28], [cx + 40, cy - 52], [cx + 62, cy - 52]], 3.6);
    sparkle(g, cx + 70, cy - 56, 15);
    g.save(); g.fillStyle = '#d9c79a'; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(cx - 18, cy + 2, 14, 8, -0.7, 0, 7); g.fill(); g.restore();
  },
  teleport: function (g, cx, cy) {        // 소용돌이 포탈 + 돌 두 개
    for (var r = 70, k = 0; k < 4; r -= 17, k++) inkPath(g, circlePts(cx, cy, r, 26, 1.2), 3.2 - k * 0.5, { closed: true, jit: 1.5 });
    inkPath(g, circlePts(cx, cy, 8, 10), 3, { closed: true, fill: true });
    inkPath(g, circlePts(cx - 98, cy + 60, 17, 14, 1.2), 3, { closed: true, fill: true });
    inkPath(g, circlePts(cx + 98, cy - 60, 17, 14, 1.2), 3, { closed: false });
    g.save(); g.setLineDash([2, 9]); inkPath(g, [[cx - 84, cy + 46], [cx - 20, cy - 96], [cx + 84, cy - 78]], 3); g.restore();
    sparkle(g, cx - 70, cy - 70, 14); sparkle(g, cx + 62, cy + 78, 11);
  },
  wall: function (g, cx, cy) {            // 벽돌 담
    var bw = 62, bh = 36, x0 = cx - 2 * bw, y0 = cy - 2 * bh;
    for (var row = 0; row < 4; row++) {
      var off = row % 2 ? bw / 2 : 0;
      for (var col = -1; col < 4; col++) {
        var x = x0 + col * bw + off, w = bw; if (x < x0) { w -= (x0 - x); x = x0; } if (x + w > x0 + 4 * bw) w = x0 + 4 * bw - x; if (w < 12) continue;
        var y = y0 + row * bh;
        inkPath(g, [[x, y], [x + w, y], [x + w, y + bh], [x, y + bh]], 3, { closed: true, jit: 1.3 });
        if ((row + col) % 3 === 0) for (var h = 0; h < 3; h++) inkPath(g, [[x + 6 + h * 8, y + bh - 5], [x + 14 + h * 8, y + 7]], 1.6, { jit: 0.4 });
      }
    }
    inkPath(g, [[x0 - 16, y0 + 4 * bh + 6], [x0 + 4 * bw + 16, y0 + 4 * bh + 6]], 4);
  },
  sixsense: function (g, cx, cy) {        // 눈 + 광선
    var top = [], bot = [];
    for (var i = 0; i <= 14; i++) { var t = i / 14, x = cx - 100 + 200 * t, y = Math.sin(t * Math.PI) * 62; top.push([x, cy - y]); bot.push([x, cy + y * 0.8]); }
    inkPath(g, top.concat(bot.reverse()), 3.6, { closed: true, jit: 1.1 });
    inkPath(g, circlePts(cx, cy, 36, 20), 3.4, { closed: true });
    inkPath(g, circlePts(cx, cy, 17, 14), 3, { closed: true, fill: true });
    g.save(); g.fillStyle = '#d9c79a'; g.globalAlpha = 0.9; g.beginPath(); g.arc(cx - 7, cy - 7, 5, 0, 7); g.fill(); g.restore();
    for (var k = 0; k < 9; k++) { var a = -Math.PI + (k + 0.5) / 9 * Math.PI; inkPath(g, [[cx + Math.cos(a) * 70, cy - 62 + Math.sin(a) * 20], [cx + Math.cos(a) * 94, cy - 70 + Math.sin(a) * 30]], 2.6); }
    inkPath(g, [[cx - 40, cy + 82], [cx - 40, cy + 108]], 2.6); inkPath(g, [[cx + 40, cy + 82], [cx + 40, cy + 108]], 2.6);
  },
  reversal: function (g, cx, cy) {        // 음양 + 화살
    var r = 78;
    inkPath(g, circlePts(cx, cy, r, 30), 3.6, { closed: true });
    g.save(); g.fillStyle = INK; g.globalAlpha = 0.92; g.beginPath();
    g.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false); g.arc(cx, cy + r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(cx, cy - r / 2, r / 2, Math.PI / 2, -Math.PI / 2, false);
    g.fill(); g.restore();
    inkPath(g, circlePts(cx, cy - r / 2, 9, 10), 2.6, { closed: true, fill: false });
    inkPath(g, circlePts(cx, cy + r / 2, 9, 10), 2.6, { closed: true, fill: true });
    g.save(); g.fillStyle = '#d9c79a'; g.beginPath(); g.arc(cx, cy + r / 2, 8, 0, 7); g.fill(); g.restore();
    inkPath(g, [[cx - 98, cy - 30], [cx - 108, cy], [cx - 98, cy + 30]], 3);
    inkPath(g, [[cx - 114, cy - 12], [cx - 108, cy], [cx - 94, cy - 4]], 3);
    inkPath(g, [[cx + 98, cy + 30], [cx + 108, cy], [cx + 98, cy - 30]], 3);
    inkPath(g, [[cx + 114, cy + 12], [cx + 108, cy], [cx + 94, cy + 4]], 3);
  }
  ,
  windmill: function (g, cx, cy) {         // 풍차: 탑 + 날개 4개
    var hx = cx, hy = cy + 12, hub = hy - 30;
    inkPath(g, [[hx - 28, hy + 92], [hx - 15, hy - 24], [hx + 15, hy - 24], [hx + 28, hy + 92]], 3.4, { closed: true });
    inkPath(g, [[hx - 40, hy + 92], [hx + 40, hy + 92]], 3.6);
    for (var k = 0; k < 4; k++) {
      var a = k * Math.PI / 2 + 0.45, ex = hx + Math.cos(a) * 84, ey = hub + Math.sin(a) * 84, nx = -Math.sin(a) * 17, ny = Math.cos(a) * 17;
      inkPath(g, [[hx, hub], [ex - nx * 0.2, ey - ny * 0.2], [ex + nx, ey + ny], [hx + nx * 0.35, hub + ny * 0.35]], 3, { closed: true });
      inkPath(g, [[hx, hub], [ex, ey]], 2);
    }
    inkPath(g, circlePts(hx, hub, 9, 10), 3, { closed: true, fill: true });
  },
  alkkagi: function (g, cx, cy) {          // 알까기: 돌이 돌을 튕김
    inkPath(g, circlePts(cx - 68, cy + 44, 36, 20), 3.4, { closed: true, fill: true });
    inkPath(g, circlePts(cx + 52, cy - 26, 36, 20), 3.4, { closed: true });
    inkPath(g, [[cx - 34, cy + 24], [cx + 8, cy + 0]], 3);
    sparkle(g, cx - 4, cy + 8, 16);
    inkPath(g, [[cx + 96, cy + 14], [cx + 124, cy - 8]], 2.6); inkPath(g, [[cx + 100, cy + 40], [cx + 130, cy + 30]], 2.6);
    g.save(); g.setLineDash([2, 9]); inkPath(g, [[cx - 118, cy + 98], [cx - 92, cy + 80]], 2.6); g.restore();
  },
  trade: function (g, cx, cy) {            // 맞교환: 두 돌이 자리를 바꿈
    inkPath(g, circlePts(cx - 64, cy + 34, 34, 20), 3.4, { closed: true, fill: true });
    inkPath(g, circlePts(cx + 64, cy + 34, 34, 20), 3.4, { closed: true });
    var top = [], bot = [];
    for (var i = 0; i <= 12; i++) { var t = i / 12; top.push([cx - 64 + 128 * t, cy - 8 - 46 * Math.sin(Math.PI * t)]); bot.push([cx + 64 - 128 * t, cy + 76 + 46 * Math.sin(Math.PI * t)]); }
    inkPath(g, top, 3); inkPath(g, bot, 3);
    inkPath(g, [[cx + 46, cy - 14], [cx + 64, cy - 8], [cx + 62, cy - 28]], 3);
    inkPath(g, [[cx - 46, cy + 98], [cx - 64, cy + 76], [cx - 44, cy + 74]], 3);
  },
  infection: function (g, cx, cy) {        // 감염: 병균에 물든 돌
    inkPath(g, circlePts(cx, cy + 6, 42, 22), 3.4, { closed: true, fill: true });
    for (var k = 0; k < 10; k++) {
      var a = k / 10 * Math.PI * 2, x1 = cx + Math.cos(a) * 42, y1 = cy + 6 + Math.sin(a) * 42, x2 = cx + Math.cos(a) * 72, y2 = cy + 6 + Math.sin(a) * 72;
      inkPath(g, [[x1, y1], [x2, y2]], 3); inkPath(g, circlePts(x2, y2, 7, 8), 2.6, { closed: true, fill: true });
    }
    g.save(); g.fillStyle = '#d9c79a'; g.globalAlpha = 0.85; g.beginPath(); g.arc(cx - 14, cy - 8, 6, 0, 7); g.arc(cx + 12, cy + 18, 4, 0, 7); g.fill(); g.restore();
  },
  earthquake: function (g, cx, cy) {       // 지진: 갈라지는 땅과 흔들리는 돌
    inkPath(g, [[cx - 128, cy + 52], [cx - 60, cy + 56], [cx - 30, cy + 78], [cx + 0, cy + 54], [cx + 38, cy + 82], [cx + 70, cy + 56], [cx + 128, cy + 60]], 3.6);
    inkPath(g, [[cx - 30, cy + 78], [cx - 40, cy + 104]], 3); inkPath(g, [[cx + 38, cy + 82], [cx + 30, cy + 108]], 3);
    inkPath(g, circlePts(cx - 70, cy + 22, 26, 16), 3.2, { closed: true, fill: true });
    inkPath(g, circlePts(cx + 8, cy - 8, 26, 16), 3.2, { closed: true });
    inkPath(g, circlePts(cx + 84, cy + 24, 26, 16), 3.2, { closed: true, fill: true });
    [[-98, 2], [-98, 20], [112, 6], [112, 24], [-10, -44], [26, -44]].forEach(function (d) { inkPath(g, [[cx + d[0], cy + d[1]], [cx + d[0] + (d[0] < 0 ? -14 : 14) * (d[1] === -44 ? 0 : 1), cy + d[1] + (d[1] === -44 ? -10 : 0)]], 2.6); });
  },
  meteor: function (g, cx, cy) {           // 운석: 불꼬리를 단 바위
    inkPath(g, [[cx + 6, cy - 4], [cx - 96, cy - 84], [cx - 60, cy - 30], [cx - 118, cy - 40], [cx - 52, cy + 6], [cx - 96, cy + 14], [cx - 32, cy + 36]], 3, { closed: true });
    inkPath(g, circlePts(cx + 38, cy + 30, 52, 14), 3.6, { closed: true, fill: true });
    g.save(); g.fillStyle = '#d9c79a'; g.globalAlpha = 0.8; g.beginPath(); g.arc(cx + 22, cy + 12, 7, 0, 7); g.arc(cx + 54, cy + 44, 5, 0, 7); g.arc(cx + 40, cy + 26, 4, 0, 7); g.fill(); g.restore();
  },
  trap: function (g, cx, cy) {             // 함정: 곰덫
    var up = [], dn = [];
    for (var i = 0; i <= 14; i++) { var t = i / 14, x = cx - 98 + 196 * t; up.push([x, cy + 14 - Math.sin(Math.PI * t) * 66]); dn.push([x, cy + 14 + Math.sin(Math.PI * t) * 52]); }
    inkPath(g, up, 3.6); inkPath(g, dn, 3.6);
    for (i = 1; i < 14; i += 2) { inkPath(g, [up[i], [up[i][0] + 8, up[i][1] + 22], up[i + 1]], 2.6, { fill: true }); inkPath(g, [dn[i], [dn[i][0] + 8, dn[i][1] - 20], dn[i + 1]], 2.6, { fill: true }); }
    inkPath(g, [[cx - 98, cy + 14], [cx + 98, cy + 14]], 2.4);
    inkPath(g, [[cx - 98, cy + 14], [cx - 124, cy + 52], [cx - 124, cy + 90]], 3);
    g.save(); g.setLineDash([2, 8]); inkPath(g, [[cx - 124, cy + 90], [cx - 40, cy + 100]], 2.4); g.restore();
  },
  snipe: function (g, cx, cy) {            // 저격: 조준경
    inkPath(g, circlePts(cx, cy + 6, 78, 30), 3.6, { closed: true });
    inkPath(g, circlePts(cx, cy + 6, 46, 24), 2.4, { closed: true });
    inkPath(g, [[cx - 108, cy + 6], [cx - 30, cy + 6]], 3); inkPath(g, [[cx + 30, cy + 6], [cx + 108, cy + 6]], 3);
    inkPath(g, [[cx, cy - 72], [cx, cy - 24]], 3); inkPath(g, [[cx, cy + 36], [cx, cy + 84]], 3);
    inkPath(g, circlePts(cx, cy + 6, 9, 10), 3, { closed: true, fill: true });
  },
  double: function (g, cx, cy) {           // 1+1: 카드 두 장
    inkPath(g, [[cx - 96, cy - 62], [cx - 8, cy - 62], [cx - 8, cy + 66], [cx - 96, cy + 66]], 3.4, { closed: true });
    inkPath(g, [[cx + 8, cy - 42], [cx + 96, cy - 42], [cx + 96, cy + 86], [cx + 8, cy + 86]], 3.4, { closed: true, fill: false });
    sparkle(g, cx - 52, cy + 2, 20); sparkle(g, cx + 52, cy + 22, 20);
    inkPath(g, [[cx - 8, cy + 8], [cx + 8, cy + 8]], 3); inkPath(g, [[cx, cy], [cx, cy + 16]], 3);
  },
  peek: function (g, cx, cy) {             // 엿보기: 돋보기 속의 눈
    inkPath(g, circlePts(cx - 14, cy - 6, 62, 28), 4, { closed: true });
    inkPath(g, [[cx + 32, cy + 38], [cx + 92, cy + 98]], 9);
    var t = [], b = [];
    for (var i = 0; i <= 10; i++) { var u = i / 10, x = cx - 14 - 40 + 80 * u, y = Math.sin(Math.PI * u) * 24; t.push([x, cy - 6 - y]); b.push([x, cy - 6 + y * 0.8]); }
    inkPath(g, t.concat(b.reverse()), 2.8, { closed: true });
    inkPath(g, circlePts(cx - 14, cy - 6, 12, 12), 2.8, { closed: true, fill: true });
  },
  giant: function (g, cx, cy) {            // 거대한 돌: 쩍 갈라진 바위
    inkPath(g, [[cx - 92, cy + 70], [cx - 108, cy + 6], [cx - 66, cy - 58], [cx - 8, cy - 78], [cx + 56, cy - 52], [cx + 104, cy + 10], [cx + 90, cy + 72]], 4, { closed: true, fill: false });
    inkPath(g, [[cx - 8, cy - 78], [cx - 22, cy - 20], [cx + 10, cy + 8], [cx - 4, cy + 72]], 3);
    inkPath(g, [[cx - 66, cy - 58], [cx - 40, cy - 8], [cx - 70, cy + 20]], 2.6);
    inkPath(g, [[cx + 56, cy - 52], [cx + 36, cy - 6], [cx + 66, cy + 28]], 2.6);
    [[-128, 84, 11], [118, 88, 9], [-112, 100, 7]].forEach(function (p) { inkPath(g, circlePts(cx + p[0], cy + p[1], p[2], 8), 2.6, { closed: true, fill: true }); });
  },
  ghost: function (g, cx, cy) {            // 투명한 돌: 유령
    var pts = [[cx - 58, cy + 86]];
    for (var i = 0; i <= 12; i++) { var a = Math.PI + i / 12 * Math.PI; pts.push([cx + Math.cos(a) * 58, cy - 8 + Math.sin(a) * 66]); }
    pts.push([cx + 58, cy + 86]);
    for (i = 0; i < 4; i++) { pts.push([cx + 58 - (i + 0.5) * 29, cy + 62]); pts.push([cx + 58 - (i + 1) * 29, cy + 86]); }
    inkPath(g, pts, 3.6, { closed: true });
    inkPath(g, circlePts(cx - 20, cy - 14, 9, 10), 2.6, { closed: true, fill: true }); inkPath(g, circlePts(cx + 20, cy - 14, 9, 10), 2.6, { closed: true, fill: true });
    inkPath(g, [[cx - 14, cy + 14], [cx, cy + 22], [cx + 14, cy + 14]], 2.8);
    g.save(); g.setLineDash([3, 8]); inkPath(g, circlePts(cx + 92, cy + 76, 22, 14), 2.6, { closed: true }); g.restore();
  },
  weather: function (g, cx, cy) {          // 기상 이변: 비구름과 번개
    var cl = [[cx - 80, cy + 20]];
    for (var i = 0; i <= 8; i++) { var a = Math.PI + i / 8 * Math.PI; cl.push([cx - 46 + Math.cos(a) * 36, cy + 4 + Math.sin(a) * 34]); }
    for (i = 0; i <= 8; i++) { var b = Math.PI * 1.25 + i / 8 * Math.PI * 0.95; cl.push([cx + 18 + Math.cos(b) * 50, cy - 6 + Math.sin(b) * 46]); }
    cl.push([cx + 90, cy + 20]);
    inkPath(g, cl, 3.6, { closed: true });
    [[-56, 44], [-26, 52], [10, 44], [44, 52], [70, 44]].forEach(function (p) { inkPath(g, [[cx + p[0], cy + p[1]], [cx + p[0] - 10, cy + p[1] + 28]], 2.8); });
    inkPath(g, [[cx + 8, cy + 30], [cx - 10, cy + 62], [cx + 4, cy + 62], [cx - 14, cy + 96]], 3.4, { fill: false });
  },
  shield: function (g, cx, cy) {           // 보호막: 방패
    inkPath(g, [[cx - 66, cy - 74], [cx + 66, cy - 74], [cx + 66, cy + 6], [cx, cy + 96], [cx - 66, cy + 6]], 4, { closed: true });
    inkPath(g, [[cx - 50, cy - 58], [cx + 50, cy - 58], [cx + 50, cy + 2], [cx, cy + 74], [cx - 50, cy + 2]], 2.4, { closed: true });
    inkPath(g, [[cx, cy - 58], [cx, cy + 74]], 2.8); inkPath(g, [[cx - 50, cy - 14], [cx + 50, cy - 14]], 2.8);
    inkPath(g, circlePts(cx, cy - 14, 14, 12), 3, { closed: true, fill: true });
  },
  blockade: function (g, cx, cy) {         // 봉쇄: 카드 위의 금지 표시
    inkPath(g, [[cx - 44, cy - 64], [cx + 44, cy - 64], [cx + 44, cy + 76], [cx - 44, cy + 76]], 3.4, { closed: true });
    inkPath(g, [[cx - 26, cy - 40], [cx + 26, cy - 40]], 2.4); inkPath(g, [[cx - 26, cy - 22], [cx + 14, cy - 22]], 2.4);
    inkPath(g, circlePts(cx, cy + 6, 84, 32), 6, { closed: true });
    inkPath(g, [[cx - 60, cy - 54], [cx + 60, cy + 66]], 6);
  }
    ,
    obelisk: function (g, cx, cy) {          // 오목의 거신병: 갈라진 거석 + 바친 돌 3개
      inkPath(g, [[cx - 34, cy + 86], [cx - 24, cy - 56], [cx, cy - 92], [cx + 24, cy - 56], [cx + 34, cy + 86]], 3.8, { closed: true });
      inkPath(g, [[cx - 24, cy - 56], [cx + 24, cy - 56]], 2.6); inkPath(g, [[cx, cy - 92], [cx, cy - 56]], 2.2);
      inkPath(g, [[cx - 6, cy - 30], [cx + 8, cy + 0], [cx - 4, cy + 22], [cx + 6, cy + 54]], 2.8);
      inkPath(g, [[cx + 14, cy + 10], [cx + 26, cy + 30]], 2.2);
      [[-78, 90], [66, 94], [100, 86]].forEach(function (d) { inkPath(g, circlePts(cx + d[0], cy + d[1], 15, 12), 3, { closed: true, fill: d[0] > 0 }); });
      inkPath(g, [[cx - 100, cy + 96], [cx + 124, cy + 96]], 3);
    },
    nothing: function (g, cx, cy) {          // 무소유: 텅 빈 원(엔소) + 빈 손
      var pts = [];
      for (var i = 0; i <= 26; i++) { var a = -2.2 + i / 26 * 5.4; pts.push([cx + Math.cos(a) * 66, cy + 4 + Math.sin(a) * 66]); }
      inkPath(g, pts, 7, { jit: 1.6 });
      inkPath(g, [[cx - 22, cy + 96], [cx - 30, cy + 70], [cx - 24, cy + 52]], 3); inkPath(g, [[cx + 22, cy + 96], [cx + 30, cy + 70], [cx + 24, cy + 52]], 3);
      inkPath(g, [[cx - 12, cy + 54], [cx - 12, cy + 32]], 2.6); inkPath(g, [[cx, cy + 52], [cx, cy + 28]], 2.6); inkPath(g, [[cx + 12, cy + 54], [cx + 12, cy + 32]], 2.6);
      sparkle(g, cx + 96, cy - 62, 12);
    },
    latebloom: function (g, cx, cy) {        // 대기만성: 느릿한 달팽이와 늦게 핀 꽃
      var sp = [];
      for (var i = 0; i <= 30; i++) { var a = i / 30 * Math.PI * 5, r = 6 + i * 1.6; sp.push([cx - 10 + Math.cos(a) * r, cy + 8 + Math.sin(a) * r]); }
      inkPath(g, sp, 3.2); inkPath(g, circlePts(cx - 10, cy + 8, 54, 26), 3.6, { closed: true });
      inkPath(g, [[cx - 76, cy + 64], [cx + 30, cy + 64], [cx + 84, cy + 56], [cx + 100, cy + 30], [cx + 98, cy + 14]], 4);
      inkPath(g, [[cx + 98, cy + 14], [cx + 92, cy - 14]], 3); inkPath(g, [[cx + 108, cy + 18], [cx + 118, cy - 8]], 3);
      inkPath(g, circlePts(cx + 92, cy - 18, 5, 8), 2.4, { closed: true, fill: true }); inkPath(g, circlePts(cx + 118, cy - 12, 5, 8), 2.4, { closed: true, fill: true });
      inkPath(g, [[cx - 108, cy + 86], [cx - 108, cy + 52]], 3);
      [[-1, 0], [1, 0], [0, -1]].forEach(function (d) { inkPath(g, circlePts(cx - 108 + d[0] * 10, cy + 46 + d[1] * 10, 8, 10), 2.4, { closed: true }); });
    },
    blind: function (g, cx, cy) {            // 눈 감고 두기: 눈가리개
      inkPath(g, circlePts(cx, cy + 6, 82, 30, 0.82), 3.8, { closed: true });
      inkPath(g, [[cx - 80, cy - 16], [cx + 80, cy - 36], [cx + 82, cy + 4], [cx - 78, cy + 24]], 3.6, { closed: true, fill: true });
      g.save(); g.fillStyle = '#d9c79a'; g.globalAlpha = 0.5; g.fillRect(cx - 40, cy - 14, 20, 4); g.fillRect(cx + 14, cy - 22, 20, 4); g.restore();
      inkPath(g, [[cx + 82, cy - 16], [cx + 112, cy - 40]], 3.4); inkPath(g, [[cx + 82, cy - 8], [cx + 114, cy + 4]], 3.4);
      inkPath(g, [[cx - 26, cy + 56], [cx, cy + 66], [cx + 26, cy + 56]], 3.2);
    },
    clown: function (g, cx, cy) {            // 광대의 한 수: 광대 모자와 얼굴
      inkPath(g, [[cx - 46, cy - 24], [cx, cy - 98], [cx + 46, cy - 24]], 3.6, { closed: true });
      inkPath(g, circlePts(cx, cy - 102, 9, 10), 3, { closed: true, fill: true });
      inkPath(g, [[cx - 32, cy - 46], [cx + 32, cy - 46]], 2.4);
      inkPath(g, circlePts(cx, cy + 22, 58, 26), 3.8, { closed: true });
      inkPath(g, circlePts(cx - 22, cy + 8, 7, 10), 2.8, { closed: true, fill: true }); inkPath(g, circlePts(cx + 22, cy + 8, 7, 10), 2.8, { closed: true, fill: true });
      inkPath(g, circlePts(cx, cy + 26, 13, 12), 3, { closed: true, fill: true });
      inkPath(g, [[cx - 34, cy + 46], [cx - 12, cy + 66], [cx + 12, cy + 66], [cx + 34, cy + 46]], 3.4);
    },
    chicken: function (g, cx, cy) {          // 치킨 게임: 닭
      inkPath(g, circlePts(cx - 8, cy + 24, 58, 26, 1.1), 3.8, { closed: true });
      inkPath(g, circlePts(cx + 52, cy - 34, 30, 18), 3.6, { closed: true });
      inkPath(g, [[cx + 44, cy - 62], [cx + 52, cy - 80], [cx + 60, cy - 62], [cx + 68, cy - 78], [cx + 70, cy - 58]], 3, { closed: true, fill: true });
      inkPath(g, [[cx + 78, cy - 36], [cx + 104, cy - 28], [cx + 78, cy - 20]], 3, { closed: true, fill: true });
      inkPath(g, circlePts(cx + 56, cy - 40, 4, 8), 2.4, { closed: true, fill: true });
      inkPath(g, [[cx - 66, cy + 4], [cx - 100, cy - 24]], 3.4); inkPath(g, [[cx - 66, cy + 20], [cx - 106, cy + 4]], 3.4); inkPath(g, [[cx - 64, cy + 34], [cx - 98, cy + 30]], 3.4);
      inkPath(g, [[cx - 24, cy + 82], [cx - 24, cy + 104]], 3.2); inkPath(g, [[cx + 14, cy + 82], [cx + 14, cy + 104]], 3.2);
      inkPath(g, [[cx - 40, cy + 106], [cx - 24, cy + 104], [cx - 8, cy + 106]], 2.6); inkPath(g, [[cx, cy + 106], [cx + 14, cy + 104], [cx + 30, cy + 106]], 2.6);
    },
    sloth: function (g, cx, cy) {            // 나무늘보: 나뭇가지에 매달린 모습
      inkPath(g, [[cx - 124, cy - 70], [cx + 124, cy - 74]], 6);
      inkPath(g, [[cx - 60, cy - 70], [cx - 70, cy - 90], [cx - 50, cy - 100]], 2.6); inkPath(g, [[cx + 70, cy - 72], [cx + 86, cy - 94]], 2.6);
      inkPath(g, circlePts(cx, cy + 20, 50, 24, 0.9), 3.8, { closed: true });
      inkPath(g, [[cx - 38, cy - 8], [cx - 56, cy - 40], [cx - 40, cy - 68]], 4); inkPath(g, [[cx + 38, cy - 8], [cx + 56, cy - 40], [cx + 40, cy - 68]], 4);
      inkPath(g, circlePts(cx, cy + 4, 24, 16), 3, { closed: true });
      inkPath(g, circlePts(cx - 9, cy + 0, 5, 8), 2.4, { closed: true, fill: true }); inkPath(g, circlePts(cx + 9, cy + 0, 5, 8), 2.4, { closed: true, fill: true });
      inkPath(g, [[cx - 8, cy + 14], [cx, cy + 20], [cx + 8, cy + 14]], 2.4);
      inkPath(g, [[cx - 22, cy + 66], [cx - 30, cy + 96]], 3.6); inkPath(g, [[cx + 22, cy + 66], [cx + 30, cy + 96]], 3.6);
    },
    mirror: function (g, cx, cy) {           // 따라쟁이: 거울과 비친 돌
      inkPath(g, circlePts(cx, cy - 6, 70, 30, 0.8), 4.4, { closed: true });
      inkPath(g, circlePts(cx, cy - 6, 56, 28, 0.78), 2.4, { closed: true });
      inkPath(g, [[cx, cy + 66], [cx, cy + 100]], 7); inkPath(g, [[cx - 20, cy + 104], [cx + 20, cy + 104]], 5);
      inkPath(g, circlePts(cx - 16, cy - 8, 22, 14), 3.2, { closed: true, fill: true });
      inkPath(g, circlePts(cx + 20, cy + 4, 22, 14), 3.2, { closed: true });
      inkPath(g, [[cx - 30, cy - 36], [cx - 8, cy - 52]], 2.4); sparkle(g, cx + 78, cy - 54, 12);
    },
    allin: function (g, cx, cy) {            // 올인: 슬롯머신
      inkPath(g, [[cx - 84, cy - 72], [cx + 84, cy - 72], [cx + 84, cy + 88], [cx - 84, cy + 88]], 4.2, { closed: true });
      inkPath(g, [[cx - 66, cy - 40], [cx + 66, cy - 40], [cx + 66, cy + 30], [cx - 66, cy + 30]], 3, { closed: true });
      [-44, 0, 44].forEach(function (x) { inkPath(g, [[cx + x - 18, cy - 28], [cx + x + 18, cy - 28], [cx + x - 6, cy + 20]], 3.4); });
      inkPath(g, [[cx - 22, cy - 40], [cx - 22, cy + 30]], 2); inkPath(g, [[cx + 22, cy - 40], [cx + 22, cy + 30]], 2);
      inkPath(g, circlePts(cx - 30, cy + 58, 9, 10), 3, { closed: true, fill: true }); inkPath(g, circlePts(cx, cy + 58, 9, 10), 3, { closed: true }); inkPath(g, circlePts(cx + 30, cy + 58, 9, 10), 3, { closed: true, fill: true });
      inkPath(g, [[cx + 84, cy - 20], [cx + 112, cy - 56]], 4.4); inkPath(g, circlePts(cx + 114, cy - 62, 10, 10), 3, { closed: true, fill: true });
    },
    turtle: function (g, cx, cy) {           // 토끼와 거북이: 느린 거북
      var dome = [[cx - 84, cy + 50]];
      for (var i = 0; i <= 14; i++) { var a = Math.PI + i / 14 * Math.PI; dome.push([cx + Math.cos(a) * 84, cy + 50 + Math.sin(a) * 74]); }
      inkPath(g, dome, 4, { closed: true });
      inkPath(g, [[cx - 40, cy - 8], [cx - 20, cy - 36], [cx + 20, cy - 36], [cx + 40, cy - 8], [cx + 20, cy + 20], [cx - 20, cy + 20]], 2.8, { closed: true });
      inkPath(g, [[cx - 20, cy - 36], [cx - 30, cy - 66]], 2.4); inkPath(g, [[cx + 20, cy - 36], [cx + 30, cy - 66]], 2.4); inkPath(g, [[cx - 40, cy - 8], [cx - 74, cy + 8]], 2.4); inkPath(g, [[cx + 40, cy - 8], [cx + 74, cy + 8]], 2.4);
      inkPath(g, circlePts(cx + 108, cy + 28, 22, 14), 3.6, { closed: true }); inkPath(g, circlePts(cx + 114, cy + 24, 3.5, 8), 2.2, { closed: true, fill: true });
      inkPath(g, [[cx - 50, cy + 52], [cx - 56, cy + 80], [cx - 28, cy + 80], [cx - 22, cy + 52]], 3, { closed: true }); inkPath(g, [[cx + 22, cy + 52], [cx + 28, cy + 80], [cx + 56, cy + 80], [cx + 50, cy + 52]], 3, { closed: true });
      inkPath(g, [[cx - 118, cy + 92], [cx + 130, cy + 92]], 2.6);
    },
    king: function (g, cx, cy) {             // 왕의 귀환: 왕관
      inkPath(g, [[cx - 92, cy + 62], [cx - 100, cy - 36], [cx - 48, cy + 6], [cx, cy - 66], [cx + 48, cy + 6], [cx + 100, cy - 36], [cx + 92, cy + 62]], 4.2, { closed: true });
      inkPath(g, [[cx - 92, cy + 42], [cx + 92, cy + 42]], 3);
      [[-100, -36], [0, -66], [100, -36]].forEach(function (d) { inkPath(g, circlePts(cx + d[0], cy + d[1] - 10, 11, 12), 3.2, { closed: true, fill: true }); });
      [-52, 0, 52].forEach(function (x) { inkPath(g, [[cx + x, cy + 14], [cx + x + 12, cy + 28], [cx + x, cy + 40], [cx + x - 12, cy + 28]], 2.6, { closed: true }); });
      sparkle(g, cx - 120, cy - 70, 12); sparkle(g, cx + 122, cy - 74, 10);
    }
};

function roughRectPts(x, y, w, h, jit, step) {
  var p = [], c = 14;
  var corners = [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]];
  return roughen(corners, step || 14, jit, true);
}

// 그림 칸(카드 좌표 384x576 기준): x46 y162 w292 h214 — 칸을 꽉 채우도록(cover) 맞춰 넣음
var ART_BOX = { x: 46, y: 162, w: 292, h: 214 };
function drawIllustration(g, img) {
  var B = ART_BOX, sc = Math.max(B.w / img.width, B.h / img.height);
  var dw = img.width * sc, dh = img.height * sc;
  g.save();
  g.beginPath(); roughRectPts(B.x, B.y, B.w, B.h, 1.2, 14).forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.clip();
  if (CFG.artBlend === 'multiply') g.globalCompositeOperation = 'multiply';
  g.drawImage(img, B.x + (B.w - dw) / 2, B.y + (B.h - dh) / 2, dw, dh);
  g.restore();
  inkPath(g, roughRectPts(B.x, B.y, B.w, B.h, 1.2, 14), 3, { closed: true, jit: 0.9 });   // 잉크 테두리
}

function cardTexture(id) {
  if (texCache[id]) return texCache[id];
  var c = CARDS[id], W = 384, H = 576;
  var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  var g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);

  // 종이 모양(가장자리 거칠게)으로 잘라낸 뒤 그 안에만 그림
  var edge = roughRectPts(6, 6, W - 12, H - 12, 2.4, 12);
  g.save(); g.beginPath(); edge.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.clip();

  var paperImg = CFG.cardPaper && IMG[CFG.cardPaper];
  if (paperImg) g.drawImage(paperImg, 0, 0, W, H);
  else {
  var grad = g.createLinearGradient(0, 0, W * 0.4, H);
  grad.addColorStop(0, '#d8c697'); grad.addColorStop(0.55, '#c9b483'); grad.addColorStop(1, '#b89f6a');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  for (var i = 0; i < 7; i++) {                       // 얼룩
    var sx = rnd(0, W), sy = rnd(0, H), sr = rnd(30, 90), sg = g.createRadialGradient(sx, sy, 2, sx, sy, sr);
    sg.addColorStop(0, 'rgba(110,75,30,' + rnd(0.06, 0.16) + ')'); sg.addColorStop(1, 'rgba(110,75,30,0)');
    g.fillStyle = sg; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }
  for (var k = 0; k < 1400; k++) { g.fillStyle = 'rgba(70,45,15,' + rnd(0, 0.1) + ')'; g.fillRect(rnd(0, W), rnd(0, H), rnd(1, 3), rnd(1, 3)); }
  // 접힌 자국
  g.strokeStyle = 'rgba(255,245,215,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, H * 0.46); g.lineTo(W, H * 0.5); g.stroke();
  g.strokeStyle = 'rgba(70,45,15,0.18)'; g.beginPath(); g.moveTo(0, H * 0.46 + 3); g.lineTo(W, H * 0.5 + 3); g.stroke();
  var vg = g.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);   // 가장자리 어둡게
  vg.addColorStop(0, 'rgba(50,28,8,0)'); vg.addColorStop(1, 'rgba(50,28,8,0.62)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  // 잉크 테두리
  inkPath(g, roughRectPts(26, 26, W - 52, H - 52, 1.5, 14), 3.2, { closed: true, jit: 1 });
  g.globalAlpha = 0.4; inkPath(g, roughRectPts(36, 36, W - 72, H - 72, 1.2, 14), 1.6, { closed: true, jit: 0.8 }); g.globalAlpha = 1;
  if (c.legend) {                                  // 전설 카드: 금박 테두리와 모서리 장식
    g.save(); g.strokeStyle = '#c99a1c'; g.lineWidth = 5; g.globalAlpha = 0.9;
    var gr = roughRectPts(18, 18, W - 36, H - 36, 1.2, 14); g.beginPath(); gr.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.stroke();
    g.fillStyle = 'rgba(214,170,50,0.13)'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c99a1c'; g.globalAlpha = 0.95;
    [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]].forEach(function (q) { g.beginPath(); g.moveTo(q[0], q[1] - 9); g.lineTo(q[0] + 9, q[1]); g.lineTo(q[0], q[1] + 9); g.lineTo(q[0] - 9, q[1]); g.closePath(); g.fill(); });
    g.restore();
  }

  // 상단 룬 + 이름
  runeGlyph(g, W / 2, 70, 20);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
  g.font = '40px ' + TEXT_FONT; g.globalAlpha = 0.93; g.fillText(c.name, W / 2, 124); g.globalAlpha = 1;
  inkPath(g, [[W / 2 - 92, 150], [W / 2 + 92, 150]], 2.2, { jit: 1 });

  // 그림 영역
  var artImg = cardArtPath(id) && IMG[cardArtPath(id)];
  if (artImg) drawIllustration(g, artImg); else ART[id](g, W / 2, 262);
  for (var s = 0; s < 14; s++) { g.fillStyle = INK; g.globalAlpha = rnd(0.25, 0.7); g.beginPath(); g.arc(rnd(50, W - 50), rnd(170, 360), rnd(0.8, 3.4), 0, 7); g.fill(); }   // 잉크 튄 자국
  g.globalAlpha = 1;

  // 설명: 칸(가로 284 · 세로 100)에 맞게 글자 크기를 줄이고, 한 글자만 남는 줄은 만들지 않음
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  var size = 25, lines = [], nExplicit = c.desc.split('\n').length;
  [25, 23, 21, 19, 17, 15].some(function (sz) {           // 줄바꿈 없이 의도한 줄 그대로 들어가는 가장 큰 글자 크기
    size = sz; g.font = sz + 'px ' + TEXT_FONT; lines = wrapText(g, c.desc, W - 100);
    return lines.length === nExplicit && lines.length * sz * 1.3 <= 100;
  });
  var lh = size * 1.3, y0 = 438 - (lines.length - 1) * lh / 2;
  g.globalAlpha = 0.9;
  lines.forEach(function (l, i) { g.fillText(l, W / 2, y0 + i * lh); });
  g.globalAlpha = 1;

  // 하단: 분류 + 턴 종료 표시 (테두리 선보다 위에 둠)
  inkPath(g, [[56, 500], [W - 56, 500]], 2, { jit: 1 });
  g.font = '21px ' + TEXT_FONT; g.fillStyle = INK;
  g.textAlign = 'left'; g.fillText(c.cat, 60, 521);
  g.textAlign = 'right'; g.globalAlpha = 0.85; g.fillText(c.legend ? (c.react ? '상대 카드에 대응' : id === 'allin' ? '턴마다 1번' : '판마다 1번') : (c.endsTurn ? '턴 종료' : '턴 유지'), W - 60, 521); g.globalAlpha = 1;
  g.restore();
  // 가장자리 잉크 윤곽
  g.beginPath(); edge.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath();
  g.strokeStyle = 'rgba(40,24,8,0.75)'; g.lineWidth = 2.5; g.stroke();
  return (texCache[id] = toTex(cv));
}

// 전설 카드 뒷면 (상대가 쥔 전설 카드: 무엇인지 모름)
function cardBackTexture() {
  if (texCache.__back) return texCache.__back;
  var W = 384, H = 576, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  var g = cv.getContext('2d'), edge = roughRectPts(6, 6, W - 12, H - 12, 2.4, 12);
  g.save(); g.beginPath(); edge.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.clip();
  var gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#5a4210'); gr.addColorStop(1, '#2e2108'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#d6aa32'; g.lineWidth = 6; g.strokeRect(22, 22, W - 44, H - 44); g.lineWidth = 2; g.strokeRect(36, 36, W - 72, H - 72);
  g.fillStyle = '#d6aa32'; g.font = '150px ' + EMOJI_FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = 0.9; g.fillText('?', W / 2, H / 2);
  g.restore();
  g.beginPath(); edge.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.strokeStyle = 'rgba(20,12,2,0.85)'; g.lineWidth = 2.5; g.stroke();
  return (texCache.__back = toTex(cv));
}
