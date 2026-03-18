const BRIDGE = "http://localhost:27182";

// Snapshot the origin tab group when download starts (best case)
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

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.state || delta.state.current !== "complete") return;

  const [download] = await chrome.downloads.search({ id: delta.id });
  if (!download || !download.filename) return;

  let groupId = null;

  // 1. Use the origin group captured at download-start
  const { downloadOrigins = {} } = await chrome.storage.local.get("downloadOrigins");
  if (downloadOrigins[delta.id] != null) {
    groupId = downloadOrigins[delta.id];
    delete downloadOrigins[delta.id];
    await chrome.storage.local.set({ downloadOrigins });
  }

  // 2. If that was missed (service worker was sleeping), just ask right now
  //    what tab is active — user is almost certainly still on the same tab
  if (groupId == null) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab  = tabs[0];
      if (tab && tab.groupId && tab.groupId !== -1) {
        groupId = tab.groupId;
      }
    } catch (_) {}
  }

  // 3. Resolve group → project name
  let projectName = null;
  if (groupId != null) {
    try {
      const group                  = await chrome.tabGroups.get(groupId);
      const { groupMappings = {} } = await chrome.storage.local.get("groupMappings");
      const mapped                 = groupMappings[group.title || ""];
      if (mapped) projectName = mapped;
    } catch (_) {}
  }

  // 4. Fall back to default project
  if (!projectName) {
    const { activeProject } = await chrome.storage.local.get("activeProject");
    if (activeProject) projectName = activeProject;
  }

  // 5. Move — or leave in Downloads if nothing matched
  if (projectName) await moveFile(download.filename, projectName);
});

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
