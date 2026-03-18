const BRIDGE = "http://localhost:27182";

// ── Continuously track the active tab's group ─────────────────────────────────
// This is more reliable than only capturing at download-start, because Chrome
// sometimes routes downloads through a temporary ungrouped tab.

async function updateLastActiveGroup() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab  = tabs[0];
    if (tab && tab.groupId && tab.groupId !== -1) {
      await chrome.storage.local.set({
        lastActiveGroup: { groupId: tab.groupId, ts: Date.now() }
      });
    }
  } catch (_) {}
}

chrome.tabs.onActivated.addListener(updateLastActiveGroup);
chrome.tabs.onUpdated.addListener((_id, _info, tab) => {
  if (tab.active) updateLastActiveGroup();
});

// ── Also snapshot the group at download-start (best-case capture) ─────────────
chrome.downloads.onCreated.addListener(async (download) => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab  = tabs[0];
    if (tab && tab.groupId && tab.groupId !== -1) {
      const { downloadOrigins = {} } = await chrome.storage.local.get("downloadOrigins");
      downloadOrigins[download.id]   = tab.groupId;
      await chrome.storage.local.set({ downloadOrigins });
    }
  } catch (_) {}
});

// ── When a download completes ─────────────────────────────────────────────────
chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.state || delta.state.current !== "complete") return;

  const [download] = await chrome.downloads.search({ id: delta.id });
  if (!download || !download.filename) return;

  let projectName = null;

  // 1. Try the pinpoint capture from onCreated
  const { downloadOrigins = {} } = await chrome.storage.local.get("downloadOrigins");
  let groupId = downloadOrigins[delta.id];

  // 2. Fall back to last-seen group if within 60 seconds
  if (groupId == null) {
    const { lastActiveGroup } = await chrome.storage.local.get("lastActiveGroup");
    if (lastActiveGroup && (Date.now() - lastActiveGroup.ts) < 60_000) {
      groupId = lastActiveGroup.groupId;
    }
  }

  // 3. Resolve groupId → project name
  if (groupId != null) {
    try {
      const group                  = await chrome.tabGroups.get(groupId);
      const { groupMappings = {} } = await chrome.storage.local.get("groupMappings");
      const mapped                 = groupMappings[group.title || ""];
      if (mapped) projectName = mapped;
    } catch (_) {}

    // Clean up origin entry
    delete downloadOrigins[delta.id];
    await chrome.storage.local.set({ downloadOrigins });
  }

  // 4. Fall back to default project
  if (!projectName) {
    const { activeProject } = await chrome.storage.local.get("activeProject");
    if (activeProject) projectName = activeProject;
  }

  // 5. Move — or leave in Downloads if nothing matched
  if (projectName) {
    await moveFile(download.filename, projectName);
  }
});

// ── Move ──────────────────────────────────────────────────────────────────────

async function moveFile(filePath, projectName) {
  try {
    const res  = await fetch(`${BRIDGE}/move`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ file: filePath, project: projectName }),
    });
    const data = await res.json();

    if (data.success) {
      chrome.notifications.create(`moved-${Date.now()}`, {
        type:    "basic",
        iconUrl: "icons/icon48.png",
        title:   `Moved to ${projectName}`,
        message: data.filename,
      });
    } else {
      const isMissing = (data.error || "").startsWith("folder_missing:");
      chrome.notifications.create(`err-${Date.now()}`, {
        type:    "basic",
        iconUrl: "icons/icon48.png",
        title:   isMissing ? `⚠️ Folder not found — ${projectName}` : "Valet — Move failed",
        message: isMissing
          ? "The project folder has moved. Click the Valet icon to relocate it."
          : (data.error || "Unknown error"),
      });
    }
  } catch (_) {}
}
