@echo off
cd /d %~dp0
set CAPTURE_ONLY=1
bun.exe collector.mjs
pause
