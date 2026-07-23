$ErrorActionPreference = "Stop"

$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..\..")
Set-Location -LiteralPath $root

Write-Output "Repo: $root"
Write-Output "CodeGraph: $(Test-Path -LiteralPath .codegraph)"
Write-Output "Node: $(& node --version 2>$null)"
Write-Output "npm: $(& npm --version 2>$null)"

if (Get-Command docker -ErrorAction SilentlyContinue) {
  Write-Output "Docker:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

Write-Output "Listening ports 3000/5432:"
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in @(3000, 5432) } |
  Select-Object LocalAddress, LocalPort, State, OwningProcess |
  Format-Table -AutoSize

Write-Output "Package scripts:"
node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts||{}).join('\n'))"
