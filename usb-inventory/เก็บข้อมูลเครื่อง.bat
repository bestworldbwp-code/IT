@echo off
rem Double-click: collect this computer info into the data folder on this USB (read-only)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0collect.ps1"
