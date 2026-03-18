#!/usr/bin/env python3
"""
bridge.py — local HTTP bridge for the Valet Chrome extension.
Runs on localhost:27182, started at login via launchd.

Endpoints:
  GET  /ping             → health check
  GET  /projects         → list all projects
  POST /projects/add     → { "name": "...", "path": "..." }
  POST /projects/remove  → { "name": "..." }
  POST /move             → { "file": "...", "project": "..." }
"""

import json
import os
import platform
import shutil
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

CONFIG_PATH = os.path.expanduser("~/.valet/config.json")
PORT = 27182
SYSTEM = platform.system()  # "Darwin" or "Windows"


# ── Config helpers ────────────────────────────────────────────────────────────

def load_config() -> dict:
    try:
        with open(CONFIG_PATH) as f:
            data = json.load(f)
        data.setdefault("projects", {})
        return data
    except FileNotFoundError:
        return {"projects": {}}


def save_config(config: dict):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)
        f.write("\n")


# ── Request handler ───────────────────────────────────────────────────────────

class BridgeHandler(BaseHTTPRequestHandler):

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    # ── GET ───────────────────────────────────────────────────────────────────

    def do_GET(self):
        route = urlparse(self.path).path

        if route == "/ping":
            self._ok({"status": "ok", "version": "1.1"})

        elif route == "/projects":
            self._ok(load_config().get("projects", {}))

        elif route == "/projects/verify":
            # Returns { projectName: true/false } — false means folder is missing
            projects = load_config().get("projects", {})
            self._ok({
                name: os.path.isdir(os.path.expanduser(path))
                for name, path in projects.items()
            })

        elif route == "/browse":
            # Open native folder picker — macOS uses osascript, Windows uses PowerShell
            path = None
            if SYSTEM == "Darwin":
                result = subprocess.run(
                    ["osascript", "-e",
                     "set f to choose folder with prompt \"Choose a project folder:\"\n"
                     "return POSIX path of f"],
                    capture_output=True, text=True
                )
                if result.returncode == 0:
                    path = result.stdout.strip().rstrip("/")
            elif SYSTEM == "Windows":
                ps = (
                    "Add-Type -AssemblyName System.Windows.Forms; "
                    "$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
                    "$f.Description = 'Choose a project folder'; "
                    "$f.ShowNewFolderButton = $true; "
                    "if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }"
                )
                result = subprocess.run(
                    ["powershell", "-NoProfile", "-Command", ps],
                    capture_output=True, text=True
                )
                if result.returncode == 0 and result.stdout.strip():
                    path = result.stdout.strip()

            if path:
                # Shorten to ~ when inside home directory
                home = os.path.expanduser("~")
                sep = "/" if SYSTEM == "Darwin" else "\\"
                if path == home:
                    path = "~"
                elif path.startswith(home + sep):
                    path = "~" + path[len(home):]
                self._ok({"path": path, "name": os.path.basename(path)})
            else:
                self._err(400, "cancelled")

        else:
            self._err(404, "not found")

    # ── POST ──────────────────────────────────────────────────────────────────

    def do_POST(self):
        route = urlparse(self.path).path
        body  = self._read_json()
        if body is None:
            return

        if route == "/projects/add":
            name = body.get("name", "").strip()
            path = body.get("path", "").strip()
            if not name or not path:
                self._err(400, "missing 'name' or 'path'")
                return
            cfg = load_config()
            if name in cfg["projects"]:
                self._err(409, f"project '{name}' already exists")
                return
            cfg["projects"][name] = path
            save_config(cfg)
            self._ok({"success": True, "projects": cfg["projects"]})

        elif route == "/projects/remove":
            name = body.get("name", "").strip()
            if not name:
                self._err(400, "missing 'name'")
                return
            cfg = load_config()
            if name not in cfg["projects"]:
                self._err(404, f"project '{name}' not found")
                return
            del cfg["projects"][name]
            save_config(cfg)
            self._ok({"success": True, "projects": cfg["projects"]})

        elif route == "/move":
            file_path    = body.get("file", "").strip()
            project_name = body.get("project", "").strip()

            if not file_path or not project_name:
                self._err(400, "missing 'file' or 'project'")
                return
            if not os.path.exists(file_path):
                self._err(404, f"file not found: {file_path}")
                return

            cfg      = load_config()
            projects = cfg.get("projects", {})
            if project_name not in projects:
                self._err(404, f"unknown project: {project_name}")
                return

            dest_base = os.path.expanduser(projects[project_name])

            # Folder must already exist — never create it silently
            if not os.path.isdir(dest_base):
                self._err(404, f"folder_missing:{project_name}:{dest_base}")
                return

            filename = os.path.basename(file_path)
            dest     = os.path.join(dest_base, filename)

            if os.path.exists(dest) and os.path.abspath(file_path) != os.path.abspath(dest):
                base, ext = os.path.splitext(filename)
                counter = 1
                while os.path.exists(dest):
                    dest = os.path.join(dest_base, f"{base} {counter}{ext}")
                    counter += 1

            try:
                shutil.move(file_path, dest)
            except Exception as e:
                self._err(500, str(e))
                return

            self._ok({
                "success":  True,
                "filename": os.path.basename(dest),
                "dest":     dest,
                "project":  project_name,
            })

        else:
            self._err(404, "not found")

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        try:
            return json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            self._err(400, "invalid JSON")
            return None

    def _ok(self, data: dict):
        self._respond(200, data)

    def _err(self, status: int, msg: str):
        self._respond(status, {"error": msg})

    def _respond(self, status: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    server = HTTPServer(("localhost", PORT), BridgeHandler)
    print(f"Valet bridge on localhost:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("stopped.")
