@echo off
rem Win7-compatible build: node source (already patched for Windows 7 by
rem vladimir-andreevich/node.js-windows-7) is fetched by the workflow into .\node,
rem then Puerts patches are applied here and vcbuild runs in dll mode.
rem Usage: windows_trybuild_win7.cmd <version> [x86^|x64]
set "VERSION=%~1"
set "ARCH=%~2"
set "WORKSPACE=%GITHUB_WORKSPACE%"
if "%WORKSPACE%"=="" set "WORKSPACE=%~dp0"
for %%I in ("%WORKSPACE%") do set "WORKSPACE=%%~fI"
set "BUILD_ROOT=%WORKSPACE%"

cd /d "%BUILD_ROOT%\node" || exit /b 1

echo =====[ Patching Node.js ]=====
git apply --reject "%WORKSPACE%\patchs\win_build_v%VERSION%.patch"
if errorlevel 1 echo WARNING: win_build patch rejected, check .rej files under node\
git apply --reject "%WORKSPACE%\patchs\lib_uv_add_on_watcher_queue_updated_v%VERSION%.patch"
if errorlevel 1 echo WARNING: libuv patch rejected, check .rej files under node\
copy /y "%WORKSPACE%\zlib.def" deps\zlib\win32\zlib.def
node "%WORKSPACE%\node-script\add_arraybuffer_new_without_stl.js" deps/v8
node "%WORKSPACE%\node-script\make_v8_inspector_export.js"
node "%WORKSPACE%\node-script\select_msvc_toolset.js" vcbuild.bat

echo =====[ Building Node.js ]=====
if "%ARCH%"=="" (
  .\vcbuild.bat dll openssl-no-asm
) else (
  .\vcbuild.bat %ARCH% dll openssl-no-asm
)

echo =====[ Building NODE.EXE forwarder for native addons ]=====
node "%WORKSPACE%\node-script\make_node_exe_forwarder.js" "%BUILD_ROOT%\node\out\Release\libnode.dll" "%BUILD_ROOT%\node\out\Release\node.exe"
