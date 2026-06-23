# ⚡ WARZONE LAUNCHER v1.1.0 — Performance & Administration Update

This data sheet documents the comprehensive rendering optimizations, persistent administrative configuration system, and packaging metrics implemented in version **1.1.0**.

---

## 🚀 1. Rendering Optimization & Performance Stability
- **DDA Raycaster Memory Pool:** The inner loop of `dRay` has been refactored to eliminate the allocation of temporary hit arrays and objects (previously up to 1,280+ object allocations per frame). It now mutates elements of a static, pre-allocated `HITS_POOL`. This completely removes GC (Garbage Collection) memory pressure and eradicates random frame rate stutter/lag spikes.
- **High-Precision Loop Scheduler:** The game loop timing scheduler has been upgraded to a hybrid pattern. Instead of using `setTimeout` (which introduces operating system timer jitter), the loop utilizes `requestAnimationFrame` for coarse delays and yields to `requestFrame` (MessageChannel postMessage) for micro-delays (<4ms). This results in extremely stable frame rates aligned precisely to selected cap values (e.g. 140 FPS).

## ⚙️ 2. Persistent Admin Settings & Configuration Saving
- **Save State Persistence:** The entire administrative cheat system (`ADMIN` object) is now fully serialized to `save_data.json` via Electron's IPC channel.
- **Write-Through Debouncing:** To prevent disk write thrashing when dragging settings sliders in the panel, storage writes are throttled using a 200ms debounce buffer. Anti-cheat events (e.g. script injection bans) bypass this debounce and write synchronously.
- **Startup Syncing:** On application startup, the UI inputs, color pickers, range labels, and selected options are programmatically synchronized to match the loaded configuration state.

## 🛠️ 3. Extended Admin Controls
- **Aimbot Target Filter:** Added a target selection dropdown filter to target "All Hostiles", "Zombies Only", or "Players Only".
- **Aimbot Target Swap Delay:** Added a configurable delay (in ms) to prevent rapid target jittering/flickering during combat.
- **Target Snaplines:** Added a dedicated snapline tracker that draws directly to the current active aimbot target. Deferred overlay rendering guarantees all tracers and snaplines draw flawlessly on top of walls, entities, and the viewmodel.
- **FOV Radials:** Upgraded the "FOV Circle" to "FOV Radials", allowing custom geometries including Circle, Square, Hexagon, and Star.
- **Customizable ESP Styles:** Integrated options for ESP Box Styles ("Full Box" vs "Corner Box") and adjustable line width range (1px to 5px).
- **Custom Skeleton & Crosshair Colors:** Added RGB color pickers to allow customizing Skeleton ESP and Crosshair colors.
- **Crosshair Styles:** Added support for "Default", "Center Dot", "Classic Cross", and "Hollow Circle" crosshairs.
- **Hitbox Expansion Rework:** Upgraded hitbox expansion to accurately scale in all 3D directions. Added visualizer shapes (Bubble, Box, Cylinder), X-Ray, Wireframe toggles, and decoupled personal hitbox scaling so the local player's hitbox size is controlled independently.
- **Auto Jump / BHop:** Implemented an Auto Jump toggle that automatically handles frame-perfect jumps in the movement loop.

---

## 📦 4. Launcher Packaging & Installer Distribution
A standalone installer has been successfully built for this update to enable deployment.

*   **Version:** `1.1.0`
*   **Target Platform:** Windows x64 (`nsis` package configuration)
*   **Compiled Executable:** `dist/WARZONE LAUNCHER Setup 1.1.0.exe`
*   **Compiled Package Size:** ~60-70 MB (Standalone portable build)

---

# ⚡ Historical Release Notes: WARZONE LAUNCHER v1.0.21
This documents the balance adjustments, armor/helmet rebalancing, shotgun mechanics updates, and launcher distribution metrics implemented in version **1.0.21**.

## 🛠️ 1. Ammunition Caliber Rebalancing
High-caliber ammunition armor penetration and durability wear values have been updated to optimize combat engagements.

| Caliber / Ammo Type | Previous Pen (`penMult`) | New Pen (`penMult`) | Armor Bypass Buff/Nerf | Previous Durability Dmg | New Durability Dmg |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`9x39 subsonic`** | 1.00x | **0.50x** | **+50% Armor Bypass** | 15 | **35** |
| **`.223 rem`** | 1.00x | **0.90x** | **+10% Armor Bypass** | 30 | 30 |
| **`7.62x62 soviet`** | 0.65x | **0.75x** | *-10% Armor Bypass* | 20 | 20 |
| **`.50 bmg`** | 0.50x | **0.30x** | **+20% Armor Bypass** | 100 | 100 |

> [!NOTE]
> Lower `penMult` values yield higher armor penetration (less protection from vests/helmets). 
> Formula: $\text{Damage Received} = \text{Base Damage} \times (1 - \text{Mitigation} \times \text{penMult})$.

---

## 🔫 2. Weapon Balance & Mechanics Revisions

Select weapon classes have received adjustments to their fire control, ballistics, and shop availability.

