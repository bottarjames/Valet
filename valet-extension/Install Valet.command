#!/bin/bash
# Valet — macOS installer (no Python required)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.valet"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
BRIDGE_LABEL="com.valet.bridge"
BRIDGE_PLIST="$LAUNCH_AGENTS/$BRIDGE_LABEL.plist"
BRIDGE_BIN="$CONFIG_DIR/valet-bridge"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*"; exit 1; }

echo ""
echo "  Valet — Installer"
echo "  =================="
echo ""

# ── Config dir ───────────────────────────────────────────────────────────────
mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_DIR/config.json" ]; then
  echo '{"projects": {}}' > "$CONFIG_DIR/config.json"
  ok "Created config"
else
  ok "Config exists (not changed)"
fi

# ── Copy bridge binary ────────────────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/valet-bridge" ]; then
  err "valet-bridge binary not found next to install.sh"
fi
cp "$SCRIPT_DIR/valet-bridge" "$BRIDGE_BIN"
chmod +x "$BRIDGE_BIN"

# macOS Gatekeeper — clear quarantine flag if present
xattr -d com.apple.quarantine "$BRIDGE_BIN" 2>/dev/null || true
ok "Installed bridge → ~/.valet/valet-bridge"

# ── LaunchAgent ───────────────────────────────────────────────────────────────
mkdir -p "$LAUNCH_AGENTS"
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
ok "Created LaunchAgent (auto-starts at login)"

# ── Start bridge ──────────────────────────────────────────────────────────────
launchctl unload "$BRIDGE_PLIST" 2>/dev/null || true
if launchctl bootstrap "gui/$(id -u)" "$BRIDGE_PLIST" 2>/dev/null ||
   launchctl load "$BRIDGE_PLIST" 2>/dev/null; then
  ok "Bridge started"
else
  warn "Bridge will start on next login"
fi

sleep 1
if curl -sf http://localhost:27182/ping >/dev/null 2>&1; then
  ok "Bridge responding ✓"
else
  warn "Bridge not yet responding — give it a moment"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}  Valet installed!${NC}"
echo ""
echo "  LAST STEP — Load the extension in Chrome:"
echo ""
echo "  1. Open Chrome → chrome://extensions"
echo "  2. Enable 'Developer mode' (toggle, top-right)"
echo "  3. Click 'Load unpacked'"
echo "  4. Select this folder:"
echo ""
echo "     $SCRIPT_DIR"
echo ""
echo "  5. Click the puzzle-piece icon → pin Valet"
echo ""
echo "  Then click Valet to add your first project!"
echo ""
