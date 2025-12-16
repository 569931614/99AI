@echo off
REM =====================================================
REM 日志轮转 Windows 定时任务安装脚本
REM
REM 功能：每小时执行一次日志轮转
REM 用法：以管理员身份运行此脚本
REM =====================================================

setlocal enabledelayedexpansion

REM 获取当前脚本所在目录
set SCRIPT_DIR=%~dp0
set SERVICE_DIR=%SCRIPT_DIR%..
cd /d %SERVICE_DIR%

REM 设置任务名称
set TASK_NAME=99AI-LogRotate

REM 获取 node.exe 路径
for /f "tokens=*" %%i in ('where node 2^>nul') do (
    set NODE_PATH=%%i
    goto :found_node
)
echo [错误] 未找到 Node.js，请确保已安装并添加到 PATH
pause
exit /b 1

:found_node
echo [信息] Node.js 路径: %NODE_PATH%
echo [信息] 服务目录: %SERVICE_DIR%

REM 检查是否已存在任务
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [信息] 任务 %TASK_NAME% 已存在，正在删除旧任务...
    schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
)

REM 创建定时任务 - 每小时整点运行
echo [信息] 正在创建定时任务...
schtasks /create /tn "%TASK_NAME%" /tr "\"%NODE_PATH%\" \"%SERVICE_DIR%scripts\log-rotate.js\"" /sc HOURLY /st 00:00 /ru SYSTEM /f

if %errorlevel% equ 0 (
    echo.
    echo =====================================================
    echo [成功] 定时任务创建成功！
    echo.
    echo 任务名称: %TASK_NAME%
    echo 执行频率: 每小时整点
    echo 执行命令: node scripts/log-rotate.js
    echo.
    echo 管理命令:
    echo   查看任务: schtasks /query /tn "%TASK_NAME%"
    echo   手动运行: schtasks /run /tn "%TASK_NAME%"
    echo   删除任务: schtasks /delete /tn "%TASK_NAME%" /f
    echo =====================================================
) else (
    echo.
    echo [错误] 定时任务创建失败！请以管理员身份运行此脚本。
)

pause
