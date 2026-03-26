Write-Host "🚀 Starting Dodge AI Deployment Process..." -ForegroundColor Cyan
if (!(Test-Path .git)) {
    Write-Host "📦 Initializing Git..."
    git init
    git add .
    git commit -m "Initial commit - Ready for Vercel"
}
Write-Host "☁️ Triggering Vercel Deployment..." -ForegroundColor Green
npx vercel
Write-Host "✅ Done!" -ForegroundColor Yellow
