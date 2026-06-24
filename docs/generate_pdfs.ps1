# Script de generation PDF pour la documentation Synoria
# Utilise md-to-pdf (installe automatiquement Chromium la premiere fois)
# Usage : Right-click -> "Executer avec PowerShell"

$docsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pdfDir  = Join-Path $docsDir "PDF"
New-Item -ItemType Directory -Force -Path $pdfDir | Out-Null

Write-Host "Generation des PDFs dans $pdfDir ..." -ForegroundColor Cyan

$files = Get-ChildItem "$docsDir\*.md" | Where-Object { $_.Name -ne "README.md" } | Sort-Object Name

foreach ($file in $files) {
    Write-Host "  -> $($file.Name)" -ForegroundColor Yellow
    $pdfName = [System.IO.Path]::ChangeExtension($file.Name, ".pdf")
    $pdfPath = Join-Path $pdfDir $pdfName
    npx md-to-pdf $file.FullName --dest $pdfPath
}

Write-Host ""
Write-Host "PDFs generes dans : $pdfDir" -ForegroundColor Green
Write-Host "Appuyez sur une touche pour fermer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
