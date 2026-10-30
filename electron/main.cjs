const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  desktopCapturer,
  globalShortcut,
  shell,
  clipboard,
  Tray,
  Menu,
  nativeImage,
  session,
} = require('electron');
const path = require('path');
const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const {
  initSystemDaemon,
  killSystemDaemon,
  startHotkeyWatcher,
  updateHotkeyWatcher,
  preCacheDefaultWallpapers,
  getWallpaperDataUrl,
  applyDesktopWallpaper,
  setSystemVolume,
  setSystemMute,
  setNightLightStrength,
  toggleBluetoothDirect,
  getWifiNetworks,
  getBluetoothDevices,
  toggleSystemDarkModeDirect,
  sendMediaKeyControl,
  getNowPlayingMedia,
  seekMediaSession,
  startClipboardWatcher,
  getClipboardHistory,
  deleteClipboardItem,
  togglePinClipboardItem,
  clearClipboardHistory,
  getSystemStats,
  getControlsState,
  getInstalledApps,
  runSpeedTest,
  pickWallpaperFiles,
  playSpotifyMedia,
} = require('./systemController.cjs');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-direct-composition-video-overlays');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('enable-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-crash-reporter');

const KIBO_LOCAL_PORT = 51742;

let mainWindow = null;
let tray = null;
let hitTestInterval = null;
let isIgnoringMouse = false;

let activeNotchBounds = {
  width: 280,
  height: 38,
};

let activeAppWindowRect = null;
let activeRoamingRects = [];
let isRoamingEscapeRegistered = false;
let isLassoActive = false;
let isAgentDockActive = false;
let isAgentDockHovered = false;

function setWindowBounds(width, height) {
  activeNotchBounds.width = Math.round(width || 280);
  activeNotchBounds.height = Math.round(height || 38);
}

function positionCanvasWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;
  mainWindow.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height - 2, // Prevents Windows DWM fullscreen promotion blackout
  });
}

function startHitTestLoop() {
  if (hitTestInterval) clearInterval(hitTestInterval);

  hitTestInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const cursor = screen.getCursorScreenPoint();
    const winBounds = mainWindow.getBounds();

    const notchHalfW = activeNotchBounds.width / 2;
    const centerX = winBounds.x + winBounds.width / 2;

    const insideNotchX =
      cursor.x >= centerX - notchHalfW && cursor.x <= centerX + notchHalfW;
    const insideNotchY =
      cursor.y >= winBounds.y &&
      cursor.y <= winBounds.y + activeNotchBounds.height;
    const insideNotch = insideNotchX && insideNotchY;

    let insideAppWin = false;
    if (activeAppWindowRect) {
      const rx = winBounds.x + activeAppWindowRect.x;
      const ry = winBounds.y + activeAppWindowRect.y;
      insideAppWin =
        cursor.x >= rx &&
        cursor.x <= rx + activeAppWindowRect.width &&
        cursor.y >= ry &&
        cursor.y <= ry + activeAppWindowRect.height;
    }

    let insideTarget = false;
    if (activeRoamingRects.length > 0) {
      for (const r of activeRoamingRects) {
        if (
          r &&
          cursor.x >= r.x &&
          cursor.x <= r.x + r.width &&
          cursor.y >= r.y &&
          cursor.y <= r.y + r.height
        ) {
          insideTarget = true;
          break;
        }
      }
    }

    let insideAgentDock = false;
    if (isAgentDockActive) {
      const isExpandedDock = isAgentDockHovered;
      const dockLeft = isExpandedDock
        ? winBounds.x + winBounds.width - 340
        : winBounds.x + winBounds.width - 92;
      const dockRight = winBounds.x + winBounds.width - 18;
      const dockTop = winBounds.y + 58;
      const dockBottom = isExpandedDock
        ? winBounds.y + 360
        : winBounds.y + 132;
      insideAgentDock =
        cursor.x >= dockLeft &&
        cursor.x <= dockRight &&
        cursor.y >= dockTop &&
        cursor.y <= dockBottom;
    }

    const shouldIgnore = !isLassoActive && !(insideNotch || insideAppWin || insideTarget || insideAgentDock);

    if (shouldIgnore !== isIgnoringMouse) {
      isIgnoringMouse = shouldIgnore;
      if (shouldIgnore) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      } else {
        mainWindow.setIgnoreMouseEvents(false);
      }
    }
  }, 16);
}

let currentTrayColorHex = '#38BDF8';

function parseHexColor(hex) {
  try {
    let c = String(hex || '#38BDF8').replace('#', '').trim();
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return { r: 56, g: 189, b: 248 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  } catch (_) {
    return { r: 56, g: 189, b: 248 };
  }
}

function createKiboTrayIcon() {
  const iconPath = path.join(__dirname, '../public/icon-256.png');
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      return img.resize({ width: 24, height: 24, quality: 'best' });
    }
  }
  return nativeImage.createEmpty();
}

// Dedicated Fiery Ember Tray Icon with white core, radiant amber-vermilion body and ascending sparks
function createEmberTrayIcon() {
  const emberIconPath = path.join(__dirname, '../public/kibo-core-tray.png');
  if (fs.existsSync(emberIconPath)) {
    const loaded = nativeImage.createFromPath(emberIconPath);
    if (!loaded.isEmpty()) {
      return loaded.resize({ width: 32, height: 32, quality: 'best' });
    }
  }

  const size = 32;
  const buf = Buffer.alloc(size * size * 4, 0);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ny = (y - 18.5) / 10.5;
      const taper = y < 18 ? Math.max(0.18, ((y - 2) / 16) * 0.95) : 1.0 - (y - 18) * 0.015;
      const nx = (x - 15.5) / (9.5 * taper);
      const dist = Math.sqrt(nx * nx + ny * ny);

      if (y >= 2 && y <= 29 && dist <= 1.25) {
        const idx = (y * size + x) * 4;
        const isLeftEye = y >= 17 && y <= 21 && x >= 11 && x <= 13;
        const isRightEye = y >= 17 && y <= 21 && x >= 18 && x <= 20;

        if (isLeftEye || isRightEye) {
          buf[idx] = 10;
          buf[idx + 1] = 10;
          buf[idx + 2] = 25;
          buf[idx + 3] = 255;
        } else if (dist <= 0.50) {
          // White-gold core
          buf[idx] = 200;
          buf[idx + 1] = 245;
          buf[idx + 2] = 255;
          buf[idx + 3] = 255;
        } else if (dist <= 0.88) {
          // Radiant fiery amber body
          buf[idx] = 30;
          buf[idx + 1] = 160;
          buf[idx + 2] = 255;
          buf[idx + 3] = 255;
        } else {
          // Fiery crimson/vermilion flame rim
          const alpha = Math.max(0, Math.min(255, Math.round((1.25 - dist) * 4 * 240)));
          buf[idx] = 20;
          buf[idx + 1] = 70;
          buf[idx + 2] = 255;
          buf[idx + 3] = alpha;
        }
      }
    }
  }

  // Drifting golden sparks (BGRA: Blue, Green, Red, Alpha)
  const sparks = [
    [15, 2, 40, 225, 255, 240],
    [12, 4, 30, 180, 255, 220],
    [19, 5, 40, 195, 255, 220],
    [14, 6, 120, 240, 255, 255],
    [17, 3, 50, 210, 255, 200],
  ];
  for (const [sx, sy, b, g, r, a] of sparks) {
    const sidx = (sy * size + sx) * 4;
    buf[sidx] = b;
    buf[sidx + 1] = g;
    buf[sidx + 2] = r;
    buf[sidx + 3] = a;
  }

  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

