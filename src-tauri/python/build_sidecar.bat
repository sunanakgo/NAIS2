@echo off
REM Build script for NAIS2 Tagger Server Sidecar
REM Run this from the python directory

echo ====================================
echo NAIS2 Tagger Server - Build Script
echo ====================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    exit /b 1
)

REM Check/Install dependencies
echo [1/3] Installing/updating dependencies...
pip install pyinstaller fastapi uvicorn pillow numpy onnxruntime pandas huggingface_hub rembg tqdm --quiet

REM Check if pyinstaller is available
pyinstaller --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: PyInstaller installation failed
    exit /b 1
)

echo.
echo [2/3] Building EXE with PyInstaller...
echo This may take several minutes...
echo.

pyinstaller tagger_server.spec --clean --noconfirm

if errorlevel 1 (
    echo.
    echo ERROR: Build failed!
    exit /b 1
)

echo.
echo [3/3] Moving EXE to binaries folder...

REM Create binaries folder if not exists
if not exist "..\binaries" mkdir "..\binaries"

REM Move the built EXE
move /Y "dist\tagger-server-x86_64-pc-windows-msvc.exe" "..\binaries\"

echo.
echo ====================================
echo Build complete!
echo Output: src-tauri\binaries\tagger-server-x86_64-pc-windows-msvc.exe
echo ====================================
echo.
echo Next step: Run 'npm run tauri build' to create the final installer
pause
