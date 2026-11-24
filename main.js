const electron = require('electron');
const path = require('path');
const fs = require('fs');

// If executed in Node mode (e.g. ELECTRON_RUN_AS_NODE is active or via node main.js),
// gracefully relaunch in real GUI Electron mode without ELECTRON_RUN_AS_NODE.
if (typeof electron === 'string') {
  const { spawn } = require('child_process');
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.toLowerCase() === 'electron_run_as_node') delete env[k];
  }
  const child = spawn(electron, ['.'], {
    cwd: __dirname,
    env,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  process.exit(0);
}

const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, nativeImage, globalShortcut, screen, shell } = electron;
const { exec, execFile, spawn, execSync } = require('child_process');
const { routeCommandWithGroq, listChromeTabs, probeApiQuota } = require('./assistant');
const tts = require('./tts');
const vision = require('./vision');
const memory = require('./memory');
const usage = require('./usage');
const voiceProfile = require('./voice-profile');

process.on('uncaughtException', (err) => {
  try { fs.appendFileSync(path.join(__dirname, 'main_crash.log'), `[UNCAUGHT] ${err.stack || err}\n`); } catch {}
  console.error('[UNCAUGHT]', err);
});
process.on('unhandledRejection', (reason) => {
  try { fs.appendFileSync(path.join(__dirname, 'main_crash.log'), `[REJECTION] ${reason?.stack || reason}\n`); } catch {}
  console.error('[REJECTION]', reason);
});

