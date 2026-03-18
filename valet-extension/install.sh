#!/bin/bash
# Valet Chrome Extension — one-run install script
# Sets up the local bridge that connects the extension to your Mac's filesystem.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.valet"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
BRIDGE_LABEL="com.valet.bridge"
BRIDGE_PLIST="$LAUNCH_AGENTS/$BRIDGE_LABEL.plist"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*"; exit 1; }

echo ""
echo "  Valet — Chrome Extension Installer"
echo "  ===================================="
echo ""

# ── Python ───────────────────────────────────────────────────────────────────
PYTHON3=""
for candidate in /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  if [ -x "$candidate" ]; then PYTHON3="$candidate"; break; fi
done
[ -z "$PYTHON3" ] && err "Python 3 not found. Install it from python.org and try again."
ok "Found Python at $PYTHON3"

# ── Config dir and default config ────────────────────────────────────────────
mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_DIR/config.json" ]; then
  echo '{"projects": {}}' > "$CONFIG_DIR/config.json"
  ok "Created ~/.valet/config.json"
else
  ok "Config exists at ~/.valet/config.json  (not changed)"
fi

# ── Bridge script ─────────────────────────────────────────────────────────────
cp "$SCRIPT_DIR/bridge.py" "$CONFIG_DIR/bridge.py"
chmod +x "$CONFIG_DIR/bridge.py"
ok "Installed bridge → ~/.valet/bridge.py"

# ── Extension icons ───────────────────────────────────────────────────────────
"$PYTHON3" "$SCRIPT_DIR/generate_icons.py" 2>/dev/null && ok "Generated extension icons" || warn "Icon generation skipped"

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
        <string>${PYTHON3}</string>
        <string>${CONFIG_DIR}/bridge.py</string>
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

# Stop old instance, start fresh
launchctl unload "$BRIDGE_PLIST" 2>/dev/null || true
if launchctl bootstrap "gui/$(id -u)" "$BRIDGE_PLIST" 2>/dev/null ||
   launchctl load "$BRIDGE_PLIST" 2>/dev/null; then
  ok "Bridge started"
else
  warn "Bridge will start on next login"
fi

# ── Verify ────────────────────────────────────────────────────────────────────
sleep 1
if curl -sf http://localhost:27182/ping >/dev/null 2>&1; then
  ok "Bridge responding on localhost:27182"
else
  warn "Bridge not yet responding — give it a moment"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}  Bridge installed!${NC}"
echo ""
echo "  LAST STEP — Load the extension in Chrome:"
echo ""
echo "  1. Open Chrome and go to:  chrome://extensions"
echo "  2. Enable 'Developer mode' (toggle, top-right)"
echo "  3. Click 'Load unpacked'"
echo "  4. Select this folder:"
echo ""
echo "     $SCRIPT_DIR"
echo ""
echo "  5. Click the puzzle-piece icon in Chrome toolbar → pin 📁 Valet"
echo ""
echo "  Then click 📁 to add your first project — no config file needed!"
echo ""
