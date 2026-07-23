param(
  [switch]$Verify
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")
$nodeModules = Join-Path $repoRoot "node_modules"
$nextDir = Join-Path $repoRoot ".next"
$logDir = Join-Path $repoRoot ".logs"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$installLog = Join-Path $logDir "npm-install-$stamp.log"

function Remove-InRepo {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $resolved = (Resolve-Path -LiteralPath $Path).Path
  if (-not $resolved.StartsWith($repoRoot.Path, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove outside repo: $resolved"
  }

  Remove-Item -LiteralPath $resolved -Recurse -Force
}

function Invoke-Logged {
  param(
    [string]$Command,
    [string[]]$Arguments,
    [string]$LogPath
  )

  Write-Host "> $Command $($Arguments -join ' ')"
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $Command @Arguments *>&1 | Tee-Object -FilePath $LogPath
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    Write-Host ""
    Write-Host "Command failed. Last log lines:"
    Get-Content -LiteralPath $LogPath -Tail 80
    exit $exitCode
  }
}

Set-Location -LiteralPath $repoRoot
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Write-Host "Repo: $repoRoot"
Write-Host "Node: $(& node --version)"
Write-Host "npm:  $(& npm --version)"

Write-Host "Cleaning generated dependency/build folders..."
Remove-InRepo -Path $nodeModules
Remove-InRepo -Path $nextDir

Invoke-Logged -Command "npm" -Arguments @("cache", "verify") -LogPath (Join-Path $logDir "npm-cache-$stamp.log")
Invoke-Logged -Command "npm" -Arguments @("install") -LogPath $installLog

if ($Verify) {
  Invoke-Logged -Command "npm" -Arguments @("run", "lint") -LogPath (Join-Path $logDir "lint-$stamp.log")
  Invoke-Logged -Command "npm" -Arguments @("run", "typecheck") -LogPath (Join-Path $logDir "typecheck-$stamp.log")
  Invoke-Logged -Command "npm" -Arguments @("run", "build") -LogPath (Join-Path $logDir "build-$stamp.log")
}

Write-Host ""
Write-Host "Node modules repaired successfully."
Write-Host "Install log: $installLog"
