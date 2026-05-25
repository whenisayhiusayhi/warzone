const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dgram = require('dgram');
const net = require('net');
const { autoUpdater } = require('electron-updater');

// ===================== LAN DISCOVERY =====================
const DISCOVERY_PORT = 44444;
let discoveryServer = null;
let broadcastInterval = null;

function initDiscovery(win) {
    discoveryServer = dgram.createSocket('udp4');
    
    discoveryServer.on('error', (err) => {
        console.error(`Discovery error:\n${err.stack}`);
        discoveryServer.close();
    });

    discoveryServer.on('message', (msg, rinfo) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'BOD_HOST') {
                win.webContents.send('discovery-server-found', {
                    id: data.id,
                    ip: rinfo.address,
                    name: data.name || 'BOD Server'
                });
            }
        } catch (e) {}
    });

    discoveryServer.bind(DISCOVERY_PORT, () => {
        discoveryServer.setBroadcast(true);
        console.log(`LAN Discovery listening on ${DISCOVERY_PORT}`);
    });
}

ipcMain.on('discovery-start-host', (event, { id, name }) => {
    if (broadcastInterval) clearInterval(broadcastInterval);
    
    const msg = Buffer.from(JSON.stringify({ type: 'BOD_HOST', id, name }));
    const broadcastAddr = '255.255.255.255';
    
    broadcastInterval = setInterval(() => {
        if (discoveryServer) {
            discoveryServer.send(msg, 0, msg.length, DISCOVERY_PORT, broadcastAddr);
        }
    }, 2000);
});

ipcMain.on('discovery-stop-host', () => {
    if (broadcastInterval) {
        clearInterval(broadcastInterval);
        broadcastInterval = null;
    }
});

ipcMain.handle('net-get-ip', () => {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
});

// ===================== TRUE P2P TCP NETWORK =====================
let netServer = null;
let netClient = null;
let netConnections = []; // Host's clients

ipcMain.on('net-host', (event, port) => {
    if (netServer) return; // already hosting
    netServer = net.createServer((socket) => {
        const id = Math.random().toString(36).substring(2, 8);
        socket.clientId = id;
        netConnections.push(socket);
        
        let serverBuffer = '';
        socket.on('data', (data) => {
            serverBuffer += data.toString();
            let lines = serverBuffer.split('\n');
            serverBuffer = lines.pop(); // last incomplete line stays in buffer
            lines.forEach(line => {
                if (!line) return;
                try {
                    const parsed = JSON.parse(line);
                    event.sender.send('net-data', { sender: id, data: parsed });
                } catch(e) {}
            });
        });
        
        socket.on('close', () => {
            netConnections = netConnections.filter(c => c !== socket);
            event.sender.send('net-disconnected', id);
        });
        
        event.sender.send('net-connected', id);
    });
    
    netServer.listen(port, '0.0.0.0', () => {
        console.log(`TCP Server listening on port ${port}`);
    });
});

ipcMain.on('net-join', (event, { ip, port }) => {
    if (netClient) netClient.destroy();
    
    netClient = net.createConnection({ port, host: ip }, () => {
        console.log(`Connected to TCP server at ${ip}:${port}`);
        event.sender.send('net-connected', 'host');
    });
    
    let clientBuffer = '';
    netClient.on('data', (data) => {
        clientBuffer += data.toString();
        let lines = clientBuffer.split('\n');
        clientBuffer = lines.pop();
        lines.forEach(line => {
            if (!line) return;
            try {
                const parsed = JSON.parse(line);
                event.sender.send('net-data', { sender: 'host', data: parsed });
            } catch(e) {}
        });
    });
    
    netClient.on('close', () => {
        event.sender.send('net-disconnected', 'host');
        netClient = null;
    });
    
    netClient.on('error', (err) => {
        event.sender.send('net-error', err.message);
    });
});

ipcMain.on('net-send', (event, { targetId, data }) => {
    const payload = JSON.stringify(data) + '\n';
    if (netClient) {
        // We are a client, send to host
        netClient.write(payload);
    } else if (netServer) {
        // We are host, send to specific client
        const target = netConnections.find(c => c.clientId === targetId);
        if (target) target.write(payload);
    }
});

ipcMain.on('net-broadcast', (event, data) => {
    const payload = JSON.stringify(data) + '\n';
    if (netServer) {
        netConnections.forEach(c => c.write(payload));
    }
});

ipcMain.on('net-close', () => {
    if (netClient) {
        netClient.destroy();
        netClient = null;
    }
    if (netServer) {
        netConnections.forEach(c => c.destroy());
        netConnections = [];
        netServer.close();
        netServer = null;
    }
});

// ===================== DATA STORAGE =====================
const DATA_PATH = app.isPackaged ? path.join(app.getPath('userData'), 'save_data.json') : path.join(__dirname, 'src', 'temp_data.json');

ipcMain.on('data-save', (event, data) => {
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 4));
        console.log('Data saved to temp_data.json');
    } catch (e) {
        console.error('Failed to save data:', e);
    }
});

ipcMain.handle('data-load', () => {
    try {
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf8').trim();
            if (!raw) return null; // Handle empty/wiped file cleanly
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('Failed to load data, resetting file:', e);
        try {
        // Write clean default file to recover from corruption
        const defaultData = {
            money: 0,
            wave: 1,
            totalKills: 0,
            banStatus: { isBanned: false, banEnd: 0, reason: "" },
            settings: { username: "Jayden_111" }
        };
        // Use AppData path in production, else temp_data.json
        const userPath = path.join(app.getPath('userData'), 'save_data.json');
        fs.writeFileSync(userPath, JSON.stringify(defaultData, null, 4));
        } catch (err) {}
    }
    return null;
});

// ===================== ELECTRON BOILERPLATE =====================
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) { app.quit(); } else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 720, minWidth: 960, minHeight: 600,
        title: 'BATTLE OF DOOM - Neon Strike Omega',
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        backgroundColor: '#0a0a0f', show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        }
    });

    Menu.setApplicationMenu(null);
    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
        // mainWindow.webContents.openDevTools(); // Disabled for production
        initDiscovery(mainWindow);
        
        // Auto Updater logic
        autoUpdater.checkForUpdatesAndNotify();
    });
    
    autoUpdater.on('checking-for-update', () => {
        mainWindow.webContents.send('update-status', 'Checking for updates...');
    });
    
    autoUpdater.on('update-available', () => {
        mainWindow.webContents.send('update-status', 'Update available. Downloading...');
    });
    
    autoUpdater.on('update-not-available', () => {
        mainWindow.webContents.send('update-status', '');
    });
    
    autoUpdater.on('error', (err) => {
        let msg = err.message || '';
        if (msg.includes('404')) {
            msg = 'Update server unreachable (No releases found).';
        } else if (msg.length > 50) {
            msg = msg.substring(0, 50) + '...';
        }
        mainWindow.webContents.send('update-status', 'Updater: ' + msg);
    });
    
    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow.webContents.send('update-progress', progressObj.percent);
    });
    
    autoUpdater.on('update-downloaded', () => {
        mainWindow.webContents.send('update-status', 'Update downloaded. Restarting...');
        setTimeout(() => {
            autoUpdater.quitAndInstall();
        }, 3000);
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { app.quit(); });
