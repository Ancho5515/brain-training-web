#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$InstallDir = '',
    [string]$RepoDir = (Split-Path $PSScriptRoot -Parent),
    [string]$DataDir = '',
    [ValidateSet('x64', 'arm64')][string]$Architecture = '',
    [switch]$OpenFirewall,
    [switch]$NoBrowser,
    [string]$ToolsDir = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
if ($env:OS -ne 'Windows_NT') { throw 'Deployment requires Windows 10/11. Use scripts/tests/run-tests.ps1 for platform-independent decision tests.' }
. (Join-Path $PSScriptRoot 'common.ps1')
if (-not $InstallDir) { $InstallDir = Join-Path $env:LOCALAPPDATA 'BrainTrainingWeb' }
$InstallDir = Get-BrainFullPath $InstallDir; $RepoDir = Get-BrainFullPath $RepoDir
if (-not $Architecture) {
    $native = $env:PROCESSOR_ARCHITECTURE; if ($env:PROCESSOR_ARCHITEW6432) { $native = $env:PROCESSOR_ARCHITEW6432 }
    if ($native -eq 'ARM64') { $Architecture = 'arm64' } elseif ($native -eq 'AMD64') { $Architecture = 'x64' } else { throw 'A 64-bit Windows PC is required.' }
}
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
New-Item $InstallDir -ItemType Directory -Force | Out-Null
$lock = $null
try {
    try { $lock = [IO.File]::Open((Join-Path $InstallDir 'deploy.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { throw "Cannot acquire deployment lock (another deployment or stop may be running): $($_.Exception.Message)" }
    $current = Read-BrainState $InstallDir
    $DataDir = Resolve-BrainDataDirectory $InstallDir $DataDir $current
    if ((Test-BrainSamePath $DataDir $RepoDir) -or (Test-BrainChildPath $DataDir $RepoDir)) { throw 'Use a persistent data directory outside the source checkout.' }
    $snapshot = $null; if ($current) { $snapshot = Get-BrainProcessSnapshot ([int]$current.processId) }
    Assert-BrainPortAvailable @(Get-BrainPortOwners) $current $snapshot $InstallDir
    $nodeHome = Find-BrainBuildTool 'node' $Architecture $ToolsDir $InstallDir
    $dotnetHome = Find-BrainBuildTool 'dotnet' $Architecture $ToolsDir $InstallDir
    foreach ($tool in @('node', 'dotnet')) {
        $spec = Get-BrainToolSpec $tool $Architecture
        $archive = Join-Path $InstallDir "downloads/$($spec.Archive)"
        if (Test-Path -LiteralPath $archive -PathType Leaf) { Remove-Item -LiteralPath $archive -Force }
    }
    if (-not $nodeHome -or -not $dotnetHome) {
        $toolCache = Get-BrainToolsDir $ToolsDir
        New-Item -Path $toolCache -ItemType Directory -Force | Out-Null
        try { $toolLock = [IO.File]::Open((Join-Path $toolCache 'install.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
        catch { throw "Cannot acquire the shared tools lock in $toolCache. Retry after other installations finish: $($_.Exception.Message)" }
        try {
            if (-not $nodeHome) { $nodeHome = Install-BrainNode $InstallDir $Architecture $toolCache }
            if (-not $dotnetHome) { $dotnetHome = Install-BrainDotnet $InstallDir $Architecture $toolCache }
        } finally { $toolLock.Dispose() }
    }
    Write-Host "Node: $nodeHome"
    Write-Host ".NET SDK: $dotnetHome"
    $build = { param($stage) Invoke-BrainBuildRelease $stage $RepoDir $nodeHome $dotnetHome $Architecture }
    $result = Invoke-BrainReleaseTransaction -InstallDir $InstallDir -DataDir $DataDir -RepoDir $RepoDir -BuildAction $build
    if ($OpenFirewall) { Open-BrainFirewall | Out-Null }
    Write-Host ''
    Write-Host 'Brain Training Web is healthy and running in the background.'
    Write-Host 'This PC: http://localhost:8787'
    try { foreach ($url in @(Get-BrainLanUrls)) { Write-Host "Phone/iPad on the same LAN: $url" } }
    catch { Write-Warning 'Could not list LAN addresses. Run ipconfig and use http://<this-PC-IPv4>:8787 on the same LAN.' }
    Write-Host "Persistent data and keys: $($result.dataDir)"
    Write-Host "Logs: $(Join-Path $InstallDir 'logs')"
    Write-Host 'The app stops at Windows sign-out/restart; run the same bootstrap command to start/deploy again.'
    if (-not $NoBrowser) {
        try { Start-Process 'http://localhost:8787' | Out-Null }
        catch { Write-Warning 'The app is running; open http://localhost:8787 in a browser.' }
    }
} finally { if ($lock) { $lock.Dispose() } }
