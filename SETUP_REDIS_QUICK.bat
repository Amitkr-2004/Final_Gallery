@echo off
echo ========================================
echo Redis Setup for Gallery Application
echo ========================================
echo.

echo Step 1: Checking Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo [OK] Docker is installed

echo.
echo Step 2: Starting Docker Desktop if not running...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Docker Desktop is not running
    echo Please start Docker Desktop manually and run this script again
    pause
    exit /b 1
)
echo [OK] Docker Desktop is running

echo.
echo Step 3: Checking for existing Redis container...
docker ps -a | findstr redis >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Redis container exists, removing old container...
    docker rm -f redis >nul 2>&1
)

echo.
echo Step 4: Starting Redis container...
docker run -d -p 6379:6379 --name redis --restart unless-stopped redis:7-alpine
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Redis container
    pause
    exit /b 1
)

echo [OK] Redis container started successfully

echo.
echo Step 5: Testing Redis connection...
timeout /t 3 /nobreak >nul
docker exec redis redis-cli ping
if %errorlevel% neq 0 (
    echo [ERROR] Redis is not responding
    pause
    exit /b 1
)

echo.
echo ========================================
echo [SUCCESS] Redis is ready!
echo ========================================
echo.
echo Redis is running on: localhost:6379
echo.
echo To stop Redis: docker stop redis
echo To start Redis: docker start redis
echo To remove Redis: docker rm -f redis
echo.
pause
