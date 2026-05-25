/**
 * BATTLE OF DOOM — NEON STRIKE OMEGA v2
 * Standalone Edition — game.js
 * All bugs fixed, new features added.
 */
'use strict';

// TEMP DEBUG: Visible error display
window.onerror = function(msg, src, line, col, err) {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:12px;z-index:999999;font-family:monospace;font-size:13px;white-space:pre-wrap;';
    d.textContent = 'JS ERROR: ' + msg + '\nat ' + src + ':' + line + ':' + col + '\n' + (err && err.stack || '');
    document.body.appendChild(d);
};
window.addEventListener('unhandledrejection', function(e) {
    console.warn('Unhandled promise rejection:', e.reason);
    // Don't show UI for pointer lock rejections - those are expected
});

// ============================================================
// CANVAS SETUP
// ============================================================
document.addEventListener('contextmenu', e => e.preventDefault());

const canvas = document.getElementById('gameCanvas');
const mainCtx = canvas.getContext('2d', { alpha: false });
const minimap = document.getElementById('minimap');
const mCtx = minimap.getContext('2d');

minimap.width = 168;
minimap.height = 168;

let mainW = window.innerWidth;
let mainH = window.innerHeight;
canvas.width = mainW;
canvas.height = mainH;

let STATE_resScale = 1.0; // default Graphics Quality (Always native resolution scale now)
let STATE_renderStep = 3; // Default render step (Medium = renders every 3rd column)

const renderCanvas = document.createElement('canvas');
const ctx = renderCanvas.getContext('2d', { alpha: false });

let scrW = Math.max(1, Math.floor(mainW * STATE_resScale));
let scrH = Math.max(1, Math.floor(mainH * STATE_resScale));
renderCanvas.width = scrW;
renderCanvas.height = scrH;

window.addEventListener('resize', () => {
    mainW = canvas.width = window.innerWidth;
    mainH = canvas.height = window.innerHeight;
    scrW = renderCanvas.width = Math.max(1, Math.floor(mainW * STATE_resScale));
    scrH = renderCanvas.height = Math.max(1, Math.floor(mainH * STATE_resScale));
    STATE.zBuf = new Float64Array(scrW);
});


// ============================================================
// STAFF LOGIN
// ============================================================
const STAFF_CREDS = { user: 'Jayden_111', pass: '1211' };
let staffLoggedIn = false;

const elStaffBtn = document.getElementById('staff-btn');
const elStaffModalBg = document.getElementById('staff-modal-bg');
const elStaffUser = document.getElementById('staff-user');
const elStaffPass = document.getElementById('staff-pass');
const elStaffError = document.getElementById('staff-error');
const elStaffLoginBtn = document.getElementById('staff-login-btn');
const elStaffCancelBtn = document.getElementById('staff-cancel-btn');
const elAdminPanel = document.getElementById('admin-panel');
const elAdminCloseBtn = document.getElementById('admin-close-btn');

function openStaffModal() {
    elStaffUser.value = ''; elStaffPass.value = ''; elStaffError.textContent = '';
    elStaffModalBg.classList.add('visible');
    setTimeout(() => elStaffUser.focus(), 60);
}
function closeStaffModal() { elStaffModalBg.classList.remove('visible'); }

function doStaffLogin() {
    if (elStaffUser.value.trim() === STAFF_CREDS.user && elStaffPass.value === STAFF_CREDS.pass) {
        staffLoggedIn = true;
        window.staffAuthVerified = true; // NEW: Block bypass
        closeStaffModal();
        elAdminPanel.style.display = 'block';
        document.getElementById('staff-modal-bg').classList.remove('visible');
        document.getElementById('staff-mod-section').style.display = 'block';
        notice('STAFF LOGGED IN: MODERATION ACTIVE');
        
        // Update moderation status text
        if (typeof AC !== 'undefined' && AC.isBanned) {
            const modStatus = document.getElementById('mod-status-text');
            modStatus.textContent = 'BANNED';
            modStatus.style.color = '#ff3030';
        }
    } else {
        elStaffError.textContent = 'Invalid credentials.';
        elStaffPass.value = ''; elStaffPass.focus();
    }
}

elStaffBtn.addEventListener('click', () => {
    if (staffLoggedIn) {
        elAdminPanel.style.display = elAdminPanel.style.display === 'none' ? 'block' : 'none';
    } else { openStaffModal(); }
});
elStaffLoginBtn.addEventListener('click', doStaffLogin);
elStaffCancelBtn.addEventListener('click', closeStaffModal);
elStaffModalBg.addEventListener('click', e => { if (e.target === elStaffModalBg) closeStaffModal(); });
elStaffPass.addEventListener('keydown', e => { if (e.key === 'Enter') doStaffLogin(); });
elStaffUser.addEventListener('keydown', e => { if (e.key === 'Enter') elStaffPass.focus(); });
elAdminCloseBtn.addEventListener('click', () => { elAdminPanel.style.display = 'none'; });


// ============================================================
// ADMIN STATE
// ============================================================
const ADMIN = {
    esp: false, tracers: false, radial: false, radialSilent: false,
    aimbot: false, silent: false, recoil: false, speed: false,
    noclip: false, flyhack: false, healthbars: false, debug: false, spectate: false,
    hitboxes: false, infiniteStamina: false, thirdperson: false,
    bhop: false, triggerbot: false, godmode: false,
    fov: 150, silentFov: 200, accuracy: 100, hitLocation: 'head',
    speedVal: 2.0, jumpVal: 4.8, reloadSpeed: 1.0,
    aimKey: 'mouse2', silentKey: 'always', aimKeyPressed: false,
    keybinds: {}, freezeEnv: false,
    customSky: false, skyColor: '#ff3030', skyBrightness: 1.0,
    chams: false, chamsColor: '#ff0000', chamsAlpha: 0.8,
    aimSmooth: 1, silentMode: 'vector', noSpread: false, antiAim: false,
    skeletonEsp: false, espMode: 'box', tracerMode: 'all', hitboxExpansion: 1.0,
    tracerLocation: 'legs', spinbot: false, targetPriority: 'closest',
    espColor: '#ff0044', fovColor: '#ff0044', silentFovColor: '#ffaa00', tracerColor: '#00ffcc',
    rainbowRgb: false, fovIncreaser: 1.0, infiniteAmmo: false
};
let spectateIdx = -1;
let mouseX = scrW / 2;
let mouseY = scrH / 2;
let floorPxCache = null; // cached once in initTextures — used by floor casting

// ── Hitmarker System ─────────────────────────────────────────
const hitmarkers = [];
function spawnHitmarker(isHeadshot, isKill = false) {
    hitmarkers.push({ t: performance.now(), hs: isHeadshot, kill: isKill });
}
function dHitmarkers() {
    const now = performance.now();
    for (let i = hitmarkers.length - 1; i >= 0; i--) {
        const hm = hitmarkers[i];
        const dur = hm.kill ? 380 : 220;
        const age = now - hm.t;
        if (age > dur) { hitmarkers.splice(i, 1); continue; }
        const alpha = 1 - age / dur;
        const cx = scrW / 2, cy = scrH / 2;
        ctx.save();
        ctx.globalAlpha = alpha;

        if (hm.kill) {
            // ── KILL: red X, larger and longer ──────────────────
            const size = 13, gap = 5;
            ctx.strokeStyle = '#ff2020';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(cx - gap, cy - gap); ctx.lineTo(cx - gap - size, cy - gap - size);
            ctx.moveTo(cx + gap, cy - gap); ctx.lineTo(cx + gap + size, cy - gap - size);
            ctx.moveTo(cx - gap, cy + gap); ctx.lineTo(cx - gap - size, cy + gap + size);
            ctx.moveTo(cx + gap, cy + gap); ctx.lineTo(cx + gap + size, cy + gap + size);
            ctx.stroke();
        } else if (hm.hs) {
            // ── HEADSHOT: white diamond cross (+ rotated 45°) ───
            const size = 10, gap = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            // Straight cross (rotated vs normal X)
            ctx.beginPath();
            ctx.moveTo(cx, cy - gap - size); ctx.lineTo(cx, cy - gap);         // top
            ctx.moveTo(cx, cy + gap);         ctx.lineTo(cx, cy + gap + size);  // bottom
            ctx.moveTo(cx - gap - size, cy); ctx.lineTo(cx - gap, cy);          // left
            ctx.moveTo(cx + gap, cy);         ctx.lineTo(cx + gap + size, cy);  // right
            ctx.stroke();
            // Small center diamond
            ctx.beginPath();
            ctx.moveTo(cx, cy - gap); ctx.lineTo(cx + gap, cy);
            ctx.lineTo(cx, cy + gap); ctx.lineTo(cx - gap, cy);
            ctx.closePath(); ctx.stroke();
        } else {
            // ── BODY HIT: standard white X ───────────────────────
            const size = 8, gap = 4;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx - gap, cy - gap); ctx.lineTo(cx - gap - size, cy - gap - size);
            ctx.moveTo(cx + gap, cy - gap); ctx.lineTo(cx + gap + size, cy - gap - size);
            ctx.moveTo(cx - gap, cy + gap); ctx.lineTo(cx - gap - size, cy + gap + size);
            ctx.moveTo(cx + gap, cy + gap); ctx.lineTo(cx + gap + size, cy + gap + size);
            ctx.stroke();
        }
        ctx.restore();
    }
}

function getZombies() { return ents.filter(e => e.active && (e.t === 'z' || e.t === 'sz' || e.t === 'bz')); }
function advanceSpectate() {
    const zs = getZombies();
    if (!zs.length) { spectateIdx = -1; return; }
    spectateIdx = (spectateIdx + 1) % zs.length;
    const t = zs[spectateIdx];
    document.getElementById('spectate-target-name').textContent =
        `${t.t === 'sz' ? 'Sgt.' : 'Zombie'} #${spectateIdx + 1}  HP:${Math.ceil(t.hp)}`;
}
document.getElementById('spec-next-btn').addEventListener('click', () => { if (ADMIN.spectate) advanceSpectate(); });


// ============================================================
// MAP — 64×64 Tactical Killhouse
// ============================================================
const MAP_SZ = 64;
const wMap = []; const hMap = [];
for (let i = 0; i < MAP_SZ; i++) {
    wMap[i] = new Array(MAP_SZ).fill(0);
    hMap[i] = new Array(MAP_SZ).fill(0);
}

function bW(x, y, w, h, t, z = 2.0) {
    for (let i = x; i < x + w; i++)
        for (let j = y; j < y + h; j++)
            if (i >= 0 && i < MAP_SZ && j >= 0 && j < MAP_SZ) {
                wMap[i][j] = t; hMap[i][j] = t > 0 ? z : 0;
            }
}

function genRegularMap() {
    for (let x = 0; x < MAP_SZ; x++)
        for (let y = 0; y < MAP_SZ; y++) { wMap[x][y] = 0; hMap[x][y] = 0; }

    // === BORDER ===
    bW(0,0,MAP_SZ,1,1,3.0); bW(0,MAP_SZ-1,MAP_SZ,1,1,3.0);
    bW(0,0,1,MAP_SZ,1,3.0); bW(MAP_SZ-1,0,1,MAP_SZ,1,3.0);

    // =============================================
    // SYMMETRICAL TACTICAL ARENA
    // =============================================
    
    // 4 Corner Outposts (Symmetrical)
    const corners = [[5,5],[47,5],[5,49],[47,49]];
    corners.forEach(([cx,cy], i) => {
        bW(cx, cy, 12, 10, 1, 2.8); // Base structure
        bW(cx+2, cy+2, 8, 6, 0);    // Hollow interior
        // Doors facing center (cut 2 units deep for 2-unit thick walls)
        if (cx < 32 && cy < 32) { bW(cx+10, cy+4, 2, 2, 0); bW(cx+4, cy+8, 2, 2, 0); } // NW
        if (cx > 32 && cy < 32) { bW(cx, cy+4, 2, 2, 0); bW(cx+4, cy+8, 2, 2, 0); }    // NE
        if (cx < 32 && cy > 32) { bW(cx+10, cy+4, 2, 2, 0); bW(cx+4, cy, 2, 2, 0); }    // SW
        if (cx > 32 && cy > 32) { bW(cx, cy+4, 2, 2, 0); bW(cx+4, cy, 2, 2, 0); }       // SE
        // Corner crates
        bW(cx+13, cy+1, 2, 2, 8, 0.9);
        bW(cx+1, cy+11, 2, 2, 8, 0.9);
    });

    // Central Shop Enclosure (Reworked)
    const mid = 31;
    bW(mid-2, mid-2, 5, 5, 1, 2.5); // Outer Box
    bW(mid-1, mid-1, 3, 3, 0);       // Hollow Center
    
    // Entrances on every side
    bW(mid, mid-2, 1, 2, 0); // North
    bW(mid, mid+1, 1, 2, 0); // South
    bW(mid-2, mid, 2, 1, 0); // West
    bW(mid+1, mid, 2, 1, 0); // East

    // 4 Corner Pillars (Tactical cover in the plaza)
    bW(mid-4, mid-4, 1, 1, 1, 0.9);
    bW(mid+4, mid-4, 1, 1, 1, 0.9);
    bW(mid-4, mid+4, 1, 1, 1, 0.9);
    bW(mid+4, mid+4, 1, 1, 1, 0.9);

    // Flanking Barriers (L-shapes between bases)
    // North Mid
    bW(26, 8, 12, 1, 1, 1.4); bW(31, 2, 1, 5, 1, 1.4); // Shifted to not block main road
    // South Mid
    bW(26, 55, 12, 1, 1, 1.4); bW(31, 56, 1, 5, 1, 1.4);
    // West Mid
    bW(2, 31, 5, 1, 1, 1.4); bW(8, 26, 1, 12, 1, 1.4);
    // East Mid
    bW(56, 31, 5, 1, 1, 1.4); bW(55, 26, 1, 12, 1, 1.4);

    // Scatter Crate Clusters (Filling "Empty" spots)
    const clusters = [[18,18],[44,18],[18,44],[44,44],[31,12],[31,50],[12,31],[50,31]];
    clusters.forEach(([x,y]) => {
        bW(x, y, 2, 2, 8, 0.9);
        // Add a step for high crates
        bW(x+2, y, 1, 1, 8, 0.4); 
    });

    // Final Bulldoze: Ensure clean main avenues (Symmetry roads)
    for (let i = 0; i < MAP_SZ; i++) {
        // Broaden center road slightly
        if (i < 27 || i > 35) {
            bW(31, i, 1, 1, 0); 
            bW(i, 31, 1, 1, 0);
        }
    }
    
    // Random Debris (Filling empty spaces with small cover)
    for (let i = 0; i < 60; i++) {
        const rx = 2 + Math.floor(Math.random() * (MAP_SZ - 4));
        const ry = 2 + Math.floor(Math.random() * (MAP_SZ - 4));
        // Skip central roads and spawn area
        if (Math.abs(rx - 31) < 5 || Math.abs(ry - 31) < 5) continue;
        if (wMap[rx] && wMap[rx][ry] === 0) {
            const h = 0.15 + Math.random() * 0.7; // Random heights (0.15 to 0.85)
            const type = Math.random() > 0.4 ? 1 : 8; // 60% concrete, 40% wood crates
            bW(rx, ry, 1, 1, type, h);
        }
    }

    // Specific clear spot for Crow at 33,33
    bW(33, 33, 1, 1, 0); 
}
genRegularMap();






function canMove(nx, ny, r, pZ) {
    if (nx < r || nx >= MAP_SZ - r || ny < r || ny >= MAP_SZ - r) return false;
    const checks = [
        [Math.floor(nx + r), Math.floor(ny + r)],
        [Math.floor(nx - r), Math.floor(ny - r)],
        [Math.floor(nx + r), Math.floor(ny - r)],
        [Math.floor(nx - r), Math.floor(ny + r)],
        [Math.floor(nx), Math.floor(ny)]
    ];
    for (const [cx, cy] of checks) {
        if (cx < 0 || cx >= MAP_SZ || cy < 0 || cy >= MAP_SZ) return false;
        const wh = hMap[cx][cy];
        // ALLOW STEP-UP: If the wall is low enough relative to current feet position
        const pFeet = pZ - 0.5;
        const stepLimit = 0.15; // Realistic step height (prevents phasing)
        if (wMap[cx][cy] > 0 && wh > 0) {
            if (wh > pFeet + stepLimit) return false;
        }
    }
    return true;
}


// ============================================================
// 3D GUN RENDERER
// ============================================================
function mkBlock(w, h, d, c1, c2, c3) {
    return {
        center: { x: 0, y: 0, z: 0 }, w, h, d,
        faces: [
            { pts: [{ x: -w, y: -h, z: -d }, { x: w, y: -h, z: -d }, { x: w, y: h, z: -d }, { x: -w, y: h, z: -d }], c: c1 },
            { pts: [{ x: w, y: -h, z: d }, { x: -w, y: -h, z: d }, { x: -w, y: h, z: d }, { x: w, y: h, z: d }], c: c1 },
            { pts: [{ x: -w, y: -h, z: -d }, { x: -w, y: -h, z: d }, { x: w, y: -h, z: d }, { x: w, y: -h, z: -d }], c: c2 },
            { pts: [{ x: -w, y: h, z: d }, { x: -w, y: h, z: -d }, { x: w, y: h, z: -d }, { x: w, y: h, z: d }], c: c3 },
            { pts: [{ x: w, y: -h, z: -d }, { x: w, y: -h, z: d }, { x: w, y: h, z: d }, { x: w, y: h, z: -d }], c: c2 },
            { pts: [{ x: -w, y: -h, z: d }, { x: -w, y: -h, z: -d }, { x: -w, y: h, z: -d }, { x: -w, y: h, z: d }], c: c3 }
        ]
    };
}

class Gun3D {
    constructor() { this.blocks = []; }
    addBlock(cx, cy, cz, w, h, d, c1, c2, c3) {
        const b = mkBlock(w, h, d, c1, c2, c3);
        b.center = { x: cx, y: cy, z: cz };
        this.blocks.push(b);
    }
    draw(c, offX, offY, offZ, rX, rY, rZ, pit) {
        const faces = [];
        for (const obj of this.blocks) {
            for (const f of obj.faces) {
                const pts = []; let avgZ = 0;
                const cosX = Math.cos(rX), sinX = Math.sin(rX);
                const cosY = Math.cos(rY), sinY = Math.sin(rY);
                const cosZ = Math.cos(rZ), sinZ = Math.sin(rZ);
                for (const pt of f.pts) {
                    let px = pt.x + obj.center.x, py = pt.y + obj.center.y, pz = pt.z + obj.center.z;
                    let ty = cosX * py - sinX * pz, tz = sinX * py + cosX * pz;
                    let tx2 = cosY * px + sinY * tz, tz2 = -sinY * px + cosY * tz;
                    let fx = cosZ * tx2 - sinZ * ty, fy = sinZ * tx2 + cosZ * ty;
                    let fz = tz2;
                    fx += offX; fy += offY; fz += offZ;
                    pts.push({ x: fx, y: fy, z: fz }); avgZ += fz;
                }
                const nx = (pts[1].y - pts[0].y) * (pts[2].z - pts[0].z) - (pts[1].z - pts[0].z) * (pts[2].y - pts[0].y);
                const nz = (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[1].y - pts[0].y) * (pts[2].x - pts[0].x);
                if (pts[0].x * nx + pts[0].z * nz < 0) {
                    faces.push({ pts, c: f.c, avgZ: avgZ / 4, nx, nz });
                }
            }
        }
        faces.sort((a, b) => b.avgZ - a.avgZ);
        for (const f of faces) {
            let fillColor = f.c;
            if (ADMIN.chams) {
                fillColor = hexToRgba(ADMIN.chamsColor, ADMIN.chamsAlpha);
            } else {
                const noise = (Math.sin(f.avgZ * 1000) * 5); 
                if (f.c.startsWith('#')) {
                    const r = parseInt(f.c.slice(1,3),16), g = parseInt(f.c.slice(3,5),16), b = parseInt(f.c.slice(5,7),16);
                    const br = 1.0 + (f.nx * 0.2) + (f.nz * 0.1); 
                    fillColor = `rgb(${Math.min(255, r*br+noise)},${Math.min(255, g*br+noise)},${Math.min(255, b*br+noise)})`;
                }
            }
            c.fillStyle = fillColor; c.beginPath();
            let ok = true;
            for (let i = 0; i < f.pts.length; i++) {
                const p = f.pts[i];
                if (p.z < 0.08) { ok = false; break; }
                const sx = scrW / 2 + (p.x / p.z) * scrH;
                const sy = scrH / 2 + (p.y / p.z) * scrH + pit;
                if (i === 0) c.moveTo(sx, sy); else c.lineTo(sx, sy);
            }
            if (ok) { 
                c.closePath(); c.fill(); 
                if (!ADMIN.chams) {
                    c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 0.5; c.stroke();
                    if (f.nx > 0.002) { c.fillStyle = 'rgba(255,255,255,0.05)'; c.fill(); }
                } else {
                    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.8; c.stroke();
                }
            }
        }
    }
}

// Global Hand Models (Minecraft Steve style)
const rightHandMdl = new Gun3D();
rightHandMdl.addBlock(0, 0, 0, 0.06, 0.06, 0.12, '#d2b48c', '#a67d5e', '#8b6448');

const leftHandMdl = new Gun3D();
leftHandMdl.addBlock(0, 0, 0, 0.06, 0.06, 0.12, '#d2b48c', '#a67d5e', '#8b6448');

// ── Gun Models ───────────────────────────────────────────────
const mAR = new Gun3D();
mAR.addBlock(0, 0, 0, 0.024, 0.052, 0.18, '#1c1c1c', '#222', '#111'); // Upper
mAR.addBlock(0, 0.04, 0.04, 0.022, 0.042, 0.18, '#1a1a1a', '#222', '#0d0d0d'); // Lower
mAR.addBlock(0, 0.02, 0.28, 0.028, 0.028, 0.22, '#151515', '#222', '#0a0a0a'); // Handguard
mAR.addBlock(0, 0.02, 0.52, 0.008, 0.008, 0.18, '#0a0a0a', '#111', '#050505'); // Barrel
mAR.addBlock(0, 0.18, -0.04, 0.018, 0.10, 0.045, '#1a1a1a', '#222', '#0d0d0d'); // Grip
mAR.addBlock(0, 0.05, -0.22, 0.02, 0.08, 0.14, '#1c1c1c', '#252525', '#111'); // Stock
mAR.addBlock(0, 0.14, 0.10, 0.016, 0.12, 0.05, '#111', '#1a1a1a', '#0a0a0a'); // Mag
mAR.addBlock(0, -0.07, 0.10, 0.018, 0.014, 0.06, '#111', '#1a1a1a', '#0a0a0a'); // Sight base
mAR.addBlock(0, -0.09, 0.60, 0.004, 0.012, 0.004, '#cc0000', '#ff0000', '#aa0000'); // Front sight tip

const mGl = new Gun3D(); // Glock 17
mGl.addBlock(0, 0, 0, 0.024, 0.035, 0.14, '#1c1c1c', '#222', '#111'); // Slide
mGl.addBlock(0, 0.10, 0, 0.022, 0.08, 0.045, '#151515', '#1a1a1a', '#0d0d0d'); // Frame/Grip
mGl.addBlock(0, -0.04, 0.12, 0.005, 0.010, 0.005, '#eee', '#fff', '#ccc'); // Front Sight
mGl.addBlock(0, -0.04, -0.02, 0.005, 0.010, 0.005, '#eee', '#fff', '#ccc'); // Rear Sight

const mRev = new Gun3D(); // Revolver
mRev.addBlock(0, 0, 0, 0.028, 0.040, 0.06, '#333', '#444', '#222'); // Cylinder
mRev.addBlock(0, 0.01, 0.15, 0.016, 0.020, 0.16, '#2a2a2a', '#3a3a3a', '#1a1a1a'); // Barrel
mRev.addBlock(0, 0.02, -0.04, 0.025, 0.035, 0.06, '#333', '#444', '#222'); // Frame
mRev.addBlock(0, 0.14, -0.08, 0.020, 0.090, 0.045, '#5a3010', '#7a4820', '#3a1c08'); // Wood Grip
mRev.addBlock(0, -0.04, 0.25, 0.005, 0.010, 0.005, '#ccc', '#eee', '#aaa'); // Sight
mRev.addBlock(0, -0.02, -0.06, 0.008, 0.02, 0.008, '#111', '#222', '#0a0a0a'); // Hammer

const mM5 = new Gun3D(); // MP5
mM5.addBlock(0, 0, 0, 0.03, 0.05, 0.28, '#1c1c1c', '#222', '#111'); // Receiver
mM5.addBlock(0, 0.02, 0.20, 0.032, 0.032, 0.12, '#151515', '#222', '#0d0d0d'); // Handguard
mM5.addBlock(0, 0.02, 0.35, 0.01, 0.01, 0.10, '#0a0a0a', '#111', '#050505'); // Barrel
mM5.addBlock(0, 0.18, -0.02, 0.018, 0.10, 0.04, '#1a1a1a', '#222', '#0d0d0d'); // Navy Grip
mM5.addBlock(0, 0.16, 0.10, 0.015, 0.14, 0.05, '#111', '#1a1a1a', '#0a0a0a'); // Curved Mag
mM5.addBlock(0, 0.05, -0.18, 0.022, 0.08, 0.05, '#1c1c1c', '#222', '#111'); // Fixed Stock
mM5.addBlock(0, -0.07, 0.10, 0.018, 0.014, 0.04, '#cc0000', '#ff0000', '#aa0000'); // Red dot sight

const mAK = new Gun3D();
mAK.addBlock(0, 0, 0, 0.032, 0.048, 0.28, '#1e1e1e', '#2a2a2a', '#161616'); // Receiver
mAK.addBlock(0, 0.01, 0.32, 0.035, 0.035, 0.14, '#5a3010', '#7a4820', '#3a1c08'); // Handguard
mAK.addBlock(0, 0.01, 0.50, 0.008, 0.008, 0.18, '#111', '#181818', '#0a0a0a'); // Barrel
mAK.addBlock(0, 0.20, 0.14, 0.018, 0.14, 0.06, '#111', '#1a1a1a', '#0a0a0a'); // Curved Mag
mAK.addBlock(0, 0.18, -0.05, 0.018, 0.08, 0.04, '#151515', '#222', '#0a0a0a'); // Grip
mAK.addBlock(0, 0.05, -0.28, 0.022, 0.10, 0.18, '#5a3010', '#7a4820', '#3a1c08'); // Wood Stock
mAK.addBlock(0, -0.06, 0.60, 0.004, 0.012, 0.004, '#111', '#111', '#050505'); // Iron sight

const mR7 = new Gun3D(); // R700 Sniper
mR7.addBlock(0, 0, 0, 0.022, 0.042, 0.38, '#2a3838', '#3c5050', '#1c2828'); // Body
mR7.addBlock(0, 0.02, 0.45, 0.012, 0.012, 0.35, '#0a0a0a', '#111', '#050505'); // Long Barrel
mR7.addBlock(0, 0.12, -0.18, 0.018, 0.12, 0.06, '#5a3010', '#7a4820', '#3a1c08'); // Stock comb
mR7.addBlock(0, 0.06, -0.32, 0.028, 0.028, 0.18, '#5a3010', '#7a4820', '#3a1c08'); // Full Stock
mR7.addBlock(0, -0.08, 0.10, 0.024, 0.024, 0.36, '#0a0a0a', '#111', '#050505'); // Sniper Scope
mR7.addBlock(0, -0.08, 0.42, 0.030, 0.030, 0.05, '#000', '#111', '#000'); // Objective lens

const mS12 = new Gun3D(); // Spas-12
mS12.addBlock(0, 0, 0, 0.028, 0.050, 0.35, '#1a1a1a', '#222', '#0d0d0d'); // Receiver
mS12.addBlock(0, 0.02, 0.45, 0.016, 0.016, 0.32, '#111', '#181818', '#0a0a0a'); // Barrel
mS12.addBlock(0, 0.03, 0.18, 0.032, 0.035, 0.20, '#2a2a2a', '#333', '#1c1c1c'); // Ribbed Pump
mS12.addBlock(0, 0.18, -0.05, 0.020, 0.090, 0.04, '#151515', '#1a1a1a', '#0a0a0a'); // Pistol grip
mS12.addBlock(0, -0.08, -0.15, 0.014, 0.014, 0.32, '#1e1e1e', '#2a2a2a', '#111'); // Folding Stock
mS12.addBlock(0, -0.04, 0.55, 0.005, 0.010, 0.005, '#111', '#222', '#0a0a0a'); // Bead sight

const mM4A = new Gun3D(); // M4A1 Sopmod
mM4A.addBlock(0, 0, 0, 0.024, 0.050, 0.20, '#1c1c1c', '#222', '#111'); // Receiver
mM4A.addBlock(0, 0.02, 0.28, 0.032, 0.032, 0.18, '#151515', '#222', '#0a0a0a'); // Rail system
mM4A.addBlock(0, 0.02, 0.52, 0.010, 0.010, 0.20, '#0a0a0a', '#111', '#050505'); // Barrel
mM4A.addBlock(0, 0.18, -0.06, 0.018, 0.10, 0.04, '#1a1a1a', '#222', '#0d0d0d'); // Grip
mM4A.addBlock(0, 0.04, -0.25, 0.022, 0.09, 0.16, '#1c1c1c', '#252525', '#111'); // Crane stock
mM4A.addBlock(0, 0.18, 0.12, 0.018, 0.14, 0.06, '#111', '#1a1a1a', '#0a0a0a'); // Mag
// Holo Sight
mM4A.addBlock(0, -0.07, 0.08, 0.024, 0.020, 0.08, '#111', '#1a1a1a', '#0a0a0a'); // EOTech base
mM4A.addBlock(0, -0.12, 0.14, 0.02, 0.03, 0.002, 'rgba(50, 255, 50, 0.2)', 'rgba(50, 255, 50, 0.2)', 'rgba(50, 255, 50, 0.2)'); // Green glass
mM4A.addBlock(0, -0.15, 0.08, 0.024, 0.005, 0.08, '#111', '#1a1a1a', '#0a0a0a'); // Top lid
mM4A.addBlock(0.02, -0.11, 0.08, 0.005, 0.04, 0.08, '#111', '#1a1a1a', '#0a0a0a'); // Side L
mM4A.addBlock(-0.02, -0.11, 0.08, 0.005, 0.04, 0.08, '#111', '#1a1a1a', '#0a0a0a'); // Side R

const m110 = new Gun3D(); // M110 SASS
m110.addBlock(0, 0, 0, 0.024, 0.048, 0.38, '#3a3a32', '#4a4a3e', '#2a2a22'); // Tan body
m110.addBlock(0, 0.02, 0.52, 0.022, 0.022, 0.28, '#111', '#1a1a1a', '#0a0a0a'); // Suppressor
m110.addBlock(0, 0.16, -0.18, 0.02, 0.11, 0.06, '#2a2a22', '#3a3a2a', '#1a1a1a'); // Precision stock
m110.addBlock(0, 0.18, 0.12, 0.02, 0.12, 0.08, '#3a3a32', '#4a4a3e', '#2a2a22'); // 7.62 Mag
// High Power Scope
m110.addBlock(0, -0.08, 0.05, 0.022, 0.022, 0.32, '#111', '#1a1a1a', '#0a0a0a'); // Scope tube
m110.addBlock(0, -0.08, 0.36, 0.028, 0.028, 0.04, '#0a0a0a', '#111', '#050505'); // Objective lens
m110.addBlock(0, -0.12, 0.12, 0.008, 0.012, 0.008, '#111', '#1a1a1a', '#0a0a0a'); // Turret
// Bipod legs (folded)
m110.addBlock(0.025, 0.06, 0.35, 0.005, 0.005, 0.25, '#111', '#1a1a1a', '#0a0a0a');
m110.addBlock(-0.025, 0.06, 0.35, 0.005, 0.005, 0.25, '#111', '#1a1a1a', '#0a0a0a');

const mVAL = new Gun3D(); // AS-VAL
mVAL.addBlock(0, 0, 0, 0.03, 0.048, 0.20, '#2a2a2a', '#333', '#1a1a1a'); // Receiver
mVAL.addBlock(0, 0.015, 0.32, 0.028, 0.028, 0.38, '#111', '#1a1a1a', '#0a0a0a'); // Integrated Suppressor
mVAL.addBlock(0, 0.15, 0.08, 0.018, 0.12, 0.05, '#3a2010', '#4a2a15', '#2a1505'); // Orange Mag
mVAL.addBlock(0, 0.15, -0.05, 0.018, 0.09, 0.04, '#151515', '#1a1a1a', '#0a0a0a'); // Grip
mVAL.addBlock(0, 0.04, -0.25, 0.025, 0.10, 0.18, '#2a2a2a', '#333', '#1a1a1a'); // Skeleton Stock

const mUzi = new Gun3D(); // Uzi
mUzi.addBlock(0, 0, 0, 0.028, 0.045, 0.18, '#1e1e1e', '#222', '#111'); // Receiver
mUzi.addBlock(0, 0.01, 0.15, 0.01, 0.01, 0.10, '#111', '#1a1a1a', '#0a0a0a'); // Barrel
mUzi.addBlock(0, 0.16, -0.02, 0.02, 0.14, 0.045, '#151515', '#1a1a1a', '#0d0d0d'); // Grip/Mag
mUzi.addBlock(0, 0.04, 0.10, 0.035, 0.035, 0.08, '#2a2a2a', '#333', '#1c1c1c'); // Handguard
mUzi.addBlock(0, 0.10, -0.15, 0.01, 0.01, 0.20, '#111', '#1a1a1a', '#0a0a0a'); // Wire Stock (folded)

const mM82 = new Gun3D(); // Barrett .50
mM82.addBlock(0, 0, 0, 0.028, 0.052, 0.42, '#2a2a2a', '#333', '#1a1a1a'); // Body
mM82.addBlock(0, 0.015, 0.50, 0.014, 0.014, 0.45, '#111', '#1a1a1a', '#0a0a0a'); // Heavy Barrel
mM82.addBlock(0, 0.015, 0.95, 0.025, 0.030, 0.08, '#1a1a1a', '#222', '#111'); // Arrow Muzzle Brake
mM82.addBlock(0, 0.18, 0.10, 0.022, 0.14, 0.10, '#222', '#2a2a2a', '#111'); // Box Mag
mM82.addBlock(0, 0.18, -0.10, 0.020, 0.10, 0.045, '#151515', '#222', '#0a0a0a'); // Grip
mM82.addBlock(0, 0.06, -0.32, 0.022, 0.08, 0.18, '#222', '#2a2a2a', '#111'); // Monopod Stock
mM82.addBlock(0, -0.10, 0.15, 0.025, 0.025, 0.35, '#0a0a0a', '#111', '#050505'); // Massive Scope

const mM249 = new Gun3D(); // M249 Saw
mM249.addBlock(0, 0, 0, 0.040, 0.060, 0.32, '#222', '#2a2a2a', '#111'); // Receiver
mM249.addBlock(0, 0.02, 0.42, 0.018, 0.018, 0.28, '#111', '#1a1a1a', '#0a0a0a'); // Barrel
mM249.addBlock(0, 0.02, 0.22, 0.045, 0.045, 0.18, '#1e1e1e', '#2a2a2a', '#111'); // Heat Shield
mM249.addBlock(0, 0.15, 0.15, 0.038, 0.045, 0.12, '#2a4a28', '#3a5a38', '#1a2a18'); // Ammo Box (Green)
mM249.addBlock(0, 0.18, -0.05, 0.022, 0.10, 0.04, '#151515', '#222', '#0a0a0a'); // Grip
mM249.addBlock(0, 0.08, -0.30, 0.030, 0.11, 0.20, '#1c1c1c', '#252525', '#111'); // Skeleton Stock
mM249.addBlock(0, -0.08, 0.05, 0.008, 0.015, 0.12, '#111', '#1a1a1a', '#0a0a0a'); // Top Carry Handle
mM249.addBlock(0, -0.06, 0.40, 0.005, 0.01, 0.005, '#888', '#aaa', '#666'); // Front Sight
mM249.addBlock(0, -0.05, -0.05, 0.01, 0.015, 0.01, '#111', '#1a1a1a', '#0a0a0a'); // Rear Sight

const mSKS = new Gun3D(); // SKS
mSKS.addBlock(0, 0, 0, 0.03, 0.04, 0.35, '#1e1e1e', '#2a2a2a', '#161616'); // Receiver
mSKS.addBlock(0, 0.02, 0.45, 0.025, 0.025, 0.25, '#5a3010', '#7a4820', '#3a1c08'); // Wood Handguard
mSKS.addBlock(0, 0.01, 0.70, 0.008, 0.008, 0.20, '#111', '#181818', '#0a0a0a'); // Barrel
mSKS.addBlock(0, 0.15, 0.10, 0.015, 0.08, 0.06, '#111', '#1a1a1a', '#0a0a0a'); // Internal Mag
mSKS.addBlock(0, 0.16, -0.05, 0.020, 0.08, 0.05, '#5a3010', '#7a4820', '#3a1c08'); // Wood Grip
mSKS.addBlock(0, 0.06, -0.32, 0.022, 0.08, 0.22, '#5a3010', '#7a4820', '#3a1c08'); // Wood Stock
mSKS.addBlock(0, -0.05, 0.85, 0.004, 0.012, 0.004, '#111', '#111', '#050505'); // Iron sight

