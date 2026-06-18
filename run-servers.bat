@echo off
cd /d "%~dp0"
echo Starting Harmony Piano servers...
echo   App + real-time relay + chat logs: http://localhost:8550   (node relay-server.js)
echo   Room DJ media uploads:             http://localhost:8551   (python media-server.py)
echo.
echo IMPORTANT: open the app from the Node server below (port 8550) so real-time
echo sync works. Opening index.html directly (file://) or via a plain static
echo server will NOT sync moving/clicking/size - only add/pop.
echo.
start "Harmony Media" python media-server.py 8551
start "Harmony App + Relay" node relay-server.js 8550
echo.
echo Open http://localhost:8550/ in your browser (use the SAME ?c=room on each client).
echo Room DJ uploads need the media server on port 8551 (started above).
