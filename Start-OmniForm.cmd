@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  "%USERPROFILE%\.ai-manager\runtimes\node\24.22.0\node.exe" scripts/ensure-workspace.mjs --open
) else (
  node scripts/ensure-workspace.mjs --open
)
if errorlevel 1 pause
