const BRIDGE = "http://localhost:27182";

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.state || delta.state.current !== "complete") return;

  const [download] = await chrome.downloads.search({ id: delta.id });
  if (!download || !download.filename) return;

  let groupId = null;

  // 1. Use download.tabId — the exact tab that triggered the download.
  //    This is always correct regardless of what tab the user is on now.
  if (download.tabId && download.tabId !== -1) {
    try {
      const tab = await chrome.tabs.get(download.tabId);
      if (tab && tab.groupId && tab.groupId !== -1) {
        groupId = tab.groupId;
      }
    } catch (_) {
      // Tab was closed before download finished — fall through
    }
  }

  // 2. Tab was closed or had no group — fall back to currently active tab
  if (groupId == null) {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
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
