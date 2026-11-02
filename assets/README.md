# 에셋 넣는 방법

코드를 고칠 필요 없이 **이미지 파일을 넣고 `js/config.js`에 경로만 적으면** 교체됩니다.
파일이 없거나 `null`이면 기본 자동 생성 그림을 씁니다.

> 이미지는 `index.html`을 더블클릭(file://)하면 로드되지 않습니다. 브라우저 보안 때문이에요.
> `run.bat`(윈도우) / `run.sh`(맥·리눅스)로 열거나, GitHub Pages 같은 웹 주소로 여세요.

## 1. 카드 일러스트  (`assets/cards/`)

| 항목 | 규격 |
|---|---|
| 파일 | PNG(투명 배경 권장) 또는 JPG |
| 크기 | **584 × 428 px** (비율 약 1.36 : 1, 이보다 크면 자동으로 축소) |
| 위치 | 카드 이름 아래 그림 칸. 가장자리는 잉크 테두리가 덮이므로 중요한 그림은 안쪽 90%에 |
| 설정 | `config.js`의 `cards.<카드 id>` (카드 21장 모두 지정 가능: chain, windmill, alkkagi, bomb, trade, infection, reversal, teleport, earthquake, meteor, sixsense, wall, trap, snipe, double, peek, giant, ghost, weather, shield, blockade) |

예) `assets/cards/bomb.png` 를 넣고 `bomb: 'assets/cards/bomb.png'`

- `artBlend: 'multiply'` — 흰 배경 선화를 양피지에 스며들게 합니다.
- `cardPaper` — 카드 바탕을 통째로 바꿉니다 (768 × 1152 px, 비율 2:3). 이름·설명·분류 글자는 그 위에 그려집니다.

새 카드를 추가할 때는 `js/rules.js`의 `CARDS`에 항목을 추가하고, 여기 `cards`에 같은 id로 경로를 적으면 됩니다.

## 2. 맵  (`assets/maps/<맵이름>/`)

`config.js`의 `maps` 배열에 항목을 추가하면 됩니다. 맵이 2개 이상이면 화면 위쪽에 선택 메뉴가 생깁니다.
모든 항목은 선택 사항이고, 빼면 기본값을 씁니다.

| 항목 | 설명 | 규격 |
|---|---|---|
| `board` | 판 윗면 | 정사각형 1024 × 1024 px 권장 |
| `boardGrid` | `true`면 격자선·화점을 자동으로 그림 | — |
| `table` / `tableRepeat` | 테이블 바닥 텍스처(타일링) / 반복 횟수 | 512 × 512 px 이상 |
| `hideTable` | 테이블 바닥 숨김 | backdrop에 바닥이 있을 때 |
| `backdrop` | 방 전체 배경(360° 파노라마) | 가로:세로 = 2:1 (예 4096 × 2048) |
| `stones.black / white` | 돌 표면 텍스처 | 512 × 512 px |
| `background`, `fog` | 배경색, 안개 | — |
| `light` | 조명 색·세기 | — |
| `candle` | 촛불 켜기/끄기, 색, 세기 | — |
| `camera` | 카메라 위치(`pos`)와 바라보는 점(`look`) | — |

### 판 이미지에 격자가 이미 그려져 있을 때 (`boardGrid: false`)
이미지를 1024 px 정사각형으로 보고, **판 한 변 전체가 이미지 전체**입니다.
격자선(15 × 15)은 가장자리에서 **64 px 안쪽**부터 **64 px 간격**으로 놓여야 돌 위치와 맞습니다.
(선 좌표 = 64, 128, …, 960 px) 맞추기 번거로우면 `boardGrid: true`로 두고 격자 없는 나무판 그림만 넣으세요.
