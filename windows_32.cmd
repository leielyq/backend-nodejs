setlocal EnableExtensions EnableDelayedExpansion

set "BUILD_ROOT=%GITHUB_WORKSPACE%"
if "%BUILD_ROOT%"=="" set "BUILD_ROOT=%CD%"
if "%PREFERRED_MSVC_TOOLSET_VERSION%"=="" set "PREFERRED_MSVC_TOOLSET_VERSION=14.29"

cd /d "%BUILD_ROOT%" || exit /b 1

if not exist "node\out\Release\libnode.dll" (
  echo Missing Node.js build output: "%BUILD_ROOT%\node\out\Release\libnode.dll"
  if exist "node\out\Release" dir "node\out\Release"
  exit /b 1
)

md puerts-node\nodejs\include
md puerts-node\nodejs\deps\uv\include
md puerts-node\nodejs\deps\v8\include

echo =====[ Copying public Node.js headers ]=====
copy /y "node\src\js_native_api.h" ".\puerts-node\nodejs\include\" || exit /b 1
copy /y "node\src\js_native_api_types.h" ".\puerts-node\nodejs\include\" || exit /b 1
copy /y "node\src\node.h" ".\puerts-node\nodejs\include\" || exit /b 1
copy /y "node\src\node_api.h" ".\puerts-node\nodejs\include\" || exit /b 1
copy /y "node\src\node_api_types.h" ".\puerts-node\nodejs\include\" || exit /b 1
copy /y "node\src\node_buffer.h" ".\puerts-node\nodejs\include\" || exit /b 1
copy /y "node\src\node_object_wrap.h" ".\puerts-node\nodejs\include\" || exit /b 1
copy /y "node\src\node_version.h" ".\puerts-node\nodejs\include\" || exit /b 1
xcopy /e /i /y "node\deps\uv\include" ".\puerts-node\nodejs\deps\uv\include\" || exit /b 1
xcopy /e /i /y "node\deps\v8\include" ".\puerts-node\nodejs\deps\v8\include\" || exit /b 1

md puerts-node\nodejs\Lib\Win32\
copy /y "node\out\Release\libnode.dll" ".\puerts-node\nodejs\Lib\Win32\"
copy /y "node\out\Release\libnode.exp" ".\puerts-node\nodejs\Lib\Win32\"
copy /y "node\out\Release\libnode.lib" ".\puerts-node\nodejs\Lib\Win32\"
copy /y "node\out\Release\node.exe" ".\puerts-node\nodejs\Lib\Win32\"

echo =====[ Copying Visual C++ runtime DLLs ]=====
if "!PREFERRED_VC_REDIST_ROOT!"=="" (
  if "!PREFERRED_VS_INSTALL_PATH!"=="" (
    set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
    if exist "!VSWHERE!" (
      for /f "usebackq delims=" %%I in (`"!VSWHERE!" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do if "!PREFERRED_VS_INSTALL_PATH!"=="" set "PREFERRED_VS_INSTALL_PATH=%%I"
    )
  )
  if "!PREFERRED_VS_INSTALL_PATH!"=="" (
    echo Missing PREFERRED_VS_INSTALL_PATH; cannot locate Visual C++ runtime redistributables.
    exit /b 1
  )
  set "VC_REDIST_BASE=!PREFERRED_VS_INSTALL_PATH!\VC\Redist\MSVC"
  if not "!PREFERRED_MSVC_TOOLSET_FULL_VERSION!"=="" if exist "!VC_REDIST_BASE!\!PREFERRED_MSVC_TOOLSET_FULL_VERSION!" set "PREFERRED_VC_REDIST_ROOT=!VC_REDIST_BASE!\!PREFERRED_MSVC_TOOLSET_FULL_VERSION!"
  if "!PREFERRED_VC_REDIST_ROOT!"=="" (
    for /f "delims=" %%D in ('dir /b /ad /o-n "!VC_REDIST_BASE!\!PREFERRED_MSVC_TOOLSET_VERSION!.*" 2^>nul') do if "!PREFERRED_VC_REDIST_ROOT!"=="" set "PREFERRED_VC_REDIST_ROOT=!VC_REDIST_BASE!\%%D"
  )
)
if not exist "!PREFERRED_VC_REDIST_ROOT!" (
  echo Missing VC runtime redistributable root: "!PREFERRED_VC_REDIST_ROOT!"
  exit /b 1
)
set "VC_RUNTIME_SOURCE="
for /d %%D in ("!PREFERRED_VC_REDIST_ROOT!\x86\Microsoft.VC*.CRT") do if "!VC_RUNTIME_SOURCE!"=="" set "VC_RUNTIME_SOURCE=%%~fD"
if "!VC_RUNTIME_SOURCE!"=="" (
  echo Missing VC runtime CRT directory: "!PREFERRED_VC_REDIST_ROOT!\x86\Microsoft.VC*.CRT"
  exit /b 1
)
echo Using Visual C++ runtime DLLs from "!VC_RUNTIME_SOURCE!"
copy /y "!VC_RUNTIME_SOURCE!\concrt140.dll" ".\puerts-node\nodejs\Lib\Win32\" || exit /b 1
copy /y "!VC_RUNTIME_SOURCE!\msvcp140*.dll" ".\puerts-node\nodejs\Lib\Win32\" || exit /b 1
copy /y "!VC_RUNTIME_SOURCE!\vccorlib140.dll" ".\puerts-node\nodejs\Lib\Win32\" || exit /b 1
copy /y "!VC_RUNTIME_SOURCE!\vcruntime140*.dll" ".\puerts-node\nodejs\Lib\Win32\" || exit /b 1
