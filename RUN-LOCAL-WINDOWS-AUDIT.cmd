@echo off
setlocal
REM ============================================================
REM gb-is-my-strength local Windows audit launcher
REM Repo: C:\Users\Fedor\Projects\gb-is-my-strength
REM
REM Double-click this file or run it from PowerShell/CMD:
REM   .\RUN-LOCAL-WINDOWS-AUDIT.cmd
REM
REM Deep/noisy mode:
REM   .\RUN-LOCAL-WINDOWS-AUDIT.cmd -RunNoisy -RunFullTrivy
REM
REM Reports are written to:
REM   reports\local-external-checks-YYYY-MM-DD_HH-mm-ss\
REM ============================================================

cd /d "%~dp0"

where pwsh.exe >nul 2>nul
if %ERRORLEVEL%==0 (
  set "PS_EXE=pwsh.exe"
) else (
  set "PS_EXE=powershell.exe"
)

echo Running local audit with %PS_EXE% from %CD%
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%~dp0audit\external-checks\run-local-windows-audit.ps1" %*
set "EC=%ERRORLEVEL%"
echo.
echo Local audit finished with exit code %EC%.
echo Reports are under: %CD%\reports\local-external-checks-*
exit /b %EC%
