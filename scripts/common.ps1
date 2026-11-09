#Requires -Version 5.1
# Shared deployment primitives. This file has no side effects when dot-sourced.
function Get-BrainProperty {
    param($Object, [string]$Name, $Default = $null)
    if ($null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name]) { return $Object.$Name }
    return $Default
}
function Get-BrainFullPath {
    param([string]$Path)
    $full = [IO.Path]::GetFullPath($Path)
    if ($full -eq [IO.Path]::GetPathRoot($full)) { return $full }
    return $full.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
}
function Test-BrainSamePath { param([string]$Left, [string]$Right) if (-not $Left -or -not $Right) { return $false }; return [string]::Equals((Get-BrainFullPath $Left), (Get-BrainFullPath $Right), [StringComparison]::OrdinalIgnoreCase) }
function Test-BrainChildPath {
    param([string]$Path, [string]$Parent)
    $parentPath = (Get-BrainFullPath $Parent).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    return (Get-BrainFullPath $Path).StartsWith($parentPath, [StringComparison]::OrdinalIgnoreCase)
}
function Invoke-BrainDownload {
    param([string]$Uri, [string]$OutFile = '')
    if (-not $Uri.StartsWith('https://', [StringComparison]::OrdinalIgnoreCase)) { throw 'Downloads require HTTPS.' }
    $oldProgress = $ProgressPreference
    try {
        $ProgressPreference = 'SilentlyContinue'
        $parameters = @{ Uri = $Uri; UseBasicParsing = $true; ErrorAction = 'Stop'; Headers = @{ 'User-Agent' = 'BrainTrainingWeb-Deploy' } }
        if ($OutFile) { $parameters.OutFile = $OutFile; Invoke-WebRequest @parameters | Out-Null }
        else { return (Invoke-WebRequest @parameters).Content }
    } finally { $ProgressPreference = $oldProgress }
}
function Get-BrainChecksum {
    param([string]$Text, [string]$FileName, [int]$Length = 64)
    $pattern = '^\s*([0-9a-fA-F]{' + $Length + '})\s+\*?' + [regex]::Escape($FileName) + '\s*$'
    foreach ($line in ($Text -split "`r?`n")) { if ($line -match $pattern) { return $Matches[1].ToLowerInvariant() } }
    throw "Official checksum is missing for $FileName. Download was not trusted."
}
function Assert-BrainFileHash {
    param([string]$Path, [string]$Expected, [ValidateSet('SHA256', 'SHA512')][string]$Algorithm)
    $length = 64; if ($Algorithm -eq 'SHA512') { $length = 128 }
    if ($Expected -notmatch ('^[0-9a-fA-F]{' + $length + '}$')) { throw "Official $Algorithm checksum is malformed." }
    if ((Get-FileHash -LiteralPath $Path -Algorithm $Algorithm).Hash -ine $Expected) { throw "Archive checksum mismatch: $Path. It will not be extracted or executed." }
}
function Get-BrainSdkArtifact {
    param($Metadata, [string]$Version, [string]$Architecture)
    foreach ($release in $Metadata.releases) {
        $sdks = @(); $single = Get-BrainProperty $release 'sdk'; if ($single) { $sdks += $single }
        $sdks += @(Get-BrainProperty $release 'sdks' @())
        foreach ($sdk in $sdks) {
            if ((Get-BrainProperty $sdk 'version' '') -ne $Version) { continue }
            foreach ($file in $sdk.files) {
                if ($file.rid -eq "win-$Architecture" -and $file.name -match '\.zip$') { return $file }
            }
        }
    }
    throw "Official metadata has no .NET SDK $Version ZIP for win-$Architecture."
}
function Install-BrainNode {
    param([string]$InstallDir, [string]$Architecture)
    $version = '24.22.1'; $installHome = Join-Path $InstallDir "tools/node-v$version-win-$Architecture"; $exe = Join-Path $installHome 'node.exe'
    if (Test-Path -LiteralPath $exe -PathType Leaf) {
        $actual = & $exe --version
        if ($LASTEXITCODE -eq 0 -and $actual -eq "v$version") { return $installHome }
        throw "Cached Node is not the pinned v$version. Rename $installHome and retry."
    }
    $name = "node-v$version-win-$Architecture.zip"; $base = "https://nodejs.org/dist/v$version"
    $expected = Get-BrainChecksum (Invoke-BrainDownload "$base/SHASUMS256.txt") $name 64
    $cache = Join-Path $InstallDir 'downloads'; New-Item $cache -ItemType Directory -Force | Out-Null
    $zip = Join-Path $cache $name; $stage = Join-Path $InstallDir ('tools/node-staging-' + [Guid]::NewGuid().ToString('N'))
    try {
        Write-Host "Downloading and verifying Node v$version ($Architecture)."
        Invoke-BrainDownload "$base/$name" $zip; Assert-BrainFileHash $zip $expected 'SHA256'
        Expand-Archive -LiteralPath $zip -DestinationPath $stage -Force
        $expanded = Join-Path $stage "node-v$version-win-$Architecture"
        if (-not (Test-Path -LiteralPath (Join-Path $expanded 'node.exe') -PathType Leaf)) { throw 'Node ZIP is incomplete.' }
        if (Test-Path -LiteralPath $installHome) { throw "Incomplete Node installation already exists: $installHome" }
        Move-Item -LiteralPath $expanded -Destination $installHome
        return $installHome
    } finally {
        if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
        if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
    }
}
function Install-BrainDotnet {
    param([string]$InstallDir, [string]$Architecture)
    $version = '10.0.403'; $installHome = Join-Path $InstallDir "tools/dotnet-$version-$Architecture"; $exe = Join-Path $installHome 'dotnet.exe'
    if (Test-Path -LiteralPath $exe -PathType Leaf) {
        if (Test-Path -LiteralPath (Join-Path $installHome "sdk/$version/dotnet.dll") -PathType Leaf) { return $installHome }
        throw "Cached .NET SDK is incomplete. Rename $installHome and retry."
    }
    $metadata = Invoke-BrainDownload 'https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json' | ConvertFrom-Json
    $artifact = Get-BrainSdkArtifact $metadata $version $Architecture
    if ($artifact.url -notmatch '^https://(builds\.dotnet\.microsoft\.com|dotnetcli\.blob\.core\.windows\.net|download\.visualstudio\.microsoft\.com)/') { throw 'Unexpected .NET artifact host in release metadata.' }
    $cache = Join-Path $InstallDir 'downloads'; New-Item $cache -ItemType Directory -Force | Out-Null
    $zip = Join-Path $cache "dotnet-sdk-$version-win-$Architecture.zip"; $stage = Join-Path $InstallDir ('tools/dotnet-staging-' + [Guid]::NewGuid().ToString('N'))
    try {
        Write-Host "Downloading and verifying .NET SDK $version ($Architecture)."
        Invoke-BrainDownload $artifact.url $zip; Assert-BrainFileHash $zip $artifact.hash 'SHA512'
        Expand-Archive -LiteralPath $zip -DestinationPath $stage -Force
        if (-not (Test-Path -LiteralPath (Join-Path $stage 'dotnet.exe') -PathType Leaf) -or -not (Test-Path -LiteralPath (Join-Path $stage "sdk/$version/dotnet.dll") -PathType Leaf)) { throw '.NET ZIP is incomplete.' }
        if (Test-Path -LiteralPath $installHome) { throw "Incomplete .NET directory already exists: $installHome" }
        Move-Item -LiteralPath $stage -Destination $installHome
        return $installHome
    } finally {
        if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
        if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
    }
}
function Invoke-BrainNative {
    param([string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory)
    Push-Location -LiteralPath $WorkingDirectory
    try { & $FilePath @Arguments | Out-Host; if ($LASTEXITCODE -ne 0) { throw "Command failed (exit $LASTEXITCODE): $FilePath $($Arguments -join ' ')" } }
    finally { Pop-Location }
}
function Invoke-BrainBuildRelease {
    param([string]$StageDir, [string]$RepoDir, [string]$NodeHome, [string]$DotnetHome, [string]$Architecture)
    $client = Join-Path $RepoDir 'client'; $project = Join-Path $RepoDir 'server/BrainTraining.Server.csproj'
    if (-not (Test-Path -LiteralPath (Join-Path $client 'package-lock.json') -PathType Leaf)) { throw 'client/package-lock.json is required for reproducible npm ci.' }
    $oldPath = $env:PATH; $oldDotnetRoot = $env:DOTNET_ROOT; $oldMultilevel = $env:DOTNET_MULTILEVEL_LOOKUP; $oldTelemetry = $env:DOTNET_CLI_TELEMETRY_OPTOUT; $oldFirst = $env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE
    try {
        $env:PATH = "$NodeHome;$DotnetHome;$oldPath"; $env:DOTNET_ROOT = $DotnetHome; $env:DOTNET_MULTILEVEL_LOOKUP = '0'; $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'; $env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
        Invoke-BrainNative (Join-Path $NodeHome 'npm.cmd') @('ci', '--no-audit', '--no-fund') $client
        Invoke-BrainNative (Join-Path $NodeHome 'npm.cmd') @('run', 'build') $client
        Invoke-BrainNative (Join-Path $DotnetHome 'dotnet.exe') @('publish', $project, '--configuration', 'Release', '--runtime', "win-$Architecture", '--self-contained', 'true', '--output', $StageDir, '-p:UseAppHost=true') $RepoDir
        $dist = Join-Path $client 'dist'; if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html') -PathType Leaf)) { throw 'Client build did not produce dist/index.html.' }
        $wwwroot = Join-Path $StageDir 'wwwroot'; New-Item $wwwroot -ItemType Directory -Force | Out-Null
        Get-ChildItem -LiteralPath $dist -Force | Copy-Item -Destination $wwwroot -Recurse -Force
    } finally { $env:PATH = $oldPath; $env:DOTNET_ROOT = $oldDotnetRoot; $env:DOTNET_MULTILEVEL_LOOKUP = $oldMultilevel; $env:DOTNET_CLI_TELEMETRY_OPTOUT = $oldTelemetry; $env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = $oldFirst }
}
function Read-BrainState {
    param([string]$InstallDir)
    $path = Join-Path $InstallDir 'state/current.json'
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $null }
    try { $state = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json } catch { throw "Deployment state is unreadable: $path. No process was stopped." }
    Assert-BrainState $state $InstallDir
    return $state
}
function Assert-BrainState {
    param($State, [string]$InstallDir)
    if ((Get-BrainProperty $State 'application' '') -ne 'brain-training-web' -or (Get-BrainProperty $State 'schemaVersion' 0) -ne 1 -or (Get-BrainProperty $State 'port' 0) -ne 8787) { throw 'Unrecognized deployment state. No process will be stopped.' }
    if (-not (Test-BrainSamePath (Get-BrainProperty $State 'installDir' '') $InstallDir)) { throw 'Deployment state belongs to a different install directory.' }
    $release = Get-BrainProperty $State 'releaseDir' ''; $exe = Get-BrainProperty $State 'exe' ''
    if (-not $release -or -not (Test-BrainChildPath $release (Join-Path $InstallDir 'releases')) -or -not (Test-BrainSamePath $exe (Join-Path $release 'BrainTraining.Server.exe'))) { throw 'Deployment state executable is outside its owned release directory.' }
    if (-not (Get-BrainProperty $State 'dataDir' '')) { throw 'Deployment state has no data directory.' }
    if ((Test-BrainSamePath $State.dataDir (Join-Path $InstallDir 'releases')) -or (Test-BrainChildPath $State.dataDir (Join-Path $InstallDir 'releases'))) { throw 'Persistent data must be outside release directories.' }
}
function Write-BrainState {
    param([string]$InstallDir, $State)
    Assert-BrainState $State $InstallDir
    $directory = Join-Path $InstallDir 'state'; New-Item $directory -ItemType Directory -Force | Out-Null
    $path = Join-Path $directory 'current.json'; $temporary = Join-Path $directory ('current-' + [Guid]::NewGuid().ToString('N') + '.tmp'); $backup = $temporary + '.bak'
    try {
        $State | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporary -Encoding UTF8
        if (Test-Path -LiteralPath $path) { [IO.File]::Replace($temporary, $path, $backup) }
        else { [IO.File]::Move($temporary, $path) }
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
        if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }
    }
}
function Resolve-BrainDataDirectory {
    param([string]$InstallDir, [string]$Requested, $CurrentState, [string]$EnvironmentDataDir = $env:BRAIN_DATA_DIR)
    $desired = $Requested; if (-not $desired) { $desired = $EnvironmentDataDir }
    if ($CurrentState) {
        if ($desired -and -not (Test-BrainSamePath $desired $CurrentState.dataDir)) { throw "Existing data directory is $($CurrentState.dataDir). Changing it during redeployment is refused; use the same -DataDir/BRAIN_DATA_DIR." }
        $desired = $CurrentState.dataDir
    }
    if (-not $desired) { $desired = Join-Path $InstallDir 'data' }
    $desired = Get-BrainFullPath $desired
    $releaseRoot = Join-Path $InstallDir 'releases'
    if ((Test-BrainSamePath $desired $releaseRoot) -or (Test-BrainChildPath $desired $releaseRoot)) { throw 'The data directory must be outside release directories.' }
    return $desired
}
function New-BrainState {
    param([string]$InstallDir, [string]$ReleaseDir, [string]$DataDir, [string]$RepoDir, $Process)
    return [pscustomobject][ordered]@{ schemaVersion = 1; application = 'brain-training-web'; installDir = (Get-BrainFullPath $InstallDir); releaseDir = (Get-BrainFullPath $ReleaseDir); exe = (Join-Path $ReleaseDir 'BrainTraining.Server.exe'); dataDir = (Get-BrainFullPath $DataDir); repoDir = (Get-BrainFullPath $RepoDir); port = 8787; processId = [int]$Process.ProcessId; startTimeUtc = [string]$Process.StartTimeUtc; deployedAtUtc = [DateTime]::UtcNow.ToString('o') }
}
function Get-BrainProcessSnapshot {
    param([int]$ProcessId)
    if ($ProcessId -le 0) { return $null }
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) { return $null }
    try { return [pscustomobject]@{ ProcessId = $process.Id; ExecutablePath = $process.Path; StartTimeUtc = $process.StartTime.ToUniversalTime().ToString('o') } }
    catch { throw "Cannot verify process $ProcessId ownership. It will not be stopped." }
}
function Test-BrainOwnedProcess {
    param($State, $Process, [string]$InstallDir)
    if (-not $State -or -not $Process) { return $false }
    try {
        Assert-BrainState $State $InstallDir
        if ([int]$State.processId -le 0 -or [int]$State.processId -ne [int]$Process.ProcessId) { return $false }
        if (-not (Test-BrainSamePath $State.exe $Process.ExecutablePath)) { return $false }
        # Newer PowerShell converts ISO JSON dates to DateTime; 5.1 retains strings.
        $expectedTime = [DateTime]$State.startTimeUtc; $actualTime = [DateTime]$Process.StartTimeUtc
        # Exact ticks prevent a later process reusing the PID from being stopped.
        return $expectedTime.ToUniversalTime().Ticks -eq $actualTime.ToUniversalTime().Ticks
    } catch { return $false }
}
function Get-BrainPortOwners {
    # Get-NetTCPConnection is available on Windows 10/11 and includes IPv4/IPv6.
    # Errors other than 'no matching listener' must not be mistaken for a free port.
    $connections = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq 8787 })
    return @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
}
function Assert-BrainPortAvailable {
    param([int[]]$Owners, $CurrentState, $Process, [string]$InstallDir)
    foreach ($owner in $Owners) {
        if (-not $CurrentState -or [int]$owner -ne [int]$CurrentState.processId -or -not (Test-BrainOwnedProcess $CurrentState $Process $InstallDir)) { throw "Port 8787 is occupied by an unrelated or unverifiable process (PID $owner). Nothing was killed. Stop that application yourself, then retry; this app never changes its port." }
    }
}
function ConvertTo-BrainNativeArgument {
    param([string]$Value)
    # Windows CommandLineToArgvW escaping, including a trailing path backslash.
    return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}
