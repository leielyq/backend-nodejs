param(
  [string]$ToolsetVersion = "14.29"
)

$ErrorActionPreference = "Stop"

$componentIds = @{
  "14.29" = "Microsoft.VisualStudio.Component.VC.14.29.16.11.x86.x64"
  "14.34" = "Microsoft.VisualStudio.Component.VC.14.34.17.4.x86.x64"
}

if (-not $componentIds.ContainsKey($ToolsetVersion)) {
  throw "Unsupported MSVC toolset '$ToolsetVersion'. Supported versions: $($componentIds.Keys -join ', ')"
}

$componentId = $componentIds[$ToolsetVersion]
$programFilesX86 = ${env:ProgramFiles(x86)}
if (-not $programFilesX86) {
  throw "ProgramFiles(x86) is not set; cannot locate Visual Studio Installer."
}

$installerRoot = Join-Path $programFilesX86 "Microsoft Visual Studio\Installer"
$vswhere = Join-Path $installerRoot "vswhere.exe"
$installer = Join-Path $installerRoot "setup.exe"

if (-not (Test-Path -LiteralPath $vswhere)) {
  throw "vswhere.exe not found: $vswhere"
}

function Get-VisualStudioInstallPaths {
  $paths = & $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if ($LASTEXITCODE -ne 0 -or -not $paths) {
    throw "No Visual Studio installation with VC tools was found."
  }

  return @($paths | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Get-MsvcToolsetDirectories([string]$InstallPath) {
  $toolsRoot = Join-Path $InstallPath "VC\Tools\MSVC"
  if (-not (Test-Path -LiteralPath $toolsRoot)) {
    return @()
  }

  return Get-ChildItem -LiteralPath $toolsRoot -Directory |
    Where-Object { $_.Name -like "$ToolsetVersion.*" } |
    Sort-Object -Property Name -Descending
}

function Format-InstalledMsvcToolsets([string]$InstallPath) {
  $toolsRoot = Join-Path $InstallPath "VC\Tools\MSVC"
  if (-not (Test-Path -LiteralPath $toolsRoot)) {
    return "MSVC tools root does not exist: $toolsRoot"
  }

  $allToolsets = @(Get-ChildItem -LiteralPath $toolsRoot -Directory | Sort-Object -Property Name)
  if ($allToolsets.Count -eq 0) {
    return "No MSVC toolset directories found under $toolsRoot"
  }

  return ($allToolsets | ForEach-Object { $_.Name }) -join ", "
}

function Select-VisualStudioInstallPathWithToolset([string[]]$InstallPaths) {
  foreach ($candidatePath in $InstallPaths) {
    $candidateToolsets = @(Get-MsvcToolsetDirectories -InstallPath $candidatePath)
    if ($candidateToolsets.Count -gt 0) {
      return $candidatePath
    }
  }

  return $null
}

function Format-AllInstalledMsvcToolsets([string[]]$InstallPaths) {
  return ($InstallPaths | ForEach-Object {
    "$($_): $(Format-InstalledMsvcToolsets -InstallPath $_)"
  }) -join "; "
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

  $matchingRedistRoots = @(Get-ChildItem -LiteralPath $redistBase -Directory |
    Where-Object { $_.Name -like "$ToolsetVersion.*" } |
    Sort-Object -Property Name -Descending)
  foreach ($candidate in $matchingRedistRoots) {
    if ($candidates.FullName -notcontains $candidate.FullName) {
      $candidates += $candidate
    }
  }

  if ($candidates.Count -eq 0) {
    throw "No VC runtime redistributable directory matching MSVC $ToolsetVersion was found under $redistBase"
  }

  foreach ($arch in @("x64", "x86")) {
    $crtRoot = Join-Path $candidates[0].FullName $arch
    $crtDirs = @(Get-ChildItem -LiteralPath $crtRoot -Directory -Filter "Microsoft.VC*.CRT" -ErrorAction SilentlyContinue)
    if ($crtDirs.Count -eq 0) {
      throw "No VC runtime CRT directory found under $crtRoot"
    }
  }

  return $candidates[0].FullName
}

$installPaths = @(Get-VisualStudioInstallPaths)
$installPath = Select-VisualStudioInstallPathWithToolset -InstallPaths $installPaths
if (-not $installPath) {
  $installPath = $installPaths[0]
}

Write-Host "Visual Studio install path: $installPath"
Write-Host "Installed MSVC toolsets before selection: $(Format-InstalledMsvcToolsets -InstallPath $installPath)"

$toolsets = @(Get-MsvcToolsetDirectories -InstallPath $installPath)

if ($toolsets.Count -eq 0) {
  if (-not (Test-Path -LiteralPath $installer)) {
    throw "Visual Studio Installer setup.exe not found: $installer"
  }

  Write-Host "MSVC $ToolsetVersion toolset not found. Installing component $componentId..."
  & $installer modify --installPath $installPath --add $componentId --quiet --norestart --nocache --removeOos false
  if ($LASTEXITCODE -ne 0) {
    throw "Visual Studio Installer failed with exit code $LASTEXITCODE."
  }

  Write-Host "Installed MSVC toolsets after installer: $(Format-InstalledMsvcToolsets -InstallPath $installPath)"
  $installPaths = @(Get-VisualStudioInstallPaths)
  $installPathWithToolset = Select-VisualStudioInstallPathWithToolset -InstallPaths $installPaths
  if ($installPathWithToolset) {
    $installPath = $installPathWithToolset
  }
  $toolsets = @(Get-MsvcToolsetDirectories -InstallPath $installPath)
}

if ($toolsets.Count -eq 0) {
  $installedToolsets = Format-AllInstalledMsvcToolsets -InstallPaths $installPaths
  throw "MSVC $ToolsetVersion toolset is still missing after installation. Installed MSVC toolsets: $installedToolsets"
}

$selected = $toolsets[0].Name
Write-Host "Using MSVC toolset $selected from $($toolsets[0].FullName)"
$redistRoot = Get-VcRedistRoot -InstallPath $installPath -MsvcFullVersion $selected
Write-Host "Using VC runtime redistributables from $redistRoot"

if ($env:GITHUB_ENV) {
  "PREFERRED_MSVC_TOOLSET_VERSION=$ToolsetVersion" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
  "PREFERRED_MSVC_TOOLSET_FULL_VERSION=$selected" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
  "PREFERRED_VS_INSTALL_PATH=$installPath" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
  "PREFERRED_VC_REDIST_ROOT=$redistRoot" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
}
