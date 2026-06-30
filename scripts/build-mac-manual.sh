#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
#  Synoria — Script de build Mac (arm64 + x64)
#  À exécuter sur un Mac par quelqu'un qui aide Jean-Pierre
#
#  Usage :
#    chmod +x build-mac-manual.sh
#    ./build-mac-manual.sh 1.5.7
#
#  Prérequis sur le Mac :
#    - Node.js 18+ (https://nodejs.org)
#    - Python 3 (inclus sur macOS ou via brew install python3)
#    - Xcode Command Line Tools : xcode-select --install
# ═══════════════════════════════════════════════════════════════════════

set -e  # Arrêt immédiat en cas d'erreur

# ── Couleurs ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${BLUE}→ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
err()  { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo ""
echo "═══════════════════════════════════════════"
echo "   Synoria — Build Mac                     "
echo "═══════════════════════════════════════════"
echo ""

# ── Version ───────────────────────────────────────────────────────────
VERSION=${1:-"1.5.7"}
info "Version cible : $VERSION"

# ── Vérification des prérequis ────────────────────────────────────────
info "Vérification des prérequis..."

command -v node >/dev/null 2>&1 || err "Node.js non trouvé. Installez-le sur https://nodejs.org"
NODE_VER=$(node -v)
ok "Node.js $NODE_VER"

command -v python3 >/dev/null 2>&1 || err "Python3 non trouvé. Exécutez : brew install python3"
ok "Python3 $(python3 --version 2>&1 | awk '{print $2}')"

command -v xcode-select >/dev/null 2>&1 || err "Xcode CLI Tools manquant. Exécutez : xcode-select --install"
ok "Xcode CLI Tools présent"

# ── Architecture du Mac ───────────────────────────────────────────────
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  info "Mac Apple Silicon détecté (arm64) — builds arm64 natif + x64 via Rosetta 2"
  CAN_BUILD_ARM64=true
  CAN_BUILD_X64=true

  # Vérifier Rosetta 2 pour le build x64
  if ! arch -x86_64 echo "" >/dev/null 2>&1; then
    warn "Rosetta 2 non installée. Installation en cours..."
    softwareupdate --install-rosetta --agree-to-license
    ok "Rosetta 2 installée"
  else
    ok "Rosetta 2 disponible"
  fi

elif [ "$ARCH" = "x86_64" ]; then
  warn "Mac Intel détecté (x86_64) — build x64 natif uniquement (pas de arm64 possible)"
  CAN_BUILD_ARM64=false
  CAN_BUILD_X64=true
else
  err "Architecture inconnue : $ARCH"
fi

echo ""

# ── Se placer à la racine du projet ───────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"
info "Dossier projet : $PROJECT_DIR"

# ── Appliquer la configuration cabinet ───────────────────────────────
info "Configuration package.json (cabinet, version $VERSION)..."
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  p.version = '$VERSION';
  p.build.appId = 'com.synoria.cabinet';
  p.build.productName = 'Synoria';
  fs.writeFileSync('package.json', JSON.stringify(p, null, 2), 'utf8');
  console.log('  appId     :', p.build.appId);
  console.log('  productName:', p.build.productName);
  console.log('  version   :', p.version);
"
ok "package.json configuré"

# ── Dossier de sortie ─────────────────────────────────────────────────
OUTPUT_DIR="$PROJECT_DIR/release-mac-v$VERSION"
mkdir -p "$OUTPUT_DIR"
rm -f "$PROJECT_DIR/release/"*.dmg 2>/dev/null || true

echo ""

# ══════════════════════════════════════════════════════════════════════
#  BUILD arm64 (Apple Silicon)
# ══════════════════════════════════════════════════════════════════════
if [ "$CAN_BUILD_ARM64" = true ]; then
  echo "───────────────────────────────────────────"
  echo "  BUILD arm64 (Apple Silicon M1/M2/M3)"
  echo "───────────────────────────────────────────"

  info "npm install (arm64 natif)..."
  npm install

  info "Vérification binaire better-sqlite3..."
  NODE_FILE=$(find node_modules/better-sqlite3 -name "*.node" 2>/dev/null | head -1)
  if [ -n "$NODE_FILE" ]; then
    ARCH_INFO=$(file "$NODE_FILE")
    echo "  $ARCH_INFO"
    if [[ "$ARCH_INFO" == *"arm64"* ]]; then
      ok "better-sqlite3 : arm64 ✓"
    else
      warn "better-sqlite3 : architecture inattendue"
    fi
  fi

  info "Build Vite + electron-builder arm64..."
  npx vite build
  npx electron-builder --mac --arm64 --publish never

  # Récupérer et renommer le DMG
  DMG_ARM=$(find "$PROJECT_DIR/release" -name "*.dmg" | head -1)
  if [ -n "$DMG_ARM" ]; then
    DEST_ARM="$OUTPUT_DIR/Synoria-v${VERSION}-arm64.dmg"
    cp "$DMG_ARM" "$DEST_ARM"
    ok "DMG arm64 créé : Synoria-v${VERSION}-arm64.dmg ($(du -h "$DEST_ARM" | cut -f1))"
    rm -f "$PROJECT_DIR/release/"*.dmg
  else
    err "DMG arm64 introuvable dans release/"
  fi

else
  warn "Build arm64 ignoré (Mac Intel)"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════
#  BUILD x64 (Intel)
# ══════════════════════════════════════════════════════════════════════
if [ "$CAN_BUILD_X64" = true ]; then
  echo "───────────────────────────────────────────"
  if [ "$ARCH" = "arm64" ]; then
    echo "  BUILD x64 (Intel) via Rosetta 2"
  else
    echo "  BUILD x64 (Intel natif)"
  fi
  echo "───────────────────────────────────────────"

  # Nettoyer node_modules pour éviter les conflits d'architecture
  info "Nettoyage node_modules pour build x64..."
  rm -rf node_modules

  if [ "$ARCH" = "arm64" ]; then
    info "npm install sous x86_64 (Rosetta 2)..."
    arch -x86_64 npm install
  else
    info "npm install (Intel natif)..."
    npm install
  fi

  info "Vérification binaire better-sqlite3..."
  NODE_FILE=$(find node_modules/better-sqlite3 -name "*.node" 2>/dev/null | head -1)
  if [ -n "$NODE_FILE" ]; then
    ARCH_INFO=$(file "$NODE_FILE")
    echo "  $ARCH_INFO"
    if [[ "$ARCH_INFO" == *"x86_64"* ]]; then
      ok "better-sqlite3 : x86_64 ✓"
    else
      err "better-sqlite3 n'est PAS x86_64 — build annulé. Vérifiez Rosetta 2."
    fi
  fi

  info "Build Vite + electron-builder x64..."
  npx vite build
  npx electron-builder --mac --x64 --publish never

  # Récupérer et renommer le DMG
  DMG_X64=$(find "$PROJECT_DIR/release" -name "*.dmg" | head -1)
  if [ -n "$DMG_X64" ]; then
    DEST_X64="$OUTPUT_DIR/Synoria-v${VERSION}-x64.dmg"
    cp "$DMG_X64" "$DEST_X64"
    ok "DMG x64 créé : Synoria-v${VERSION}-x64.dmg ($(du -h "$DEST_X64" | cut -f1))"
    rm -f "$PROJECT_DIR/release/"*.dmg
  else
    err "DMG x64 introuvable dans release/"
  fi
fi

# ── Restaurer node_modules arm64 (si Mac Apple Silicon) ───────────────
if [ "$ARCH" = "arm64" ] && [ "$CAN_BUILD_ARM64" = true ]; then
  info "Restauration node_modules arm64 pour le développement local..."
  rm -rf node_modules
  npm install >/dev/null 2>&1
  ok "node_modules restauré (arm64)"
fi

# ── Résumé final ──────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "   RÉSULTAT"
echo "═══════════════════════════════════════════"
echo ""
echo "Fichiers dans : $OUTPUT_DIR"
echo ""
ls -lh "$OUTPUT_DIR/"*.dmg 2>/dev/null || warn "Aucun DMG trouvé"
echo ""
echo "→ Envoyez ces fichiers à Jean-Pierre par WeTransfer, Google Drive, ou iCloud Drive."
echo "   - *-arm64.dmg : MacBook Apple Silicon (M1/M2/M3) depuis fin 2020"
echo "   - *-x64.dmg   : MacBook Intel (avant fin 2020)"
echo ""
ok "Build terminé !"
