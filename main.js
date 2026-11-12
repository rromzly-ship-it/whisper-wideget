const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, nativeImage, globalShortcut, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile, spawn } = require('child_process');
const { routeCommandWithGroq, listChromeTabs, probeApiQuota } = require('./assistant');
const tts = require('./tts');
const vision = require('./vision');
const memory = require('./memory');
const usage = require('./usage');

// Ensure WebAudio never stays suspended when Wis is triggered via global shortcut
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function getLogFilePath() {
  return path.join(app.getPath('userData'), 'assistant.log');
}

function logApp(msg) {
  try {
    const logPath = getLogFilePath();
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 300000) {
      const tail = fs.readFileSync(logPath, 'utf8').slice(-120000);
      fs.writeFileSync(logPath, tail, 'utf8');
    }
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
  } catch {}
}

let widgetWindow = null;
let eyeWindow = null;
let menuWindow = null;
let settingsWindow = null;
let isSettingsLoaded = false;
let isMenuClosing = false;
let isQuittingFlow = false;
let tray = null;
let lastTargetHwnd = 0;
let cursorTracker = null;
let pointerWatchProc = null;
let autoScrollTimer = null;
let autoScrollTickBusy = false;

function notifyEyeAnim(payload) {
  if (eyeWindow && !eyeWindow.isDestroyed() && eyeWindow.webContents) {
    eyeWindow.webContents.send('wis-eye-anim', payload);
  }
}

function stopAutoScroll() {
  if (autoScrollTimer) {
    clearInterval(autoScrollTimer);
    autoScrollTimer = null;
  }
  autoScrollTickBusy = false;
  notifyEyeAnim({ type: 'scroll-auto-stop' });
}

function startAutoScroll(direction = 'down', speed = 'slow') {
  stopAutoScroll();
  const dir = ['down', 'up', 'left', 'right'].includes(String(direction).toLowerCase())
    ? String(direction).toLowerCase()
    : 'down';
  const sp = ['slow', 'medium', 'fast'].includes(String(speed).toLowerCase())
    ? String(speed).toLowerCase()
    : 'slow';

  const amount = sp === 'fast' ? 320 : (sp === 'medium' ? 170 : 85);
  const intervalMs = sp === 'fast' ? 130 : (sp === 'medium' ? 155 : 185);
  const injPath = path.join(__dirname, 'injector.exe');

  notifyEyeAnim({ type: 'scroll-auto-start', direction: dir, speed: sp });

  autoScrollTimer = setInterval(() => {
    if (autoScrollTickBusy || !fs.existsSync(injPath)) return;
    autoScrollTickBusy = true;
    execFile(injPath, ['scroll', dir, String(amount)], { timeout: 1000 }, () => {
      autoScrollTickBusy = false;
    });
  }, intervalMs);

  logApp(`[main] startAutoScroll dir=${dir} speed=${sp}`);
}

const scrollController = {
  start: startAutoScroll,
  stop: stopAutoScroll,
  isScrolling: () => !!autoScrollTimer,
  notifyEyeAnim
};

// Relative offset of eyeWindow (64x64) to widgetWindow (80x80)
const EYE_OFFSET_X = 8;   // eye center === mic center horizontally (40 - 32)
const EYE_OFFSET_Y = -46; // eye center === mic center - 54px (exact 9.0px rim gap for 32x32 circle)

// Config file paths (support both local portable and AppData)
const localConfigPath = path.join(__dirname, 'config.json');
const appDataConfigPath = path.join(app.getPath('userData'), 'whisper-config.json');

function getConfigFilePath() {
  if (fs.existsSync(localConfigPath)) return localConfigPath;
  return appDataConfigPath;
}