const mSCAR = new Gun3D(); // SCAR-H
mSCAR.addBlock(0, 0, 0, 0.035, 0.06, 0.35, '#8b7355', '#a08560', '#705c44'); // Tan Upper
mSCAR.addBlock(0, 0.05, 0.05, 0.03, 0.05, 0.20, '#6b5740', '#7d674f', '#564735'); // Tan Lower
mSCAR.addBlock(0, 0.02, 0.50, 0.009, 0.009, 0.18, '#111', '#181818', '#0a0a0a'); // Barrel
mSCAR.addBlock(0, 0.20, 0.12, 0.02, 0.14, 0.08, '#1c1c1c', '#222', '#111'); // Box Mag
mSCAR.addBlock(0, 0.18, -0.05, 0.018, 0.10, 0.045, '#1a1a1a', '#222', '#0d0d0d'); // Grip
mSCAR.addBlock(0, 0.05, -0.28, 0.025, 0.09, 0.20, '#8b7355', '#a08560', '#705c44'); // Stock
mSCAR.addBlock(0, -0.08, 0.10, 0.018, 0.014, 0.05, '#111', '#1a1a1a', '#0a0a0a'); // Sight base
mSCAR.addBlock(0, -0.09, 0.10, 0.006, 0.006, 0.006, '#cc0000', '#ff0000', '#aa0000'); // Red dot

const mAWM = new Gun3D(); // AWM
mAWM.addBlock(0, 0, 0, 0.03, 0.05, 0.35, '#4b5320', '#5c6628', '#3a4018'); // OD Green Chassis
mAWM.addBlock(0, -0.02, 0.45, 0.012, 0.012, 0.40, '#111', '#1a1a1a', '#0a0a0a'); // Heavy Barrel
mAWM.addBlock(0, 0.15, 0.15, 0.02, 0.10, 0.08, '#1c1c1c', '#222', '#111'); // Mag
mAWM.addBlock(0, 0.18, -0.05, 0.018, 0.08, 0.05, '#111', '#1a1a1a', '#0a0a0a'); // Grip
mAWM.addBlock(0, 0.05, -0.30, 0.025, 0.10, 0.25, '#4b5320', '#5c6628', '#3a4018'); // Stock with thumbhole
mAWM.addBlock(0, -0.07, 0.10, 0.02, 0.02, 0.18, '#111', '#1a1a1a', '#0a0a0a'); // Scope Body

const mSVD = new Gun3D(); // SVD Dragunov Sniper
mSVD.addBlock(0, 0, 0, 0.024, 0.045, 0.40, '#2a2a2a', '#333', '#1c1c1c'); // Receiver (Dark Grey)
mSVD.addBlock(0, 0.01, 0.22, 0.032, 0.038, 0.16, '#7c3f12', '#8f4f1d', '#5c2d0b'); // Wooden Handguard (Reddish-wood)
mSVD.addBlock(0, 0.015, 0.58, 0.010, 0.010, 0.35, '#111', '#1a1a1a', '#0a0a0a'); // Slender Barrel
mSVD.addBlock(0, 0.015, 0.94, 0.014, 0.016, 0.06, '#222', '#2a2a2a', '#111'); // Flash Hider / Front Sight
mSVD.addBlock(0, 0.16, 0.12, 0.02, 0.08, 0.06, '#222', '#2a2a2a', '#111'); // Short 10rd Mag
mSVD.addBlock(0, 0.18, -0.06, 0.018, 0.09, 0.04, '#151515', '#222', '#0a0a0a'); // Pistol Grip
mSVD.addBlock(0, 0.05, -0.28, 0.024, 0.08, 0.20, '#7c3f12', '#8f4f1d', '#5c2d0b'); // Wooden Thumbhole Stock
mSVD.addBlock(0, 0.12, -0.18, 0.012, 0.012, 0.14, '#7c3f12', '#8f4f1d', '#5c2d0b'); // Stock lower connect brace
mSVD.addBlock(-0.015, -0.07, 0.08, 0.02, 0.02, 0.28, '#2a2a2a', '#3a3a3a', '#1a1a1a'); // Scope Body
mSVD.addBlock(-0.015, -0.07, 0.36, 0.024, 0.024, 0.03, '#111', '#1a1a1a', '#0a0a0a'); // Lens

const mPKM = new Gun3D(); // PKM LMG
mPKM.addBlock(0, 0, 0, 0.038, 0.055, 0.38, '#222', '#2d2d2d', '#151515'); // Heavy Receiver
mPKM.addBlock(0, 0.02, 0.54, 0.016, 0.016, 0.32, '#111', '#1a1a1a', '#0a0a0a'); // Long Heavy Barrel
mPKM.addBlock(0, 0.02, 0.88, 0.024, 0.028, 0.06, '#222', '#2a2a2a', '#111'); // Cylindrical Flash Hider
mPKM.addBlock(0, 0.15, 0.16, 0.045, 0.055, 0.14, '#785028', '#8f6333', '#5c3d1b'); // Wooden/Brown Ammo Box
mPKM.addBlock(0, 0.18, -0.06, 0.020, 0.09, 0.04, '#151515', '#222', '#0a0a0a'); // Pistol Grip
mPKM.addBlock(0, 0.08, -0.32, 0.028, 0.10, 0.22, '#7c3f12', '#8f4f1d', '#5c2d0b'); // Wooden Skeleton Stock
mPKM.addBlock(0, -0.08, 0.20, 0.008, 0.016, 0.10, '#111', '#1a1a1a', '#0a0a0a'); // Carry Handle (Folded)
mPKM.addBlock(0.02, 0.06, 0.55, 0.006, 0.006, 0.24, '#1a1a1a', '#222', '#111'); // Bipod L
mPKM.addBlock(-0.02, 0.06, 0.55, 0.006, 0.006, 0.24, '#1a1a1a', '#222', '#111'); // Bipod R

const mGrn = new Gun3D();
mGrn.addBlock(0, 0, 0, 0.04, 0.06, 0.04, '#2d4c2d', '#3a5a3a', '#1e301e');
mGrn.addBlock(0, -0.06, 0, 0.01, 0.01, 0.01, '#888', '#aaa', '#666'); // Pin

// Pre-built muzzle flash model (3 overlapping rotated star arms)
const mFlash = new Gun3D();
mFlash.addBlock(0,  0,    0, 0.008, 0.06, 0.06, 'rgba(255,220,60,0.95)', 'rgba(255,140,20,0.9)', 'rgba(255,255,120,0.9)');
mFlash.addBlock(0,  0.04, 0, 0.008, 0.06, 0.06, 'rgba(255,200,40,0.85)', 'rgba(255,100,10,0.8)', 'rgba(255,240,100,0.85)');
mFlash.addBlock(0, -0.04, 0, 0.008, 0.06, 0.06, 'rgba(255,200,40,0.85)', 'rgba(255,100,10,0.8)', 'rgba(255,240,100,0.85)');
mFlash.addBlock(0, 0, 0, 0.06, 0.008, 0.06, 'rgba(255,220,60,0.95)', 'rgba(255,140,20,0.9)', 'rgba(255,255,120,0.9)');

const mMP5 = new Gun3D(); // MP5
mMP5.addBlock(0, 0, 0, 0.025, 0.045, 0.20, '#1c1c1c', '#222', '#111'); // Receiver
mMP5.addBlock(0, 0.015, 0.25, 0.01, 0.01, 0.15, '#111', '#1a1a1a', '#0a0a0a'); // Barrel
mMP5.addBlock(0, 0.03, 0.15, 0.035, 0.040, 0.10, '#2a2a2a', '#333', '#1c1c1c'); // Tropical Handguard
mMP5.addBlock(0, 0.15, 0.02, 0.018, 0.12, 0.04, '#151515', '#1a1a1a', '#0d0d0d'); // Curved Mag
mMP5.addBlock(0, 0.18, -0.05, 0.02, 0.10, 0.04, '#151515', '#222', '#0a0a0a'); // Grip
mMP5.addBlock(0, -0.05, 0.10, 0.005, 0.015, 0.015, '#111', '#1a1a1a', '#050505'); // Iron Sight
mMP5.addBlock(0, 0.05, -0.20, 0.015, 0.08, 0.18, '#111', '#1a1a1a', '#0a0a0a'); // Fixed Stock

// ============================================================
// WEAPONS
// ============================================================
class Weapon {
    constructor(name, cost, type, dmg, hs, legArm, bSpd, bDrop, bSprd, reM,
        mag, rpm, rTm, hipX, hipY, hipZ, adsX, adsY, adsZ, model, ammoType,
        hasScope = false, spdMod = 1.0, hasHolo = false,
        reloadStyle = 'rifle', shellRTm = 600) {
        this.name = name; this.cost = cost; this.type = type;
        this.dmg = dmg; this.hs = hs; this.legArm = legArm;
        this.bSpd = bSpd; this.bDrop = bDrop; this.bSprd = bSprd;
        this.reM = reM; this.mag = mag; this.max = mag;
        this.rpm = rpm; this.rTm = rTm;
        this.ipH = { x: hipX, y: hipY, z: hipZ };
        this.ipA = { x: adsX, y: adsY, z: adsZ };
        this.mdl = model; this.ammoType = ammoType; this.hasScope = hasScope; this.spdMod = spdMod;
        this.hasHolo = hasHolo;
        this.reloadStyle = reloadStyle; // 'pistol'|'rifle'|'shotgun_tube'|'bolt'|'lmg'
        this.shellRTm = shellRTm;       // ms per shell for shotgun_tube
        /* runtime state */
        this.lf = 0; this.isR = false; this.reK = 0; this.anim = 0; this.hc = false;
        this.shellTimer = null;          // active interval ID for shell reloads
    }
}

const PVP_STATS = {
    'AR15': { dmg: 22 },
    'UZI': { dmg: 14 },
    'GLOCK 19': { dmg: 16 },
    'MP5': { dmg: 15 },
    'REVOLVER': { dmg: 30 },
    'AK47': { dmg: 25 },
    'SPAS-12': { dmg: 6 },
    'M500': { dmg: 8 },
    'M4A1': { dmg: 21 },
    'M249': { dmg: 22 },
    'R700': { dmg: 30, hs: 4.0 },
    'M110K': { dmg: 25, hs: 4.0 },
    'AS-VAL': { dmg: 18 },
    'M82A1': { dmg: 80, hs: 3.0 },
    'SVD': { dmg: 30, hs: 5.0 },
    'PKM': { dmg: 25 }
};

const AMMO_DATA = {
    '9mm': { maxStack: 100, price: 100, buyAmount: 20 },
    '44 mag': { maxStack: 75, price: 150, buyAmount: 16 },
    '.223 rem': { maxStack: 50, price: 200, buyAmount: 30 },
    '.308 win': { maxStack: 20, price: 250, buyAmount: 10 },
    '12gauge': { maxStack: 25, price: 100, buyAmount: 10 },
    '9x39 subsonic': { maxStack: 60, price: 500, buyAmount: 30 },
    '7.62x62 soviet': { maxStack: 50, price: 400, buyAmount: 30 },
    '.50 bmg': { maxStack: 10, price: 1000, buyAmount: 10 },
    '7.62x54 mmr': { maxStack: 50, price: 600, buyAmount: 30 }
};

const Arsenal = [
    new Weapon('AR15',    0,     'semi', 7.0,  2.0, 0.8, 65,  0.003,  0.021, 4.0,  20,  500,  2500, 0.20, 0.18, 0.40, 0, 0.12, 0.25, mAR,  '.223 rem',       false, 1.0, false, 'rifle'),
    new Weapon('UZI',     100,   'auto', 4.0,  1.5, 0.7, 35,  0.09,   0.050, 4.0,  32,  1200, 1800, 0.15, 0.18, 0.30, 0, 0.12, 0.20, mUzi, '9mm',            false, 1.0, false, 'pistol'),
    new Weapon('GLOCK 19',250,   'semi', 6.0,  1.9, 0.8, 45,  0.010,  0.042, 1.2,  19,  600,  1500, 0.15, 0.18, 0.35, 0, 0.10, 0.20, mGl,  '9mm',            false, 1.0, false, 'pistol'),
    new Weapon('MP5',     400,   'auto', 6.0,  2.2, 0.7, 45,  0.010,  0.050, 2.5,  30,  700,  2000, 0.18, 0.18, 0.35, 0, 0.12, 0.22, mMP5, '9mm',            false, 1.0, false, 'rifle'),
    new Weapon('REVOLVER',500,   'semi', 10.0, 2.5, 0.8, 50,  0.021,  0.060, 8.0,  6,   200,  2000, 0.15, 0.18, 0.35, 0, 0.10, 0.20, mRev, '44 mag',         false, 1.0, false, 'pistol'),
    new Weapon('M4A1',    1200,  'auto', 11.0, 2.0, 0.8, 65,  0.002,  0.035, 6.0,  30,  650,  2200, 0.20, 0.18, 0.38, 0, 0.12, 0.22, mM4A, '.223 rem',       false, 1.0, false, 'rifle'),
    new Weapon('M249',    1500,  'auto', 10.0, 2.0, 0.8, 65,  0.003,  0.045, 7.5,  150, 800,  6000, 0.22, 0.20, 0.45, 0, 0.12, 0.30, mM249,'.223 rem',       false, 0.85,false, 'lmg'),
    new Weapon('AK47',    720,   'auto', 15.0, 2.2, 0.8, 60,  0.0025, 0.063, 6.5,  30,  480,  2500, 0.22, 0.18, 0.45, 0, 0.10, 0.30, mAK,  '7.62x62 soviet', false, 1.0, false, 'rifle'),
    new Weapon('SPAS-12', 900,   'auto', 4.0,  1.3, 1.0, 45,  0.012,  0.168, 8.0,  8,   200,  3500, 0.22, 0.18, 0.45, 0, 0.10, 0.30, mS12, '12gauge',        false, 1.0, false, 'shotgun_tube', 1200),
    new Weapon('M500',    350,   'pump', 5.0,  1.3, 0.8, 50,  0.015,  0.168, 9.5,  8,   50,   4000, 0.20, 0.18, 0.50, 0, 0.08, 0.30, mM5,  '12gauge',        false, 1.0, false, 'shotgun_tube', 1200),
    new Weapon('M110K',   2200,  'semi', 8.0,  3.2, 1.0, 75,  0.001,  0.012, 8.0,  15,  620,  2800, 0.20, 0.18, 0.55, 0, 0.11, 0.45, m110, '.308 win',       false, 1.0, true,  'rifle'),
    new Weapon('AS-VAL',  5000,  'auto', 6.0,  3.0, 0.6, 30,  0.025,  0.012, 3.5,  30,  900,  2400, 0.20, 0.18, 0.40, 0, 0.12, 0.25, mVAL, '9x39 subsonic',  false, 1.0, false, 'rifle'),
    new Weapon('R700',    1000,  'bolt', 32.0, 3.5, 1.0, 80,  0.001,  0.003, 15.0, 5,   50,   3500, 0.20, 0.18, 0.50, 0, 0.07, 0.35, mR7,  '.308 win',       true,  1.0, false, 'bolt'),
    new Weapon('M82A1',   10000, 'semi', 35.0, 4.0, 1.0, 150, 0.0005, 0.001, 28.0, 10,  500,  5000, 0.20, 0.22, 0.50, 0, 0.10, 0.40, mM82, '.50 bmg',        true,  1.0, false, 'bolt'),
    new Weapon('SVD',     3000,  'semi', 15.0, 3.0, 1.0, 100, 0.005,  0.015, 9.5,  10,  620,  2800, 0.20, 0.18, 0.40, 0, 0.12, 0.25, mSVD, '7.62x54 mmr',   true,  1.0, false, 'rifle'),
    new Weapon('PKM',     99999, 'auto', 12.0, 2.5, 1.0, 1000,0.010,  0.045, 8.0,  100, 900,  5000, 0.22, 0.20, 0.45, 0, 0.12, 0.30, mPKM, '7.62x54 mmr',   false, 0.85,false, 'lmg'),
    new Weapon('SKS',     500,   'semi', 12.0, 3.0, 0.7, 60,  0.0025, 0.005, 8.0,  10,  600,  1500, 0.20, 0.18, 0.40, 0, 0.12, 0.25, mSKS, '7.62x62 soviet', false, 1.0, false, 'clip'),
    new Weapon('SCAR-H',  7500,  'auto', 20.0, 2.0, 1.0, 75,  0.002,  0.035, 7.5,  20,  670,  2500, 0.22, 0.18, 0.45, 0, 0.12, 0.25, mSCAR,'.308 win',       false, 0.95,false, 'rifle'),
    new Weapon('AWM',     6000,  'semi', 40.0, 4.5, 1.0, 150, 0.001,  0.0005,35.0, 10,  30,   3500, 0.20, 0.18, 0.50, 0, 0.07, 0.35, mAWM, '.50 bmg',        true,  0.85,false, 'bolt')
];

const Armor = [
    { name: 'Police Vest', cost: 500, mit: 0.25, dur: 75, max: 75, spdMod: 1.0, tier: 1 },
    { name: 'Military Vest', cost: 2500, mit: 0.50, dur: 150, max: 150, spdMod: 1.0, tier: 2 },
    { name: 'Plate Carrier T3', cost: 7500, mit: 0.90, dur: 500, max: 500, spdMod: 0.85, tier: 3 }
];

const Helmets = [
    { name: 'Motorcycle Helmet', cost: 700, mit: 0.25, dur: 50, max: 50, spdMod: 1.0, tier: 1 },
    { name: 'Police Helmet', cost: 3000, mit: 0.40, dur: 125, max: 125, spdMod: 1.0, tier: 2 },
    { name: 'Military Helmet', cost: 5000, mit: 0.50, dur: 200, max: 200, concRed: 0.5, spdMod: 0.95, tier: 3 },
    { name: 'Altyn Helmet', cost: 10000, mit: 0.50, dur: 600, max: 600, hasVisor: true, visorMit: 0.75, spdMod: 0.85, tier: 4 }
];


// ============================================================
// INVENTORY
// ============================================================
class ItemMedkit {
    constructor() {
        this.name = 'Medkit'; this.icon = '🩹';
        this.type = 'medkit'; this.stackable = true; this.maxStack = 2; this.amount = 1;
        this.healRate = 2; this.castTime = 5;
    }
}
class ItemLargeMedkit {
    constructor() {
        this.name = 'Large Medkit'; this.icon = '🚑';
        this.type = 'medkit'; this.stackable = false;
        this.healRate = 5; this.castTime = 7;
    }
}
class ItemRepairKit {
    constructor(isHelmet = false) {
        this.name = isHelmet ? 'Helmet Repair Kit' : 'Vest Repair Kit';
        this.icon = '🔧';
        this.type = 'repair_kit';
        this.subType = isHelmet ? 'helmet' : 'vest';
        this.stackable = false;
    }
}
class ItemGrenade {
    constructor() {
        this.name = 'M67 Grenade'; this.icon = '💣';
        this.type = 'grenade'; this.cost = 500;
        this.stackable = true; this.maxStack = 2; this.amount = 1;
    }
}
class ItemBandage {
    constructor() {
        this.name = 'Bandage'; this.icon = '🩹';
        this.type = 'bandage'; this.cost = 500;
        this.stackable = true; this.maxStack = 8; this.amount = 1;
        this.healRate = 1; this.castTime = 1;
    }
}
class ItemAmmo {
    constructor(type, amount, maxStack) {
        this.name = type + ' Ammo';
        this.icon = '🔋';
        this.type = 'ammo';
        this.ammoType = type;
        this.amount = amount;
        this.maxStack = maxStack;
        this.stackable = true;
    }
}
class ItemWeapon {
    constructor(weaponObj) {
        this.name = weaponObj.name;
        this.icon = '🔫';
        this.type = 'weapon';
        this.weapon = weaponObj;
        this.stackable = false;
    }
}
class ItemArmor {
    constructor(armorObj) {
        this.name = armorObj.name;
        this.icon = '🛡️';
        this.type = 'armor';
        this.armor = { name: armorObj.name, mit: armorObj.mit, dur: armorObj.dur, max: armorObj.max, spdMod: armorObj.spdMod, tier: armorObj.tier };
        this.stackable = false;
    }
}
class ItemHelmet {
    constructor(helmetObj) {
        this.name = helmetObj.name;
        this.icon = '🪖';
        this.type = 'helmet';
        this.helmet = { name: helmetObj.name, mit: helmetObj.mit, dur: helmetObj.dur, max: helmetObj.max, concRed: helmetObj.concRed, hasVisor: helmetObj.hasVisor, visorMit: helmetObj.visorMit, spdMod: helmetObj.spdMod, tier: helmetObj.tier };
        this.stackable = false;
    }
}
class ItemBackpackTraveler {
    constructor() {
        this.name = "Traveler's Backpack"; this.icon = '🎒';
        this.type = 'backpack'; this.slots = 8; this.cost = 3000;
        this.stackable = false;
    }
}
class ItemBackpackMilitary {
    constructor() {
        this.name = 'Military Backpack'; this.icon = '🎒';
        this.type = 'backpack'; this.slots = 15; this.cost = 5000;
        this.reqItem = 'Red Floppy Disk';
        this.stackable = false;
    }
}
class ItemBackpackDuffle {
    constructor() {
        this.name = 'Duffle Bag'; this.icon = '🎒';
        this.type = 'backpack'; this.slots = 30; this.cost = 12000;
        this.reqItem = 'Black Floppy Disk';
        this.stackable = false;
    }
}
class ItemFloppyRed {
    constructor() {
        this.name = 'Red Floppy Disk'; this.icon = '💾';
        this.type = 'floppy'; this.color = 'red';
        this.stackable = true; this.maxStack = 10; this.amount = 1;
    }
}
class ItemFloppyBlack {
    constructor() {
        this.name = 'Black Floppy Disk'; this.icon = '💾';
        this.type = 'floppy'; this.color = 'black';
        this.stackable = true; this.maxStack = 10; this.amount = 1;
    }
}

const inventoryStorage = new Array(9).fill(null); // 9-slot storage
const quickSlots = [null, null, null, null]; // Slots 2, 3, 4, 5
inventoryStorage[0] = new ItemAmmo('.223 rem', 50, 50);

function addAmmoToInventory(ammoType, amount) {
    let remaining = amount;
    const max = AMMO_DATA[ammoType].maxStack;
    for(let i=0; i<inventoryStorage.length; i++) {
        let item = inventoryStorage[i];
        if (item && item.type === 'ammo' && item.ammoType === ammoType && item.amount < max) {
            let canAdd = max - item.amount;
            if (remaining <= canAdd) {
                item.amount += remaining;
                return true;
            } else {
                item.amount += canAdd;
                remaining -= canAdd;
            }
        }
    }
    while(remaining > 0) {
        let slot = inventoryStorage.findIndex(s => s === null);
        if (slot >= 0) {
            let toAdd = Math.min(remaining, max);
            inventoryStorage[slot] = new ItemAmmo(ammoType, toAdd, max);
            remaining -= toAdd;
        } else {
            return false;
        }
    }
    return true;
}

function addToInventory(item) {
    if (item.stackable) {
        let remaining = item.amount || 1;
        for (let i = 0; i < inventoryStorage.length; i++) {
            let s = inventoryStorage[i];
            if (s && s.type === item.type && s.name === item.name && s.amount < s.maxStack) {
                let space = s.maxStack - s.amount;
                if (remaining <= space) {
                    s.amount += remaining;
                    return true;
                } else {
                    s.amount += space;
                    remaining -= space;
                }
            }
        }
        item.amount = remaining;
        if (remaining <= 0) return true;
    }
    const slot = inventoryStorage.findIndex(s => s === null);
    if (slot >= 0) { inventoryStorage[slot] = item; return true; }
    return false;
}

function openInventory() {
    if (STATE.mod === 'SHP') closeShop();
    renderInventoryUI();
    document.getElementById('inventory-overlay').classList.add('open');
    document.exitPointerLock();
    STATE.mod = 'INV';
}
function closeInventory() {
    document.getElementById('inventory-overlay').classList.remove('open');
    STATE.mod = 'PLAY';
    canvas.requestPointerLock();
}

function renderInventoryUI() {
    const w = Player.get();
    let reserve = 0;
    for (const item of inventoryStorage) {
        if (item && item.type === 'ammo' && item.ammoType === w.ammoType) {
            reserve += item.amount;
        }
    }
    
    document.getElementById('inv-weapon-label').textContent = w.name;
    document.getElementById('inv-ammo-val').textContent = `${w.mag} / ${ADMIN.infiniteAmmo ? '∞' : reserve}  [${w.type.toUpperCase()} - ${w.ammoType}]`;
    
    document.getElementById('inv-armor-label').textContent = Player.armor ? Player.armor.name : 'No Armor';
    if (Player.armor) {
        let pct = Math.max(0, (Player.armor.dur / Player.armor.max) * 100);
        let clr = pct > 50 ? '#22c55e' : (pct > 25 ? '#eab308' : '#ef4444');
        if (Player.armor.dur <= 0) clr = '#444';
        
        let durDiv = document.getElementById('inv-armor-dur');
        if (!durDiv.querySelector('#inv-armor-dur-bar')) {
            durDiv.innerHTML = `
                <div id="inv-armor-dur-text" style="font-size:10px; color:#ccc; margin-bottom:2px;"></div>
                <div style="width:100%; height:4px; background:#222;"><div id="inv-armor-dur-bar" style="width:0%; height:100%; background:#22c55e; transition: width 0.2s ease, background-color 0.2s ease;"></div></div>`;
        }
        document.getElementById('inv-armor-dur-text').textContent = `${Math.ceil(Player.armor.dur)} / ${Player.armor.max} durability`;
        document.getElementById('inv-armor-dur-bar').style.width = pct + '%';
        document.getElementById('inv-armor-dur-bar').style.background = clr;
    } else document.getElementById('inv-armor-dur').innerHTML = '—';

    document.getElementById('inv-helmet-label').textContent = Player.helmet ? Player.helmet.name : 'No Helmet';
    if (Player.helmet) {
        let pct = Math.max(0, (Player.helmet.dur / Player.helmet.max) * 100);
        let clr = pct > 50 ? '#22c55e' : (pct > 25 ? '#eab308' : '#ef4444');
        if (Player.helmet.dur <= 0) clr = '#444';
        
        let durDiv = document.getElementById('inv-helmet-dur');
        if (!durDiv.querySelector('#inv-helmet-dur-bar')) {
            durDiv.innerHTML = `
                <div id="inv-helmet-dur-text" style="font-size:10px; color:#ccc; margin-bottom:2px;"></div>
                <div style="width:100%; height:4px; background:#222;"><div id="inv-helmet-dur-bar" style="width:0%; height:100%; background:#22c55e; transition: width 0.2s ease, background-color 0.2s ease;"></div></div>`;
        }
        document.getElementById('inv-helmet-dur-text').textContent = `${Math.ceil(Player.helmet.dur)} / ${Player.helmet.max} durability`;
        document.getElementById('inv-helmet-dur-bar').style.width = pct + '%';
        document.getElementById('inv-helmet-dur-bar').style.background = clr;
    } else document.getElementById('inv-helmet-dur').innerHTML = '—';

    document.getElementById('inv-hp-val').textContent = `${Math.ceil(Player.hp)} / ${Player.maxHp}`;
    document.getElementById('inv-wave-val').textContent = STATE.wv;
    document.getElementById('inv-reload-stat-val').textContent = (ADMIN.reloadSpeed || 1.0).toFixed(1) + 'x';
    document.getElementById('inv-coins-val').textContent = '$' + STATE.mon;

    document.getElementById('inv-armor-equip').onclick = () => {
        if (STATE.repairMode) { handleRepairClick('vest'); return; }
        if (Player.armor) {
            if (addToInventory(new ItemArmor(Player.armor))) {
                notice('VEST UNEQUIPPED');
                Player.armor = null;
                if (typeof updateTierUI === 'function') updateTierUI();
                renderInventoryUI();
            } else notice('INVENTORY FULL');
        }
    };
    document.getElementById('inv-helmet-equip').onclick = () => {
        if (STATE.repairMode) { handleRepairClick('helmet'); return; }
        if (Player.helmet) {
            if (addToInventory(new ItemHelmet(Player.helmet))) {
                notice('HELMET UNEQUIPPED');
                Player.helmet = null;
                Player.visorDown = false;
                const el = document.getElementById('altyn-visor-overlay');
                if (el) el.style.display = 'none';
                if (typeof updateTierUI === 'function') updateTierUI();
                renderInventoryUI();
            } else notice('INVENTORY FULL');
        }
    };
    const bpEl = document.getElementById('inv-backpack-label');
    if (bpEl) {
        bpEl.textContent = Player.backpack ? Player.backpack.name : 'Standard Backpack';
        document.getElementById('inv-backpack-sub').textContent = `Capacity: ${inventoryStorage.length} slots`;
    }
    const bpEquipEl = document.getElementById('inv-backpack-equip');
    if (bpEquipEl) {
        bpEquipEl.onclick = () => {
            if (Player.backpack) {
                let hasExtraItems = false;
                for (let i = 9; i < inventoryStorage.length; i++) {
                    if (inventoryStorage[i] !== null) { hasExtraItems = true; break; }
                }
                if (hasExtraItems) {
                    notice('CLEAR EXTRA SLOTS BEFORE UNEQUIPPING BACKPACK');
                    return;
                }
                let freeSlot = -1;
                for (let i = 0; i < 9; i++) {
                    if (inventoryStorage[i] === null) { freeSlot = i; break; }
                }
                if (freeSlot === -1) {
                    notice('NO SPACE IN BASE STORAGE TO UNEQUIP BACKPACK');
                    return;
                }
                const oldBp = Player.backpack;
                Player.backpack = null;
                inventoryStorage.length = 9;
                inventoryStorage[freeSlot] = oldBp;
                notice('BACKPACK UNEQUIPPED');
                renderInventoryUI();
            }
        };
    }

function useQuickslot(qi) {
    if (!quickSlots[qi]) return;

    let actualItem = null;
    let actualIndex = -1;
    for (let s = 0; s < inventoryStorage.length; s++) {
        const item = inventoryStorage[s];
        if (item && item.type === quickSlots[qi].type && item.name === quickSlots[qi].name) {
            actualItem = item;
            actualIndex = s;
            break;
        }
    }

    if (!actualItem) {
        notice(`NO ${quickSlots[qi].name.toUpperCase()} IN STORAGE`);
        return;
    }

    if (actualItem.type === 'weapon') {
        const curPrimary = Player.inv[0];
        Player.inv[0] = actualItem.weapon;
        inventoryStorage[actualIndex] = new ItemWeapon(curPrimary);
        quickSlots[qi] = { type: 'weapon', name: curPrimary.name };
        Player.curW = 0;
        STATE.holdingG = false;
        updateWeaponHUD();
        renderInventoryUI();
        notice(`EQUIPPED ${actualItem.weapon.name}`);
    } else if (actualItem.type === 'medkit') {
        if (Player.hp >= Player.maxHp) return notice('ALREADY FULL HP');
        startItemUse(actualIndex, actualItem.castTime, () => {
            inventoryStorage[actualIndex] = null;
            Player.hotRate = actualItem.healRate;
            Player.hotTime = 20;
            notice('MEDKIT APPLIED');
            renderInventoryUI();
        }, actualItem.icon);
    } else if (actualItem.type === 'bandage') {
        if (Player.hp >= Player.maxHp) return notice('ALREADY FULL HP');
        startItemUse(actualIndex, actualItem.castTime, () => {
            if (inventoryStorage[actualIndex] && inventoryStorage[actualIndex].amount > 1) {
                inventoryStorage[actualIndex].amount--;
            } else {
                inventoryStorage[actualIndex] = null;
            }
            Player.hotRate = actualItem.healRate;
            Player.hotTime = 10;
            notice('BANDAGE APPLIED');
            renderInventoryUI();
        }, actualItem.icon);
    } else if (actualItem.type === 'grenade') {
        STATE.holdingG = !STATE.holdingG;
        notice(STATE.holdingG ? 'GRENADE EQUIPPED' : 'GRENADE STOWED');
    } else if (actualItem.type === 'armor') {
        const oldArmor = Player.armor;
        Player.armor = { name: actualItem.armor.name, mit: actualItem.armor.mit, dur: actualItem.armor.dur, max: actualItem.armor.max, spdMod: actualItem.armor.spdMod, tier: actualItem.armor.tier };
        if (oldArmor) {
            inventoryStorage[actualIndex] = new ItemArmor(oldArmor);
            notice(`SWAPPED VEST FOR ${actualItem.armor.name}`);
        } else {
            inventoryStorage[actualIndex] = null;
            notice(`${actualItem.armor.name} EQUIPPED`);
        }
        if (typeof updateTierUI === 'function') updateTierUI();
        renderInventoryUI();
    } else if (actualItem.type === 'helmet') {
        const oldHelmet = Player.helmet;
        Player.helmet = { name: actualItem.helmet.name, mit: actualItem.helmet.mit, dur: actualItem.helmet.dur, max: actualItem.helmet.max, concRed: actualItem.helmet.concRed, hasVisor: actualItem.helmet.hasVisor, visorMit: actualItem.helmet.visorMit, spdMod: actualItem.helmet.spdMod, tier: actualItem.helmet.tier };
        if (oldHelmet) {
            inventoryStorage[actualIndex] = new ItemHelmet(oldHelmet);
            notice(`SWAPPED HELMET FOR ${actualItem.helmet.name}`);
        } else {
            inventoryStorage[actualIndex] = null;
            notice(`${actualItem.helmet.name} EQUIPPED`);
        }
        Player.visorDown = false;
        const el = document.getElementById('altyn-visor-overlay');
        if (el) el.style.display = 'none';
        if (typeof updateTierUI === 'function') updateTierUI();
        renderInventoryUI();
    } else {
        notice('CANNOT USE THIS ITEM FROM QUICKSLOT');
    }
}

    const storageEl = document.getElementById('inv-storage');
    storageEl.innerHTML = '';
    storageEl.ondragover = (e) => e.preventDefault();
    storageEl.ondrop = (e) => {
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.from === 'quickslot') {
                quickSlots[data.index] = null;
                notice('QUICKSLOT UNASSIGNED');
                renderInventoryUI();
            }
        } catch(err){}
    };
    for (let i = 0; i < inventoryStorage.length; i++) {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        slot.dataset.index = i;
        const item = inventoryStorage[i];
        if (item) {
            slot.classList.add('has-item');
            slot.draggable = true;
            slot.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ from: 'storage', index: i }));
            };
            if (item.stackable) {
                slot.innerHTML = `<span class="slot-icon">${item.icon}</span><span class="slot-name">${item.name}</span><div style="position:absolute;bottom:2px;right:4px;font-size:10px;font-weight:bold;color:#ccc;">${item.amount}</div>`;
                slot.title = `${item.name}\nAmount: ${item.amount} / ${item.maxStack}\nDrag to Quickslot (2-5)`;
            } else {
                slot.innerHTML = `<span class="slot-icon">${item.icon}</span><span class="slot-name">${item.name}</span>`;
                slot.title = `${item.name}\nRight-click to use/drop\nDrag to Quickslot (2-5)`;
            }
            if (STATE.usingItemIndex === i) {
                slot.style.filter = 'grayscale(1) blur(2px)';
                slot.style.pointerEvents = 'none';
            }
            slot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showInventoryContextMenu(e.clientX, e.clientY, item, i);
            });
        }
        storageEl.appendChild(slot);
    }

    const hotbarEl = document.getElementById('inv-hotbar');
    hotbarEl.innerHTML = '';

    const slot1 = document.createElement('div');
    slot1.className = 'inv-slot active-slot';
    const wp = Player.inv[0];
    if (wp) {
        slot1.classList.add('has-item');
        slot1.innerHTML = `<span class="slot-icon">🔫</span><span class="slot-name">${wp.name}</span><div style="position:absolute;top:2px;left:4px;font-size:10px;font-weight:bold;color:#22c55e;">[1]</div>`;
        slot1.title = `${wp.name}\nPrimary Weapon (1)`;
        slot1.addEventListener('click', () => {
            Player.curW = 0; updateWeaponHUD(); renderInventoryUI();
        });
    } else {
        slot1.innerHTML = `<div style="position:absolute;top:2px;left:4px;font-size:10px;font-weight:bold;color:#777;">[1]</div>`;
    }
    hotbarEl.appendChild(slot1);

    for (let i = 0; i < 4; i++) {
        const qi = i;
        const qSlot = document.createElement('div');
        qSlot.className = 'inv-slot';
        qSlot.dataset.qindex = qi;
        const qItem = quickSlots[qi];

        qSlot.ondragover = (e) => e.preventDefault();
        qSlot.ondrop = (e) => {
            e.preventDefault();
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.from === 'storage') {
                    const stItem = inventoryStorage[data.index];
                    if (stItem) {
                        quickSlots[qi] = { type: stItem.type, name: stItem.name };
                        renderInventoryUI();
                    }
                } else if (data.from === 'quickslot') {
                    const temp = quickSlots[qi];
                    quickSlots[qi] = quickSlots[data.index];
                    quickSlots[data.index] = temp;
                    renderInventoryUI();
                }
            } catch(err){}
        };

        let actualItem = null;
        let actualIndex = -1;
        if (qItem) {
            for (let s = 0; s < inventoryStorage.length; s++) {
                const item = inventoryStorage[s];
                if (item && item.type === qItem.type && item.name === qItem.name) {
                    actualItem = item;
                    actualIndex = s;
                    break;
                }
            }
        }

        if (actualItem) {
            qSlot.classList.add('has-item');
            qSlot.draggable = true;
            qSlot.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ from: 'quickslot', index: qi }));
            };
            if (actualItem.stackable) {
                qSlot.innerHTML = `<span class="slot-icon">${actualItem.icon}</span><span class="slot-name">${actualItem.name}</span><div style="position:absolute;bottom:2px;right:4px;font-size:10px;font-weight:bold;color:#ccc;">${actualItem.amount}</div><div style="position:absolute;top:2px;left:4px;font-size:10px;font-weight:bold;color:#22c55e;">[${qi + 2}]</div>`;
                qSlot.title = `${actualItem.name}\nAmount: ${actualItem.amount} / ${actualItem.maxStack}\nHotkey: [${qi + 2}]\nClick or press [${qi+2}] to use\nRight-click to unassign`;
            } else {
                qSlot.innerHTML = `<span class="slot-icon">${actualItem.icon}</span><span class="slot-name">${actualItem.name}</span><div style="position:absolute;top:2px;left:4px;font-size:10px;font-weight:bold;color:#22c55e;">[${qi + 2}]</div>`;
                qSlot.title = `${actualItem.name}\nHotkey: [${qi + 2}]\nClick or press [${qi+2}] to use\nRight-click to unassign`;
            }
            qSlot.addEventListener('click', () => {
                useQuickslot(qi);
            });
            qSlot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                quickSlots[qi] = null;
                notice('QUICKSLOT UNASSIGNED');
                renderInventoryUI();
            });
        } else if (qItem) {
            qSlot.innerHTML = `<span class="slot-name" style="color:#777;font-size:10px;text-align:center;width:100%;margin-top:14px;">${qItem.name}<br>(0)</span><div style="position:absolute;top:2px;left:4px;font-size:10px;font-weight:bold;color:#777;">[${qi + 2}]</div>`;
            qSlot.title = `${qItem.name} (None in storage)\nRight-click to unassign`;
            qSlot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                quickSlots[qi] = null;
                notice('QUICKSLOT UNASSIGNED');
                renderInventoryUI();
            });
        } else {
            qSlot.innerHTML = `<div style="position:absolute;top:2px;left:4px;font-size:10px;font-weight:bold;color:#777;">[${qi + 2}]</div>`;
        }
        hotbarEl.appendChild(qSlot);
    }

    drawInventoryPlayerModel();
}

