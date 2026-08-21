@echo off
echo Starting all SmartFashion services in separate windows...
start "CatVTON (AI Try-On)" cmd /k "cd /d "%~dp0CatVTON" && start-catvton.bat"
start "Outfit Recommender" cmd /k "cd /d "%~dp0outfit-recommender" && start-outfit-recommender.bat"
start ".NET Backend" cmd /k "cd /d "%~dp0FYP" && start-backend.bat"
start "Expo (Frontend)" cmd /k "cd /d "%~dp0FashionApp" && npx expo start"
echo All services launching. Check each window for status.
pause
