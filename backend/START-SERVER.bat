@echo off
echo ========================================
echo Starting zkVerify Backend Server
echo ========================================
echo.
cd /d "%~dp0"
echo Current directory: %CD%
echo.
echo Loading environment variables...
node -e "require('dotenv').config(); console.log('ADMIN_ADDRESS:', process.env.ADMIN_ADDRESS || 'NOT FOUND')"
echo.
echo Starting server...
echo.
npm run dev
pause


