@echo off
cd /d "%~dp0"
rem 윈도우: 로컬 서버로 게임을 엽니다 (이미지 에셋을 쓰려면 필요)
start "" http://localhost:8000
(python -m http.server 8000) || (py -m http.server 8000) || (echo Python이 필요합니다. https://www.python.org 에서 설치하세요. & pause)
