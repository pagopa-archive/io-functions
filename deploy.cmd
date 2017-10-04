@if "%SCM_TRACE_LEVEL%" NEQ "4" @echo off

:: ----------------------
:: KUDU Deployment Script
:: Version: 1.0.15
:: ----------------------

:: Prerequisites
:: -------------

:: Verify node.js installed
where node 2>nul >nul
IF %ERRORLEVEL% NEQ 0 (
  echo Missing node.js executable, please install node.js, if already installed make sure it can be reached from current environment.
  goto error
)

:: Setup
:: -----

setlocal enabledelayedexpansion

SET ARTIFACTS=%~dp0%..\artifacts

IF NOT DEFINED DEPLOYMENT_SOURCE (
  SET DEPLOYMENT_SOURCE=%~dp0%.
)

IF NOT DEFINED DEPLOYMENT_TARGET (
  SET DEPLOYMENT_TARGET=%ARTIFACTS%\wwwroot
)

IF NOT DEFINED NEXT_MANIFEST_PATH (
  SET NEXT_MANIFEST_PATH=%ARTIFACTS%\manifest

  IF NOT DEFINED PREVIOUS_MANIFEST_PATH (
    SET PREVIOUS_MANIFEST_PATH=%ARTIFACTS%\manifest
  )
)

IF NOT DEFINED KUDU_SYNC_CMD (
  :: Install kudu sync
  echo Installing Kudu Sync
  call npm install kudusync -g --silent
  IF !ERRORLEVEL! NEQ 0 goto error

  :: Locally just running "kuduSync" would also work
  SET KUDU_SYNC_CMD=%appdata%\npm\kuduSync.cmd
)

::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
:: Deployment
:: ----------

echo Handling function App deployment.

if "%SCM_USE_FUNCPACK%" == "1" (
  call :DeployWithFuncPack
) else (
  call :DeployWithoutFuncPack
)

goto end

:DeployWithFuncPack
setlocal

echo Using funcpack to optimize cold start

:: 1. Copy to local storage
echo Copying repository files to local storage
xcopy "%DEPLOYMENT_SOURCE%" "%DEPLOYMENT_TEMP%" /seyiq
IF !ERRORLEVEL! NEQ 0 goto error

:: 2. Restore npm
call :RestoreNpmPackages "%DEPLOYMENT_TEMP%"

:: 3. FuncPack
pushd "%DEPLOYMENT_TEMP%"
call funcpack pack .
IF !ERRORLEVEL! NEQ 0 goto error
popd

:: 4. KuduSync
call :ExecuteCmd "%KUDU_SYNC_CMD%" -v 50 -f "%DEPLOYMENT_TEMP%" -t "%DEPLOYMENT_TARGET%" -n "%NEXT_MANIFEST_PATH%" -p "%PREVIOUS_MANIFEST_PATH%" -i ".git;.hg;.deployment;deploy.cmd;node_modules"
IF !ERRORLEVEL! NEQ 0 goto error

exit /b %ERRORLEVEL%


:DeployWithoutFuncPack
setlocal

echo Not using funcpack because SCM_USE_FUNCPACK is not set to 1

:: 1. KuduSync
IF /I "%IN_PLACE_DEPLOYMENT%" NEQ "1" (
  call :ExecuteCmd "%KUDU_SYNC_CMD%" -v 50 -f "%DEPLOYMENT_SOURCE%" -t "%DEPLOYMENT_TARGET%" -n "%NEXT_MANIFEST_PATH%" -p "%PREVIOUS_MANIFEST_PATH%" -i ".git;.hg;.deployment;deploy.cmd"
  IF !ERRORLEVEL! NEQ 0 goto error
)

:: 2. Restore npm
call :RestoreNpmPackages "%DEPLOYMENT_TARGET%"

exit /b %ERRORLEVEL%


:RestoreNpmPackages
setlocal

echo Restoring npm packages in %1

IF EXIST "%1\package.json" (
  pushd "%1"
  call npm install
  call npm run build
  IF !ERRORLEVEL! NEQ 0 goto error
  popd
)

exit /b %ERRORLEVEL%

::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
goto end

:: Execute command routine that will echo out when error
:ExecuteCmd
setlocal
set _CMD_=%*
call %_CMD_%
if "%ERRORLEVEL%" NEQ "0" echo Failed exitCode=%ERRORLEVEL%, command=%_CMD_%
exit /b %ERRORLEVEL%

:error
endlocal
echo An error has occurred during web site deployment.
call :exitSetErrorLevel
call :exitFromFunction 2>nul

:exitSetErrorLevel
exit /b 1

:exitFromFunction
()

:end
endlocal
echo Finished successfully.
