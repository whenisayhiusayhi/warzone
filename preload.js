// Preload script - context bridge for any future Node.js <-> renderer communication
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    version: process.versions.electron,
    discovery: {
        startHost: (id, name) => require('electron').ipcRenderer.send('discovery-start-host', { id, name }),
        stopHost: () => require('electron').ipcRenderer.send('discovery-stop-host'),
        onServerFound: (cb) => require('electron').ipcRenderer.on('discovery-server-found', (event, data) => cb(data))
    },
    storage: {
        save: (data) => require('electron').ipcRenderer.send('data-save', data),
        load: () => require('electron').ipcRenderer.invoke('data-load')
    },
    updater: {
        onStatus: (cb) => require('electron').ipcRenderer.on('update-status', (event, data) => cb(data)),
        onProgress: (cb) => require('electron').ipcRenderer.on('update-progress', (event, progress) => cb(progress))
    },
    network: {
        getIp: () => require('electron').ipcRenderer.invoke('net-get-ip'),
        host: (port) => require('electron').ipcRenderer.send('net-host', port),
        join: (ip, port) => require('electron').ipcRenderer.send('net-join', { ip, port }),
        send: (targetId, data) => require('electron').ipcRenderer.send('net-send', { targetId, data }),
        broadcast: (data) => require('electron').ipcRenderer.send('net-broadcast', data),
        close: () => require('electron').ipcRenderer.send('net-close'),
        
        onConnected: (cb) => {
            require('electron').ipcRenderer.removeAllListeners('net-connected');
            require('electron').ipcRenderer.on('net-connected', (event, data) => cb(data));
        },
        onDisconnected: (cb) => {
            require('electron').ipcRenderer.removeAllListeners('net-disconnected');
            require('electron').ipcRenderer.on('net-disconnected', (event, data) => cb(data));
        },
        onData: (cb) => {
            require('electron').ipcRenderer.removeAllListeners('net-data');
            require('electron').ipcRenderer.on('net-data', (event, data) => cb(data));
        },
        onError: (cb) => {
            require('electron').ipcRenderer.removeAllListeners('net-error');
            require('electron').ipcRenderer.on('net-error', (event, data) => cb(data));
        }
    }
});
