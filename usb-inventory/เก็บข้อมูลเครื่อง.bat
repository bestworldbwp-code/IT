@echo off
rem Double-click: collect this computer info into the data folder on this USB (read-only)
rem The window always stays open at the end so any error can be read
cd /d "%~dp0"
ver
where powershell.exe >nul 2>nul || (echo  [X] PowerShell not found on this PC& goto end)
powershell.exe -NoProfile -Command "if ($PSVersionTable.PSVersion.Major -lt 3) { exit 2 }"
if errorlevel 2 (echo  [X] Old Windows - PowerShell 2 / Windows 7 - tell IT& goto end)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0collect.ps1" -NoPause 2>> "%~dp0error-log.txt"
if errorlevel 1 (echo  [X] Error code %errorlevel% - see error-log.txt on the USB)
:end
echo.
pause