let activeShortcuts = {
  ask: 'Win + Alt',
  circle: 'Ctrl + Shift',
  dictate: 'Ctrl + Win',
};

// Embers Forge Tray State & Theme
let emberState = {
  count: 67,
  isWaiting: false,
};
let currentTrayTheme = 'hito'; // Blue Kibo tray icon
let isKiboPaused = false;

function refreshTrayIconAndTooltip() {
  if (!tray) return;
  const icon = createKiboTrayIcon();
  tray.setImage(icon);
  tray.setToolTip('Kibo · Voice Control for Windows');
}

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Settings',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.showInactive();
          mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
          mainWindow.webContents.send('open-settings', 'Account');
        }
      },
    },
    {
      label: isKiboPaused ? 'Resume Kibo' : 'Pause Kibo',
      click: () => {
        isKiboPaused = !isKiboPaused;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('toggle-kibo-pause', isKiboPaused);
        }
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Report a Bug...',
      click: () => {
        shell.openExternal('https://github.com/RaahimAlavi/kibo/issues');
      },
    },
    {
      label: 'Request a Feature...',
      click: () => {
        shell.openExternal('https://github.com/RaahimAlavi/kibo/discussions');
      },
    },
    {
      label: 'What\'s New',
      click: () => {
        shell.openExternal('https://github.com/RaahimAlavi/kibo/releases');
      },
    },
    {
      label: 'Check for Updates...',
      click: () => {
        dialog.showMessageBox(mainWindow || undefined, {
          type: 'info',
          title: 'Kibo Update',
          message: 'You are on the latest version of Kibo (v1.0.0).',
          detail: 'Automatic background updates are enabled.',
          buttons: ['OK'],
        });
      },
    },
    { type: 'separator' },
    {
      label: 'Run Kibo on Startup',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({
          openAtLogin: menuItem.checked,
          path: process.execPath,
        });
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Kibo',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}



function createSystemTray() {
  if (tray) return;

  const icon = createKiboTrayIcon();
  tray = new Tray(icon);
  refreshTrayIconAndTooltip();
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('open-settings', 'Account');
    }
  });

  tray.on('right-click', () => {

    if (tray) tray.popUpContextMenu();

  });

}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;

  // Automatically grant microphone & media permissions for Hold-to-Speak voice capture
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler(() => true);

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height - 2, // Prevents Windows DWM fullscreen promotion blackout
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    fullscreenable: false,
    maximizable: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    skipTaskbar: true,
    icon: path.join(__dirname, '../public/icon-256.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.on('console-message', (event, ...args) => {
    let level = 0, message = '', line = 0, sourceId = '';
    if (event && typeof event === 'object' && ('message' in event || 'level' in event)) {
      level = event.level || 0;
      message = event.message || '';
      line = event.lineNumber || event.line || 0;
      sourceId = event.sourceId || '';
    } else {
      level = args[0] || 0;
      message = args[1] || '';
      line = args[2] || 0;
      sourceId = args[3] || '';
    }
    if (String(message).includes('Content-Security-Policy')) return;
    if (level >= 2 || String(message).includes('Error') || String(message).includes('Uncaught')) {
      console.log('[Renderer Log]', message, sourceId ? '(' + sourceId + ':' + line + ')' : '');
    }
  });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Renderer Fail Load]', errorCode, errorDescription, validatedURL);
  });

  // Use 'pop-up-menu' level instead of 'screen-saver' so Windows DWM keeps hardware video overlays alive
  mainWindow.setAlwaysOnTop(true, 'pop-up-menu');

  startHitTestLoop();
  startClipboardWatcher(() => mainWindow);
  startHotkeyWatcher((hotkeyAction) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (hotkeyAction === 'LASSO_DOWN') {
      isLassoActive = true;
      mainWindow.setIgnoreMouseEvents(false);
    } else if (hotkeyAction === 'LASSO_UP') {
      isLassoActive = false;
      if (mainWindow && !mainWindow.isDestroyed()) {
        isIgnoringMouse = true;
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    }
    mainWindow.webContents.send('hotkey-event', hotkeyAction);
  });

  screen.on('display-metrics-changed', positionCanvasWindow);

  const killScrollbarsCSS = `
    html, body, #root, * {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    ::-webkit-scrollbar {
      display: none !important;
      width: 0px !important;
      height: 0px !important;
    }
    html, body, #root, .kibo-companion-root, .kibo-companion-root {
      background: transparent !important;
      background-color: transparent !important;
      background-image: none !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    html::before, html::after, body::before, body::after, #root::before, #root::after {
      display: none !important;
      content: none !important;
      background: transparent !important;
    }
  `;

  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.insertCSS(killScrollbarsCSS).catch(() => {});
    mainWindow.webContents
      .executeJavaScript(`
        document.documentElement.classList.add('desktop-mode');
        document.body.classList.add('desktop-mode');
      `)
      .catch(() => {});
  });

  const distRoot = path.join(__dirname, '../dist');
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  const localServer = http.createServer((req, res) => {
    try {
      const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${KIBO_LOCAL_PORT}`);

      // Native Windows Installer Direct Chrome Download Endpoint
      if (parsedUrl.pathname.startsWith('/download/')) {
        const candidates = [
          path.join(__dirname, '../release/Kibo Setup 1.0.0.exe'),
          path.join(__dirname, '../release/Kibo-Setup-1.0.0.exe'),
          path.join(__dirname, '../release/win-unpacked/Kibo.exe'),
          path.join(__dirname, '../release/Kibo.exe'),
        ];
        const exePath = candidates.find((p) => fs.existsSync(p));
        if (exePath) {
          const stat = fs.statSync(exePath);
          res.writeHead(200, {
            'Content-Type': 'application/vnd.microsoft.portable-executable',
            'Content-Disposition': 'attachment; filename="Kibo-Setup.exe"',
            'Content-Length': stat.size,
            'Cache-Control': 'no-cache',
          });
          return fs.createReadStream(exePath).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Kibo installer executable not found.');
        }
      }

      // Safely stream local Windows wallpaper and user image files over HTTP
      if (parsedUrl.pathname === '/api/wallpaper') {
        const rawTarget = parsedUrl.searchParams.get('path');
        if (rawTarget && fs.existsSync(rawTarget)) {
          const ext = path.extname(rawTarget).toLowerCase();
          res.writeHead(200, {
            'Content-Type': mimeTypes[ext] || 'image/jpeg',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          });
          return fs.createReadStream(rawTarget).pipe(res);
        } else {
          res.writeHead(404);
          return res.end('Not found');
        }
      }

      let safePath = decodeURIComponent(parsedUrl.pathname);
      if (safePath === '/' || safePath === '/index.html') safePath = '/index.html';
      const filePath = path.join(distRoot, safePath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        const fallbackIndex = path.join(distRoot, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(fallbackIndex).pipe(res);
      }
    } catch (e) {
      res.writeHead(500);
      res.end('Internal error');
    }
  });

  localServer.on('error', (err) => {
    console.error('[Kibo] Local HTTP server error, falling back to direct file load:', err);
    const prodPath = path.join(__dirname, '../dist/index.html');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(prodPath, { query: { mode: 'desktop' } }).catch(() => {});
    }
  });

  localServer.listen(KIBO_LOCAL_PORT, '127.0.0.1', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(`http://127.0.0.1:${KIBO_LOCAL_PORT}/?mode=desktop`);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.showInactive();
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
  });

  mainWindow.on('closed', () => {
    try {
      localServer.close();
    } catch (_) {}
    if (hitTestInterval) clearInterval(hitTestInterval);
    mainWindow = null;
  });
}

