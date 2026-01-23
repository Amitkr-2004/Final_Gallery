@echo off
echo ================================================
echo  Starting Redis Server for Gallery App
echo ================================================
echo.

echo Checking if Redis container exists...
docker ps -a --filter "name=redis" --format "{{.Names}}" > nul 2>&1

docker ps -a --filter "name=redis" --format "{{.Names}}" | findstr "redis" > nul
if %errorlevel% equ 0 (
    echo Redis container found. Starting it...
    docker start redis
    if %errorlevel% equ 0 (
        echo.
        echo [SUCCESS] Redis is now running on localhost:6379
    ) else (
        echo [ERROR] Failed to start Redis container
        exit /b 1
    )
) else (
    echo Redis container not found. Creating new container...
    docker run -d -p 6379:6379 --name redis redis:7-alpine
    if %errorlevel% equ 0 (
        echo.
        echo [SUCCESS] Redis container created and running on localhost:6379
    ) else (
        echo [ERROR] Failed to create Redis container
        exit /b 1
    )
)

echo.
echo Testing Redis connection...
docker exec redis redis-cli ping > nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Redis is responding to PING
) else (
    echo [WARNING] Redis may not be ready yet. Wait a few seconds.
)

echo.
echo ================================================
echo  Redis Setup Complete
echo ================================================
echo.
echo Redis is running on: localhost:6379
echo.
echo To stop Redis:  docker stop redis
echo To view logs:   docker logs redis
echo To restart:     docker start redis
echo.
pause
