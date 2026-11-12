#Requires -Version 5.1
[CmdletBinding()]
param([switch]$VerifyPublish, [string]$ToolsDir = '')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$script:Passed = 0
function Assert-True { param([bool]$Condition, [string]$Message) if (-not $Condition) { throw "ASSERT: $Message" }; $script:Passed++ }
function Assert-Equal { param($Actual, $Expected, [string]$Message) Assert-True ($Actual -ceq $Expected) "$Message (actual '$Actual', expected '$Expected')" }
function Assert-Throws { param([scriptblock]$Action, [string]$Pattern) $caught = $false; try { & $Action } catch { $caught = $true; Assert-True ($_.Exception.Message -match $Pattern) "Expected failure matching '$Pattern', got '$($_.Exception.Message)'" }; Assert-True $caught "Expected failure '$Pattern'" }
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$acceptanceToolsDir = $ToolsDir
$logDir = Join-Path $repoRoot 'logs/acceptance'
New-Item -Path $logDir -ItemType Directory -Force | Out-Null
$runId = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$logPath = Join-Path $logDir "deploy-$runId.log"
$testRoot = $null
$completed = $false
Start-Transcript -LiteralPath $logPath -NoClobber | Out-Host
try {
    . (Join-Path $repoRoot 'scripts/common.ps1')
    . (Join-Path $repoRoot 'bootstrap.ps1')
    $tempRoot = (Resolve-Path -LiteralPath ([IO.Path]::GetTempPath())).ProviderPath
    $testRoot = (New-Item -Path (Join-Path $tempRoot "brain-deploy-test-$runId") -ItemType Directory).FullName
    Write-Host "Temporary acceptance directory: $testRoot"
    # A different remote or a similarly named directory must never count as this app.
    Assert-True (Test-BrainRepositoryRemote 'https://github.com/Ancho5515/brain-training-web.git') 'Public HTTPS remote accepted'
    Assert-True (Test-BrainRepositoryRemote 'git@github.com:Ancho5515/brain-training-web.git') 'Equivalent SSH remote accepted'
    Assert-True (-not (Test-BrainRepositoryRemote 'https://github.com/other/brain-training-web.git')) 'Other owner rejected'
    Assert-True (-not (Test-BrainRepositoryRemote 'https://github.com/Ancho5515/brain-training-web-evil.git')) 'Similar name rejected'
    Assert-True (-not (Test-BrainRepositoryRemote 'https://github.com.evil.test/Ancho5515/brain-training-web.git')) 'Lookalike host rejected'
    Assert-Equal (Get-BrainArchitecture 'AMD64' '') 'x64' 'Native x64 chosen'
    Assert-Equal (Get-BrainArchitecture 'x86' 'ARM64') 'arm64' '32-bit PowerShell on ARM Windows chooses OS architecture'
    Assert-Throws { Get-BrainArchitecture 'x86' '' } '64-bit'
    Assert-Equal (Get-BrainMinGitArtifact 'arm64').name 'MinGit-2.56.0.4-arm64.zip' 'Official native ARM64 MinGit chosen'
    Assert-Equal (Get-BrainMinGitArtifact 'x64').hash 'e3bf78351fe777fba47ddee5950082f8a98bb0f02604fdc7ba3ee2cb68ffa877' 'Pinned MinGit uses official published SHA256'
    $sums = ('a' * 64) + '  node-v24.22.1-win-x64.zip' + "`n" + ('b' * 64) + ' *node-v24.22.1-win-arm64.zip'
    Assert-Equal (Get-BrainChecksum $sums 'node-v24.22.1-win-arm64.zip' 64) ('b' * 64) 'Exact ARM archive checksum selected'
    Assert-Throws { Get-BrainChecksum $sums 'node-v24.22.1-win-x86.zip' 64 } 'checksum'
    $archive = Join-Path $testRoot 'archive.zip'; [IO.File]::WriteAllText($archive, 'tampered')
    Assert-Throws { Assert-BrainFileHash $archive ('a' * 64) 'SHA256' } 'checksum'
    $meta = '{"releases":[{"sdk":{"version":"10.0.403","files":[{"name":"dotnet-sdk-win-x64.zip","rid":"win-x64","url":"https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.403/test.zip","hash":"cccc"}]},"sdks":[{"version":"10.0.403","files":[{"name":"dotnet-sdk-win-arm64.zip","rid":"win-arm64","url":"https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.403/arm.zip","hash":"dddd"}]}]}]}' | ConvertFrom-Json
    Assert-Equal (Get-BrainSdkArtifact $meta '10.0.403' 'arm64').hash 'dddd' 'SDK chooses pinned version and native architecture'
    Assert-Throws { Get-BrainSdkArtifact $meta '10.0.999' 'x64' } '10.0.999'
    $install = Join-Path $testRoot 'install'; $releases = Join-Path $install 'releases'; $data = Join-Path $install 'data'
    New-Item $releases -ItemType Directory -Force | Out-Null
    Assert-Equal (Resolve-BrainDataDirectory $install '' $null '') $data 'Fresh data directory defaults outside releases'
    $oldRelease = Join-Path $releases 'old'; New-Item $oldRelease -ItemType Directory -Force | Out-Null
    $oldExe = Join-Path $oldRelease 'BrainTraining.Server.exe'; [IO.File]::WriteAllText($oldExe, 'old release')
    $old = New-BrainState $install $oldRelease $data (Join-Path $testRoot 'repo') ([pscustomobject]@{ ProcessId = 123; StartTimeUtc = '2026-11-09T00:00:00.0000000Z' })
    Assert-Equal (Resolve-BrainDataDirectory $install '' $old '') $data 'Repeat retains stored data directory'
    Assert-Throws { Resolve-BrainDataDirectory $install (Join-Path $testRoot 'other-data') $old '' } 'data directory'
    Assert-Throws { Resolve-BrainDataDirectory $install (Join-Path $oldRelease 'data') $null '' } 'release'
    $snapshot = [pscustomobject]@{ ProcessId = 123; ExecutablePath = $oldExe; StartTimeUtc = '2026-11-09T00:00:00.0000000Z' }
    Assert-True (Test-BrainOwnedProcess $old $snapshot $install) 'Matching path, PID and creation time accepted'
    $reused = [pscustomobject]@{ ProcessId = 123; ExecutablePath = $oldExe; StartTimeUtc = '2026-11-09T00:00:05.0000000Z' }
    Assert-True (-not (Test-BrainOwnedProcess $old $reused $install)) 'Reused PID never accepted'
    $alien = [pscustomobject]@{ ProcessId = 123; ExecutablePath = (Join-Path $testRoot 'foreign.exe'); StartTimeUtc = $snapshot.StartTimeUtc }
    Assert-True (-not (Test-BrainOwnedProcess $old $alien $install)) 'Foreign executable never accepted'
    Assert-Throws { Assert-BrainPortAvailable @(888) $old $snapshot $install } '8787'
    Assert-BrainPortAvailable @(123) $old $snapshot $install
    Assert-True (Test-BrainHealthResponse ([pscustomobject]@{ application = 'brain-training-web'; status = 'ok' })) 'App health accepted'
    Assert-True (-not (Test-BrainHealthResponse ([pscustomobject]@{ application = 'another-app'; status = 'ok' }))) 'Unrelated healthy server rejected'
    Assert-True (-not (Test-BrainHealthResponse ([pscustomobject]@{ application = 'brain-training-web'; status = 'starting' }))) 'Unready server rejected'

    Assert-Throws { Stop-BrainOwnedServer ([pscustomobject]@{ schemaVersion = 1; application = 'brain-training-web'; installDir = $install; releaseDir = $oldRelease; exe = $oldExe; dataDir = $data; port = 8787; processId = $PID; startTimeUtc = (Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o') }) $install } 'No process was stopped'
    Assert-True ($null -ne (Get-Process -Id $PID -ErrorAction Stop)) 'Real unrelated process survives stop refusal'
    Assert-Equal (ConvertTo-BrainNativeArgument 'D:\Folder with spaces\') '"D:\Folder with spaces\\"' 'Native arguments preserve a trailing slash inside quotes'

    if ($env:OS -eq 'Windows_NT') {
        $probeFile = Join-Path $testRoot 'windows-process-path.ps1'
        @'
param([string]$CommonScript, [int]$TargetId, [switch]$WithoutMainModule)
$ErrorActionPreference = 'Stop'
if ($WithoutMainModule) {
    Update-TypeData -TypeName System.Diagnostics.Process -MemberType ScriptProperty -MemberName Path -Value { $null } -Force
} elseif ([Environment]::Is64BitProcess) { throw 'Expected 32-bit Windows PowerShell.' }
. $CommonScript
(Get-BrainProcessSnapshot $TargetId).ExecutablePath
'@ | Set-Content -LiteralPath $probeFile -Encoding UTF8
        $commonScript = Join-Path $repoRoot 'scripts/common.ps1'
        $fixturePath = (Get-Process -Id $PID).Path
        $nativePowerShell = Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
        $withoutModulePath = & $nativePowerShell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $probeFile $commonScript $PID -WithoutMainModule
        Assert-Equal $LASTEXITCODE 0 'Windows process-path probe completed with MainModule unavailable'
        Assert-True (Test-BrainSamePath $withoutModulePath $fixturePath) 'Windows resolves the executable when MainModule is unavailable'
        $win32PowerShell = Join-Path $env:WINDIR 'SysWOW64/WindowsPowerShell/v1.0/powershell.exe'
        if ([Environment]::Is64BitProcess -and (Test-Path -LiteralPath $win32PowerShell -PathType Leaf)) {
            $nativePath = & $win32PowerShell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $probeFile $commonScript $PID
            Assert-Equal $LASTEXITCODE 0 '32-bit PowerShell completed the native-process probe'
            Assert-True (Test-BrainSamePath $nativePath $fixturePath) '32-bit PowerShell can verify a native 64-bit process path'
        }
    }

    # Download boundaries use tiny local ZIPs. Hashing and extraction are real.
    $downloadOriginal = (Get-Command Invoke-BrainDownload).ScriptBlock
    $script:DownloadFixtures = @{}
    $nodeSource = Join-Path $testRoot 'node-fixture/node-v24.22.1-win-x64'
    New-Item $nodeSource -ItemType Directory -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $nodeSource 'node.exe'), 'node-archive-marker')
    [IO.File]::WriteAllText((Join-Path $nodeSource 'npm.cmd'), 'npm-archive-marker')
    $nodeArchive = Join-Path $testRoot 'node-fixture.zip'; Compress-Archive -LiteralPath $nodeSource -DestinationPath $nodeArchive
    $nodeSumsUri = 'https://nodejs.org/dist/v24.22.1/SHASUMS256.txt'; $nodeZipUri = 'https://nodejs.org/dist/v24.22.1/node-v24.22.1-win-x64.zip'
    $script:DownloadFixtures[$nodeZipUri] = $nodeArchive
    Set-Item Function:Invoke-BrainDownload { param($Uri, $OutFile = '') if (-not $script:DownloadFixtures.ContainsKey($Uri)) { throw "Unexpected download URL: $Uri" }; if ($OutFile) { [IO.File]::Copy($script:DownloadFixtures[$Uri], $OutFile, $true) } else { $script:DownloadFixtures[$Uri] } }
    try {
        $nodeInstall = Join-Path $testRoot 'node-install'
        $nodeTools = Join-Path $nodeInstall '.tools'
        $nodeZip = Join-Path $nodeInstall 'downloads/node-v24.22.1-win-x64.zip'
        $script:DownloadFixtures[$nodeSumsUri] = ('a' * 64) + '  node-v24.22.1-win-x64.zip'
        Assert-Throws { Install-BrainNode $nodeInstall 'x64' $nodeTools } 'checksum mismatch'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $nodeTools 'node-v24.22.1-win-x64/node.exe'))) 'Corrupt Node ZIP is never installed'
        Assert-True (-not (Test-Path -LiteralPath $nodeZip)) 'Failed Node installation removes its ZIP'
        $script:DownloadFixtures[$nodeSumsUri] = (Get-FileHash -LiteralPath $nodeArchive -Algorithm SHA256).Hash + '  node-v24.22.1-win-x64.zip'
        $nodeHome = Install-BrainNode $nodeInstall 'x64' $nodeTools
        Assert-Equal $nodeHome (Join-Path $nodeTools 'node-v24.22.1-win-x64') 'Missing Node is installed once in the project cache'
        Assert-Equal ([IO.File]::ReadAllText((Join-Path $nodeHome 'node.exe'))) 'node-archive-marker' 'Verified Node ZIP is extracted into the pinned project directory'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $nodeInstall 'tools'))) 'Project Node leaves no copy in the legacy tools directory'
        Assert-True (-not (Test-Path -LiteralPath $nodeZip)) 'Successful Node installation removes its ZIP'
        $sdkSource = Join-Path $testRoot 'sdk-fixture'; New-Item (Join-Path $sdkSource 'sdk/10.0.403') -ItemType Directory -Force | Out-Null
        [IO.File]::WriteAllText((Join-Path $sdkSource 'sdk/10.0.403/dotnet.dll'), 'sdk-archive-marker')
        $armHeader = [byte[]]::new(70)
        $armHeader[0] = 0x4d; $armHeader[1] = 0x5a; $armHeader[60] = 64
        $armHeader[64] = 0x50; $armHeader[65] = 0x45; $armHeader[68] = 0x64; $armHeader[69] = 0xaa
        [IO.File]::WriteAllBytes((Join-Path $sdkSource 'dotnet.exe'), $armHeader)
        $sdkArchive = Join-Path $testRoot 'sdk-fixture.zip'; Compress-Archive -Path (Join-Path $sdkSource '*') -DestinationPath $sdkArchive
        $sdkZipUri = 'https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.403/dotnet-sdk-10.0.403-win-arm64.zip'
        $script:DownloadFixtures[$sdkZipUri] = $sdkArchive
        $script:DownloadFixtures['https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json'] = '{"releases":[{"sdk":{"version":"10.0.403","files":[{"name":"dotnet-sdk-win-arm64.zip","rid":"win-arm64","url":"' + $sdkZipUri + '","hash":"' + ('f' * 128) + '"}]}}]}'
        $sdkInstall = Join-Path $testRoot 'sdk-install'
        Assert-Throws { Install-BrainDotnet $sdkInstall 'arm64' } 'checksum mismatch'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $sdkInstall 'tools/dotnet-10.0.403-arm64/dotnet.exe'))) 'Corrupt SDK ZIP is never installed'
        $script:DownloadFixtures['https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json'] = '{"releases":[{"sdk":{"version":"10.0.403","files":[{"name":"dotnet-sdk-win-arm64.zip","rid":"win-arm64","url":"' + $sdkZipUri + '","hash":"' + (Get-FileHash -LiteralPath $sdkArchive -Algorithm SHA512).Hash + '"}]}}]}'
        $sdkHome = Install-BrainDotnet $sdkInstall 'arm64'
        Assert-Equal ([IO.File]::ReadAllText((Join-Path $sdkHome 'sdk/10.0.403/dotnet.dll'))) 'sdk-archive-marker' 'Verified SDK ZIP is extracted into the pinned native directory'
        $sdkZip = Join-Path $sdkInstall 'downloads/dotnet-sdk-10.0.403-win-arm64.zip'
        [IO.File]::WriteAllText($sdkZip, 'leftover')
        Assert-Equal (Install-BrainDotnet $sdkInstall 'arm64') $sdkHome 'Cached SDK is reused'
        Assert-True (-not (Test-Path -LiteralPath $sdkZip)) 'Reusing an SDK removes its leftover ZIP'
        $sharedTools = Join-Path $sdkInstall 'tools'
        Assert-Equal (Find-BrainBuildTool 'dotnet' 'arm64' $sharedTools) $sdkHome 'An existing shared SDK is selected without another installation'
        $repoCache = Join-Path $testRoot 'repo-tool-probe'
        $localTools = Join-Path $repoCache '.tools'
        New-Item -ItemType Directory -Path $localTools -Force | Out-Null
        $localSdk = Join-Path $localTools (Split-Path $sdkHome -Leaf)
        Copy-Item -LiteralPath $sdkHome -Destination $localSdk -Recurse
        $previousToolsRoot = $env:DEVTOOLS_ROOT
        $previousPath = $env:PATH
        try {
            $env:DEVTOOLS_ROOT = $sharedTools
            $env:PATH = $localSdk
            Assert-Equal (Find-BrainBuildTool 'dotnet' 'arm64' -RepoDir $repoCache) $sdkHome 'DEVTOOLS_ROOT takes priority over PATH and the project cache'
            $env:DEVTOOLS_ROOT = Join-Path $testRoot 'missing-tools'
            $env:PATH = ''
            Assert-Equal (Find-BrainBuildTool 'dotnet' 'arm64' -RepoDir $repoCache) $localSdk 'An unavailable shared root falls back to the project cache'
        } finally {
            $env:DEVTOOLS_ROOT = $previousToolsRoot
            $env:PATH = $previousPath
        }
        Push-Location -LiteralPath $sdkInstall
        try { Assert-Equal (Find-BrainBuildTool 'dotnet' 'arm64' '.\tools') $sdkHome 'Relative tool directories use the current PowerShell location' }
        finally { Pop-Location }
        $armHeader[68] = 0x64; $armHeader[69] = 0x86
        [IO.File]::WriteAllBytes((Join-Path $sdkHome 'dotnet.exe'), $armHeader)
        Assert-Throws { Install-BrainDotnet $sdkInstall 'arm64' } 'incomplete|architecture'
    } finally { Set-Item Function:Invoke-BrainDownload $downloadOriginal }

    # Real git repositories test selection and fast-forward policy; no network needed.
    $git = (Get-Command git -ErrorAction Stop).Source
    $gitDownloads = Join-Path $install 'downloads'
    New-Item -Path $gitDownloads -ItemType Directory | Out-Null
    $minGitZip = Join-Path $gitDownloads (Get-BrainMinGitArtifact 'x64').name
    $unrelatedZip = Join-Path $gitDownloads 'unrelated.zip'
    [IO.File]::WriteAllText($minGitZip, 'leftover')
    [IO.File]::WriteAllText($unrelatedZip, 'keep')
    Get-BrainBootstrapGit $install 'x64' | Out-Null
    Assert-True (-not (Test-Path -LiteralPath $minGitZip)) 'Reusing Git removes its leftover MinGit ZIP'
    Assert-True (Test-Path -LiteralPath $unrelatedZip -PathType Leaf) 'Archive cleanup preserves unrelated downloads'
    $sourceRepo = Join-Path $testRoot 'source-repo'; New-Item $sourceRepo -ItemType Directory | Out-Null
    & $git -C $sourceRepo init -q; & $git -C $sourceRepo remote add origin 'https://github.com/Ancho5515/brain-training-web.git'
    New-Item (Join-Path $sourceRepo 'client') -ItemType Directory | Out-Null
    New-Item (Join-Path $sourceRepo 'server') -ItemType Directory | Out-Null
    [IO.File]::WriteAllText((Join-Path $sourceRepo 'client/package.json'), '{}')
    [IO.File]::WriteAllText((Join-Path $sourceRepo 'server/BrainTraining.Server.csproj'), '<Project />')
    Assert-Equal (Find-BrainCheckout $git $install (Join-Path $sourceRepo 'client') '') $sourceRepo 'Existing containing checkout found'
    Assert-Equal (Get-BrainCheckoutAction $true $false) 'Reuse' 'Default existing checkout reuses without update'
    Assert-Equal (Get-BrainCheckoutAction $true $true) 'Update' 'Explicit update selected'
    Assert-Equal (Get-BrainCheckoutAction $false $false) 'Clone' 'Fresh install clones'
    Assert-Throws { Update-BrainCheckout $git $sourceRepo } 'local changes'
    # Exercise the public entry's reuse and fresh-clone paths. Only network
    # cloning and the Windows build/launch boundary are substituted.
    New-Item (Join-Path $sourceRepo 'scripts') -ItemType Directory | Out-Null
    @'