ipcMain.on('set-window-mode', (event, { mode, width = 640, height = 390 } = {}) => {
  if (mode === 'tucked') {
    setWindowBounds(190, 18);
  } else if (mode === 'collapsed') {
    setWindowBounds(220, 72);
  } else if (mode === 'listening') {
    setWindowBounds(200, 42);
  } else if (mode === 'expanded') {
    setWindowBounds(width, height);
  } else {
    setWindowBounds(190, 18);
  }
});

ipcMain.on('set-window-bounds', (event, arg1, arg2) => {
  const width = typeof arg1 === 'object' && arg1 !== null ? arg1.width : arg1;
  const height = typeof arg1 === 'object' && arg1 !== null ? arg1.height : arg2;
  setWindowBounds(width, height);
});

ipcMain.on('set-app-window-rect', (event, rect) => {
  activeAppWindowRect = rect || null;
});

ipcMain.on('set-roaming-target-rect', (event, rectOrRects) => {
  if (!rectOrRects) {
    activeRoamingRects = [];
  } else if (Array.isArray(rectOrRects)) {
    activeRoamingRects = rectOrRects.filter(Boolean);
  } else {
    activeRoamingRects = [rectOrRects];
  }
});

ipcMain.on('set-roaming-active', (event, active) => {
  if (active) {
    if (!isRoamingEscapeRegistered) {
      try {
        globalShortcut.register('Escape', () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('roaming-dismiss');
          }
        });
        isRoamingEscapeRegistered = true;
      } catch (_) {}
    }
  } else {
    if (isRoamingEscapeRegistered) {
      try {
        globalShortcut.unregister('Escape');
        isRoamingEscapeRegistered = false;
      } catch (_) {}
    }
    activeRoamingRects = [];
  }
});

ipcMain.on('set-agent-dock-active', (event, data) => {
  if (typeof data === 'object' && data !== null) {
    isAgentDockActive = Boolean(data.active);
    isAgentDockHovered = Boolean(data.isHovered);
  } else {
    isAgentDockActive = Boolean(data);
    isAgentDockHovered = false;
  }
});

ipcMain.handle('play-spotify', (_event, query, targetType) =>
  playSpotifyMedia(query, targetType)
);

ipcMain.on('set-expanded', (event, { expanded, width = 640, height = 390 } = {}) => {
  if (expanded) {
    setWindowBounds(width, height);
  } else {
    setWindowBounds(280, 38);
  }
});