### ⚔️ PvP Specific Damage Overrides
- **SCAR-H:** Base damage reduced: `25.0` $\rightarrow$ **`22.0`** (2.0x headshot remains).
- **AR15:** Base damage reduced: `22.0` $\rightarrow$ **`18.0`** (2.0x headshot remains).
- **AWM:** Base damage reduced, headshot multiplier increased: Base `100.0` $\rightarrow$ **`95.0`**, Headshot `2.0x` $\rightarrow$ **`2.2x`** (Headshot damage `200.0` $\rightarrow$ **`209.0`**).
- **UZI:** Base damage reduced, headshot multiplier reduced: Base `14.0` $\rightarrow$ **`11.0`**, Headshot `1.5x` $\rightarrow$ **`1.3x`**.
- **GLOCK 19 & 18C:** Base damage reduced: `16.0` $\rightarrow$ **`13.0`**.
- **MP5:** Base damage reduced, headshot multiplier reduced: Base `15.0` $\rightarrow$ **`14.0`**, Headshot `2.2x` $\rightarrow$ **`2.0x`**.
- **REVOLVER:** Base damage reduced, headshot multiplier increased: Base `30.0` $\rightarrow$ **`25.0`**, Headshot `2.5x` $\rightarrow$ **`4.0x`** (Headshot damage `75.0` $\rightarrow$ **`100.0`**).
- **M110K:** Base damage increased: `25.0` $\rightarrow$ **`28.0`** (4.0x headshot remains).
- **AS-VAL:** Base damage reduced, headshot multiplier increased: Base `18.0` $\rightarrow$ **`10.0`**, Headshot `2.0x` $\rightarrow$ **`3.0x`**.
- **M82A1:** Base damage reduced, headshot multiplier reduced: Base `80.0` $\rightarrow$ **`75.0`**, Headshot `3.0x` $\rightarrow$ **`2.5x`**.
- **SVD:** Base damage reduced, headshot multiplier reduced: Base `30.0` $\rightarrow$ **`28.0`**, Headshot `5.0x` $\rightarrow$ **`4.5x`**.
- **PKM:** Base damage increased, headshot multiplier increased: Base `25.0` $\rightarrow$ **`28.0`**, Headshot `2.5x` $\rightarrow$ **`2.7x`**.
- **SKS:** Added to PvP overrides: Base damage **`20.0`**, Headshot **`4.0x`**.

### 🔴 Shotgun Overhaul (SPAS-12 & M500)
- **Pellet Count Standardization:** Both shotguns now fire exactly **12 pellets** per shot (M500 count increased from 10 to 12).
- **Spread Reduction & Consistency:** Base spread for both SPAS-12 and M500 has been reduced by **50%** (from `0.168` to `0.084`) for tighter patterning, and spread is now constant (does not decrease/tighten when scoping/aiming down sights).
- **SPAS-12 Stock Position Fix:** Modified the visual folding stock block geometry to correct the camera ADS clipping glitch.

---

## 🛡️ 3. Defensive Armor & Survival Rework

Armor durability capacity, pricing, and mitigating attributes have been overhauled.

### 🪖 Helmets & Visors
- **Motorcycle Helmet (T1):** Durability increased: `50` $\rightarrow$ **`100`**. Added **`50%`** concussion resistance.
- **Police Helmet (T2):** Cost reduced: `$3,000` $\rightarrow$ **`$1,500`**. Durability reduced: `125` $\rightarrow$ **`100`**. Added **`50%`** concussion resistance.
- **Military Helmet (T3):** Cost reduced: `$5,000` $\rightarrow$ **`$3,000`**. Durability increased: `200` $\rightarrow$ **`250`**. Concussion resistance increased: `50%` $\rightarrow$ **`80%`**.
- **Altyn Helmet (T4):** Cost reduced: `$10,000` $\rightarrow$ **`$5,000`**. Durability reduced: `600` $\rightarrow$ **`500`**.
  *   *Visor Buff:* When the visor is toggled down (`N` key), durability damage taken by the helmet is reduced by **50%**.

### 🎽 Vests & Flinch Mitigation
- **Police Vest (T1):** Durability increased: `75` $\rightarrow$ **`100`**.
- **Military Vest (T2):** Durability increased: `150` $\rightarrow$ **`250`**.
- **Ratnic Vest (T3):** (Formerly *Plate Carrier T3*) Cost reduced: `$7,500` $\rightarrow$ **`$5,000`**. Damage reduction decreased: `90%` $\rightarrow$ **`75%`**.
- **Assault Vest (T4):** *New Item!* Cost **`$7,000`**. Damage reduction **`90%`**. Durability **`1000`**. Speed modifier **`0.80`**.
  *   *Crow Merchant Purchase Rule:* Requires **1x Red Floppy Disk** and **1x Black Floppy Disk** in addition to the cash price in Survival Mode.
- **Flinch Mitigation:** Higher tier vests now actively decrease incoming aim-flinch intensity. Flinch magnitude is scaled down by `(1.0 - Vest Mitigation %)` while the vest is active.

---

## 📦 4. Historical Launcher Packaging & Installer Distribution
*   **Version:** `1.0.21`
*   **Target Platform:** Windows x64 (`nsis` package configuration)
*   **Compiled Executable:** `dist/WARZONE LAUNCHER Setup 1.0.21.exe`
