[CmdletBinding()]
param(
  [switch]$AllBrowsers
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js was not found. Install Node.js 22, 24, or 26, reopen VS Code, and run this script again.'
}

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host 'Created .env from .env.example.'
}

Write-Host 'Installing npm dependencies...'
npm install
if ($LASTEXITCODE -ne 0) {
  throw 'npm install failed.'
}

if ($AllBrowsers) {
  Write-Host 'Installing Chromium, Firefox, and WebKit...'
  npx playwright install
} else {
  Write-Host 'Installing Chromium...'
  npx playwright install chromium
}

if ($LASTEXITCODE -ne 0) {
  throw 'Playwright browser installation failed.'
}

Write-Host ''
Write-Host 'Setup complete. Run: npm test'
Write-Host 'To inspect the form markup first, run: npm run discover'