function loadConfig() {
  const defaultConfig = {
    apiKey: '',
    language: 'auto', // 'auto' for multilingual, 'id', 'en'
    autoStart: false,
    voiceAssistant: true,
    model: 'whisper-large-v3',
    deviceId: 'default',
    posX: null,
    posY: null
  };
  try {
    const targetPath = getConfigFilePath();
    if (fs.existsSync(targetPath)) {
      const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      return { ...defaultConfig, ...data };
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return defaultConfig;
}

function saveConfig(config) {
  try {
    const targetPath = fs.existsSync(localConfigPath) ? localConfigPath : appDataConfigPath;
    fs.writeFileSync(targetPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

let appConfig = loadConfig();

function setAutoStart(enable) {
  const whisperExePath = path.join(__dirname, 'Whisper.exe');
  if (fs.existsSync(whisperExePath)) {
    app.setLoginItemSettings({
      openAtLogin: !!enable,
      path: whisperExePath
    });
  } else {
    app.setLoginItemSettings({
      openAtLogin: !!enable,
      args: app.isPackaged ? [] : [__dirname]
    });
  }
}

function getAutoStartStatus() {
  const whisperExePath = path.join(__dirname, 'Whisper.exe');
  if (fs.existsSync(whisperExePath)) {
    return app.getLoginItemSettings({ path: whisperExePath }).openAtLogin;
  }
  return app.getLoginItemSettings({ args: app.isPackaged ? [] : [__dirname] }).openAtLogin;
}

// Load tray icon from crisp PNG
function createTrayIcon() {
  const iconPath = path.join(__dirname, 'icon.png');
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#2563EB"/>
    <g fill="#FFFFFF">
      <rect x="13" y="7" width="6" height="11" rx="3"/>
      <path d="M9 14a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0H9z"/>
      <rect x="15" y="21" width="2" height="4"/>
      <rect x="12" y="24" width="8" height="2" rx="1"/>
    </g>
  </svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg));
}

function createWidget() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: areaX, y: areaY, width: areaW, height: areaH } = primaryDisplay.workArea;

  const widgetSize = 80;
  // Always launch centered horizontally at the bottom of the screen
  const x = areaX + Math.round((areaW - widgetSize) / 2);
  const y = areaY + areaH - widgetSize - 14;

  widgetWindow = new BrowserWindow({
    width: widgetSize,
    height: widgetSize,
    x: Math.round(x),
    y: Math.round(y),
    icon: path.join(__dirname, 'icon.ico'),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false, // Prevents focus stealing from active input fields
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  widgetWindow.setAlwaysOnTop(true, 'screen-saver', 2);
  widgetWindow.loadFile('widget.html');

  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });
}

function createEyeWindow() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const [wx, wy] = widgetWindow.getPosition();

  eyeWindow = new BrowserWindow({
    width: 64,
    height: 64,
    x: wx + EYE_OFFSET_X,
    y: wy + EYE_OFFSET_Y,
    icon: path.join(__dirname, 'icon.ico'),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  eyeWindow.setAlwaysOnTop(true, 'screen-saver', 2);
  eyeWindow.loadFile('eye.html');

  eyeWindow.on('closed', () => {
    eyeWindow = null;
  });

  startCursorTracker();
}

function sendEyeGazePoint(dipPt) {
  if (!eyeWindow || eyeWindow.isDestroyed() || !eyeWindow.isVisible()) return;
  const b = eyeWindow.getBounds();
  const eyeCenterX = b.x + 32;
  const eyeCenterY = b.y + 32;
  eyeWindow.webContents.send('cursor-pos', {
    dx: dipPt.x - eyeCenterX,
    dy: dipPt.y - eyeCenterY
  });
}

let lastTouchPenDip = null;
let lastTouchPenAt = 0;
let activeDrag = null;
let dragLoopTimer = null;

function moveWidgetTo(nx, ny) {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const rx = Math.round(nx);
  const ry = Math.round(ny);
  if (activeDrag && rx === activeDrag.lastX && ry === activeDrag.lastY) return;
  if (activeDrag) {
    activeDrag.lastX = rx;
    activeDrag.lastY = ry;
  }
  widgetWindow.setBounds({ x: rx, y: ry, width: 80, height: 80 });
  if (eyeWindow && !eyeWindow.isDestroyed()) {
    eyeWindow.setBounds({ x: rx + EYE_OFFSET_X, y: ry + EYE_OFFSET_Y, width: 64, height: 64 });
  }
  if (menuWindow && !menuWindow.isDestroyed() && menuWindow.isVisible()) {
    const { mx, my, flippedX, flippedY } = getMenuPlacement(rx, ry);
    menuWindow.setBounds({ x: mx, y: my, width: 180, height: 180 });
    if (flippedX !== lastMenuFlippedX || flippedY !== lastMenuFlippedY) {
      lastMenuFlippedX = flippedX;
      lastMenuFlippedY = flippedY;
      menuWindow.webContents.send('menu-update-flip', { flippedX, flippedY });
    }
  }
}

function stopNativeDrag() {
  if (dragLoopTimer) {
    clearInterval(dragLoopTimer);
    dragLoopTimer = null;
  }
  activeDrag = null;
}

function stepNativeDrag() {
  if (!activeDrag || !widgetWindow || widgetWindow.isDestroyed()) {
    stopNativeDrag();
    return;
  }
  const { pointerType, startWin, startCur } = activeDrag;
  if (pointerType === 'mouse') {
    const cur = screen.getCursorScreenPoint();
    moveWidgetTo(startWin.x + (cur.x - startCur.x), startWin.y + (cur.y - startCur.y));
    return;
  }
  // Touch / Stylus Pen: prefer live 120Hz HID Raw Input coordinates, fallback to GetCursorPos
  if (lastTouchPenDip && (Date.now() - lastTouchPenAt < 140)) {
    if (!activeDrag.startTouch) {
      activeDrag.startTouch = { x: lastTouchPenDip.x, y: lastTouchPenDip.y };
    }
    moveWidgetTo(
      startWin.x + (lastTouchPenDip.x - activeDrag.startTouch.x),
      startWin.y + (lastTouchPenDip.y - activeDrag.startTouch.y)
    );
  } else {
    const cur = screen.getCursorScreenPoint();
    if (cur.x !== startCur.x || cur.y !== startCur.y) {
      moveWidgetTo(startWin.x + (cur.x - startCur.x), startWin.y + (cur.y - startCur.y));
    }
  }
}

function startNativeDrag(pointerType = 'mouse') {
  stopNativeDrag();
  if (!widgetWindow || widgetWindow.isDestroyed()) return false;
  const startWin = widgetWindow.getBounds();
  const startCur = screen.getCursorScreenPoint();
  const hasFreshTouch = lastTouchPenDip && (Date.now() - lastTouchPenAt < 200);
  activeDrag = {
    pointerType,
    startWin,
    startCur,
    startTouch: hasFreshTouch ? { x: lastTouchPenDip.x, y: lastTouchPenDip.y } : null,
    lastX: startWin.x,
    lastY: startWin.y
  };
  dragLoopTimer = setInterval(stepNativeDrag, 8);
  return pointerType === 'mouse' || !!pointerWatchProc;
}

function stopTouchPenTracker() {
  stopNativeDrag();
  if (pointerWatchProc) {
    try { pointerWatchProc.kill(); } catch {}
    pointerWatchProc = null;
  }
}

function startTouchPenTracker() {
  stopTouchPenTracker();
  const injPath = path.join(__dirname, 'injector.exe');
  if (!fs.existsSync(injPath)) return;

  try {
    pointerWatchProc = spawn(injPath, ['pointer_watch'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    let lineBuf = '';
    pointerWatchProc.stdout.on('data', (chunk) => {
      lineBuf += chunk.toString('ascii');
      const lines = lineBuf.split(/\r?\n/);
      lineBuf = lines.pop() || '';
      const lastLine = lines.filter(Boolean).pop();
      if (!lastLine) return;
      const parts = lastLine.split(',');
      if (parts.length !== 2) return;
      const physX = parseInt(parts[0], 10);
      const physY = parseInt(parts[1], 10);
      if (Number.isNaN(physX) || Number.isNaN(physY)) return;
      try {
        const dip = screen.screenToDipPoint({ x: physX, y: physY });
        lastTouchPenDip = dip;
        lastTouchPenAt = Date.now();
        if (activeDrag && (activeDrag.pointerType === 'touch' || activeDrag.pointerType === 'pen')) {
          stepNativeDrag();
        }
        sendEyeGazePoint(dip);
      } catch {}
    });
    pointerWatchProc.on('exit', () => {
      pointerWatchProc = null;
    });
  } catch (e) {
    console.warn('Could not start pointer_watch:', e);
  }
}

function startCursorTracker() {
  if (cursorTracker) clearInterval(cursorTracker);
  let prevX = -1;
  let prevY = -1;

  cursorTracker = setInterval(() => {
    if (!eyeWindow || eyeWindow.isDestroyed() || !eyeWindow.isVisible()) return;
    const pt = screen.getCursorScreenPoint();
    if (pt.x === prevX && pt.y === prevY) return;
    prevX = pt.x;
    prevY = pt.y;
    sendEyeGazePoint(pt);
  }, 45);

  startTouchPenTracker();
}

function createMenuWindow() {
  menuWindow = new BrowserWindow({
    width: 180,
    height: 180,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  menuWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  menuWindow.loadFile('menu.html');

  // Auto-hide popup menu smoothly when user clicks anywhere else (ignore touch/pen release grace window)
  menuWindow.on('blur', () => {
    if (Date.now() - lastMenuOpenedAt < 500) return;
    requestCloseMenu('blur');
  });

  menuWindow.on('closed', () => {
    menuWindow = null;
  });
}

function requestCloseMenu(reason) {
  if (!menuWindow || !menuWindow.isVisible() || isMenuClosing) return;
  isMenuClosing = true;
  menuWindow.webContents.send('menu-close', reason || 'blur');
}

let lastMenuFlippedX = false;
let lastMenuFlippedY = false;
let lastMenuOpenedAt = 0;

function getMenuPlacement(wx, wy) {
  const micCenterX = wx + 40;
  const micCenterY = wy + 40;
  const display = screen.getDisplayNearestPoint({ x: micCenterX, y: micCenterY });
  const { x: areaX, y: areaY, width: areaW, height: areaH } = display.workArea;

  const half = 90; // half of 180x180 menuWindow
  return {
    mx: Math.round(micCenterX - half),
    my: Math.round(micCenterY - half),
    flippedX: (micCenterX + 86 > areaX + areaW),
    flippedY: (micCenterY - 86 < areaY)
  };
}

function openRadialMenu() {
  if (!widgetWindow || isQuittingFlow) return;
  if (!menuWindow) createMenuWindow();
  if (menuWindow.isVisible() && !isMenuClosing) return;

  isMenuClosing = false;
  lastMenuOpenedAt = Date.now();
  const [wx, wy] = widgetWindow.getPosition();
  const { mx, my, flippedX, flippedY } = getMenuPlacement(wx, wy);
  lastMenuFlippedX = flippedX;
  lastMenuFlippedY = flippedY;

  menuWindow.setPosition(mx, my);
  menuWindow.webContents.send('menu-show', { flippedX, flippedY });
  menuWindow.show();
  menuWindow.focus();
  // Keep mic button visually in front of the radial menu
  widgetWindow.setAlwaysOnTop(true, 'screen-saver', 2);
}

function toggleRadialMenu() {
  if (!widgetWindow || isQuittingFlow) return;
  if (!menuWindow) createMenuWindow();

  if (menuWindow.isVisible()) {
    requestCloseMenu('toggle');
    return;
  }

  openRadialMenu();
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 475,
    height: 550,
    title: 'Pengaturan Whisper Agent (Wis)',
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.setAlwaysOnTop(true, 'screen-saver', 3);
  settingsWindow.setMenu(null);
  settingsWindow.loadFile('settings.html');

  settingsWindow.webContents.once('did-finish-load', () => {
    isSettingsLoaded = true;
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    isSettingsLoaded = false;
  });
}

function openSettings() {
  if (!settingsWindow) {
    createSettingsWindow();
  }

  const settingsW = 475;
  const settingsH = 550;

  let micCenterX = 400;
  let anchorTopY = 400;
  let micBottomY = 458;

  if (widgetWindow && !widgetWindow.isDestroyed()) {
    const [wx, wy] = widgetWindow.getPosition();
    micCenterX = wx + 40;
    // Account for the always-on 32x32 eye companion above the mic
    anchorTopY = (eyeWindow && !eyeWindow.isDestroyed()) ? (wy - 34) : (wy + 11);
    micBottomY = wy + 69;
  }

  const display = screen.getDisplayNearestPoint({ x: micCenterX, y: anchorTopY });
  const { x: areaX, y: areaY, width: areaW, height: areaH } = display.workArea;

  // Align horizontally above mic, clamped cleanly inside screen work area
  let sx = micCenterX - Math.round(settingsW / 2);
  sx = Math.max(areaX + 10, Math.min(sx, areaX + areaW - settingsW - 10));

  // Emerge upward right above the widgets (or below if near top edge)
  let sy = anchorTopY - settingsH - 4;
  let originY = settingsH;
  if (sy < areaY + 8) {
    sy = micBottomY + 4;
    originY = 0;
  }
  sy = Math.max(areaY + 8, Math.min(sy, areaY + areaH - settingsH - 8));

  const originX = Math.max(24, Math.min(settingsW - 24, micCenterX - sx));

  const showAnimated = () => {
    settingsWindow.setPosition(Math.round(sx), Math.round(sy));
    settingsWindow.webContents.send('settings-open', { originX, originY });
    settingsWindow.webContents.send('command-logs-updated', getSerializedCommandLogs());
    settingsWindow.webContents.send('usage-updated', usage.getSummary(appConfig?.apiKey));
    settingsWindow.show();
    settingsWindow.focus();
  };

  if (isSettingsLoaded) {
    showAnimated();
  } else {
    settingsWindow.webContents.once('did-finish-load', showAnimated);
  }
}

function gracefulQuit() {
  if (isQuittingFlow) return;
  isQuittingFlow = true;
  stopAutoScroll();
  if (cursorTracker) {
    clearInterval(cursorTracker);
    cursorTracker = null;
  }
  stopTouchPenTracker();
  tts.shutdown();
  vision.dispose();

  if (settingsWindow && settingsWindow.isVisible()) {
    settingsWindow.hide();
  }

  if (eyeWindow && eyeWindow.isVisible() && !eyeWindow.isDestroyed()) {
    eyeWindow.webContents.send('eye-shrink-out');
  }

  if (widgetWindow && widgetWindow.isVisible() && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('widget-shrink-out');
    setTimeout(() => {
      app.isQuitting = true;
      app.quit();
    }, 550);
  } else {
    app.isQuitting = true;
    app.quit();
  }
}

function restartApp() {
  if (isQuittingFlow) return;
  isQuittingFlow = true;
  stopAutoScroll();
  if (cursorTracker) {
    clearInterval(cursorTracker);
    cursorTracker = null;
  }
  stopTouchPenTracker();
  tts.shutdown();
  vision.dispose();
  globalShortcut.unregisterAll();
  try {
    app.releaseSingleInstanceLock();
  } catch {}
  app.relaunch();
  app.exit(0);
}

function toggleWidgetsVisibility() {
  if (!widgetWindow) {
    createWidget();
    createEyeWindow();
    return;
  }
  if (widgetWindow.isVisible()) {
    widgetWindow.hide();
    if (eyeWindow && !eyeWindow.isDestroyed()) eyeWindow.hide();
  } else {
    widgetWindow.show();
    if (eyeWindow && !eyeWindow.isDestroyed()) eyeWindow.show();
  }
}

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Whisper Voice to Text');

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Tampilkan / Sembunyikan Widget',
        click: () => toggleWidgetsVisibility()
      },
      {
        label: 'Pengaturan Whisper Agent (Wis)',
        click: () => openSettings()
      },
      {
        label: 'Buka Log Debug',
        click: () => {
          const logPath = getLogFilePath();
          if (!fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, '', 'utf8');
          }
          shell.openPath(logPath);
        }
      },
      {
        label: 'Buka DevTools Wis',
        click: () => {
          if (eyeWindow && !eyeWindow.isDestroyed()) {
            eyeWindow.webContents.openDevTools({ mode: 'detach' });
          }
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Jalankan Otomatis saat Windows Dimulai',
        type: 'checkbox',
        checked: getAutoStartStatus(),
        click: (menuItem) => {
          const enable = menuItem.checked;
          setAutoStart(enable);
          appConfig.autoStart = enable;
          saveConfig(appConfig);
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Restart Aplikasi',
        click: () => restartApp()
      },
      {
        label: 'Keluar',
        click: () => gracefulQuit()
      }
    ]);
    tray.setContextMenu(contextMenu);
  };

  updateMenu();

  tray.on('click', () => {
    toggleWidgetsVisibility();
  });
}

// Target Window Tracker for Instant Auto-Paste
function updateTargetWindow() {
  const injectorPath = path.join(__dirname, 'injector.exe');
  if (!fs.existsSync(injectorPath)) return;
  execFile(injectorPath, ['get'], (err, stdout) => {
    if (!err && stdout) {
      const parsed = parseInt(stdout.trim(), 10);
      if (parsed && parsed !== 0) {
        lastTargetHwnd = parsed;
      }
    }
  });
}

// IPC Handlers
ipcMain.handle('get-config', () => appConfig);

ipcMain.on('record-target-window', () => {
  updateTargetWindow();
});

function moveWidgetByDelta(dx, dy) {
  if (!widgetWindow || widgetWindow.isDestroyed()) return false;
  const bounds = widgetWindow.getBounds();
  moveWidgetTo(bounds.x + dx, bounds.y + dy);
  return true;
}

ipcMain.handle('drag-start', (event, payload) => {
  const ptrType = (payload && payload.pointerType) || 'mouse';
  const nativeDrag = startNativeDrag(ptrType);
  return { nativeDrag };
});

ipcMain.on('drag-end', () => {
  stopNativeDrag();
});

ipcMain.on('move-widget', (event, { deltaX, deltaY }) => {
  moveWidgetByDelta(deltaX, deltaY);
});

ipcMain.handle('move-widget-step', (event, { dx, dy }) => {
  moveWidgetByDelta(dx, dy);
  return true;
});

ipcMain.on('toggle-radial-menu', () => {
  toggleRadialMenu();
});

ipcMain.on('open-radial-menu', () => {
  openRadialMenu();
});

ipcMain.on('hide-radial-menu', () => {
  requestCloseMenu('mic-click');
});

ipcMain.on('menu-will-quit', () => {
  isMenuClosing = true;
  setTimeout(() => {
    gracefulQuit();
  }, 160);
});

ipcMain.on('menu-closed-done', (event, reason) => {
  isMenuClosing = false;
  if (menuWindow && menuWindow.isVisible()) {
    menuWindow.hide();
  }
  if (reason === 'settings') {
    openSettings();
  } else if (reason === 'quit') {
    gracefulQuit();
  }
});

ipcMain.on('settings-closed-done', () => {
  if (settingsWindow && settingsWindow.isVisible()) {
    settingsWindow.hide();
  }
});

ipcMain.on('widget-shrink-done', () => {
  app.isQuitting = true;
  app.quit();
});

ipcMain.on('restart-app', () => {
  restartApp();
});

ipcMain.on('quit-app', () => {
  gracefulQuit();
});

ipcMain.handle('save-config', (event, newConfig) => {
  appConfig = { ...appConfig, ...newConfig };
  saveConfig(appConfig);
  if (appConfig.autoStart !== undefined) {
    setAutoStart(appConfig.autoStart);
  }
  if (widgetWindow && widgetWindow.webContents) {
    widgetWindow.webContents.send('config-updated', appConfig);
  }
  if (eyeWindow && eyeWindow.webContents) {
    eyeWindow.webContents.send('config-updated', appConfig);
  }
  broadcastUsageSummary();
  return true;
});

ipcMain.on('log-debug', (event, msg) => {
  logApp(msg);
});

ipcMain.handle('open-debug-log', () => {
  const logPath = getLogFilePath();
  if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, '', 'utf8');
  shell.openPath(logPath);
  return logPath;
});

ipcMain.on('stop-auto-scroll', () => {
  stopAutoScroll();
});

let cachedWhisperTabHints = [];
let lastWhisperTabRefreshTs = 0;

ipcMain.handle('get-whisper-prompt', () => {
  const now = Date.now();
  if (now - lastWhisperTabRefreshTs > 15000) {
    lastWhisperTabRefreshTs = now;
    listChromeTabs().then((tabs) => {
      if (Array.isArray(tabs)) cachedWhisperTabHints = tabs;
    }).catch(() => {});
  }
  return memory.getWhisperPromptHints(cachedWhisperTabHints);
});

ipcMain.handle('tts-speak', async (event, text) => {
  if (!appConfig || appConfig.voiceAssistant === false || !text) {
    return null;
  }
  try {
    return await tts.synthesizeWavBase64(text, 'auto');
  } catch (err) {
    console.warn('TTS speak error:', err);
    return null;
  }
});

const MAX_COMMAND_LOGS = 100;
let commandLogs = [];
const commandQueue = [];
let isProcessingQueue = false;
let nextCommandId = 1;

function getSerializedCommandLogs() {
  return commandLogs.map(item => ({ ...item }));
}

function broadcastCommandLogs() {
  if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.webContents) {
    settingsWindow.webContents.send('command-logs-updated', getSerializedCommandLogs());
  }
}

