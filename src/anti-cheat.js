/**
 * WARZONE ANTI-CHEAT (WAC)
 * Roblox-style ban system & Script Injection Detection
 */

const AC = {
    isBanned: false,

    async init() {
        if (typeof STORAGE !== 'undefined' && STORAGE.initPromise) {
            await STORAGE.initPromise;
        }
        this.checkBan();
        this.startDetection();
        
        // Block deploy if banned
        const deployBtns = document.querySelectorAll('.mode-btn, .menu-mode-btn, #btn-deploy-solo, #btn-enter-lobby, #respawn-btn');
        deployBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.isBanned) {
                    e.stopImmediatePropagation();
                    this.showBanScreen();
                }
            });
        });
    },


    checkBan() {
        if (typeof STORAGE === 'undefined') return;
        
        const status = STORAGE.data.banStatus;
        if (status.isBanned) {
            const now = Date.now();
            if (now < status.banEnd) {
                this.isBanned = true;
                this.showBanScreen();
            } else {
                // Ban expired
                STORAGE.setBan(false);
                this.isBanned = false;
            }
        }
    },

    showBanScreen() {
        const overlay = document.getElementById('ban-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            this.updateTimer();
        }
    },

    updateTimer() {
        const timerEl = document.getElementById('ban-timer-val');
        if (!timerEl) return;

        const interval = setInterval(() => {
            const remaining = (STORAGE.data.banStatus?.banEnd || 0) - Date.now();
            if (remaining <= 0) {
                clearInterval(interval);
                location.reload(); // Unban
                return;
            }

            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            timerEl.textContent = `${mins}m ${secs}s`;
        }, 1000);
    },

    startDetection() {
        // 1. Detection of eval/Function injection
        const self = this;
        const originalEval = window.eval;
        window.eval = function(code) {
            self.triggerBan("Console Script Injection (eval)");
            return originalEval.apply(this, arguments);
        };

        const originalFunction = window.Function;
        window.Function = function() {
            self.triggerBan("Console Script Injection (Function)");
            return originalFunction.apply(this, arguments);
        };

        // 2. Enhanced DOM Mutation Detection
        const observer = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue; // Only element nodes
                    
                    if (node.tagName === 'SCRIPT') {
                        const src = node.src || '';
                        if (src && !src.includes('game.js') && !src.includes('temp_data.js') && !src.includes('anti-cheat.js') && !src.includes('peerjs')) {
                            self.triggerBan("External Script Injection");
                        }
                    }
                    
                    // UNIVERSAL PATCH: Detect Cheat UI signatures
                    const content = node.innerText || node.innerHTML || "";
                    if (typeof content === 'string' && (content.includes('NEON_AUDIT') || content.includes('AIMLOCK') || node.id === 'f-aim' || node.id === 'drag-h')) {
                        self.triggerBan("Cheat UI Signature Detected");
                    }

                    // UNIVERSAL PATCH: Detect unauthorized Canvas Overlays
                    const allowedCanvases = ['gameCanvas', 'minimap', 'loading-canvas', 'menu-bg-canvas', 'inv-player-canvas'];
                    if (node.tagName === 'CANVAS' && !allowedCanvases.includes(node.id)) {
                        const style = window.getComputedStyle(node);
                        if (style.pointerEvents === 'none' || parseInt(style.zIndex) > 1000) {
                            self.triggerBan("Overlay Cheat Detected");
                        }
                    }
                }
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        // 3. Global Variable & Memory Protection
        setInterval(() => {
            if (window.CheatEngine || window.Exploit) {
                self.triggerBan("Known Exploit Tool Detected");
            }
            // Detect unauthorized admin bypass
            if (window.staffLoggedIn && !window.staffAuthVerified) {
                self.triggerBan("Unauthorized Admin Access");
            }
        }, 2000);
    },

    triggerBan(reason) {
        if (this.isBanned) return;
        console.warn("ANTI-CHEAT TRIGGERED:", reason);
        this.isBanned = true;
        STORAGE.setBan(true, 1, reason);
        this.showBanScreen();
    }
};

window.AC = AC;
window.addEventListener('load', () => AC.init());
