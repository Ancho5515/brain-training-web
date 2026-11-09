#Requires -Version 5.1
[CmdletBinding()]
param([string]$InstallDir = '')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
if ($env:OS -ne 'Windows_NT') { throw 'Run stop.ps1 on the Windows host.' }
. (Join-Path $PSScriptRoot 'common.ps1')
if (-not $InstallDir) { $InstallDir = Join-Path $env:LOCALAPPDATA 'BrainTrainingWeb' }
$InstallDir = Get-BrainFullPath $InstallDir
if (-not (Test-Path -LiteralPath $InstallDir -PathType Container)) { Write-Host 'This installation is not running.'; return }
$lock = $null
try {
    try { $lock = [IO.File]::Open((Join-Path $InstallDir 'deploy.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw "Cannot acquire deployment lock (another deployment or stop may be running): $($_.Exception.Message)" }
    $state = Read-BrainState $InstallDir
    if (-not $state) { Write-Host 'No deployment state exists. No process was stopped.'; return }
    Stop-BrainOwnedServer $state $InstallDir
    $state.processId = 0; $state.startTimeUtc = ''
    Write-BrainState $InstallDir $state
    Write-Host 'Owned server stopped. Persistent accounts, records and keys were retained.'
} finally { if ($lock) { $lock.Dispose() } }