function broadcastUsageSummary() {
  if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.webContents) {
    settingsWindow.webContents.send('usage-updated', usage.getSummary(appConfig?.apiKey));
  }
}

function formatErrorForUiAndSpeech(errMsg) {
  const raw = String(errMsg || 'Gagal memproses perintah');
  if (/rate limit reached|tokens per (day|minute)|requests per (day|minute)/i.test(raw)) {
    const stat = raw.match(/(TPD|TPM|RPD|RPM)\):\s*Limit\s*(\d+),\s*Used\s*(\d+)/i);
    const retry = raw.match(/try again in\s*([\dms.]+)/i);
    const statText = stat ? `${Number(stat[3]).toLocaleString('id-ID')}/${Number(stat[2]).toLocaleString('id-ID')} ${stat[1]}` : 'Limit tercapai';
    const retryText = retry ? ` · Coba lagi ${retry[1]}` : '';
    return {
      uiMessage: `Kuota API penuh (${statText})${retryText}`,
      speechReply: 'Kuota API sedang penuh, silakan tunggu sebentar.'
    };
  }
  return {
    uiMessage: raw.slice(0, 140),
    speechReply: raw.slice(0, 120)
  };
}

function dispatchTtsNonBlocking(replyText, replyLang, ok) {
  if (appConfig?.voiceAssistant === false || !replyText) return;
  setImmediate(async () => {
    try {
      // Skip speaking if another queued task already started running
      if (commandQueue.length > 0 && ok) return;
      const wavBase64 = await tts.synthesizeWavBase64(replyText, replyLang || 'id');
      if (wavBase64 && eyeWindow && !eyeWindow.isDestroyed() && eyeWindow.webContents) {
        eyeWindow.webContents.send('wis-play-tts', {
          wavBase64,
          ok: Boolean(ok),
          replyText
        });
      }
    } catch (ttsErr) {
      console.warn('Piper TTS synthesis skipped:', ttsErr);
    }
  });
}

