$ErrorActionPreference = "Stop"

$programFilesX86 = ${env:ProgramFiles(x86)}
if (-not $programFilesX86) {
  throw "ProgramFiles(x86) is not set; cannot locate Visual Studio Installer."
}

$installerRoot = Join-Path $programFilesX86 "Microsoft Visual Studio\Installer"
$vswhere = Join-Path $installerRoot "vswhere.exe"

if (-not (Test-Path -LiteralPath $vswhere)) {
  throw "vswhere.exe not found: $vswhere"
}

function Get-VisualStudioInstallPath {
  $path = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if ($LASTEXITCODE -ne 0 -or -not $path) {
    throw "No Visual Studio installation with VC tools was found."
  }

  return ($path | Select-Object -First 1).Trim()
}

function Get-LatestMsvcToolsetDirectory([string]$InstallPath) {
  $toolsRoot = Join-Path $InstallPath "VC\Tools\MSVC"
  if (-not (Test-Path -LiteralPath $toolsRoot)) {
    throw "MSVC tools root does not exist: $toolsRoot"
  }

  $toolsets = @(Get-ChildItem -LiteralPath $toolsRoot -Directory | Sort-Object -Property Name -Descending)
  if ($toolsets.Count -eq 0) {
    throw "No MSVC toolset directories found under $toolsRoot"
  }

  return $toolsets[0]
}

function Get-VcRedistRoot([string]$InstallPath, [string]$MsvcFullVersion) {
  $redistBase = Join-Path $InstallPath "VC\Redist\MSVC"
  if (-not (Test-Path -LiteralPath $redistBase)) {
    throw "VC runtime redistributable root does not exist: $redistBase"
  }

  $candidates = @()
  $exactRedistRoot = Join-Path $redistBase $MsvcFullVersion
  if (Test-Path -LiteralPath $exactRedistRoot) {
    $candidates += Get-Item -LiteralPath $exactRedistRoot
  }

  $numericRedistRoots = @(Get-ChildItem -LiteralPath $redistBase -Directory |
    Where-Object { $_.Name -match '^\d+\.\d+' } |
    Sort-Object -Property Name -Descending)
  foreach ($candidate in $numericRedistRoots) {
    if ($candidates.FullName -notcontains $candidate.FullName) {
      $candidates += $candidate
    }
  }

  if ($candidates.Count -eq 0) {
    $candidates = @(Get-ChildItem -LiteralPath $redistBase -Directory | Sort-Object -Property Name -Descending)
  }

  foreach ($candidate in $candidates) {
    $hasAllArchitectures = $true
    foreach ($arch in @("x64", "x86")) {
      $crtRoot = Join-Path $candidate.FullName $arch
      $crtDirs = @(Get-ChildItem -LiteralPath $crtRoot -Directory -Filter "Microsoft.VC*.CRT" -ErrorAction SilentlyContinue)
      if ($crtDirs.Count -eq 0) {
        $hasAllArchitectures = $false
      }
    }

    if ($hasAllArchitectures) {
      return $candidate.FullName
    }
  }

  throw "No VC runtime CRT redistributable directory was found under $redistBase"
}

$installPath = Get-VisualStudioInstallPath
$selectedToolset = Get-LatestMsvcToolsetDirectory -InstallPath $installPath
$selected = $selectedToolset.Name
$redistRoot = Get-VcRedistRoot -InstallPath $installPath -MsvcFullVersion $selected

Write-Host "Visual Studio install path: $installPath"
Write-Host "Using latest MSVC toolset $selected from $($selectedToolset.FullName)"
Write-Host "Using VC runtime redistributables from $redistRoot"

if ($env:GITHUB_ENV) {
  "PREFERRED_MSVC_TOOLSET_FULL_VERSION=$selected" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
  "PREFERRED_VS_INSTALL_PATH=$installPath" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
  "PREFERRED_VC_REDIST_ROOT=$redistRoot" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
}
