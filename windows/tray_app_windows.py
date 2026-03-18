#!/usr/bin/env python3
"""
tray_app_windows.py — Valet system tray app for Windows.
Requires: pip install pystray Pillow
"""
import json, os, subprocess, sys, threading
import tkinter as tk
from tkinter import filedialog, simpledialog, messagebox

try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError:
    import ctypes
    ctypes.windll.user32.MessageBoxW(0, "Run install.ps1 to set up Valet properly (pystray/Pillow missing).", "Valet", 0)
    sys.exit(1)

CONFIG_PATH = os.path.expanduser("~/.valet/config.json")

def make_icon_image(size=64):
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    m    = max(1, size // 8)
    th   = size // 4
    tw   = size * 5 // 8
    draw.rectangle([m, m // 2, tw, th],         fill=(94,  164, 237, 255))  # tab
    draw.rectangle([m, th,     size - m, size - m], fill=(74, 144, 217, 255))  # body
    return img

def load_config():
    try:
        with open(CONFIG_PATH) as f:
            return json.load(f)
    except:
        return {"projects": {}}

def save_config(config):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

def run_tk(fn):
    """Run a tkinter dialog on the main thread via a threading event."""
    result = [None]
    done   = threading.Event()
    def _run():
        result[0] = fn()
        done.set()
    threading.Thread(target=_run, daemon=True).start()
    done.wait()
    return result[0]

def add_project(icon, _item):
    root = tk.Tk(); root.withdraw(); root.attributes("-topmost", True)
    name = simpledialog.askstring("Add Project", "Project name:", parent=root)
    if name:
        path = filedialog.askdirectory(title=f"Choose folder for '{name}'", parent=root)
        if path:
            cfg = load_config()
            cfg["projects"][name] = path
            save_config(cfg)
            rebuild_menu(icon)
    root.destroy()

def remove_project(icon, name):
    root = tk.Tk(); root.withdraw(); root.attributes("-topmost", True)
    ok = messagebox.askyesno("Remove Project", f'Remove "{name}" from Valet?', parent=root)
    root.destroy()
    if ok:
        cfg = load_config()
        cfg["projects"].pop(name, None)
        save_config(cfg)
        rebuild_menu(icon)

def open_in_explorer(path):
    expanded = os.path.expanduser(path)
    if os.path.isdir(expanded):
        os.startfile(expanded)

def rebuild_menu(icon):
    cfg      = load_config()
    projects = cfg.get("projects", {})
    items    = []

    for name, path in projects.items():
        items.append(pystray.MenuItem(name, pystray.Menu(
            pystray.MenuItem("Open in Explorer", lambda _, __, p=path: open_in_explorer(p)),
            pystray.MenuItem("Remove",           lambda _, __, n=name: remove_project(icon, n)),
        )))

    if items:
        items.append(pystray.Menu.SEPARATOR)

    items.append(pystray.MenuItem("Add Project\u2026", add_project))
    items.append(pystray.Menu.SEPARATOR)
    items.append(pystray.MenuItem("Quit", lambda _, __: icon.stop()))

    icon.menu = pystray.Menu(*items)

def main():
    image = make_icon_image(64)
    icon  = pystray.Icon("Valet", image, "Valet",
                         menu=pystray.Menu(pystray.MenuItem("Loading\u2026", None)))
    threading.Timer(0.3, lambda: rebuild_menu(icon)).start()
    icon.run()

if __name__ == "__main__":
    main()
