#Requires -Version 5.1
<#
Standalone public entry point. Existing checkouts are built as-is unless -Update
is explicitly supplied. Downloads and tools remain under the current user.
#>
[CmdletBinding()]
param(
    [string]$InstallDir = '',
    [string]$RepoDir = '',
    [string]$DataDir = '',
    [switch]$Update,
    [switch]$OpenFirewall,
    [switch]$NoBrowser,
    [string]$ToolsDir = ''
)

function Get-BrainBootstrapProperty {
    param($Object, [string]$Name, $Default = $null)
    if ($null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name]) { return $Object.$Name }
    return $Default
}

function Get-BrainArchitecture {
    param([string]$ProcessArchitecture = $env:PROCESSOR_ARCHITECTURE, [string]$NativeArchitecture = $env:PROCESSOR_ARCHITEW6432)
    $architecture = $ProcessArchitecture
    if (-not [string]::IsNullOrWhiteSpace($NativeArchitecture)) { $architecture = $NativeArchitecture }
    switch ($architecture.ToUpperInvariant()) {
        'AMD64' { return 'x64' }
        'ARM64' { return 'arm64' }
        default { throw 'A 64-bit Windows 10/11 PC (x64 or ARM64) is required.' }
    }
}

function Test-BrainRepositoryRemote {
    param([string]$Remote)
    return ($Remote.TrimEnd('/') -match '^(?i:https://github\.com/Ancho5515/brain-training-web(?:\.git)?|git@github\.com:Ancho5515/brain-training-web(?:\.git)?|ssh://git@github\.com/Ancho5515/brain-training-web(?:\.git)?)$')
}

function Invoke-BrainBootstrapDownload {
    param([string]$Uri, [string]$OutFile = '')
    if (-not $Uri.StartsWith('https://', [StringComparison]::OrdinalIgnoreCase)) { throw 'Downloads require HTTPS.' }
    $oldProgress = $ProgressPreference
    try {
        $ProgressPreference = 'SilentlyContinue'
        $parameters = @{ Uri = $Uri; UseBasicParsing = $true; ErrorAction = 'Stop'; Headers = @{ 'User-Agent' = 'BrainTrainingWeb-Bootstrap' } }
        if ($OutFile) { $parameters.OutFile = $OutFile; Invoke-WebRequest @parameters | Out-Null }
        else { return (Invoke-WebRequest @parameters).Content }
    } finally { $ProgressPreference = $oldProgress }
}

function Invoke-BrainBootstrapGit {
    param([string]$Git, [string[]]$Arguments)
    # Windows PowerShell 5.1 wraps redirected native stderr as error records,
    # including Git's successful clone/fetch progress. Judge native exit status.
    $oldPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $Git @Arguments 2>&1)
        $nativeExitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $oldPreference }
    if ($nativeExitCode -ne 0) { throw ("Git failed: {0}" -f ($output -join [Environment]::NewLine)) }
    return ($output -join [Environment]::NewLine).Trim()
}

function Get-BrainMinGitArtifact {
    param([ValidateSet('x64', 'arm64')][string]$Architecture)
    # Published by the immutable official Git for Windows release:
    # https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.4
    # Pinning the URL and its published hash avoids GitHub API rate limits.
    $name = 'MinGit-2.56.0.4-64-bit.zip'
    $hash = 'e3bf78351fe777fba47ddee5950082f8a98bb0f02604fdc7ba3ee2cb68ffa877'
    if ($Architecture -eq 'arm64') {
        $name = 'MinGit-2.56.0.4-arm64.zip'
        $hash = '70f7649f78088c1db1d2f3571ca46a04d5bef06e4e9d56d8ed7f9829e8c6c4db'
    }
    return [pscustomobject]@{ name = $name; hash = $hash; url = "https://github.com/git-for-windows/git/releases/download/v2.56.0.windows.4/$name" }
}

