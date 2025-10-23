@echo off
chcp 65001 >nul
setlocal

echo 开始执行构建过程...

set "ROOT=%~dp0"

echo 构建admin项目...
cd /d "%ROOT%admin"
call pnpm build

echo 构建chat项目...
cd /d "%ROOT%chat"
call pnpm build

echo 构建service项目...
cd /d "%ROOT%service"
call pnpm build

echo 清空目标文件夹...
if not exist "%ROOT%AIWebQuickDeploy" (
    mkdir "%ROOT%AIWebQuickDeploy"
)

if exist "%ROOT%AIWebQuickDeploy\public\admin" (
    rd /s /q "%ROOT%AIWebQuickDeploy\public\admin"
)
mkdir "%ROOT%AIWebQuickDeploy\public\admin"

if exist "%ROOT%AIWebQuickDeploy\public\chat" (
    rd /s /q "%ROOT%AIWebQuickDeploy\public\chat"
)
mkdir "%ROOT%AIWebQuickDeploy\public\chat"

if exist "%ROOT%AIWebQuickDeploy\public\open-docs" (
    rd /s /q "%ROOT%AIWebQuickDeploy\public\open-docs"
)
mkdir "%ROOT%AIWebQuickDeploy\public\open-docs"

if exist "%ROOT%AIWebQuickDeploy\dist" (
    rd /s /q "%ROOT%AIWebQuickDeploy\dist"
)
mkdir "%ROOT%AIWebQuickDeploy\dist"

echo 复制文件...
xcopy "%ROOT%admin\dist\*" "%ROOT%AIWebQuickDeploy\public\admin\" /s /e /y /i
xcopy "%ROOT%chat\dist\*" "%ROOT%AIWebQuickDeploy\public\chat\" /s /e /y /i
xcopy "%ROOT%service\dist\*" "%ROOT%AIWebQuickDeploy\dist\" /s /e /y /i
xcopy "%ROOT%service\src\public\open-docs\*" "%ROOT%AIWebQuickDeploy\public\open-docs\" /s /e /y /i

echo 复制 service 部署文件...
copy /y "%ROOT%service\pm2.conf.json" "%ROOT%AIWebQuickDeploy\pm2.conf.json" >nul
copy /y "%ROOT%service\package.json" "%ROOT%AIWebQuickDeploy\package.json" >nul
if exist "%ROOT%service\.env.example" copy /y "%ROOT%service\.env.example" "%ROOT%AIWebQuickDeploy\.env.example" >nul
if exist "%ROOT%service\.env.docker" copy /y "%ROOT%service\.env.docker" "%ROOT%AIWebQuickDeploy\.env.docker" >nul
if exist "%ROOT%service\Dockerfile" copy /y "%ROOT%service\Dockerfile" "%ROOT%AIWebQuickDeploy\Dockerfile" >nul
if exist "%ROOT%service\docker-compose.yml" copy /y "%ROOT%service\docker-compose.yml" "%ROOT%AIWebQuickDeploy\docker-compose.yml" >nul
if exist "%ROOT%service\.dockerignore" copy /y "%ROOT%service\.dockerignore" "%ROOT%AIWebQuickDeploy\.dockerignore" >nul

echo 构建和复制过程完成！
pause