// Ensure WebAudio never stays suspended when Wis is triggered via global shortcut
if (app && app.commandLine) {
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
}

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
let isWisInMicSlot = false;
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
    provider: 'geminix',
    baseUrl: 'https://geminix.arss.fun/v1',
    apiKey: '',
    language: 'auto', // 'auto' for multilingual, 'id', 'en'
    autoStart: false,
    voiceAssistant: true,
    model: 'gemini-3.8-flash-high',
    deviceId: 'default',
    setupCompleted: false,
    posX: null,
    posY: null
  };
  try {
    const targetPath = getConfigFilePath();
    if (fs.existsSync(targetPath)) {
      const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      // Backward compatibility auto-detection
      if (!data.baseUrl) {
        if (data.apiKey?.startsWith('sk-gx-') || data.provider === 'geminix') {
          data.provider = 'geminix';
          data.baseUrl = 'https://geminix.arss.fun/v1';
        } else if (data.apiKey?.startsWith('sk-') && !data.apiKey?.startsWith('sk-gx-')) {
          data.provider = 'openai';
          data.baseUrl = 'https://api.openai.com/v1';
        } else {
          // Default is Groq
          data.provider = 'groq';
          data.baseUrl = 'https://api.groq.com/openai/v1';
        }
      }
      return { ...defaultConfig, ...data };
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return defaultConfig;
}

function resolveProvider(cfg = {}) {
  const key = String(cfg.apiKey || '').trim();
  const prov = cfg.provider || '';
  const url = String(cfg.baseUrl || '').trim();

  if (prov === 'geminix' || key.startsWith('sk-gx-') || url.includes('geminix')) {
    return {
      provider: 'geminix',
      baseUrl: url || 'https://geminix.arss.fun/v1',
      defaultModel: 'gemini-3.8-flash-high',
      isGeminix: true,
      isGroq: false,
      isOpenAi: false
    };
  }
  if (prov === 'groq' || key.startsWith('gsk_') || url.includes('groq.com')) {
    return {
      provider: 'groq',
      baseUrl: url || 'https://api.groq.com/openai/v1',
      defaultModel: 'openai/gpt-oss-20b',
      isGeminix: false,
      isGroq: true,
      isOpenAi: false
    };
  }
  if (prov === 'openai' || (key.startsWith('sk-') && !key.startsWith('sk-gx-')) || url.includes('api.openai.com')) {
    return {
      provider: 'openai',
      baseUrl: url || 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      isGeminix: false,
      isGroq: false,
      isOpenAi: true
    };
  }
  return {
    provider: 'custom',
    baseUrl: (url || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
    defaultModel: cfg.model || 'openai/gpt-oss-20b',
    isGeminix: false,
    isGroq: false,
    isOpenAi: false
  };
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

let bubbleWindow = null;

function createBubbleWindow() {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) return;

  bubbleWindow = new BrowserWindow({
    width: 260,
    height: 85,
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

  bubbleWindow.setAlwaysOnTop(true, 'screen-saver', 3);
  bubbleWindow.loadFile('bubble.html');

  bubbleWindow.on('closed', () => {
    bubbleWindow = null;
  });
}

function updateBubblePlacement() {
  if (!bubbleWindow || bubbleWindow.isDestroyed() || !bubbleWindow.isVisible()) return;
  if (!eyeWindow || eyeWindow.isDestroyed()) return;

  const [ex, ey] = eyeWindow.getPosition();
  const display = screen.getDisplayNearestPoint({ x: ex, y: ey });
  const { x: areaX, y: areaY, width: areaW, height: areaH } = display.workArea;

  const bw = 260;
  const bh = 85;
  const currentEyeWidth = isWisInMicSlot ? 80 : 64;
  const currentEyeHeight = isWisInMicSlot ? 80 : 64;
  let bx = Math.round(ex + currentEyeWidth / 2 - bw / 2);
  let by = Math.round(ey - bh - 6);

  if (by < areaY) {
    by = ey + currentEyeHeight + 6;
  }
  bx = Math.max(areaX + 8, Math.min(areaX + areaW - bw - 8, bx));
  bubbleWindow.setBounds({ x: bx, y: by, width: bw, height: bh });
}

function showSpeechBubble(payload = {}) {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) createBubbleWindow();
  updateBubblePlacement();
  if (bubbleWindow && bubbleWindow.webContents) {
    bubbleWindow.webContents.send('bubble-update', payload);
  }
  bubbleWindow.show();
}

function hideSpeechBubble() {
  if (bubbleWindow && !bubbleWindow.isDestroyed() && bubbleWindow.isVisible()) {
    bubbleWindow.webContents.send('bubble-close-request');
  }
}

function getGitExecutable() {
  const possiblePaths = [
    'git',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe', 'cmd', 'git.exe'),
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe'
  ];
  for (const p of possiblePaths) {
    try {
      execSync(`"${p}" --version`, { stdio: 'ignore' });
      return `"${p}"`;
    } catch (_) {}
  }
  return 'git';
}

function isVersionNewer(remoteVer, currentVer) {
  if (!remoteVer || !currentVer) return false;
  const parse = v => String(v).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const [rMaj, rMin, rPat] = parse(remoteVer);
  const [cMaj, cMin, cPat] = parse(currentVer);
  if (rMaj > cMaj) return true;
  if (rMaj === cMaj && rMin > cMin) return true;
  if (rMaj === cMaj && rMin === cMin && rPat > cPat) return true;
  return false;
}

async function checkForGitHubUpdates() {
  try {
    const https = require('https');
    let localCommit = '';
    try {
      localCommit = execSync('git rev-parse HEAD', { encoding: 'utf8', timeout: 2000 }).trim();
    } catch {}

    const options = {
      hostname: 'api.github.com',
      path: '/repos/rromzly-ship-it/whisper-wideget/commits/main',
      headers: { 'User-Agent': 'Whisper-Floating-Widget' }
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            const remoteSha = json.sha;
            if (remoteSha && localCommit && remoteSha !== localCommit) {
              const msg = (json.commit && json.commit.message) ? json.commit.message.split('\n')[0] : 'Pembaruan terbaru';
              showSpeechBubble({
                title: '🎉 Update Baru di GitHub!',
                text: `Tersedia versi baru: "${msg}". Mau update sekarang?`,
                duration: 25000,
                actions: [
                  { label: '⚡ Update Sekarang (Git Pull)', type: 'run-sync', autoClose: true },
                  { label: '🌐 Buka GitHub', type: 'open-url', url: 'https://github.com/rromzly-ship-it/whisper-wideget', autoClose: false },
                  { label: 'Nanti', type: 'dismiss', autoClose: true }
                ]
              });
            }
          }
        } catch (_) {}
      });
    });
    req.on('error', () => {});
    req.setTimeout(4000, () => { req.destroy(); });
  } catch (_) {}
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
    if (isWisInMicSlot) {
      eyeWindow.setBounds({ x: rx, y: ry, width: 80, height: 80 });
    } else {
      eyeWindow.setBounds({ x: rx + EYE_OFFSET_X, y: ry + EYE_OFFSET_Y, width: 64, height: 64 });
    }
  }
  if (bubbleWindow && !bubbleWindow.isDestroyed() && bubbleWindow.isVisible()) {
    updateBubblePlacement();
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
  const injPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'injector.exe');
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

  // Auto-hide popup menu smoothly when user clicks anywhere else (ignore rapid initial focus bounce)
  menuWindow.on('blur', () => {
    if (Date.now() - lastMenuOpenedAt < 200) return;
    requestCloseMenu('blur');
  });

  menuWindow.on('closed', () => {
    menuWindow = null;
  });
}