function Get-BrainBootstrapGit {
    param([string]$InstallDir, [string]$Architecture)
    $asset = Get-BrainMinGitArtifact $Architecture
    $gitHome = Join-Path $InstallDir 'tools/git'
    $gitPath = Join-Path $gitHome 'cmd/git.exe'
    $cache = Join-Path $InstallDir 'downloads'
    $zip = Join-Path $cache $asset.name
    $temporaryHome = Join-Path $InstallDir ('tools/git-staging-' + [Guid]::NewGuid().ToString('N'))
    try {
        $gitCommand = Get-Command 'git.exe' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $gitCommand) { $gitCommand = Get-Command 'git' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 }
        if ($gitCommand) { return $gitCommand.Source }
        if (Test-Path -LiteralPath $gitPath -PathType Leaf) { return $gitPath }

        Write-Host 'Git is missing; downloading official portable MinGit (no administrator access).'
        New-Item -Path $cache -ItemType Directory -Force | Out-Null
        Invoke-BrainBootstrapDownload $asset.url $zip
        if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ine $asset.hash) { throw 'MinGit checksum verification failed; archive will not be run.' }
        Write-Host 'MinGit SHA256 verified against the official release checksum.'
        Expand-Archive -LiteralPath $zip -DestinationPath $temporaryHome -Force
        if (-not (Test-Path -LiteralPath (Join-Path $temporaryHome 'cmd/git.exe') -PathType Leaf)) { throw 'MinGit archive is missing cmd/git.exe.' }
        if (Test-Path -LiteralPath $gitHome) { throw "Incomplete Git directory already exists: $gitHome. Rename it and retry." }
        Move-Item -LiteralPath $temporaryHome -Destination $gitHome
        return $gitPath
    } finally {
        if (Test-Path -LiteralPath $zip -PathType Leaf) { Remove-Item -LiteralPath $zip -Force }
        if (Test-Path -LiteralPath $temporaryHome) { Remove-Item -LiteralPath $temporaryHome -Recurse -Force }
    }
}

