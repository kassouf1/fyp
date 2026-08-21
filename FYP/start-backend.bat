@echo off
cd /d "%~dp0"
dotnet run --urls http://0.0.0.0:5010
pause