function handleRepairClick(type) {
    if (!STATE.repairMode || STATE.repairType !== type) return;
    const target = type === 'vest' ? Player.armor : Player.helmet;
    if (!target) return notice(`NO ${type.toUpperCase()} EQUIPPED`);
    if (target.dur >= target.max) return notice('ALREADY FULL DURABILITY');
    
    STATE.repairMode = false;
    document.body.style.cursor = 'default';
    startItemUse(STATE.repairIndex, 2, () => {
        target.dur = Math.min(target.max, target.dur + (target.max * 0.25));
        inventoryStorage[STATE.repairIndex] = null;
        notice(`${type.toUpperCase()} REPAIRED`);
        renderInventoryUI();
    }, '🔧');
}

let useItemTimer = null;
let useItemInterval = null;

function showInventoryContextMenu(x, y, item, index) {
    const menu = document.getElementById('inv-context-menu');
    menu.style.display = 'flex';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    document.getElementById('ctx-btn-use').onclick = () => {
        menu.style.display = 'none';
        useItem(index);
    };
    document.getElementById('ctx-btn-drop').onclick = () => {
        menu.style.display = 'none';
        inventoryStorage[index] = null;
        notice(item.name.toUpperCase() + ' DROPPED');
        renderInventoryUI();
    };
}
document.addEventListener('click', (e) => {
    const m = document.getElementById('inv-context-menu');
    if (m && e.target !== m && !m.contains(e.target)) m.style.display = 'none';
});

function useItem(index) {
    const item = inventoryStorage[index];
    if (!item) return;

    if (item.type === 'medkit') {
        if (Player.hp >= Player.maxHp) return notice('ALREADY FULL HP');
        startItemUse(index, item.castTime, () => {
            inventoryStorage[index] = null;
            Player.hotRate = item.healRate;
            Player.hotTime = 20;
            notice('MEDKIT APPLIED');
            renderInventoryUI();
        }, item.icon);
    } else if (item.type === 'bandage') {
        if (Player.hp >= Player.maxHp) return notice('ALREADY FULL HP');
        startItemUse(index, item.castTime, () => {
            if (inventoryStorage[index] && inventoryStorage[index].amount > 1) {
                inventoryStorage[index].amount--;
            } else {
                inventoryStorage[index] = null;
            }
            Player.hotRate = item.healRate;
            Player.hotTime = 10;
            notice('BANDAGE APPLIED');
            renderInventoryUI();
        }, item.icon);
    } else if (item.type === 'repair_kit') {
        STATE.repairMode = true;
        STATE.repairType = item.subType;
        STATE.repairIndex = index;
        document.body.style.cursor = 'crosshair';
        notice('CLICK ARMOR TO REPAIR');
    } else if (item.type === 'weapon') {
        if (Player.inv.length < 1) {
            Player.inv.push(item.weapon);
            Player.curW = 0;
            inventoryStorage[index] = null;
            notice(`${item.weapon.name} EQUIPPED`);
        } else {
            const curWp = Player.inv[0];
            Player.inv[0] = item.weapon;
            Player.curW = 0;
            inventoryStorage[index] = new ItemWeapon(curWp);
            notice(`SWAPPED ${curWp.name} FOR ${item.weapon.name}`);
        }
        updateWeaponHUD();
        renderInventoryUI();
    } else if (item.type === 'armor') {
        const oldArmor = Player.armor;
        Player.armor = { name: item.armor.name, mit: item.armor.mit, dur: item.armor.dur, max: item.armor.max, spdMod: item.armor.spdMod, tier: item.armor.tier };
        if (oldArmor) {
            inventoryStorage[index] = new ItemArmor(oldArmor);
            notice(`SWAPPED VEST FOR ${item.armor.name}`);
        } else {
            inventoryStorage[index] = null;
            notice(`${item.armor.name} EQUIPPED`);
        }
        if (typeof updateTierUI === 'function') updateTierUI();
        renderInventoryUI();
    } else if (item.type === 'helmet') {
        const oldHelmet = Player.helmet;
        Player.helmet = { name: item.helmet.name, mit: item.helmet.mit, dur: item.helmet.dur, max: item.helmet.max, concRed: item.helmet.concRed, hasVisor: item.helmet.hasVisor, visorMit: item.helmet.visorMit, spdMod: item.helmet.spdMod, tier: item.helmet.tier };
        if (oldHelmet) {
            inventoryStorage[index] = new ItemHelmet(oldHelmet);
            notice(`SWAPPED HELMET FOR ${item.helmet.name}`);
        } else {
            inventoryStorage[index] = null;
            notice(`${item.helmet.name} EQUIPPED`);
        }
        Player.visorDown = false;
        const el = document.getElementById('altyn-visor-overlay');
        if (el) el.style.display = 'none';
        if (typeof updateTierUI === 'function') updateTierUI();
        renderInventoryUI();
    } else if (item.type === 'backpack') {
        const extraSlots = item.slots;
        const targetSize = 9 + extraSlots;
        if (inventoryStorage.length >= targetSize) {
            notice('BETTER OR SAME BACKPACK ALREADY EQUIPPED');
            return;
        }
        while (inventoryStorage.length < targetSize) {
            inventoryStorage.push(null);
        }
        const oldBp = Player.backpack;
        Player.backpack = item;
        if (oldBp) {
            inventoryStorage[index] = oldBp;
            notice(`SWAPPED BACKPACK FOR ${item.name}`);
        } else {
            inventoryStorage[index] = null;
            notice(item.name.toUpperCase() + ' EQUIPPED');
        }
        renderInventoryUI();
    } else if (item.type === 'potion') { // fallback
        Player.hp = Math.min(Player.maxHp, Player.hp + item.healAmount);
        document.getElementById('hp-bar').style.width = Player.hp + '%';
        inventoryStorage[index] = null;
        notice(`+${item.healAmount} HP`);
        renderInventoryUI();
    }
}

function startItemUse(index, time, callback, icon) {
    if (useItemTimer) return;
    STATE.usingItemIndex = index;
    Player.useSlow = 0.1;
    
    document.getElementById('use-item-overlay').style.display = 'block';
    document.getElementById('use-item-icon').textContent = icon;
    const progress = document.getElementById('use-item-progress');
    
    let elapsed = 0;
    progress.style.strokeDashoffset = 163;
    renderInventoryUI();

    useItemInterval = setInterval(() => {
        elapsed += 0.1;
        progress.style.strokeDashoffset = 163 - (163 * (elapsed / time));
        if (elapsed >= time) {
            finishItemUse(callback);
        }
    }, 100);
}

function finishItemUse(callback) {
    clearInterval(useItemInterval);
    useItemTimer = null;
    useItemInterval = null;
    STATE.usingItemIndex = -1;
    Player.useSlow = 1.0;
    document.getElementById('use-item-overlay').style.display = 'none';
    if (callback) callback();
}

function cancelItemUse() {
    if (useItemInterval) {
        clearInterval(useItemInterval);
        useItemTimer = null;
        useItemInterval = null;
        STATE.repairMode = false;
        document.body.style.cursor = 'default';
        STATE.usingItemIndex = -1;
        Player.useSlow = 1.0;
        document.getElementById('use-item-overlay').style.display = 'none';
        notice('ACTION CANCELLED');
        renderInventoryUI();
    }
}

function drawInventoryPlayerModel() {
    const pc = document.getElementById('inv-player-canvas');
    const pCtx = pc.getContext('2d');
    const pw = pc.width, ph = pc.height;
    pCtx.clearRect(0, 0, pw, ph);

    // Background
    pCtx.fillStyle = '#1a2030';
    pCtx.fillRect(0, 0, pw, ph);
    // Grid lines (Minecraft style)
    pCtx.strokeStyle = 'rgba(255,255,255,0.04)';
    pCtx.lineWidth = 1;
    for (let x = 0; x < pw; x += 16) { pCtx.beginPath(); pCtx.moveTo(x, 0); pCtx.lineTo(x, ph); pCtx.stroke(); }
    for (let y = 0; y < ph; y += 16) { pCtx.beginPath(); pCtx.moveTo(0, y); pCtx.lineTo(pw, y); pCtx.stroke(); }

    const cx = pw / 2;
    const hs = Math.floor(pw * 0.26); // head size
    const bw = Math.floor(pw * 0.30); // body width
    const bh = Math.floor(ph * 0.26); // body height
    const aw = Math.floor(pw * 0.10); // arm width
    const ah = Math.floor(ph * 0.24); // arm height
    const lw = Math.floor(pw * 0.14); // leg width
    const lh = Math.floor(ph * 0.28); // leg height

    const hx = cx - hs / 2, hy = Math.floor(ph * 0.04);
    const bx = cx - bw / 2, by = hy + hs + 2;
    const ay = by + 2;
    const ly = by + bh + 2;

    // Shadow
    pCtx.fillStyle = 'rgba(0,0,0,0.35)';
    pCtx.beginPath(); pCtx.ellipse(cx, ph - 6, bw * 0.7, 6, 0, 0, Math.PI * 2); pCtx.fill();

    // Legs
    const legColor = Player.armor ? '#233a6a' : '#2a3a5a';
    pCtx.fillStyle = legColor;
    pCtx.fillRect(bx, ly, lw, lh);
    pCtx.fillRect(bx + bw - lw, ly, lw, lh);
    // Boot
    pCtx.fillStyle = '#111';
    pCtx.fillRect(bx, ly + lh - 7, lw + 2, 7);
    pCtx.fillRect(bx + bw - lw, ly + lh - 7, lw + 2, 7);

    // Body/torso
    const shirtColor = Player.armor ? '#294a9a' : '#2d6a4f';
    pCtx.fillStyle = shirtColor;
    pCtx.fillRect(bx, by, bw, bh);
    // Shirt detail lines
    pCtx.fillStyle = 'rgba(0,0,0,0.2)';
    pCtx.fillRect(bx, by + Math.floor(bh * 0.33), bw, 2);
    pCtx.fillRect(bx, by + Math.floor(bh * 0.66), bw, 2);

    // Arms
    pCtx.fillStyle = shirtColor;
    pCtx.fillRect(bx - aw - 1, ay, aw, ah);
    pCtx.fillRect(bx + bw + 1, ay, aw, ah);

    // Hands
    pCtx.fillStyle = '#c8a07a';
    pCtx.fillRect(bx - aw - 1, ay + ah - aw, aw, aw);
    pCtx.fillRect(bx + bw + 1, ay + ah - aw, aw, aw);

    // Armor plate overlay
    if (Player.armor) {
        pCtx.fillStyle = Player.armor.tier === 3 ? '#3c4a3e' : '#2d3340';
        pCtx.fillRect(bx+2, by+2, bw-4, bh-4); // Main plate
        pCtx.fillStyle = '#111'; // Straps
        pCtx.fillRect(bx+4, by, 4, 2);
        pCtx.fillRect(bx+bw-8, by, 4, 2);
    }

    // Head
    pCtx.fillStyle = '#c8a07a';
    pCtx.fillRect(hx, hy, hs, hs);
    // Hair
    pCtx.fillStyle = '#2a1808';
    pCtx.fillRect(hx, hy, hs, Math.floor(hs * 0.28));
    // Eyes
    pCtx.fillStyle = '#1a1a3a';
    pCtx.fillRect(hx + Math.floor(hs * 0.18), hy + Math.floor(hs * 0.42), Math.floor(hs * 0.20), Math.floor(hs * 0.18));
    pCtx.fillRect(hx + Math.floor(hs * 0.62), hy + Math.floor(hs * 0.42), Math.floor(hs * 0.20), Math.floor(hs * 0.18));
    // Eye shine
    pCtx.fillStyle = '#fff';
    pCtx.fillRect(hx + Math.floor(hs * 0.22), hy + Math.floor(hs * 0.44), 3, 3);
    pCtx.fillRect(hx + Math.floor(hs * 0.66), hy + Math.floor(hs * 0.44), 3, 3);
    // Mouth
    pCtx.fillStyle = '#8a4040';
    pCtx.fillRect(hx + Math.floor(hs * 0.32), hy + Math.floor(hs * 0.68), Math.floor(hs * 0.36), Math.floor(hs * 0.08));

    // Helmet
    if (Player.helmet) {
        pCtx.fillStyle = Player.helmet.tier === 3 ? '#4b5320' : (Player.helmet.tier === 4 ? '#2d3330' : '#111');
        pCtx.fillRect(hx-2, hy-4, hs+4, hs*0.6); // Helmet dome
        pCtx.fillRect(hx-3, hy + hs*0.3, hs+6, 4); // Helmet rim
        
        if (Player.helmet.hasVisor) {
            pCtx.fillStyle = Player.visorDown ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.2)';
            if (Player.visorDown) {
                pCtx.fillRect(hx-1, hy + hs*0.4, hs+2, hs*0.5); // Visor down
                pCtx.fillStyle = 'rgba(255,255,255,0.1)';
                pCtx.fillRect(hx, hy + hs*0.45, hs, 2); // reflection
            } else {
                pCtx.fillRect(hx-1, hy - hs*0.1, hs+2, hs*0.3); // Visor up
            }
        }
    }

    // Equipped weapon (mini gun icon area)
    const wp = Player.get();
    pCtx.fillStyle = '#333';
    pCtx.fillRect(bx + bw + 1, ay + ah * 0.55, aw + 14, 4);
    pCtx.fillStyle = '#555';
    pCtx.fillRect(bx + bw + 1, ay + ah * 0.55 + 4, aw + 8, 3);
}


// ============================================================
// PLAYER
// ============================================================
const Player = {
    x: 8.5, y: 8.5, z: 0.5,
    dx: 1, dy: 0, px: 0, py: 0.66,
    sp: 2.4, hp: 100, maxHp: 100, r: 0.25,
    armor: null, helmet: null, backpack: null, visorDown: false, stm: 100,
    inv: [Arsenal[0]], curW: 0,
    get() { return this.inv[this.curW]; },
    takeDmg(amount, durLoss = 15, type = 'zombie', isHeadshot = false, hsMult = 2.0, isGrenade = false, ammoType = null, ownerId = null) {
        if (ADMIN.godmode) return;
        let actual;

        let penMult = 1.0;
        let actualDurLoss = durLoss;
        if (ammoType === '.50 bmg') { penMult = 0.5; actualDurLoss = 75; }
        else if (ammoType === '.308 win') { penMult = 0.75; }
        else if (ammoType === '7.62x54 mmr' || ammoType === '7.62x62 soviet') { penMult = 0.65; }

        let concMult = 1.0;
        if (Player.helmet) {
            if (Player.visorDown) concMult = 0.0;
            else if (Player.helmet.concRed) concMult -= Player.helmet.concRed;
        }

        if (isHeadshot) {
            actual = amount * hsMult;
            if (Player.helmet) {
                const mit = Player.visorDown ? Player.helmet.visorMit : Player.helmet.mit;
                if (Player.helmet.dur > 0) actual *= (1 - mit * penMult);
                Player.helmet.dur -= actualDurLoss;
                if (Player.helmet.dur <= 0) {
                    Player.helmet.dur = 0;
                    Player.visorDown = false;
                    const el = document.getElementById('altyn-visor-overlay');
                    if(el) el.style.display = 'none';
                }
            }
        } else {
            // Body shots: mitigate normally through armor
            actual = amount;
            if (Player.armor) {
                if (Player.armor.dur > 0) {
                    const mit = isGrenade ? (Player.armor.mit * 0.5) : (Player.armor.mit * penMult);
                    actual *= (1 - mit);
                }
                Player.armor.dur -= isGrenade ? 100 : actualDurLoss;
                if (Player.armor.dur <= 0) Player.armor.dur = 0;
            }
        }
        Player.hp -= actual;
        document.getElementById('hp-bar').style.width = Math.max(0, Player.hp) + '%';
        document.getElementById('hitflash').style.opacity = 1;
        setTimeout(() => document.getElementById('hitflash').style.opacity = 0, 100);

        Player.hotTime = 0;
        if (typeof cancelItemUse === 'function') cancelItemUse();

        // Flinch & Effects
        if (type === 'zombie') {
            triggerFlinch(150);
        } else if (type === 'bullet') {
            if (isHeadshot) {
                triggerFlinch(500);
                if (concMult > 0) {
                    STATE.concussEnd = performance.now() + 1500 * concMult;
                    notice('💥 HEADSHOT CONCUSSION!', false);
                } else {
                    notice('🛡️ VISOR BLOCKED CONCUSSION', false);
                }
            } else {
                triggerFlinch(250);
            }
        }
        
        if (typeof updateTierUI === 'function') updateTierUI();

        // Kill streak breaks on taking damage
        if (STATE.killStreak > 0) {
            STATE.killStreak = 0;
            STATE.killStreakTimer = 0;
            const ksEl = document.getElementById('hud-killstreak');
            if (ksEl) ksEl.style.display = 'none';
        }

        if (Player.hp <= 0) {
            if (STATE.mode === 'SURVIVAL') {
                if (typeof STORAGE !== 'undefined') {
                    STORAGE.data.deaths++;
                    STORAGE.save();
                }
                STATE.mod = 'DEAD';
                document.exitPointerLock();
                document.getElementById('death-overlay').style.display = 'flex';
            } else if (STATE.mode === 'PVP') {
                // Send kill message if killed by player
                let killMsg;
                if (ownerId && ownerId !== 'player') {
                    killMsg = { type: 'kill', killerId: ownerId, killer: ownerId.substring(0,6).toUpperCase(), victimId: STATE.myId, victim: STATE.myId.substring(0,6).toUpperCase() };
                } else {
                    killMsg = { type: 'kill', killerId: STATE.myId, killer: 'ENVIRONMENT', victimId: STATE.myId, victim: STATE.myId.substring(0,6).toUpperCase() };
                }
                NET.send(killMsg);
                NET.handleMessage(STATE.myId, killMsg); // Process locally
                
                // Respawn Logic
                STATE.mod = 'DEAD';
                notice('YOU DIED. RESPAWNING IN 3 SECONDS...', true);
                setTimeout(() => {
                    if (!isRunning) return;
                    Player.hp = Player.maxHp;
                    document.getElementById('hp-bar').style.width = '100%';
                    // Find a spawn point
                    let spawnPlaced = false;
                    for(let i = 0; i < 50; i++) {
                        const rx = Math.floor(Math.random() * (MAP_SZ - 2)) + 1;
                        const ry = Math.floor(Math.random() * (MAP_SZ - 2)) + 1;
                        if(wMap[rx][ry] === 0) {
                            Player.x = rx + 0.5; Player.y = ry + 0.5;
                            spawnPlaced = true; break;
                        }
                    }
                    if(!spawnPlaced) { Player.x = 2; Player.y = 2; }
                    STATE.mod = 'PLAY';
                    notice('RESPAWNED!', false);
                }, 3000);
            }
        }
    }
};

function triggerFlinch(intensity) {
    STATE.flinchV = intensity;
}

function updateTierUI() {
    const el = document.getElementById('armor-tier-box');
    if (el) {
        let maxTier = 0;
        if (Player.armor) maxTier = Math.max(maxTier, Player.armor.tier || 0);
        if (Player.helmet) maxTier = Math.max(maxTier, Player.helmet.tier || 0);
        
        if (maxTier > 0) {
            el.style.display = 'block';
            el.textContent = 'Tier ' + maxTier + 'x';
        } else {
            el.style.display = 'none';
        }
    }

    const vRow = document.getElementById('hud-vest-row');
    const vBar = document.getElementById('vest-bar');
    if (vRow && vBar) {
        if (Player.armor) {
            vRow.style.display = 'flex';
            const pct = Math.max(0, (Player.armor.dur / Player.armor.max) * 100);
            vBar.style.width = pct + '%';
        } else {
            vRow.style.display = 'none';
        }
    }

    const hRow = document.getElementById('hud-helmet-row');
    const hBar = document.getElementById('helmet-bar');
    if (hRow && hBar) {
        if (Player.helmet) {
            hRow.style.display = 'flex';
            const pct = Math.max(0, (Player.helmet.dur / Player.helmet.max) * 100);
            hBar.style.width = pct + '%';
        } else {
            hRow.style.display = 'none';
        }
    }
}

function respawn() {
    Player.hp = 100;
    Player.armor = null;
    Player.x = 31.5; Player.y = 28.5;  // Clear plaza spawn area
    Player.z = 0.5;
    STATE.mon = Math.max(0, STATE.mon - 1000); // Small penalty
    STATE.mod = 'PLAY';
    document.getElementById('death-overlay').style.display = 'none';
    document.getElementById('hp-bar').style.width = '100%';
    Player.helmet = null;
    Player.visorDown = false;
    const vo = document.getElementById('altyn-visor-overlay');
    if (vo) vo.style.display = 'none';
    if (typeof updateTierUI === 'function') updateTierUI();
    canvas.requestPointerLock();
}
document.getElementById('respawn-btn').addEventListener('click', respawn);


// ============================================================
// GAME STATE
// ============================================================
const STATE = {
    zBuf: new Float64Array(scrW),
    wv: 1, mon: 0,
    mod: 'MENU',    // MENU | PLAY | SHP | INV | DEAD
    dt: 0, last: 0, pit: 0,
    flinchY: 0, flinchV: 0,
    fMult: 1.0, fTarg: 1.0,
    isADS: false, isJ: false, jV: 0,
    concussEnd: 0,   // timestamp when concussion wears off
    isH: false,      // flag for manual mouse unlock
    mode: 'SURVIVAL', // SURVIVAL | PVP
    sensitivity: 1.0,
    scores: {},      // { id: { kills, deaths, name } }
    isHost: false,
    pvpTimer: 600,   // 10 minutes (600s)
    holdingG: false, // Grenade holding state
    chargingGrenade: false, // Whether player is currently holding down throw key
    grenadeChargeStart: 0, // Time when player started charging throw
    shake: 0,        // Camera shake intensity
    recAcc: 0,       // Recoil accumulated for recovery
    killStreak: 0,   // Current kill streak
    killStreakTimer: 0, // Seconds until killstreak resets
    waveCountdownEnd: 0  // timestamp when next wave spawns (for HUD countdown)
};
let isRunning = true, loopId;
const fpsArr = [];

// ============================================================
// NETWORKING (PeerJS – P2P)
// ============================================================
let peer = null;
let conn = null; // Client's single connection to host
let conns = [];  // Host's list of connections to clients
let remotePlayers = {};

const NET = {
    init() {
        if (typeof Peer === 'undefined') {
            notice('CRITICAL: PeerJS library failed to load.');
            return;
        }
        // Destroy existing peer cleanly before creating a new one
        if (peer && !peer.destroyed) peer.destroy();
        peer = null; conn = null; conns = [];

        // Generate short 6-char alphanumeric room code
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const peerId = STATE.isHost ? 'BOD-' + roomCode : undefined;

        peer = new Peer(peerId, {
            debug: 0,
            config: { iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]}
        });

        peer.on('open', id => {
            STATE.myId = id;
            if (STATE.isHost) {
                // Extract just the code part after 'BOD-'
                const code = id.replace('BOD-', '');
                STATE.joinCode = code;
                const lobbyCodeEl = document.getElementById('lobby-join-code-disp');
                if (lobbyCodeEl) {
                    lobbyCodeEl.style.fontSize = '20px';
                    lobbyCodeEl.style.letterSpacing = '4px';
                    lobbyCodeEl.textContent = code;
                }
                const hostPanelCodeEl = document.getElementById('host-join-code');
                if (hostPanelCodeEl) {
                    hostPanelCodeEl.textContent = code;
                }
                notice('ROOM READY — CODE: ' + code);
            }
        });

        peer.on('connection', c => {
            if (!STATE.isHost) { c.close(); return; }
            this._setupConn(c);
            conns.push(c);
            notice('PLAYER JOINED');
        });

        peer.on('error', err => {
            console.error('PeerJS error:', err);
            if (err.type === 'peer-unavailable') {
                notice('ROOM NOT FOUND — CHECK THE CODE');
            } else if (err.type === 'network') {
                notice('NET ERROR: NO INTERNET FOR PEERJS');
            } else {
                notice('NET ERROR: ' + err.type);
            }
        });
    },

    _setupConn(c) {
        c.on('open', () => {
            if (!STATE.isHost) {
                notice('CONNECTED!');
                startMatch();
            }
        });
        c.on('data', data => this.handleMessage(c.peer, data));
        c.on('close', () => {
            delete remotePlayers[c.peer];
            if (STATE.isHost) {
                conns = conns.filter(x => x.peer !== c.peer);
                notice('PLAYER DISCONNECTED');
            } else {
                notice('LOST CONNECTION TO HOST');
                isRunning = false;
                document.getElementById('menu-overlay').style.display = 'flex';
            }
        });
        c.on('error', err => notice('CONN ERROR: ' + err));
    },

    connect(code) {
        if (!peer) { notice('NET NOT READY'); return; }
        if (conn) conn.close();
        // Hosts use 'BOD-' prefix as their PeerJS ID
        const targetId = 'BOD-' + code.toUpperCase();
        notice('CONNECTING TO ' + code.toUpperCase() + '...');
        conn = peer.connect(targetId, { reliable: true });
        this._setupConn(conn);
        setTimeout(() => {
            if (!conn.open) notice('TIMEOUT — CHECK CODE OR INTERNET');
        }, 8000);
    },

    send(data) {
        const payload = JSON.stringify(data);
        if (STATE.isHost) {
            conns.forEach(c => { if (c.open) c.send(data); });
        } else if (conn && conn.open) {
            conn.send(data);
        }
    },

    handleMessage(id, data) {
        if (data.type === 'state') {
            remotePlayers[id] = data.state;
            if (STATE.isHost) {
                conns.forEach(c => { if (c.peer !== id && c.open) c.send(data); });
            }
        } else if (data.type === 'bullet') {
            const b = data.bullet;
            bullets.push(new Bullet(b.x, b.y, b.z, b.vx, b.vy, b.vz, b.w, data.ownerId || 'remote'));
            if (STATE.isHost) {
                conns.forEach(c => { if (c.peer !== id && c.open) c.send(data); });
            }
        } else if (data.type === 'kill') {
            addKillFeedMessage(data.killer, data.victim);
            if (!STATE.scores[data.killerId]) STATE.scores[data.killerId] = { kills: 0, deaths: 0, name: data.killer };
            if (!STATE.scores[data.victimId]) STATE.scores[data.victimId] = { kills: 0, deaths: 0, name: data.victim };
            STATE.scores[data.killerId].kills++;
            STATE.scores[data.victimId].deaths++;
            updateScoreboard();
            if (STATE.isHost) {
                conns.forEach(c => { if (c.peer !== id && c.open) c.send(data); });
            }
        } else if (data.type === 'hit') {
            if (data.targetId === STATE.myId) {
                Player.takeDmg(data.dmg, 15, 'bullet', data.isHS, 1.0, false, null, data.shooter);
            } else if (STATE.isHost) {
                conns.forEach(c => { if (c.peer !== id && c.open) c.send(data); });
            }
        }
    },

    sync() {
        if (!peer || (!STATE.isHost && (!conn || !conn.open))) return;
        const state = {
            x: Player.x, y: Player.y, z: Player.z,
            dx: Player.dx, dy: Player.dy, px: Player.px, py: Player.py,
            hp: Player.hp, curW: Player.curW, isADS: STATE.isADS,
            isJ: STATE.isJ, anim: Player.get().anim
        };
        this.send({ type: 'state', state });
    }
};

// ===================== UPDATER STATUS =====================

if (window.electronAPI && window.electronAPI.updater) {
    const upStatus = document.getElementById('menu-updater-status');
    if (upStatus) {
        window.electronAPI.updater.onStatus((status) => {
            upStatus.textContent = status;
        });
        window.electronAPI.updater.onProgress((percent) => {
            upStatus.textContent = `Downloading update: ${Math.round(percent)}%`;
        });
    }
}



function updateDiscoveryUI() {
    const list = document.getElementById('discovery-list');
    if (!list) return;
    list.innerHTML = '';
    
    const entries = Object.values(discoveredServers);
    if (entries.length === 0) {
        list.innerHTML = '<div style="font-size:9px; color:#444;">Scanning for local worlds...</div>';
        return;
    }

    entries.forEach(s => {
        const row = document.createElement('div');
        row.style.background = 'rgba(255,255,255,0.05)';
        row.style.padding = '6px';
        row.style.borderRadius = '3px';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.cursor = 'pointer';
        row.style.transition = '0.2s';
        row.onmouseover = () => row.style.background = 'rgba(59,130,246,0.2)';
        row.onmouseout = () => row.style.background = 'rgba(255,255,255,0.05)';
        
        row.innerHTML = `
            <div style="text-align:left;">
                <div style="font-size:10px; font-weight:700; color:#fff;">${s.name}</div>
                <div style="font-size:8px; color:#666;">${s.ip}</div>
            </div>
            <div style="font-family:var(--font-mono); font-size:10px; font-weight:800; color:#60a5fa;">LAN SERVER</div>
        `;
        
        row.onclick = () => {
            document.getElementById('lobby-join-input').value = s.ip;
            document.getElementById('lobby-join-btn').click();
        };
        
        list.appendChild(row);
    });
}


// ============================================================
// ENTITIES & BULLETS
// ============================================================
let ents = [], bullets = [], aimTarg = null, lastRenderEnts = [];