function refreshQueuePositions() {
  for (let i = 0; i < commandQueue.length; i++) {
    commandQueue[i].queuePos = i + 1;
    commandQueue[i].stage = `Antrean #${i + 1} · Menunggu giliran...`;
  }
}

async function runSingleCommandEntry(entry) {
  entry.status = 'running';
  entry.queuePos = 0;
  entry.startedAt = Date.now();
  entry.stage = 'Memulai...';
  const taskUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, visionTokens: 0, llmModel: '' };
  entry.usage = { ...taskUsage };
  broadcastCommandLogs();

  if (!appConfig || !appConfig.apiKey) {
    entry.status = 'error';
    entry.finishedAt = Date.now();
    entry.durationMs = entry.finishedAt - entry.createdAt;
    entry.summary = 'API Key Groq belum diisi';
    entry.reply = 'API Key Groq belum diisi di pengaturan.';
    entry.stage = entry.summary;
    broadcastCommandLogs();
    return { ok: false, message: entry.summary, reply: entry.reply, wavBase64: null };
  }

  try {
    const res = await routeCommandWithGroq(entry.transcript, appConfig.apiKey, {
      eyeWindow,
      widgetWindow,
      eyeOffsetX: EYE_OFFSET_X,
      eyeOffsetY: EYE_OFFSET_Y,
      scrollController,
      onStage: (stageMsg) => {
        entry.stage = String(stageMsg || '').trim() || 'Memproses...';
        broadcastCommandLogs();
      },
      onUsage: (u) => {
        if (!u || !u.usage) return;
        const p = Number(u.usage.prompt_tokens || 0);
        const c = Number(u.usage.completion_tokens || 0);
        const t = Number(u.usage.total_tokens || (p + c));
        taskUsage.promptTokens += p;
        taskUsage.completionTokens += c;
        taskUsage.totalTokens += t;
        if (u.phase === 'vision') taskUsage.visionTokens += t;
        if (u.model && u.phase === 'planner') taskUsage.llmModel = u.model;
        else if (!taskUsage.llmModel && u.model) taskUsage.llmModel = u.model;
        entry.usage = { ...taskUsage };
        broadcastCommandLogs();
      }
    });

    entry.status = res && res.ok ? 'done' : 'error';
    entry.finishedAt = Date.now();
    entry.durationMs = entry.finishedAt - entry.createdAt;
    entry.summary = (res && (res.message || res.reply)) || (res?.ok ? 'Selesai' : 'Gagal');
    entry.reply = (res && (res.reply || res.message)) || '';
    entry.stage = entry.summary;
    entry.usage = { ...taskUsage };
    usage.recordTaskResult({
      apiKey: appConfig.apiKey,
      id: entry.id,
      transcript: entry.transcript,
      status: entry.status,
      model: taskUsage.llmModel,
      usage: taskUsage
    });
    broadcastCommandLogs();
    broadcastUsageSummary();

    const spokenText = entry.reply;
    const replyLang = (res && res.replyLang) || 'id';
    logApp(`[main] Wis result ok=${res?.ok} lang=${replyLang} ms=${entry.durationMs} tokens=${taskUsage.totalTokens} reply="${spokenText}"`);
    return {
      ...res,
      reply: spokenText,
      replyLang
    };
  } catch (err) {
    console.error('Command execution error:', err);
    logApp(`[main] command ERROR: ${err && err.stack ? err.stack : err}`);
    const formatted = formatErrorForUiAndSpeech(err && err.message);
    entry.status = 'error';
    entry.finishedAt = Date.now();
    entry.durationMs = entry.finishedAt - entry.createdAt;
    entry.summary = formatted.uiMessage;
    entry.reply = formatted.speechReply;
    entry.stage = formatted.uiMessage;
    entry.usage = { ...taskUsage };
    usage.recordTaskResult({
      apiKey: appConfig.apiKey,
      id: entry.id,
      transcript: entry.transcript,
      status: 'error',
      model: taskUsage.llmModel,
      usage: taskUsage
    });
    broadcastCommandLogs();
    broadcastUsageSummary();
    return { ok: false, message: formatted.uiMessage, reply: formatted.speechReply, replyLang: 'id' };
  }
}