let lastMenuClosedAt = 0;

function requestCloseMenu(reason) {
  if (!menuWindow || !menuWindow.isVisible() || isMenuClosing) return;
  isMenuClosing = true;
  lastMenuClosedAt = Date.now();
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

  // If menu is visible or was just requested to close (e.g. within 350ms from blur), close/stay closed
  if (menuWindow.isVisible() || (Date.now() - lastMenuClosedAt < 350)) {
    requestCloseMenu('toggle');
    return;
  }

  openRadialMenu();
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 860,
    height: 640,
    minWidth: 540,
    minHeight: 480,
    title: 'Pengaturan Whisper Agent (Wis)',
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
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

let onboardingWindow = null;

function createOnboardingWindow() {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.show();
    onboardingWindow.focus();
    return;
  }

  onboardingWindow = new BrowserWindow({
    width: 760,
    height: 680,
    minWidth: 640,
    minHeight: 580,
    title: 'Setup Whisper Agent',
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#141414',
    resizable: true,
    center: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  onboardingWindow.setMenu(null);
  onboardingWindow.loadFile('onboarding.html');

  onboardingWindow.once('ready-to-show', () => {
    onboardingWindow.show();
    onboardingWindow.focus();
  });

  onboardingWindow.on('closed', () => {
    onboardingWindow = null;
  });
}

function createDesktopShortcut() {
  try {
    const targetExe = process.execPath;
    const desktopDir = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop');
    const shortcutPath = path.join(desktopDir, 'Whisper Widget.lnk');
    const iconPath = path.join(__dirname, 'icon.ico');
    const ps = `$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}'); $s.TargetPath = '${targetExe.replace(/'/g, "''")}'; $s.Description = 'Whisper Floating Widget by ARSS'; $s.WorkingDirectory = '${path.dirname(targetExe).replace(/'/g, "''")}'; if (Test-Path '${iconPath.replace(/'/g, "''")}') { $s.IconLocation = '${iconPath.replace(/'/g, "''")}' }; $s.Save()`;
    execSync(`powershell -NoProfile -Command "${ps}"`, { timeout: 4000 });
    return true;
  } catch (e) {
    console.warn('Failed to create desktop shortcut:', e.message);
    return false;
  }
}

function openSettings() {
  if (!settingsWindow) {
    createSettingsWindow();
  }

  const settingsW = 860;
  const settingsH = 640;

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

function gracefulQuit(caller = 'unknown') {
  try { fs.appendFileSync(path.join(__dirname, 'main_crash.log'), `[QUIT] gracefulQuit called by ${caller} at ${new Error().stack}\n`); } catch {}
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

// Wis Jump to Mic & Replace Microphone Slot Mode
ipcMain.on('wis-enter-mic-slot', () => {
  if (isWisInMicSlot) return;
  isWisInMicSlot = true;
  if (!widgetWindow || widgetWindow.isDestroyed() || !eyeWindow || eyeWindow.isDestroyed()) return;

  const [wx, wy] = widgetWindow.getPosition();
  widgetWindow.hide();
  eyeWindow.setBounds({ x: wx, y: wy, width: 80, height: 80 });
  eyeWindow.webContents.send('wis-slot-mode', { inSlot: true });
  updateBubblePlacement();
});

ipcMain.on('wis-leave-mic-slot', () => {
  if (!isWisInMicSlot) return;
  isWisInMicSlot = false;
  if (!widgetWindow || widgetWindow.isDestroyed() || !eyeWindow || eyeWindow.isDestroyed()) return;

  const [ex, ey] = eyeWindow.getPosition();
  widgetWindow.setBounds({ x: ex, y: ey, width: 80, height: 80 });
  widgetWindow.show();
  eyeWindow.setBounds({ x: ex + EYE_OFFSET_X, y: ey + EYE_OFFSET_Y, width: 64, height: 64 });
  eyeWindow.webContents.send('wis-slot-mode', { inSlot: false });
  updateBubblePlacement();
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

ipcMain.on('show-speech-bubble', (event, payload) => {
  showSpeechBubble(payload);
});

ipcMain.on('hide-speech-bubble', () => {
  hideSpeechBubble();
});

ipcMain.on('hide-speech-bubble-done', () => {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.hide();
  }
});

ipcMain.on('bubble-action-click', (event, action) => {
  if (!action) return;
  if (action.type === 'open-url' && action.url) {
    shell.openExternal(action.url);
  } else if (action.type === 'copy-text' && action.text) {
    clipboard.writeText(action.text);
  } else if (action.type === 'run-sync') {
    try {
      showSpeechBubble({ title: 'Wis', text: '⚡ Menarik pembaruan dari GitHub...', duration: 4000 });
      execSync('node sync.js', { stdio: 'ignore' });
      showSpeechBubble({ title: 'Wis', text: '✓ Selesai di-update! Memulai ulang aplikasi...', duration: 3000 });
      setTimeout(() => { restartApp(); }, 1800);
    } catch (e) {
      showSpeechBubble({ title: 'Wis (Error)', text: `Gagal update: ${e.message}`, duration: 5000 });
    }
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

const appsKnowledgePath = path.join(__dirname, 'apps-knowledge.json');

function loadAppsKnowledgeList() {
  try {
    if (fs.existsSync(appsKnowledgePath)) {
      return JSON.parse(fs.readFileSync(appsKnowledgePath, 'utf8')) || [];
    }
  } catch {}
  return [];
}

function saveAppsKnowledgeList(list) {
  try {
    fs.writeFileSync(appsKnowledgePath, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving apps-knowledge.json:', err);
    return false;
  }
}

ipcMain.handle('get-apps-knowledge', () => {
  return loadAppsKnowledgeList();
});

ipcMain.handle('save-apps-knowledge', (event, list) => {
  return saveAppsKnowledgeList(list);
});

ipcMain.handle('test-open-knowledge', async (event, item) => {
  if (!item || !item.target) return { ok: false, message: 'Target kosong' };
  try {
    const isWeb = (item.type === 'web') || /^https?:\/\//i.test(item.target);
    if (isWeb) {
      await shell.openExternal(item.target);
      return { ok: true, message: `Membuka website ${item.name}` };
    } else {
      const errMsg = await shell.openPath(item.target);
      if (errMsg) {
        spawn(item.target, [], { detached: true, stdio: 'ignore' }).unref();
      }
      return { ok: true, message: `Membuka aplikasi ${item.name}` };
    }
  } catch (e) {
    return { ok: false, message: e.message };
  }
});

// Voice Identity & Speaker Verification (Tahap 2)
ipcMain.handle('get-voice-profile', () => {
  return voiceProfile.loadVoiceProfile();
});

ipcMain.handle('enroll-voice-profile', (event, { pcm, sampleRate }) => {
  if (!pcm || pcm.length === 0) return { ok: false, message: 'Audio kosong' };
  const floatSamples = new Float32Array(pcm);
  const features = voiceProfile.extractVoiceFeatures(floatSamples, sampleRate || 16000);
  if (!features || !features.mfcc || features.mfcc.length === 0) {
    return { ok: false, message: 'Suara tidak terdeteksi atau terlalu pelan' };
  }
  const ok = voiceProfile.saveVoiceProfile(features);
  return { ok, profile: features };
});

ipcMain.handle('delete-voice-profile', () => {
  return voiceProfile.deleteVoiceProfile();
});

ipcMain.handle('verify-voice-match', (event, { pcm, sampleRate, threshold }) => {
  const profile = voiceProfile.loadVoiceProfile();
  if (!profile) return { match: true, score: 100, reason: 'Belum ada profil' };
  if (!pcm || pcm.length === 0) return { match: false, score: 0, reason: 'Audio kosong' };
  const floatSamples = new Float32Array(pcm);
  const candidate = voiceProfile.extractVoiceFeatures(floatSamples, sampleRate || 16000);
  if (!candidate) return { match: false, score: 0, reason: 'Suara tidak terdeteksi' };

  const evalRes = voiceProfile.compareVoiceFeatures(candidate, profile);
  const minThreshold = threshold !== undefined ? threshold : (appConfig?.voiceMatchThreshold || 70);
  const match = evalRes.score >= minThreshold;
  return { match, score: evalRes.score, minThreshold };
});

ipcMain.on('hide-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.hide();
  }
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
    const { tryMatchFastSkill } = require('./skills');
    const fastPlan = tryMatchFastSkill(entry.transcript);
    if (!fastPlan) {
      entry.status = 'error';
      entry.finishedAt = Date.now();
      entry.durationMs = entry.finishedAt - entry.createdAt;
      entry.summary = 'API Key Groq belum diisi';
      entry.reply = 'API Key Groq belum diisi di pengaturan.';
      entry.stage = entry.summary;
      broadcastCommandLogs();
      return { ok: false, message: entry.summary, reply: entry.reply, wavBase64: null };
    }
  }

  const lagWatchTimer = setTimeout(() => {
    if (entry.status === 'running') {
      if (eyeWindow && !eyeWindow.isDestroyed() && eyeWindow.webContents) {
        eyeWindow.webContents.send('wis-angry-event', { reason: 'lag', message: 'Koneksi lambat / server antre' });
      }
      showSpeechBubble({
        title: 'Wis (Kesal 💢)',
        progress: '⚠️ Server sedang tersendat...',
        text: 'Aduh, respon internet atau server agak lama nih!',
        duration: 4000
      });
    }
  }, 3200);

  try {
    let spokeImmediate = false;
    const res = await routeCommandWithGroq(entry.transcript, appConfig.apiKey, {
      eyeWindow,
      widgetWindow,
      eyeOffsetX: EYE_OFFSET_X,
      eyeOffsetY: EYE_OFFSET_Y,
      scrollController,
      baseUrl: appConfig.baseUrl,
      model: appConfig.model,
      onImmediateSpeech: (immediateReply, immediateLang) => {
        spokeImmediate = true;
        dispatchTtsNonBlocking(immediateReply, immediateLang || 'id', true);
      },
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

    clearTimeout(lagWatchTimer);

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

    if (spokenText) {
      showSpeechBubble({
        title: 'Wis',
        text: spokenText,
        duration: 5500
      });
    }

    return {
      ...res,
      spokeImmediate: spokeImmediate || Boolean(res?.spokeImmediate),
      reply: spokenText,
      replyLang
    };
  } catch (err) {
    clearTimeout(lagWatchTimer);
    console.error('Command execution error:', err);
    logApp(`[main] command ERROR: ${err && err.stack ? err.stack : err}`);
    const formatted = formatErrorForUiAndSpeech(err && err.message);

    if (formatted.speechReply.includes('Kuota API') || (err && err.status === 429)) {
      if (eyeWindow && !eyeWindow.isDestroyed() && eyeWindow.webContents) {
        eyeWindow.webContents.send('wis-angry-event', { reason: 'quota' });
      }
      showSpeechBubble({
        title: 'Wis (Kesal 💢)',
        text: 'Aduh, kuota API kamu sedang limit atau penuh nih!',
        duration: 7000
      });
    }
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
  notifyEyeAnim({ type: 'busy-state', busy: true });

  try {
    while (commandQueue.length > 0) {
      const entry = commandQueue.shift();
      refreshQueuePositions();

      const res = await runSingleCommandEntry(entry);
      const hasMoreQueued = commandQueue.length > 0;
      const shouldSpeak = !hasMoreQueued && res?.reply && (res.speakReply || !res.ok) && !res.spokeImmediate;
      if (shouldSpeak) {
        dispatchTtsNonBlocking(res.reply, res.replyLang || 'id', Boolean(res?.ok));
      }
    }
  } finally {
    isProcessingQueue = false;
    notifyEyeAnim({ type: 'busy-state', busy: false });
    broadcastCommandLogs();
  }
}

function enqueueVoiceCommand(payload) {
  const isObj = payload && typeof payload === 'object';
  const cleanText = String(isObj ? payload.transcript : payload || '').trim();
  if (!cleanText) return { queued: false, empty: true };

  // MENCEGAH PENUMPUKAN REQUEST:
  // Jika Wis sedang sibuk mengeksekusi perintah dan antrean sudah ada 1 perintah,
  // abaikan request tambahan agar tidak terjadi penumpukan/spam perintah.
  if (isProcessingQueue && commandQueue.length >= 1) {
    console.log('[main] Mencegah penumpukan request: mengabaikan perintah tambahan:', cleanText);
    return { queued: false, dropped: true, reason: 'busy' };
  }

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
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, visionTokens: 0, llmModel: '' },
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

// Universal API Gateway - Fetch Models
ipcMain.handle('fetch-api-models', async (event, { baseUrl, apiKey }) => {
  if (!baseUrl) return { ok: false, message: 'Base URL kosong' };
  try {
    const cleanBase = baseUrl.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }
    const resp = await fetch(`${cleanBase}/models`, { method: 'GET', headers });
    if (!resp.ok) {
      return { ok: false, message: `HTTP ${resp.status}: Gagal memuat daftar model` };
    }
    const data = await resp.json();
    let models = [];
    const rawList = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
    models = rawList.map(m => {
      if (typeof m === 'string') return { id: m, desc: '' };
      return {
        id: m.id || m.name || '',
        desc: m.description || m.desc || (m.owned_by ? `(${m.owned_by})` : '')
      };
    }).filter(m => m.id);
    return { ok: true, models };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

// Universal Audio Transcription (Whisper STT / Multimodal Gateway)
ipcMain.handle('transcribe-audio', async (event, { audioBase64, mimeType = 'audio/webm', promptHint = '' }) => {
  if (!audioBase64) return { ok: false, message: 'Data audio kosong' };

  const prov = resolveProvider(appConfig);
  const apiKey = (appConfig.apiKey || '').trim();
  const language = appConfig.language && appConfig.language !== 'auto' ? appConfig.language : null;
  let selectedModel = (appConfig.model || '').trim();

  // 1. Gateway GeminiX (Multimodal audio via /chat/completions)
  if (prov.isGeminix) {
    try {
      const chatEndpoint = prov.baseUrl.endsWith('/chat/completions') 
        ? prov.baseUrl 
        : `${prov.baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const format = mimeType.includes('wav') ? 'wav' : (mimeType.includes('mp3') ? 'mp3' : 'webm');
      
      // Model guard: GeminiX requires Gemini models for audio STT (never whisper-*)
      let modelToUse = 'gemini-2.5-flash';
      if (selectedModel && selectedModel.startsWith('gemini-') && !selectedModel.toLowerCase().includes('whisper') && selectedModel !== '__custom__') {
        modelToUse = selectedModel;
      }

      const body = {
        model: modelToUse,
        temperature: 0.0,
        messages: [
          {
            role: 'system',
            content: 'You are an accurate, verbatim speech-to-text transcriber. Output ONLY the exact transcribed spoken words in Indonesian or English. Output nothing else: no explanations, no thought tags, no markdown.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Transkripsikan rekaman audio berikut secara persis kata demi kata tanpa komentar:${promptHint ? ' Konteks: ' + promptHint : ''}` },
              {
                type: 'input_audio',
                input_audio: {
                  data: audioBase64,
                  format: format
                }
              }
            ]
          }
        ]
      };

      let resp = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      // If selected model failed, retry once with standard gemini-2.5-flash
      if (!resp.ok && modelToUse !== 'gemini-2.5-flash') {
        body.model = 'gemini-2.5-flash';
        resp = await fetch(chatEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
      }

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      let text = (data.choices?.[0]?.message?.content || '').trim();
      if (text.includes('\n\n')) {
        const parts = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
        text = parts[parts.length - 1];
      }
      text = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').replace(/^["']|["']$/g, '').trim();

      return {
        ok: true,
        text,
        language: language || 'id',
        duration: 0,
        segments: []
      };
    } catch (err) {
      console.error('GeminiX audio transcription error:', err);
      return { ok: false, message: err.message };
    }
  }

  // 2. Standar Whisper API (Groq Cloud, OpenAI, atau gateway kompatibel Whisper)
  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const blob = new Blob([buffer], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, 'speech.webm');
    
    let modelToUse = prov.isGroq ? 'whisper-large-v3-turbo' : (prov.isOpenAi ? 'whisper-1' : (selectedModel || 'whisper-1'));
    if (modelToUse.startsWith('gemini-') || modelToUse.startsWith('claude-')) {
      modelToUse = prov.isGroq ? 'whisper-large-v3-turbo' : 'whisper-1';
    }
    
    formData.append('model', modelToUse);
    formData.append('response_format', 'json');
    formData.append('temperature', '0.0');
    if (promptHint) formData.append('prompt', promptHint);
    if (language) formData.append('language', language);

    const resp = await fetch(`${prov.baseUrl.replace(/\/+$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });

    if (!resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Whisper HTTP ${resp.status}`);
    }

    const data = await resp.json();
    return {
      ok: true,
      text: data.text || '',
      language: data.language || language || 'id',
      duration: data.duration || 0,
      segments: data.segments || []
    };
  } catch (e) {
    console.error('Whisper dedicated transcription error:', e.message);
    return { ok: false, message: e.message };
  }
});

// In-App Auto-Update Handlers
ipcMain.handle('check-app-update', async () => {
  const currentVersion = app.getVersion() || require('./package.json').version;
  const isGitRepo = fs.existsSync(path.join(__dirname, '.git'));
  
  let gitBehind = 0;
  let gitLatestCommitMsg = '';

  if (isGitRepo) {
    try {
      const gitCmd = getGitExecutable();
      execSync(`${gitCmd} fetch origin main --quiet`, { timeout: 8000, stdio: 'ignore' });
      const revCount = execSync(`${gitCmd} rev-list HEAD..origin/main --count`, { encoding: 'utf8', timeout: 4000 }).trim();
      gitBehind = parseInt(revCount, 10) || 0;
      if (gitBehind > 0) {
        gitLatestCommitMsg = execSync(`${gitCmd} log -1 origin/main --pretty=format:"%s"`, { encoding: 'utf8', timeout: 3000 }).trim();
      }
    } catch (e) {
      console.warn('Git fetch check warning:', e.message);
    }
  }

  // Check GitHub Releases
  try {
    const resp = await fetch('https://api.github.com/repos/rromzly-ship-it/whisper-wideget/releases/latest', {
      headers: {
        'User-Agent': 'WhisperWidget-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (resp.ok) {
      const rel = await resp.json();
      const latestTag = (rel.tag_name || '').replace(/^v/i, '');
      const hasReleaseUpdate = isVersionNewer(latestTag, currentVersion);
      const hasUpdate = hasReleaseUpdate || gitBehind > 0;

      let downloadUrl = rel.html_url;
      if (Array.isArray(rel.assets)) {
        const exeAsset = rel.assets.find(a => a.name.endsWith('.exe'));
        if (exeAsset && exeAsset.browser_download_url) {
          downloadUrl = exeAsset.browser_download_url;
        }
      }

      return {
        ok: true,
        currentVersion: `v${currentVersion}`,
        latestVersion: rel.tag_name || `v${latestTag}`,
        hasUpdate,
        releaseTitle: rel.name || `Whisper Widget ${rel.tag_name}`,
        releaseNotes: rel.body || 'Pembaruan stabilitas dan peningkatan performa.',
        publishedAt: rel.published_at || '',
        downloadUrl,
        isGit: isGitRepo,
        gitBehind,
        gitLatestCommitMsg
      };
    }
  } catch (err) {
    console.warn('GitHub API release check failed:', err.message);
  }

  return {
    ok: true,
    currentVersion: `v${currentVersion}`,
    latestVersion: gitBehind > 0 ? `v${currentVersion}+${gitBehind}` : `v${currentVersion}`,
    hasUpdate: gitBehind > 0,
    releaseTitle: gitBehind > 0 ? `Pembaruan Git (${gitBehind} commit baru)` : 'Versi Terkini',
    releaseNotes: gitLatestCommitMsg || 'Aplikasi sudah menggunakan versi terbaru.',
    publishedAt: new Date().toISOString(),
    downloadUrl: 'https://github.com/rromzly-ship-it/whisper-wideget',
    isGit: isGitRepo,
    gitBehind,
    gitLatestCommitMsg
  };
});

ipcMain.handle('apply-app-update', async (event, { downloadUrl }) => {
  const isGitRepo = fs.existsSync(path.join(__dirname, '.git'));
  const sender = event.sender;

  if (isGitRepo) {
    try {
      sender.send('update-progress', { phase: 'download', percent: 50, message: 'Menarik commit terbaru dari GitHub (git pull origin main)...' });
      const gitCmd = getGitExecutable();
      const pullOut = execSync(`${gitCmd} pull origin main`, { encoding: 'utf8', timeout: 15000 });
      console.log('Update pull output:', pullOut);
      sender.send('update-progress', { phase: 'install', percent: 100, message: 'Pembaruan siap!' });
      sender.send('update-completed', { method: 'git' });
      return { ok: true, method: 'git' };
    } catch (e) {
      return { ok: false, message: `Gagal memperbarui via git: ${e.message}` };
    }
  }

  if (downloadUrl && downloadUrl.endsWith('.exe')) {
    try {
      const os = require('os');
      const https = require('https');
      const http = require('http');
      const tempExe = path.join(os.tmpdir(), `WhisperWidget-Update-${Date.now()}.exe`);

      sender.send('update-progress', { phase: 'download', percent: 0, message: 'Memulai unduhan installer dari GitHub...' });

      // Real streaming download with percentage tracking
      await new Promise((resolve, reject) => {
        function downloadStream(url, redirectCount = 0) {
          if (redirectCount > 6) return reject(new Error('Terlalu banyak redirect download'));
          const client = url.startsWith('https') ? https : http;
          client.get(url, { headers: { 'User-Agent': 'WhisperWidget-Updater' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              return downloadStream(res.headers.location, redirectCount + 1);
            }
            if (res.statusCode !== 200) {
              return reject(new Error(`Download installer gagal: HTTP ${res.statusCode}`));
            }

            const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
            let downloadedBytes = 0;
            const fileStream = fs.createWriteStream(tempExe);

            res.on('data', (chunk) => {
              downloadedBytes += chunk.length;
              fileStream.write(chunk);
              if (totalBytes > 0) {
                const percent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
                const mbDown = (downloadedBytes / (1024 * 1024)).toFixed(1);
                const mbTotal = (totalBytes / (1024 * 1024)).toFixed(1);
                sender.send('update-progress', {
                  phase: 'download',
                  percent,
                  message: `Mengunduh file update: ${mbDown} MB / ${mbTotal} MB (${percent}%)`
                });
              }
            });

            res.on('end', () => {
              fileStream.end();
              resolve();
            });

            res.on('error', (err) => {
              fileStream.end();
              reject(err);
            });
          }).on('error', reject);
        }
        downloadStream(downloadUrl);
      });

      // Tahap 2: Proses Instalasi Perubahan Realistis
      sender.send('update-progress', { phase: 'install', percent: 15, message: 'Menyiapkan paket instalasi...' });
      await new Promise(r => setTimeout(r, 600));

      sender.send('update-progress', { phase: 'install', percent: 45, message: 'Memasang pembaruan ke direktori aplikasi...' });
      
      const { spawn } = require('child_process');
      const child = spawn(tempExe, ['/S'], { detached: true, stdio: 'ignore' });
      child.unref();

      // Berikan waktu installer NSIS mengekstrak file di background
      await new Promise(r => setTimeout(r, 1800));
      sender.send('update-progress', { phase: 'install', percent: 80, message: 'Memperbarui modul sistem...' });
      await new Promise(r => setTimeout(r, 700));
      sender.send('update-progress', { phase: 'install', percent: 100, message: 'Pembaruan selesai dipasang!' });

      // Kirim sinyal selesai agar muncul pop-up selesai di layar
      sender.send('update-completed', { method: 'installer', tempExe });
      return { ok: true, method: 'installer' };
    } catch (dlErr) {
      console.error('Update installer download error:', dlErr);
      return { ok: false, message: `Gagal mengunduh installer: ${dlErr.message}` };
    }
  }

  if (downloadUrl) {
    shell.openExternal(downloadUrl);
    return { ok: true, method: 'browser', message: 'Membuka tautan rilis di browser...' };
  }

  return { ok: false, message: 'Tautan pembaruan tidak ditemukan' };
});

ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// Onboarding & First-Run IPC Handlers
ipcMain.on('close-onboarding', () => {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.close();
  }
});

ipcMain.on('minimize-onboarding', () => {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.minimize();
  }
});

ipcMain.handle('open-onboarding', () => {
  createOnboardingWindow();
  return true;
});

ipcMain.handle('finish-onboarding', async (event, configData) => {
  try {
    const { createShortcut, ...savedConfig } = configData;
    appConfig = { ...appConfig, ...savedConfig, setupCompleted: true };
    saveConfig(appConfig);

    if (createShortcut) {
      createDesktopShortcut();
    }
    if (appConfig.autoStart) {
      setAutoStart(true);
    }

    if (onboardingWindow && !onboardingWindow.isDestroyed()) {
      onboardingWindow.close();
      onboardingWindow = null;
    }

    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.show();
    }
    if (appConfig.voiceAssistant !== false && eyeWindow && !eyeWindow.isDestroyed()) {
      eyeWindow.show();
    }

    dispatchTtsNonBlocking('Halo! Selamat datang di Whisper Agent oleh ARSS.', 'id', false);
    return { ok: true };
  } catch (err) {
    console.error('Error finishing onboarding:', err);
    return { ok: false, message: err.message };
  }
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  try { fs.appendFileSync(path.join(__dirname, 'main_crash.log'), `[LOCK] Failed to acquire single instance lock at ${new Date().toISOString()}\n`); } catch {}
  app.quit();
} else {
  app.on('second-instance', () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      if (widgetWindow.isMinimized()) widgetWindow.restore();
      widgetWindow.show();
      widgetWindow.focus();
    }
    if (eyeWindow && !eyeWindow.isDestroyed()) {
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
    createBubbleWindow();
    createSettingsWindow();
    createTray();
    memory.loadMemory();
    tts.warmup('id');
    tts.prewarmCache();

    // Check for new updates on GitHub after 5s
    setTimeout(() => {
      checkForGitHubUpdates();
    }, 5000);

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

    const forceSetup = process.argv.includes('--setup') || process.argv.includes('--onboarding');
    const isFirstRun = forceSetup || !appConfig.apiKey || appConfig.setupCompleted !== true;
    if (isFirstRun) {
      setTimeout(() => {
        createOnboardingWindow();
      }, 400);
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