class Entity {
    constructor(x, y, t) {
        this.x = x; this.y = y; this.t = t;
        this.active = true; this.ssX = 0; this.sh = 0;
        this.vT = false; this.los = false; this.d = 0;
        this.atk = 0; this.stun = 0; // Stun timer
        this.armor = null; this.lastHit = 0;
        switch (t) {
            case 'z':
                this.max = 50 + 5 * (STATE.wv - 1);
                this.hp = this.max;
                this.spd = 1.3 + 0.001 * (STATE.wv - 1);
                this.r = 0.3; break;
            case 'sz':
                this.max = 20 + 7 * (STATE.wv - 1);
                this.hp = this.max;
                this.spd = 1.0; this.r = 0.3;
                this.helmet = { mit: 0.25, dur: 50 }; // T1 Helmet
                this.lf = performance.now();
                // Pick a weapon loadout for the zombie
                const roll = Math.random();
                if (roll < 0.20) { let w = Arsenal.find(x=>x.name==='AR15'); this.zG = { name: 'Z-AR', dmg: w.dmg, durL: 20, rpm: w.rpm, bSpd: w.bSpd, bDrop: w.bDrop, sprd: w.bSprd, hs: w.hs, ammoType: w.ammoType, mag: w.max, maxMag: w.max, rTm: w.rTm, isR: false, rStart: 0 }; }
                else if (roll < 0.55) { let w = Arsenal.find(x=>x.name==='GLOCK 19'); this.zG = { name: 'Z-Pist', dmg: w.dmg, durL: 10, rpm: w.rpm, bSpd: w.bSpd, bDrop: w.bDrop, sprd: w.bSprd, hs: w.hs, ammoType: w.ammoType, mag: w.max, maxMag: w.max, rTm: w.rTm, isR: false, rStart: 0 }; }
                else { let w = Arsenal.find(x=>x.name==='M500'); this.zG = { name: 'Z-Shoty', dmg: w.dmg, durL: 5, rpm: w.rpm, bSpd: w.bSpd, bDrop: w.bDrop, sprd: w.bSprd, cnt: 8, hs: w.hs, ammoType: w.ammoType, mag: w.max, maxMag: w.max, rTm: w.rTm, isR: false, rStart: 0 }; }
                this.sDir = Math.random() < 0.5 ? 1 : -1;
                this.sT = 0;
                break;
            case 'bz':
                this.max = 50;
                this.hp = this.max;
                this.spd = 0.5;
                this.r = 0.35;
                this.agro = false;   // true when HP <= 25
                this.exploded = false;
                break;
            case 'tz': // Tactical Zombie
                this.max = 20; this.hp = this.max; this.spd = 1.4; this.r = 0.3;
                this.armor = { mit: 0.5, dur: 100 }; // Military
                this.helmet = { mit: 0.40, dur: 100 }; // T2 Helmet
                let wT = Arsenal.find(x=>x.name==='M4A1');
                this.zG = { name: wT.name, dmg: wT.dmg, rpm: wT.rpm, bSpd: wT.bSpd, bDrop: wT.bDrop, sprd: wT.bSprd, hs: wT.hs, ammoType: wT.ammoType, mag: wT.max, maxMag: wT.max, rTm: wT.rTm, isR: false, rStart: 0 };
                this.lf = performance.now(); this.sDir = 1; this.sT = 0;
                break;
            case 'rz': // Russian Zombie (formerly Cheese)
                this.max = 35; this.hp = this.max; this.spd = 1.2; this.r = 0.3;
                this.armor = { mit: 0.9, dur: 200 }; // Plate Carrier
                this.helmet = { mit: 0.50, dur: 150 }; // T3 Helmet
                let wR = Arsenal.find(x=>x.name==='AK47');
                this.zG = { name: wR.name, dmg: wR.dmg, rpm: wR.rpm, bSpd: wR.bSpd, bDrop: wR.bDrop, sprd: wR.bSprd, hs: wR.hs, ammoType: wR.ammoType, mag: wR.max, maxMag: wR.max, rTm: wR.rTm, isR: false, rStart: 0 };
                this.lf = performance.now(); this.sDir = 1; this.sT = 0;
                break;
            case 'jz': // Juggernaut
                this.max = 100; this.hp = this.max; this.spd = 0.8; this.r = 0.4;
                this.armor = { mit: 0.9, dur: 500 }; // Juggernaut
                this.helmet = { mit: 0.75, dur: 500 }; // T4 Helmet
                let wJ = Arsenal.find(x=>x.name==='M249');
                this.zG = { name: wJ.name, dmg: wJ.dmg, rpm: wJ.rpm, bSpd: wJ.bSpd, bDrop: wJ.bDrop, sprd: wJ.bSprd, hs: wJ.hs, ammoType: wJ.ammoType, mag: wJ.max, maxMag: wJ.max, rTm: wJ.rTm, isR: false, rStart: 0 };
                this.lf = performance.now(); this.sDir = 1; this.sT = 0;
                this.lastRegen = 0;
                break;
            case 'c': this.r = 0.4; this.val = 0; break;
            case 'gr': this.r = 0.15; this.timer = 3.0; this.z = 0.5; this.vx = 0; this.vy = 0; this.vz = 0; break;
            default:
                this.max = 1; this.hp = 1; this.spd = 0; this.r = 0;
        }
    }
    hit(dmg, isHeadshot = false, isGrenade = false, ammoType = null) {
        if (!this.active || this.t === 'g' || this.t === 'c' || this.t === 'shop' || this.t === 'crow' || this.t === 'ammo_shop' || this.t === 'fd' || this.t === 'w_svd' || this.t === 'w_pkm') return;
        this.lastHit = performance.now();
        let actualDmg = dmg;
        let penMult = 1.0;
        let durDmg = 15;
        if (ammoType === '.50 bmg') { penMult = 0.5; durDmg = 75; }
        else if (ammoType === '.308 win') { penMult = 0.75; }
        else if (ammoType === '7.62x54 mmr' || ammoType === '7.62x62 soviet') { penMult = 0.65; }

        if (isHeadshot) {
            actualDmg = (this.helmet && this.helmet.dur > 0) ? dmg * (1 - this.helmet.mit * penMult) : dmg;
            if (this.helmet) {
                this.helmet.dur -= durDmg;
                if (this.helmet.dur < 0) this.helmet.dur = 0;
            }
        } else {
            if (isGrenade) {
                actualDmg = (this.armor && this.armor.dur > 0) ? dmg * (1 - this.armor.mit * 0.5) : dmg;
                if (this.armor) {
                    this.armor.dur -= 100;
                    if (this.armor.dur < 0) this.armor.dur = 0;
                }
            } else {
                actualDmg = (this.armor && this.armor.dur > 0) ? dmg * (1 - this.armor.mit * penMult) : dmg;
                if (this.armor) {
                    this.armor.dur -= durDmg;
                    if (this.armor.dur < 0) this.armor.dur = 0;
                }
            }
        }
        this.hp -= actualDmg;
        const isKill = this.hp <= 0;
        // Trigger hitmarker — kill overrides headshot color
        spawnHitmarker(isHeadshot, isKill);
        // Bomber agro trigger
        if (this.t === 'bz' && !this.agro && this.hp <= 25) {
            this.agro = true;
            this.spd = 3.0;
        }
        if (this.hp <= 0) {
            this.active = false;
            // Kill streak tracking
            if (this.t === 'z' || this.t === 'sz' || this.t === 'bz' || this.t === 'tz' || this.t === 'rz' || this.t === 'jz') {
                if (typeof STORAGE !== 'undefined') {
                    STORAGE.data.totalKills++;
                    STORAGE.save();
                }
                STATE.killStreak++;
                STATE.killStreakTimer = 8.0; // 8 seconds to keep streak alive
                const ksEl = document.getElementById('hud-killstreak');
                const ksVal = document.getElementById('killstreak-val');
                if (ksEl && ksVal) {
                    if (STATE.killStreak >= 2) ksEl.style.display = 'block';
                    ksVal.textContent = STATE.killStreak;
                    // Streak milestone notices
                    if (STATE.killStreak === 5) notice('🔥 5 KILL STREAK!');
                    else if (STATE.killStreak === 10) notice('💀 10 KILL STREAK — UNSTOPPABLE!');
                    else if (STATE.killStreak === 25) notice('👹 25 KILLS — MONSTER!');
                }
            }
            if (this.t === 'z' || this.t === 'sz' || this.t === 'bz' || this.t === 'tz' || this.t === 'rz' || this.t === 'jz') {
                const coin = new Entity(this.x, this.y, 'c');
                coin.val = (this.t === 'sz' || this.t === 'tz' || this.t === 'rz')
                    ? Math.floor(Math.random() * 301) + 200
                    : (this.t === 'jz' ? 2500 : Math.floor(Math.random() * 150) + 50);
                if (this.t === 'bz') coin.val = Math.floor(Math.random() * 200) + 150;
                ents.push(coin);
            }
            if (this.t === 'rz') {
                const fd = new Entity(this.x + (Math.random() - 0.5) * 0.5, this.y + (Math.random() - 0.5) * 0.5, 'fd');
                fd.color = 'red'; fd.r = 0.3; ents.push(fd);

                // PKM drop roll (25%)
                if (Math.random() < 0.25) {
                    const wp = new Entity(this.x + (Math.random() - 0.5) * 0.5, this.y + (Math.random() - 0.5) * 0.5, 'w_pkm');
                    wp.r = 0.3; ents.push(wp);
                }
                // SVD drop roll (50%)
                if (Math.random() < 0.50) {
                    const wp = new Entity(this.x + (Math.random() - 0.5) * 0.5, this.y + (Math.random() - 0.5) * 0.5, 'w_svd');
                    wp.r = 0.3; ents.push(wp);
                }
            }
            if (this.t === 'jz') {
                const fd = new Entity(this.x + (Math.random() - 0.5) * 0.5, this.y + (Math.random() - 0.5) * 0.5, 'fd');
                fd.color = 'black'; fd.r = 0.3; ents.push(fd);
            }
            const alive = ents.filter(e => e.active && (e.t === 'z' || e.t === 'sz' || e.t === 'bz' || e.t === 'tz' || e.t === 'rz' || e.t === 'jz')).length;
            if (alive === 0) {
                const completedWave = STATE.wv;
                let reward = 1000;
                for (let w = 2; w <= completedWave; w++) {
                    if (w <= 7) reward += 500;
                    else reward += 1000;
                }
                STATE.mon += reward;
                if (typeof STORAGE !== 'undefined') {
                    STORAGE.data.totalCoinsEarned += reward;
                    if (STATE.wv >= STORAGE.data.highestWave) STORAGE.data.highestWave = STATE.wv + 1;
                    STORAGE.save();
                }
                document.getElementById('money-val').textContent = '$' + STATE.mon;
                notice(`WAVE ${completedWave} CLEARED! +$${reward}`);

                STATE.wv++;
                document.getElementById('wave-val').textContent = 'Wave ' + STATE.wv;
                notice('WAVE ' + STATE.wv + ' INBOUND');
                STATE.waveCountdownEnd = performance.now() + 3200;
                const wcd = document.getElementById('hud-wave-countdown');
                if (wcd) wcd.style.display = 'block';
                setTimeout(spawnWave, 3200);
            }
        }
    }
}

class Bullet {
    constructor(x, y, z, vx, vy, vz, w, owner = 'player') {
        this.x = x; this.y = y; this.z = z;
        this.vx = vx; this.vy = vy; this.vz = vz;
        this.w = w; this.owner = owner;
        this.active = true;
        this.trail = [];
    }
    update() {
        if (!this.active) return;
        this.trail.push({ x: this.x, y: this.y, z: this.z });
        if (this.trail.length > 8) this.trail.shift();

        // Homing guidance steering towards target
        if (this.target && this.target.active) {
            const scale = ADMIN.hitboxExpansion || 1.0;
            const targetOffset = (ADMIN.hitLocation === 'head') ? 0.91 * scale : ((ADMIN.hitLocation === 'legs') ? 0.19 * scale : 0.60 * scale);
            const tx = Math.floor(this.target.x), ty = Math.floor(this.target.y);
            const floorZ = (tx >= 0 && tx < MAP_SZ && ty >= 0 && ty < MAP_SZ) ? hMap[tx][ty] : 0;
            const entZ = (this.target.z !== undefined && !isNaN(this.target.z)) ? this.target.z : floorZ;
            const targetZ = entZ + targetOffset;

            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dz = targetZ - this.z;
            const dist = Math.hypot(dx, dy, dz);

            if (dist > 0.05) {
                const targetVx = (dx / dist) * this.w.bSpd;
                const targetVy = (dy / dist) * this.w.bSpd;
                const targetVz = (dz / dist) * this.w.bSpd;

                // Slowly steer velocity vector towards the target direction
                const steerRate = 18.0 * STATE.dt;
                this.vx += (targetVx - this.vx) * steerRate;
                this.vy += (targetVy - this.vy) * steerRate;
                this.vz += (targetVz - this.vz) * steerRate;

                // Lock speed back to configured bullet speed
                const speed = Math.hypot(this.vx, this.vy, this.vz);
                if (speed > 0.01) {
                    this.vx = (this.vx / speed) * this.w.bSpd;
                    this.vy = (this.vy / speed) * this.w.bSpd;
                    this.vz = (this.vz / speed) * this.w.bSpd;
                }
            }
        }

        const totalDx = this.vx * STATE.dt;
        const totalDy = this.vy * STATE.dt;
        const totalDz = this.vz * STATE.dt;
        const moveDist = Math.hypot(totalDx, totalDy, totalDz);

        const stepSize = 0.25; // Check collision every 0.25 meters
        const steps = Math.max(1, Math.ceil(moveDist / stepSize));

        const stepDx = totalDx / steps;
        const stepDy = totalDy / steps;
        const stepDz = totalDz / steps;

        for (let s = 0; s < steps; s++) {
            this.x += stepDx;
            this.y += stepDy;
            this.z += stepDz;

            const bx = Math.floor(this.x), by = Math.floor(this.y);
            if (bx < 0 || bx >= MAP_SZ || by < 0 || by >= MAP_SZ || this.z < 0) {
                this.active = false; return;
            }
            if (wMap[bx][by] > 0 && this.z < hMap[bx][by] && !ADMIN.noclip) {
                this.active = false; return;
            }

            if (this.owner === 'player') {
                for (const e of ents) {
                    if (!e.active || e.t === 'g' || e.t === 'c' || e.t === 'shop' || e.t === 'crow' || e.t === 'ammo_shop' || e.t === 'fd' || e.t === 'w_svd' || e.t === 'w_pkm') continue;
                    const scale = ADMIN.hitboxExpansion || 1.0;
                    const hitRadius = e.r * scale;
                    const tx = Math.floor(e.x), ty = Math.floor(e.y);
                    const floorZ = (tx >= 0 && tx < MAP_SZ && ty >= 0 && ty < MAP_SZ) ? hMap[tx][ty] : 0;
                    const entZ = (e.z !== undefined && !isNaN(e.z)) ? e.z : floorZ;
                    const minZ = entZ;
                    const maxZ = entZ + 1.0 * scale;
                    if (Math.hypot(this.x - e.x, this.y - e.y) < hitRadius) {
                        if (this.z >= minZ && this.z <= maxZ) {
                            // Normalize z-coordinate relative to scaled vertical bounds
                            const fracFromTop = Math.max(0, Math.min(1, (maxZ - this.z) / (maxZ - minZ)));
                            const isHS = fracFromTop < 0.18;
                            const isLeg = !isHS && fracFromTop > 0.62;
                            const mult = isHS ? this.w.hs : isLeg ? this.w.legArm : 1.0;
                            e.hit(this.w.dmg * mult, isHS, false, this.w.ammoType);
                            this.active = false; return;
                        }
                    }
                }
                
                // PvP Hit Detection
                for (const [rId, rp] of Object.entries(remotePlayers)) {
                    if (rp.hp <= 0) continue;
                    const scale = ADMIN.hitboxExpansion || 1.0;
                    const hitRadius = 0.3 * scale;
                    const tx = Math.floor(rp.x), ty = Math.floor(rp.y);
                    const floorZ = (tx >= 0 && tx < MAP_SZ && ty >= 0 && ty < MAP_SZ) ? hMap[tx][ty] : 0;
                    const entZ = (rp.z !== undefined && !isNaN(rp.z)) ? rp.z : floorZ;
                    const minZ = entZ;
                    const maxZ = entZ + 1.0 * scale;
                    
                    if (Math.hypot(this.x - rp.x, this.y - rp.y) < hitRadius) {
                        if (this.z >= minZ && this.z <= maxZ) {
                            const fracFromTop = Math.max(0, Math.min(1, (maxZ - this.z) / (maxZ - minZ)));
                            const isHS = fracFromTop < 0.18;
                            const isLeg = !isHS && fracFromTop > 0.62;
                            
                            let baseDmg = this.w.dmg;
                            let hsMult = this.w.hs;
                            if (STATE.mode === 'PVP' && typeof PVP_STATS !== 'undefined' && PVP_STATS[this.w.name]) {
                                baseDmg = PVP_STATS[this.w.name].dmg;
                                hsMult = PVP_STATS[this.w.name].hs || hsMult;
                            }
                            const mult = isHS ? hsMult : isLeg ? this.w.legArm : 1.0;
                            const dmg = baseDmg * mult;
                            
                            NET.send({ type: 'hit', targetId: rId, dmg: dmg, isHS: isHS, shooter: STATE.myId });
                            this.active = false; return;
                        }
                    }
                }
            } else if (this.owner === 'sz' || this.owner === 'remote') {
                if (Math.hypot(this.x - Player.x, this.y - Player.y) < Player.r) {
                    if (Math.abs(this.z - Player.z) < 0.55 && !ADMIN.noclip) {
                        // Head zone: top 18% of player sprite (z > Player.z + 0.35 = ~head level)
                        let isHS = this.z > Player.z + 0.35;
                        if (ADMIN.antiAim) isHS = false; // anti aim cocks neck back making headshots impossible
                        const hsMult = this.w.hs || 2.0;
                        Player.takeDmg(this.w.dmg, this.w.durL || 15, 'bullet', isHS, hsMult, false, this.w.ammoType, this.owner);
                        this.active = false; return;
                    }
                }
            }
        }
        this.vz -= this.w.bDrop * STATE.dt * 60;
    }
}


// ============================================================
// WAVES / SPAWNS
// ============================================================
function spawnWave() {
    const n = 5 + STATE.wv * 3;
    const szChance = STATE.wv >= 3 ? Math.min(0.30, 0.15 + (STATE.wv - 3) * 0.04) : 0;
    const bzChance = STATE.wv >= 5 ? Math.min(0.30, 0.05 + (STATE.wv - 4) * 0.04) : 0;
    let count = 0, tries = 0;
    while (count < n && tries < 1200) {
        tries++;
        const rx = Math.floor(Math.random() * (MAP_SZ - 2)) + 1;
        const ry = Math.floor(Math.random() * (MAP_SZ - 2)) + 1;
        if (wMap[rx][ry] === 0
            && Math.hypot(rx + 0.5 - Player.x, ry + 0.5 - Player.y) > 10
            && canMove(rx + 0.5, ry + 0.5, 0.3, 0.5)) {
            const roll = Math.random();
            let type = 'z';
            if (roll < bzChance) type = 'bz';
            else if (roll < bzChance + szChance) {
                type = 'sz';
                const eliteRoll = Math.random() * 100;
                if (STATE.wv >= 7) {
                    if (eliteRoll < 0.5) type = 'jz';       // 0.5% Juggernaut
                    else if (eliteRoll < 3.5) type = 'rz';  // 3% Russian
                    else if (eliteRoll < 7.5) type = 'tz';  // 4% Tactical
                }
            }

            // Wave 10 Juggernaut Guarantee
            if (STATE.wv === 10 && count === 0) {
                const hasJugg = ents.some(e => e.t === 'jz' && e.active);
                if (!hasJugg) type = 'jz';
            }

            ents.push(new Entity(rx + 0.5, ry + 0.5, type));
            count++;
        }
    }
    document.getElementById('wave-val').textContent = 'Wave ' + STATE.wv;
}

function spawnGrass() {
    for (let i = 0; i < 240; i++) {
        const rx = Math.random() * MAP_SZ, ry = Math.random() * MAP_SZ;
        if (wMap[Math.floor(rx)][Math.floor(ry)] === 0) ents.push(new Entity(rx, ry, 'g'));
    }
}

let noticeTimer = null;
function notice(text, persist = false) {
    const el = document.getElementById('notice');
    el.textContent = text; el.style.opacity = 1;
    if (noticeTimer) clearTimeout(noticeTimer);
    if (!persist) noticeTimer = setTimeout(() => { el.style.opacity = 0; }, 2200);
}

function addKillFeedMessage(killer, victim) {
    const kf = document.getElementById('hud-killfeed');
    if (!kf) return;
    const msg = document.createElement('div');
    msg.style.cssText = "background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.1); padding:4px 8px; border-radius:4px; font-family:'Share Tech Mono',monospace; font-size:11px; color:#fff; display:flex; align-items:center; gap:8px; animation: kfSlide 0.2s ease-out;";
    msg.innerHTML = `<span style="color:#60a5fa">${killer}</span> <span style="font-size:10px;color:#888;">[KILLED]</span> <span style="color:#f87171">${victim}</span>`;
    kf.appendChild(msg);
    setTimeout(() => { msg.style.opacity = '0'; msg.style.transition = 'opacity 0.5s'; setTimeout(()=>msg.remove(), 500); }, 4000);
}

function updateScoreboard() {
    const list = document.getElementById('scoreboard-list');
    if (!list) return;
    list.innerHTML = '';
    
    // Convert STATE.scores object to array and sort by kills (descending), then deaths (ascending)
    const players = [];
    if (STATE.scores[STATE.myId]) players.push({ id: STATE.myId, ...STATE.scores[STATE.myId] });
    Object.keys(remotePlayers).forEach(id => {
        if (STATE.scores[id]) players.push({ id, ...STATE.scores[id] });
    });
    
    players.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    
    players.forEach(p => {
        const row = document.createElement('div');
        const isMe = p.id === STATE.myId;
        row.style.cssText = `display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,${isMe?0.1:0.02}); border-radius:4px; font-family:'Share Tech Mono',monospace; font-size:13px; color:${isMe?'#fff':'#aaa'}; border:1px solid rgba(255,255,255,${isMe?0.2:0.05});`;
        row.innerHTML = `<span>${p.name || p.id.substring(0,6).toUpperCase()}</span><div style="display:flex; gap:32px; width:100px; justify-content:flex-end;"><span>${p.kills}</span><span>${p.deaths}</span></div>`;
        list.appendChild(row);
    });
}

// ============================================================
// WEAPONS — FIRE & RELOAD
// ============================================================
function fW() {
    const w = Player.get();
    // Shotgun interrupt: cancel shell reload so player can shoot
    if (w.isR && w.reloadStyle === 'shotgun_tube') {
        if (w.shellTimer) { clearTimeout(w.shellTimer); w.shellTimer = null; }
        w.isR = false; w.anim = 0;
        updateWeaponHUD();
    }
    if (w.isR || w.mag <= 0) return;
    const now = Date.now();
    if (now - w.lf < 60000 / w.rpm) return;
    w.lf = now; w.mag--;
    updateWeaponHUD();
    STATE.flashTimer = 55;  // ms

    // Gun barrel world position — offset right along camera plane, forward, and slightly below eye
    const cnt = (w.type === 'pump' || w.name === 'SPAS-12') ? (w.name === 'SPAS-12' ? 12 : 10) : 1;
    const gunOffRight = STATE.isADS ? 0.0 : 0.18;
    const gunOffFwd = 0.30;
    const gunOffZ = -0.08;
    const gunX = Player.x + Player.px * gunOffRight + Player.dx * gunOffFwd;
    const gunY = Player.y + Player.py * gunOffRight + Player.dy * gunOffFwd;
    const gunZ = Player.z + gunOffZ;

    // Crosshair target — positive pit = looking UP, so tgtZ rises with pit
    const aimDist = 80;
    const pitFrac = (STATE.pit + STATE.flinchY) / (scrH / 2);
    const tgtX = Player.x + Player.dx * aimDist;
    const tgtY = Player.y + Player.dy * aimDist;
    const tgtZ = Player.z + pitFrac * aimDist * 0.5;  // 0.5 = correct raycaster projection factor

    // Unit horizontal direction toward crosshair target (normalize BEFORE adding spread)
    const baseDX = tgtX - gunX, baseDY = tgtY - gunY;
    const baseDist = Math.hypot(baseDX, baseDY);
    const unitX = baseDX / baseDist, unitY = baseDY / baseDist;
    const vertAngle = (tgtZ - gunZ) / baseDist; // vertical rise per unit of horizontal distance

    for (let i = 0; i < cnt; i++) {
        let sprd;
        if (w.type === 'pump') {
            sprd = w.bSprd * 0.5;
        } else {
            sprd = STATE.isADS ? w.bSprd * 0.1 : w.bSprd * 1.0;
        }
        const isSilentActive = ADMIN.silent && isAimKeyPressed(ADMIN.silentKey);
        if (isSilentActive && aimTarg && (Math.random() * 100 <= ADMIN.accuracy)) sprd = 0;
        if (ADMIN.noSpread) sprd = 0;

        let rx, ry, vz;
        let bX = gunX, bY = gunY, bZ = gunZ;
        let targetEnt = null;
        if (isSilentActive && aimTarg && (Math.random() * 100 <= ADMIN.accuracy)) {
            const scale = ADMIN.hitboxExpansion || 1.0;
            const targetOffset = ADMIN.hitLocation === 'head' ? 0.91 * scale : (ADMIN.hitLocation === 'legs' ? 0.19 * scale : 0.60 * scale);
            const tx = Math.floor(aimTarg.x), ty = Math.floor(aimTarg.y);
            const floorZ = (tx >= 0 && tx < MAP_SZ && ty >= 0 && ty < MAP_SZ) ? hMap[tx][ty] : 0;
            const entZ = (aimTarg.z !== undefined && !isNaN(aimTarg.z)) ? aimTarg.z : floorZ;
            const targetZ = entZ + targetOffset;

            const sdx = aimTarg.x - gunX, sdy = aimTarg.y - gunY, sd = Math.hypot(sdx, sdy);
            rx = sdx / sd; ry = sdy / sd;
            // Calculate base vertical velocity to target and add gravity compensation:
            // vz = (deltaZ / flightTime) = (deltaZ / (dist / speed))
            // Bullet drop rate: vz drops by bDrop * dt * 60 per frame. In tick: vz -= bDrop * dt * 60.
            // Effective vertical drop over time t: drop = 0.5 * (bDrop * 60) * t^2.
            // To hit exact target, add compensating upward velocity: vz_comp = 0.5 * (bDrop * 60) * t
            const flightTime = sd / w.bSpd;
            vz = ((targetZ - gunZ) / sd) * w.bSpd + 30 * w.bDrop * flightTime;

            if (ADMIN.silentMode === 'teleport') {
                targetEnt = aimTarg; // Homing target
            }
        } else {
            // Add spread to unit direction vector — preserves correct angular spread magnitude
            let sx = unitX + (Math.random() - 0.5) * sprd;
            let sy = unitY + (Math.random() - 0.5) * sprd;
            const sl = Math.hypot(sx, sy);
            rx = sx / sl; ry = sy / sl;
            // vz from vertical aim angle + matching vertical spread
            vz = (vertAngle + (Math.random() - 0.5) * sprd * 0.5) * w.bSpd;
        }
        
        const newB = new Bullet(bX, bY, bZ, rx * w.bSpd, ry * w.bSpd, vz, w);
        if (targetEnt) {
            newB.target = targetEnt;
        }
        bullets.push(newB);
        
        // Sync bullet over network
        if (STATE.mode === 'PVP') {
            NET.send({
                type: 'bullet',
                ownerId: STATE.myId,
                bullet: { x: bX, y: bY, z: bZ, vx: rx * w.bSpd, vy: ry * w.bSpd, vz: vz, w: { bDrop: w.bDrop, bSpd: w.bSpd, dmg: w.dmg, hs: w.hs, legArm: w.legArm, durL: w.durL || 15 } }
            });
        }
    }

    if (!ADMIN.recoil) {
        w.reK = w.reM * 7;
        const kick = w.reM * 1.5;
        STATE.pit += kick;
        STATE.recAcc += kick;
    }
}
function rldW() {
    const w = Player.get();
    if (w.mag === w.max) return;
    // Shotgun tube reload — shell by shell, interruptable
    if (w.reloadStyle === 'shotgun_tube') {
        if (w.isR) return; // already reloading shell, wait for it
        let reserve = 0;
        if (ADMIN.infiniteAmmo) {
            reserve = 999;
        } else {
            for (const item of inventoryStorage)
                if (item && item.type === 'ammo' && item.ammoType === w.ammoType) reserve += item.amount;
        }
        if (reserve === 0) { notice('OUT OF AMMO!'); return; }
        w.isR = true; w.anim = 0;
        const shellMs = Math.round(w.shellRTm * (1 / (ADMIN.reloadSpeed || 1.0)));

        function insertShell() {
            if (!isRunning || !w.isR) return;
            // Consume 1 shell from inventory
            let consumed = false;
            if (ADMIN.infiniteAmmo) {
                consumed = true;
            } else {
                for (let i = 0; i < inventoryStorage.length; i++) {
                    const item = inventoryStorage[i];
                    if (item && item.type === 'ammo' && item.ammoType === w.ammoType && item.amount > 0) {
                        item.amount--;
                        if (item.amount === 0) inventoryStorage[i] = null;
                        consumed = true;
                        break;
                    }
                }
            }
            if (!consumed) { w.isR = false; w.anim = 0; w.shellTimer = null; updateWeaponHUD(); return; }
            w.mag = Math.min(w.max, w.mag + 1);
            w.anim = 0; // reset for next animation pulse
            updateWeaponHUD();
            notice(`${w.name} [${w.mag}/${w.max}]`);
            if (w.mag < w.max) {
                // Check if more ammo available
                let more = 0;
                if (ADMIN.infiniteAmmo) {
                    more = 999;
                } else {
                    for (const item of inventoryStorage)
                        if (item && item.type === 'ammo' && item.ammoType === w.ammoType) more += item.amount;
                }
                if (more > 0) {
                    w.shellTimer = setTimeout(insertShell, shellMs);
                    return;
                }
            }
            w.isR = false; w.anim = 0; w.shellTimer = null;
            updateWeaponHUD();
        }
        // Animate anim for the first shell
        const animInter = setInterval(() => { if (w.isR) w.anim += 50; else clearInterval(animInter); }, 50);
        w.shellTimer = setTimeout(insertShell, shellMs);
        return;
    }

    // Standard bulk reload
    if (w.isR) return;
    let reserve = 0;
    if (ADMIN.infiniteAmmo) {
        reserve = 999;
    } else {
        for (const item of inventoryStorage)
            if (item && item.type === 'ammo' && item.ammoType === w.ammoType) reserve += item.amount;
    }
    if (reserve === 0) { notice('OUT OF AMMO!'); return; }

    w.isR = true;
    document.getElementById('ammo-val').textContent = 'R';
    const reloadMs = w.rTm * (1 / (ADMIN.reloadSpeed || 1.0));
    const inter = setInterval(() => { w.anim += 50; }, 50);
    setTimeout(() => {
        if (!isRunning) return;

        if (ADMIN.infiniteAmmo) {
            w.mag = w.max;
        } else {
            let needed = w.max - w.mag;
            for (let i = 0; i < inventoryStorage.length; i++) {
                let item = inventoryStorage[i];
                if (item && item.type === 'ammo' && item.ammoType === w.ammoType) {
                    if (item.amount <= needed) {
                        needed -= item.amount;
                        w.mag += item.amount;
                        inventoryStorage[i] = null;
                    } else {
                        item.amount -= needed;
                        w.mag += needed;
                        needed = 0;
                        break;
                    }
                }
            }
        }

        w.isR = false; w.anim = 0;
        updateWeaponHUD();
        renderInventoryUI();
        clearInterval(inter);
    }, reloadMs);
}

function throwGrenade(chargePct = 0.5) {
    const gIdx = inventoryStorage.findIndex(i => i && i.type === 'grenade');
    if (gIdx < 0) {
        STATE.holdingG = false;
        STATE.chargingGrenade = false;
        return;
    }
    
    // Throw velocity - scale power from 4 (short throw) to 20 (long throw)
    const throwPower = 4 + 16 * chargePct;
    const pitFrac = (STATE.pit + STATE.flinchY) / (scrH / 2);
    const vx = Player.dx * throwPower;
    const vy = Player.dy * throwPower;
    const vz = pitFrac * throwPower * 0.5 + 2.0; // Throw slightly up
    
    const gr = new Entity(Player.x + Player.dx * 0.5, Player.y + Player.dy * 0.5, 'gr');
    gr.vx = vx; gr.vy = vy; gr.vz = vz;
    gr.z = Player.z;
    ents.push(gr);
    
    // Remove from inventory
    if (inventoryStorage[gIdx].amount > 1) {
        inventoryStorage[gIdx].amount--;
    } else {
        inventoryStorage[gIdx] = null;
    }
    STATE.holdingG = false;
    STATE.chargingGrenade = false;
    notice('GRENADE THROWN!');
}

function updateWeaponHUD() {
    const w = Player.get();
    document.getElementById('weapon-name').textContent = w.name;
    if (!w.isR) {
        let reserve = 0;
        for (const item of inventoryStorage) {
            if (item && item.type === 'ammo' && item.ammoType === w.ammoType) reserve += item.amount;
        }
        document.getElementById('ammo-val').textContent = w.mag + ' / ' + (ADMIN.infiniteAmmo ? '∞' : reserve);
    }
}


// ============================================================
// SHOP & INTERACTION
// ============================================================
let activeShopType = 'standard';
function openShop(type = 'standard') {
    if (STATE.mod === 'INV') closeInventory();
    activeShopType = type;
    document.exitPointerLock();
    STATE.mod = 'SHP';
    document.getElementById('shop-overlay').style.display = 'block';
    populateShop();
}
function tryInteract() {
    for (const e of ents) {
        if (!e.active || (e.t !== 'shop' && e.t !== 'crow' && e.t !== 'ammo_shop')) continue;
        const dist = Math.hypot(Player.x - e.x, Player.y - e.y);
        if (dist < 1.5) {
            openShop(e.t === 'crow' ? 'merchant' : (e.t === 'ammo_shop' ? 'ammo' : 'standard'));
            return;
        }
    }
}

// Crow despawn/respawn timer
let crowDespawnTimer = null;
function randomizeCrowItems() {
    STATE.crowShopItems = [];
    for(let a of Armor) STATE.crowShopItems.push({type: 'armor', item: a});
    for(let h of Helmets) STATE.crowShopItems.push({type: 'helmet', item: h});
    STATE.crowShopItems.push({type: 'medkit'});
    STATE.crowShopItems.push({type: 'large-medkit'});
    STATE.crowShopItems.push({type: 'repair-vest'});
    STATE.crowShopItems.push({type: 'repair-helmet'});
    STATE.crowShopItems.push({type: 'grenade'});
    STATE.crowShopItems.push({type: 'bandage'});
}

function scheduleCrowDespawn() {
    if (crowDespawnTimer) clearTimeout(crowDespawnTimer);
    const delay = 120 * 1000; // 120s fixed
    crowDespawnTimer = setTimeout(() => {
        const crow = ents.find(e => e.active && e.t === 'crow');
        if (crow) { crow.active = false; notice('⚠ The Crow Merchant has moved on...', false); }
        
        randomizeCrowItems();
        const respawnDelay = 1000;
        setTimeout(() => {
            if (!isRunning) return;
            const candidates = [[31,31],[20,30],[40,30],[31,20],[31,40],[15,31],[45,31]];
            for (const [cx, cy] of candidates.sort(()=>Math.random()-0.5)) {
                let placed = false;
                for (let dy = 0; dy <= 3 && !placed; dy++)
                    for (let dx = 0; dx <= 3 && !placed; dx++) {
                        const nx = cx+dx, ny = cy+dy;
                        if (nx>0 && nx<MAP_SZ-1 && ny>0 && ny<MAP_SZ-1 && wMap[nx][ny] === 0) {
                            const newCrow = new Entity(nx+0.5, ny+0.5, 'crow');
                            newCrow.r = 0.8; ents.push(newCrow);
                            notice('🦅 The Crow Merchant has arrived!', false);
                            placed = true;
                        }
                    }
                if (placed) break;
            }
            scheduleCrowDespawn();
        }, respawnDelay);
    }, delay);
}

function spawnShops() {
    function placeAt(x, y, type) {
        for (let dy = 0; dy <= 3; dy++)
            for (let dx = 0; dx <= 3; dx++) {
                const nx = Math.floor(x)+dx, ny = Math.floor(y)+dy;
                if (nx>0 && nx<MAP_SZ-1 && ny>0 && ny<MAP_SZ-1 && wMap[nx][ny] === 0) {
                    const e = new Entity(nx+0.5, ny+0.5, type);
                    e.r = 0.8; ents.push(e); return true;
                }
            }
        return false;
    }
    placeAt(11, 9, 'shop');
    placeAt(24, 20, 'shop');
    placeAt(16, 51, 'ammo_shop');
    placeAt(40, 48, 'ammo_shop');
    placeAt(31, 31, 'crow');
    randomizeCrowItems();
    scheduleCrowDespawn();
}


function closeShop() {
    document.getElementById('shop-overlay').style.display = 'none';
    STATE.mod = 'PLAY';
    canvas.requestPointerLock();
}

function updateShopMoney() {
    document.getElementById('shop-money').textContent = STATE.mon;
    document.getElementById('money-val').textContent = '$' + STATE.mon;
}

function createShopItem(name, stats, cost, onBuy, reqItemStr = null) {
    const d = document.createElement('div');
    d.className = 'shop-item';
    d.style.position = 'relative';
    d.style.overflow = 'hidden';
    d.style.userSelect = 'none';
    
    d.innerHTML = `
        <div style="position:relative; z-index:2; pointer-events:none;">
            <div class="shop-item-name">${name}</div>
            <div class="shop-item-stats">${stats}</div>
        </div>
        <div class="shop-item-cost" style="position:relative; z-index:2; pointer-events:none; text-align:right;">$${cost}${reqItemStr ? '<br><span style="font-size:10px;color:#ff4444;">+ ' + reqItemStr + '</span>' : ''}</div>
        <div class="shop-progress-bar" style="position:absolute; top:0; left:0; height:100%; width:0%; background:rgba(255,255,255,0.15); z-index:1; pointer-events:none;"></div>
    `;

    let holdStart = 0;
    let progressInterval = null;

    const cancelBuy = () => {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        const pBar = d.querySelector('.shop-progress-bar');
        if (pBar) pBar.style.width = '0%';
    };

    const startBuy = (e) => {
        if (e.button !== 0) return;
        if (STATE.mon < cost) { notice('NOT ENOUGH MONEY'); return; }
        holdStart = performance.now();
        const pBar = d.querySelector('.shop-progress-bar');
        progressInterval = setInterval(() => {
            let p = (performance.now() - holdStart) / 500;
            if (p >= 1.0) {
                p = 1.0;
                cancelBuy();
                onBuy();
            }
            if (pBar) pBar.style.width = (p * 100) + '%';
        }, 16);
    };

    d.addEventListener('mousedown', startBuy);
    d.addEventListener('mouseup', cancelBuy);
    d.addEventListener('mouseleave', cancelBuy);
    
    return d;
}

