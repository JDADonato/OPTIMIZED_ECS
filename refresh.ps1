param(
    [int] $AppPort = 8080,
    [int] $VitePort = 5173,
    [int] $ReverbPort = 8085
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PhpExe = Join-Path $RepoRoot 'php\php.exe'
$Concurrently = Join-Path $RepoRoot 'node_modules\.bin\concurrently.cmd'

function Write-Step {
    param([string] $Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Stop-ProcessById {
    param([int] $ProcessId)

    if ($ProcessId -le 0 -or $ProcessId -eq $PID) {
        return
    }

    try {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        Write-Host "Stopping $($process.ProcessName) ($ProcessId)" -ForegroundColor DarkYellow
        Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    } catch {
        # Process already exited.
    }
}

function Stop-DevPort {
    param([int] $Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Where-Object { $_.OwningProcess -gt 0 } |
        Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($processId in $connections) {
        Stop-ProcessById -ProcessId $processId
    }
}

function Stop-RepoDevProcesses {
    $escapedRepo = [regex]::Escape($RepoRoot)
    $processes = Get-CimInstance Win32_Process -Filter "name = 'php.exe' or name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and
            $_.CommandLine -match $escapedRepo -and
            (
                $_.CommandLine -match 'artisan\s+(serve|queue:listen|queue:work|reverb:start)' -or
                $_.CommandLine -match 'vite|concurrently|npm(\.cmd)?\s+run\s+dev'
            )
        }

    foreach ($process in $processes) {
        Stop-ProcessById -ProcessId ([int] $process.ProcessId)
    }
}

if (!(Test-Path $PhpExe)) {
    Write-Host "Could not find bundled PHP at $PhpExe" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $Concurrently)) {
    Write-Host "Could not find concurrently at $Concurrently" -ForegroundColor Red
    Write-Host "Run npm install first, then try .\refresh.ps1 again." -ForegroundColor Yellow
    exit 1
}

Set-Location $RepoRoot

Write-Step "Stopping existing local dev services"
Stop-RepoDevProcesses
Stop-DevPort -Port $AppPort
Stop-DevPort -Port $VitePort
Stop-DevPort -Port 5174
Stop-DevPort -Port $ReverbPort

Write-Step "Clearing Laravel caches"
& $PhpExe artisan optimize:clear

if ($LASTEXITCODE -ne 0) {
    Write-Host "Laravel cache clear failed. Fix the error above, then rerun .\refresh.ps1." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Step "Starting Laravel, Vite, queue, and Reverb"
Write-Host "App URL: http://127.0.0.1:$AppPort" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop all services." -ForegroundColor Yellow

$commands = @(
    ".\php\php.exe artisan serve --host=127.0.0.1 --port=$AppPort",
    ".\php\php.exe artisan queue:listen --tries=1 --timeout=0",
    "npm.cmd run dev -- --host 127.0.0.1 --port $VitePort",
    ".\php\php.exe artisan reverb:start --host=127.0.0.1 --port=$ReverbPort"
)

& $Concurrently `
    -c "#93c5fd,#fdba74,#c4b5fd,#86efac" `
    --names "server,queue,vite,reverb" `
    --kill-others `
    $commands