async function processCommandQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    while (commandQueue.length > 0) {
      const entry = commandQueue.shift();
      refreshQueuePositions();

      const res = await runSingleCommandEntry(entry);
      const hasMoreQueued = commandQueue.length > 0;
      const shouldSpeak = !hasMoreQueued && res?.reply && (res.speakReply || !res.ok);
      if (shouldSpeak) {
        dispatchTtsNonBlocking(res.reply, res.replyLang || 'id', Boolean(res?.ok));
      }
    }
  } finally {
    isProcessingQueue = false;
    broadcastCommandLogs();
  }
}

function enqueueVoiceCommand(payload) {
  const isObj = payload && typeof payload === 'object';
  const cleanText = String(isObj ? payload.transcript : payload || '').trim();
  const willQueue = isProcessingQueue || commandQueue.length > 0;
  const entry = {
    id: nextCommandId++,
    transcript: cleanText,
    status: willQueue ? 'queued' : 'running',
    stage: willQueue ? `Antrean #${commandQueue.length + 1} · Menunggu giliran...` : 'Memulai...',
    summary: '',
    reply: '',
    queuePos: willQueue ? commandQueue.length + 1 : 0,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, visionTokens: 0, llmModel: '' },
    createdAt: Date.now(),
    startedAt: willQueue ? null : Date.now(),
    finishedAt: null,
    durationMs: null
  };

  commandLogs.unshift(entry);
  if (commandLogs.length > MAX_COMMAND_LOGS) {
    commandLogs.length = MAX_COMMAND_LOGS;
  }
  commandQueue.push(entry);
  if (willQueue) {
    refreshQueuePositions();
  }
  broadcastCommandLogs();
  processCommandQueue();
  return { queued: true, id: entry.id, queueLength: commandQueue.length };
}

