@echo off
echo Starting Learning Platform Backend...
echo.

cd backend

echo Checking if node_modules exists...
if not exist "node_modules" (
    echo Dependencies not installed. Running npm install...
    call npm install
)

echo.
echo Starting server...
call npm run dev
