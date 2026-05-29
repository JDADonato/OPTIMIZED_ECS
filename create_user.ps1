# ⚡ Windows PowerShell Script - Create User Credentials Easily
# Usage: .\create_user.ps1 -Username "john" -Password "pass123" -Role "Marketing"

param(
    [Parameter(Mandatory=$true, HelpMessage="Username for the new account")]
    [string]$Username,
    
    [Parameter(Mandatory=$true, HelpMessage="Password for the new account")]
    [string]$Password,
    
    [Parameter(Mandatory=$false, HelpMessage="Role: Admin, Marketing, Accounting, or Client")]
    [ValidateSet("Admin", "Marketing", "Accounting", "Client")]
    [string]$Role = "Client",
    
    [Parameter(Mandatory=$false, HelpMessage="Email address (optional)")]
    [string]$Email = "",
    
    [Parameter(Mandatory=$false, HelpMessage="Phone number (optional)")]
    [string]$Phone = ""
)

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "   Creating User Credential" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Add PHP to PATH
$env:PATH = ".\php;" + $env:PATH

# Build the command
$command = "php artisan user:create `"$Username`" `"$Password`" --role=$Role"

if ($Email) {
    $command += " --email=`"$Email`""
}

if ($Phone) {
    $command += " --phone=`"$Phone`""
}

Write-Host "Running: $command`n" -ForegroundColor Yellow

# Execute the command
Invoke-Expression $command

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ SUCCESS! The credential is now saved in the database." -ForegroundColor Green
    Write-Host "🌐 You can login from any device with:" -ForegroundColor Green
    Write-Host "   Username: $Username" -ForegroundColor White
    Write-Host "   Password: $Password" -ForegroundColor White
    Write-Host "   Role:     $Role`n" -ForegroundColor White
} else {
    Write-Host "`n❌ ERROR creating user. Please check the details and try again.`n" -ForegroundColor Red
}