ipcMain.on('record-whisper-usage', (event, payload) => {
  if (!appConfig?.apiKey) return;
  usage.recordWhisperCall({
    apiKey: appConfig.apiKey,
    model: payload?.model || appConfig.model || 'whisper-large-v3',
    audioSeconds: Number(payload?.audioSeconds || 0)
  });
  broadcastUsageSummary();
});

ipcMain.handle('get-usage-summary', () => {
  return usage.getSummary(appConfig?.apiKey);
});

ipcMain.handle('get-memory-overview', () => {
  const m = memory.loadMemory();
  return {
    skills: Array.isArray(m.skills) ? m.skills : [],
    facts: Array.isArray(m.facts) ? m.facts : [],
    aliases: Object.entries(m.aliases || {})
  };
});

ipcMain.handle('probe-api-quota', async (event, overrideKey) => {
  const targetKey = (overrideKey && String(overrideKey).trim()) || appConfig?.apiKey;
  const res = await probeApiQuota(targetKey);
  broadcastUsageSummary();
  return res;
});

ipcMain.handle('set-custom-daily-limit', (event, limitVal) => {
  const res = usage.setCustomDailyTokenLimit(appConfig?.apiKey, limitVal);
  broadcastUsageSummary();
  return res;
});

ipcMain.handle('reset-today-usage', () => {
  const res = usage.resetTodayUsage(appConfig?.apiKey);
  broadcastUsageSummary();
  return res;
});

