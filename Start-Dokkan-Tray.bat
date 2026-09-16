@echo off
cd /d "%~dp0"
start "" powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "tools\dokkan-tray-runner.ps1"