[CmdletBinding()]
param($InstallDir, $RepoDir, $DataDir, $Architecture, [switch]$OpenFirewall, [switch]$NoBrowser, [string]$ToolsDir)
[pscustomobject]@{ repoDir = $RepoDir; dataDir = $DataDir; architecture = $Architecture; toolsDir = $ToolsDir } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $InstallDir 'deployment-probe.json') -Encoding UTF8
'@ | Set-Content -LiteralPath (Join-Path $sourceRepo 'scripts/deploy.ps1') -Encoding UTF8
    $originalOs = $env:OS; $originalArchitecture = $env:PROCESSOR_ARCHITECTURE; $originalNativeArchitecture = $env:PROCESSOR_ARCHITEW6432
    $script:BootstrapGitOriginal = (Get-Command Invoke-BrainBootstrapGit).ScriptBlock
    try {
        $env:OS = 'Windows_NT'; $env:PROCESSOR_ARCHITECTURE = 'AMD64'; $env:PROCESSOR_ARCHITEW6432 = ''
        $reuseInstall = Join-Path $testRoot 'reuse-install'
        Push-Location -LiteralPath (Join-Path $sourceRepo 'client')
        try { Invoke-BrainBootstrap -InstallDir $reuseInstall -NoBrowser } finally { Pop-Location }
        $probe = Get-Content -LiteralPath (Join-Path $reuseInstall 'deployment-probe.json') -Raw | ConvertFrom-Json
        Assert-Equal $probe.repoDir $sourceRepo 'Bootstrap deploys containing dirty checkout without fetch/pull/reset'
        Assert-Equal ([IO.File]::ReadAllText((Join-Path $sourceRepo 'client/package.json'))) '{}' 'As-is bootstrap retains local source changes'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $reuseInstall 'repo'))) 'As-is bootstrap does not clone a replacement checkout'
        & $git -C $sourceRepo add .
        & $git -c user.name=DeploymentFixture -c user.email=fixture@example.invalid -C $sourceRepo commit -q -m fixture
        if ($LASTEXITCODE -ne 0) { throw 'Cannot create local clone fixture.' }
        $script:CloneFixtureRepo = $sourceRepo; $script:CloneRequestedUrl = ''
        Set-Item Function:Invoke-BrainBootstrapGit {
            param($Git, [string[]]$Arguments)
            if ($Arguments[0] -eq 'clone') {
                $script:CloneRequestedUrl = $Arguments[2]; $destination = $Arguments[3]
                & $script:BootstrapGitOriginal $Git @('clone', '--', $script:CloneFixtureRepo, $destination) | Out-Null
                & $script:BootstrapGitOriginal $Git @('-C', $destination, 'remote', 'set-url', 'origin', $script:CloneRequestedUrl) | Out-Null
                return 'Local network-boundary clone fixture completed.'
            }
            return & $script:BootstrapGitOriginal $Git $Arguments
        }
        $freshBootstrap = Join-Path $testRoot 'fresh-bootstrap'
        # TEMP can be inside a checkout. Start discovery at the volume root.
        $freshWorkingDir = [IO.Path]::GetPathRoot($testRoot)
        if (Test-Path -LiteralPath (Join-Path $freshWorkingDir '.git')) { throw 'Fresh-install fixture requires a directory outside a Git checkout.' }
        Push-Location -LiteralPath $freshWorkingDir
        try { Invoke-BrainBootstrap -InstallDir $freshBootstrap -ToolsDir $sharedTools -NoBrowser } finally { Pop-Location }
        $probe = Get-Content -LiteralPath (Join-Path $freshBootstrap 'deployment-probe.json') -Raw | ConvertFrom-Json
        Assert-Equal $script:CloneRequestedUrl 'https://github.com/Ancho5515/brain-training-web.git' 'Fresh bootstrap requests the public repository'
        Assert-Equal $probe.repoDir (Join-Path $freshBootstrap 'repo') 'Fresh bootstrap promotes a complete clone into stable repo directory'
        Assert-Equal $probe.architecture 'x64' 'Public entry forwards detected native architecture'
        Assert-Equal $probe.toolsDir $sharedTools 'Public entry forwards the selected shared tool directory'
        Assert-Equal (Assert-BrainCheckout $git $probe.repoDir) $probe.repoDir 'Fresh checkout is verified before build boundary'
    } finally {
        Set-Item Function:Invoke-BrainBootstrapGit $script:BootstrapGitOriginal
        $env:OS = $originalOs; $env:PROCESSOR_ARCHITECTURE = $originalArchitecture; $env:PROCESSOR_ARCHITEW6432 = $originalNativeArchitecture
    }
    $badRepo = Join-Path $testRoot 'bad-repo'; New-Item $badRepo -ItemType Directory | Out-Null
    & $git -C $badRepo init -q; & $git -C $badRepo remote add origin 'https://github.com/other/brain-training-web.git'
    Assert-Throws { Find-BrainCheckout $git $install $badRepo '' } 'remote'

    # Publish must use locked dependencies and avoid .NET's first-run user settings.
    [IO.File]::WriteAllText((Join-Path $sourceRepo 'client/package-lock.json'), '{}')
    $nativeOriginal = (Get-Command Invoke-BrainNative).ScriptBlock
    $originalCertificate = $env:DOTNET_GENERATE_ASPNET_CERTIFICATE
    $originalToolPath = $env:DOTNET_ADD_GLOBAL_TOOLS_TO_PATH
    try {
        $env:DOTNET_GENERATE_ASPNET_CERTIFICATE = 'true'
        $env:DOTNET_ADD_GLOBAL_TOOLS_TO_PATH = 'true'
        Set-Item Function:Invoke-BrainNative {
            param($FilePath, [string[]]$Arguments, $WorkingDirectory)
            if ((Split-Path $FilePath -Leaf) -ne 'dotnet.exe') { return }
            Assert-Equal $env:DOTNET_GENERATE_ASPNET_CERTIFICATE 'false' 'Publish skips generation of a development certificate'
            Assert-Equal $env:DOTNET_ADD_GLOBAL_TOOLS_TO_PATH 'false' 'Publish skips modifying the user PATH'
            Assert-True ($Arguments -contains '-p:RestoreLockedMode=true') 'Publish requires the existing NuGet lock file'
            throw 'simulated publish failure'
        }
        Assert-Throws { Invoke-BrainBuildRelease $testRoot $sourceRepo $testRoot $testRoot 'x64' } 'simulated publish failure'
        Assert-Equal $env:DOTNET_GENERATE_ASPNET_CERTIFICATE 'true' 'Publish failure restores original certificate setting'
        Assert-Equal $env:DOTNET_ADD_GLOBAL_TOOLS_TO_PATH 'true' 'Publish failure restores original tools PATH setting'
    } finally {
        Set-Item Function:Invoke-BrainNative $nativeOriginal
        $env:DOTNET_GENERATE_ASPNET_CERTIFICATE = $originalCertificate
        $env:DOTNET_ADD_GLOBAL_TOOLS_TO_PATH = $originalToolPath
    }

    # Simulate only OS process/HTTP/build boundaries, keeping state and transaction real.
    New-Item $data -ItemType Directory -Force | Out-Null
    $sentinel = Join-Path $data 'brain-training.db'; [IO.File]::WriteAllText($sentinel, 'accounts-and-records')
    $script:Events = [Collections.Generic.List[string]]::new()
    $script:ListenerIds = @(123); $script:CurrentProcess = $snapshot; $script:HealthFails = $false
    $buildOk = { param($stage) $script:Events.Add('build'); New-Item (Join-Path $stage 'wwwroot') -ItemType Directory -Force | Out-Null; [IO.File]::WriteAllText((Join-Path $stage 'BrainTraining.Server.exe'), 'new release'); [IO.File]::WriteAllText((Join-Path $stage 'wwwroot/index.html'), 'client') }
    $buildFail = { param($stage) $script:Events.Add('build'); throw 'simulated build failure' }
    $listeners = { @($script:ListenerIds) }
    $process = { param($id) if ($script:CurrentProcess -and $script:CurrentProcess.ProcessId -eq $id) { $script:CurrentProcess } }
    $stop = { param($state) $script:Events.Add('stop:' + (Split-Path $state.releaseDir -Leaf)); $script:ListenerIds = @(); $script:CurrentProcess = $null }
    $start = { param($release, $persistent, $installHome, $logs) $name = Split-Path $release -Leaf; $script:Events.Add('start:' + $name); $id = 456; if ($name -eq 'old') { $id = 789 }; $script:CurrentProcess = [pscustomobject]@{ ProcessId = $id; ExecutablePath = (Join-Path $release 'BrainTraining.Server.exe'); StartTimeUtc = '2026-11-09T01:00:00.0000000Z' }; $script:ListenerIds = @($id); $script:CurrentProcess }
    $health = { param($state) $script:Events.Add('health:' + (Split-Path $state.releaseDir -Leaf)); if ($script:HealthFails -and (Split-Path $state.releaseDir -Leaf) -ne 'old') { throw 'simulated health failure' } }
    $adapters = @{ BuildAction = $buildOk; ListenerAction = $listeners; ProcessAction = $process; StopAction = $stop; StartAction = $start; HealthAction = $health }
    Write-BrainState $install $old
    Assert-True (Test-BrainOwnedProcess $old $script:CurrentProcess $install) 'Simulation begins with a verified old process'
    $badBuild = $adapters.Clone(); $badBuild.BuildAction = $buildFail
    Assert-Throws { Invoke-BrainReleaseTransaction $install $data $sourceRepo @badBuild } 'simulated build failure'
    Assert-Equal ($script:Events -join ',') 'build' 'Build failure leaves current server running'
    Assert-Equal (Read-BrainState $install).processId 123 'Build failure retains current state'
    Assert-Equal ([IO.File]::ReadAllText($sentinel)) 'accounts-and-records' 'Build failure preserves data'
    $script:Events.Clear(); $script:ListenerIds = @(999)
    Assert-Throws { Invoke-BrainReleaseTransaction $install $data $sourceRepo @adapters } '8787'
    Assert-Equal $script:Events.Count 0 'Unrelated port owner rejects before build or stop'
    $script:ListenerIds = @(123); $script:Events.Clear()
    $missing = $adapters.Clone(); $missing.BuildAction = { param($stage) $script:Events.Add('build') }
    Assert-Throws { Invoke-BrainReleaseTransaction $install $data $sourceRepo @missing } 'Staged build is missing'
    Assert-Equal ($script:Events -join ',') 'build' 'Incomplete staging leaves current server running'
    $script:Events.Clear()
    $racing = $adapters.Clone(); $racing.BuildAction = { param($stage) & $buildOk $stage; $script:ListenerIds = @(999) }
    Assert-Throws { Invoke-BrainReleaseTransaction $install $data $sourceRepo @racing } '8787'
    Assert-Equal ($script:Events -join ',') 'build' 'Port race during build cannot stop old process'
    Assert-Equal (Read-BrainState $install).processId 123 'Port race leaves old state unchanged'
    $script:ListenerIds = @(123); $script:Events.Clear(); $script:HealthFails = $true
    Assert-Throws { Invoke-BrainReleaseTransaction $install $data $sourceRepo @adapters } 'previous release was restored'
    Assert-True (($script:Events -join ',') -match '^build,stop:old,start:[^,]+,health:[^,]+,stop:[^,]+,start:old,health:old$') 'Failed health stops candidate and restores old release'
    Assert-Equal (Read-BrainState $install).releaseDir $oldRelease 'Rollback saves previous release'
    Assert-Equal (Read-BrainState $install).processId 789 'Rollback saves new PID rather than stale one'
    Assert-Equal ([IO.File]::ReadAllText($sentinel)) 'accounts-and-records' 'Rollback preserves data'
    $script:Events.Clear(); $script:HealthFails = $false
    $result = Invoke-BrainReleaseTransaction $install $data $sourceRepo @adapters
    Assert-True ($result.releaseDir -ne $oldRelease) 'Healthy release becomes current'
    Assert-Equal $result.port 8787 'Deployment retains fixed port'
    Assert-Equal $result.dataDir $data 'Deployment retains data directory'
    Assert-Equal ([IO.File]::ReadAllText($sentinel)) 'accounts-and-records' 'Success preserves existing data'
    Assert-True (($script:Events -join ',') -match '^build,stop:old,start:[^,]+,health:[^,]+$') 'Build finishes before stopping current process'
    $script:Events.Clear()
    $again = Invoke-BrainReleaseTransaction $install $data $sourceRepo @adapters
    Assert-True ($again.releaseDir -ne $result.releaseDir) 'Repeated deployment stages a new release'
    Assert-Equal $again.dataDir $data 'Repeated deployment keeps data'
    Assert-Equal $again.port 8787 'Repeated deployment keeps port'
    $freshInstall = Join-Path $testRoot 'fresh-install'; $freshData = Join-Path $freshInstall 'data'
    New-Item $freshData -ItemType Directory -Force | Out-Null
    $freshSentinel = Join-Path $freshData 'kept.db'; [IO.File]::WriteAllText($freshSentinel, 'keep-on-failure')
    $script:ListenerIds = @(); $script:CurrentProcess = $null; $script:Events.Clear(); $script:HealthFails = $true
    Assert-Throws { Invoke-BrainReleaseTransaction $freshInstall $freshData $sourceRepo @adapters } 'Deployment failed: simulated health failure'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $freshInstall 'state/current.json'))) 'Failed first deployment cannot publish a healthy state'
    Assert-Equal $script:ListenerIds.Count 0 'Failed first deployment stops its candidate'
    Assert-Equal ([IO.File]::ReadAllText($freshSentinel)) 'keep-on-failure' 'Failed first deployment retains existing data'

    if ($VerifyPublish) {
        if ($env:OS -eq 'Windows_NT') {
            $architecture = Get-BrainArchitecture
            $sdkDir = Find-BrainBuildTool 'dotnet' $architecture $acceptanceToolsDir -RepoDir $repoRoot
            if (-not $sdkDir) { $sdkDir = Install-BrainDotnet $testRoot $architecture (Join-Path $testRoot '.tools') }
            $dotnet = Join-Path $sdkDir 'dotnet.exe'
        } else {
            $dotnet = Get-Command dotnet -CommandType Application -ErrorAction Stop | Select-Object -First 1 -ExpandProperty Source
        }
        Write-Host "Publishing with .NET SDK: $dotnet"
        $project = Join-Path $repoRoot 'server/BrainTraining.Server.csproj'
        $artifacts = Join-Path $testRoot 'artifacts'
        foreach ($runtime in @('win-x64', 'win-arm64')) {
            $output = Join-Path $testRoot "publish/$runtime"
            Invoke-BrainNative $dotnet @('publish', $project, '-c', 'Release', '-r', $runtime, '--self-contained', 'true', '--artifacts-path', $artifacts, '-o', $output, '-p:RestoreLockedMode=true', '--disable-build-servers') $repoRoot
            Assert-Equal (Get-BrainExecutableArchitecture (Join-Path $output 'BrainTraining.Server.exe')) $runtime.Substring(4) "Self-contained $runtime executable has the requested architecture"
            Assert-Equal (Get-BrainExecutableArchitecture (Join-Path $output 'e_sqlite3.dll')) $runtime.Substring(4) "SQLite is native to $runtime"
        }
    }
    $completed = $true
} catch {
    Write-Host "FAIL: $($_.Exception.Message)"
    throw
} finally {
    try {
        if ($testRoot -and (Test-Path -LiteralPath $testRoot -PathType Container)) {
            $directory = Get-Item -LiteralPath $testRoot -Force
            if (-not (Test-BrainSamePath (Split-Path -Parent $directory.FullName) $tempRoot) -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw "Refusing to clean a test directory outside the temporary workspace: $testRoot"
            }
            Remove-Item -LiteralPath $directory.FullName -Recurse -Force
            Write-Host 'Temporary acceptance directory removed.'
        }
        if ($completed) { Write-Host ("PASS: {0} deployment assertions" -f $script:Passed) }
    } catch {
        Write-Host "FAIL: $($_.Exception.Message)"
        throw
    } finally {
        Stop-Transcript | Out-Null
    }
}