ipcMain.handle('get-command-logs', () => getSerializedCommandLogs());

ipcMain.handle('clear-completed-logs', () => {
  commandLogs = commandLogs.filter(item => item.status === 'running' || item.status === 'queued');
  broadcastCommandLogs();
  return getSerializedCommandLogs();
});

ipcMain.handle('enqueue-voice-command', (event, payload) => {
  return enqueueVoiceCommand(payload);
});

ipcMain.handle('execute-voice-command', async (event, transcript) => {
  const cleanText = String(transcript || '').trim();
  const entry = {
    id: nextCommandId++,
    transcript: cleanText,
    status: 'running',
    stage: 'Memulai...',
    summary: '',
    reply: '',
    queuePos: 0,
    createdAt: Date.now(),
    startedAt: Date.now(),
    finishedAt: null,
    durationMs: null
  };
  commandLogs.unshift(entry);
  if (commandLogs.length > MAX_COMMAND_LOGS) commandLogs.length = MAX_COMMAND_LOGS;
  broadcastCommandLogs();

  const res = await runSingleCommandEntry(entry);
  let wavBase64 = null;
  if (appConfig?.voiceAssistant !== false && res?.reply) {
    try {
      wavBase64 = await tts.synthesizeWavBase64(res.reply, res.replyLang || 'id');
    } catch (ttsErr) {
      console.warn('Piper TTS synthesis skipped:', ttsErr);
    }
  }
  return {
    ...res,
    wavBase64
  };
});

