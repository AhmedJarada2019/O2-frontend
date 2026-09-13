const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const DEFAULT_SERVER_URL = 'http://192.168.2.250:8095/pos';

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return { serverUrl: DEFAULT_SERVER_URL };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

let mainWindow;

function createWindow() {
  const config = loadConfig();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      partition: 'persist:cashier',
      contextIsolation: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.loadURL(config.serverUrl);

  mainWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) mainWindow.loadURL(config.serverUrl);
    }, 3000);
  });
}

function openSettings() {
  const config = loadConfig();
  const settingsWin = new BrowserWindow({
    width: 480,
    height: 260,
    parent: mainWindow,
    modal: true,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
    },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  settingsWin.webContents.once('did-finish-load', () => {
    settingsWin.webContents.send('current-url', config.serverUrl);
  });
}

const menuTemplate = [
  {
    label: 'القائمة',
    submenu: [
      { label: 'إعادة تحميل', accelerator: 'F5', click: () => mainWindow.reload() },
      { label: 'إعدادات الخادم', click: openSettings },
      { label: 'ملء الشاشة', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
      { type: 'separator' },
      { label: 'خروج', role: 'quit' },
    ],
  },
];

ipcMain.on('save-server-url', (_event, url) => {
  saveConfig({ serverUrl: url });
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(url);
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