function populateShop() {
    document.getElementById('shop-money').textContent = STATE.mon;
    const list = document.getElementById('shop-list');
    list.innerHTML = '';

    if (activeShopType === 'standard') {
        const wHeader = document.createElement('div');
        wHeader.className = 'shop-section-label'; wHeader.textContent = 'STANDARD ARSENAL';
        list.appendChild(wHeader);
        
        for (let i = 1; i < Arsenal.length; i++) {
            const w = Arsenal[i];
            if (w.name === 'PKM' && STATE.mode !== 'PVP') continue; // PKM is drop-only in SURVIVAL
            const cost = STATE.mode === 'PVP' ? 0 : w.cost;
            list.appendChild(createShopItem(`${w.name}${w.hasScope ? ' 🔭' : ''}`, `${w.type.toUpperCase()} · Dmg ${STATE.mode==='PVP'&&(typeof PVP_STATS!=='undefined')&&PVP_STATS[w.name]?PVP_STATS[w.name].dmg:w.dmg} · ${w.bSpd}m/s`, cost, () => {
                if (addToInventory(new ItemWeapon(w))) {
                    STATE.mon -= cost; updateShopMoney();
                    notice(w.name + ' ACQUIRED');
                    populateShop();
                } else notice('INVENTORY FULL');
            }));
        }
        
        
    } else if (activeShopType === 'ammo') {
        const aHeader = document.createElement('div');
        aHeader.className = 'shop-section-label'; aHeader.textContent = 'AMMUNITION SUPPLY';
        list.appendChild(aHeader);
        for (const [ammoType, data] of Object.entries(AMMO_DATA)) {
            list.appendChild(createShopItem(`🔋 ${ammoType.toUpperCase()} Ammo`, `+${data.buyAmount} Rounds · Max Stack: ${data.maxStack}`, data.price, () => {
                if (addAmmoToInventory(ammoType, data.buyAmount)) {
                    STATE.mon -= data.price; updateShopMoney(); notice(ammoType.toUpperCase() + ' AMMO PURCHASED'); updateWeaponHUD();
                } else notice('INVENTORY FULL');
            }));
        }
    } else {
        const aHeader = document.createElement('div');
        aHeader.className = 'shop-section-label'; aHeader.textContent = 'CROW MERCHANT — TACTICAL';
        list.appendChild(aHeader);
        
        for (const poolItem of (STATE.crowShopItems || [])) {
            if (poolItem.type === 'armor') {
                let a = poolItem.item;
                list.appendChild(createShopItem(a.name, `${a.mit * 100}% Dmg Mit · ${a.dur} Durability`, a.cost, () => {
                    if (addToInventory(new ItemArmor(a))) {
                        STATE.mon -= a.cost; updateShopMoney();
                        notice(a.name.toUpperCase() + ' PURCHASED INTO INVENTORY');
                        populateShop();
                    } else notice('INVENTORY FULL');
                }));
            } else if (poolItem.type === 'helmet') {
                let h = poolItem.item;
                list.appendChild(createShopItem(h.name, `${h.mit * 100}% Mit · ${h.dur} Dur`, h.cost, () => {
                    if (addToInventory(new ItemHelmet(h))) {
                        STATE.mon -= h.cost; updateShopMoney();
                        notice(h.name.toUpperCase() + ' PURCHASED INTO INVENTORY');
                        populateShop();
                    } else notice('INVENTORY FULL');
                }));
            } else if (poolItem.type === 'medkit') {
                list.appendChild(createShopItem('🩹 Medkit', 'Heals 2 HP/s for 20s (5s Cast)', 750, () => {
                    if (addToInventory(new ItemMedkit())) { STATE.mon -= 750; updateShopMoney(); notice('MEDKIT PURCHASED'); } else notice('INVENTORY FULL');
                }));
            } else if (poolItem.type === 'large-medkit') {
                list.appendChild(createShopItem('🚑 Large Medkit', 'Heals 5 HP/s for 20s (7s Cast)', 2000, () => {
                    if (addToInventory(new ItemLargeMedkit())) { STATE.mon -= 2000; updateShopMoney(); notice('LARGE MEDKIT PURCHASED'); } else notice('INVENTORY FULL');
                }));
            } else if (poolItem.type === 'repair-vest') {
                list.appendChild(createShopItem('🔧 Vest Repair Kit', 'Repairs 25% Vest Durability', 500, () => {
                    if (addToInventory(new ItemRepairKit(false))) { STATE.mon -= 500; updateShopMoney(); notice('VEST REPAIR KIT PURCHASED'); } else notice('INVENTORY FULL');
                }));
            } else if (poolItem.type === 'repair-helmet') {
                list.appendChild(createShopItem('🔧 Helmet Repair Kit', 'Repairs 25% Helmet Durability', 500, () => {
                    if (addToInventory(new ItemRepairKit(true))) { STATE.mon -= 500; updateShopMoney(); notice('HELMET REPAIR KIT PURCHASED'); } else notice('INVENTORY FULL');
                }));
            } else if (poolItem.type === 'grenade') {
                list.appendChild(createShopItem('💣 M67 Grenade', '50 Dmg · 6m Stun Radius · 3s Fuse (Max Stack 2)', 500, () => {
                    if (addToInventory(new ItemGrenade())) { STATE.mon -= 500; updateShopMoney(); notice('GRENADE PURCHASED'); } else notice('INVENTORY FULL');
                }));
            } else if (poolItem.type === 'bandage') {
                list.appendChild(createShopItem('🩹 Bandage', 'Heals 1 HP/s for 10s (Max Stack 4)', 500, () => {
                    if (addToInventory(new ItemBandage())) { STATE.mon -= 500; updateShopMoney(); notice('BANDAGE PURCHASED'); } else notice('INVENTORY FULL');
                }));
            }
        }

        const bpHeader = document.createElement('div');
        bpHeader.className = 'shop-section-label'; bpHeader.textContent = 'CROW MERCHANT — BACKPACKS';
        list.appendChild(bpHeader);
        
        list.appendChild(createShopItem("Traveler's Backpack", "Grants +8 Inventory Slots", 3000, () => {
            if (addToInventory(new ItemBackpackTraveler())) { STATE.mon -= 3000; updateShopMoney(); notice('TRAVELER\'S BACKPACK PURCHASED'); populateShop(); } else notice('INVENTORY FULL');
        }));
        list.appendChild(createShopItem("Military Backpack", "Grants +15 Inventory Slots", 5000, () => {
            const hasReq = inventoryStorage.some(item => item && item.name === 'Red Floppy Disk' && item.amount >= 1);
            if (!hasReq) { notice('MISSING: RED FLOPPY DISK'); return; }
            if (addToInventory(new ItemBackpackMilitary())) {
                const reqIdx = inventoryStorage.findIndex(item => item && item.name === 'Red Floppy Disk' && item.amount >= 1);
                if (inventoryStorage[reqIdx].amount > 1) inventoryStorage[reqIdx].amount--; else inventoryStorage[reqIdx] = null;
                STATE.mon -= 5000; updateShopMoney(); notice('MILITARY BACKPACK PURCHASED'); populateShop();
            } else notice('INVENTORY FULL');
        }, 'Red Floppy Disk'));
        list.appendChild(createShopItem("Duffle Bag", "Grants +30 Inventory Slots", 12000, () => {
            const hasReq = inventoryStorage.some(item => item && item.name === 'Black Floppy Disk' && item.amount >= 1);
            if (!hasReq) { notice('MISSING: BLACK FLOPPY DISK'); return; }
            if (addToInventory(new ItemBackpackDuffle())) {
                const reqIdx = inventoryStorage.findIndex(item => item && item.name === 'Black Floppy Disk' && item.amount >= 1);
                if (inventoryStorage[reqIdx].amount > 1) inventoryStorage[reqIdx].amount--; else inventoryStorage[reqIdx] = null;
                STATE.mon -= 12000; updateShopMoney(); notice('DUFFLE BAG PURCHASED'); populateShop();
            } else notice('INVENTORY FULL');
        }, 'Black Floppy Disk'));
    }
}



// ============================================================
// AIMBOT HELPER
// ============================================================
function isAimKeyPressed(keySetting) {
    if (!keySetting) return true;
    const k = keySetting.toLowerCase();
    if (k === 'always') return true;
    if (k === 'mouse1') return Input.lc === 1;
    if (k === 'mouse2') return STATE.isADS;
    if (k === 'shift') return Input.sh === 1;
    return true;
}

function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(255, 0, 68, ${alpha})`;
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return `rgba(${[(c >> 16) & 255, (c >> 8) & 255, c & 255].join(', ')}, ${alpha})`;
    }
    return hex;
}

function getRainbowColor(alpha = 1.0) {
    const hue = (Date.now() / 15) % 360;
    return alpha === 1.0 ? `hsl(${hue}, 100%, 50%)` : `hsla(${hue}, 100%, 50%, ${alpha})`;
}

function isHostileZombie(e) {
    return e && (e.t === 'z' || e.t === 'sz' || e.t === 'bz' || e.t === 'tz' || e.t === 'cz' || e.t === 'rz' || e.t === 'jz' || e.t === 'player');
}

function getAimbotTarget() {
    if (!ADMIN.aimbot && !ADMIN.silent) return null;

    let currentFov = 0;
    if (ADMIN.aimbot) currentFov = Math.max(currentFov, ADMIN.fov);
    if (ADMIN.silent) currentFov = Math.max(currentFov, ADMIN.silentFov);

    let bestVal = Infinity, bestE = null;
    const prio = ADMIN.targetPriority || 'closest';

    for (const e of lastRenderEnts) {
        if (!e.active || e.t === 'g' || e.t === 'c' || e.t === 'shop' || e.t === 'crow' || e.t === 'ammo_shop' || e.t === 'fd' || e.t === 'w_svd' || e.t === 'w_pkm' || !e.vT) continue;
        
        // Use cached vertical bounding coordinates if available, otherwise screen center
        const entityY = (e.sT !== undefined && e.sT !== 0) ? (e.sT + (e.sB - e.sT) * 0.4) : (scrH / 2);
        const dx = e.ssX - mouseX;
        const dy = entityY - mouseY;
        const screenDist = Math.hypot(dx, dy);

        if (screenDist < currentFov && (e.los || ADMIN.noclip)) {
            if (prio === 'closest') {
                if (e.d < bestVal) {
                    bestVal = e.d;
                    bestE = e;
                }
            } else if (prio === 'lowest-health') {
                if (e.hp < bestVal) {
                    bestVal = e.hp;
                    bestE = e;
                }
            } else if (prio === 'crosshair') {
                if (screenDist < bestVal) {
                    bestVal = screenDist;
                    bestE = e;
                }
            }
        }
    }
    return bestE;
}

function getTriggerTarget() {
    if (!ADMIN.triggerbot) return null;
    let best = Infinity, bestE = null;
    for (const e of lastRenderEnts) {
        if (!e.active || e.t === 'g' || e.t === 'c' || e.t === 'shop' || e.t === 'crow' || e.t === 'ammo_shop' || e.t === 'fd' || e.t === 'w_svd' || e.t === 'w_pkm' || !e.vT) continue;
        const screenDist = Math.abs(e.ssX - scrW / 2);
        if (screenDist < 40 && e.d < best && (e.los || ADMIN.noclip)) {
            best = e.d; bestE = e;
        }
    }
    return bestE;
}


// ============================================================
// INPUT
// ============================================================
const Input = { w: 0, a: 0, s: 0, d: 0, mx: 0, my: 0, lc: 0, sh: 0, space: 0, c: 0, ctrl: 0 };

window.addEventListener('keydown', e => {
    if (e.code === 'KeyW') Input.w = 1;
    if (e.code === 'KeyS') Input.s = 1;
    if (e.code === 'KeyA') Input.a = 1;
    if (e.code === 'KeyD') Input.d = 1;
    if (e.code === 'Tab') {
        e.preventDefault();
        const sb = document.getElementById('scoreboard-overlay');
        if (sb && STATE.mode === 'PVP') sb.style.display = 'block';
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') Input.sh = 1;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') Input.ctrl = 1;
    if (e.code === 'Space') {
        Input.space = 1;
        if (!STATE.isJ && STATE.mod === 'PLAY' && !ADMIN.noclip) {
            if (Player.stm >= 15 || ADMIN.infiniteStamina) {
                STATE.isJ = true; STATE.jV = ADMIN.jumpVal;
                if (!ADMIN.infiniteStamina) Player.stm -= 15;
            }
        }
    }
    if (e.code === 'KeyC') Input.c = 1;
    if (e.code === 'KeyR' && STATE.mod === 'PLAY') rldW();
    if (e.code === 'KeyE' && !e.repeat) {
        if (STATE.mod === 'PLAY') openInventory();
        else if (STATE.mod === 'INV') closeInventory();
    }
    if (e.code === 'KeyH') {
        ADMIN.freezeEnv = !ADMIN.freezeEnv;
        if (ADMIN.freezeEnv) {
            STATE.isH = true;
            document.exitPointerLock();
        } else if (STATE.mod === 'PLAY') {
            canvas.requestPointerLock();
        }
        notice('ENVIRONMENT ' + (ADMIN.freezeEnv ? 'FROZEN' : 'UNFROZEN'));
    }
    if (e.code === 'KeyF' && !e.repeat) {
        if (STATE.mod === 'SHP') closeShop();
        else if (STATE.mod === 'PLAY' && !Input.lc) tryInteract(); // check firing to prevent shop prompt loop
    }
    if (e.code === 'KeyN') {
        if (ADMIN.spectate) advanceSpectate();
        else if (STATE.mod === 'PLAY' && Player.helmet && Player.helmet.hasVisor) {
            Player.visorDown = !Player.visorDown;
            const el = document.getElementById('altyn-visor-overlay');
            if (el) el.style.display = Player.visorDown ? 'block' : 'none';
            notice(Player.visorDown ? 'VISOR DOWN' : 'VISOR UP');
        }
    }
    if (e.code === 'KeyG' && STATE.mod === 'PLAY') {
        const gIdx = inventoryStorage.findIndex(i => i && i.type === 'grenade');
        if (gIdx >= 0) {
            STATE.holdingG = !STATE.holdingG;
            STATE.chargingGrenade = false; // cancel any charge on stow
            notice(STATE.holdingG ? '💣 GRENADE EQUIPPED — Hold LMB to charge' : 'GRENADE STOWED');
        } else {
            notice('NO GRENADES IN INVENTORY');
        }
    }
    // Number keys for hotbar
    if ((e.code === 'Digit1' || e.key === '1') && (STATE.mod === 'PLAY' || STATE.mod === 'INV')) {
        if (Player.inv[0]) {
            Player.curW = 0;
            STATE.holdingG = false;
            updateWeaponHUD();
            renderInventoryUI();
        }
    }
    for (let i = 2; i <= 5; i++) {
        if ((e.code === 'Digit' + i || e.key === i.toString()) && (STATE.mod === 'PLAY' || STATE.mod === 'INV')) {
            useQuickslot(i - 2);
        }
    }
});
window.addEventListener('keyup', e => {
    if (e.code === 'KeyW') Input.w = 0;
    if (e.code === 'KeyS') Input.s = 0;
    if (e.code === 'KeyA') Input.a = 0;
    if (e.code === 'KeyD') Input.d = 0;
    if (e.code === 'Tab') {
        const sb = document.getElementById('scoreboard-overlay');
        if (sb) sb.style.display = 'none';
    }
    if (e.code === 'Space') Input.space = 0;
    if (e.code === 'KeyC') Input.c = 0;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') Input.ctrl = 0;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') Input.sh = 0;
    if (e.code === 'KeyG' && STATE.mod === 'PLAY') {
        // G keyup does nothing — throw is on LMB release
    }
});

// ============================================================
// PAUSE MENU
// ============================================================
let STATE_renderDist = 80; // default DDA steps

function openPauseMenu() {
    document.exitPointerLock();
    const el = document.getElementById('pause-overlay');
    el.style.display = 'flex';
    STATE.mod = 'PAUSE';
}
function closePauseMenu() {
    document.getElementById('pause-overlay').style.display = 'none';
    document.getElementById('pause-settings-panel').style.display = 'none';
    const stPanel = document.getElementById('pause-stats-panel');
    if (stPanel) stPanel.style.display = 'none';
    STATE.mod = 'PLAY';
    canvas.requestPointerLock();
}

document.getElementById('pause-resume-btn').addEventListener('click', closePauseMenu);

document.getElementById('pause-settings-btn').addEventListener('click', () => {
    const p = document.getElementById('pause-settings-panel');
    const s = document.getElementById('pause-stats-panel');
    if (s) s.style.display = 'none';
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('pause-stats-btn').addEventListener('click', () => {
    const p = document.getElementById('pause-settings-panel');
    const s = document.getElementById('pause-stats-panel');
    if (p) p.style.display = 'none';
    if (s) {
        s.style.display = s.style.display === 'none' ? 'block' : 'none';
        if (s.style.display === 'block') {
            document.getElementById('stat-highest-wave').textContent = STORAGE.data.highestWave || 1;
            document.getElementById('stat-zombies-killed').textContent = STORAGE.data.totalKills || 0;
            document.getElementById('stat-times-died').textContent = STORAGE.data.deaths || 0;
            document.getElementById('stat-total-coin').textContent = '$' + (STORAGE.data.totalCoinsEarned || 0);
            
            let secs = Math.floor(STORAGE.data.playtime || 0);
            let hrs = Math.floor(secs / 3600);
            secs %= 3600;
            let mins = Math.floor(secs / 60);
            secs %= 60;
            document.getElementById('stat-playtime').textContent = 
                String(hrs).padStart(2, '0') + ':' + 
                String(mins).padStart(2, '0') + ':' + 
                String(secs).padStart(2, '0');
        }
    }
});

document.getElementById('pause-quit-btn').addEventListener('click', () => {
    window.close();
    // Fallback for browsers that block window.close()
    document.body.innerHTML = '<div style="position:fixed;inset:0;background:#000;display:flex;align-items:center;justify-content:center;font-family:monospace;color:#555;font-size:18px;">Session ended. You may close this tab.</div>';
});

const renderDistSlider = document.getElementById('render-dist-slider');
const renderDistLbl = document.getElementById('render-dist-lbl');
const renderDistSliderMenu = document.getElementById('render-dist-slider-menu');
const renderDistLblMenu = document.getElementById('render-dist-lbl-menu');
function updateRenderDistLabel(v) {
    if (v <= 30) return 'Very Low';
    if (v <= 45) return 'Low';
    if (v <= 60) return 'Medium';
    if (v <= 80) return 'High';
    return 'Ultra';
}
function applyRenderDist(v) {
    STATE_renderDist = v;
    const label = updateRenderDistLabel(v);
    const pct = ((v - 20) / 80 * 100).toFixed(1) + '%';
    if (renderDistLbl) renderDistLbl.textContent = label;
    if (renderDistLblMenu) renderDistLblMenu.textContent = label;
    if (renderDistSlider) { renderDistSlider.style.setProperty('--pct', pct); renderDistSlider.style.background = `linear-gradient(90deg,#e54028 ${pct},#222 ${pct})`; }
    if (renderDistSliderMenu) { renderDistSliderMenu.style.background = `linear-gradient(90deg,#e54028 ${pct},rgba(255,255,255,0.1) ${pct})`; renderDistSliderMenu.value = v; }
}
if (renderDistSlider) renderDistSlider.addEventListener('input', () => applyRenderDist(parseInt(renderDistSlider.value)));
if (renderDistSliderMenu) renderDistSliderMenu.addEventListener('input', () => applyRenderDist(parseInt(renderDistSliderMenu.value)));

const graphicsQualitySlider = document.getElementById('graphics-quality-slider');
const graphicsQualityLbl = document.getElementById('graphics-quality-lbl');
const graphicsQualitySliderMenu = document.getElementById('graphics-quality-slider-menu');
const graphicsQualityLblMenu = document.getElementById('graphics-quality-lbl-menu');
function updateGraphicsQualityLabel(v) {
    if (v === 1) return 'Low';
    if (v === 2) return 'Medium';
    if (v === 3) return 'High';
    return 'Ultra';
}
function applyGraphicsQuality(v) {
    const label = updateGraphicsQualityLabel(v);
    const pct = ((v - 1) / 3 * 100).toFixed(1) + '%';
    if (graphicsQualityLbl) graphicsQualityLbl.textContent = label;
    if (graphicsQualityLblMenu) graphicsQualityLblMenu.textContent = label;
    if (graphicsQualitySlider) { graphicsQualitySlider.style.setProperty('--pct', pct); graphicsQualitySlider.style.background = `linear-gradient(90deg,#e54028 ${pct},#222 ${pct})`; }
    if (graphicsQualitySliderMenu) { graphicsQualitySliderMenu.style.background = `linear-gradient(90deg,#e54028 ${pct},rgba(255,255,255,0.1) ${pct})`; graphicsQualitySliderMenu.value = v; }
    if (v === 1) STATE_renderStep = 4;
    else if (v === 2) STATE_renderStep = 3;
    else if (v === 3) STATE_renderStep = 2;
    else STATE_renderStep = 1;
}
if (graphicsQualitySlider) graphicsQualitySlider.addEventListener('input', () => applyGraphicsQuality(parseInt(graphicsQualitySlider.value)));
if (graphicsQualitySliderMenu) graphicsQualitySliderMenu.addEventListener('input', () => applyGraphicsQuality(parseInt(graphicsQualitySliderMenu.value)));

const mouseSensSlider = document.getElementById('mouse-sens-slider');
const mouseSensLbl = document.getElementById('mouse-sens-lbl');
const mouseSensSliderMenu = document.getElementById('mouse-sens-slider-menu');
const mouseSensLblMenu = document.getElementById('mouse-sens-lbl-menu');

function applyMouseSens(v) {
    const floatV = v / 10;
    STATE.sensitivity = floatV;
    const label = floatV.toFixed(1) + 'x';
    const pct = ((v - 1) / 49 * 100).toFixed(1) + '%';
    if (mouseSensLbl) mouseSensLbl.textContent = label;
    if (mouseSensLblMenu) mouseSensLblMenu.textContent = label;
    if (mouseSensSlider) { mouseSensSlider.style.setProperty('--pct', pct); mouseSensSlider.style.background = `linear-gradient(90deg,#e54028 ${pct},#222 ${pct})`; }
    if (mouseSensSliderMenu) { mouseSensSliderMenu.style.background = `linear-gradient(90deg,#e54028 ${pct},rgba(255,255,255,0.1) ${pct})`; mouseSensSliderMenu.value = v; }
}

if (mouseSensSlider) mouseSensSlider.addEventListener('input', () => applyMouseSens(parseInt(mouseSensSlider.value)));
if (mouseSensSliderMenu) mouseSensSliderMenu.addEventListener('input', () => applyMouseSens(parseInt(mouseSensSliderMenu.value)));

// ESC key handler — intercepts before browser behavior
window.addEventListener('keydown', e => {
    if (e.code === 'Escape') {
        e.preventDefault();
        if (STATE.mod === 'PAUSE') { closePauseMenu(); return; }
        if (STATE.mod === 'PLAY') { openPauseMenu(); return; }
        // Close other overlays first
        if (STATE.mod === 'INV') { closeInventory(); return; }
        if (STATE.mod === 'SHP') { closeShop(); return; }
    }
}, true); // capture phase so it fires before game keydown


canvas.addEventListener('mousedown', e => {
    if (STATE.mod !== 'PLAY') {
        if (STATE.mod === 'SHP') closeShop();
        else if (STATE.mod === 'INV') closeInventory();
        try { canvas.requestPointerLock(); } catch(err) {}
        return;
    }
    if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
    if (STATE.usingItemIndex !== undefined && STATE.usingItemIndex >= 0) return; // Block attack/ads while casting
    if (e.button === 0) {
        if (STATE.holdingG && !STATE.chargingGrenade) {
            // Start grenade charge on LMB hold
            STATE.chargingGrenade = true;
            STATE.grenadeChargeStart = performance.now();
            notice('CHARGING GRENADE...');
        } else {
            Input.lc = 1;
        }
    }
    if (e.button === 2) {
        STATE.isADS = true;
        if (Player.get().hasScope) STATE.fTarg = 0.2;
        else if (Player.get().name === 'M110K') STATE.fTarg = 0.83;
        else STATE.fTarg = 1.0;
    }
});
canvas.addEventListener('mouseup', e => {
    if (e.button === 0) {
        if (STATE.chargingGrenade) {
            // Release to throw
            const heldTime = performance.now() - STATE.grenadeChargeStart;
            const maxChargeTime = 1500;
            const chargePct = Math.min(1.0, heldTime / maxChargeTime);
            throwGrenade(chargePct);
        }
        Input.lc = 0;
    }
    if (e.button === 2) { STATE.isADS = false; STATE.fTarg = 1.0; }
});
window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) {
        Input.mx += e.movementX;
        Input.my += e.movementY;
        mouseX = scrW / 2;
        mouseY = scrH / 2;
    } else {
        const rect = canvas.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width) * scrW;
        mouseY = ((e.clientY - rect.top) / rect.height) * scrH;
    }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
        // Pointer lock acquired — if we were paused, resume
        if (STATE.mod === 'PAUSE') {
            STATE.mod = 'PLAY';
            return;
        }
        // If game is already running (started via startMatch), just set mod
        if (isRunning) {
            STATE.mod = 'PLAY';
            return;
        }
        // Fallback: start from pointer lock if somehow not started yet
        STATE.mod = 'PLAY';
        isRunning = true;
        STATE.last = performance.now();
        if (!loopId) loopId = requestAnimationFrame(tick);
        const mo2 = document.getElementById('menu-overlay');
        if (mo2) mo2.style.display = 'none';
        document.getElementById('shop-overlay').style.display = 'none';
        document.getElementById('inventory-overlay').classList.remove('open');
        STATE.isP = false;
    } else {
        // Pointer lock lost
        if (STATE.mod === 'PLAY') {
            // Don't open pause if we're in the middle of deploying (pointer lock may fail from non-canvas click)
            if (STATE._deploying) return;
            if (!STATE.isH) openPauseMenu(); else STATE.isH = false;
            return;
        }
        if (STATE.mod !== 'SHP' && STATE.mod !== 'INV' && STATE.mod !== 'DEAD' && STATE.mod !== 'PAUSE' && !STATE.isP && !STATE.isH) {
            STATE.mod = 'MENU';
            const mo = document.getElementById('menu-overlay');
            if (mo) mo.style.display = '';
        }
        STATE.isH = false;
        Input.lc = 0; STATE.isADS = false; STATE.fTarg = 1.0;
    }
});

// Click canvas during play to acquire pointer lock
canvas.addEventListener('click', () => {
    if (STATE.mod === 'PLAY' && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch(e) {}
    }
});

// Helper: properly return to main menu with new sidebar layout
function showMenu() {
    document.getElementById('menu-overlay').style.display = '';
    // Reset nav to Play tab
    document.querySelectorAll('.menu-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
    const playBtn = document.getElementById('nav-play');
    const playScreen = document.getElementById('mode-choice-screen');
    if (playBtn) playBtn.classList.add('active');
    if (playScreen) {
        playScreen.classList.add('active');
        // Reset inner state
        const grid = playScreen.querySelector('.menu-mode-grid');
        if (grid) grid.style.display = '';
    }
    const lobby = document.getElementById('pvp-lobby-screen');
    if (lobby) lobby.style.display = 'none';
}

// Mode Selection and Lobby Handlers
document.getElementById('btn-deploy-solo').addEventListener('click', () => {
    STATE.mode = 'SURVIVAL';
    startMatch();
});
document.getElementById('btn-enter-lobby').addEventListener('click', () => {
    const grid = document.querySelector('#mode-choice-screen .menu-mode-grid');
    if (grid) grid.style.display = 'none';
    document.getElementById('pvp-lobby-screen').style.display = 'block';
    // Reset code display
    const lobbyCodeEl = document.getElementById('lobby-join-code-disp');
    if (lobbyCodeEl) { lobbyCodeEl.style.fontSize = '10px'; lobbyCodeEl.textContent = 'ENTER CODE BELOW TO JOIN'; }
});

document.getElementById('lobby-back-btn').addEventListener('click', () => {
    const grid = document.querySelector('#mode-choice-screen .menu-mode-grid');
    if (grid) grid.style.display = '';
    document.getElementById('pvp-lobby-screen').style.display = 'none';
    // Destroy peer if we go back before starting
    if (peer && !STATE.mod !== 'PLAY') { peer.destroy(); peer = null; }
});

document.getElementById('lobby-create-btn').addEventListener('click', () => {
    STATE.mode = 'PVP';
    STATE.isHost = true;
    // Initialize peer FIRST (to get room code), then startMatch when game loop starts
    const lobbyCodeEl = document.getElementById('lobby-join-code-disp');
    if (lobbyCodeEl) { lobbyCodeEl.style.fontSize = '10px'; lobbyCodeEl.textContent = 'GENERATING CODE...'; }
    NET.init(); // This sets up the peer and shows the code
    startMatch();
});

document.getElementById('lobby-join-btn').addEventListener('click', () => {
    const code = document.getElementById('lobby-join-input').value.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!code || code.length < 4) { notice('ENTER VALID ROOM CODE'); return; }
    
    STATE.mode = 'PVP';
    STATE.isHost = false;
    
    if (typeof Peer === 'undefined') {
        notice('PEERJS NOT LOADED — CHECK INTERNET');
        return;
    }
    
    NET.init();
    // Small delay to let peer open before connecting
    setTimeout(() => NET.connect(code), 500);
});

function startMatch() {
    // Hide menu and start game immediately — don't depend on pointerlockchange firing
    const mo = document.getElementById('menu-overlay');
    if (mo) mo.style.display = 'none';

    // Set deploying flag to prevent pointerlockchange from opening pause menu
    // when requestPointerLock fails (not called from canvas gesture)
    STATE._deploying = true;
    setTimeout(() => { STATE._deploying = false; }, 500);

    ents = []; bullets = [];
    STATE.mod = 'PLAY';
    STATE.chargingGrenade = false;
    STATE.killStreak = 0;
    STATE.killStreakTimer = 0;
    STATE.waveCountdownEnd = 0;
    const ksEl = document.getElementById('hud-killstreak');
    const wcdEl2 = document.getElementById('hud-wave-countdown');
    if (ksEl) ksEl.style.display = 'none';
    if (wcdEl2) wcdEl2.style.display = 'none';

    if (STATE.mode === 'SURVIVAL') {
        notice('DEPLOYING TO SURVIVAL ZONE...');
        document.getElementById('hud-wave').style.display = 'flex';
        spawnGrass();
        spawnShops();
        spawnWave();
    } else {
        STATE.pvpTimer = 600;
        Player.hp = 100;
        Player.armor = null;
        Player.helmet = null;
        Player.inv = [Arsenal[0], Arsenal[1]]; // M4A1 and Glock
        Player.curW = 0;
        STATE.scores = {};
        updateScoreboard();
        
        genPvPMap();
        
        // Spawn PVP Global Shop
        const shop = new Entity(Math.floor(MAP_SZ/2) + 0.5, Math.floor(MAP_SZ/2) + 0.5, 'shop');
        shop.r = 0.8; ents.push(shop);
        
        document.getElementById('hud-wave').style.display = 'none';
        if (STATE.isHost) {
            document.getElementById('host-panel').style.display = 'block';
            document.getElementById('host-join-code').textContent = STATE.joinCode || '...';
            document.getElementById('host-ip-info').textContent = '192.168.1.' + Math.floor(Math.random() * 254);
            notice('WORLD CREATED: ' + STATE.joinCode);
        } else {
            document.getElementById('client-hub').style.display = 'block';
            document.getElementById('client-room-code').textContent = STATE.joinCode;
        }
    }

    updateWeaponHUD();
    STATE.last = performance.now();
    isRunning = true;
    if (!loopId) loopId = requestAnimationFrame(tick);

    // Request pointer lock best-effort (player can also click canvas to lock)
    // Modern browsers return a Promise from requestPointerLock
    try {
        const lockPromise = canvas.requestPointerLock();
        if (lockPromise && lockPromise.catch) lockPromise.catch(() => {});
    } catch(e) {}
}


// ============================================================
// COLOR / TEXTURE HELPERS
// ============================================================
function aHx(hex, amt) {
    if (hex[0] === '#') hex = hex.slice(1);
    const n = parseInt(hex, 16);
    const r = Math.min(255, Math.max(0, ((n >> 16) & 0xFF) + amt));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xFF) + amt));
    const b = Math.min(255, Math.max(0, (n & 0xFF) + amt));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Per-column textured wall color
const TEX_SIZE = 64;
const texCache = {};

function initTextures() {
    const createTex = (fn) => {
        const c = document.createElement('canvas');
        c.width = TEX_SIZE; c.height = TEX_SIZE;
        const xCtx = c.getContext('2d', { willReadFrequently: true });
        const imgData = xCtx.createImageData(TEX_SIZE, TEX_SIZE);
        for (let y = 0; y < TEX_SIZE; y++) {
            for (let x = 0; x < TEX_SIZE; x++) {
                const i = (y * TEX_SIZE + x) * 4;
                const [r, g, b] = fn(x, y);
                imgData.data[i] = r; imgData.data[i+1] = g; imgData.data[i+2] = b; imgData.data[i+3] = 255;
            }
        }
        xCtx.putImageData(imgData, 0, 0);
        return c;
    };

    // 1: Plain Concrete — smooth grey with faint panel lines only
    texCache[1] = createTex((x, y) => {
        // Very subtle noise for surface grain
        const n = (Math.sin(x * 7.3 + y * 3.1) * 0.5 + 0.5) * 8;
        // Faint horizontal panel seam every 32px
        const seam = (y % 32 === 0 || y % 32 === 1) ? -18 : 0;
        const base = 115 + n + seam;
        return [base, base, base + 4];
    });

    // 2: Metal Panel
    texCache[2] = createTex((x, y) => {
        const isSeam = y % 32 < 2 || x % 64 < 2;
        const rust = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 30 + Math.random() * 15;
        if (isSeam) return [40, 45, 50];
        return [130 + rust, 140 + rust*0.8, 150 + rust*0.5];
    });

    // 6: Dense Veg
    texCache[6] = createTex((x, y) => {
        const leaf = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 40 + Math.random() * 20;
        return [20 + leaf, 60 + leaf, 30 + leaf];
    });

    // 7: Light Veg
    texCache[7] = createTex((x, y) => {
        const leaf = Math.sin(x * 0.3) * Math.sin(y * 0.4) * 50 + Math.random() * 25;
        return [40 + leaf, 90 + leaf, 50 + leaf];
    });

    // 8: Wood Crate
    texCache[8] = createTex((x, y) => {
        const isEdge = x < 4 || x > 60 || y < 4 || y > 60 || Math.abs(x - y) < 3 || Math.abs(x - (64 - y)) < 3;
        const grain = Math.sin(y * 0.5 + Math.sin(x * 0.1) * 5) * 20 + Math.random() * 10;
        if (isEdge) return [60, 40, 20];
        return [120 + grain, 85 + grain, 50 + grain];
    });

    // 3: Dark Concrete / Bunker
    texCache[3] = createTex((x, y) => {
        const n = (Math.sin(x * 5.1 + y * 2.7) * 0.5 + 0.5) * 6;
        const seam = (y % 16 === 0 || y % 16 === 1) ? -22 : 0;
        const base = 72 + n + seam;
        return [base, base, base + 2];
    });

    // 4: Brick
    texCache[4] = createTex((x, y) => {
        const brickY = Math.floor(y / 8);
        const offsetX = (brickY % 2) * 16;
        const bx = (x + offsetX) % 32;
        const isGrout = bx < 2 || y % 8 < 1;
        const grain = Math.sin(x * 0.4 + y * 0.3) * 15;
        if (isGrout) return [80, 75, 70];
        return [Math.min(255, 160 + grain), Math.min(255, 80 + grain * 0.5), Math.min(255, 60 + grain * 0.3)];
    });

    // 5: Sand / Rock
    texCache[5] = createTex((x, y) => {
        const n = Math.sin(x * 0.8 + y * 1.2) * 20 + Math.sin(x * 2.1) * 10;
        return [Math.min(255, 180 + n), Math.min(255, 160 + n * 0.8), Math.min(255, 100 + n * 0.5)];
    });

    // 'floor': Tactical asphalt — dark with subtle crack lines
    texCache['floor'] = createTex((x, y) => {
        const crack = (Math.abs(Math.sin(x * 0.31 + y * 0.17) * Math.cos(x * 0.09 - y * 0.27)) < 0.06) ? -14 : 0;
        const grain = (Math.sin(x * 1.7 + y * 2.3) * 0.5 + 0.5) * 6;
        const base = 38 + grain + crack;
        return [base, base + 1, base + 4];
    });

    texCache['default'] = createTex((x, y) => {
        const noise = Math.random() * 20;
        return [100 + noise, 100 + noise, 110 + noise];
    });

    // Cache floor pixel data once so floor casting never calls getImageData per-frame
    const _fCtx = texCache['floor'].getContext('2d', { willReadFrequently: true });
    floorPxCache = _fCtx.getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
}
initTextures();

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}


