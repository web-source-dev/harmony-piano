@echo off
cd /d "%~dp0"
echo Starting Harmony Piano servers...
echo   App + chat logs: http://localhost:8550
echo   Room DJ media:   http://localhost:8551
echo   Real-time relay: ws://localhost:8552
start "Harmony Media" python media-server.py 8551
start "Harmony Relay" node relay-server.js 8552
start "Harmony Piano" python chat-save-server.py 8550
echo.
echo Open http://localhost:8550/ in your browser.
echo Room DJ needs the media server on port 8551 (started above).
echo Real-time sync (Blob/Doodler/Emoji/Sound/Party/metronome) needs the relay on 8552.
