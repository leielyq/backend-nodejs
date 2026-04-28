set "BUILD_ROOT=%GITHUB_WORKSPACE%"
if "%BUILD_ROOT%"=="" set "BUILD_ROOT=%CD%"

cd /d "%BUILD_ROOT%" || exit /b 1

if not exist "node\out\Release\libnode.dll" (
  echo Missing Node.js build output: "%BUILD_ROOT%\node\out\Release\libnode.dll"
  if exist "node\out\Release" dir "node\out\Release"
  exit /b 1
)

md puerts-node\nodejs\include
md puerts-node\nodejs\deps\uv\include
md puerts-node\nodejs\deps\v8\include

md puerts-node\nodejs\Lib\Win64\
copy /y "node\out\Release\libnode.dll" ".\puerts-node\nodejs\Lib\Win64\"
copy /y "node\out\Release\libnode.exp" ".\puerts-node\nodejs\Lib\Win64\"
copy /y "node\out\Release\libnode.lib" ".\puerts-node\nodejs\Lib\Win64\"
copy /y "node\out\Release\libnode.pdb" ".\puerts-node\nodejs\Lib\Win64\"
copy /y "node\out\Release\node.exe" ".\puerts-node\nodejs\Lib\Win64\"
