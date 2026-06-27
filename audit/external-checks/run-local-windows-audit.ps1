<#
.SYNOPSIS
  Local Windows audit runner for gb-is-my-strength.

.DESCRIPTION
  Designed for Fedor's local repo:
    C:\Users\Fedor\Projects\gb-is-my-strength

  This script intentionally keeps descriptions inside the script and writes a compact report,
  so the repository does not grow 100+ audit markdown files.

  Default mode runs useful low-noise checks and production-like build/browser checks.
  Optional switches re-run checks that were rejected or too heavy in Arena.

.USAGE
  Set-ExecutionPolicy -Scope Process Bypass
  cd C:\Users\Fedor\Projects\gb-is-my-strength
  .\audit\external-checks\run-local-windows-audit.ps1

  Deep/noisy re-evaluation:
  .\audit\external-checks\run-local-windows-audit.ps1 -RunNoisy -RunFullTrivy
#>
param(
  [string]$RepoRoot,
  [switch]$RunNoisy,
  [switch]$RunFullTrivy,
  [switch]$SkipBuild,
  [switch]$SkipBrowser
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

if (-not $RepoRoot -or $RepoRoot.Trim() -eq '') {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
Set-Location $RepoRoot

$Timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$OutDir = Join-Path $RepoRoot "reports\local-external-checks-$Timestamp"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Report = Join-Path $OutDir 'LOCAL_WINDOWS_AUDIT_REPORT.md'
$SummaryJson = Join-Path $OutDir 'summary.json'
$ToolsDir = Join-Path $RepoRoot '.tools\local-audit'
New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null

# Make Python --user scripts (semgrep/checkov/zizmor on Windows) visible in this process.
try {
  $PyUserScripts = python -c "import site, os; print(os.path.join(site.USER_BASE, 'Scripts'))" 2>$null
  if ($PyUserScripts -and (Test-Path $PyUserScripts) -and (($env:PATH -split ';') -notcontains $PyUserScripts)) {
    $env:PATH = "$PyUserScripts;$env:PATH"
  }
} catch { }

$Results = New-Object System.Collections.Generic.List[object]

function Add-Line([string]$Text = '') {
  $Text | Out-File -FilePath $Report -Append -Encoding utf8
}

function Add-Section([string]$Title) {
  Add-Line "`n## $Title`n"
}

function Add-Result([string]$Name, [string]$Status, [int]$ExitCode, [string]$Notes) {
  $script:Results.Add([pscustomobject]@{
    name = $Name
    status = $Status
    exitCode = $ExitCode
    notes = $Notes
  }) | Out-Null
}

function Invoke-AuditCheck {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][scriptblock]$Script,
    [string]$Why = '',
    [switch]$Optional,
    [switch]$Advisory
  )

  Add-Section $Name
  if ($Why) { Add-Line "**Why:** $Why`n" }
  Write-Host "==> $Name" -ForegroundColor Cyan
  $global:LASTEXITCODE = 0
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $output = & $Script 2>&1 | Out-String -Width 240
    $exit = if ($null -ne $global:LASTEXITCODE) { [int]$global:LASTEXITCODE } else { 0 }
  } catch {
    $output = $_ | Out-String
    $exit = 999
  }
  $sw.Stop()
  Add-Line '```text'
  Add-Line ($output.TrimEnd())
  Add-Line '```'
  Add-Line "`nDuration: $([math]::Round($sw.Elapsed.TotalSeconds, 1)) sec · Exit: $exit"

  if ($exit -eq 0) {
    Add-Result $Name 'PASS' $exit 'ok'
  } elseif ($Optional -or $Advisory) {
    Add-Result $Name 'WARN' $exit 'optional/advisory failed or noisy'
  } else {
    Add-Result $Name 'FAIL' $exit 'required check failed'
  }
}

