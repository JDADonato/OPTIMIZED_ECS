# This script adds the PHP directory of this project to your User PATH environment variable.
# This will allow you to run 'composer', 'php', and 'artisan' from any terminal.

$phpPath = "c:\Users\John Darev\Downloads\ECS-LATEST-main\php"

if (-not (Test-Path $phpPath)) {
    Write-Error "PHP path not found: $phpPath"
    exit
}

$oldPath = [System.Environment]::GetEnvironmentVariable("Path", "User")

if ($oldPath -like "*$phpPath*") {
    Write-Host "PHP path is already in your User PATH."
} else {
    $newPath = "$oldPath;$phpPath"
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Successfully added $phpPath to User PATH."
    Write-Host "Please RESTART your terminal (VS Code or PowerShell) for the changes to take effect."
}
