@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22.13 或更新版本，然后重新双击本文件。
  echo 下载地址：https://nodejs.org/
  pause
  exit /b 1
)
node "%~dp0scripts\portable-start.mjs"
if errorlevel 1 pause
