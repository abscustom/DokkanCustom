# Dokkan Animation Server & Ngrok System Tray Bridge
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

$logFile = Join-Path $PSScriptRoot "tray-debug.log"
function Log($msg) {
    "$(Get-Date -Format 'HH:mm:ss') $msg" | Out-File $logFile -Append -Encoding utf8
}

Log "Script started. rootDir: $rootDir"

# Ensure single instance with Mutex
$mutexName = "DokkanAnimationTrayBridgeMutex"
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $mutexName, [ref]$createdNew)

if (-not $createdNew) {
    Log "Already running mutex hit. Exiting."
    exit 0
}

# Clean up any lingering zombie node processes on port 3137 or old ngrok tunnels
try {
    $conns = Get-NetTCPConnection -LocalPort 3137 -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        if ($conn.OwningProcess -and $conn.OwningProcess -gt 0) {
            Log "Cleaning old process on port 3137: $($conn.OwningProcess)"
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
} catch {}
Stop-Process -Name "ngrok" -Force -ErrorAction SilentlyContinue

$global:nodeProcess = $null
$global:ngrokProcess = $null
$global:appContext = New-Object System.Windows.Forms.ApplicationContext

function Start-Services {
    Log "Entering Start-Services"
    $fullScript = Join-Path $rootDir "tools\dokkan-animation-server.mjs"
    if (Test-Path $fullScript) {
        $psiNode = New-Object System.Diagnostics.ProcessStartInfo
        $psiNode.FileName = "node.exe"
        $psiNode.Arguments = "tools/dokkan-animation-server.mjs"
        $psiNode.WorkingDirectory = $rootDir
        $psiNode.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
        $psiNode.UseShellExecute = $true
        try {
            $global:nodeProcess = [System.Diagnostics.Process]::Start($psiNode)
            Log "Node started with PID: $($global:nodeProcess.Id)"
        } catch {
            Log "Failed to start Node: $_"
        }
    }

    # Brief delay so node binds port 3137 before ngrok connects
    Start-Sleep -Seconds 1

    # Start Ngrok Tunnel
    $ngrokPath = Join-Path $rootDir "ngrok.exe"
    if (-not (Test-Path $ngrokPath)) {
        $ngrokPath = "C:\Users\Ruffy\Desktop\cardhub v2\ngrok.exe"
    }

    if (Test-Path $ngrokPath) {
        $ngrokLog = Join-Path $rootDir "tools\ngrok.log"
        $psiNgrok = New-Object System.Diagnostics.ProcessStartInfo
        $psiNgrok.FileName = $ngrokPath
        $psiNgrok.Arguments = "http 127.0.0.1:3137 --url https://mollusk-fanfare-although.ngrok-free.dev --log `"$ngrokLog`""
        $psiNgrok.WorkingDirectory = $rootDir
        $psiNgrok.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
        $psiNgrok.UseShellExecute = $true
        try {
            $global:ngrokProcess = [System.Diagnostics.Process]::Start($psiNgrok)
            Log "Ngrok started with PID: $($global:ngrokProcess.Id)"
        } catch {
            Log "Failed to start Ngrok: $_"
        }
    }
}

function Stop-Services {
    Log "Stopping services"
    if ($global:nodeProcess -and -not $global:nodeProcess.HasExited) {
        try { Stop-Process -Id $global:nodeProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    if ($global:ngrokProcess -and -not $global:ngrokProcess.HasExited) {
        try { Stop-Process -Id $global:ngrokProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Stop-Process -Name "ngrok" -Force -ErrorAction SilentlyContinue
    try {
        $conns = Get-NetTCPConnection -LocalPort 3137 -ErrorAction SilentlyContinue
        foreach ($conn in $conns) {
            if ($conn.OwningProcess -and $conn.OwningProcess -gt 0) {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}

Start-Services

# Load Custom Dokkan Tray Icon (abs.style.png / dokkan-tray.ico)
$icoPath = Join-Path $PSScriptRoot "dokkan-tray.ico"
$icon = $null
if (Test-Path $icoPath) {
    try {
        $icon = New-Object System.Drawing.Icon($icoPath)
        Log "Loaded custom dokkan-tray.ico"
    } catch {
        Log "Error loading dokkan-tray.ico: $_"
    }
}

if (-not $icon) {
    $dbIco = Join-Path $PSScriptRoot "dragonball.ico"
    if (Test-Path $dbIco) {
        try { $icon = New-Object System.Drawing.Icon($dbIco) } catch {}
    }
}

if (-not $icon) {
    $bmp = New-Object System.Drawing.Bitmap(32, 32)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 160, 230))
    $g.FillEllipse($brush, 2, 2, 28, 28)
    $g.Dispose()
    $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}

# Create NotifyIcon
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = $icon
$notifyIcon.Text = "Dokkan Animation Server & Ngrok (Active)"
$notifyIcon.Visible = $true

# Context Menu
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

$headerItem = $contextMenu.Items.Add("Dokkan Animation Bridge")
$headerItem.Enabled = $false
$headerFont = New-Object System.Drawing.Font($headerItem.Font, [System.Drawing.FontStyle]::Bold)
$headerItem.Font = $headerFont

$statusItem = $contextMenu.Items.Add("Port: 3137 (Active)")
$statusItem.Enabled = $false

$tunnelItem = $contextMenu.Items.Add("Ngrok: mollusk-fanfare-although.ngrok-free.dev")
$tunnelItem.Enabled = $false

$contextMenu.Items.Add("-") | Out-Null

$openNgrok = $contextMenu.Items.Add("Open Ngrok Health Check")
$openNgrok.add_Click({
    [System.Diagnostics.Process]::Start("https://mollusk-fanfare-although.ngrok-free.dev/health") | Out-Null
})

$openLocal = $contextMenu.Items.Add("Open Local Health Check")
$openLocal.add_Click({
    [System.Diagnostics.Process]::Start("http://127.0.0.1:3137/health") | Out-Null
})

$copyUrl = $contextMenu.Items.Add("Copy Ngrok URL to Clipboard")
$copyUrl.add_Click({
    [System.Windows.Forms.Clipboard]::SetText("https://mollusk-fanfare-although.ngrok-free.dev")
    $notifyIcon.ShowBalloonTip(2000, "Copied", "Ngrok URL copied to clipboard!", [System.Windows.Forms.ToolTipIcon]::Info)
})

$contextMenu.Items.Add("-") | Out-Null

$restartItem = $contextMenu.Items.Add("Restart Server & Ngrok")
$restartItem.add_Click({
    $notifyIcon.ShowBalloonTip(2000, "Restarting", "Restarting Dokkan animation server & Ngrok...", [System.Windows.Forms.ToolTipIcon]::Info)
    Stop-Services
    Start-Sleep -Milliseconds 500
    Start-Services
    $notifyIcon.ShowBalloonTip(2000, "Online", "Dokkan services restarted successfully.", [System.Windows.Forms.ToolTipIcon]::Info)
})

$contextMenu.Items.Add("-") | Out-Null

$exitItem = $contextMenu.Items.Add("Exit / Stop Server")
$exitItem.add_Click({
    Log "User clicked Exit."
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    Stop-Services
    try { $mutex.ReleaseMutex() } catch {}
    $global:appContext.ExitThread()
})

$notifyIcon.ContextMenuStrip = $contextMenu

# Double click opens Ngrok health check
$notifyIcon.add_DoubleClick({
    [System.Diagnostics.Process]::Start("https://mollusk-fanfare-although.ngrok-free.dev/health") | Out-Null
})

# Verify health check
Start-Sleep -Seconds 1
$healthOk = $false
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:3137/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
    if ($res.ok) { $healthOk = $true }
} catch {
    Log "Health check failed: $_"
}

Log "healthOk: $healthOk"
if ($healthOk) {
    $notifyIcon.ShowBalloonTip(
        4000,
        "Dokkan Animation Server Online",
        "Server & Ngrok tunnel active in hidden icons menu (`^`). Right-click icon for options.",
        [System.Windows.Forms.ToolTipIcon]::Info
    )
} else {
    $notifyIcon.ShowBalloonTip(
        5000,
        "Dokkan Animation Server Starting",
        "Services launched in hidden icons menu (`^`). Check right-click menu for status.",
        [System.Windows.Forms.ToolTipIcon]::Warning
    )
}

Log "Entering Application::Run(appContext)"
[System.Windows.Forms.Application]::Run($global:appContext)
Log "Application::Run exited cleanly"
