/**
 * TEMP DATA MANAGER
 * Handles persistent player stats, waves, and anti-cheat state.
 */

const STORAGE = {
    data: {
        money: 0,
        wave: 1,
        highestWave: 1,
        totalKills: 0,
        deaths: 0,
        totalCoinsEarned: 0,
        playtime: 0,
        banStatus: {
            isBanned: false,
            banEnd: 0,
            reason: ""
        },
        settings: {
            username: "Jayden_111"
        }
    },

    async init() {
        // If running in Electron, wait for the electronAPI to be injected
        const isElectron = navigator.userAgent.toLowerCase().includes('electron');
        if (isElectron) {
            for (let i = 0; i < 100; i++) {
                if (window.electronAPI && window.electronAPI.storage) break;
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }

        let loaded = null;
        if (window.electronAPI && window.electronAPI.storage) {
            loaded = await window.electronAPI.storage.load();
        } else {
            // Browser testing: Try fetching temp_data.json from server first
            try {
                const res = await fetch('temp_data.json');
                if (res.ok) {
                    loaded = await res.json();
                }
            } catch (e) {
                console.log("Browser load: temp_data.json fetch failed.");
            }
        }

        if (loaded) {
            this.data = { ...this.data, ...loaded };
            console.log("Loaded persistent data from temp_data.json:", this.data);
            if (!isElectron) {
                // Keep localStorage in sync ONLY for browser mode
                localStorage.setItem("bod_temp_data", JSON.stringify(this.data));
            }
        } else if (!isElectron) {
            // Fallback to localStorage ONLY if completely outside Electron
            const local = localStorage.getItem("bod_temp_data");
            if (local) this.data = JSON.parse(local);
        }

        // URL-based override for easy developer/staff unbanning
        if (typeof location !== 'undefined' && (location.hash === '#unban' || location.search.includes('unban'))) {
            this.data.banStatus.isBanned = false;
            this.data.banStatus.banEnd = 0;
            this.data.banStatus.reason = "";
            this.save();
            console.log("Ban cleared via URL unban trigger.");
            if (location.hash === '#unban') location.hash = '';
        }
        
        this.applyToGame();
    },

    save() {
        const isElectron = navigator.userAgent.toLowerCase().includes('electron');
        if (window.electronAPI && window.electronAPI.storage) {
            window.electronAPI.storage.save(this.data);
        } else if (!isElectron) {
            localStorage.setItem("bod_temp_data", JSON.stringify(this.data));
        }
    },

    applyToGame() {
        // We no longer sync money and waves to STATE so players start fresh every time
        if (typeof STATE !== 'undefined') {
            // UI Update
            const monEl = document.getElementById('money-val');
            const wvEl = document.getElementById('wave-val');
            if (monEl) monEl.textContent = '$' + STATE.mon;
            if (wvEl) wvEl.textContent = 'Wave ' + STATE.wv;
        }
    },

    updateStat(key, value) {
        this.data[key] = value;
        this.save();
    },

    setBan(isBanned, durationHours = 1, reason = "Script Injection") {
        this.data.banStatus.isBanned = isBanned;
        this.data.banStatus.reason = reason;
        this.data.banStatus.banEnd = isBanned ? (Date.now() + durationHours * 3600000) : 0;
        this.save();
    }
};

// Init immediately and expose Promise
STORAGE.initPromise = STORAGE.init();
