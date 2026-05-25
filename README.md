[README.md](https://github.com/user-attachments/files/28203513/README.md)
# BATTLE OF DOOM — Neon Strike Launcher

Standalone Electron desktop application. Offline-capable, no network required.

## Setup

> **Requires Node.js** — download from https://nodejs.org if not installed.

Open a terminal in this folder and run:

```
npm install
npm start
```

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Shift | Sprint (uses Stamina) |
| LMB | Fire |
| RMB (hold) | Aim Down Sights |
| Space | Jump |
| R | Reload |
| E | Open Inventory |
| G | Hold Grenade |
| F | Interact (Shop/Doors) |
| N | Cycle Spectate Target (when Spectate is ON) |

## Staff Login

Click the **⚙ STAFF** button (top-left, below the minimap).

| Field | Value |
|-------|-------|
| Username | `Jayden_111` |
| Password | `Jayden_111` |

After logging in, the **Override Panel** will appear in the top-right corner.

## Admin Panel Features

| Feature | Description |
|---------|-------------|
| Enemy ESP Box | Draws a bounding box around each enemy |
| Zombie Tracers | Lines from crosshair to each enemy |
| Show FOV Radial | Circle showing the aimbot lock radius |
| **Open Health Bars** | Floating HP bars rendered above each enemy in-world |
| Hard Aimbot | Snaps aim to the nearest enemy in FOV radius |
| Silent Aim | Bullets auto-redirect toward target |
| Speed Hack | Triples movement speed |
| Noclip / Free Cam | Walk through walls, disable gravity |
| **Debug Overlay** | Live FPS, XY position, facing angle, bullet & entity counts |
| **Spectate Mode** | Detach camera and view from a zombie's perspective (cycle with N or button) |

## Project Structure

```
NeonStrikeLauncher/
├── main.js          ← Electron main process
├── preload.js       ← Secure context bridge
├── package.json     ← npm config
└── src/
    ├── index.html   ← Game shell (HUD, menus, modals)
    ├── game.js      ← Full engine
    └── style.css    ← All styling
```