function Test-CommandExists([string]$Command) {
  return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Invoke-Cmd([string]$Command) {
  cmd.exe /d /c $Command
}

function Start-LocalServer([int]$Port, [string]$Directory) {
  if (-not (Test-CommandExists 'python')) { throw 'python is required for local static server' }
  $args = "-m http.server $Port --bind 127.0.0.1 --directory `"$Directory`""
  return Start-Process -FilePath 'python' -ArgumentList $args -PassThru -WindowStyle Hidden
}

function Stop-LocalServer($Process) {
  if ($Process -and -not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  }
}

function Install-GitHubAsset {
  param(
    [Parameter(Mandatory=$true)][string]$Repo,
    [Parameter(Mandatory=$true)][string]$AssetPattern,
    [Parameter(Mandatory=$true)][string]$ExeName
  )
  $dest = Join-Path $ToolsDir $ExeName
  if (Test-Path $dest) { return $dest }

  $api = "https://api.github.com/repos/$Repo/releases/latest"
  $release = Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'gb-local-audit' }
  $asset = $release.assets | Where-Object { $_.name -match $AssetPattern } | Select-Object -First 1
  if (-not $asset) { throw "No asset matching $AssetPattern in $Repo" }

  $tmp = Join-Path $ToolsDir $asset.name
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tmp -Headers @{ 'User-Agent' = 'gb-local-audit' }

  $extractDir = Join-Path $ToolsDir ([IO.Path]::GetFileNameWithoutExtension([IO.Path]::GetFileNameWithoutExtension($asset.name)))
  New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
  if ($asset.name -match '\.zip$') {
    Expand-Archive -Path $tmp -DestinationPath $extractDir -Force
  } elseif ($asset.name -match '\.tar\.gz$') {
    tar -xzf $tmp -C $extractDir
  } else {
    Copy-Item $tmp (Join-Path $extractDir $ExeName) -Force
  }
  $found = Get-ChildItem $extractDir -Recurse -File | Where-Object { $_.Name -ieq $ExeName } | Select-Object -First 1
  if (-not $found) { throw "Executable $ExeName not found after extracting $($asset.name)" }
  Copy-Item $found.FullName $dest -Force
  return $dest
}

@("# Local Windows Audit", "", "- Timestamp: $Timestamp", "- RepoRoot: $RepoRoot", "- Output: $OutDir", "- RunNoisy: $RunNoisy", "- RunFullTrivy: $RunFullTrivy", "") | Out-File -FilePath $Report -Encoding utf8

Add-Section 'Environment'
@(
  "Date: $(Get-Date)",
  "PWD: $(Get-Location)",
  "Git: $((git --version) 2>&1)",
  "Branch: $((git branch --show-current) 2>&1)",
  "Commit: $((git rev-parse HEAD) 2>&1)",
  "Node: $((node -v) 2>&1)",
  "NPM: $((npm -v) 2>&1)",
  "Python: $((python --version) 2>&1)",
  "PowerShell: $($PSVersionTable.PSVersion)"
) | ForEach-Object { Add-Line $_ }


Invoke-AuditCheck 'Existing local reports inventory' {
  if (Test-Path 'reports') {
    Get-ChildItem reports -Force | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
    foreach ($file in @(
      'reports\retire-dist.json',
      'reports\retire-repo.json',
      'reports\semgrep.json',
      'reports\url-contract-dist.json',
      'reports\url-contract-dist.md',
      'reports\url-contract-draft.json',
      'reports\url-contract-draft.md',
      'reports\dist-copy-manifest.json',
      'reports\htmlval-gill.json',
      'reports\htmlval-home.json',
      'reports\lighthouse-gill-context.json',
      'reports\lighthouse-home.json',
      'reports\npm-audit.json',
      'reports\pa11y-home.json',
      'reports\pa11y-sitemap.json'
    )) {
      if (Test-Path $file) {
        "FOUND $file bytes=$((Get-Item $file).Length)"
      } else {
        "MISSING $file"
      }
    }
  } else {
    'reports directory not found'
  }
} 'Inventory Fedor local report files that may have been generated before this runner.' -Advisory

Invoke-AuditCheck 'git status' { git status --short --branch } 'Baseline: verify local branch and uncommitted changes.'
Invoke-AuditCheck 'npm ci' { npm ci } 'Deterministic dependency install from lockfile.'

Invoke-AuditCheck 'Project fast gates' {
  npm run workflows:check
  npm run guard:agents-rev
  npm run validate:all
  npm run seo-audit
  npm run schema:rich-results:audit
  npm run data:consistency
  npm run content:guard
  npm run content:parity
  npm run mdx:structure:audit
  npm run gill:reading-time:audit
  npm run gill:pagefind:audit
} 'Core project checks that should be low-noise.'

Invoke-AuditCheck 'Supply chain: npm audit/signatures/SBOM' {
  npm audit --json
  npm audit signatures
  npm sbom --sbom-format cyclonedx --json
} 'npm advisory DB, registry signatures, and native CycloneDX SBOM.' -Advisory

Invoke-AuditCheck 'Supply chain: lockfile-lint + CycloneDX' {
  npx -y lockfile-lint --path package-lock.json --type npm --validate-https --allowed-hosts npm --validate-integrity
  npx -y @cyclonedx/cyclonedx-npm --output-format JSON --output-file (Join-Path $OutDir 'bom.cdx.json') --package-lock-only
} 'Lockfile host/HTTPS/integrity validation and independent CycloneDX SBOM.' -Advisory

Invoke-AuditCheck 'OSV Scanner' {
  $osv = Install-GitHubAsset -Repo 'google/osv-scanner' -AssetPattern 'windows_amd64\.exe$' -ExeName 'osv-scanner.exe'
  & $osv scan --lockfile package-lock.json --format json
} 'Independent vulnerability scan against OSV database.' -Advisory

Invoke-AuditCheck 'Retire.js repo/dist' {
  npx -y retire --path . --outputformat json --exitwith 0
  if (Test-Path 'dist') { npx -y retire --path dist --outputformat json --exitwith 0 }
} 'Known vulnerable JavaScript library scan.' -Advisory

Invoke-AuditCheck 'Gitleaks secrets' {
  $gitleaks = Install-GitHubAsset -Repo 'gitleaks/gitleaks' -AssetPattern 'windows_x64\.zip$' -ExeName 'gitleaks.exe'
  & $gitleaks dir . --no-banner --redact --report-format json --report-path (Join-Path $OutDir 'gitleaks.json') --exit-code 7 --log-level warn
} 'Secret scanning. Fails only on real detected leaks.' -Advisory

Invoke-AuditCheck 'Workflow security: actionlint / Semgrep / Checkov / zizmor' {
  $actionlint = Install-GitHubAsset -Repo 'rhysd/actionlint' -AssetPattern 'windows_amd64\.zip$' -ExeName 'actionlint.exe'
  & $actionlint -color=false .github/workflows/*.yml
  python -m pip install --user --quiet semgrep checkov zizmor
  semgrep scan --config p/ci --json --output (Join-Path $OutDir 'semgrep.json') .
  checkov -d .github/workflows --framework github_actions --output json --output-file-path (Join-Path $OutDir 'checkov-gha')
  zizmor --format json .github/workflows | Out-File -FilePath (Join-Path $OutDir 'zizmor.json') -Encoding utf8
} 'Workflow syntax + security checks. actionlint should be strict-clean now.' -Advisory

if (-not $SkipBuild) {
  Invoke-AuditCheck 'Production-like build and dist gates' {
    npm run strangler:build:production-like
    npm run pagefind:build:dist
    npm run page-ownership:dist:production-like
    npm run dist:jsonld:audit
    npm run schema:rich-results:audit:dist
    npm run dist:css-parity
    npm run sw:dist:audit:pagefind
    npm run audit:premium-controls
    npm run strangler:smoke
  } 'Builds production-like dist and runs dist-side gates.'
}

if (-not $SkipBrowser) {
  Invoke-AuditCheck 'Browser runtime gates on root server' {
    npx playwright install chromium
    $server = Start-LocalServer -Port 8080 -Directory $RepoRoot
    try {
      Start-Sleep -Seconds 2
      $env:AUDIT_BASE = 'http://127.0.0.1:8080'
      npm run interactive-audit
      npm run visual-audit
      if (Test-Path 'visual-audit-report.json') {
        Move-Item -Force 'visual-audit-report.json' (Join-Path $OutDir 'visual-audit-report.json')
      }
      if (Test-Path 'shots') {
        Remove-Item -Recurse -Force 'shots'
      }
    } finally {
      Stop-LocalServer $server
      Remove-Item Env:\AUDIT_BASE -ErrorAction SilentlyContinue
    }
  } 'Runs runtime and visual browser audits against repo-root server.'

  Invoke-AuditCheck 'Browser smoke gates on dist server' {
    if (-not (Test-Path 'dist')) { throw 'dist does not exist; run without -SkipBuild first' }
    $server = Start-LocalServer -Port 8090 -Directory (Join-Path $RepoRoot 'dist')
    try {
      Start-Sleep -Seconds 2
      npm run smoke:maps
      npm run smoke:maps:mobile
      npm run smoke:content:mobile
      npm run smoke:konfessii
    } finally {
      Stop-LocalServer $server
    }
  } 'Runs mobile/map/content smoke checks against dist on port 8090.' -Advisory

  Invoke-AuditCheck 'Lighthouse / Pa11y / Linkinator advisory' {
    if (-not (Test-Path 'dist')) { throw 'dist does not exist; run without -SkipBuild first' }
    $server = Start-LocalServer -Port 8090 -Directory (Join-Path $RepoRoot 'dist')
    try {
      Start-Sleep -Seconds 2
      npx -y pa11y http://127.0.0.1:8090/ --reporter json --standard WCAG2AA --timeout 30000
      npx -y pa11y http://127.0.0.1:8090/about/ --reporter json --standard WCAG2AA --timeout 30000
      $lhHome = Join-Path $OutDir 'lighthouse-home.json'
      npx -y lighthouse http://127.0.0.1:8090/ --output=json --output-path $lhHome --chrome-flags='--headless=new --no-sandbox --disable-dev-shm-usage' --quiet
      npx -y linkinator http://127.0.0.1:8090/ --recurse --format json --skip '^(mailto:|tel:|https?://(?!127\.0\.0\.1:8090))' --timeout 10000 --concurrency 20
    } finally {
      Stop-LocalServer $server
    }
  } 'Advisory web-quality checks. Lighthouse local server scores are diagnostic, not production budgets.' -Advisory
}

Invoke-AuditCheck 'Static syntax / structure advisory' {
  node -e "const fs=require('fs'),path=require('path');let bad=0,total=0;function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n);if(/node_modules|dist|\\.git/.test(p))continue;const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(p.endsWith('.json')){total++;try{JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){bad++;console.error(p+': '+e.message)}}}}walk('.');console.log('json files',total,'bad',bad);process.exit(bad?1:0)"
  npx -y madge --extensions js,ts,tsx,astro --circular src scripts
  npx -y jscpd src scripts js css --format javascript,typescript,css --min-lines 12 --min-tokens 80 --reporters json,console --output (Join-Path $OutDir 'jscpd') --ignore "**/node_modules/**,**/dist/**,**/*.min.js"
  npx -y oxlint js scripts src --ignore-path .gitignore
} 'Low-noise/advisory syntax, circular dependency, duplication, and Rust linter checks.' -Advisory

if ($RunFullTrivy) {
  Invoke-AuditCheck 'LOCAL ONLY: full Trivy vulnerability scan' {
    $trivy = Install-GitHubAsset -Repo 'aquasecurity/trivy' -AssetPattern 'Windows-64bit\.zip$' -ExeName 'trivy.exe'
    & $trivy fs --scanners vuln,secret,misconfig --format json --output (Join-Path $OutDir 'trivy-fs.json') --skip-dirs node_modules --skip-dirs dist --skip-dirs .git --timeout 10m .
  } 'Rejected in Arena due disk limits; local Windows disk should handle the DB.' -Advisory
}

if ($RunNoisy) {
  Invoke-AuditCheck 'NOISY RE-EVALUATION: config-first tools' {
    npx -y @biomejs/biome check js scripts src --reporter=json
    npx -y depcheck --json
    npx -y markdownlint-cli2 "**/*.md" "!node_modules/**" "!dist/**"
    npx -y html-validate "dist/**/*.html" --formatter json
    npx -y knip --reporter compact --no-exit-code
  } 'Known noisy/config-first tools. Run only when intentionally creating baselines/configs.' -Advisory
}

Add-Section 'Summary'
$pass = ($Results | Where-Object status -eq 'PASS').Count
$warn = ($Results | Where-Object status -eq 'WARN').Count
$fail = ($Results | Where-Object status -eq 'FAIL').Count
Add-Line "- PASS: $pass"
Add-Line "- WARN: $warn"
Add-Line "- FAIL: $fail"
Add-Line ''
Add-Line '| Status | Check | Exit | Notes |'
Add-Line '|---|---|---:|---|'
foreach ($r in $Results) {
  Add-Line "| $($r.status) | $($r.name) | $($r.exitCode) | $($r.notes) |"
}

$Results | ConvertTo-Json -Depth 5 | Out-File -FilePath $SummaryJson -Encoding utf8

Write-Host "`nDONE" -ForegroundColor Green
Write-Host "Report: $Report" -ForegroundColor Yellow
Write-Host "Summary JSON: $SummaryJson" -ForegroundColor Yellow
if ($fail -gt 0) { exit 1 } else { exit 0 }