// ============================================================
// RAYCASTER  (DDA — fixed bounds check)
// ============================================================
function dRay(CAM, pit = STATE.pit) {
    const activeFMult = STATE.fMult * (ADMIN.fovIncreaser || 1.0);
    const effPit = pit / activeFMult;
    const horizon = Math.floor(scrH / 2 + effPit);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
    if (ADMIN.customSky) {
        sky.addColorStop(0, hexToRgba(ADMIN.skyColor, ADMIN.skyBrightness));
        sky.addColorStop(1, hexToRgba(ADMIN.skyColor, ADMIN.skyBrightness * 0.5));
    } else {
        sky.addColorStop(0, '#111820'); sky.addColorStop(1, '#344055');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, scrW, Math.max(1, horizon));

    // Floor gradient (restored — floor casting re-implementation pending)
    const flr = ctx.createLinearGradient(0, Math.max(0, horizon), 0, scrH);
    flr.addColorStop(0, '#1c2028'); flr.addColorStop(0.5, '#242830'); flr.addColorStop(1, '#2e333d');
    ctx.fillStyle = flr;
    ctx.fillRect(0, Math.max(0, horizon), scrW, scrH);

    const pXS = CAM.px * activeFMult;
    const pYS = CAM.py * activeFMult;

    if (!STATE.cullY || STATE.cullY.length !== scrW) {
        STATE.cullY = new Int32Array(scrW);
        STATE.cullZ = new Float64Array(scrW);
    }

    const step = STATE_renderStep || 1;
    for (let x = 0; x < scrW; x += step) {
        const wW = Math.min(step, scrW - x);
        for (let s = 0; s < wW; s++) {
            STATE.zBuf[x + s] = 9999;
            STATE.cullY[x + s] = scrH;
            STATE.cullZ[x + s] = 0;
        }

        const cx = 2 * (x + wW / 2) / scrW - 1;
        const rayDX = CAM.dx + pXS * cx;
        const rayDY = CAM.dy + pYS * cx;

        let mx = Math.floor(CAM.x), my = Math.floor(CAM.y);
        const ddx = Math.abs(1 / rayDX), ddy = Math.abs(1 / rayDY);
        let sDx, sDy, stepX, stepY, side;

        if (rayDX < 0) { stepX = -1; sDx = (CAM.x - mx) * ddx; }
        else { stepX = 1; sDx = (mx + 1 - CAM.x) * ddx; }
        if (rayDY < 0) { stepY = -1; sDy = (CAM.y - my) * ddy; }
        else { stepY = 1; sDy = (my + 1 - CAM.y) * ddy; }

        let hits = [];
        let rayDist = 9999;
        // High performance DDA (render distance controlled)
        for (let safety = 0; safety < STATE_renderDist; safety++) {
            if (sDx < sDy) { sDx += ddx; mx += stepX; side = 0; }
            else { sDy += ddy; my += stepY; side = 1; }

            if (mx < 0 || mx >= MAP_SZ || my < 0 || my >= MAP_SZ) {
                rayDist = (side === 0) ? (mx - CAM.x + (1 - stepX) / 2) / rayDX : (my - CAM.y + (1 - stepY) / 2) / rayDY;
                hits.push({ pWD: rayDist, side, wallX: 0, wallType: 1, wallH: 2.5 });
                break;
            }

            if (wMap[mx][my] > 0) {
                const dist = (side === 0) ? (mx - CAM.x + (1 - stepX) / 2) / rayDX : (my - CAM.y + (1 - stepY) / 2) / rayDY;
                let wX = (side === 0) ? CAM.y + dist * rayDY : CAM.x + dist * rayDX;
                wX -= Math.floor(wX);
                const dist_exit = Math.min(sDx, sDy);
                hits.push({ pWD: dist, pWD_exit: dist_exit, side, wallX: wX, wallType: wMap[mx][my], wallH: hMap[mx][my] });
                if (hMap[mx][my] >= 1.9 || hits.length >= 3) {
                    rayDist = dist;
                    break; // Break on full-height walls or max hits to prevent lag
                }
            }
            if (safety === STATE_renderDist - 1) {
                rayDist = (side === 0) ? (mx - CAM.x + (1 - stepX) / 2) / rayDX : (my - CAM.y + (1 - stepY) / 2) / rayDY;
            }
        }

        for (let s = 0; s < wW; s++) {
            STATE.zBuf[x + s] = rayDist;
        }

        if (hits.length > 0) {
            for (let i = hits.length - 1; i >= 0; i--) {
                const h = hits[i];
                const lh = (scrH / Math.max(0.01, h.pWD)) / activeFMult;
                const wz = h.wallH;
                const sT = Math.floor(scrH / 2 + effPit - (wz - CAM.z) * lh);
                const sB = Math.floor(scrH / 2 + effPit + CAM.z * lh);
                const dT = Math.max(0, sT), dB = Math.min(scrH - 1, sB);

                ctx.globalAlpha = ADMIN.noclip ? 0.35 : 1.0;

                if (dT <= dB) {
                    const tex = texCache[h.wallType] || texCache['default'];
                    const txX = Math.floor(h.wallX * TEX_SIZE) % TEX_SIZE;
                    // Proportional texture Y — stays pinned to wall geometry regardless of camera height
                    const wallScreenH = Math.max(1, sB - sT);
                    const srcY = Math.max(0, Math.floor(((dT - sT) / wallScreenH) * TEX_SIZE));
                    const srcH = Math.max(1, Math.min(TEX_SIZE - srcY, Math.ceil(((dB - dT + 1) / wallScreenH) * TEX_SIZE)));
                    ctx.drawImage(tex, txX, srcY, 1, srcH, x, dT, wW, dB - dT + 1);
                    
                    if (h.side === 1) {
                        ctx.fillStyle = 'rgba(10,15,20,0.22)';
                        ctx.fillRect(x, dT, wW, dB - dT + 1);
                    }
                }

                // ── Draw physically accurate wall-top surface ─────────────────
                if (CAM.z > wz) {
                    const lh_exit = (scrH / Math.max(0.01, h.pWD_exit)) / activeFMult;
                    const sT_exit = Math.floor(scrH / 2 + effPit - (wz - CAM.z) * lh_exit);
                    
                    const top_dT = Math.max(0, sT_exit);
                    const top_dB = Math.min(scrH - 1, sT); // top meets the front face exactly at sT
                    
                    if (top_dT <= top_dB) {
                        // Pre-darkened colors for performance (no double fillRect/alpha changes needed)
                        const tc = h.wallType === 8 ? '#422812' : h.wallType === 2 ? '#3a4050'
                            : (h.wallType === 6 || h.wallType === 7 ? '#1f381d' : '#2a2a38');
                        ctx.fillStyle = tc;
                        ctx.fillRect(x, top_dT, wW, top_dB - top_dT + 1);
                    }
                    
                    for (let s = 0; s < wW; s++) {
                        STATE.cullY[x + s] = top_dT;
                        STATE.cullZ[x + s] = h.pWD;
                    }
                } else {
                    for (let s = 0; s < wW; s++) {
                        STATE.cullY[x + s] = Math.max(0, sT);
                        STATE.cullZ[x + s] = h.pWD;
                    }
                }
            }
            ctx.globalAlpha = 1.0;
        }
    }
}

// ============================================================
// MAP GENERATION — PvP Symmetrical Arena
// ============================================================
function genPvPMap() {
    genRegularMap();
}


// ============================================================
// SPRITE RENDERER  (3D zombie, z-buffer health bars)
// Lodev formula:
//   tX = invDet * (dirY*sx - dirX*sy)   ← horizontal screen offset
//   tY = invDet * (-planeY*sx + planeX*sy)  ← depth (perp distance)
// ============================================================
function dSpr(CAM, pit = STATE.pit) {
    const activeFMult = STATE.fMult * (ADMIN.fovIncreaser || 1.0);
    const pXS = CAM.px * activeFMult;
    const pYS = CAM.py * activeFMult;
    const det = pXS * CAM.dy - CAM.dx * pYS;
    if (Math.abs(det) < 0.0001) return; // degenerate camera plane — skip frame
    const invD = 1.0 / det;

    // Add player to render list if in third person
    const renderEnts = [...ents];
    if (ADMIN.thirdperson || ADMIN.spectate) {
        renderEnts.push({
            x: Player.x, y: Player.y, z: Player.z,
            t: 'player', active: true, r: 0.3, hp: Player.hp, max: 100
        });
    }
    // Add remote players to render list
    Object.entries(remotePlayers).forEach(([id, p]) => {
        renderEnts.push({
            id: id, x: p.x, y: p.y, z: p.z,
            t: 'player', active: true, r: 0.3, hp: p.hp, max: 100,
            isADS: p.isADS, isJ: p.isJ, anim: p.anim
        });
    });

    // Near-shop prompt
    let showPrompt = false, promptText = '';

    renderEnts.forEach(e => {
        e.d = (CAM.x - e.x) ** 2 + (CAM.y - e.y) ** 2;
        e.vT = false;
        if (e.t === 'shop' || e.t === 'crow' || e.t === 'ammo_shop') {
            const dist = Math.hypot(Player.x - e.x, Player.y - e.y);
            if (dist < 1.5) { showPrompt = true; promptText = `PRESS [F] TO OPEN ${e.t === 'crow' ? "CROW'S SHOP" : (e.t === 'ammo_shop' ? 'AMMO CACHE' : 'BLACK MARKET')}`; }
        }
    });
    renderEnts.sort((a, b) => b.d - a.d);

    let closestTarget = null;
    let closestDist = Infinity;
    for (const e of renderEnts) {
        if (e.active && isHostileZombie(e)) {
            if (e.d < closestDist) {
                closestDist = e.d;
                closestTarget = e;
            }
        }
    }

    if (showPrompt && STATE.mod === 'PLAY') {
        ctx.fillStyle = '#fff'; ctx.font = '14px JetBrains Mono, monospace'; ctx.textAlign = 'center';
        ctx.fillText(promptText, scrW / 2, scrH * 0.75); ctx.textAlign = 'left';
    }

    for (const e of renderEnts) {
        if (!e.active) continue;
        const sx = e.x - CAM.x, sy = e.y - CAM.y;

        // tX = horizontal screen-space position of sprite
        // tY = depth (perpendicular distance into screen) — used for z-buffer
        const tX = invD * (CAM.dy * sx - CAM.dx * sy);   // horizontal
        const tY = invD * (-pYS * sx + pXS * sy);   // depth

        if (tY <= 0.05) continue; // behind camera

        // Screen X centre of sprite
        const ssX = Math.floor((scrW / 2) * (1 + tX / tY));
        // Sprite height on screen (based on depth, not horizontal)
        const sh = Math.abs(scrH / tY) / STATE.fMult;
        const sw = sh * 0.5;
        e.ssX = ssX; e.sh = sh; e.vT = true; e.sT = 0; e.sB = 0;

        const effPit = pit / STATE.fMult;
        const sT = Math.floor(scrH / 2 + effPit - (1.0 - CAM.z) * sh);
        const sB = Math.floor(scrH / 2 + effPit + CAM.z * sh);
        e.sT = sT; e.sB = sB;
        const cX = Math.max(0, Math.floor(ssX - sw / 2));
        const eX = Math.min(scrW - 1, Math.floor(ssX + sw / 2));

        // Centre-column depth check for health bars / ESP
        const centCol = Math.max(0, Math.min(scrW - 1, ssX));
        const isFront = tY < STATE.zBuf[centCol] && (tY <= STATE.cullZ[centCol] || STATE.cullZ[centCol] <= 0 || STATE.cullY[centCol] > sT);

        // Walk animation vars (computed once per entity, used inside column loop)
        const _isZE = e.t==='z'||e.t==='sz'||e.t==='bz'||e.t==='tz'||e.t==='rz'||e.t==='jz';
        const _wp   = e.walkPhase||0;
        const _mov  = _isZE && e.d > 1.2;
        const _legSw   = _mov ? Math.sin(_wp)*sh*0.10 : 0;
        const _armSw   = _mov ? Math.sin(_wp+Math.PI)*sh*0.08 : 0;
        const _headBob = _mov ? Math.abs(Math.sin(_wp))*sh*0.03 : Math.sin(Date.now()/600)*sh*0.012;

        // Loot/NPC ESP
        if (ADMIN.lootEsp) {
            if (e.t === 'c') {
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillStyle = '#ffea00';
                ctx.textAlign = 'center';
                ctx.fillText(`[COIN] ${Math.round(e.d)}m`, ssX, sT);
            } else if (e.t === 'fd') {
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillStyle = e.color === 'red' ? '#ff4444' : '#aaaaaa';
                ctx.textAlign = 'center';
                ctx.fillText(`[FLOPPY] ${Math.round(e.d)}m`, ssX, sT);
            } else if (e.t === 'w_svd') {
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillStyle = '#ff8800';
                ctx.textAlign = 'center';
                ctx.fillText(`[SVD Sniper] ${Math.round(e.d)}m`, ssX, sT);
            } else if (e.t === 'w_pkm') {
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillStyle = '#ff3300';
                ctx.textAlign = 'center';
                ctx.fillText(`[PKM LMG] ${Math.round(e.d)}m`, ssX, sT);
            } else if (e.t === 'shop' || e.t === 'crow' || e.t === 'ammo_shop') {
                ctx.font = '10px JetBrains Mono, monospace';
                ctx.fillStyle = '#00ffcc';
                ctx.textAlign = 'center';
                ctx.fillText(`[MERCHANT] ${Math.round(e.d)}m`, ssX, sT - 10);
            }
        }
        
        // Remote Player Raycast / Line of Sight
        if (e.t === 'player') {
            const sdx = e.x - CAM.x, sdy = e.y - CAM.y, dist = Math.hypot(sdx, sdy);
            e.los = true;
            for (let r = 0; r < dist; r += 0.5) {
                const cx = Math.floor(CAM.x + (sdx / dist) * r);
                const cy = Math.floor(CAM.y + (sdy / dist) * r);
                if (cx >= 0 && cx < MAP_SZ && cy >= 0 && cy < MAP_SZ && wMap[cx][cy] > 0) { e.los = false; break; }
            }
        }

        // Remote Player Nametags
        if (e.t === 'player' && isFront) {
            const tagY = sT - 12;
            ctx.font = '10px JetBrains Mono, monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            const pName = STATE.scores[e.id] ? STATE.scores[e.id].name : e.id.substring(0,6).toUpperCase();
            ctx.fillText(pName, ssX, tagY - 6);
        }

        for (let x = cX; x < eX; x++) {
            // z-buffer: skip pixel if a wall is closer than this sprite
            if (tY >= STATE.zBuf[x] && !ADMIN.esp) continue;

            let clipY = scrH;
            if (tY > STATE.cullZ[x] && STATE.cullZ[x] > 0) clipY = STATE.cullY[x];
            if (clipY <= 0) continue; // Fully occluded by short crate

            const relX = (x - (ssX - sw / 2)) / sw; // 0-1 across sprite width

            // Fast vertical strip drawer that clamps to clipY
            const drawStrip = (yStart, yEnd, color) => {
                const yS = Math.max(0, Math.floor(yStart));
                const yE = Math.min(Math.floor(yEnd), clipY);
                if (yS < yE) {
                    ctx.fillStyle = color;
                    ctx.fillRect(x, yS, 1, yE - yS);
                }
            };

            if (e.t === 'shop' || e.t === 'ammo_shop') {
                // Draw an upgraded tactical stall
                if (tY < STATE.zBuf[x]) {
                    // Main structure
                    drawStrip(sB - sh * 0.45, sB, '#1a1a1a');
                    
                    // Striped Awning (Roof)
                    const stripe = Math.floor(relX * 10) % 2 === 0;
                    const awningCol = (e.t === 'ammo_shop') 
                        ? (stripe ? '#2a5' : '#142') 
                        : (stripe ? '#c62' : '#841');
                    drawStrip(sB - sh * 0.50, sB - sh * 0.42, awningCol);

                    // Counter Top
                    if (relX > 0.05 && relX < 0.95) {
                        drawStrip(sB - sh * 0.38, sB - sh * 0.35, '#333');
                    }

                    // "Items" on counter
                    if (relX > 0.2 && relX < 0.3) {
                        drawStrip(sB - sh * 0.42, sB - sh * 0.38, '#ff3030');
                    }
                    if (relX > 0.7 && relX < 0.8) {
                        drawStrip(sB - sh * 0.42, sB - sh * 0.38, '#30ff30');
                    }
                }
                continue;
            }
            if (e.t === 'crow') {
                // Draw a premium merchant stall + detailed figure
                if (tY < STATE.zBuf[x]) {
                    // Stall body (Dark metallic)
                    if (relX > 0.05 && relX < 0.95) {
                        const stallCol = (relX < 0.08 || relX > 0.92) ? '#333' : '#0f0f0f';
                        drawStrip(sB - sh * 0.42, sB, stallCol);
                    }
                    // Fancy Roof
                    drawStrip(sB - sh * 0.45, sB - sh * 0.40, '#222');
                    
                    // The Crow (Merchant)
                    if (relX > 0.32 && relX < 0.68) {
                        // Cloak
                        drawStrip(sB - sh * 0.60, sB - sh * 0.25, '#050505');
                        
                        // Mask/Head
                        if (relX > 0.42 && relX < 0.58) {
                            drawStrip(sB - sh * 0.70, sB - sh * 0.58, '#1a1a1a');
                            // Glowing Eyes
                            if (relX > 0.45 && relX < 0.55) {
                                const eyeY = sB - sh * 0.66;
                                drawStrip(eyeY, eyeY + Math.max(1, sh * 0.02), '#00ffcc');
                            }
                        }
                    }
                }
                continue;
            }
            // Grass / vegetation tuft — thin blades, fixed width regardless of distance
            if (e.t === 'g') {
                if (tY < STATE.zBuf[x]) {
                    const bladeSlot = Math.floor((x - cX) / Math.max(1, sw / 6));
                    if ((x - cX) % Math.max(1, Math.floor(sw / 6)) === 0) {
                        const tall = bladeSlot % 2 === 0;
                        const bh = tall ? sh * 0.22 : sh * 0.14;
                        const col = tall ? '#5c7a3d' : '#3e5229';
                        drawStrip(sB - bh, sB, col);
                    }
                }
                continue;
            }

            if (e.t === 'c') {
                // Gold coin
                if (tY < STATE.zBuf[x] && relX > 0.3 && relX < 0.7) {
                    const bob = Math.sin(Date.now() / 160 + e.x) * sh * 0.08;
                    const col = (relX > 0.42 && relX < 0.58) ? '#ffea00' : '#d4af37';
                    drawStrip(sB - sh * 0.22 + bob, sB - sh * 0.04 + bob, col);
                }
                continue;
            }

            if (e.t === 'w_svd' || e.t === 'w_pkm') {
                if (tY < STATE.zBuf[x] && relX > 0.15 && relX < 0.85) {
                    const bob = Math.sin(Date.now() / 160 + e.x) * sh * 0.08;
                    const col = e.t === 'w_svd' ? '#bb7722' : '#555555';
                    drawStrip(sB - sh * 0.12 + bob, sB - sh * 0.03 + bob, col);
                    if (e.t === 'w_svd' && relX > 0.4 && relX < 0.6) {
                        drawStrip(sB - sh * 0.18 + bob, sB - sh * 0.12 + bob, '#111111');
                    }
                    if (e.t === 'w_pkm' && relX > 0.35 && relX < 0.5) {
                        drawStrip(sB - sh * 0.10 + bob, sB - sh * 0.02 + bob, '#ddcc44');
                    }
                }
                continue;
            }

            if (e.t === 'fd') {
                // Floppy Disk
                if (tY < STATE.zBuf[x] && relX > 0.25 && relX < 0.75) {
                    const bob = Math.sin(Date.now() / 160 + e.x) * sh * 0.08;
                    const col = e.color === 'red' ? '#ff3030' : '#303030';
                    drawStrip(sB - sh * 0.18 + bob, sB - sh * 0.03 + bob, col);
                    if (relX > 0.4 && relX < 0.6) {
                        drawStrip(sB - sh * 0.15 + bob, sB - sh * 0.09 + bob, '#ffffff');
                    }
                }
                continue;
            }

            if (e.t === 'gr') {
                // Rolling Grenade
                if (tY < STATE.zBuf[x] && relX > 0.4 && relX < 0.6) {
                    drawStrip(sB - sh * 0.1, sB - sh * 0.02, '#2d4c2d');
                }
                continue;
            }
            const isBz = e.t === 'bz';
            const isPlayer = e.t === 'player';
            const isSz = e.t==='sz'||e.t==='tz'||e.t==='rz'||e.t==='jz';
            const totalH = Math.max(0, Math.min(scrH-1,sB) - Math.max(0,sT));
            const yBase  = Math.max(0,sT);
            const armOff = e.atk>0 ? Math.sin(e.atk*0.4)*totalH*0.15 : 0;
            const headH=totalH*0.18, neckH=totalH*0.04, torsoH=totalH*0.40, legsH=totalH*0.38;
            const headY  = yBase + _headBob + (isPlayer && ADMIN.antiAim ? headH * 0.35 : 0);
            // torso and legs pinned to yBase — only head bobs, not the whole body
            const torsoY = yBase + headH + neckH;
            const legY   = yBase + headH + neckH + torsoH;

            // HEAD
            let headCol;
            if(isPlayer)      headCol='#c8a07a';
            else if(e.t==='tz') headCol='#3a4a6a';
            else if(e.t==='rz') headCol='#704a4a';
            else if(e.t==='jz') headCol='#1a1a1a';
            else if(isBz)       headCol='#ccaa22';
            else if(e.t==='sz') headCol='#5a6470';
            else headCol = e.hp/e.max>0.5?'#2a6a2a':'#3a8a2a';
            drawStrip(headY, headY + headH, headCol);

            // Head details per type
            if(e.t==='sz'){
                drawStrip(headY, headY + headH * 0.22, '#3a4050');
                if(relX>0.45&&relX<0.47){
                    drawStrip(headY+headH*0.2, headY+headH*0.8, 'rgba(255,255,255,0.28)');
                }
            } else if(e.t==='rz'){
                drawStrip(headY+headH*0.76, headY+headH, 'rgba(200,180,160,0.5)');
                if(relX>0.44&&relX<0.56){
                    drawStrip(headY+headH*0.05, headY+headH*0.19, 'rgba(200,30,30,0.9)');
                }
            } else if(e.t==='tz'){
                if(relX>0.35&&relX<0.65){
                    drawStrip(headY, headY + headH * 0.20, 'rgba(0,200,100,0.55)');
                }
            } else if(e.t==='z'){
                const ds=Math.floor(relX*7);
                if(ds===1||ds===4){
                    drawStrip(headY+headH*0.3, headY+headH*0.7, 'rgba(0,0,0,0.3)');
                }
            }

            // Eyes / Visor
            if(isPlayer){
                if((relX>0.18&&relX<0.38)||(relX>0.62&&relX<0.82)){
                    drawStrip(headY+headH*0.42, headY+headH*0.60, '#1a1a3a');
                }
            } else if(e.t==='jz'){
                if((relX>0.18&&relX<0.44)||(relX>0.56&&relX<0.82)){
                    drawStrip(headY+headH*0.38, headY+headH*0.60, 'rgba(255,0,0,0.85)');
                }
            } else if(e.t==='tz'){
                if(relX>0.15&&relX<0.85){
                    drawStrip(headY+headH*0.38, headY+headH*0.58, 'rgba(0,200,255,0.45)');
                }
            } else {
                if((relX>0.20&&relX<0.44)||(relX>0.56&&relX<0.80)){
                    const eyeCol = isBz?'#ff8800':'#ff3030';
                    drawStrip(headY+headH*0.42, headY+headH*0.60, eyeCol);
                }
            }

            // NECK
            const neckCol = isPlayer?'#c8a07a':isBz?'#886600':isSz?'#3a4040':'#1e4a1e';
            drawStrip(headY+headH, headY+headH+neckH, neckCol);

            // TORSO / ARMS
            const isJugg=e.t==='jz';
            const isLA=relX<(isJugg?0.22:0.16), isRA=relX>(isJugg?0.78:0.84);
            if(isLA||isRA){
                let aC=isPlayer?'#2d6a4f':isBz?'#aa8800':isJugg?'#0a0a0a':e.t==='tz'?'#283858':e.t==='rz'?'#5c2b2b':e.t==='sz'?'#383840':'#2a4a1a';
                drawStrip(torsoY-armOff, torsoY-armOff+torsoH, aC);
            } else {
                const st=Math.floor(relX*12);
                let tC;
                if(isPlayer)        tC=Player.armor?'#294a9a':'#2d6a4f';
                else if(isBz)       tC=st%2===0?'#eec213':'#111';
                else if(e.t==='sz') tC=Math.sin(relX*17.3)>0?'#383840':'#484858';
                else if(e.t==='tz') tC=st%2===0?'#2b3d5c':'#1b2d4c';
                else if(e.t==='rz') tC=st%2===0?'#5c2b2b':'#4a1b1b';
                else if(isJugg)     tC=st%2===0?'#111':'#222';
                else tC=st%3===0?'#2a5a2a':st%3===1?'#3a6a2a':'#1e4818';
                drawStrip(torsoY, torsoY+torsoH, tC);
                // Per-type overlays
                if(isBz){
                    if(relX>0.35&&relX<0.65){
                        drawStrip(torsoY+torsoH*0.15, torsoY+torsoH*0.70, 'rgba(150,75,0,0.9)');
                    }
                    const wr=Math.floor(relX*9);
                    if(wr===2||wr===5){
                        drawStrip(torsoY+torsoH*0.2, torsoY+torsoH*0.7, 'rgba(255,40,0,0.6)');
                    }
                    if(e.agro){
                        const p=(Math.sin(Date.now()/80)+1)*0.5;
                        drawStrip(torsoY, torsoY+torsoH, `rgba(255,80,0,${p*0.45})`);
                    }
                } else if(e.t==='sz'){
                    if(relX>0.18&&relX<0.82){
                        drawStrip(torsoY+torsoH*0.08, torsoY+torsoH*0.73, 'rgba(50,50,50,0.5)');
                    }
                    const pp=Math.floor(relX*4);
                    if(pp===1||pp===2){
                        drawStrip(torsoY+torsoH*0.55, torsoY+torsoH*0.80, 'rgba(25,25,25,0.85)');
                    }
                } else if(e.t==='tz'){
                    drawStrip(torsoY+torsoH*0.08, torsoY+torsoH*0.63, 'rgba(70,95,125,0.5)');
                } else if(e.t==='rz'){
                    drawStrip(torsoY+torsoH*0.05, torsoY+torsoH*0.65, 'rgba(90,40,40,0.6)');
                    if((relX>0.20&&relX<0.32)||(relX>0.68&&relX<0.80)){
                        drawStrip(torsoY, torsoY+torsoH*0.18, '#6a3030');
                    }
                } else if(isJugg){
                    const bv=Math.floor(relX*6);
                    if(bv===1||bv===4){
                        drawStrip(torsoY+torsoH*0.10, torsoY+torsoH*0.10+2, 'rgba(80,80,80,0.8)');
                        drawStrip(torsoY+torsoH*0.84, torsoY+torsoH*0.84+2, 'rgba(80,80,80,0.8)');
                    }
                    if(e.hp/e.max<0.5&&(Math.floor(relX*9)===3||Math.floor(relX*9)===7)){
                        drawStrip(torsoY+torsoH*0.2, torsoY+torsoH*0.8, 'rgba(255,50,0,0.55)');
                    }
                    if(e.hp<e.max&&Date.now()-(e.lastHit||0)>5000){
                        const rp=(Math.sin(Date.now()/300)+1)*0.5;
                        drawStrip(torsoY, torsoY+torsoH, `rgba(0,255,100,${rp*0.15})`);
                    }
                } else if(e.t==='z'&&e.hp/e.max<0.4){
                    drawStrip(torsoY+torsoH*0.30, torsoY+torsoH*0.52, 'rgba(180,30,30,0.4)');
                }
                if(e.armor&&e.armor.mit>0.5&&!isJugg){
                    drawStrip(torsoY, torsoY+torsoH*0.7, 'rgba(100,100,100,0.28)');
                }
                if(isPlayer&&Player.armor){
                    drawStrip(torsoY, torsoY+torsoH*0.8, 'rgba(120,170,255,0.22)');
                }
            }

            // LEGS
            const legSplit = Math.max(0.2, Math.min(0.8, 0.5 + (isPlayer ? 0 : Math.sin(_wp) * 0.10)));
            const isLL = relX < legSplit;
            const legRelX = isLL
                ? relX / Math.max(0.01, legSplit)
                : (relX - legSplit) / Math.max(0.01, 1.0 - legSplit);
            const isOL = legRelX < 0.12 || legRelX > 0.88;
            const isForward = isLL ? Math.sin(_wp) > 0 : Math.sin(_wp) <= 0;
            const lOff = _mov ? (isForward ? legsH * 0.04 : -legsH * 0.04) : 0;
            let legCol;
            if(isPlayer)        legCol=Player.armor?'#233a6a':'#2a3a5a';
            else if(e.t==='z')  legCol=isOL?'#1a1a1a':'#1e3018';
            else if(isBz)       legCol=isOL?'#222':'#444';
            else if(e.t==='sz') legCol=isOL?'#111':'#22222e';
            else if(e.t==='tz') legCol=isOL?'#111':'#1a2a3a';
            else if(e.t==='rz') legCol=isOL?'#111':'#3a1818';
            else legCol='#111';
            
            const dLY=legY+lOff;
            drawStrip(dLY, dLY + legsH, legCol);

            // Boot strip
            if(!isPlayer && dLY+legsH*0.88<scrH){
                const bootCol = e.t==='tz'?'#0a0a1a':'#111111';
                drawStrip(dLY+legsH*0.88, dLY+legsH, bootCol);
            }
        }



        // ADMIN: ESP box — restricted to hostiles/players
        if (ADMIN.esp && isHostileZombie(e)) {
            const activeEspCol = ADMIN.rainbowRgb ? getRainbowColor() : (ADMIN.espColor || (e.los ? '#00ffcc' : '#ff0044'));
            ctx.save();
            if (ADMIN.espMode === 'glow') {
                ctx.shadowColor = activeEspCol;
                ctx.shadowBlur = 10;
                ctx.strokeStyle = activeEspCol;
                ctx.lineWidth = 3;
                ctx.strokeRect(ssX - sw / 2, sT, sw, sh);
                ctx.fillStyle = ADMIN.rainbowRgb ? getRainbowColor(0.15) : hexToRgba(activeEspCol, 0.15);
                ctx.fillRect(ssX - sw / 2, sT, sw, sh);
            } else {
                ctx.strokeStyle = activeEspCol;
                ctx.lineWidth = 2;
                ctx.strokeRect(ssX - sw / 2, sT, sw, sh);
            }
            ctx.restore();

            if (ADMIN.distanceEsp) {
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.fillText(`[${Math.round(e.d)}m]`, ssX, sB + 10);
            }
            if (ADMIN.nameEsp) {
                ctx.font = '10px JetBrains Mono, monospace';
                ctx.fillStyle = e.t === 'player' ? '#4a90e2' : (e.t === 'bz' ? '#ffcc00' : '#ff3333');
                ctx.textAlign = 'center';
                const eName = e.t === 'player' ? (e.name || 'Player') : (e.t === 'bz' ? 'BOMBER' : 'ZOMBIE');
                ctx.fillText(`${eName} HP:${Math.floor(e.hp)}`, ssX, sT - 5);
            }
        }

        // ADMIN: Skeleton ESP
        if (ADMIN.skeletonEsp && isHostileZombie(e) && isFront) {
            const hx = ssX, hw = sw, yt = sT;
            const headZH = sh * 0.18;
            const neckZH = sh * 0.04;
            const torsoZH = sh * 0.40;
            const legsZH = sh * 0.38;

            const boneColor = ADMIN.rainbowRgb ? getRainbowColor() : (ADMIN.espColor || (e.los ? '#00e6ff' : '#ff5599'));
            ctx.save();
            ctx.strokeStyle = boneColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            // Spine (Head down to base of spine/legs)
            const headCenterY = yt + headZH / 2;
            const spineStartY = yt + headZH;
            const shoulderY = yt + headZH + neckZH;
            const spineEndY = yt + headZH + neckZH + torsoZH;
            
            // Draw head circle
            ctx.arc(hx, headCenterY, headZH / 2, 0, Math.PI * 2);
            // Draw Spine
            ctx.moveTo(hx, spineStartY);
            ctx.lineTo(hx, spineEndY);

            // Shoulders & Arms
            ctx.moveTo(hx - hw * 0.35, shoulderY);
            ctx.lineTo(hx + hw * 0.35, shoulderY);
            // Left Arm
            ctx.moveTo(hx - hw * 0.35, shoulderY);
            ctx.lineTo(hx - hw * 0.4, spineEndY);
            // Right Arm
            ctx.moveTo(hx + hw * 0.35, shoulderY);
            ctx.lineTo(hx + hw * 0.4, spineEndY);

            // Legs
            // Left leg
            ctx.moveTo(hx, spineEndY);
            ctx.lineTo(hx - hw * 0.25, yt + sh);
            // Right leg
            ctx.moveTo(hx, spineEndY);
            ctx.lineTo(hx + hw * 0.25, yt + sh);

            ctx.stroke();
            ctx.restore();
        }

        // ADMIN: Hitbox zones (Glowing and scaling with expansion setting)
        if (ADMIN.hitboxes && isHostileZombie(e) && isFront) {
            const scale = ADMIN.hitboxExpansion || 1.0;
            const hw = sw * scale;
            const hx = ssX - hw / 2;
            const totalH = sh * scale;
            const centerY = sT + sh / 2;
            const extST = centerY - totalH / 2;
            
            const headZH = totalH * 0.18;
            const neckZH = totalH * 0.04;
            const torsoZH = totalH * 0.40;
            const legsZH = totalH * 0.38;

            ctx.save();
            ctx.shadowBlur = 8;
            
            // Head Hitbox
            ctx.shadowColor = 'rgba(255,50,50,0.85)';
            ctx.strokeStyle = 'rgba(255,50,50,0.85)';
            ctx.fillStyle = 'rgba(255,50,50,0.08)';
            ctx.fillRect(hx, extST, hw, headZH);
            ctx.strokeRect(hx, extST, hw, headZH);

            // Body Hitbox
            ctx.shadowColor = 'rgba(255,255,255,0.65)';
            ctx.strokeStyle = 'rgba(255,255,255,0.65)';
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(hx, extST + headZH + neckZH, hw, torsoZH);
            ctx.strokeRect(hx, extST + headZH + neckZH, hw, torsoZH);

            // Legs Hitbox
            ctx.shadowColor = 'rgba(50,150,255,0.75)';
            ctx.strokeStyle = 'rgba(50,150,255,0.75)';
            ctx.fillStyle = 'rgba(50,150,255,0.08)';
            ctx.fillRect(hx, extST + headZH + neckZH + torsoZH, hw, legsZH);
            ctx.strokeRect(hx, extST + headZH + neckZH + torsoZH, hw, legsZH);

            ctx.restore();
            
            ctx.font = '8px JetBrains Mono, monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ff3232'; ctx.fillText('HEAD', hx + hw + 2, extST + headZH * 0.7);
            ctx.fillStyle = '#ffffff'; ctx.fillText('BODY', hx + hw + 2, extST + headZH + neckZH + torsoZH * 0.5);
            ctx.fillStyle = '#3296ff'; ctx.fillText('LEGS', hx + hw + 2, extST + headZH + neckZH + torsoZH + legsZH * 0.6);
        }

        // ADMIN: Hitbox Extension visualization (Dashed outline when scale > 1.0)
        const extScale = ADMIN.hitboxExpansion || 1.0;
        if (extScale > 1.01 && isHostileZombie(e) && isFront) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 140, 0, 0.75)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]); // cool dashed outline showing boundary
            const extW = sw * extScale;
            const extH = sh * extScale;
            const centerY = sT + sh / 2;
            const extST = centerY - extH / 2;
            ctx.strokeRect(ssX - extW / 2, extST, extW, extH);
            
            ctx.font = '7px JetBrains Mono, monospace';
            ctx.fillStyle = '#ff8c00';
            ctx.textAlign = 'center';
            ctx.fillText('EXTENDED (' + extScale.toFixed(1) + 'x)', ssX, extST + extH + 8);
            ctx.restore();
        }

        // ADMIN: Tracers — restricted to hostiles/players with tracer mode filtering
        let drawTracer = false;
        if (ADMIN.tracers && isHostileZombie(e)) {
            if (ADMIN.tracerMode === 'all') {
                drawTracer = true;
            } else if (ADMIN.tracerMode === 'closest') {
                drawTracer = (e === closestTarget);
            } else if (ADMIN.tracerMode === 'target') {
                drawTracer = (e === aimTarg);
            }
        }
        if (drawTracer) {
            ctx.save();
            let col = e.los ? 'rgba(0,255,200,0.45)' : 'rgba(255,0,68,0.45)';
            if (ADMIN.rainbowRgb) {
                col = getRainbowColor(0.45);
            } else if (ADMIN.tracerColor) {
                col = hexToRgba(ADMIN.tracerColor, 0.45);
            }
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.5;

            // Calculate vertical target endpoint based on tracerLocation
            let targetY = sB;
            const headZH = sh * 0.18;
            const neckZH = sh * 0.04;
            const torsoZH = sh * 0.40;

            let loc = ADMIN.tracerLocation || 'legs';
            if (loc === 'aimbot') {
                loc = ADMIN.hitLocation || 'head';
            }

            if (loc === 'head') {
                targetY = sT + headZH * 0.5;
            } else if (loc === 'body') {
                targetY = sT + headZH + neckZH + torsoZH * 0.5;
            }

            ctx.beginPath(); 
            ctx.moveTo(scrW / 2, scrH / 2); 
            ctx.lineTo(ssX, targetY); 
            ctx.stroke();
            ctx.restore();
        }
        // HEALTH BARS — proximity-based (max 20 units)
        if ((e.t === 'z' || e.t === 'sz' || e.t === 'bz' || e.t === 'player') && e.active && isFront && e.d < 400) {
            const barW = Math.max(22, sw * 0.9);
            const barX = ssX - barW / 2;
            const barY = Math.max(4, sT - 14);
            const hpPct = Math.max(0, e.hp / e.max);
            const isBomber = e.t === 'bz';
            const barCol = isBomber
                ? (e.agro ? '#ff6600' : (hpPct > 0.5 ? '#f59e0b' : '#ff3300'))
                : (hpPct > 0.55 ? '#22c55e' : hpPct > 0.28 ? '#f59e0b' : '#ef4444');

            ctx.fillStyle = 'rgba(0,0,0,0.72)';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, 8);
            ctx.fillStyle = barCol;
            ctx.fillRect(barX, barY, barW * hpPct, 6);
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(barX, barY, barW, 6);

            // Bomber agro threshold line at 50% of bar width
            if (isBomber) {
                ctx.strokeStyle = '#ff4400';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(barX + barW * 0.5, barY - 1);
                ctx.lineTo(barX + barW * 0.5, barY + 7);
                ctx.stroke();
            }

            ctx.fillStyle = '#fff';
            ctx.font = '9px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.ceil(e.hp)}/${Math.ceil(e.max)}`, ssX, barY - 2);
            ctx.textAlign = 'left';
        }
    }
    lastRenderEnts = renderEnts;
}


