@echo off
echo ================================
echo Learning Platform Backend Setup
echo ================================
echo.

cd backend

echo [1/3] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js is installed

echo.
echo [2/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [3/3] Setup complete!
echo.
echo ================================
echo Next Steps:
echo ================================
echo 1. Make sure MongoDB is installed and running
echo 2. Start the backend: npm run dev
echo 3. The API will be available at http://localhost:3000
echo.
echo For more details, see BACKEND_SETUP.md
echo.
pause
