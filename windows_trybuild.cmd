set "VERSION=%~1"
set "WORKSPACE=%GITHUB_WORKSPACE%"
if "%WORKSPACE%"=="" set "WORKSPACE=%~dp0"
for %%I in ("%WORKSPACE%") do set "WORKSPACE=%%~fI"
set "BUILD_ROOT=%WORKSPACE%"

cd /d "%BUILD_ROOT%" || exit /b 1
git clone https://github.com/nodejs/node.git

cd node
git fetch origin v%VERSION%
git checkout v%VERSION%

echo =====[ Patching Node.js ]=====
node "%WORKSPACE%\node-script\do-gitpatch.js" -p "%WORKSPACE%\patchs\win_build_v%VERSION%.patch"
node "%WORKSPACE%\node-script\do-gitpatch.js" -p "%WORKSPACE%\patchs\lib_uv_add_on_watcher_queue_updated_v%VERSION%.patch"
copy /y "%WORKSPACE%\zlib.def" deps\zlib\win32\zlib.def
node "%WORKSPACE%\node-script\add_arraybuffer_new_without_stl.js" deps/v8
node "%WORKSPACE%\node-script\make_v8_inspector_export.js"
node "%WORKSPACE%\node-script\select_msvc_toolset.js" vcbuild.bat

echo =====[ Applying security backports ]=====
rem Security patches backported from newer release lines live in
rem patchs\security_v<version>\ and are applied in filename order.
rem A failed security patch must abort the build - never skip silently.
if exist "%WORKSPACE%\patchs\security_v%VERSION%\*.patch" (
  for /f "delims=" %%P in ('dir /b /o:n "%WORKSPACE%\patchs\security_v%VERSION%\*.patch"') do (
    echo Applying security patch: %%P
    git apply --reject "%WORKSPACE%\patchs\security_v%VERSION%\%%P"
    if errorlevel 1 (
      echo ERROR: security patch %%P failed to apply. Check .rej files under node\
      exit /b 1
    )
  )
) else (
  echo No security patch directory for v%VERSION%, skipping.
)

echo =====[ Building Node.js ]=====
.\vcbuild.bat dll openssl-no-asm

echo =====[ Building NODE.EXE forwarder for native addons ]=====
node "%WORKSPACE%\node-script\make_node_exe_forwarder.js" "%BUILD_ROOT%\node\out\Release\libnode.dll" "%BUILD_ROOT%\node\out\Release\node.exe"