ipcMain.handle('open-settings', () => {
  openSettings();
});

// Universal Text Injection: Paste text into active target application
ipcMain.handle('paste-text', async (event, text) => {
  if (!text || text.trim().length === 0) return false;

  clipboard.writeText(text);

  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.blur();
  }

  const injectorPath = path.join(__dirname, 'injector.exe');
  const args = lastTargetHwnd ? [lastTargetHwnd.toString()] : [];

  if (fs.existsSync(injectorPath)) {
    execFile(injectorPath, args, (error) => {
      if (error) {
        console.error('Error with injector.exe:', error);
      }
    });
  } else {
    const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 60; [System.Windows.Forms.SendKeys]::SendWait('^v')"`;
    exec(psCommand);
  }

  return true;
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (widgetWindow) {
      if (widgetWindow.isMinimized()) widgetWindow.restore();
      widgetWindow.show();
    }
    if (eyeWindow) {
      eyeWindow.show();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.whisper.floatingwidget');
    if (appConfig.autoStart) {
      setAutoStart(true);
    }

    createWidget();
    createEyeWindow();
    createMenuWindow();
    createSettingsWindow();
    createTray();
    memory.loadMemory();
    tts.warmup('id');

    try {
      globalShortcut.register('Alt+Shift+V', () => {
        if (widgetWindow && widgetWindow.webContents) {
          widgetWindow.webContents.send('trigger-toggle');
        }
      });
      globalShortcut.register('Alt+Shift+C', () => {
        if (eyeWindow && eyeWindow.webContents) {
          eyeWindow.webContents.send('trigger-command-toggle');
        }
      });
    } catch (e) {
      console.warn('Could not register global shortcut:', e);
    }

    if (!appConfig.apiKey) {
      setTimeout(() => {
        openSettings();
      }, 500);
    }
  });

  app.on('will-quit', () => {
    stopAutoScroll();
    if (cursorTracker) clearInterval(cursorTracker);
    stopTouchPenTracker();
    tts.shutdown();
    vision.dispose();
    globalShortcut.unregisterAll();
  });

  app.on('window-all-closed', (e) => {
    e.preventDefault();
  });
}
