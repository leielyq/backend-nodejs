@echo off
rem @file windows_trybuild_win7.cmd
rem
rem 排查留痕（2026-09-17，首次 CI 实跑发现，修复 commit a21ef60 后续修正）：
rem [问题1] 现象：CI 日志输出 "Skipped patch 'node.gyp'." 且 exit 0，但补丁未生效。
rem         根因：node/ 目录位于 backend-nodejs 仓库内且未被 git 追踪，git apply 对
rem               外层仓库中 untracked 的路径会静默跳过（Skipped patch，成功退出）。
rem               本地干净 pre-image 复现实锤：repo 内 apply 不改文件，exit 0。
rem         修复：进入 node/ 后先 `git init -q .` 让其成为独立仓库根（见下）。
rem [问题2] 现象："Failed to find a suitable Visual Studio installation."
rem         根因：windows-latest 已是 Windows Server 2025 + VS2026(v18)，而 node
rem               20.19.x 的 vcbuild.bat 只探测 [17.0,18.0) 的 VS2022/VS2019。
rem         修复：workflow 使用 runs-on: windows-2022（见 build_20_win7.yml）。
rem
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

rem Give the source tree its own repo root: git apply silently skips
rem ("Skipped patch ...", exit 0) paths untracked by an outer repository.
git init -q .

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
