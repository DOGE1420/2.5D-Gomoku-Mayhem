#!/bin/sh
# 맥/리눅스: 로컬 서버로 게임을 엽니다 (이미지 에셋을 쓰려면 필요)
cd "$(dirname "$0")"
PORT=8000
( sleep 1; (command -v open >/dev/null && open "http://localhost:$PORT") || (command -v xdg-open >/dev/null && xdg-open "http://localhost:$PORT") ) &
python3 -m http.server $PORT
