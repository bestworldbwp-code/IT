@echo off
rem Double-click: collect this computer info into the data folder on this USB (read-only)
where powershell.exe >nul 2>nul || (echo.& echo  [X] PowerShell not found on this PC - send a photo of this screen to IT& echo.& pause & exit /b)
powershell.exe -NoProfile -Command "if ($PSVersionTable.PSVersion.Major -lt 3) { exit 2 }"
if errorlevel 2 (echo.& echo  [X] Old Windows ^(PowerShell 2 / Windows 7^) - this PC needs the old-Windows version, tell IT& echo.& pause & exit /b)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0collect.ps1"
if errorlevel 1 (echo.& echo  [X] Error code %errorlevel% - take a photo of this screen& echo.& pause)
