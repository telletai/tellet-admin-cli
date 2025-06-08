@echo off
echo Installing Tellet Admin CLI...
echo.

REM Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Install dependencies
echo Installing dependencies...
call npm install

REM Install globally
echo.
echo Installing CLI globally...
call npm install -g .

echo.
echo ============================================
echo Installation complete!
echo.
echo You can now use:
echo   tellet-wizard    - Launch interactive wizard
echo   tellet-admin     - Use CLI commands directly
echo ============================================
echo.
pause