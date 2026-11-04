@echo off
chcp 65001 >nul
setlocal
title XingCe AI Lab
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Please install Node.js 24 LTS, then double-click this file again.
  echo https://nodejs.org/
  pause
  exit /b 1
)
node scripts\desktop-launcher.mjs
if errorlevel 1 (
  echo.
  echo Startup failed. Please keep this window and share the error shown above.
  pause
)
endlocal