// ============================================================
// BULLET TRAIL RENDERER
// ============================================================
function dBul(CAM, pit = STATE.pit) {
    const pXS = CAM.px * STATE.fMult, pYS = CAM.py * STATE.fMult;
    const invD = 1.0 / (pXS * CAM.dy - CAM.dx * pYS);
    for (const b of bullets) {
        if (!b.active || b.trail.length < 2) continue;

        // Neon tracers — Thicker and brighter
        if (b.owner === 'player') {
            ctx.strokeStyle = 'rgba(255, 255, 240, 0.95)';
            ctx.lineWidth = 2.2;
        } else {
            ctx.strokeStyle = 'rgba(255, 100, 0, 1.0)'; // Bright orange/red for enemies
            ctx.lineWidth = 2.8;
        }

        ctx.beginPath(); let started = false;
        for (const tr of b.trail) {
            const sx = tr.x - CAM.x, sy = tr.y - CAM.y;
            const tx2 = invD * (CAM.dy * sx - CAM.dx * sy);
            const ty2 = invD * (-pYS * sx + pXS * sy);
            if (ty2 <= 0) continue;
            const sxC = Math.floor((scrW / 2) * (1 + tx2 / ty2));
            const syC = Math.floor(scrH / 2 + pit - (tr.z - CAM.z) * (scrH / ty2));
            if (ty2 < STATE.zBuf[Math.max(0, Math.min(scrW - 1, sxC))]) {
                if (!started) { ctx.moveTo(sxC, syC); started = true; } else ctx.lineTo(sxC, syC);
            }
        }
        if (started) ctx.stroke();
    }
}



// ============================================================
// VIEWMODEL  (scope only for R700, correct y-offset)
// ============================================================
function dVM(pit = STATE.pit) {
    if (ADMIN.spectate || ADMIN.thirdperson) return;

    // FOV radials
    const activeFovCol = ADMIN.rainbowRgb ? getRainbowColor() : (ADMIN.fovColor || '#ff0044');
    const activeSilentFovCol = ADMIN.rainbowRgb ? getRainbowColor() : (ADMIN.silentFovColor || '#ffaa00');

    let isTargetInAimbotFov = false;
    let isTargetInSilentFov = false;

    if (aimTarg) {
        const entityY = (aimTarg.sT !== undefined && aimTarg.sT !== 0) ? (aimTarg.sT + (aimTarg.sB - aimTarg.sT) * 0.4) : (scrH / 2);
        const dist = Math.hypot(aimTarg.ssX - mouseX, entityY - mouseY);
        if (dist < ADMIN.fov) isTargetInAimbotFov = true;
        if (dist < ADMIN.silentFov) isTargetInSilentFov = true;
    }

    if (ADMIN.radial) {
        ctx.strokeStyle = isTargetInAimbotFov ? activeFovCol : 'rgba(0,255,200,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(mouseX, mouseY, ADMIN.fov, 0, Math.PI * 2); ctx.stroke();
    }
    if (ADMIN.radialSilent) {
        ctx.strokeStyle = isTargetInSilentFov ? activeSilentFovCol : 'rgba(255,100,0,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(mouseX, mouseY, ADMIN.silentFov, 0, Math.PI * 2); ctx.stroke();
    }

    if (STATE.mod === 'PAUSE') return;

    const w = Player.get();
    if (w.reK > 0) w.reK -= STATE.dt * 120; else w.reK = 0;

    let tx = w.ipH.x, ty = w.ipH.y, tz = w.ipH.z;
    let rx = 0, ry = 0.1, rz = 0;

    if (STATE.isADS) {
        tx = w.ipA.x; ty = w.ipA.y; tz = w.ipA.z; ry = 0;
        ty += w.reK * 0.002;

        // Scope overlay — ONLY for weapons with hasScope flag
        if (w.hasScope) {
            document.getElementById('crosshair').style.display = 'none';
            document.getElementById('sniper-scope').style.display = 'block';
            document.getElementById('sniper-cross').style.display = 'block';
            document.getElementById('holo-sight').style.display = 'none';
            document.getElementById('holo-reticle').style.display = 'none';
            document.getElementById('crosshair').classList.remove('ads-mode');
        } else if (w.hasHolo) {
            document.getElementById('crosshair').style.display = 'none';
            document.getElementById('sniper-scope').style.display = 'none';
            document.getElementById('sniper-cross').style.display = 'none';
            document.getElementById('holo-sight').style.display = 'block';
            document.getElementById('holo-reticle').style.display = 'block';
            document.getElementById('crosshair').classList.remove('ads-mode');
        } else {
            // Iron sights — crosshair stays but becomes ADS style
            document.getElementById('crosshair').style.display = 'block';
            document.getElementById('sniper-scope').style.display = 'none';
            document.getElementById('sniper-cross').style.display = 'none';
            document.getElementById('holo-sight').style.display = 'none';
            document.getElementById('holo-reticle').style.display = 'none';
            document.getElementById('crosshair').classList.add('ads-mode');
        }
    } else {
        tz += w.reK * 0.005; tx -= w.reK * 0.001;
        document.getElementById('crosshair').style.display = 'block';
        document.getElementById('sniper-scope').style.display = 'none';
        document.getElementById('sniper-cross').style.display = 'none';
        document.getElementById('holo-sight').style.display = 'none';
        document.getElementById('holo-reticle').style.display = 'none';
        document.getElementById('crosshair').classList.remove('ads-mode');
    }

    if (w.isR) {
        // Per-style gun tilt during reload — rotations only, NO vertical dip (ty)
        const p = Math.min(1, w.anim / Math.max(1, w.rTm));
        const s = Math.sin(p * Math.PI);
        if (w.reloadStyle === 'pistol') {
            // Tilt gun sideways and slightly toward player, snap back
            tx += s * 0.06; rz += s * 0.5; rx += s * 0.4;
        } else if (w.reloadStyle === 'rifle' || w.reloadStyle === 'clip') {
            // Roll gun sideways as mag drops out or clip is loaded
            tx += s * 0.04; rz += s * 0.35; rx += s * 0.3;
        } else if (w.reloadStyle === 'bolt') {
            // Bolt: gun rolls right then snaps to chamber
            tx += Math.sin(p * Math.PI * 2) * 0.05; rz += Math.sin(p * Math.PI * 2) * 0.25;
        } else if (w.reloadStyle === 'lmg') {
            // LMG: large lateral tilt to seat the belt
            tx += s * 0.08; rz += s * 0.7; rx += s * 0.5;
        } else if (w.reloadStyle === 'shotgun_tube') {
            // Per-shell: small sideways pulse, gun stays level
            const shellP = (w.anim % 600) / 600;
            const sp = Math.sin(shellP * Math.PI);
            tx += sp * 0.03; rz += sp * 0.25;
        }
    }

    if (!STATE.isADS) {
        const bob = Math.sin(Date.now() / 150) * ((Input.w || Input.s || Input.a || Input.d) ? 1 : 0);
        ty += bob * 0.018; tx += bob * 0.008;
    }

    if (!(STATE.isADS && (w.hasScope || w.hasHolo))) {
        if (STATE.holdingG) {
            mGrn.draw(ctx, 0.15, 0.22, 0.35, 0, 0.2, 0, pit);
            rightHandMdl.draw(ctx, 0.15, 0.28, 0.25, 0, 0.2, 0, pit);
        } else {
            // ---- Left hand position (varies by reload style) ----
            let ltx = tx - 0.03, lty = ty + 0.08, ltz = tz + 0.25;
            let lrx = rx, lry = ry, lrz = rz;

            if (w.isR) {
                const p = Math.min(1, w.anim / Math.max(1, w.rTm));
                const s = Math.sin(p * Math.PI);
                if (w.reloadStyle === 'pistol') {
                    // Slaps mag from below: left hand dips straight down
                    lty += s * 0.55; lrx -= s * 1.2;
                } else if (w.reloadStyle === 'rifle' || w.reloadStyle === 'clip') {
                    // Drops mag or pushes clip, swings new one in
                    lty += s * 0.48; ltz -= s * 0.32; lrx -= s * 1.4;
                } else if (w.reloadStyle === 'bolt') {
                    // Operates bolt handle — hand goes right and back
                    ltx += s * 0.10; ltz -= s * 0.20; lrx += s * 0.8;
                } else if (w.reloadStyle === 'lmg') {
                    // Lifts ammo lid — hand goes far forward and dips
                    lty += s * 0.60; ltz += s * 0.40; lrx -= s * 1.8;
                } else if (w.reloadStyle === 'shotgun_tube') {
                    // Shell insert: quick repeating pulse
                    const shellP = (w.anim % 600) / 600;
                    const sp = Math.sin(shellP * Math.PI);
                    lty += sp * 0.35; ltz -= sp * 0.18; lrx -= sp * 1.0;
                }
            }
            leftHandMdl.draw(ctx, ltx, lty, ltz, lrx, lry, lrz, pit);

            w.mdl.draw(ctx, tx, ty, tz, rx, ry, rz, pit);

            // Right trigger hand — follows gun
            rightHandMdl.draw(ctx, tx + 0.03, ty + 0.15, tz - 0.2, rx, ry, rz, pit);

            // ---- Muzzle Flash (pre-built model, scaled by timer) ----
            if (STATE.flashTimer > 0) {
                STATE.flashTimer -= STATE.dt * 1000;
                if (STATE.flashTimer > 0) {
                    const fSc = Math.max(0.2, STATE.flashTimer / 55);
                    mFlash.draw(ctx, tx, ty - 0.04, tz + 0.85, rx, ry, rz, pit);
                }
            }
        }
    }
}


// ============================================================
// MINIMAP RENDERER
// ============================================================
function dMin() {
    const mw = minimap.width, mh = minimap.height;
    const cs = mw / MAP_SZ;

    mCtx.fillStyle = '#080a0e';
    mCtx.fillRect(0, 0, mw, mh);

    for (let x = 0; x < MAP_SZ; x++) {
        for (let y = 0; y < MAP_SZ; y++) {
            if (!wMap[x][y]) continue;
            mCtx.fillStyle = wMap[x][y] === 2 ? '#8a4520'
                : wMap[x][y] === 8 ? '#5a3a18'
                    : (wMap[x][y] === 6 || wMap[x][y] === 7) ? '#2a4520'
                        : '#3a3a48';
            mCtx.fillRect(Math.floor(x * cs), Math.floor(y * cs), Math.ceil(cs), Math.ceil(cs));
        }
    }
    // Entities
    for (const e of ents) {
        if (!e.active || e.t === 'g') continue;
        if (e.t === 'shop' || e.t === 'ammo_shop') mCtx.fillStyle = '#22c55e'; // Green for shops
        else if (e.t === 'crow') mCtx.fillStyle = '#a855f7'; // Purple for Crow
        else if (e.t === 'sz') mCtx.fillStyle = '#eb6030';
        else if (e.t === 'c') mCtx.fillStyle = '#ffd700';
        else if (e.t === 'fd') mCtx.fillStyle = e.color === 'red' ? '#ff3030' : '#888888';
        else if (e.t === 'w_svd') mCtx.fillStyle = '#ff8800';
        else if (e.t === 'w_pkm') mCtx.fillStyle = '#ff3300';
        else mCtx.fillStyle = '#e03030';

        const rSz = (e.t === 'shop' || e.t === 'crow' || e.t === 'ammo_shop') ? 4 : 3;
        mCtx.fillRect(e.x * cs - rSz / 2, e.y * cs - rSz / 2, rSz, rSz);
    }
    // Player
    mCtx.fillStyle = '#ffffff';
    mCtx.beginPath(); mCtx.arc(Player.x * cs, Player.y * cs, 3, 0, Math.PI * 2); mCtx.fill();
    // Direction arrow
    mCtx.strokeStyle = '#fff'; mCtx.lineWidth = 1;
    mCtx.beginPath();
    mCtx.moveTo(Player.x * cs, Player.y * cs);
    mCtx.lineTo((Player.x + Player.dx * 2.5) * cs, (Player.y + Player.dy * 2.5) * cs);
    mCtx.stroke();
}


// ============================================================
// DEBUG OVERLAY
// ============================================================
function updateDebug(fps) {
    if (!ADMIN.debug) return;
    document.getElementById('dbg-fps').textContent = fps.toFixed(1);
    document.getElementById('dbg-x').textContent = Player.x.toFixed(2);
    document.getElementById('dbg-y').textContent = Player.y.toFixed(2);
    document.getElementById('dbg-z').textContent = Player.z.toFixed(2);
    document.getElementById('dbg-ang').textContent = (Math.atan2(Player.dy, Player.dx) * 180 / Math.PI).toFixed(1) + '°';
    document.getElementById('dbg-bul').textContent = bullets.filter(b => b.active).length;
    document.getElementById('dbg-ent').textContent = ents.filter(e => e.active && e.t !== 'g').length;
    document.getElementById('dbg-wv').textContent = STATE.wv;
    document.getElementById('dbg-mon').textContent = STATE.mon;
}


// ============================================================
// GAME LOOP
// ============================================================
function tick(now) {
    if (!isRunning) {
        loopId = null;
        return;
    }
    if (STATE.mod === 'DEAD') {
        const CAM = { x: Player.x, y: Player.y, z: Player.z, dx: Player.dx, dy: Player.dy, px: Player.px, py: Player.py };
        const renderPit = STATE.pit + STATE.flinchY;
        ctx.clearRect(0, 0, scrW, scrH);
        dRay(CAM, renderPit);
        dSpr(CAM, renderPit);
        mainCtx.drawImage(renderCanvas, 0, 0, scrW, scrH, 0, 0, mainW, mainH);
        loopId = requestAnimationFrame(tick);
        return;
    }
    STATE.dt = Math.min((now - STATE.last) / 1000, 0.1);
    STATE.last = now;
    if (typeof STORAGE !== 'undefined' && STATE.mod === 'PLAY') {
        STORAGE.data.playtime += STATE.dt;
    }

    if (STATE.mod === 'SHP') {
        let inRange = false;
        for (const e of ents) {
            if (!e.active || (e.t !== 'shop' && e.t !== 'crow' && e.t !== 'ammo_shop')) continue;
            if (Math.hypot(Player.x - e.x, Player.y - e.y) < 2.5) {
                inRange = true; break;
            }
        }
        if (!inRange) closeShop();
    }
    
    if (Player.hotTime > 0) {
        if (STATE.hotTimer === undefined) STATE.hotTimer = 0;
        STATE.hotTimer += STATE.dt;
        if (STATE.hotTimer >= 1.0) {
            STATE.hotTimer -= 1.0;
            Player.hp = Math.min(Player.maxHp, Player.hp + Player.hotRate);
            const hb = document.getElementById('hp-bar');
            if (hb) hb.style.width = Player.hp + '%';
            Player.hotTime -= 1;
            if (Player.hotTime < 0) Player.hotTime = 0;
        }
    }

    if (STATE.mode === 'PVP') {
        STATE.pvpTimer -= STATE.dt;
        if (STATE.pvpTimer <= 0) {
            notice('MATCH FINISHED — RETURNING TO HUB');
            STATE.mod = 'MENU';
            isRunning = false;
            showMenu();
            document.getElementById('host-panel').style.display = 'none';
        }
    }
    fpsArr.push(1 / STATE.dt);
    if (fpsArr.length > 30) fpsArr.shift();
    const fps = fpsArr.reduce((a, b) => a + b, 0) / fpsArr.length;

    // Camera state
    const CAM = { x: Player.x, y: Player.y, z: Player.z, dx: Player.dx, dy: Player.dy, px: Player.px, py: Player.py };

    // Spectate camera
    if (ADMIN.spectate && spectateIdx >= 0) {
        const zs = getZombies();
        if (zs.length > 0 && spectateIdx < zs.length) {
            const t = zs[spectateIdx];
            // Third person spectate: orbit behind the zombie
            const orbitDist = 3.5;
            const a = Math.atan2(Player.y - t.y, Player.x - t.x);
            CAM.x = t.x - Math.cos(a) * orbitDist;
            CAM.y = t.y - Math.sin(a) * orbitDist;
            CAM.z = 1.8;
            const tdx = t.x - CAM.x, tdy = t.y - CAM.y, tl = Math.hypot(tdx, tdy);
            CAM.dx = tdx / tl; CAM.dy = tdy / tl;
            CAM.px = -CAM.dy * 0.66; CAM.py = CAM.dx * 0.66;
        }
    } else if (ADMIN.thirdperson) {
        // Third person player view
        const orbitDist = 4.0;
        CAM.x = Player.x - Player.dx * orbitDist;
        CAM.y = Player.y - Player.dy * orbitDist;
        CAM.z = Player.z + 1.2;
        // Check if camera is inside a wall
        const cx = Math.floor(CAM.x), cy = Math.floor(CAM.y);
        if (cx >= 0 && cx < MAP_SZ && cy >= 0 && cy < MAP_SZ && wMap[cx][cy] > 0) {
            // Push camera forward if inside wall
            CAM.x = Player.x - Player.dx * 0.5;
            CAM.y = Player.y - Player.dy * 0.5;
        }
    }

    if (STATE.mod === 'PLAY' && !ADMIN.spectate) {
        // Flinch logic
        if (STATE.flinchY > 0 || STATE.flinchV !== 0) {
            STATE.flinchY += STATE.flinchV * STATE.dt;
            STATE.flinchV -= 1500 * STATE.dt; // gravity/pull back
            if (STATE.flinchY <= 0) {
                STATE.flinchY = 0;
                STATE.flinchV = 0;
            }
        }

        // Concussion: locks camera (mouse look) only — movement is still allowed
        const isConcussed = performance.now() < STATE.concussEnd;
        const elConcuss = document.getElementById('concuss-overlay');
        elConcuss.style.opacity = isConcussed ? '1' : '0';

        // Wave countdown HUD display
        if (STATE.waveCountdownEnd > 0) {
            const remaining = Math.max(0, STATE.waveCountdownEnd - performance.now());
            const wcdEl = document.getElementById('hud-wave-countdown');
            const wcdVal = document.getElementById('wave-countdown-val');
            if (wcdEl && wcdVal) {
                if (remaining > 0) {
                    wcdEl.style.display = 'block';
                    wcdVal.textContent = Math.ceil(remaining / 1000);
                } else {
                    wcdEl.style.display = 'none';
                    STATE.waveCountdownEnd = 0;
                }
            }
        }

        // Kill streak timer decay
        if (STATE.killStreak > 0 && STATE.killStreakTimer > 0) {
            STATE.killStreakTimer -= STATE.dt;
            if (STATE.killStreakTimer <= 0) {
                STATE.killStreak = 0;
                STATE.killStreakTimer = 0;
                const ksEl = document.getElementById('hud-killstreak');
                if (ksEl) ksEl.style.display = 'none';
            }
        }

        // Stamina
        // Stamina
        const sprinting = Input.sh && (Input.w || Input.s || Input.a || Input.d) && Player.stm > 0 && !STATE.isADS;
        Player.stm = (sprinting && !ADMIN.speed && !ADMIN.infiniteStamina)
            ? Math.max(0, Player.stm - 25 * STATE.dt)
            : Math.min(100, Player.stm + 15 * STATE.dt);
        if (ADMIN.infiniteStamina) Player.stm = 100;
        document.getElementById('stam-bar-inner').style.width = Player.stm + '%';
        const armorSpdMod = Player.armor && Player.armor.spdMod !== undefined ? Player.armor.spdMod : 1.0;
        const baseSpeed = (STATE.isADS ? 1.5 : (sprinting ? 3.0 : 2.4)) * Player.get().spdMod * armorSpdMod * (Player.useSlow || 1.0);
        Player.sp = ADMIN.speed ? baseSpeed * ADMIN.speedVal : baseSpeed;

        // Mouse look - unrestricted (concussion is visual only)
        if (Input.mx) {
            const rot = Input.mx * 0.002 * STATE.fMult * STATE.sensitivity;
            const odx = Player.dx, opx = Player.px;
            Player.dx = odx * Math.cos(rot) - Player.dy * Math.sin(rot);
            Player.dy = odx * Math.sin(rot) + Player.dy * Math.cos(rot);
            Player.px = opx * Math.cos(rot) - Player.py * Math.sin(rot);
            Player.py = opx * Math.sin(rot) + Player.py * Math.cos(rot);
            Input.mx = 0;
        }
        
        // Spinbot rotation (framerate-independent rotation of facing direction)
        if (ADMIN.spinbot) {
            const rot = 45.0 * STATE.dt; // 45 radians per second
            const odx = Player.dx, opx = Player.px;
            Player.dx = odx * Math.cos(rot) - Player.dy * Math.sin(rot);
            Player.dy = odx * Math.sin(rot) + Player.dy * Math.cos(rot);
            Player.px = opx * Math.cos(rot) - Player.py * Math.sin(rot);
            Player.py = opx * Math.sin(rot) + Player.py * Math.cos(rot);
        }

        if (Input.my) {
            const pitchChange = Input.my * 0.9 * STATE.fMult * STATE.sensitivity;
            if (STATE.recAcc > 0 && pitchChange > 0) {
                STATE.recAcc = Math.max(0, STATE.recAcc - pitchChange);
            }
            STATE.pit -= pitchChange;
            STATE.pit = Math.max(-400, Math.min(400, STATE.pit));
            Input.my = 0;
        }

        // Recoil recovery (Only for snipers when scoped)
        if (STATE.recAcc > 0) {
            const w = Player.get();
            const timeSinceFire = Date.now() - w.lf;
            if (STATE.isADS && w.hasScope && timeSinceFire > (60000 / w.rpm) + 50) {
                // Dynamic smooth decay based on remaining recoil size
                const decaySpeed = Math.max(80, STATE.recAcc * 8); 
                const decay = Math.min(STATE.recAcc, decaySpeed * STATE.dt);
                STATE.recAcc -= decay;
                STATE.pit -= decay;
            } else if (!STATE.isADS || !w.hasScope) {
                // If unscoped or not a sniper, recoil is permanent (no auto recovery)
                // We just clear recAcc so it doesn't suddenly recover if they scope in later
                STATE.recAcc = 0;
            }
        }

        // Aimbot
        aimTarg = getAimbotTarget();
        if (ADMIN.aimbot && aimTarg && isAimKeyPressed(ADMIN.aimKey)) {
            const dx = aimTarg.x - Player.x, dy = aimTarg.y - Player.y, dl = Math.hypot(dx, dy);
            
            // Vertical pitch lock — guard against entities with no Z (zombies stand at ground level)
            const tx = Math.floor(aimTarg.x), ty = Math.floor(aimTarg.y);
            const floorZ = (tx >= 0 && tx < MAP_SZ && ty >= 0 && ty < MAP_SZ) ? hMap[tx][ty] : 0;
            const entZ = (aimTarg.z !== undefined && !isNaN(aimTarg.z)) ? aimTarg.z : floorZ;
            
            let targZ = entZ;
            if (ADMIN.hitLocation === 'head') targZ += 0.9;
            else if (ADMIN.hitLocation === 'body') targZ += 0.55;
            else targZ += 0.15;

            if (dl > 0.1) {
                // Direction interpolation (Smoothness)
                const targetAngle = Math.atan2(dy, dx);
                const currentAngle = Math.atan2(Player.dy, Player.dx);
                let diff = targetAngle - currentAngle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                
                const smoothVal = Math.max(1, ADMIN.aimSmooth);
                const nextAngle = currentAngle + diff / smoothVal;
                
                Player.dx = Math.cos(nextAngle);
                Player.dy = Math.sin(nextAngle);
                Player.px = -Player.dy * 0.66;
                Player.py = Player.dx * 0.66;

                // Pitch lock (compensate for ADS zoom via STATE.fMult)
                const zDiff = targZ - Player.z;
                const targetPit = (zDiff / dl) * scrH * STATE.fMult;
                if (isFinite(targetPit)) {
                    const finalTargetPit = Math.max(-450, Math.min(450, targetPit));
                    STATE.pit += (finalTargetPit - STATE.pit) / smoothVal;
                }
            }
        }

        // Jump / Gravity
        const floorTile = hMap[Math.floor(Player.x)] && hMap[Math.floor(Player.x)][Math.floor(Player.y)];
        const floorZ = (floorTile || 0);
        const standZ = floorZ + 0.5;

        if (ADMIN.noclip || ADMIN.flyhack) {
            STATE.isJ = false;
            STATE.jV = 0;
            if (Input.space) Player.z += 12 * STATE.dt;
            if (Input.ctrl || Input.c) Player.z -= 12 * STATE.dt;
        } else {
            if (STATE.isJ) {
                STATE.jV -= 22 * STATE.dt; Player.z += STATE.jV * STATE.dt;
                if (Player.z <= standZ) { 
                    Player.z = standZ; STATE.isJ = false; STATE.jV = 0; 
                    if (ADMIN.bhop && Input.space && (Player.stm >= 15 || ADMIN.infiniteStamina)) {
                        STATE.isJ = true; STATE.jV = ADMIN.jumpVal;
                        if (!ADMIN.infiniteStamina) Player.stm -= 15;
                    }
                }
            } else {
                if (Player.z > standZ) { 
                    STATE.jV -= 22 * STATE.dt; Player.z += STATE.jV * STATE.dt; 
                    if (Player.z <= standZ) { 
                        Player.z = standZ; STATE.jV = 0; 
                        if (ADMIN.bhop && Input.space && (Player.stm >= 15 || ADMIN.infiniteStamina)) {
                            STATE.isJ = true; STATE.jV = ADMIN.jumpVal;
                            if (!ADMIN.infiniteStamina) Player.stm -= 15;
                        }
                    } 
                }
                else if (Player.z < standZ) { Player.z = standZ; }
            }
        }

        // Movement — allowed even while concussed (only camera is locked)
        const mS = Player.sp * STATE.dt;
        let mvX = 0, mvY = 0;
        if (Input.w) { mvX += Player.dx; mvY += Player.dy; }
        if (Input.s) { mvX -= Player.dx; mvY -= Player.dy; }
        if (Input.a) { mvX -= Player.px; mvY -= Player.py; }
        if (Input.d) { mvX += Player.px; mvY += Player.py; }
        if (mvX || mvY) {
            const l = Math.hypot(mvX, mvY);
            mvX = (mvX / l) * mS; mvY = (mvY / l) * mS;
            if (ADMIN.noclip) { 
                // Full 3D Freecam movement (strictly horizontal WASD, vertical is decoupled to Space/Ctrl)
                Player.x += mvX; 
                Player.y += mvY; 
            }
            else {
                if (canMove(Player.x + mvX, Player.y, 0.25, Player.z)) Player.x += mvX;
                if (canMove(Player.x, Player.y + mvY, 0.25, Player.z)) Player.y += mvY;
            }
        }

        STATE.fMult += (STATE.fTarg - STATE.fMult) * 15 * STATE.dt;

        // Bullets
        for (const b of bullets) b.update();
        bullets = bullets.filter(b => b.active || b.trail.length > 0);
        if (bullets.length > 200) bullets.splice(0, bullets.length - 200);



        // Fire logic — triggerbot now acts as a 'Force Full Auto' modifier (requires LMB)
        const cw = Player.get();
        const isFiring = Input.lc; 

        if (isFiring && !cw.isR) {
            // If Triggerbot is ON, all guns behave as full-auto
            if (cw.type === 'auto' || ADMIN.triggerbot) fW(); 
            else if (cw.type === 'bolt') { if (!cw.hc) { fW(); cw.hc = true; } }
            else if (!cw.hc) { fW(); cw.hc = true; } 
        } else cw.hc = false;
        if (cw.mag === 0 && !cw.isR) rldW();

        // Entity AI
        for (let i = ents.length - 1; i >= 0; i--) {
            const e = ents[i];
            if (!e.active) { ents.splice(i, 1); continue; }
            if (e.t === 'g') continue;
            if (ADMIN.freezeEnv && e.t !== 'c') continue;

            // Stun handling
            if (e.stun > 0) {
                e.stun -= STATE.dt;
                continue;
            }

            const edx = Player.x - e.x, edy = Player.y - e.y;
            const dist = Math.hypot(edx, edy);

            if (e.frozen) continue;

            // Walk animation phase
            if (e.t==='z'||e.t==='sz'||e.t==='bz'||e.t==='tz'||e.t==='rz'||e.t==='jz') {
                if (dist > 0.9) {
                    const phSpd = e.t==='jz'?2.0:e.t==='bz'?2.5:e.t==='rz'?3.5:e.t==='sz'?4.0:4.5;
                    e.walkPhase = ((e.walkPhase||0) + phSpd*STATE.dt) % (Math.PI*2);
                }
            }

            // Coin pickup
            if (e.t === 'c') {
                if (dist < Player.r + e.r) {
                    e.active = false; STATE.mon += e.val;
                    if (typeof STORAGE !== 'undefined') {
                        STORAGE.data.totalCoinsEarned += e.val;
                        STORAGE.save();
                    }
                    document.getElementById('money-val').textContent = '$' + STATE.mon;
                }
                continue;
            }

            // Floppy pickup
            if (e.t === 'fd') {
                if (dist < Player.r + e.r) {
                    const itemObj = e.color === 'red' ? new ItemFloppyRed() : new ItemFloppyBlack();
                    if (addToInventory(itemObj)) {
                        e.active = false;
                        notice((e.color === 'red' ? 'RED' : 'BLACK') + ' FLOPPY DISK ACQUIRED');
                        renderInventoryUI();
                    }
                }
                continue;
            }

            // Weapon pickup
            if (e.t === 'w_svd' || e.t === 'w_pkm') {
                if (dist < Player.r + e.r) {
                    const targetWeapon = Arsenal.find(w => w.name === (e.t === 'w_svd' ? 'SVD' : 'PKM'));
                    if (targetWeapon && addToInventory(new ItemWeapon(targetWeapon))) {
                        e.active = false;
                        notice(`${targetWeapon.name} ACQUIRED FROM DROP`);
                        renderInventoryUI();
                    }
                }
                continue;
            }

            // LOS
            let hasLOS = true;
            for (let r = 0; r < dist; r += 0.5) {
                const cx = Math.floor(e.x + (edx / dist) * r);
                const cy = Math.floor(e.y + (edy / dist) * r);
                if (cx > 0 && cx < MAP_SZ && cy > 0 && cy < MAP_SZ && wMap[cx][cy] > 0) { hasLOS = false; break; }
            }
            e.los = hasLOS;

            const ex_ = (edx / dist) * e.spd * STATE.dt;
            const ey_ = (edy / dist) * e.spd * STATE.dt;
            const bypass = dist > 30 || wMap[Math.floor(e.x)][Math.floor(e.y)] > 0;

            if (e.t === 'sz' || e.t === 'tz' || e.t === 'rz' || e.t === 'jz') {
                if (bypass) { e.x += ex_; e.y += ey_; }
                else {
                    const ox = e.x, oy = e.y;
                    if (!(hasLOS && dist < 12)) {
                        // Standard approach
                        if (canMove(e.x + ex_, e.y, e.r, 0.8)) e.x += ex_;
                        if (canMove(e.x, e.y + ey_, e.r, 0.8)) e.y += ey_;
                    } else {
                        // ADVANCED AI: Side-strafing in combat
                        e.sT += STATE.dt;
                        if (e.sT > 2.0) { e.sDir *= -1; e.sT = 0; } // Switch direction
                        const sx = -ey_ * e.sDir * 1.5; // Perpendicular vector for strafe
                        const sy = ex_ * e.sDir * 1.5;
                        if (canMove(e.x + sx, e.y + sy, e.r, 0.8)) {
                            e.x += sx; e.y += sy;
                        }
                    }
                    if (!hasLOS && Math.abs(e.x - ox) < 0.001 && Math.abs(e.y - oy) < 0.001) {
                        if (Math.random() < 0.5) { if (canMove(e.x - ey_, e.y + ex_, e.r, 0.8)) { e.x -= ey_; e.y += ex_; } }
                        else { if (canMove(e.x + ey_, e.y - ex_, e.r, 0.8)) { e.x += ey_; e.y -= ex_; } }
                    }
                }
                // Juggernaut Regen
                if (e.t === 'jz' && now - e.lastHit > 5000) {
                    if (now - e.lastRegen > 500) {
                        e.hp = Math.min(e.max, e.hp + e.max * 0.02);
                        e.lastRegen = now;
                    }
                }
                // Shoots using its assigned Loadout — Ballistic aiming
                if (e.zG.isR) {
                    if (now - e.zG.rStart > e.zG.rTm) {
                        e.zG.isR = false;
                        e.zG.mag = e.zG.maxMag;
                    }
                } else if (hasLOS && now - e.lf > 60000 / e.zG.rpm) {
                    e.lf = now;
                    e.zG.mag--;
                    if (e.zG.mag <= 0) {
                        e.zG.isR = true;
                        e.zG.rStart = now;
                    }
                    const bCnt = e.zG.cnt || 1;
                    
                    const isElite = (e.t === 'tz' || e.t === 'rz' || e.t === 'jz');
                    const distFactor = Math.max(0, Math.min(1.0, (dist - 3.0) / 12.0));
                    const headChance = isElite ? (0.90 - 0.50 * distFactor) : (0.70 - 0.50 * distFactor);
                    const accuracy = isElite ? (1.0 - 0.25 * distFactor) : (0.90 - 0.40 * distFactor);
                    
                    const tof = dist / e.zG.bSpd;                     // time of flight (seconds)
                    const grav = e.zG.bDrop * 60;                      // gravity constant
                    
                    for (let j = 0; j < bCnt; j++) {
                        const aimsHead = Math.random() < headChance;
                        const hitsTarget = Math.random() < accuracy;
                        
                        let targetZ = aimsHead ? (Player.z + 0.45) : (Player.z + 0.15);
                        let finalSprd = e.zG.sprd;
                        
                        if (!hitsTarget) {
                            finalSprd += 0.20; // Wide horizontal miss
                            targetZ += (Math.random() < 0.5 ? 0.8 : -0.8); // High/low vertical miss
                        } else {
                            finalSprd *= 0.15; // Tighten the spread drastically so they actually hit the player
                        }
                        
                        const ballisticVZ = (targetZ - 0.6 + 0.5 * grav * tof * tof) / tof;
                        
                        const sX = (edx / dist) + (Math.random() - 0.5) * finalSprd;
                        const sY = (edy / dist) + (Math.random() - 0.5) * finalSprd;
                        bullets.push(new Bullet(e.x, e.y, 0.6, sX * e.zG.bSpd, sY * e.zG.bSpd, ballisticVZ, { bDrop: e.zG.bDrop, dmg: e.zG.dmg, durL: e.zG.durL, hs: e.zG.hs || 2.0 }, 'sz'));
                    }
                }
                // Bomber zombie AI
            } else if (e.t === 'bz' && !e.frozen) {
                if (!e.agro) {
                    // Normal slow approach
                    if (dist > 0.75) {
                        if (canMove(e.x + ex_, e.y, e.r, 0.8)) e.x += ex_;
                        if (canMove(e.x, e.y + ey_, e.r, 0.8)) e.y += ey_;
                    }
                } else {
                    // AGRO: charge straight at player, ignore wall pathing checks
                    if (dist > 0.6) {
                        if (canMove(e.x + ex_, e.y, e.r, 0.8)) e.x += ex_;
                        else e.x += ex_;
                        if (canMove(e.x, e.y + ey_, e.r, 0.8)) e.y += ey_;
                        else e.y += ey_;
                    } else if (!e.exploded && !ADMIN.noclip) {
                        // EXPLODE on contact
                        e.exploded = true;
                        e.active = false;
                        Player.takeDmg(75, 50);
                        STATE.concussEnd = performance.now() + 5000;
                        notice('💥 CONCUSSED!', false);
                        // Boom flash
                        const elH = document.getElementById('hitflash');
                        elH.style.background = 'rgba(255,140,0,0.7)';
                        elH.style.opacity = '1';
                        setTimeout(() => { elH.style.opacity = '0'; elH.style.background = ''; }, 250);
                        // Check wave clear
                        const alive = ents.filter(en => en.active && (en.t === 'z' || en.t === 'sz' || en.t === 'bz' || en.t === 'tz' || en.t === 'rz' || en.t === 'jz')).length;
                        if (alive === 0) {
                            const completedWave = STATE.wv;
                            let reward = 1000;
                            for (let w = 2; w <= completedWave; w++) {
                                if (w <= 7) reward += 500;
                                else reward += 1000;
                            }
                            STATE.mon += reward;
                            if (typeof STORAGE !== 'undefined') {
                                STORAGE.data.totalCoinsEarned += reward;
                                if (STATE.wv >= STORAGE.data.highestWave) STORAGE.data.highestWave = STATE.wv + 1;
                                STORAGE.save();
                            }
                            document.getElementById('money-val').textContent = '$' + STATE.mon;
                            notice(`WAVE ${completedWave} CLEARED! +$${reward}`);

                            STATE.wv++;
                            document.getElementById('wave-val').textContent = 'Wave ' + STATE.wv;
                            notice('WAVE ' + STATE.wv + ' INBOUND');
                            STATE.waveCountdownEnd = performance.now() + 3200;
                            const wcdB = document.getElementById('hud-wave-countdown');
                            if (wcdB) wcdB.style.display = 'block';
                            setTimeout(spawnWave, 3200);
                        }
                    }
                }
            } else if (e.t === 'z') {
                if (dist > 0.75) {
                    if (bypass) { e.x += ex_; e.y += ey_; }
                    else {
                        const ox = e.x, oy = e.y;
                        if (canMove(e.x + ex_, e.y, e.r, 0.8)) e.x += ex_;
                        if (canMove(e.x, e.y + ey_, e.r, 0.8)) e.y += ey_;
                        if (Math.abs(e.x - ox) < 0.001 && Math.abs(e.y - oy) < 0.001) {
                            if (Math.random() < 0.5) { if (canMove(e.x - ey_, e.y + ex_, e.r, 0.8)) { e.x -= ey_; e.y += ex_; } }
                            else { if (canMove(e.x + ey_, e.y - ex_, e.r, 0.8)) { e.x += ey_; e.y -= ex_; } }
                        }
                    }
                } else {
                    // Attack Animation
                    if (e.atk === 0) e.atk = 1;
                    e.atk += 10 * STATE.dt;
                    if (e.atk >= 10) {
                        if (dist <= 1.0 && !ADMIN.noclip) Player.takeDmg(5, 5, 'zombie');
                        e.atk = 0;
                    }
                }
            } else if (e.t === 'gr') {
                // GRENADE PHYSICS
                e.timer -= STATE.dt;
                e.vz -= 25 * STATE.dt;
                e.z += e.vz * STATE.dt;
                const nx = e.x + e.vx * STATE.dt, ny = e.y + e.vy * STATE.dt;
                if (!canMove(nx, e.y, e.r, e.z)) e.vx *= -0.6; else e.x = nx;
                if (!canMove(e.x, ny, e.r, e.z)) e.vy *= -0.6; else e.y = ny;
                const floorZ = (hMap[Math.floor(e.x)] && hMap[Math.floor(e.x)][Math.floor(e.y)]) || 0;
                if (e.z < floorZ + 0.1) {
                    e.z = floorZ + 0.1;
                    if (Math.abs(e.vz) > 1.5) e.vz *= -0.5;
                    else { e.vz = 0; e.vx *= 0.95; e.vy *= 0.95; }
                }
                 // EXPLOSION
                if (e.timer <= 0) {
                    e.active = false;
                    const blastRadius = 3.5;
                    const dmgMax = 150; // damage at 0 distance
                    const dmgMin = 25;  // damage at blastRadius distance

                    // Visual Effect (Notice + Flash + Shake)
                    notice('💥 GRENADE EXPLODED!');
                    STATE.shake = 40; // Trigger screen shake
                    const elH = document.getElementById('hitflash');
                    elH.style.background = 'rgba(255,200,0,0.5)'; elH.style.opacity = '1';
                    setTimeout(() => { elH.style.opacity = '0'; elH.style.background = ''; }, 200);
                    for (const target of ents) {
                        if (!target.active || target.t === 'g' || target.t === 'c' || target.t === 'shop' || target.t === 'crow' || target.t === 'ammo_shop' || target.t === 'fd' || target.t === 'w_svd' || target.t === 'w_pkm' || target === e) continue;
                        const tDist = Math.hypot(target.x - e.x, target.y - e.y);
                        if (tDist < blastRadius) {
                            const falloff = 1 - (tDist / blastRadius); // 1 at center, 0 at edge
                            const dmg = Math.round(dmgMin + (dmgMax - dmgMin) * falloff);
                            target.hit(dmg, false, true);
                            target.stun = 3.0;
                        }
                    }
                    const pDist = Math.hypot(Player.x - e.x, Player.y - e.y);
                    if (pDist < blastRadius) {
                        const falloff = 1 - (pDist / blastRadius);
                        const pDmg = Math.round(dmgMin + (dmgMax - dmgMin) * falloff);
                        Player.takeDmg(pDmg, 100, 'grenade', false, 2.0, true);
                        STATE.concussEnd = performance.now() + 2000;
                    }
                }
            }
        }

        document.getElementById('money-val').textContent = '$' + STATE.mon;

        // Live zombie count HUD
        if (STATE.mode === 'SURVIVAL') {
            const zombiesLeft = ents.filter(en => en.active && (en.t === 'z' || en.t === 'sz' || en.t === 'bz' || en.t === 'tz' || en.t === 'rz' || en.t === 'jz')).length;
            const waveValEl = document.getElementById('wave-val');
            if (waveValEl) {
                waveValEl.textContent = zombiesLeft > 0
                    ? `Wave ${STATE.wv} | ${zombiesLeft} left`
                    : `Wave ${STATE.wv}`;
            }
        }
    }

    // Shake decay
    if (STATE.shake > 0) STATE.shake -= STATE.dt * 100;
    if (STATE.shake < 0) STATE.shake = 0;

    // ── RENDER ────────────────────────────────────────────
    const shakeY = (Math.random() - 0.5) * STATE.shake;
    const renderPit = STATE.pit + STATE.flinchY + shakeY;
    ctx.clearRect(0, 0, scrW, scrH);
    dRay(CAM, renderPit);
    dSpr(CAM, renderPit);
    dBul(CAM, renderPit);
    if (STATE.mod === 'PLAY' || STATE.mod === 'SHP' || STATE.mod === 'INV' || STATE.mod === 'PAUSE') dVM(renderPit);
    dHitmarkers();
    
    // --- DRAW CROSSHAIR ---
    if (STATE.mod === 'PLAY' && !STATE.isADS && !STATE.chargingGrenade) {
        mainCtx.fillStyle = 'rgba(255,255,255,0.7)';
        mainCtx.fillRect(mainW/2 - 1, mainH/2 - 6, 2, 12);
        mainCtx.fillRect(mainW/2 - 6, mainH/2 - 1, 12, 2);
        mainCtx.fillStyle = 'rgba(255,0,0,0.8)';
        mainCtx.fillRect(mainW/2 - 1, mainH/2 - 1, 2, 2);
    }
    
    mainCtx.drawImage(renderCanvas, 0, 0, scrW, scrH, 0, 0, mainW, mainH);
    dMin();
    updateDebug(fps);

    // --- GRENADE CHARGE HUD GAUGE ---
    if (STATE.chargingGrenade) {
        const heldTime = performance.now() - STATE.grenadeChargeStart;
        const maxChargeTime = 1500;
        const pct = Math.min(1.0, heldTime / maxChargeTime);
        
        mainCtx.save();
        const cx = mainW / 2;
        const cy = mainH / 2;
        const radius = 24;
        
        // Outer glow background ring
        mainCtx.shadowBlur = 6;
        mainCtx.shadowColor = pct >= 1.0 ? '#22c55e' : '#eab308';
        mainCtx.strokeStyle = 'rgba(255,255,255,0.15)';
        mainCtx.lineWidth = 4;
        mainCtx.beginPath();
        mainCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        mainCtx.stroke();
        
        // Dynamic arc
        mainCtx.strokeStyle = pct >= 1.0 ? '#22c55e' : '#eab308';
        mainCtx.lineWidth = 4;
        mainCtx.lineCap = 'round';
        mainCtx.beginPath();
        mainCtx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct));
        mainCtx.stroke();
        
        // Charge text
        mainCtx.shadowBlur = 0;
        mainCtx.font = 'bold 9px JetBrains Mono, monospace';
        mainCtx.fillStyle = '#ffffff';
        mainCtx.textAlign = 'center';
        mainCtx.textBaseline = 'middle';
        const txt = pct >= 1.0 ? 'MAX' : Math.floor(pct * 100) + '%';
        mainCtx.fillText(txt, cx, cy);
        
        mainCtx.restore();
    }

    // ── NET SYNC ─────────────────────────────────────────
    if (STATE.mode === 'PVP' && isRunning) {
        if (Math.floor(now / 50) !== Math.floor(STATE.lastSync / 50)) { // 20Hz sync
            NET.sync();
            STATE.lastSync = now;
        }
    }

    // --- PERSISTENT DATA SYNC ---
    if (typeof STORAGE !== 'undefined' && Math.floor(now / 5000) !== Math.floor((STATE.lastSave || 0) / 5000)) {
        STORAGE.save();
        STATE.lastSave = now;
    }

    loopId = requestAnimationFrame(tick);
}


