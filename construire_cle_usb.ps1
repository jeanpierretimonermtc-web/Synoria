# ============================================================
#  Script : Construire le dossier "Clé USB" - Dossier Patient MTC
#  Usage  : Clic-droit > Exécuter avec PowerShell
# ============================================================

$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseDir = Join-Path $projectDir "release"
$usbDir     = Join-Path $releaseDir "CleUSB_DossierPatientMTC"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   Dossier Patient MTC - Construction version clé USB" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Build de l'application ────────────────────────────────────
Write-Host "[1/4] Compilation de l'application..." -ForegroundColor Yellow
Set-Location $projectDir

# On utilise cmd pour avoir npx dans le PATH
$buildResult = cmd /c "npm run build:portable 2>&1"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERREUR lors de la compilation :" -ForegroundColor Red
    Write-Host $buildResult -ForegroundColor Red
    Write-Host ""
    Write-Host "Vérifiez que Node.js est installé et que 'npm install' a été exécuté." -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}
Write-Host "  -> Compilation réussie." -ForegroundColor Green

# ── 2. Chercher le fichier portable généré ───────────────────────
Write-Host ""
Write-Host "[2/4] Recherche du fichier portable..." -ForegroundColor Yellow

$portableExe = Get-ChildItem -Path $releaseDir -Filter "*Portable*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $portableExe) {
    # Essai avec le nom exact que electron-builder génère parfois
    $portableExe = Get-ChildItem -Path $releaseDir -Filter "*.exe" | Where-Object { $_.Name -notlike "*Setup*" } | Select-Object -First 1
}
if (-not $portableExe) {
    Write-Host "ERREUR : impossible de trouver le fichier .exe portable dans $releaseDir" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}
Write-Host "  -> Trouvé : $($portableExe.Name)" -ForegroundColor Green

# ── 3. Créer le dossier USB ──────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Création du dossier clé USB..." -ForegroundColor Yellow

if (Test-Path $usbDir) {
    Remove-Item -Recurse -Force $usbDir
}
New-Item -ItemType Directory -Path $usbDir | Out-Null

# Copier le portable
Copy-Item $portableExe.FullName -Destination (Join-Path $usbDir "Dossier Patient MTC.exe")

# Créer le dossier data/ vide (sera rempli au 1er lancement)
New-Item -ItemType Directory -Path (Join-Path $usbDir "data") | Out-Null

# Copier le fichier LIRE_MOI
$lireMoiSrc = Join-Path $projectDir "LIRE_MOI_CLE_USB.txt"
if (Test-Path $lireMoiSrc) {
    Copy-Item $lireMoiSrc -Destination (Join-Path $usbDir "LIRE_MOI.txt")
}

Write-Host "  -> Dossier créé : $usbDir" -ForegroundColor Green

# ── 4. Résumé ────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Résumé du contenu à copier sur la clé USB :" -ForegroundColor Yellow
Write-Host ""
Write-Host "   📁 CleUSB_DossierPatientMTC\  (à copier sur votre clé USB)" -ForegroundColor White
Write-Host "      📄 Dossier Patient MTC.exe   <- lancer l'application" -ForegroundColor White
Write-Host "      📁 data\                      <- données patients (auto-créé)" -ForegroundColor White
Write-Host "      📄 LIRE_MOI.txt               <- instructions" -ForegroundColor White
Write-Host ""

# Ouvrir le dossier dans l'explorateur
Invoke-Item $releaseDir

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  TERMINÉ !  Copiez le dossier 'CleUSB_DossierPatientMTC'" -ForegroundColor Green
Write-Host "  sur votre clé USB. Aucun logiciel à installer." -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Appuyez sur Entrée pour quitter"