ipcMain.on('window-minimize', () => {
  activeAppWindowRect = null;
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('open-app', async (_event, appNameOrPath) => {
  const raw = String(appNameOrPath || '').trim();
  if (!raw) return { success: false };

  // 1. Direct file or shortcut path (.lnk, .url, .exe)
  if (
    (raw.toLowerCase().endsWith('.lnk') ||
      raw.toLowerCase().endsWith('.url') ||
      raw.toLowerCase().endsWith('.exe')) &&
    fs.existsSync(raw)
  ) {
    const errStr = await shell.openPath(raw);
    return { success: !errStr, app: raw, error: errStr || null };
  }

  // 2. Direct URL or domain (e.g., "github.com", "https://...", "youtube.com")
  if (/^(https?:\/\/|[a-z0-9-]+\.(com|org|net|io|in|ai|dev|app|gg|tv|so)(\/|$))/i.test(raw)) {
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    await shell.openExternal(url);
    return { success: true, app: raw };
  }

  const query = raw.toLowerCase().trim();

  // 3. Instant Web Applications & Services (YouTube, Gmail, ChatGPT, etc.)
  const WEB_APP_URLS = {
    youtube: 'https://youtube.com',
    yt: 'https://youtube.com',
    gmail: 'https://mail.google.com',
    mail: 'https://mail.google.com',
    google: 'https://google.com',
    chatgpt: 'https://chatgpt.com',
    claude: 'https://claude.ai',
    reddit: 'https://reddit.com',
    netflix: 'https://netflix.com',
    twitch: 'https://twitch.tv',
    github: 'https://github.com',
    twitter: 'https://x.com',
    x: 'https://x.com',
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
    amazon: 'https://amazon.com',
    wikipedia: 'https://wikipedia.org',
  };

  if (WEB_APP_URLS[query]) {
    await shell.openExternal(WEB_APP_URLS[query]);
    return { success: true, app: query };
  }

  // 4. Fast System & Protocol Handlers (Spotify, Discord, VS Code, Calculator, Notepad, etc.)
  const FAST_SYSTEM_LAUNCH = {
    spotify: 'spotify:',
    discord: 'discord:',
    calc: 'calc',
    calculator: 'calc',
    notepad: 'notepad',
    code: 'code',
    vscode: 'code',
    'vs code': 'code',
    'visual studio code': 'code',
    explorer: 'explorer',
    'file explorer': 'explorer',
    terminal: 'wt',
    cmd: 'cmd',
    'command prompt': 'cmd',
    powershell: 'powershell',
    settings: 'ms-settings:',
  };

  if (FAST_SYSTEM_LAUNCH[query]) {
    const target = FAST_SYSTEM_LAUNCH[query];
    if (target.includes(':')) {
      try {
        await shell.openExternal(target);
        return { success: true, app: query };
      } catch (_) {}
    } else {
      exec(`start ${target}`, () => {});
      return { success: true, app: query };
    }
  }

  // 5. Search your PC's indexed Desktop & Start Menu shortcuts from getInstalledApps()
  try {
    const installed = await getInstalledApps();
    if (Array.isArray(installed) && installed.length > 0) {
      const exactMatch = installed.find((a) => a.name.toLowerCase() === query);
      const startsWithMatch = installed.find((a) => a.name.toLowerCase().startsWith(query));
      const includesMatch = installed.find(
        (a) => a.name.toLowerCase().includes(query) || query.includes(a.name.toLowerCase())
      );
      const bestMatch = exactMatch || startsWithMatch || includesMatch;

      if (bestMatch && (bestMatch.appId || bestMatch.exePath)) {
        const targetPath = bestMatch.appId || bestMatch.exePath;
        if (fs.existsSync(targetPath)) {
          const errStr = await shell.openPath(targetPath);
          if (!errStr) return { success: true, app: bestMatch.name };
        }
      }
    }
  } catch (_) {}

  // 6. Universal Windows OS Resolver: Queries Get-StartApps (UWP + Win32) & Registry App Paths dynamically
  return new Promise((resolve) => {
    const safeQuery = raw.replace(/'/g, "''");
    const psUniversalLaunch = `
      $q = '${safeQuery}'.Trim()

      # A. Search all Windows Start Apps (Win32, Steam, Epic, UWP / Microsoft Store apps)
      $startApps = Get-StartApps | Where-Object { $_.Name -and $_.AppID }
      $match = $startApps | Where-Object { $_.Name -ieq $q } | Select-Object -First 1
      if (-not $match) {
        $match = $startApps | Where-Object { $_.Name -ilike "$q*" } | Select-Object -First 1
      }
      if (-not $match) {
        $match = $startApps | Where-Object { $_.Name -ilike "*$q*" } | Select-Object -First 1
      }

      if ($match) {
        Start-Process explorer.exe -ArgumentList "shell:AppsFolder\\$($match.AppID)"
        Write-Output "LAUNCHED:$($match.Name)"
        exit
      }

      # B. Search Windows Registry App Paths (HKCU & HKLM)
      $regPaths = @(
        'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*',
        'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*'
      )
      foreach ($rp in $regPaths) {
        $regHit = Get-ItemProperty $rp -ErrorAction SilentlyContinue | Where-Object {
          $_.PSChildName -ilike "$q*" -or $_.PSChildName -ilike "*$q*.exe"
        } | Select-Object -First 1
        if ($regHit -and $regHit.'(default)') {
          $exe = $regHit.'(default)'.Trim('"')
          if (Test-Path $exe) {
            Start-Process $exe
            Write-Output "LAUNCHED:$($regHit.PSChildName)"
            exit
          }
        }
      }

      # C. Fallback to native Windows shell / protocol / PATH execution
      try {
        Start-Process $q -ErrorAction Stop
        Write-Output "LAUNCHED:$q"
        exit
      } catch {}
    `;

    const encoded = Buffer.from(psUniversalLaunch, 'utf16le').toString('base64');
    exec(
      `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      (err, stdout) => {
        const out = (stdout || '').trim();
        if (!err && out.startsWith('LAUNCHED:')) {
          return resolve({ success: true, app: out.replace('LAUNCHED:', '') });
        }
        // Fallback: if single brand word, try .com domain; otherwise web search
        if (!raw.includes(' ') && !raw.includes('.')) {
          shell.openExternal(`https://${raw}.com`);
          return resolve({ success: true, app: raw });
        }
        shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(raw)}`);
        resolve({ success: true, app: raw });
      }
    );
  });
});

ipcMain.handle('get-installed-apps', () => getInstalledApps());
ipcMain.handle('get-controls-state', () => getControlsState());
ipcMain.handle('get-system-stats', () => getSystemStats());
ipcMain.handle('run-speed-test', () => runSpeedTest());
ipcMain.handle('set-wallpaper', (_e, imagePath) => applyDesktopWallpaper(imagePath));
ipcMain.handle('get-wallpaper-data-url', (_e, urlOrPath) => getWallpaperDataUrl(urlOrPath));
ipcMain.handle('pick-wallpaper-files', () => pickWallpaperFiles(mainWindow));
ipcMain.handle('set-volume', (_e, level) => setSystemVolume(level));
ipcMain.handle('set-mute', (_e, mute) => setSystemMute(mute));
ipcMain.handle('toggle-bluetooth', (_e, enable) => toggleBluetoothDirect(enable));
ipcMain.handle('get-wifi-networks', () => getWifiNetworks());
ipcMain.handle('get-bluetooth-devices', () => getBluetoothDevices());
ipcMain.handle('toggle-night-light', (_e, enable, strength) => setNightLightStrength(enable, strength));
ipcMain.handle('toggle-system-dark-mode', (_e, targetDark) => toggleSystemDarkModeDirect(targetDark));
ipcMain.handle('get-now-playing', () => getNowPlayingMedia());
ipcMain.handle('media-control', (_e, action) => sendMediaKeyControl(action));
ipcMain.handle('media-seek', (_e, seconds) => seekMediaSession(seconds));
ipcMain.handle('get-clipboard-history', () => getClipboardHistory());
ipcMain.handle('delete-clipboard-item', (_e, id) => deleteClipboardItem(id));
ipcMain.handle('toggle-pin-clipboard-item', (_e, id) => togglePinClipboardItem(id));
ipcMain.handle('clear-clipboard-history', () => clearClipboardHistory());
ipcMain.handle('get-shortcuts', () => activeShortcuts);
ipcMain.handle('update-shortcuts', (_event, shortcuts) => {
  if (shortcuts && typeof shortcuts === 'object') {
    activeShortcuts = { ...activeShortcuts, ...shortcuts };
    updateHotkeyWatcher(activeShortcuts, (hotkeyAction) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('hotkey-event', hotkeyAction);
    });
    updateTrayMenu();
  }
  return { success: true, shortcuts: activeShortcuts };
});

ipcMain.on('set-embers-count', (_event, count) => {
  if (typeof count === 'number') {
    emberState.count = count;
    refreshTrayIconAndTooltip();
    updateTrayMenu();
  }
});

const kiboSettingsFile = path.join(app.getPath('userData'), 'kibo_settings.json');

function readKiboSettings() {
  try {
    if (fs.existsSync(kiboSettingsFile)) {
      return JSON.parse(fs.readFileSync(kiboSettingsFile, 'utf8'));
    }
  } catch (err) {
    console.error('[Kibo] Failed to read stored settings:', err);
  }
  return {};
}

function writeKiboSettings(patch) {
  try {
    const current = readKiboSettings();
    const updated = { ...current, ...(patch || {}) };
    fs.mkdirSync(path.dirname(kiboSettingsFile), { recursive: true });
    fs.writeFileSync(kiboSettingsFile, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (err) {
    console.error('[Kibo] Failed to write stored settings:', err);
    return null;
  }
}

ipcMain.handle('get-stored-settings', () => {
  return readKiboSettings();
});

ipcMain.handle('save-stored-settings', (_event, patch) => {
  return writeKiboSettings(patch);
});

ipcMain.handle('get-startup-setting', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('set-startup-setting', (_event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath,
  });
  updateTrayMenu();
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('update-tray-color', (_event, hexColor) => {
  if (typeof hexColor === 'string' && hexColor.startsWith('#')) {
    currentTrayColorHex = hexColor;
    refreshTrayIconAndTooltip();
  }
  return true;
});

ipcMain.handle('quit-app', () => {
  app.quit();
  return true;
});

function getWindowsWallpaperPath() {
  try {
    const stdout = execSync(
      `powershell -NoProfile -Command "(Get-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name Wallpaper).Wallpaper"`,
      { encoding: 'utf8', timeout: 3000 }
    ).trim();
    if (stdout && fs.existsSync(stdout)) {
      return stdout;
    }
  } catch (_) {}

  try {
    const transcoded = path.join(process.env.APPDATA || '', 'Microsoft/Windows/Themes/TranscodedWallpaper');
    if (fs.existsSync(transcoded)) return transcoded;
  } catch (_) {}

  return null;
}

function extractPaletteFromWallpaper() {
  const wpPath = getWindowsWallpaperPath();
  if (!wpPath) return null;

  try {
    const fileBytes = fs.readFileSync(wpPath);
    const img = nativeImage.createFromBuffer(fileBytes);
    if (img.isEmpty()) return null;

    const small = img.resize({ width: 48, height: 48, quality: 'good' });
    const buffer = small.toBitmap(); // Windows BGRA buffer

    let bestScore = -1;
    let bestR = 56, bestG = 189, bestB = 248; // fallback sky blue

    for (let i = 0; i < buffer.length; i += 4) {
      const b = buffer[i];
      const g = buffer[i + 1];
      const r = buffer[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = (max + min) / 510;
      const sat = max === 0 ? 0 : (max - min) / max;

      const score = sat * 1.5 + (0.5 - Math.abs(lum - 0.5));
      if (score > bestScore && sat > 0.2 && lum > 0.2 && lum < 0.88) {
        bestScore = score;
        bestR = r;
        bestG = g;
        bestB = b;
      }
    }

    const toHex = (n) => n.toString(16).padStart(2, '0');
    const accent = `#${toHex(bestR)}${toHex(bestG)}${toHex(bestB)}`;
    const accentSecondary = `#${toHex(Math.round(bestR * 0.75))}${toHex(Math.round(bestG * 0.75))}${toHex(Math.round(bestG * 0.75))}`;
    const pillBg = `rgba(${bestR}, ${bestG}, ${bestB}, 0.18)`;
    const rowBg = `rgba(${bestR}, ${bestG}, ${bestB}, 0.08)`;

    return {
      wallpaperPath: wpPath,
      wallpaperUrl: `http://127.0.0.1:${KIBO_LOCAL_PORT}/api/wallpaper?path=${encodeURIComponent(wpPath)}`,
      accent,
      accentSecondary,
      pillBg,
      rowBg,
      darkText: '#F8FAFC',
      darkSubText: '#94A3B8',
    };
  } catch (err) {
    console.error('[Kibo] Wallpaper palette extraction error:', err);
    return null;
  }
}

ipcMain.handle('get-current-wallpaper-theme', () => {
  return extractPaletteFromWallpaper();
});

ipcMain.handle('update-embers-state', (_event, payload) => {
  if (payload && typeof payload === 'object') {
    if (typeof payload.count === 'number') emberState.count = payload.count;
    if (typeof payload.isWaiting === 'boolean') emberState.isWaiting = payload.isWaiting;
    refreshTrayIconAndTooltip();
    updateTrayMenu();
  }
  return { success: true };
});

ipcMain.handle('toggle-wifi', async (_event, enable, ssidName) => {
  return new Promise((resolve) => {
    if (!enable) {
      exec('netsh wlan disconnect', () => resolve({ success: true, connected: false }));
    } else if (ssidName) {
      exec(`netsh wlan connect name="${ssidName.replace(/"/g, '')}"`, (err) => {
        resolve({ success: !err, connected: !err });
      });
    } else {
      exec(
        'powershell -NoProfile -Command "$p = (netsh wlan show profiles | Select-String \'All User Profile\\s*:\\s*(.+)$\' | ForEach-Object { $_.Matches[0].Groups[1].Value.Trim() } | Select-Object -First 1); if ($p) { netsh wlan connect name=$p }"',
        () => {
          resolve({ success: true, connected: true });
        }
      );
    }
  });
});

ipcMain.handle('power-action', async (_event, action) => {
  return new Promise((resolve) => {
    let cmd = '';
    if (action === 'lock') {
      cmd = 'rundll32.exe user32.dll,LockWorkStation';
    } else if (action === 'sleep') {
      cmd = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0';
    } else if (action === 'restart') {
      cmd = 'shutdown /r /t 0';
    } else if (action === 'shutdown') {
      cmd = 'shutdown /s /t 0';
    }

    if (cmd) {
      exec(cmd, (err) => resolve({ success: !err, error: err ? err.message : null }));
    } else {
      resolve({ success: false, error: 'Unknown action' });
    }
  });
});

ipcMain.handle('open-url', async (_event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('type-text', async (_event, text) => {
  return new Promise((resolve) => {
    clipboard.writeText(text);
    if (mainWindow) mainWindow.blur();
    const psCommand = `powershell -Command "$wshell = New-Object -ComObject wscript.shell; Start-Sleep -Milliseconds 250; $wshell.SendKeys('^v')"`;
    exec(psCommand, (err) => {
      resolve({ success: !err });
    });
  });
});

ipcMain.handle('capture-screen', async () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(0);
    }
    // Small pause to allow the desktop compositor to composite without Kibo
    await new Promise((r) => setTimeout(r, 60));

    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor || 1;
    const width = Math.round(primaryDisplay.bounds.width * scaleFactor);
    const height = Math.round(primaryDisplay.bounds.height * scaleFactor);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
      fetchWindowIcons: false,
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1);
    }

    if (sources && sources.length > 0) {
      const primarySource = sources[0];
      const imageBuffer = primarySource.thumbnail.toJPEG(85);
      const base64Data = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
      return { success: true, image: base64Data };
    }
  } catch (err) {
    console.warn('[Kibo] desktopCapturer failed, falling back to PowerShell capture:', err);
  } finally {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1);
    }
  }

  // Fallback to PowerShell
  return new Promise((resolve) => {
    const tempFile = path.join(app.getPath('temp'), `kibo_shot_${Date.now()}.png`);
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      $bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
      $bitmap.Save('${tempFile.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
      $graphics.Dispose()
      $bitmap.Dispose()
    `;

    exec(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, (err) => {
      if (err || !fs.existsSync(tempFile)) {
        resolve({ success: false, error: err ? err.message : 'Capture failed' });
        return;
      }

      try {
        const imageBuffer = fs.readFileSync(tempFile);
        const base64Data = `data:image/png;base64,${imageBuffer.toString('base64')}`;
        fs.unlinkSync(tempFile);
        resolve({ success: true, image: base64Data });
      } catch (readErr) {
        resolve({ success: false, error: readErr.message });
      }
    });
  });
});

ipcMain.handle('set-lasso-active', async (_event, active) => {
  isLassoActive = !!active;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (isLassoActive) {
      mainWindow.setIgnoreMouseEvents(false);
    } else {
      isIgnoringMouse = true;
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  }
  return { success: true };
});

// ============================================================================
// KIBO "SYSTEM ONE" LOCAL PERCEPTION & CLICKER ENGINE (ZERO-PIXEL / ~40ms)
// Uses persistent in-memory C# (Win32 + UIAutomation) so there is zero cold-start lag
// ============================================================================
let uiWorker = null;
let uiWorkerQueue = [];

function initNativeUIWorker() {
  if (uiWorker) return;

  const psHostScript = `
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    Add-Type -AssemblyName System.Windows.Forms

    Add-Type @"
    using System;
    using System.Runtime.InteropServices;

    public class Win32Input {
      [DllImport("user32.dll")]
      public static extern bool SetCursorPos(int X, int Y);

      [DllImport("user32.dll")]
      public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, int dwExtraInfo);

      [DllImport("user32.dll")]
      public static extern IntPtr GetForegroundWindow();

      [DllImport("user32.dll", CharSet = CharSet.Unicode)]
      public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);

      [DllImport("user32.dll")]
      public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

      public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
      public const uint MOUSEEVENTF_LEFTUP = 0x0004;

      public static void ClickAt(int x, int y) {
        SetCursorPos(x, y);
        mouse_event(MOUSEEVENTF_LEFTDOWN, x, y, 0, 0);
        mouse_event(MOUSEEVENTF_LEFTUP, x, y, 0, 0);
      }
    }
"@

    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $cond1 = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::IsEnabledProperty, $true)
    $cond2 = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::IsOffscreenProperty, $false)
    $andCond = New-Object System.Windows.Automation.AndCondition($cond1, $cond2)

    while ($true) {
      $line = [Console]::In.ReadLine()
      if ($null -eq $line) { break }
      try {
        $cmd = $line | ConvertFrom-Json
        if ($cmd.action -eq "scan") {
          $fgHandle = [Win32Input]::GetForegroundWindow()
          $targetRoot = if ($fgHandle -ne [IntPtr]::Zero) {
            try { [System.Windows.Automation.AutomationElement]::FromHandle($fgHandle) } catch { $root }
          } else { $root }

          $els = $targetRoot.FindAll([System.Windows.Automation.TreeScope]::Descendants, $andCond)
          $results = @()
          $idx = 0
          foreach ($el in $els) {
            if ($idx -ge 120) { break }
            $name = $el.Current.Name
            $ctrl = $el.Current.ControlType.ProgrammaticName -replace "ControlType\\.", ""
            if ([string]::IsNullOrWhiteSpace($name)) { continue }
            if ($ctrl -notin @("Button", "Hyperlink", "MenuItem", "TabItem", "Edit", "ListItem", "CheckBox", "RadioButton", "ComboBox", "Text")) { continue }
            $rect = $el.Current.BoundingRectangle
            if ($rect.Width -le 4 -or $rect.Height -le 4 -or [double]::IsInfinity($rect.X)) { continue }

            $results += @{
              id = $idx
              label = ($name.Trim() -replace "\\s+", " ").Substring(0, [Math]::Min(60, $name.Trim().Length))
              role = $ctrl
              x = [int][Math]::Round($rect.X + $rect.Width / 2)
              y = [int][Math]::Round($rect.Y + $rect.Height / 2)
              w = [int][Math]::Round($rect.Width)
              h = [int][Math]::Round($rect.Height)
            }
            $idx++
          }
          $out = @{ ok = $true; elements = $results } | ConvertTo-Json -Compress -Depth 4
          [Console]::Out.WriteLine($out)
        }
        elseif ($cmd.action -eq "click") {
          [Win32Input]::ClickAt([int]$cmd.x, [int]$cmd.y)
          [Console]::Out.WriteLine('{"ok":true}')
        }
        elseif ($cmd.action -eq "double_click") {
          [Win32Input]::ClickAt([int]$cmd.x, [int]$cmd.y)
          Start-Sleep -Milliseconds 70
          [Win32Input]::ClickAt([int]$cmd.x, [int]$cmd.y)
          [Console]::Out.WriteLine('{"ok":true}')
        }
        elseif ($cmd.action -eq "right_click") {
          [Win32Input]::SetCursorPos([int]$cmd.x, [int]$cmd.y)
          [Win32Input]::mouse_event(0x0008, [int]$cmd.x, [int]$cmd.y, 0, 0)
          [Win32Input]::mouse_event(0x0010, [int]$cmd.x, [int]$cmd.y, 0, 0)
          [Console]::Out.WriteLine('{"ok":true}')
        }
        elseif ($cmd.action -eq "type") {
          if ($null -ne $cmd.x -and $null -ne $cmd.y) {
            [Win32Input]::ClickAt([int]$cmd.x, [int]$cmd.y)
            Start-Sleep -Milliseconds 110
          }
          if (-not [string]::IsNullOrEmpty($cmd.text)) {
            [System.Windows.Forms.Clipboard]::SetText([string]$cmd.text)
            Start-Sleep -Milliseconds 40
            [System.Windows.Forms.SendKeys]::SendWait("^v")
            if ($cmd.pressEnter -eq $true) {
              Start-Sleep -Milliseconds 60
              [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            }
          }
          [Console]::Out.WriteLine('{"ok":true}')
        }
        elseif ($cmd.action -eq "type_direct") {
          if (-not [string]::IsNullOrEmpty($cmd.text)) {
            [System.Windows.Forms.Clipboard]::SetText([string]$cmd.text)
            Start-Sleep -Milliseconds 40
            [System.Windows.Forms.SendKeys]::SendWait("^v")
            if ($cmd.pressEnter -eq $true) {
              Start-Sleep -Milliseconds 60
              [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            }
          }
          [Console]::Out.WriteLine('{"ok":true}')
        }
        elseif ($cmd.action -eq "get_foreground_title") {
          $fg = [Win32Input]::GetForegroundWindow()
          $sb = New-Object System.Text.StringBuilder 512
          [void][Win32Input]::GetWindowText($fg, $sb, 512)
          $t = $sb.ToString()
          [Console]::Out.WriteLine((@{ ok = $true; title = $t } | ConvertTo-Json -Compress))
        }
        elseif ($cmd.action -eq "get_foreground_info") {
          $fg = [Win32Input]::GetForegroundWindow()
          $sb = New-Object System.Text.StringBuilder 512
          [void][Win32Input]::GetWindowText($fg, $sb, 512)
          $t = $sb.ToString()
          $pidVal = 0
          [void][Win32Input]::GetWindowThreadProcessId($fg, [ref]$pidVal)
          $pName = ""
          if ($pidVal -gt 0) {
            try { $pName = (Get-Process -Id $pidVal -ErrorAction SilentlyContinue).ProcessName } catch {}
          }
          [Console]::Out.WriteLine((@{ ok = $true; title = $t; proc = $pName } | ConvertTo-Json -Compress))
        }
      } catch {
        $errJson = @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
        [Console]::Out.WriteLine($errJson)
      }
    }
  `;

  uiWorker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psHostScript], {
    stdio: ['pipe', 'pipe', 'ignore'],
    windowsHide: true,
  });

  let buffer = '';
  uiWorker.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (line && uiWorkerQueue.length > 0) {
        const { resolve } = uiWorkerQueue.shift();
        try {
          resolve(JSON.parse(line));
        } catch (e) {
          resolve({ ok: false, error: 'Invalid JSON from UI worker' });
        }
      }
    }
  });

  uiWorker.on('exit', () => {
    uiWorker = null;
  });
}

function sendUIWorkerCommand(payload) {
  initNativeUIWorker();
  return new Promise((resolve) => {
    uiWorkerQueue.push({ resolve });
    uiWorker.stdin.write(JSON.stringify(payload) + '\n');
  });
}

// IPC endpoints for zero-screenshot computer use
ipcMain.handle('scan-ui-elements', async () => {
  // Blur Kibo first so the user's active app is the foreground target
  if (mainWindow && mainWindow.isFocused()) {
    mainWindow.blur();
  }
  return await sendUIWorkerCommand({ action: 'scan' });
});

ipcMain.handle('execute-ui-action', async (_event, { action, x, y, text, pressEnter }) => {
  const cursor = screen.getCursorScreenPoint();
  if (cursor.x < 8 && cursor.y < 8) {
    return { ok: false, aborted: true, error: 'Aborted by top-left corner kill switch' };
  }
  if (mainWindow && mainWindow.isFocused()) {
    mainWindow.blur();
    await new Promise((r) => setTimeout(r, 60));
  }
  return await sendUIWorkerCommand({ action, x, y, text, pressEnter });
});

// ============================================================================
// 1. AUTOMATIC ACTIVE APP / WEBSITE DETECTOR (GitHub, Notion, VS Code, Figma, Gmail)
// ============================================================================
let lastDetectedAppId = null;
let activeAppWatcherInterval = null;

function startActiveAppWatcher() {
  if (activeAppWatcherInterval) clearInterval(activeAppWatcherInterval);

  activeAppWatcherInterval = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    try {
      const info = await sendUIWorkerCommand({ action: 'get_foreground_info' });
      if (!info || !info.ok) return;

      const rawTitle = (info.title || '').trim();
      const title = rawTitle.toLowerCase();
      const proc = (info.proc || '').toLowerCase();

      if (!title || proc.includes('electron') || title.includes('hitodama') || title.includes('kibo')) return;

      // 1. NEVER trigger on Google Search, Bing Search, DuckDuckGo, or YouTube search results/videos!
      const isSearchEngineOrVideo =
        title.includes('google search') ||
        title.includes('bing') ||
        title.includes('duckduckgo') ||
        title.includes('youtube') ||
        title.includes('youtu.be') ||
        title.startsWith('search ') ||
        title.includes('search results');

      let detected = null;

      // 2. Check Native Desktop Apps First (100% certainty via .exe process name)
      if (proc === 'notion') {
        detected = 'notion';
      } else if (proc === 'code' || proc === 'cursor' || proc === 'devenv') {
        detected = 'vscode';
      } else if (proc === 'figma') {
        detected = 'figma';
      } else if (proc === 'githubdesktop') {
        detected = 'github';
      } else if (!isSearchEngineOrVideo) {
        // 3. Browser Tabs: Match authentic web app title patterns (excluding search engines & video)
        // Strip browser suffix (" - Google Chrome", " - Microsoft Edge", " - Brave", " - Mozilla Firefox", etc.)
        const pageTitle = rawTitle
          .replace(/\s+[-—]\s+(Google Chrome|Microsoft?\s*Edge|Brave|Mozilla Firefox|Opera|Arc|Vivaldi).*$/i, '')
          .trim();

        const pageTitleLower = pageTitle.toLowerCase();

        if (
          pageTitleLower.endsWith('- notion') ||
          pageTitleLower === 'notion' ||
          pageTitleLower.includes('notion –') ||
          pageTitleLower.includes('notion.so')
        ) {
          detected = 'notion';
        } else if (
          (pageTitleLower.endsWith('- github') ||
            pageTitleLower.includes('github.com') ||
            pageTitleLower.includes('· github')) &&
          !pageTitleLower.includes('youtube') &&
          !pageTitleLower.includes('google')
        ) {
          detected = 'github';
        } else if (
          pageTitleLower.endsWith('- figma') ||
          pageTitleLower === 'figma' ||
          pageTitleLower.includes('figma.com')
        ) {
          detected = 'figma';
        } else if (
          pageTitleLower.includes('- gmail') ||
          pageTitleLower.startsWith('gmail') ||
          pageTitleLower.includes('mail.google.com') ||
          pageTitleLower.includes('inbox (')
        ) {
          detected = 'gmail';
        } else if (pageTitleLower.endsWith('- visual studio code')) {
          detected = 'vscode';
        }
      }

      if (detected !== lastDetectedAppId) {
        lastDetectedAppId = detected;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('context-app-detected', detected);
        }
      }
    } catch (_) {}
  }, 1000);
}

// ============================================================================
// 2. INSTANT LANDING PAGE / ARTIFACT LAUNCHER & IN-PLACE FILE EDITOR
// Saves generated HTML or overwrites the existing file when making iterative edits
// ============================================================================
ipcMain.handle('open-generated-page', async (_event, htmlContent, existingFilePath) => {
  try {
    const filePath =
      existingFilePath && typeof existingFilePath === 'string' && existingFilePath.endsWith('.html')
        ? existingFilePath
        : path.join(app.getPath('temp'), `kibo_page_${Date.now()}.html`);

    fs.writeFileSync(filePath, htmlContent, 'utf-8');
    await shell.openExternal(`file://${filePath.replace(/\\/g, '/')}`);
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ============================================================================
// 3. LIVE PAGE CONTEXT & DESIGN MCP CODEBASE / METADATA INSPECTOR
// ============================================================================
ipcMain.handle('get-active-page-context', async () => {
  try {
    const info = await sendUIWorkerCommand({ action: 'get_foreground_info' });
    const rawTitle = info && info.title ? info.title.trim() : '';
    const proc = info && info.proc ? info.proc.trim() : '';
    const cleanTitle = rawTitle
      .replace(/\s+[-—]\s+(Google Chrome|Microsoft?\s*Edge|Brave|Mozilla Firefox|Opera|Arc|Vivaldi).*$/i, '')
      .trim();

    // Extract the live URL from the active browser's address bar via UIAutomation
    const urlScript = `
      Add-Type -AssemblyName UIAutomationClient
      Add-Type -AssemblyName UIAutomationTypes
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class FgHwnd {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
      }
"@
      \$h = [FgHwnd]::GetForegroundWindow()
      \$foundUrl = ""
      if (\$h -ne [IntPtr]::Zero) {
        try {
          \$el = [System.Windows.Automation.AutomationElement]::FromHandle(\$h)
          \$cond = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Edit
          )
          \$edits = \$el.FindAll([System.Windows.Automation.TreeScope]::Descendants, \$cond)
          foreach (\$edit in \$edits) {
            \$vp = \$null
            if (\$edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]\$vp)) {
              \$val = \$vp.Current.Value
              if (\$val -match "^(https?://|[a-zA-Z0-9-]+\\.[a-zA-Z]{2,})(/.*)?$") {
                \$foundUrl = \$val
                break
              }
            }
          }
        } catch {}
      }
      Write-Output \$foundUrl
    `;

    const encoded = Buffer.from(urlScript, 'utf16le').toString('base64');
    const detectedUrl = await new Promise((resolve) => {
      exec(
        `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
        { timeout: 1800 },
        (_err, stdout) => {
          let u = (stdout || '').trim();
          if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
          resolve(u);
        }
      );
    });

    return {
      success: true,
      title: cleanTitle || rawTitle || 'Current Active Window',
      rawTitle,
      process: proc,
      url: detectedUrl || '',
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Helper to fetch raw text over HTTP/HTTPS with redirect support
function fetchRawText(targetUrl, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const httpsMod = require('https');
    const httpMod = require('http');
    const client = targetUrl.startsWith('https') ? httpsMod : httpMod;
    const req = client.get(
      targetUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,text/css,application/xhtml+xml,*/*;q=0.8',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).toString();
          return fetchRawText(redirectUrl, timeoutMs).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        let totalLen = 0;
        res.on('data', (c) => {
          totalLen += c.length;
          if (totalLen < 600000) chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Design MCP Scraper: Extracts real CSS variables, fonts, hex colors, headings, nav items & DOM structure
ipcMain.handle('inspect-website-design', async (_event, targetUrl) => {
  if (!targetUrl || typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl)) {
    return { success: false, error: 'No valid URL provided' };
  }

  try {
    const html = await fetchRawText(targetUrl, 4200);

    // 1. Fetch up to 2 external CSS stylesheets to extract real :root variables & color tokens
    const stylesheetUrls = [];
    const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']|<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi;
    let m;
    while ((m = linkRegex.exec(html)) !== null && stylesheetUrls.length < 2) {
      const rawHref = m[1] || m[2];
      if (rawHref && !rawHref.includes('fonts.googleapis.com')) {
        try {
          stylesheetUrls.push(new URL(rawHref, targetUrl).toString());
        } catch (_) {}
      }
    }

    const cssContents = await Promise.all(
      stylesheetUrls.map((u) => fetchRawText(u, 2500).catch(() => ''))
    );
    const combinedStyleSource = [
      ...(html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []),
      ...cssContents,
    ].join('\n');

    // 2. Extract CSS Custom Properties (--*)
    const cssVariables = [];
    const varRegex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;}{]+);/g;
    const seenVars = new Set();
    let vm;
    while ((vm = varRegex.exec(combinedStyleSource)) !== null && cssVariables.length < 30) {
      const varName = vm[1].trim();
      const varVal = vm[2].trim();
      if (!seenVars.has(varName) && varVal.length < 65) {
        seenVars.add(varName);
        cssVariables.push(`${varName}: ${varVal}`);
      }
    }

    // 3. Extract Font Families (Google Fonts + CSS font-family declarations)
    const fonts = new Set();
    const gFontRegex = /fonts\.googleapis\.com\/css2?\?family=([^"&'>]+)/gi;
    let gf;
    while ((gf = gFontRegex.exec(html)) !== null) {
      decodeURIComponent(gf[1])
        .split('&family=')
        .forEach((f) => fonts.add(f.split(':')[0].replace(/\+/g, ' ')));
    }
    const ffRegex = /font-family\s*:\s*([^;}{]+)/gi;
    let ffm;
    while ((ffm = ffRegex.exec(combinedStyleSource)) !== null && fonts.size < 8) {
      const cleanFont = ffm[1].split(',')[0].replace(/['"]/g, '').trim();
      if (
        cleanFont &&
        !cleanFont.startsWith('var(') &&
        !['inherit', 'sans-serif', 'serif', 'monospace', 'system-ui'].includes(cleanFont.toLowerCase())
      ) {
        fonts.add(cleanFont);
      }
    }

    // 4. Extract Dominant Hex / RGB Color Tokens
    const colorCounts = new Map();
    const hexRegex = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    let hm;
    while ((hm = hexRegex.exec(combinedStyleSource + '\n' + html)) !== null) {
      const hex = hm[0].toUpperCase();
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }
    const topColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map((e) => e[0]);

    // 5. Extract Title, Meta Description, Nav Links, Headings & CTA Buttons
    const stripTags = (str) =>
      str
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

    const headings = [];
    const hRegex = /<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi;
    let hMatch;
    while ((hMatch = hRegex.exec(html)) !== null && headings.length < 12) {
      const txt = stripTags(hMatch[2]);
      if (txt && txt.length > 2 && txt.length < 140) {
        headings.push(`${hMatch[1].toUpperCase()}: "${txt}"`);
      }
    }

    const navLinks = [];
    const navMatch = html.match(/<(nav|header)[^>]*>([\s\S]*?)<\/\1>/i);
    if (navMatch) {
      const aRegex = /<a[^>]*>([\s\S]*?)<\/a>/gi;
      let am;
      while ((am = aRegex.exec(navMatch[2])) !== null && navLinks.length < 8) {
        const txt = stripTags(am[1]);
        if (txt && txt.length > 1 && txt.length < 32) navLinks.push(txt);
      }
    }

    const buttons = [];
    const btnRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
    let bm;
    while ((bm = btnRegex.exec(html)) !== null && buttons.length < 8) {
      const txt = stripTags(bm[1]);
      if (txt && txt.length > 1 && txt.length < 40) buttons.push(txt);
    }

    // 6. Extract Section Landmarks / Layout Skeleton
    const sections = [];
    const secRegex = /<(header|nav|main|section|footer)([^>]*)>/gi;
    let sm;
    while ((sm = secRegex.exec(html)) !== null && sections.length < 14) {
      const tag = sm[1].toLowerCase();
      const clsMatch = sm[2].match(/class=["']([^"']+)["']/i);
      const idMatch = sm[2].match(/id=["']([^"']+)["']/i);
      sections.push(
        `<${tag}${idMatch ? ` id="${idMatch[1]}"` : ''}${clsMatch ? ` class="${clsMatch[1].slice(0, 80)}"` : ''}>`
      );
    }

    return {
      success: true,
      designSpec: {
        url: targetUrl,
        title: titleMatch ? stripTags(titleMatch[1]) : '',
        description: descMatch ? descMatch[1].trim() : '',
        fonts: Array.from(fonts),
        cssVariables,
        topColors,
        navLinks,
        headings,
        buttons,
        sections,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('sync-to-notion', async (event, { apiKey, databaseId, pageData }) => {
  if (!apiKey || !databaseId) {
    return { success: false, error: 'Notion API key and Database ID are required.' };
  }
  return new Promise((resolve) => {
    const https = require('https');
    const payload = JSON.stringify({
      parent: { database_id: databaseId.replace(/-/g, '') },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: pageData.title || 'Kibo Inspiration Entry',
              },
            },
          ],
        },
        Category: {
          select: {
            name: pageData.category || 'Landing Page',
          },
        },
        URL: {
          url: pageData.url && pageData.url.startsWith('http') ? pageData.url : null,
        },
      },
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Design Archetype & Palette' } }],
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `Archetype: ${pageData.archetype || 'Minimalist Modern'}\nPalette: ${(pageData.colors || []).join(', ')}\nSummary: ${pageData.summary || ''}`,
                },
              },
            ],
          },
        },
      ],
    });

    const options = {
      hostname: 'api.notion.com',
      port: 443,
      path: '/v1/pages',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, pageId: parsed.id, url: parsed.url });
          } else {
            resolve({ success: false, error: parsed.message || `Notion API error (${res.statusCode})` });
          }
        } catch (e) {
          resolve({ success: false, error: `Invalid response from Notion API: ${body}` });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, error: e.message });
    });

    req.write(payload);
    req.end();
  });
});

function getNewestMtimeInDir(dirPath) {
  let newest = 0;
  if (!fs.existsSync(dirPath)) return 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, getNewestMtimeInDir(full));
    } else {
      newest = Math.max(newest, Math.floor(fs.statSync(full).mtimeMs));
    }
  }
  return newest;
}

function ensureLatestFrontendBuild() {
  try {
    const rootDir = path.join(__dirname, '..');
    const distIndex = path.join(rootDir, 'dist', 'index.html');
    if (!fs.existsSync(distIndex)) {
      console.log('[Kibo] Compiling initial dist/ build...');
      execSync('npx vite build --base=./', { cwd: rootDir, stdio: 'inherit' });
    }
  } catch (err) {
    console.error('[Kibo] Build check warning:', err.message);
  }
}

app.whenReady().then(() => {
  ensureLatestFrontendBuild();
  initSystemDaemon();
  preCacheDefaultWallpapers();
  createWindow();
  createSystemTray();
  startActiveAppWatcher();

  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.webContents.reloadIgnoringCache(); }
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  if (hitTestInterval) clearInterval(hitTestInterval);
  if (activeAppWatcherInterval) clearInterval(activeAppWatcherInterval);
  killSystemDaemon();
  if (uiWorker) {
    try { uiWorker.kill(); } catch (_) {}
    uiWorker = null;
  }
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});