#Requires -Version 5.1
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$files = @((Get-Item -LiteralPath (Join-Path $root 'bootstrap.ps1'))) + @(Get-ChildItem -LiteralPath (Join-Path $root 'scripts') -Filter '*.ps1' -Recurse)
$errorsFound = 0
foreach ($file in $files) {
    $tokens = $null; $parseErrors = $null
    [Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$parseErrors) | Out-Null
    foreach ($problem in $parseErrors) { Write-Host "$($file.Name):$($problem.Extent.StartLineNumber): $($problem.Message)"; $errorsFound++ }
}
if ($errorsFound -gt 0) { throw "$errorsFound PowerShell parse errors." }
Write-Host "PASS: $($files.Count) PowerShell scripts parsed."
