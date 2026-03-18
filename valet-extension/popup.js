const BRIDGE = "http://localhost:27182";

let projects = {};
let folderOk = {};

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const online = await checkBridge();
  if (online) await loadProjects();
  await renderDestination();
  await renderGroups();
  await renderProjectMgmt();
  wireAddForm();
});

// ── Bridge health ─────────────────────────────────────────────────────────────

async function checkBridge() {
  const dot  = document.getElementById("bridge-dot");
  const text = document.getElementById("status-text");
  try {
    const res = await fetch(`${BRIDGE}/ping`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      dot.className    = "bridge-dot ok";
      text.textContent = "● Bridge connected";
      text.className   = "ok";
      return true;
    }
  } catch (_) {}
  dot.className    = "bridge-dot fail";
  text.textContent = "● Bridge offline — run install.sh";
  text.className   = "fail";
  return false;
}

// ── Projects ──────────────────────────────────────────────────────────────────

async function loadProjects() {
  try {
    const [projRes, verifyRes] = await Promise.all([
      fetch(`${BRIDGE}/projects`,        { signal: AbortSignal.timeout(1500) }),
      fetch(`${BRIDGE}/projects/verify`, { signal: AbortSignal.timeout(1500) }),
    ]);
    projects = await projRes.json();
    folderOk = await verifyRes.json();
  } catch (_) { projects = {}; folderOk = {}; }
}

// ── Default destination (dropdown) ───────────────────────────────────────────

async function renderDestination() {
  const { activeProject = "" } = await chrome.storage.local.get("activeProject");
  const sel = document.getElementById("dest-select");
  sel.innerHTML = "";

  const keepOpt = document.createElement("option");
  keepOpt.value       = "";
  keepOpt.textContent = "Keep in Downloads";
  sel.appendChild(keepOpt);

  for (const name of Object.keys(projects)) {
    const opt = document.createElement("option");
    opt.value       = name;
    opt.textContent = name;
    if (name === activeProject) opt.selected = true;
    sel.appendChild(opt);
  }

  sel.addEventListener("change", () =>
    chrome.storage.local.set({ activeProject: sel.value })
  );
}

// ── Tab group rules ───────────────────────────────────────────────────────────

async function renderGroups() {
  const container = document.getElementById("group-rules");
  container.innerHTML = "";

  let groups = [];
  try { groups = await chrome.tabGroups.query({}); } catch (_) {}

  if (groups.length === 0) {
    container.innerHTML = '<div class="empty-msg">No tab groups open</div>';
    return;
  }

  const { groupMappings = {} } = await chrome.storage.local.get("groupMappings");

  for (const group of groups) {
    const title = group.title || "(unnamed)";
    const row   = document.createElement("div");
    row.className = "group-row";

    const dot = document.createElement("span");
    dot.className        = "group-dot";
    dot.style.background = chromeColor(group.color);

    const name = document.createElement("span");
    name.className   = "group-name";
    name.textContent = title;

    const sel = document.createElement("select");
    sel.className = "group-select";
    sel.innerHTML =
      `<option value="">Keep in Downloads</option>` +
      Object.keys(projects)
        .map((p) => `<option value="${esc(p)}" ${groupMappings[title] === p ? "selected" : ""}>${esc(p)}</option>`)
        .join("");

    sel.addEventListener("change", async () => {
      const { groupMappings: gm = {} } = await chrome.storage.local.get("groupMappings");
      gm[title] = sel.value;
      await chrome.storage.local.set({ groupMappings: gm });
    });

    row.append(dot, name, sel);
    container.appendChild(row);
  }
}

function chromeColor(c) {
  return { grey:"#8e8e93", blue:"#0a84ff", red:"#ff453a", yellow:"#ffd60a",
           green:"#30d158", pink:"#ff375f", purple:"#bf5af2",
           cyan:"#32ade6", orange:"#ff9f0a" }[c] || "#8e8e93";
}

// ── Project management ────────────────────────────────────────────────────────

async function renderProjectMgmt() {
  const container = document.getElementById("project-mgmt");
  container.innerHTML = "";

  const names = Object.keys(projects);
  if (names.length === 0) {
    container.innerHTML = '<div class="empty-msg" style="margin-bottom:4px">No projects yet</div>';
    return;
  }

  for (const name of names) {
    const path    = projects[name];
    const healthy = folderOk[name] !== false;
    const row     = document.createElement("div");
    row.className = "project-mgmt-row" + (healthy ? "" : " project-broken");

    if (healthy) {
      row.innerHTML = `
        <span class="mgmt-name">${esc(name)}</span>
        <span class="mgmt-path" title="${esc(path)}">${esc(path)}</span>
        <button class="remove-btn" title="Remove project" data-name="${esc(name)}">×</button>`;
    } else {
      row.innerHTML = `
        <span class="warn-icon" title="Folder not found">⚠️</span>
        <div class="mgmt-broken-info">
          <span class="mgmt-name">${esc(name)}</span>
          <span class="mgmt-missing">Folder not found — needs relocating</span>
        </div>
        <button class="relocate-btn" data-name="${esc(name)}" title="Pick new folder">Relocate</button>
        <button class="remove-btn" title="Remove project" data-name="${esc(name)}">×</button>`;
    }

    container.appendChild(row);
  }

  container.querySelectorAll(".remove-btn").forEach((btn) =>
    btn.addEventListener("click", () => removeProject(btn.dataset.name))
  );
  container.querySelectorAll(".relocate-btn").forEach((btn) =>
    btn.addEventListener("click", () => relocateProject(btn.dataset.name))
  );
}