// --- Cheat Menu Draggable Logic ---
const elAdminHeader = document.getElementById('admin-header');
let isDraggingPanel = false, panelOffsetX = 0, panelOffsetY = 0;

elAdminHeader.addEventListener('mousedown', (e) => {
    isDraggingPanel = true;
    const rect = elAdminPanel.getBoundingClientRect();
    panelOffsetX = e.clientX - rect.left;
    panelOffsetY = e.clientY - rect.top;
});
window.addEventListener('mousemove', (e) => {
    if (!isDraggingPanel) return;
    elAdminPanel.style.left = (e.clientX - panelOffsetX) + 'px';
    elAdminPanel.style.top = (e.clientY - panelOffsetY) + 'px';
});
window.addEventListener('mouseup', () => { isDraggingPanel = false; });

// --- Cheat Menu Tabs ---
const tabs = document.querySelectorAll('.cheat-tab');
const tabContents = document.querySelectorAll('.cheat-tab-content');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

// --- Cheat Menu Sub-Tabs (Combat) ---
const subtabs = document.querySelectorAll('.cheat-subtab');
const subtabContents = document.querySelectorAll('.cheat-subtab-content');
subtabs.forEach(subtab => {
    subtab.addEventListener('click', () => {
        subtabs.forEach(s => s.classList.remove('active'));
        subtabContents.forEach(sc => sc.style.display = 'none');
        subtab.classList.add('active');
        document.getElementById(subtab.dataset.subtab).style.display = 'flex';
    });
});

// --- Cheat Menu Toggles ---
const admToggles = ['esp', 'tracers', 'radial', 'radial-silent', 'healthbars', 'hitboxes', 'aimbot', 'silent', 'triggerbot', 'recoil', 'speed', 'infinite-stamina', 'noclip', 'flyhack', 'thirdperson', 'debug', 'spectate', 'bhop', 'customSky', 'chams', 'distance-esp', 'loot-esp', 'name-esp', 'godmode', 'skeleton-esp', 'no-spread', 'anti-aim', 'spinbot', 'rainbow-rgb', 'infinite-ammo'];
admToggles.forEach(key => {
    const row = document.getElementById('adm-' + key);
    if (!row) return;
    row.addEventListener('click', (e) => {
        if (e.target.classList.contains('cheat-bind')) return; // Ignore if clicking bind button
        const adminKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        ADMIN[adminKey] = !ADMIN[adminKey];
        if (ADMIN[adminKey]) row.classList.add('active'); else row.classList.remove('active');
        if (key === 'debug') document.getElementById('debug-overlay').style.display = ADMIN.debug ? 'flex' : 'none';
        if (key === 'spectate') {
            document.getElementById('spectate-hud').style.display = ADMIN.spectate ? 'flex' : 'none';
            if (ADMIN.spectate) { spectateIdx = -1; advanceSpectate(); }
        }
        if (key === 'noclip' && !ADMIN.noclip) Player.z = 0.5;
        if (key === 'flyhack' && !ADMIN.flyhack) Player.z = 0.5;
        if (key === 'infinite-ammo') updateWeaponHUD();
    });
});

// Initialize UI to match ADMIN settings on startup
try {
    document.getElementById('adm-hit-location').value = ADMIN.hitLocation;
    document.getElementById('adm-target-priority').value = ADMIN.targetPriority;
    document.getElementById('adm-aim-key').value = ADMIN.aimKey;
    document.getElementById('adm-silent-key').value = ADMIN.silentKey;
    document.getElementById('adm-silent-mode').value = ADMIN.silentMode;
    document.getElementById('adm-esp-mode').value = ADMIN.espMode;
    document.getElementById('adm-tracer-mode').value = ADMIN.tracerMode;
    document.getElementById('adm-tracer-location').value = ADMIN.tracerLocation;
    document.getElementById('adm-fov-color').value = ADMIN.fovColor;
    document.getElementById('adm-silent-fov-color').value = ADMIN.silentFovColor;
    document.getElementById('adm-esp-color').value = ADMIN.espColor;
    document.getElementById('adm-tracer-color').value = ADMIN.tracerColor;

    admToggles.forEach(key => {
        const row = document.getElementById('adm-' + key);
        if (!row) return;
        const adminKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        if (ADMIN[adminKey]) row.classList.add('active');
        else row.classList.remove('active');
    });
} catch(err) {
    console.error("UI init error:", err);
}

// --- Cheat Menu Keybind System ---
let bindWaitingEl = null, bindWaitingKey = null;
document.querySelectorAll('.cheat-bind').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent row toggle
        if (bindWaitingEl) bindWaitingEl.classList.remove('waiting');
        bindWaitingEl = btn;
        bindWaitingKey = btn.dataset.bind;
        btn.textContent = '[...]';
        btn.classList.add('waiting');
    });
});

window.addEventListener('keydown', e => {
    // Master Hide/Show panel logic
    if (e.code === 'KeyP' && staffLoggedIn) {
        elAdminPanel.style.display = elAdminPanel.style.display === 'none' ? 'block' : 'none';
        if (elAdminPanel.style.display === 'block') {
            STATE.isP = true;
            document.exitPointerLock();
        } else if (STATE.mod === 'PLAY') {
            canvas.requestPointerLock();
        }
    }

    // Capture Keybind
    if (bindWaitingEl) {
        let code = e.code;
        if (code === 'Escape' || code === 'Backspace') {
            delete ADMIN.keybinds[bindWaitingKey];
            bindWaitingEl.textContent = '[ - ]';
        } else {
            ADMIN.keybinds[bindWaitingKey] = code;
            bindWaitingEl.textContent = '[' + code.replace('Key', '').replace('Digit', '') + ']';
        }
        bindWaitingEl.classList.remove('waiting');
        bindWaitingEl = null;
        bindWaitingKey = null;
        e.preventDefault();
        return;
    }

    // Process module toggles via bound keys
    for (const [moduleName, keyCode] of Object.entries(ADMIN.keybinds)) {
        if (e.code === keyCode) {
            const adminKey = moduleName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            ADMIN[adminKey] = !ADMIN[adminKey];
            const row = document.getElementById('adm-' + moduleName);
            if (row) {
                if (ADMIN[adminKey]) row.classList.add('active');
                else row.classList.remove('active');
            }
            if (moduleName === 'debug') document.getElementById('debug-overlay').style.display = ADMIN.debug ? 'flex' : 'none';
            if (moduleName === 'spectate') {
                document.getElementById('spectate-hud').style.display = ADMIN.spectate ? 'flex' : 'none';
                if (ADMIN.spectate) { spectateIdx = -1; advanceSpectate(); }
            }
            if (moduleName === 'noclip' && !ADMIN.noclip) Player.z = 0.5;
        }
    }
});

// --- Cheat Menu Values ---
document.getElementById('adm-add-money').addEventListener('click', () => {
    STATE.mon += 50000;
    document.getElementById('money-val').textContent = '$' + STATE.mon;
    notice('OVERRIDE: $50,000 ADDED');
});
document.getElementById('adm-fov-val').addEventListener('input', e => {
    ADMIN.fov = parseInt(e.target.value);
    document.getElementById('adm-fov-lbl').textContent = ADMIN.fov + 'px';
});
document.getElementById('adm-silent-fov-val').addEventListener('input', e => {
    ADMIN.silentFov = parseInt(e.target.value);
    document.getElementById('adm-silent-fov-lbl').textContent = ADMIN.silentFov + 'px';
});
document.getElementById('adm-accuracy-val').addEventListener('input', e => {
    ADMIN.accuracy = parseInt(e.target.value);
    document.getElementById('adm-accuracy-lbl').textContent = ADMIN.accuracy + '%';
});
document.getElementById('adm-hit-location').addEventListener('change', e => {
    ADMIN.hitLocation = e.target.value;
});
document.getElementById('adm-target-priority').addEventListener('change', e => {
    ADMIN.targetPriority = e.target.value;
});
document.getElementById('adm-speed-val').addEventListener('input', e => {
    ADMIN.speedVal = parseFloat(e.target.value);
    document.getElementById('adm-speed-lbl').textContent = ADMIN.speedVal.toFixed(1) + 'x';
});
document.getElementById('adm-jump-val').addEventListener('input', e => {
    ADMIN.jumpVal = parseFloat(e.target.value);
    document.getElementById('adm-jump-lbl').textContent = ADMIN.jumpVal.toFixed(1);
});
document.getElementById('adm-reload-speed-val').addEventListener('input', e => {
    const val = parseFloat(e.target.value);
    ADMIN.reloadSpeed = val;
    document.getElementById('adm-reload-speed-val-silent').value = val;
    document.getElementById('adm-reload-speed-lbl').textContent = val.toFixed(1) + 'x';
    document.getElementById('adm-reload-speed-lbl-silent').textContent = val.toFixed(1) + 'x';
});
document.getElementById('adm-reload-speed-val-silent').addEventListener('input', e => {
    const val = parseFloat(e.target.value);
    ADMIN.reloadSpeed = val;
    document.getElementById('adm-reload-speed-val').value = val;
    document.getElementById('adm-reload-speed-lbl').textContent = val.toFixed(1) + 'x';
    document.getElementById('adm-reload-speed-lbl-silent').textContent = val.toFixed(1) + 'x';
});

// Wire up keybind dropdowns
document.getElementById('adm-aim-key').addEventListener('change', e => {
    ADMIN.aimKey = e.target.value;
});
document.getElementById('adm-silent-key').addEventListener('change', e => {
    ADMIN.silentKey = e.target.value;
});

// Wire up color pickers
document.getElementById('adm-fov-color').addEventListener('input', e => {
    ADMIN.fovColor = e.target.value;
});
document.getElementById('adm-silent-fov-color').addEventListener('input', e => {
    ADMIN.silentFovColor = e.target.value;
});
document.getElementById('adm-esp-color').addEventListener('input', e => {
    ADMIN.espColor = e.target.value;
});
document.getElementById('adm-tracer-color').addEventListener('input', e => {
    ADMIN.tracerColor = e.target.value;
});

// Wire up FOV Increaser slider
document.getElementById('adm-fov-increaser-val').addEventListener('input', e => {
    const val = parseInt(e.target.value);
    ADMIN.fovIncreaser = val / 10;
    document.getElementById('adm-fov-increaser-lbl').textContent = ADMIN.fovIncreaser.toFixed(1) + 'x' + (val === 10 ? ' (Standard)' : '');
});

document.getElementById('adm-sky-color').addEventListener('input', e => {
    ADMIN.skyColor = e.target.value;
});
document.getElementById('adm-sky-brightness').addEventListener('input', e => {
    ADMIN.skyBrightness = parseFloat(e.target.value);
    document.getElementById('adm-sky-brightness-lbl').textContent = ADMIN.skyBrightness.toFixed(1);
});
document.getElementById('adm-chams-color').addEventListener('input', e => {
    ADMIN.chamsColor = e.target.value;
});
document.getElementById('adm-chams-alpha').addEventListener('input', e => {
    ADMIN.chamsAlpha = parseFloat(e.target.value);
    document.getElementById('adm-chams-alpha-lbl').textContent = ADMIN.chamsAlpha.toFixed(2);
});

document.getElementById('adm-smooth-val').addEventListener('input', e => {
    ADMIN.aimSmooth = parseInt(e.target.value);
    document.getElementById('adm-smooth-lbl').textContent = ADMIN.aimSmooth === 1 ? '1 (Instant)' : ADMIN.aimSmooth;
});
document.getElementById('adm-silent-mode').addEventListener('change', e => {
    ADMIN.silentMode = e.target.value;
});
document.getElementById('adm-esp-mode').addEventListener('change', e => {
    ADMIN.espMode = e.target.value;
});
document.getElementById('adm-tracer-mode').addEventListener('change', e => {
    ADMIN.tracerMode = e.target.value;
});
document.getElementById('adm-tracer-location').addEventListener('change', e => {
    ADMIN.tracerLocation = e.target.value;
});
document.getElementById('adm-hitbox-expansion-val').addEventListener('input', e => {
    ADMIN.hitboxExpansion = parseFloat(e.target.value) / 10;
    document.getElementById('adm-hitbox-expansion-lbl').textContent = ADMIN.hitboxExpansion.toFixed(1) + 'x';
});

// Admin Item Spawner
function populateAdminSpawner() {
    const list = document.getElementById('adm-spawn-weapons-list');
    if (!list) return;
    list.innerHTML = '';
    Arsenal.forEach((w, i) => {
        const opt = document.createElement('option');
        opt.value = 'weapon-' + i;
        opt.textContent = w.name;
        list.appendChild(opt);
    });
}
populateAdminSpawner();

document.getElementById('adm-spawn-item-btn').addEventListener('click', () => {
    const val = document.getElementById('adm-spawn-item').value;
    if (val.startsWith('weapon-')) {
        const idx = parseInt(val.split('-')[1]);
        const w = Arsenal[idx];
        if (addToInventory(new ItemWeapon(w))) {
            notice('SPAWNED INTO INVENTORY: ' + w.name);
            if (STATE.mod === 'INV') renderInventoryUI();
        } else notice('INVENTORY FULL');
    } else if (val.startsWith('ammo-')) {
        // ── Ammo branch (top-level, not nested under item-) ──
        const typeMap = {
            'ammo-9mm':   { type: '9mm', amt: 100 },
            'ammo-44mag': { type: '44 mag', amt: 75 },
            'ammo-223rem':{ type: '.223 rem', amt: 50 },
            'ammo-308win':{ type: '.308 win', amt: 20 },
            'ammo-12g':   { type: '12gauge', amt: 25 },
            'ammo-9x39':  { type: '9x39 subsonic', amt: 60 },
            'ammo-762':   { type: '7.62x62 soviet', amt: 50 },
            'ammo-50bmg': { type: '.50 bmg', amt: 10 },
            'ammo-762x54':{ type: '7.62x54 mmr', amt: 50 }
        };
        const mapped = typeMap[val];
        if (mapped) {
            if (addAmmoToInventory(mapped.type, mapped.amt)) {
                notice('SPAWNED: ' + mapped.type.toUpperCase() + ' AMMO');
                updateWeaponHUD();
                if (STATE.mod === 'INV') renderInventoryUI();
            } else {
                notice('INVENTORY FULL — Cannot spawn ammo');
            }
        }
    } else if (val.startsWith('item-')) {
        const type = val.split('item-')[1];
        if (type === 'bandage') {
            if (addToInventory(new ItemBandage())) {
                notice('SPAWNED: BANDAGE');
                if (STATE.mod === 'INV') renderInventoryUI();
            } else { notice('INVENTORY FULL'); }
        } else if (type === 'medkit') {
            if (addToInventory(new ItemMedkit())) {
                notice('SPAWNED: MEDKIT');
                if (STATE.mod === 'INV') renderInventoryUI();
            } else { notice('INVENTORY FULL'); }
        } else if (type === 'large-medkit') {
            if (addToInventory(new ItemLargeMedkit())) {
                notice('SPAWNED: LARGE MEDKIT');
                if (STATE.mod === 'INV') renderInventoryUI();
            } else { notice('INVENTORY FULL'); }
        } else if (type === 'repair-vest') {
            if (addToInventory(new ItemRepairKit(false))) {
                notice('SPAWNED: VEST REPAIR KIT');
                if (STATE.mod === 'INV') renderInventoryUI();
            } else { notice('INVENTORY FULL'); }
        } else if (type === 'repair-helmet') {
            if (addToInventory(new ItemRepairKit(true))) {
                notice('SPAWNED: HELMET REPAIR KIT');
                if (STATE.mod === 'INV') renderInventoryUI();
            } else { notice('INVENTORY FULL'); }
        } else if (type === 'grenade') {
            if (addToInventory(new ItemGrenade())) {
                notice('SPAWNED: M67 GRENADE');
                if (STATE.mod === 'INV') renderInventoryUI();
            } else { notice('INVENTORY FULL'); }
        } else if (type.startsWith('armor-')) {
            const aName = val.split('item-armor-')[1];
            const a = Armor.find(x => x.name.toLowerCase().includes(aName));
            if (a) {
                if (addToInventory(new ItemArmor(a))) {
                    notice('SPAWNED INTO INVENTORY: ' + a.name);
                    if (STATE.mod === 'INV') renderInventoryUI();
                } else notice('INVENTORY FULL');
            } else {
                // Fallback partial match
                const fallback = {
                    'light': Armor[0],
                    'heavy': Armor[1],
                    'jugg':  Armor[2]
                }[aName];
                if (fallback) {
                    if (addToInventory(new ItemArmor(fallback))) {
                        notice('SPAWNED INTO INVENTORY: ' + fallback.name);
                        if (STATE.mod === 'INV') renderInventoryUI();
                    } else notice('INVENTORY FULL');
                } else {
                    notice('ERROR: Unknown armor type');
                }
            }
        } else if (type.startsWith('helmet-')) {
            const hIdx = parseInt(type.split('helmet-')[1]) - 1;
            const h = Helmets[hIdx];
            if (h) {
                if (addToInventory(new ItemHelmet(h))) {
                    notice('SPAWNED INTO INVENTORY: ' + h.name);
                    if (STATE.mod === 'INV') renderInventoryUI();
                } else notice('INVENTORY FULL');
            }
        } else if (type === 'backpack-traveler') {
            if (addToInventory(new ItemBackpackTraveler())) { notice('SPAWNED: TRAVELER\'S BACKPACK'); if (STATE.mod === 'INV') renderInventoryUI(); } else notice('INVENTORY FULL');
        } else if (type === 'backpack-military') {
            if (addToInventory(new ItemBackpackMilitary())) { notice('SPAWNED: MILITARY BACKPACK'); if (STATE.mod === 'INV') renderInventoryUI(); } else notice('INVENTORY FULL');
        } else if (type === 'backpack-duffle') {
            if (addToInventory(new ItemBackpackDuffle())) { notice('SPAWNED: DUFFLE BAG'); if (STATE.mod === 'INV') renderInventoryUI(); } else notice('INVENTORY FULL');
        } else if (type === 'floppy-red') {
            if (addToInventory(new ItemFloppyRed())) { notice('SPAWNED: RED FLOPPY DISK'); if (STATE.mod === 'INV') renderInventoryUI(); } else notice('INVENTORY FULL');
        } else if (type === 'floppy-black') {
            if (addToInventory(new ItemFloppyBlack())) { notice('SPAWNED: BLACK FLOPPY DISK'); if (STATE.mod === 'INV') renderInventoryUI(); } else notice('INVENTORY FULL');
        }
    }
});

document.getElementById('adm-respawn-crow').addEventListener('click', () => {
    const crow = ents.find(e => e.active && e.t === 'crow');
    if (crow) crow.active = false;
    if (crowDespawnTimer) clearTimeout(crowDespawnTimer);
    randomizeCrowItems();
    
    const candidates = [[31,31],[20,30],[40,30],[31,20],[31,40],[15,31],[45,31]];
    for (const [cx, cy] of candidates.sort(()=>Math.random()-0.5)) {
        let placed = false;
        for (let dy = 0; dy <= 3 && !placed; dy++)
            for (let dx = 0; dx <= 3 && !placed; dx++) {
                const nx = cx+dx, ny = cy+dy;
                if (nx>0 && nx<MAP_SZ-1 && ny>0 && ny<MAP_SZ-1 && wMap[nx][ny] === 0) {
                    const newCrow = new Entity(nx+0.5, ny+0.5, 'crow');
                    newCrow.r = 0.8; ents.push(newCrow);
                    notice('🦅 The Crow Merchant has been force-respawned!', false);
                    placed = true;
                }
            }
        if (placed) break;
    }
    scheduleCrowDespawn();
});

// ── Simulate Damage Buttons ──────────────────────────────────
document.getElementById('adm-dmg-body').addEventListener('click', () => {
    Player.takeDmg(15, 15, 'bullet', false);
    notice('SIM: BODY SHOT (-15 base, armor mitigated)');
});
document.getElementById('adm-dmg-head').addEventListener('click', () => {
    Player.takeDmg(30, 0, 'bullet', true, 2.0);
    notice('💥 SIM: HEADSHOT (-60 UNMITIGATED)');
});
document.getElementById('adm-dmg-zombie').addEventListener('click', () => {
    Player.takeDmg(10, 5, 'zombie', false);
    notice('SIM: ZOMBIE BITE (-10 base, armor mitigated)');
});

// Admin zombie spawner
document.getElementById('adm-spawn-zombie').addEventListener('click', () => {
    const type = document.getElementById('adm-spawn-type').value;
    const frozen = document.getElementById('adm-spawn-frozen').checked;
    const spawnX = Player.x + Player.dx * 3;
    const spawnY = Player.y + Player.dy * 3;
    const e = new Entity(spawnX, spawnY, type);
    if (frozen) e.frozen = true;
    ents.push(e);
    notice(`SPAWNED: ${type.toUpperCase()} (${frozen ? 'FROZEN' : 'ACTIVE'})`);
});


// INIT
// ============================================================
// Logic moved to startMatch() triggered by menu buttons.
if (!loopId) loopId = requestAnimationFrame(tick);
// Host Panel Listeners
document.getElementById('host-spectate-btn').addEventListener('click', () => {
    ADMIN.spectate = !ADMIN.spectate;
    document.getElementById('spectate-hud').style.display = ADMIN.spectate ? 'flex' : 'none';
    if (ADMIN.spectate) { spectateIdx = -1; advanceSpectate(); }
    notice(`HOST: SPECTATE ${ADMIN.spectate ? 'ENABLED' : 'DISABLED'}`);
});
document.getElementById('host-reset-btn').addEventListener('click', () => {
    STATE.pvpTimer = 600;
    notice('HOST: MATCH RESTARTED');
    startMatch();
});
document.getElementById('host-close-btn').addEventListener('click', () => {
    isRunning = false;
    showMenu();
    document.getElementById('host-panel').style.display = 'none';
    document.getElementById('client-hub').style.display = 'none';
    notice('HOST: WORLD CLOSED');
});

// Client Panel Listeners
document.getElementById('client-leave-btn').addEventListener('click', () => {
    isRunning = false;
    showMenu();
    document.getElementById('client-hub').style.display = 'none';
    notice('DISCONNECTED FROM WORLD');
});

// Moderation Listeners
document.getElementById('adm-mod-kick').querySelector('button').addEventListener('click', () => {
    notice('STAFF: PLAYER KICKED');
});
document.getElementById('adm-mod-ban').querySelector('button').addEventListener('click', () => {
    notice('STAFF: PLAYER BANNED');
    if (typeof AC !== 'undefined') AC.triggerBan("Staff Manual Ban");
});

// New Moderation Tools
document.getElementById('mod-unban-btn').addEventListener('click', () => {
    if (typeof STORAGE !== 'undefined') {
        STORAGE.setBan(false);
        notice('STAFF: BAN CLEARED');
        location.reload();
    }
});

document.getElementById('mod-ban-btn').addEventListener('click', () => {
    if (typeof AC !== 'undefined') {
        AC.triggerBan("Staff Test Ban (1H)");
    }
});

// ============================================================
// LOADING SCREEN
// ============================================================
(function() {
    const screen = document.getElementById('loading-screen');
    const fill   = document.getElementById('loading-bar-fill');
    const status = document.getElementById('loading-status');
    const tipEl  = document.getElementById('loading-tip');
    if (!screen) return;

    const steps = [
        [0,   'Initializing engine...'],
        [15,  'Loading map data...'],
        [30,  'Building weapon arsenal...'],
        [50,  'Spawning entities...'],
        [68,  'Compiling shaders...'],
        [82,  'Starting game loop...'],
        [95,  'Almost ready...'],
        [100, 'Welcome, soldier.']
    ];
    const tips = [
        "TIP: Elite zombies don't spawn until Wave 7.",
        "TIP: Zombies reload — wait for the gap!",
        "TIP: Headshots deal double damage and bypass armor.",
        "TIP: The Crow Merchant rotates items every 120 seconds.",
        "TIP: Grenades have linear falloff — close shots deal 150 damage.",
        "TIP: Higher waves give bigger end-of-wave cash bonuses.",
        "TIP: Sprint + Jump for maximum jump height.",
    ];

    let tipIdx = 0;
    const tipInterval = setInterval(() => {
        tipIdx = (tipIdx + 1) % tips.length;
        tipEl.style.opacity = '0';
        setTimeout(() => { tipEl.textContent = tips[tipIdx]; tipEl.style.opacity = '1'; }, 300);
    }, 2800);
    tipEl.style.transition = 'opacity 0.3s';

    const lc = document.getElementById('loading-canvas');
    lc.width = window.innerWidth; lc.height = window.innerHeight;
    const lCtx = lc.getContext('2d');
    const lParts = Array.from({length: 60}, () => ({
        x: Math.random() * lc.width, y: Math.random() * lc.height,
        vx: (Math.random() - 0.5) * 0.3, vy: -Math.random() * 0.4 - 0.1,
        size: Math.random() * 1.5 + 0.5, alpha: Math.random() * 0.4 + 0.1
    }));
    let loadingRunning = true;
    function animLoading() {
        if (!loadingRunning) return;
        lCtx.clearRect(0, 0, lc.width, lc.height);
        lCtx.fillStyle = '#050508'; lCtx.fillRect(0, 0, lc.width, lc.height);
        for (const p of lParts) {
            p.x += p.vx; p.y += p.vy;
            if (p.y < 0) { p.y = lc.height; p.x = Math.random() * lc.width; }
            lCtx.beginPath(); lCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            lCtx.fillStyle = `rgba(229,64,40,${p.alpha})`; lCtx.fill();
        }
        requestAnimationFrame(animLoading);
    }
    animLoading();

    let stepIdx = 0;
    function nextStep() {
        if (stepIdx >= steps.length) {
            clearInterval(tipInterval);
            setTimeout(() => {
                screen.classList.add('fade-out');
                setTimeout(() => { screen.style.display = 'none'; loadingRunning = false; }, 700);
            }, 400);
            return;
        }
        const [pct, msg] = steps[stepIdx++];
        fill.style.width = pct + '%';
        status.textContent = msg;
        const delay = stepIdx === steps.length ? 300 : (Math.random() * 180 + 120);
        setTimeout(nextStep, delay);
    }
    setTimeout(nextStep, 300);
})();

// ============================================================
// MENU SIDEBAR NAV + PARTICLE BACKGROUND
// ============================================================
(function() {
    document.querySelectorAll('.menu-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.screen;
            document.querySelectorAll('.menu-nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(targetId);
            if (target) target.classList.add('active');
        });
    });

    const mc = document.getElementById('menu-bg-canvas');
    if (!mc) return;
    function resizeMC() { mc.width = window.innerWidth; mc.height = window.innerHeight; }
    resizeMC();
    window.addEventListener('resize', resizeMC);
    const mCtxBg = mc.getContext('2d');
    const bgParts = Array.from({length: 80}, () => ({
        x: Math.random() * mc.width, y: Math.random() * mc.height,
        vx: (Math.random() - 0.5) * 0.15, vy: -Math.random() * 0.25 - 0.05,
        size: Math.random() * 1.2 + 0.3, alpha: Math.random() * 0.25 + 0.05
    }));
    function animMenuBg() {
        const mo = document.getElementById('menu-overlay');
        // Skip rendering when menu is hidden (game is running)
        const moDisplay = mo ? (mo.style.display || getComputedStyle(mo).display) : 'none';
        if (!mo || moDisplay === 'none') { setTimeout(animMenuBg, 500); return; }
        mCtxBg.clearRect(0, 0, mc.width, mc.height);
        const grad = mCtxBg.createLinearGradient(0, 0, mc.width, mc.height);
        grad.addColorStop(0, '#060609'); grad.addColorStop(1, '#0d0610');
        mCtxBg.fillStyle = grad; mCtxBg.fillRect(0, 0, mc.width, mc.height);
        const vig = mCtxBg.createRadialGradient(mc.width * 0.75, 0, 0, mc.width * 0.75, 0, mc.width * 0.8);
        vig.addColorStop(0, 'rgba(229,64,40,0.08)'); vig.addColorStop(1, 'rgba(0,0,0,0)');
        mCtxBg.fillStyle = vig; mCtxBg.fillRect(0, 0, mc.width, mc.height);
        for (const p of bgParts) {
            p.x += p.vx; p.y += p.vy;
            if (p.y < 0) { p.y = mc.height; p.x = Math.random() * mc.width; }
            if (p.x < 0 || p.x > mc.width) p.x = Math.random() * mc.width;
            mCtxBg.beginPath(); mCtxBg.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            mCtxBg.fillStyle = `rgba(229,64,40,${p.alpha})`; mCtxBg.fill();
        }
        requestAnimationFrame(animMenuBg);
    }
    animMenuBg();
})();
