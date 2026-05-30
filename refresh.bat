@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh.ps1" %*
exit /b %ERRORLEVEL%
