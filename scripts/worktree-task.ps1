[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Task", "Diagnostic")]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[A-Za-z0-9][A-Za-z0-9._-]*$")]
    [string]$Name,

    [string]$Base = "origin/main",
    [string]$Parent = ".."
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

Invoke-Git rev-parse --is-inside-work-tree | Out-Null
Invoke-Git fetch origin main --prune

$date = Get-Date -Format "yyyy-MM-dd"
$slug = $Name.ToLowerInvariant()
$repoRoot = (Invoke-Git rev-parse --show-toplevel | Select-Object -Last 1).Trim()
$parentPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $Parent))

if ($Mode -eq "Task") {
    $branch = "lane/$slug-$date"
    $path = Join-Path $parentPath "gb-wt-$slug"
    Invoke-Git worktree add -b $branch $path $Base
    Write-Host ""
    Write-Host "Created local product worktree:"
    Write-Host "  Path:   $path"
    Write-Host "  Branch: $branch"
    Write-Host ""
    Write-Host "Before push: declare ownership, inspect active PR overlap, run scoped checks,"
    Write-Host "and prepare one canonical draft PR."
}
else {
    $path = Join-Path $parentPath "gb-diag-$slug"
    Invoke-Git worktree add --detach $path $Base
    Write-Host ""
    Write-Host "Created detached diagnostic worktree:"
    Write-Host "  Path: $path"
    Write-Host "  Base: $Base"
    Write-Host ""
    Write-Host "Do not push a diagnostic branch. Capture evidence, then remove the worktree."
    Write-Host "If the experiment becomes product work, create one local lane branch first."
}