function Assert-BrainCheckout {
    param([string]$Git, [string]$Path)
    $full = [IO.Path]::GetFullPath($Path).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $top = Invoke-BrainBootstrapGit $Git @('-C', $full, 'rev-parse', '--show-toplevel')
    if (-not [string]::Equals($full, [IO.Path]::GetFullPath($top).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) { throw "Expected a repository root: $full" }
    $remote = Invoke-BrainBootstrapGit $Git @('-C', $full, 'config', '--get', 'remote.origin.url')
    if (-not (Test-BrainRepositoryRemote $remote)) { throw "Repository remote is not Ancho5515/brain-training-web: $full" }
    foreach ($relative in @('client/package.json', 'server/BrainTraining.Server.csproj')) {
        if (-not (Test-Path -LiteralPath (Join-Path $full $relative) -PathType Leaf)) { throw "Checkout is missing $relative. Existing source is not automatically updated." }
    }
    return $full
}

function Find-BrainCheckout {
    param([string]$Git, [string]$InstallDir, [string]$CurrentDirectory, [string]$ExplicitRepoDir)
    if ($ExplicitRepoDir) { return Assert-BrainCheckout $Git $ExplicitRepoDir }
    # Searching parents avoids invoking git in an arbitrary non-repository and
    # makes a wrong enclosing checkout a clear error instead of silently cloning.
    $cursor = [IO.Path]::GetFullPath($CurrentDirectory)
    while ($cursor) {
        if (Test-Path -LiteralPath (Join-Path $cursor '.git')) { return Assert-BrainCheckout $Git $cursor }
        $parent = Split-Path $cursor -Parent
        if ($parent -eq $cursor) { break }; $cursor = $parent
    }
    $managedRepo = Join-Path $InstallDir 'repo'
    if (Test-Path -LiteralPath $managedRepo) { return Assert-BrainCheckout $Git $managedRepo }
    $stateFile = Join-Path $InstallDir 'state/current.json'
    if (Test-Path -LiteralPath $stateFile -PathType Leaf) {
        $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        if ((Get-BrainBootstrapProperty $state 'application' '') -ne 'brain-training-web') { throw 'Unexpected deployment state application.' }
        $recordedRepo = Get-BrainBootstrapProperty $state 'repoDir' ''
        if ($recordedRepo -and (Test-Path -LiteralPath $recordedRepo)) { return Assert-BrainCheckout $Git $recordedRepo }
    }
    return $null
}

function Get-BrainCheckoutAction {
    param([bool]$Exists, [bool]$UpdateRequested)
    if (-not $Exists) { return 'Clone' }; if ($UpdateRequested) { return 'Update' }; return 'Reuse'
}

function Update-BrainCheckout {
    param([string]$Git, [string]$Path)
    $dirty = Invoke-BrainBootstrapGit $Git @('-C', $Path, 'status', '--porcelain')
    if ($dirty) { throw 'Update refused because the checkout has local changes. Commit or stash them, or deploy again without -Update.' }
    $branch = Invoke-BrainBootstrapGit $Git @('-C', $Path, 'symbolic-ref', '--quiet', '--short', 'HEAD')
    if (-not $branch) { throw 'Update requires a checked-out branch.' }
    $upstream = Invoke-BrainBootstrapGit $Git @('-C', $Path, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')
    if ($upstream -notmatch '^origin/.+') { throw 'Update requires a branch tracking origin. No branch or remote was changed.' }
    Invoke-BrainBootstrapGit $Git @('-C', $Path, 'fetch', '--prune', 'origin') | Out-Host
    Invoke-BrainBootstrapGit $Git @('-C', $Path, 'merge', '--ff-only', $upstream) | Out-Host
}

function Invoke-BrainBootstrap {
    [CmdletBinding()]
    param([string]$InstallDir, [string]$RepoDir, [string]$DataDir, [switch]$Update, [switch]$OpenFirewall, [switch]$NoBrowser, [string]$ToolsDir)
    $ErrorActionPreference = 'Stop'
    if ($env:OS -ne 'Windows_NT') { throw 'Run bootstrap.ps1 in Windows PowerShell 5.1 or PowerShell on Windows 10/11.' }
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $architecture = Get-BrainArchitecture
    if (-not $InstallDir) {
        if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is missing. Supply -InstallDir with a writable user directory.' }
        $InstallDir = Join-Path $env:LOCALAPPDATA 'BrainTrainingWeb'
    }
    $InstallDir = [IO.Path]::GetFullPath($InstallDir)
    New-Item $InstallDir -ItemType Directory -Force | Out-Null
    $lock = $null
    try {
        try { $lock = [IO.File]::Open((Join-Path $InstallDir 'bootstrap.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
        catch { throw "Cannot acquire bootstrap lock in $InstallDir (another bootstrap may be running): $($_.Exception.Message)" }
        $git = Get-BrainBootstrapGit $InstallDir $architecture
        $checkout = Find-BrainCheckout $git $InstallDir (Get-Location).Path $RepoDir
        switch (Get-BrainCheckoutAction ([bool]$checkout) ([bool]$Update)) {
            'Clone' {
                $target = Join-Path $InstallDir 'repo'
                $cloneStage = Join-Path $InstallDir ('repo-clone-' + [Guid]::NewGuid().ToString('N'))
                try {
                    Write-Host 'Cloning the public source repository.'
                    Invoke-BrainBootstrapGit $git @('clone', '--', 'https://github.com/Ancho5515/brain-training-web.git', $cloneStage) | Out-Host
                    Assert-BrainCheckout $git $cloneStage | Out-Null
                    Move-Item -LiteralPath $cloneStage -Destination $target
                    $checkout = $target
                } finally { if (Test-Path -LiteralPath $cloneStage) { Remove-Item -LiteralPath $cloneStage -Recurse -Force } }
            }
            'Update' { Update-BrainCheckout $git $checkout }
            'Reuse' { Write-Host "Using existing checkout as-is (no fetch, pull, reset or clean): $checkout" }
        }
        $deploy = Join-Path $checkout 'scripts/deploy.ps1'
        if (-not (Test-Path -LiteralPath $deploy -PathType Leaf)) { throw "Missing $deploy. Supply a complete checkout; default deployment never updates source." }
        $deployParameters = @{ InstallDir = $InstallDir; RepoDir = $checkout; DataDir = $DataDir; Architecture = $architecture; OpenFirewall = $OpenFirewall; NoBrowser = $NoBrowser }
        if ($ToolsDir) { $deployParameters.ToolsDir = $ToolsDir }
        & $deploy @deployParameters
    } finally { if ($lock) { $lock.Dispose() } }
}

# Dot-sourcing exposes the decision helpers for tests without starting deployment.
# Invoke-Expression and normal script execution both take this entry path.
if ($MyInvocation.InvocationName -ne '.') {
    Invoke-BrainBootstrap -InstallDir $InstallDir -RepoDir $RepoDir -DataDir $DataDir -Update:$Update -OpenFirewall:$OpenFirewall -NoBrowser:$NoBrowser -ToolsDir $ToolsDir
}
