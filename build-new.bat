@echo off
setlocal EnableDelayedExpansion

REM ==============================================
REM Build Script for 99AI Project
REM ==============================================

echo ========================================
echo Starting build process...
echo ========================================
echo.

set "ROOT=%~dp0"
set "BUILD_ERROR=0"

REM Check if pnpm is installed
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pnpm is not installed or not in PATH
    echo Please install pnpm first: npm install -g pnpm
    pause
    exit /b 1
)

echo [1/3] Building admin project...
cd /d "%ROOT%admin"
if not exist "package.json" (
    echo ERROR: admin/package.json not found
    set "BUILD_ERROR=1"
    goto :ERROR
)
call pnpm build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: admin build failed
    set "BUILD_ERROR=1"
    goto :ERROR
)
echo admin build completed successfully
echo.

echo [2/3] Building chat project...
cd /d "%ROOT%chat"
if not exist "package.json" (
    echo ERROR: chat/package.json not found
    set "BUILD_ERROR=1"
    goto :ERROR
)
call pnpm build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: chat build failed
    set "BUILD_ERROR=1"
    goto :ERROR
)
echo chat build completed successfully
echo.

echo [3/3] Building service project...
cd /d "%ROOT%service"
if not exist "package.json" (
    echo ERROR: service/package.json not found
    set "BUILD_ERROR=1"
    goto :ERROR
)
call pnpm build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: service build failed
    set "BUILD_ERROR=1"
    goto :ERROR
)
echo service build completed successfully
echo.

echo ========================================
echo Preparing deployment directory...
echo ========================================
echo.

REM Create deployment directory structure
if not exist "%ROOT%AIWebQuickDeploy" mkdir "%ROOT%AIWebQuickDeploy"
if not exist "%ROOT%AIWebQuickDeploy\public" mkdir "%ROOT%AIWebQuickDeploy\public"

REM Clean old build files
echo Cleaning old deployment files...
if exist "%ROOT%AIWebQuickDeploy\public\admin" rd /s /q "%ROOT%AIWebQuickDeploy\public\admin"
if exist "%ROOT%AIWebQuickDeploy\public\chat" rd /s /q "%ROOT%AIWebQuickDeploy\public\chat"
if exist "%ROOT%AIWebQuickDeploy\public\open-docs" rd /s /q "%ROOT%AIWebQuickDeploy\public\open-docs"
if exist "%ROOT%AIWebQuickDeploy\dist" rd /s /q "%ROOT%AIWebQuickDeploy\dist"

mkdir "%ROOT%AIWebQuickDeploy\public\admin"
mkdir "%ROOT%AIWebQuickDeploy\public\chat"
mkdir "%ROOT%AIWebQuickDeploy\public\open-docs"
mkdir "%ROOT%AIWebQuickDeploy\dist"
echo.

echo ========================================
echo Copying built files...
echo ========================================
echo.

REM Copy admin files
echo Copying admin files...
if exist "%ROOT%admin\dist" (
    xcopy "%ROOT%admin\dist\*" "%ROOT%AIWebQuickDeploy\public\admin\" /s /e /y /i >nul
    echo admin files copied successfully
) else (
    echo WARNING: admin\dist directory not found
)

REM Copy chat files
echo Copying chat files...
if exist "%ROOT%chat\dist" (
    xcopy "%ROOT%chat\dist\*" "%ROOT%AIWebQuickDeploy\public\chat\" /s /e /y /i >nul
    echo chat files copied successfully
) else (
    echo WARNING: chat\dist directory not found
)

REM Copy service files
echo Copying service files...
if exist "%ROOT%service\dist" (
    xcopy "%ROOT%service\dist\*" "%ROOT%AIWebQuickDeploy\dist\" /s /e /y /i >nul
    echo service files copied successfully
) else (
    echo WARNING: service\dist directory not found
)

REM Copy open-docs
echo Copying API documentation...
if exist "%ROOT%service\src\public\open-docs" (
    xcopy "%ROOT%service\src\public\open-docs\*" "%ROOT%AIWebQuickDeploy\public\open-docs\" /s /e /y /i >nul
    echo API documentation copied successfully
) else (
    echo WARNING: service\src\public\open-docs directory not found
)
echo.

echo ========================================
echo Copying deployment configuration files...
echo ========================================
echo.

REM Copy service deployment files
if exist "%ROOT%service\pm2.conf.json" (
    copy /y "%ROOT%service\pm2.conf.json" "%ROOT%AIWebQuickDeploy\pm2.conf.json" >nul
    echo pm2.conf.json copied
)

if exist "%ROOT%service\package.json" (
    copy /y "%ROOT%service\package.json" "%ROOT%AIWebQuickDeploy\package.json" >nul
    echo package.json copied
)

if exist "%ROOT%service\.env.example" (
    copy /y "%ROOT%service\.env.example" "%ROOT%AIWebQuickDeploy\.env.example" >nul
    echo .env.example copied
)

if exist "%ROOT%service\.env.docker" (
    copy /y "%ROOT%service\.env.docker" "%ROOT%AIWebQuickDeploy\.env.docker" >nul
    echo .env.docker copied
)

if exist "%ROOT%service\Dockerfile" (
    copy /y "%ROOT%service\Dockerfile" "%ROOT%AIWebQuickDeploy\Dockerfile" >nul
    echo Dockerfile copied
)

if exist "%ROOT%service\docker-compose.yml" (
    copy /y "%ROOT%service\docker-compose.yml" "%ROOT%AIWebQuickDeploy\docker-compose.yml" >nul
    echo docker-compose.yml copied
)

if exist "%ROOT%service\.dockerignore" (
    copy /y "%ROOT%service\.dockerignore" "%ROOT%AIWebQuickDeploy\.dockerignore" >nul
    echo .dockerignore copied
)

echo.
echo ========================================
echo Build Summary
echo ========================================
echo.
echo Deployment package created at:
echo %ROOT%AIWebQuickDeploy
echo.
echo Next steps:
echo 1. Copy AIWebQuickDeploy folder to your server
echo 2. Run: cd AIWebQuickDeploy
echo 3. Run: pnpm install --prod
echo 4. Configure .env file
echo 5. Run: pnpm start
echo.
echo ========================================
echo Build completed successfully!
echo ========================================
pause
exit /b 0

:ERROR
echo.
echo ========================================
echo BUILD FAILED!
echo ========================================
echo.
echo Please check the error messages above
echo and fix the issues before rebuilding.
echo.
pause
exit /b 1
