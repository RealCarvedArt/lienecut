@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.18 or newer, then run this launcher again.
  echo https://nodejs.org/
  pause
  exit /b 1
)
node serve.mjs --open
if errorlevel 1 pause