function Start-BrainServer {
    param([string]$ReleaseDir, [string]$DataDir, [string]$InstallDir, [string]$LogDir)
    $exe = Join-Path $ReleaseDir 'BrainTraining.Server.exe'
    if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw "Release executable is missing: $exe" }
    New-Item $LogDir -ItemType Directory -Force | Out-Null
    $logBase = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
    $arguments = @('--urls', 'http://0.0.0.0:8787', '--data-dir', $DataDir) | ForEach-Object { ConvertTo-BrainNativeArgument $_ }
    $process = Start-Process -FilePath $exe -ArgumentList ($arguments -join ' ') -WorkingDirectory $ReleaseDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDir "$logBase.stdout.log") -RedirectStandardError (Join-Path $LogDir "$logBase.stderr.log") -PassThru
    try { return [pscustomobject]@{ ProcessId = $process.Id; StartTimeUtc = $process.StartTime.ToUniversalTime().ToString('o') } }
    catch { throw "Server exited immediately; inspect $LogDir." }
}
function Stop-BrainOwnedServer {
    param($State, [string]$InstallDir)
    $snapshot = Get-BrainProcessSnapshot ([int]$State.processId)
    if (-not $snapshot) { return }
    if (-not (Test-BrainOwnedProcess $State $snapshot $InstallDir)) { throw 'Stored PID no longer identifies this installation. No process was stopped.' }
    # Re-check immediately before stopping to narrow the PID-reuse race.
    $process = Get-Process -Id $snapshot.ProcessId -ErrorAction Stop
    if ($process.StartTime.ToUniversalTime().ToString('o') -ne $snapshot.StartTimeUtc -or -not (Test-BrainSamePath $process.Path $State.exe)) { throw 'Process changed while checking ownership. No process was stopped.' }
    $process.Kill()
    if (-not $process.WaitForExit(15000)) { throw 'Owned server did not stop within 15 seconds. Deployment aborted.' }
}
function Test-BrainHealthResponse {
    param($Response)
    return ((Get-BrainProperty $Response 'application' '') -ceq 'brain-training-web' -and (Get-BrainProperty $Response 'status' '') -ceq 'ok')
}
function Wait-BrainHealth {
    param($State, [string]$InstallDir, [int]$TimeoutSeconds = 60)
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds); $lastError = 'No healthy response.'
    do {
        $snapshot = Get-BrainProcessSnapshot ([int]$State.processId)
        if (-not (Test-BrainOwnedProcess $State $snapshot $InstallDir)) { throw 'New server exited or its process identity changed before becoming healthy.' }
        try {
            $owners = @(Get-BrainPortOwners)
            if ($owners.Count -eq 1 -and [int]$owners[0] -eq [int]$State.processId) {
                $response = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/health' -Method Get -TimeoutSec 3 -ErrorAction Stop
                if (Test-BrainHealthResponse $response) { return }
                $lastError = 'Health response did not identify brain-training-web with status ok.'
            } else { $lastError = 'Port 8787 is not exclusively owned by the new server.' }
        } catch { $lastError = $_.Exception.Message }
        Start-Sleep -Milliseconds 700
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Server health check failed: $lastError"
}
function Invoke-BrainReleaseTransaction {
    [CmdletBinding()]
    param(
        [string]$InstallDir, [string]$DataDir, [string]$RepoDir,
        [Parameter(Mandatory = $true)][scriptblock]$BuildAction,
        [scriptblock]$ListenerAction = { Get-BrainPortOwners },
        [scriptblock]$ProcessAction = { param($id) Get-BrainProcessSnapshot $id },
        [scriptblock]$StopAction = { param($state) Stop-BrainOwnedServer $state $InstallDir },
        [scriptblock]$StartAction = { param($release, $data, $installHome, $logs) Start-BrainServer $release $data $installHome $logs },
        [scriptblock]$HealthAction = { param($state) Wait-BrainHealth $state $InstallDir }
    )
    $current = Read-BrainState $InstallDir
    $DataDir = Resolve-BrainDataDirectory $InstallDir $DataDir $current
    $currentProcess = $null; if ($current) { $currentProcess = & $ProcessAction ([int]$current.processId) }
    Assert-BrainPortAvailable @(& $ListenerAction) $current $currentProcess $InstallDir
    $releaseRoot = Join-Path $InstallDir 'releases'; New-Item $releaseRoot -ItemType Directory -Force | Out-Null
    $name = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
    $stage = Join-Path $releaseRoot ('.staging-' + $name); $release = Join-Path $releaseRoot $name
    New-Item $stage -ItemType Directory -Force | Out-Null
    try {
        & $BuildAction $stage
        foreach ($required in @('BrainTraining.Server.exe', 'wwwroot/index.html')) { if (-not (Test-Path -LiteralPath (Join-Path $stage $required) -PathType Leaf)) { throw "Staged build is missing $required. Current server was not stopped." } }
        Move-Item -LiteralPath $stage -Destination $release
    } catch {
        if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
        throw
    }
    $currentProcess = $null; if ($current) { $currentProcess = & $ProcessAction ([int]$current.processId) }
    Assert-BrainPortAvailable @(& $ListenerAction) $current $currentProcess $InstallDir
    $wasRunning = Test-BrainOwnedProcess $current $currentProcess $InstallDir
    $stoppedPrevious = $false; $candidate = $null
    try {
        if ($wasRunning) { & $StopAction $current; $stoppedPrevious = $true }
        # A different application may race for the port after the previous exit.
        Assert-BrainPortAvailable @(& $ListenerAction) $null $null $InstallDir
        New-Item $DataDir -ItemType Directory -Force | Out-Null
        $process = & $StartAction $release $DataDir $InstallDir (Join-Path $InstallDir 'logs')
        $candidate = New-BrainState $InstallDir $release $DataDir $RepoDir $process
        & $HealthAction $candidate
        Write-BrainState $InstallDir $candidate
        return $candidate
    } catch {
        $failure = $_.Exception.Message; $rollbackError = ''
        try {
            if ($candidate) {
                $candidateProcess = & $ProcessAction ([int]$candidate.processId)
                if (Test-BrainOwnedProcess $candidate $candidateProcess $InstallDir) { & $StopAction $candidate }
            }
            if ($stoppedPrevious) {
                Assert-BrainPortAvailable @(& $ListenerAction) $null $null $InstallDir
                $restoredProcess = & $StartAction $current.releaseDir $current.dataDir $InstallDir (Join-Path $InstallDir 'logs')
                $restored = New-BrainState $InstallDir $current.releaseDir $current.dataDir $current.repoDir $restoredProcess
                & $HealthAction $restored
                Write-BrainState $InstallDir $restored
            }
        } catch { $rollbackError = $_.Exception.Message }
        if ($rollbackError) { throw "Deployment failed: $failure. Rollback also failed: $rollbackError. Data remains at $DataDir; inspect $(Join-Path $InstallDir 'logs')." }
        if ($stoppedPrevious) { throw "Deployment failed: $failure. The previous release was restored; data remains at $DataDir." }
        throw "Deployment failed: $failure. Data remains at $DataDir."
    }
}
function Open-BrainFirewall {
    param()
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Write-Warning 'Firewall was NOT changed: -OpenFirewall requires an elevated PowerShell window. Re-run with -OpenFirewall as administrator, or add an inbound TCP 8787 rule for the Private profile manually.'; return $false }
    try {
        $ruleName = 'BrainTrainingWeb-TCP-8787-Private'
        $existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
        if ($existing) { Remove-NetFirewallRule -Name $ruleName -ErrorAction Stop }
        New-NetFirewallRule -Name $ruleName -DisplayName 'Brain Training Web - TCP 8787 (Private LAN)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8787 -Profile Private -RemoteAddress LocalSubnet -ErrorAction Stop | Out-Null
        Write-Host 'Firewall rule enabled: TCP 8787, Private profile, local subnet only.'
        return $true
    } catch { Write-Warning "Firewall was NOT configured: $($_.Exception.Message). Allow inbound TCP 8787 on the Private profile manually."; return $false }
}
function Get-BrainLanUrls {
    $addresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' -and $_.AddressState -eq 'Preferred' } | Select-Object -ExpandProperty IPAddress -Unique)
    return @($addresses | ForEach-Object { "http://$($_):8787" })
}