async function relocateProject(name) {
  try {
    const res  = await fetch(`${BRIDGE}/browse`, { signal: AbortSignal.timeout(60000) });
    const data = await res.json();
    if (!data.path) return;

    await fetch(`${BRIDGE}/projects/remove`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await fetch(`${BRIDGE}/projects/add`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, path: data.path }),
    });

    await loadProjects();
    await renderDestination();
    await renderGroups();
    await renderProjectMgmt();
  } catch (e) { console.error(e); }
}

async function removeProject(name) {
  try {
    await fetch(`${BRIDGE}/projects/remove`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name }),
    });
    await loadProjects();
    await renderDestination();
    await renderGroups();
    await renderProjectMgmt();
  } catch (e) { console.error(e); }
}

// ── Add project form ──────────────────────────────────────────────────────────

function wireAddForm() {
  const addBtn      = document.getElementById("add-project-btn");
  const form        = document.getElementById("add-form");
  const browseBtn   = document.getElementById("browse-btn");
  const saveBtn     = document.getElementById("save-project-btn");
  const cancelBtn   = document.getElementById("cancel-project-btn");
  const cancelBtn2  = document.getElementById("cancel-project-btn2");
  const nameIn      = document.getElementById("new-name");
  const pathIn      = document.getElementById("new-path");
  const chosenBlock = document.getElementById("chosen-folder");
  const chosenLabel = document.getElementById("chosen-path-label");
  const actionsRow  = document.getElementById("add-form-actions");
  const cancelOnly  = document.getElementById("cancel-only-row");

  function resetForm() {
    form.style.display        = "none";
    addBtn.style.display      = "";
    nameIn.value              = "";
    pathIn.value              = "";
    chosenBlock.style.display = "none";
    actionsRow.style.display  = "none";
    cancelOnly.style.display  = "flex";
    clearFormError();
  }

  addBtn.addEventListener("click", () => {
    form.style.display       = "flex";
    addBtn.style.display     = "none";
    cancelOnly.style.display = "flex";
    actionsRow.style.display = "none";
    chosenBlock.style.display = "none";
  });

  browseBtn.addEventListener("click", async () => {
    browseBtn.textContent = "Opening folder picker…";
    browseBtn.disabled    = true;
    clearFormError();
    try {
      const res  = await fetch(`${BRIDGE}/browse`, { signal: AbortSignal.timeout(60000) });
      const data = await res.json();

      if (data.path) {
        pathIn.value              = data.path;
        chosenLabel.textContent   = data.path;
        chosenBlock.style.display = "flex";
        actionsRow.style.display  = "flex";
        cancelOnly.style.display  = "none";
        if (!nameIn.value) nameIn.value = data.name || "";
        nameIn.focus();
        nameIn.select();
      } else {
        showFormError(data.error || "Folder picker cancelled");
      }
    } catch (e) {
      showFormError("Bridge not responding");
    } finally {
      browseBtn.textContent = "📂 Choose folder…";
      browseBtn.disabled    = false;
    }
  });

  cancelBtn.addEventListener("click",  resetForm);
  cancelBtn2.addEventListener("click", resetForm);
  saveBtn.addEventListener("click",    () => saveProject());
  nameIn.addEventListener("keydown",   (e) => { if (e.key === "Enter") saveProject(); });
}

async function saveProject() {
  const name = document.getElementById("new-name").value.trim();
  const path = document.getElementById("new-path").value.trim();
  clearFormError();

  if (!name) { showFormError("Project name is required"); return; }
  if (!path) { showFormError("Folder path is required");  return; }

  try {
    const res  = await fetch(`${BRIDGE}/projects/add`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, path }),
    });
    const data = await res.json();
    if (!res.ok) { showFormError(data.error || "Failed to save"); return; }

    document.getElementById("new-name").value        = "";
    document.getElementById("new-path").value        = "";
    document.getElementById("add-form").style.display = "none";
    document.getElementById("add-project-btn").style.display = "";

    await loadProjects();
    await renderDestination();
    await renderGroups();
    await renderProjectMgmt();
  } catch (e) {
    showFormError("Bridge offline");
  }
}

function showFormError(msg) {
  clearFormError();
  const err = document.createElement("div");
  err.className   = "form-error";
  err.id          = "form-error";
  err.textContent = msg;
  document.getElementById("add-form").appendChild(err);
}
function clearFormError() { document.getElementById("form-error")?.remove(); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
