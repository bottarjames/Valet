# Changelog

All notable changes to Valet will be documented in this file.

## [1.4.0] - 2026-04-05

### Added
- **Auto-naming**: Downloads are automatically renamed based on the AI prompt text detected on the page. Works on any website — Freepik, Midjourney, Leonardo, ChatGPT, ComfyUI, and more.
- Universal content script that detects prompt text from selected text, textareas, input fields, contenteditable elements, and common prompt display patterns.
- Platform detection — filenames include a short platform tag (e.g., `-mj`, `-freepik`, `-dalle`).
- Toggle in popup to enable/disable auto-naming (on by default).

### Changed
- Updated manifest to v1.4.0.
- Updated extension description to reflect new capabilities.

## [1.3.0] - 2026-03-29

### Added
- Inline rename on double-click for project names.
- Redesigned icon: transparent bg, blue-to-indigo gradient folder, white arrow.
- Polished popup design with tighter spacing and softer hierarchy.

## [1.2.0] - 2026-03-28

### Changed
- Renamed install.sh to "Install Valet.command" for double-click install on macOS.
- Added prominent download link to README.

## [1.1.0] - 2026-03-27

### Fixed
- Moved bridge.py into valet-extension/ so install.sh works out of the box.

## [1.0.0] - 2026-03-26

### Added
- Initial release: download routing by tab groups and default project.
- Local Python bridge for file moves.
- macOS installer with LaunchAgent and menubar app.
- Windows installer with Startup folder and tray app.
- Project management (add, remove, relocate broken folders).
- Tab group rules with color-coded display.
- Collision handling for duplicate filenames.
- Notification system for move success/failure.
