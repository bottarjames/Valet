#!/bin/bash
# Valet — one-line installer for macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/bottarjames/Valet/main/install.sh | bash

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "  ${RED}✗${NC}  $*"; exit 1; }

REPO="bottarjames/Valet"
CONFIG_DIR="$HOME/.valet"
EXTENSION_DIR="$CONFIG_DIR/extension"
BRIDGE_BIN="$CONFIG_DIR/valet-bridge"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
BRIDGE_LABEL="com.valet.bridge"
BRIDGE_PLIST="$LAUNCH_AGENTS/$BRIDGE_LABEL.plist"

echo ""
echo -e "  ${BOLD}Valet — Installer${NC}"
echo ""

# ── Detect architecture ──────────────────────────────────────────────────────
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  ASSET_NAME="valet-bridge-mac-arm64"
elif [ "$ARCH" = "x86_64" ]; then
  ASSET_NAME="valet-bridge-mac-x64"
else
  err "Unsupported architecture: $ARCH"
fi

# ── Download bridge binary from latest release ───────────────────────────────
echo "  Downloading Valet..."
RELEASE_URL="https://api.github.com/repos/$REPO/releases/latest"
DOWNLOAD_URL=$(curl -fsSL "$RELEASE_URL" | grep "browser_download_url.*$ASSET_NAME" | head -1 | cut -d '"' -f 4)

if [ -z "$DOWNLOAD_URL" ]; then
  # Fallback: try the generic name
  DOWNLOAD_URL=$(curl -fsSL "$RELEASE_URL" | grep "browser_download_url.*valet-bridge-mac" | head -1 | cut -d '"' -f 4)
fi

if [ -z "$DOWNLOAD_URL" ]; then
  err "Could not find bridge binary in latest release. Check https://github.com/$REPO/releases"
fi

mkdir -p "$CONFIG_DIR"
curl -fsSL "$DOWNLOAD_URL" -o "$BRIDGE_BIN"
chmod +x "$BRIDGE_BIN"
ok "Bridge downloaded"

# ── Config ───────────────────────────────────────────────────────────────────
if [ ! -f "$CONFIG_DIR/config.json" ]; then
  echo '{"projects": {}}' > "$CONFIG_DIR/config.json"
  ok "Created config"
else
  ok "Config exists (kept)"
fi

# ── Download extension files ─────────────────────────────────────────────────
mkdir -p "$EXTENSION_DIR/icons"
BASE_RAW="https://raw.githubusercontent.com/$REPO/main/valet-extension"

for f in manifest.json background.js content_script.js popup.html popup.js popup.css; do
  curl -fsSL "$BASE_RAW/$f" -o "$EXTENSION_DIR/$f"
done
for icon in icon16.png icon48.png icon128.png; do
  curl -fsSL "$BASE_RAW/icons/$icon" -o "$EXTENSION_DIR/icons/$icon"
done
ok "Extension files downloaded"

# ── LaunchAgent ──────────────────────────────────────────────────────────────
mkdir -p "$LAUNCH_AGENTS"
launchctl unload "$BRIDGE_PLIST" 2>/dev/null || true

cat > "$BRIDGE_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${BRIDGE_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${BRIDGE_BIN}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${HOME}/Library/Logs/valet-bridge.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/Library/Logs/valet-bridge.log</string>
</dict>
</plist>
PLIST

if launchctl bootstrap "gui/$(id -u)" "$BRIDGE_PLIST" 2>/dev/null ||
   launchctl load "$BRIDGE_PLIST" 2>/dev/null; then
  ok "Bridge started (auto-starts at login)"
else
  warn "Bridge will start on next login"
fi

# ── Verify ───────────────────────────────────────────────────────────────────
sleep 2
if curl -sf http://localhost:27182/ping >/dev/null 2>&1; then
  ok "Bridge responding"
else
  warn "Bridge starting up — give it a moment"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}${BOLD}Valet installed!${NC}"
echo ""
echo "  Load the Chrome extension:"
echo ""
echo "  1. Open Chrome → chrome://extensions"
echo "  2. Enable Developer mode (top-right)"
echo "  3. Click Load unpacked"
echo "  4. Press Cmd+Shift+G and paste:"
echo -e "     ${BOLD}~/.valet/extension${NC}"
echo "  5. Click Select"
echo ""
echo "  Then click the puzzle icon → pin Valet!"
echo ""
