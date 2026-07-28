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

$remotes = @(Invoke-Git remote)
$baseParts = $Base -split "/", 2
if ($baseParts.Count -eq 2 -and $remotes -contains $baseParts[0]) {
    Invoke-Git fetch $baseParts[0] $baseParts[1] --prune
}
else {
    # Local branch, tag or exact SHA: refresh all remotes without assuming origin/main.
    Invoke-Git fetch --all --prune
}

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
    Write-Host "  Base:   $Base"
    Write-Host ""
    Write-Host "Declare ownership and overlap, then work locally."
    Write-Host "Push and open the draft PR after the first meaningful recoverable commit."
}
else {
    $path = Join-Path $parentPath "gb-diag-$slug"
    Invoke-Git worktree add --detach $path $Base
    Write-Host ""
    Write-Host "Created detached diagnostic worktree:"
    Write-Host "  Path: $path"
    Write-Host "  Base: $Base"
    Write-Host ""
    Write-Host "Do not push disposable diagnostic noise. Capture evidence locally or as an artifact."
    Write-Host "If the result becomes useful, create a lane branch, commit it, push, and open one draft PR."
}
