@echo off
python "%~dp0scripts\preview.py"
if errorlevel 1 (
    pause
    exit /b 1
)
