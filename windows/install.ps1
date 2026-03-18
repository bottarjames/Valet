# Valet — Windows installer
# Run with: Right-click → Run with PowerShell
# Or from terminal: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ValetDir   = "$env:USERPROFILE\.valet"
$StartupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"

function OK($msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function WARN($msg) { Write-Host " WARN $msg" -ForegroundColor Yellow }
function STEP($msg) { Write-Host "`n$msg" -ForegroundColor Cyan }

Write-Host ""
Write-Host "  Installing Valet" -ForegroundColor White
Write-Host "  =================" -ForegroundColor White

# ── 1. Python ─────────────────────────────────────────────────────────────────
STEP "Checking Python..."
$python = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $v = & $cmd --version 2>&1
        if ($v -match "Python 3") { $python = $cmd; break }
    } catch {}
}

if (-not $python) {
    WARN "Python 3 not found. Installing via winget..."
    try {
        winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path","User")
        $python = "python"
        OK "Python installed"
    } catch {
        Write-Host "`n  ERROR: Could not install Python automatically." -ForegroundColor Red
        Write-Host "  Please install Python 3 from https://python.org then re-run this script." -ForegroundColor Red
        Read-Host "`n  Press Enter to exit"
        exit 1
    }
} else {
    OK "Found Python: $(& $python --version 2>&1)"
}

# ── 2. pip dependencies ───────────────────────────────────────────────────────
STEP "Installing dependencies..."
& $python -m pip install --quiet --upgrade pystray Pillow
OK "pystray + Pillow installed"

# ── 3. Config dir ─────────────────────────────────────────────────────────────
STEP "Setting up config..."
New-Item -ItemType Directory -Force -Path $ValetDir | Out-Null
if (-not (Test-Path "$ValetDir\config.json")) {
    '{"projects":{}}' | Out-File -FilePath "$ValetDir\config.json" -Encoding utf8
    OK "Created config at $ValetDir\config.json"
} else {
    OK "Config already exists (kept)"
}

# ── 4. Scripts ────────────────────────────────────────────────────────────────
STEP "Copying scripts..."
Copy-Item "$ScriptDir\bridge.py"           "$ValetDir\bridge.py"           -Force
Copy-Item "$ScriptDir\tray_app_windows.py" "$ValetDir\tray_app_windows.py" -Force
OK "Scripts copied to $ValetDir"

# ── 5. Find pythonw (runs without a console window) ──────────────────────────
$pythonExe = (Get-Command $python -ErrorAction SilentlyContinue).Source
$pythonW   = $pythonExe -replace "python\.exe$","pythonw.exe"
if (-not (Test-Path $pythonW)) { $pythonW = $pythonExe }

# ── 6. Auto-start via Task Scheduler ─────────────────────────────────────────
STEP "Setting up auto-start..."

$tasks = @(
    @{ Name = "Valet Bridge"; Script = "bridge.py" },
    @{ Name = "Valet Tray";   Script = "tray_app_windows.py" }
)

foreach ($t in $tasks) {
    $action  = New-ScheduledTaskAction -Execute $pythonW -Argument "`"$ValetDir\$($t.Script)`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $t.Name -Action $action -Trigger $trigger `
        -Settings $settings -RunLevel Highest -Force | Out-Null
    OK "Scheduled task: $($t.Name)"
}

# ── 7. Start now ──────────────────────────────────────────────────────────────
STEP "Starting Valet..."
foreach ($t in $tasks) {
    Start-ScheduledTask -TaskName $t.Name
}
Start-Sleep -Seconds 2
OK "Valet is running"

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ==============================" -ForegroundColor Green
Write-Host "    Valet installed!" -ForegroundColor Green
Write-Host "  ==============================" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host ""
Write-Host "  1. Look for the Valet icon in your system tray (bottom-right)" -ForegroundColor White
Write-Host "     Click it to add your first project" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Load the Chrome extension:" -ForegroundColor White
Write-Host "     - Open Chrome -> chrome://extensions" -ForegroundColor Gray
Write-Host "     - Enable Developer Mode (top right)" -ForegroundColor Gray
Write-Host "     - Click 'Load unpacked'" -ForegroundColor Gray
Write-Host "     - Select the 'valet-extension' folder" -ForegroundColor Gray
Write-Host ""
Read-Host "  Press Enter to close"
