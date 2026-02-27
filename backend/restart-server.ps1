# PowerShell script to restart the backend server
Write-Host "Checking for running Node.js processes..." -ForegroundColor Yellow

# Find Node processes running server.js
$processes = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*server.js*" -or $_.Path -like "*backend*"
}

if ($processes) {
    Write-Host "Found running backend server processes. Stopping them..." -ForegroundColor Yellow
    $processes | ForEach-Object {
        Write-Host "Stopping process ID: $($_.Id)" -ForegroundColor Red
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    Write-Host "✓ Server stopped" -ForegroundColor Green
} else {
    Write-Host "No running backend server found." -ForegroundColor Cyan
}

Write-Host "`nStarting backend server..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server`n" -ForegroundColor Gray

# Start the server
npm run dev


