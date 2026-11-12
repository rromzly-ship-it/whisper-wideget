const { shell, app, clipboard, screen } = require('electron');
const { execFile, execFileSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { captureDesktopWithGrid, locateTargetWithVision, inspectScreenWithVision, glideWisToTarget } = require('./vision');
const memory = require('./memory');
const usage = require('./usage');
const { tryMatchFastSkill, getPromptSkillModules, listAllSkills } = require('./skills/index');

const injectorPath = path.join(__dirname, 'injector.exe');
const wordHelperPath = path.join(__dirname, 'word-helper.ps1');

const appPathCache = new Map();

function logAssistant(msg) {
  try {
    const logPath = path.join(app.getPath('userData'), 'assistant.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
  } catch {}
}

function resolveAppPathFromRegistry(exeName) {
  const key = exeName.toLowerCase();
  if (appPathCache.has(key)) return appPathCache.get(key);

  for (const hive of ['HKLM', 'HKCU']) {
    try {
      const out = execFileSync(
        'reg.exe',
        ['query', `${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`, '/ve'],
        { encoding: 'utf8', timeout: 1500, windowsHide: true }
      );
      const match = out.match(/REG_(?:EXPAND_)?SZ\s+(.+)/);
      if (match && match[1]) {
        const resolved = match[1].trim().replace(/^"|"$/g, '');
        if (resolved && fs.existsSync(resolved)) {
          appPathCache.set(key, resolved);
          return resolved;
        }
      }
    } catch {}
  }

  appPathCache.set(key, null);
  return null;
}

function launchExecutable(exeCmd) {
  const resolved = resolveAppPathFromRegistry(exeCmd);
  if (resolved) {
    spawn(resolved, [], { detached: true, stdio: 'ignore' }).unref();
    return true;
  }
  // Use Windows cmd start (ShellExecute semantics) for System32 / App Paths tools
  spawn('cmd.exe', ['/c', 'start', '', exeCmd], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref();
  return true;
}

// Built-in safe Windows commands/apps
const BUILTIN_APPS = {
  'calculator': 'calc.exe',
  'kalkulator': 'calc.exe',
  'notepad': 'notepad.exe',
  'catatan': 'notepad.exe',
  'paint': 'mspaint.exe',
  'file explorer': 'explorer.exe',
  'explorer': 'explorer.exe',
  'cmd': 'cmd.exe',
  'command prompt': 'cmd.exe',
  'powershell': 'powershell.exe',
  'terminal': 'wt.exe',
  'task manager': 'taskmgr.exe',
  'control panel': 'control.exe',
  'settings': 'ms-settings:',
  'pengaturan windows': 'ms-settings:',
  'snipping tool': 'snippingtool.exe',
  'screenshot': 'ms-screenclip:',
  'word': 'winword.exe',
  'microsoft word': 'winword.exe',
  'excel': 'excel.exe',
  'microsoft excel': 'excel.exe',
  'powerpoint': 'powerpnt.exe',
  'chrome': 'chrome.exe',
  'google chrome': 'chrome.exe',
  'edge': 'msedge.exe'
};

// Short conversational memory across sequential voice commands
const sessionMemory = {
  history: [], // { user, result }
  lastApp: ''
};

function recordSession(userText, resultMsg, activeApp, mainAction) {
  sessionMemory.history.push({ user: userText, result: resultMsg });
  if (sessionMemory.history.length > 4) {
    sessionMemory.history.shift();
  }
  if (activeApp) {
    sessionMemory.lastApp = activeApp;
  }
  memory.recordHistory({
    user: userText,
    summary: resultMsg,
    app: activeApp,
    action: mainAction
  });
}

function getSpecialFolders() {
  return {
    temp: os.tmpdir(),
    downloads: app.getPath('downloads'),
    documents: app.getPath('documents'),
    desktop: app.getPath('desktop'),
    pictures: app.getPath('pictures'),
    music: app.getPath('music'),
    videos: app.getPath('videos'),
    appdata: app.getPath('appData'),
    localappdata: process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  };
}

let cachedApps = null;
let cacheAppsTimestamp = 0;

function scanStartMenuDir(dir, results) {
  if (!dir || !fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanStartMenuDir(fullPath, results);
      } else if (entry.isFile() && /\.(lnk|url|appref-ms)$/i.test(entry.name)) {
        const cleanName = entry.name.replace(/\.(lnk|url|appref-ms)$/i, '').trim();
        if (/uninstall|hapus|readme|help|manual|documentation/i.test(cleanName)) continue;
        if (!results.has(cleanName.toLowerCase())) {
          results.set(cleanName.toLowerCase(), { name: cleanName, path: fullPath });
        }
      }
    }
  } catch (e) {}
}

function getInstalledApps() {
  const now = Date.now();
  if (cachedApps && now - cacheAppsTimestamp < 60000) {
    return cachedApps;
  }

  const appMap = new Map();
  const startMenuDirs = [
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  ];

  for (const dir of startMenuDirs) {
    scanStartMenuDir(dir, appMap);
  }

  cachedApps = Array.from(appMap.values());
  cacheAppsTimestamp = now;
  return cachedApps;
}

let cachedDocs = null;
let cacheDocsTimestamp = 0;

function scanDocsDir(dir, depth, results) {
  if (!dir || !fs.existsSync(dir) || depth > 2) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('~$') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDocsDir(fullPath, depth + 1, results);
      } else if (entry.isFile() && /\.(docx|doc|rtf|txt|pdf|xlsx|pptx)$/i.test(entry.name)) {
        results.push({
          name: entry.name,
          stem: entry.name.replace(/\.[^.]+$/, '').toLowerCase(),
          path: fullPath
        });
      }
    }
  } catch (e) {}
}

function getUserDocuments() {
  const now = Date.now();
  if (cachedDocs && now - cacheDocsTimestamp < 30000) {
    return cachedDocs;
  }
  const results = [];
  const dirs = [app.getPath('documents'), app.getPath('desktop'), app.getPath('downloads')];
  for (const d of dirs) {
    scanDocsDir(d, 0, results);
  }
  cachedDocs = results;
  cacheDocsTimestamp = now;
  return cachedDocs;
}

function findBestDocument(query, wordOnly = false) {
  const docs = getUserDocuments().filter(d => !wordOnly || /\.(docx|doc|rtf)$/i.test(d.name));
  const tokens = String(query || '').toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let best = null;
  let bestScore = 0;

  for (const doc of docs) {
    let score = 0;
    const stem = doc.stem;
    if (stem === tokens.join(' ')) score += 100;
    if (stem.includes(tokens.join(' '))) score += 50;
    for (const tok of tokens) {
      if (stem.includes(tok)) score += 15;
    }
    if (wordOnly && /\.docx$/i.test(doc.name)) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = doc;
    }
  }
  return bestScore > 0 ? best : null;
}

function runInjector(args, timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (!fs.existsSync(injectorPath)) {
      resolve({ ok: false, stdout: '' });
      return;
    }
    execFile(injectorPath, args, { encoding: 'utf8', timeout: timeoutMs }, (err, stdout) => {
      resolve({ ok: !err, stdout: (stdout || '').trim() });
    });
  });
}

async function listRunningWindows() {
  const res = await runInjector(['list'], 3000);
  if (!res.ok || !res.stdout) return [];
  try {
    const parsed = JSON.parse(res.stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let cachedChromeTabs = [];
let cacheChromeTabsTs = 0;
let chromeTabsInFlight = null;

async function listChromeTabs(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && cachedChromeTabs.length > 0 && (now - cacheChromeTabsTs) < 12000) {
    return cachedChromeTabs;
  }
  if (chromeTabsInFlight) {
    return chromeTabsInFlight;
  }
  chromeTabsInFlight = (async () => {
    const res = await runInjector(['chrome_tabs'], 3000);
    if (!res.ok || !res.stdout) return [];
    try {
      const parsed = JSON.parse(res.stdout);
      const list = Array.isArray(parsed) ? parsed : [];
      cachedChromeTabs = list;
      cacheChromeTabsTs = Date.now();
      return list;
    } catch {
      return [];
    }
  })().finally(() => {
    chromeTabsInFlight = null;
  });
  return chromeTabsInFlight;
}

function runWordHelper(action, params = {}) {
  return new Promise((resolve) => {
    if (!fs.existsSync(wordHelperPath)) {
      resolve({ ok: false, message: 'word-helper.ps1 tidak ditemukan' });
      return;
    }
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wordHelperPath, '-Action', action];
    if (params.filePath) args.push('-FilePath', params.filePath);
    if (params.text !== undefined) {
      const b64 = Buffer.from(String(params.text), 'utf8').toString('base64');
      args.push('-TextB64', b64);
    }
    if (params.mode) args.push('-Mode', params.mode);

    execFile('powershell.exe', args, { encoding: 'utf8', timeout: 20000 }, (err, stdout, stderr) => {
      const out = (stdout || '').trim();
      if (out) {
        try {
          const parsed = JSON.parse(out.split(/\r?\n/).pop());
          resolve(parsed);
          return;
        } catch {}
      }
      resolve({ ok: false, message: err ? (stderr || err.message) : 'Gagal menjalankan aksi Word' });
    });
  });
}

function parseRetryAfterMs(errMsg) {
  const m = String(errMsg || '').match(/try again in ([\d.]+)\s*(ms|s)\b/i);
  if (!m) return 0;
  const val = parseFloat(m[1]);
  return m[2].toLowerCase() === 's' ? Math.ceil(val * 1000) : Math.ceil(val);
}

async function callGroqChat({ apiKey, model, systemPrompt, userPrompt, jsonMode = false, maxTokens = 550, _attempt = 0, onUsage = null, phase = 'planner' }) {
  const activeModel = model || 'openai/gpt-oss-20b';
  const body = {
    model: activeModel,
    reasoning_effort: 'low',
    temperature: jsonMode ? 0 : 0.3,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || `HTTP ${response.status}`;

    if (response.status === 429) {
      usage.recordRateLimitError({ apiKey, model: activeModel, errMsg, headers: response.headers });
    }

    if (response.status === 429 && _attempt < 2) {
      if (_attempt === 0) {
        const nextModel = activeModel === 'openai/gpt-oss-20b' ? 'openai/gpt-oss-120b' : 'openai/gpt-oss-20b';
        return await callGroqChat({ apiKey, model: nextModel, systemPrompt, userPrompt, jsonMode, maxTokens, _attempt: 1, onUsage, phase });
      }
      const waitMs = parseRetryAfterMs(errMsg);
      if (waitMs > 0 && waitMs <= 3500) {
        await new Promise(r => setTimeout(r, waitMs + 140));
        return await callGroqChat({ apiKey, model: 'openai/gpt-oss-20b', systemPrompt, userPrompt, jsonMode, maxTokens, _attempt: 2, onUsage, phase });
      }
    }
    if (_attempt === 0 && activeModel !== 'openai/gpt-oss-20b') {
      return await callGroqChat({ apiKey, model: 'openai/gpt-oss-20b', systemPrompt, userPrompt, jsonMode, maxTokens, _attempt: 1, onUsage, phase });
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  if (data.usage) {
    const usedModel = data.model || activeModel;
    usage.recordLlmCall({ apiKey, model: usedModel, phase, usage: data.usage, headers: response.headers });
    onUsage?.({ phase, model: usedModel, usage: data.usage });
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Respons AI kosong');
  return content.trim();
}

async function probeApiQuota(apiKey) {
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error('API Key belum diisi');
  }
  await callGroqChat({
    apiKey,
    model: 'openai/gpt-oss-20b',
    systemPrompt: 'Reply OK.',
    userPrompt: 'ping',
    jsonMode: false,
    maxTokens: 5,
    phase: 'probe'
  });
  return usage.getSummary(apiKey);
}

async function draftTextForDocument(instruction, apiKey, onUsage = null) {
  const sys = `Kamu adalah asisten penulis profesional berbahasa Indonesia dan Inggris.
Berdasarkan instruksi pengguna, tuliskan teks dokumen/catatan yang rapi, jelas, dan siap pakai di Microsoft Word.
Keluarkan HANYA isi teks dokumennya saja tanpa kata pengantar atau markdown code block.`;
  return await callGroqChat({
    apiKey,
    model: 'openai/gpt-oss-120b',
    systemPrompt: sys,
    userPrompt: instruction,
    jsonMode: false,
    maxTokens: 1200,
    onUsage,
    phase: 'word'
  });
}

async function improveDocumentText(originalText, instruction, apiKey, onUsage = null) {
  const sys = `Kamu adalah editor dokumen profesional berbahasa Indonesia dan Inggris.
Tugasmu memperbaiki atau merevisi teks dokumen sesuai permintaan pengguna (memperbaiki typo, ejaan, tata bahasa, atau struktur kalimat).
Pertahankan makna asli dan keluarkan HANYA hasil teks dokumen yang sudah diperbaiki tanpa penjelasan tambahan.`;
  const userMsg = `Instruksi perbaikan: ${instruction}\n\nTeks dokumen saat ini:\n"""\n${originalText.slice(0, 12000)}\n"""`;
  return await callGroqChat({
    apiKey,
    model: 'openai/gpt-oss-120b',
    systemPrompt: sys,
    userPrompt: userMsg,
    jsonMode: false,
    maxTokens: 2000,
    onUsage,
    phase: 'word'
  });
}

function sanitizeForSpeech(text) {
  return String(text || '')
    .replace(/[*_`~#]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function gridPctToScreenCoords(bounds, xPct, yPct) {
  const targetDipX = Math.round(bounds.x + (bounds.width * Number(xPct)) / 100);
  const targetDipY = Math.round(bounds.y + (bounds.height * Number(yPct)) / 100);
  const phys = screen.dipToScreenPoint({ x: targetDipX, y: targetDipY });
  return {
    targetDipX,
    targetDipY,
    physX: Math.round(phys.x),
    physY: Math.round(phys.y)
  };
}

async function glideAndActOnVisualTarget(targetDescription, apiKey, runtimeCtx, actionCallback) {
  const ctx = runtimeCtx || {};
  const { dataUrl, bounds, uiContext } = await captureDesktopWithGrid(ctx.eyeWindow, ctx.widgetWindow);
  memory.setScreenSnapshot(uiContext);
  const loc = await locateTargetWithVision(targetDescription, dataUrl, apiKey, uiContext, ctx.onUsage || null);
  logAssistant(`Vision locate("${targetDescription}") uiEls=${uiContext?.elements?.length || 0} -> ${JSON.stringify(loc)} bounds=${JSON.stringify(bounds)}`);
  if (!loc || !loc.found) {
    return {
      ok: false,
      message: (loc && loc.reason) || `Elemen "${targetDescription}" tidak terlihat di layar`
    };
  }

  const coords = gridPctToScreenCoords(bounds, loc.x_pct, loc.y_pct);
  logAssistant(`Vision glide -> dip(${coords.targetDipX},${coords.targetDipY}) phys(${coords.physX},${coords.physY})`);
  let actionResult = { ok: true, message: `Mengklik ${loc.label || targetDescription}` };

  await glideWisToTarget({
    eyeWindow: ctx.eyeWindow,
    widgetWindow: ctx.widgetWindow,
    targetDipX: coords.targetDipX,
    targetDipY: coords.targetDipY,
    eyeOffsetX: ctx.eyeOffsetX ?? 8,
    eyeOffsetY: ctx.eyeOffsetY ?? -46,
    onArrive: async () => {
      actionResult = await actionCallback(coords, loc);
    }
  });

  return actionResult;
}

const APP_PROCESS_ALIASES = {
  chrome: ['chrome', 'google chrome'],
  edge: ['msedge', 'microsoft edge'],
  msedge: ['msedge', 'microsoft edge'],
  word: ['winword', 'microsoft word'],
  winword: ['winword', 'microsoft word'],
  excel: ['excel', 'microsoft excel'],
  powerpoint: ['powerpnt', 'powerpoint'],
  corel: ['coreldrw', 'coreldraw'],
  coreldraw: ['coreldrw', 'coreldraw'],
  photoshop: ['photoshop', 'adobe photoshop'],
  illustrator: ['illustrator', 'adobe illustrator'],
  vscode: ['code', 'visual studio code'],
  code: ['code', 'visual studio code'],
  explorer: ['explorer', 'file explorer'],
  whatsapp: ['whatsapp'],
  telegram: ['telegram'],
  discord: ['discord'],
  spotify: ['spotify'],
  notepad: ['notepad'],
  cmd: ['cmd', 'windowsterminal', 'powershell']
};

function findMatchingRunningWindow(appQuery, visibleWindows) {
  if (!appQuery || !Array.isArray(visibleWindows) || visibleWindows.length === 0) return null;
  const raw = String(appQuery).toLowerCase().trim();
  const baseWords = raw
    .replace(/\b(20\d\d|app|aplikasi|microsoft|adobe|windows)\b/g, ' ')
    .split(/[\s\-_]+/)
    .filter(w => w.length >= 2);

  const candidates = new Set([raw, ...baseWords]);
  for (const key of [raw, ...baseWords]) {
    if (APP_PROCESS_ALIASES[key]) {
      APP_PROCESS_ALIASES[key].forEach(a => candidates.add(a));
    }
  }

  let best = null;
  let bestScore = 0;
  for (const w of visibleWindows) {
    const proc = String(w.process || '').toLowerCase();
    const title = String(w.title || '').toLowerCase();
    let score = 0;
    for (const c of candidates) {
      if (proc === c) score += 120;
      else if (proc && (proc.includes(c) || c.includes(proc))) score += 85;
      if (title.includes(c)) score += 60;
    }
    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  }
  return bestScore >= 60 ? best : null;
}

async function planCommandWithGroq(transcript, apiKey, onUsage = null) {
  const lowT = String(transcript || '').toLowerCase();

  // Intent signals for Progressive Skill Disclosure & Volatile Context Pruning
  const needWord = /\b(word|dokumen|surat|catat|tugas|laporan|revisi|perbaiki|typo|simpan|\.doc|\.pdf)\b/i.test(lowT);
  const needVision = /\b(klik|pencet|tekan|pilih|lihat|layar|ada apa|baca|gambar|video|thumbnail|kolom|tulis di|ketik di|profil|akun|tombol|album|channel|komentar|atas|bawah|kanan|kiri)\b/i.test(lowT);
  const needBrowser = /\b(tab|chrome|youtube|yutub|browser|web|situs|halaman|cari|tonton|whatsapp|meet|link|google|buka\.com)\b/i.test(lowT);
  const needWindowOrApp = /\b(buka|jalankan|pindah|ganti|tutup|close|minimize|maximize|fullscreen|layar penuh|restore|kecilkan|besarkan|jendela|aplikasi|app|alt.?tab|task)\b/i.test(lowT);
  const needSys = /\b(folder|downloads?|documents?|desktop|pictures?|music|videos?|appdata|temp|recycle|sampah|alt.?tab|task.?view|jendela|tunggu)\b/i.test(lowT);
  const needMemory = /\b(ingat|belajar|pelajari|alias|skill|lupa|maksudnya|kalau bilang|arti)\b/i.test(lowT);

  const [runningWindows, chromeTabs, fgRes] = await Promise.all([
    listRunningWindows(),
    needBrowser ? listChromeTabs() : Promise.resolve([]),
    runInjector(['get'], 1000).catch(() => ({ ok: false, stdout: '' }))
  ]);
  const installedApps = needWindowOrApp ? getInstalledApps() : [];
  const userDocs = needWord ? getUserDocuments().slice(0, 8).map(d => d.name) : [];

  const visibleWindows = runningWindows.filter(
    w => !/^(Whisper Widget|Menu Widget|Pengaturan .*|Karakter Mata|Whisper Agent.*|Wis Grid Canvas)$/i.test(w.title)
  );

  const fgHwnd = Number(String(fgRes?.stdout || '').trim());
  const fgWin = fgHwnd ? visibleWindows.find(w => Number(w.hwnd) === fgHwnd) : null;
  if (fgWin) {
    memory.setActiveApp({ process: fgWin.process, title: fgWin.title });
    sessionMemory.lastApp = `${fgWin.process} (${fgWin.title})`;
  }

  const memCtx = memory.getPromptContext(transcript);
  const activeAppDesc = fgWin
    ? `${fgWin.process}|${fgWin.title.slice(0, 42)}`
    : (memCtx.activeApp ? `${memCtx.activeApp.process}|${String(memCtx.activeApp.title || '').slice(0, 42)}` : '-');

  // Volatile context pruning: send up to 9 windows only when switching/opening apps, else top 3
  const maxWin = needWindowOrApp ? 9 : 3;
  const windowLines = visibleWindows.slice(0, maxWin).map(
    w => `${w.hwnd}|${w.process}|${w.title.slice(0, 28)}`
  );

  const tabLines = needBrowser
    ? chromeTabs.slice(0, 5).map(t => (typeof t === 'string' ? t : (t.name || '')).slice(0, 28)).filter(Boolean)
    : [];

  let appNames = [];
  if (needWindowOrApp) {
    const transcriptWords = lowT.split(/\s+/).filter(w => w.length > 2);
    const aliasWords = memCtx.matchedAliases.flatMap(m => m.target.toLowerCase().split(/\s+/));
    const lookupWords = [...transcriptWords, ...aliasWords];
    const matchedApps = installedApps
      .filter(a => lookupWords.some(w => a.name.toLowerCase().includes(w)))
      .map(a => a.name);
    const canonicalBuiltin = ['Chrome', 'Edge', 'Word', 'Excel', 'Calculator', 'Notepad', 'File Explorer', 'Terminal', 'Settings'];
    appNames = Array.from(new Set([...matchedApps, ...canonicalBuiltin])).slice(0, 12);
  }

  // Progressive Skill Disclosure via modular registry in ./skills
  const forceAllOrVision = memCtx.matchedSkills.length > 0 || (!needWord && !needWindowOrApp && !needMemory && !needSys);
  const skillModules = getPromptSkillModules(lowT, forceAllOrVision);

  // Stable Prefix (Prompt-Cache friendly) -> Volatile Suffix at the bottom
  const contextLines = [
    `Aktif: ${activeAppDesc}`,
    windowLines.length ? `Win: ${windowLines.join('; ')}` : '',
    tabLines.length ? `Tabs: ${tabLines.join(' | ')}` : '',
    (needVision && memCtx.freshScreen) ? `Layar(${memCtx.freshScreen.title.slice(0, 30)}): ${memCtx.freshScreen.items.join(' | ')}` : '',
    userDocs.length ? `Docs: ${userDocs.join(' | ')}` : '',
    appNames.length ? `Apps: ${appNames.join(', ')}` : '',
    memCtx.matchedAliases.length ? `Alias: ${memCtx.matchedAliases.map(a => `${a.spoken}->${a.target}`).join(', ')}` : '',
    memCtx.matchedSkills.length ? `Skill: ${JSON.stringify(memCtx.matchedSkills)}` : '',
    memCtx.facts.length ? `Fakta: ${memCtx.facts.join(' | ')}` : '',
    memCtx.recentHistory.length ? `Riwayat: ${memCtx.recentHistory.join(' ; ')}` : '',
    memCtx.tutorialGuide ? memCtx.tutorialGuide : ''
  ].filter(Boolean).join('\n');

  const systemPrompt = `Wis, asisten desktop Windows. Balas HANYA JSON:
{"steps":[...],"summary":"3-4 kata","replyLang":"id","reply":"Oke"}
Aksi Inti: chat_reply{reply} | open_app{appName} | open_url{url} | switch_window{hwnd,label} | window_control{op:"minimize|maximize|restore|fullscreen|close",hwnd?,label?} | hotkey{keys:"k|f|m|space|f11|browser_back|browser_forward|ctrl+w|ctrl+t|ctrl+tab|ctrl+shift+tab|media_play_pause|volume_mute|lain"} | scroll{direction:"down|up|left|right"} | scroll_auto{direction,speed:"slow|medium|fast"} | scroll_stop{} | zoom{mode:"in|out|reset"} | type_text{text} | unknown{reason}
${skillModules.length ? `Aksi Tambahan: ${skillModules.join(' | ')}\n` : ''}Aturan:
- EKSEKUSI LANGSUNG tanpa tanya balik/klarifikasi. Pertanyaan murni->chat_reply (dilarang steps:[]).
- reply:"Oke" utk aksi biasa (kalimat lengkap hanya utk chat_reply/vision_inspect/learn_skill).
- Media: pause/lanjut->hotkey:"k", mute->"m", fullscreen->"f". YouTube cari->open_url:"https://www.youtube.com/results?search_query=...".
- Browser: tab baru->"ctrl+t", tutup->"ctrl+w", kembali->"browser_back", pindah tab->chrome_select_tab.
- App di Win->switch_window atau open_app. Terapkan Alias jika cocok.

Konteks Saat Ini:
${contextLines}`;

  logAssistant(`Transcript: "${transcript}"`);

  const rawContent = await callGroqChat({
    apiKey,
    model: 'openai/gpt-oss-20b',
    systemPrompt,
    userPrompt: transcript,
    jsonMode: true,
    maxTokens: 500,
    onUsage,
    phase: 'planner'
  });

  logAssistant(`Plan: ${rawContent}`);

  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  const plan = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
  return { plan, visibleWindows, installedApps, chromeTabs };
}

const clarifyState = {
  active: false,
  count: 0,
  baseTranscript: '',
  lastQuestion: '',
  ts: 0
};

function resetClarifyState() {
  clarifyState.active = false;
  clarifyState.count = 0;
  clarifyState.baseTranscript = '';
  clarifyState.lastQuestion = '';
  clarifyState.ts = 0;
}

function tryLocalFastPlan(transcript) {
  return tryMatchFastSkill(transcript);
}

async function routeCommandWithGroq(transcript, apiKey, runtimeCtx = {}) {
  if (clarifyState.active && (Date.now() - clarifyState.ts > 60000)) {
    resetClarifyState();
  }

  const sc = runtimeCtx.scrollController;
  if (sc && sc.isScrolling() && /^(berhenti|stop|cukup|udah|sudah|diam|tahan|hold|pause)\b/i.test(String(transcript || '').trim())) {
    sc.stop();
    const isEn = /^(stop|hold|pause)\b/i.test(transcript.trim());
    const reply = isEn ? 'Okay, stopped scrolling.' : 'Oke.';
    logAssistant(`Fast-path scroll_stop on "${transcript}"`);
    return {
      ok: true,
      speakReply: false,
      message: reply,
      reply,
      replyLang: isEn ? 'en' : 'id',
      steps: [{ action: 'scroll_stop' }]
    };
  }

  const fastPlan = (!clarifyState.active) ? tryLocalFastPlan(transcript) : null;
  const exactSkill = (!fastPlan && !/\b(belajar|pelajari|hapus|lupa|bagaimana|gimana)\b/i.test(String(transcript || '')))
    ? memory.findExactSkill(transcript)
    : null;

  let plan;
  let visibleWindows = [];
  let installedApps = [];
  let chromeTabs = [];

  if (fastPlan) {
    logAssistant(`Zero-token fast-path[${fastPlan.skillId || 'local'}]: "${transcript}" -> ${fastPlan.steps[0]?.action}(${JSON.stringify(fastPlan.steps[0])})`);
    runtimeCtx.onStage?.(`Cepat (0 token): ${fastPlan.summary}`);
    if (fastPlan.steps.some(s => s.action === 'open_app' || s.action === 'switch_window')) {
      visibleWindows = (await listRunningWindows()).filter(
        w => !/^(Whisper Widget|Menu Widget|Pengaturan .*|Karakter Mata|Whisper Agent.*|Wis Grid Canvas)$/i.test(w.title)
      );
      installedApps = getInstalledApps();
    }
    plan = fastPlan;
  } else if (exactSkill && Array.isArray(exactSkill.steps) && exactSkill.steps.length > 0) {
    logAssistant(`Fast-path learned skill "${exactSkill.trigger}" -> ${exactSkill.steps.length} step(s)`);
    runtimeCtx.onStage?.(`Menjalankan skill terpelajari: ${exactSkill.trigger}`);
    visibleWindows = (await listRunningWindows()).filter(
      w => !/^(Whisper Widget|Menu Widget|Pengaturan .*|Karakter Mata|Whisper Agent.*|Wis Grid Canvas)$/i.test(w.title)
    );
    installedApps = getInstalledApps();
    chromeTabs = await listChromeTabs();
    plan = {
      steps: exactSkill.steps,
      summary: exactSkill.description || exactSkill.trigger,
      replyLang: 'id',
      reply: 'Oke'
    };
  } else {
    runtimeCtx.onStage?.('Memahami perintah (AI)...');
    const planned = await planCommandWithGroq(transcript, apiKey, runtimeCtx.onUsage || null);
    plan = planned.plan;
    visibleWindows = planned.visibleWindows;
    installedApps = planned.installedApps;
    chromeTabs = planned.chromeTabs;
  }

  const steps = Array.isArray(plan.steps) ? plan.steps : (plan.action ? [plan] : []);

  if (steps.length === 0) {
    const isEn = plan.replyLang === 'en';
    const fallbackReply = sanitizeForSpeech(plan.reply) || (isEn ? "Sorry, I didn't catch that command." : 'Maaf, Wis belum menangkap perintah itu.');
    return { ok: false, speakReply: true, message: fallbackReply, reply: fallbackReply, replyLang: plan.replyLang || 'auto', steps: [] };
  }

  let lastResult = { ok: false, message: 'Perintah tidak dikenali' };
  let activeApp = sessionMemory.lastApp;

  for (let idx = 0; idx < steps.length; idx++) {
    const step = steps[idx];
    runtimeCtx.onStage?.(`Menjalankan (${idx + 1}/${steps.length}): ${plan.summary || step.action}`);
    if (step.action === 'vision_inspect' && !step.replyLang && plan.replyLang) {
      step.replyLang = plan.replyLang;
    }
    if (sc && sc.isScrolling() && step.action !== 'scroll_auto' && step.action !== 'chat_reply') {
      sc.stop();
    }
    lastResult = await executeStep(step, visibleWindows, installedApps, chromeTabs, apiKey, runtimeCtx);
    logAssistant(`Step ${idx + 1} (${step.action}): ok=${lastResult.ok} msg=${lastResult.message}`);

    if (step.action && step.action.startsWith('word_')) {
      activeApp = 'Word';
      memory.clearScreenSnapshot();
    } else if (step.action === 'chrome_select_tab' || step.action === 'open_url' || step.action === 'youtube_search') {
      activeApp = 'Browser';
      memory.clearScreenSnapshot();
    } else if (step.action === 'open_app' || step.action === 'switch_window' || step.action === 'open_folder') {
      memory.clearScreenSnapshot();
      activeApp = step.label || step.appName || activeApp;
    } else if (step.action && step.action.startsWith('vision_')) {
      activeApp = activeApp || 'Desktop';
    } else if (step.label) {
      activeApp = step.label;
    } else if (step.appName) {
      activeApp = step.appName;
    }

    if (!lastResult.ok) {
      resetClarifyState();
      const errSpeech = sanitizeForSpeech(lastResult.message || 'Gagal menjalankan perintah.');
      return { ok: false, speakReply: true, message: lastResult.message, reply: errSpeech, replyLang: plan.replyLang || 'auto', steps };
    }
    if (idx < steps.length - 1) {
      const waitMs = step.action === 'open_url'
        ? 1800
        : (step.action === 'open_app' ? 600 : (step.action === 'hotkey' ? 60 : 240));
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  resetClarifyState();

  const userAskedSpeech = /\b(jelaskan|kenapa|bagaimana|gimana|apa saja|baca|lihat layar|ada apa)\b/i.test(transcript);
  const speakReply = Boolean(lastResult.isChat || userAskedSpeech);

  const finalMessage = lastResult.isChat
    ? lastResult.message
    : (plan.summary || lastResult.message);
  const replyText = sanitizeForSpeech(
    lastResult.isChat
      ? lastResult.message
      : (plan.reply || 'Oke')
  );

  recordSession(transcript, finalMessage, activeApp, steps[0]?.action || '');
  return { ok: true, speakReply, message: finalMessage, reply: replyText, replyLang: plan.replyLang || 'auto', steps };
}

async function executeStep(step, visibleWindows, installedApps, chromeTabs, apiKey, runtimeCtx = {}) {
  if (!step || !step.action) {
    return { ok: false, message: 'Langkah perintah tidak valid' };
  }

  switch (step.action) {
    case 'chat_reply': {
      const reply = String(step.reply || '').trim();
      return { ok: true, isChat: true, message: reply || 'Halo, ada yang bisa Wis bantu?' };
    }

    case 'vision_inspect': {
      const question = String(step.question || step.targetDescription || 'Jelaskan apa yang terlihat di layar saat ini').trim();
      const ctx = runtimeCtx || {};
      const { dataUrl, uiContext } = await captureDesktopWithGrid(ctx.eyeWindow, ctx.widgetWindow);
      memory.setScreenSnapshot(uiContext);
      const answer = await inspectScreenWithVision(question, dataUrl, apiKey, uiContext, step.replyLang || 'id', ctx.onUsage || null);
      return { ok: true, isChat: true, message: answer || 'Wis sudah melihat layar, ada bagian tertentu yang mau diklik?' };
    }

    case 'vision_click': {
      const desc = String(step.targetDescription || step.label || '').trim();
      if (!desc) return { ok: false, message: 'Target klik visual tidak disebutkan' };
      const clickType = ['left', 'right', 'double'].includes(String(step.clickType || '').toLowerCase())
        ? String(step.clickType).toLowerCase()
        : 'left';
      return await glideAndActOnVisualTarget(desc, apiKey, runtimeCtx, async (coords, loc) => {
        const res = await runInjector(['mouse_click', String(coords.physX), String(coords.physY), clickType], 3500);
        return res.stdout === 'OK'
          ? { ok: true, message: `Mengklik ${loc.label || desc}` }
          : { ok: false, message: `Gagal mengklik ${loc.label || desc}` };
      });
    }

    case 'vision_click_and_type': {
      const desc = String(step.targetDescription || 'kolom input pencarian').trim();
      let text = String(step.text || '').trim();
      if (/telusuri|pencarian|search|youtube/i.test(desc)) {
        for (const hit of memory.findMatchingAliases(text)) {
          const escaped = hit.spoken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), hit.target);
        }
      }
      if (!text) return { ok: false, message: 'Teks yang ingin diketik kosong' };
      const shouldEnter = step.pressEnter !== false;
      return await glideAndActOnVisualTarget(desc, apiKey, runtimeCtx, async (coords, loc) => {
        const clickRes = await runInjector(['mouse_click', String(coords.physX), String(coords.physY), 'left'], 3500);
        if (clickRes.stdout !== 'OK') {
          return { ok: false, message: `Gagal mengklik ${loc.label || desc}` };
        }
        await new Promise(r => setTimeout(r, 160));
        const focusCheck = await runInjector(['is_edit_focused'], 1200);
        if (focusCheck.stdout === 'OK') {
          await runInjector(['hotkey', 'ctrl+a'], 2000);
        } else {
          logAssistant(`is_edit_focused=NO before typing "${text}" into "${loc.label || desc}", skipping Ctrl+A`);
        }
        clipboard.writeText(text);
        await runInjector([], 3000);
        if (shouldEnter) {
          await new Promise(r => setTimeout(r, 80));
          await runInjector(['hotkey', 'enter'], 2000);
        }
        return { ok: true, message: `Mengetik "${text}" di ${loc.label || desc}` };
      });
    }

    case 'vision_scroll': {
      const dir = String(step.direction || 'down').trim().toLowerCase();
      const desc = String(step.targetDescription || '').trim();
      if (desc && (dir === 'down' || dir === 'up')) {
        return await glideAndActOnVisualTarget(desc, apiKey, runtimeCtx, async (coords, loc) => {
          runtimeCtx.scrollController?.notifyEyeAnim?.({ type: 'scroll-single', direction: dir });
          const res = await runInjector(['scroll_at', String(coords.physX), String(coords.physY), dir], 3500);
          return res.stdout === 'OK'
            ? { ok: true, message: `Menggulir ${loc.label || desc} ke ${dir === 'up' ? 'atas' : 'bawah'}` }
            : { ok: false, message: 'Gagal menggulir area layar' };
        });
      }
      runtimeCtx.scrollController?.notifyEyeAnim?.({ type: 'scroll-single', direction: dir });
      const res = await runInjector(['scroll', dir], 3000);
      return res.stdout === 'OK'
        ? { ok: true, message: `Menggulir ke ${dir}` }
        : { ok: false, message: `Arah gulir '${dir}' tidak dikenal` };
    }

    case 'switch_window': {
      const target = visibleWindows.find(w => Number(w.hwnd) === Number(step.hwnd))
        || findMatchingRunningWindow(step.label || step.appName || '', visibleWindows);
      if (!target) return { ok: false, message: 'Jendela tidak ditemukan' };
      const res = await runInjector(['focus', String(target.hwnd)]);
      if (res.ok) {
        memory.setActiveApp({ process: target.process, title: target.title });
      }
      return { ok: res.ok, message: res.ok ? `Pindah ke ${step.label || target.title}` : 'Gagal fokus jendela' };
    }

    case 'window_control': {
      const op = String(step.op || step.operation || 'minimize').trim().toLowerCase();
      let target = visibleWindows.find(w => Number(w.hwnd) === Number(step.hwnd));
      if (!target && (step.label || step.appName)) {
        target = findMatchingRunningWindow(step.label || step.appName, visibleWindows);
      }
      const hwndArg = target ? String(target.hwnd) : '0';
      const res = await runInjector(['window_control', op, hwndArg], 3000);
      const label = target ? (step.label || target.title) : 'jendela aktif';
      return res.stdout === 'OK'
        ? { ok: true, message: `${op} ${label}` }
        : { ok: false, message: `Gagal ${op} ${label}` };
    }

    case 'open_alt_tab': {
      const res = await runInjector(['alt_tab']);
      return { ok: res.ok, message: 'Menampilkan daftar jendela Alt+Tab' };
    }

    case 'open_task_view': {
      const res = await runInjector(['taskview']);
      return { ok: res.ok, message: 'Menampilkan semua jendela' };
    }

    case 'open_folder': {
      const key = String(step.target || '').toLowerCase();
      if (key === 'recycle_bin') {
        spawn('explorer.exe', ['shell:RecycleBinFolder'], { detached: true, stdio: 'ignore' }).unref();
        return { ok: true, message: 'Membuka Recycle Bin' };
      }
      const folders = getSpecialFolders();
      const folderPath = folders[key];
      if (!folderPath) return { ok: false, message: `Folder '${key}' tidak dikenal` };
      const errMsg = await shell.openPath(folderPath);
      return errMsg ? { ok: false, message: errMsg } : { ok: true, message: `Membuka folder ${key}` };
    }

    case 'open_app': {
      const requested = String(step.appName || '').trim().toLowerCase();
      if (!requested) return { ok: false, message: 'Nama aplikasi kosong' };

      if (!step.forceNew) {
        const existingWin = findMatchingRunningWindow(requested, visibleWindows);
        if (existingWin) {
          const focusRes = await runInjector(['focus', String(existingWin.hwnd)]);
          logAssistant(`Reused existing Alt-Tab window hwnd=${existingWin.hwnd} proc=${existingWin.process} title="${existingWin.title}" ok=${focusRes.ok}`);
          if (focusRes.ok) {
            memory.setActiveApp({ process: existingWin.process, title: existingWin.title });
          }
          return {
            ok: focusRes.ok,
            message: focusRes.ok ? `Pindah ke ${existingWin.title}` : `Gagal fokus ke ${existingWin.title}`
          };
        }
      }

      if (BUILTIN_APPS[requested]) {
        const cmd = BUILTIN_APPS[requested];
        if (cmd.endsWith(':')) {
          await shell.openExternal(cmd);
        } else {
          launchExecutable(cmd);
        }
        memory.setActiveApp({ process: cmd.replace(/\.exe$/i, ''), title: step.appName });
        return { ok: true, message: `Membuka ${step.appName}` };
      }

      const exact = installedApps.find(a => a.name.toLowerCase() === requested);
      const fuzzy = exact || installedApps.find(
        a => a.name.toLowerCase().includes(requested) || requested.includes(a.name.toLowerCase())
      );
      if (fuzzy) {
        const errMsg = await shell.openPath(fuzzy.path);
        if (!errMsg) {
          memory.setActiveApp({ process: fuzzy.name, title: fuzzy.name });
        }
        return errMsg ? { ok: false, message: errMsg } : { ok: true, message: `Membuka ${fuzzy.name}` };
      }
      return { ok: false, message: `Aplikasi '${step.appName}' tidak ditemukan` };
    }

    case 'wait_window': {
      const kw = String(step.keyword || '').trim();
      if (!kw) return { ok: true, message: 'Menunggu...' };
      const res = await runInjector(['wait_window', kw, '5000'], 6000);
      return { ok: res.stdout === 'OK', message: res.stdout === 'OK' ? `Jendela ${kw} siap` : `Waktu tunggu ${kw} habis` };
    }

    case 'open_url': {
      const rawUrl = String(step.url || '').trim();
      if (/^https?:\/\//i.test(rawUrl)) {
        await shell.openExternal(rawUrl);
        memory.setActiveApp({ process: 'chrome', title: rawUrl });
        return { ok: true, message: 'Membuka browser' };
      }
      return { ok: false, message: 'URL tidak valid' };
    }

    case 'chrome_select_tab': {
      const kw = String(step.keyword || '').trim();
      if (!kw) return { ok: false, message: 'Nama tab kosong' };
      const res = await runInjector(['chrome_select_tab', kw], 4000);
      if (res.stdout === 'OK') {
        memory.setActiveApp({ process: 'chrome', title: `${kw} - Google Chrome` });
      }
      return res.stdout === 'OK'
        ? { ok: true, message: `Pindah ke tab ${kw}` }
        : { ok: false, message: `Tab '${kw}' tidak ditemukan di Chrome` };
    }

    case 'youtube_search': {
      const query = String(step.query || '').trim();
      if (!query) return { ok: false, message: 'Kata pencarian YouTube kosong' };

      const hasYouTubeTab = Array.isArray(chromeTabs) && chromeTabs.some(
        t => (t.name || '').toLowerCase().includes('youtube')
      );
      if (hasYouTubeTab) {
        const sel = await runInjector(['chrome_select_tab', 'youtube'], 4000);
        if (sel.stdout === 'OK') {
          await new Promise(r => setTimeout(r, 120));
          await runInjector(['hotkey', 'slash'], 2000);
          await new Promise(r => setTimeout(r, 120));
          await runInjector(['hotkey', 'ctrl+a'], 2000);
          clipboard.writeText(query);
          await runInjector([], 3000);
          await new Promise(r => setTimeout(r, 80));
          await runInjector(['hotkey', 'enter'], 2000);
          return { ok: true, message: `Mencari "${query}" di YouTube` };
        }
      }

      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      await shell.openExternal(url);
      return { ok: true, message: `Membuka pencarian YouTube "${query}"` };
    }

    case 'scroll': {
      const dir = String(step.direction || 'down').trim().toLowerCase();
      runtimeCtx.scrollController?.notifyEyeAnim?.({ type: 'scroll-single', direction: dir });
      const res = await runInjector(['scroll', dir], 3000);
      return res.stdout === 'OK'
        ? { ok: true, message: `Menggulir ke ${dir}` }
        : { ok: false, message: `Arah gulir '${dir}' tidak dikenal` };
    }

    case 'scroll_auto': {
      const dir = ['down', 'up', 'left', 'right'].includes(String(step.direction || '').toLowerCase())
        ? String(step.direction).toLowerCase()
        : 'down';
      const speed = ['slow', 'medium', 'fast'].includes(String(step.speed || '').toLowerCase())
        ? String(step.speed).toLowerCase()
        : 'slow';
      if (!runtimeCtx.scrollController) {
        return { ok: false, message: 'Kontrol auto-scroll tidak tersedia' };
      }
      runtimeCtx.scrollController.start(dir, speed);
      return { ok: true, message: `Scroll otomatis ${dir} (${speed})` };
    }

    case 'scroll_stop': {
      if (runtimeCtx.scrollController) {
        runtimeCtx.scrollController.stop();
      }
      return { ok: true, message: 'Auto-scroll dihentikan' };
    }

    case 'zoom': {
      const mode = ['in', 'out', 'reset'].includes(String(step.mode || '').toLowerCase())
        ? String(step.mode).toLowerCase()
        : 'in';
      runtimeCtx.scrollController?.notifyEyeAnim?.({ type: 'zoom', mode });
      const key = mode === 'in' ? 'ctrl+plus' : (mode === 'out' ? 'ctrl+minus' : 'ctrl+0');
      const res = await runInjector(['hotkey', key], 3000);
      return res.stdout === 'OK'
        ? { ok: true, message: `Zoom ${mode}` }
        : { ok: false, message: `Gagal zoom ${mode}` };
    }

    case 'learn_alias': {
      const spoken = String(step.spoken || '').trim();
      const target = String(step.target || '').trim();
      if (!spoken || !target) return { ok: false, message: 'Istilah atau target masih kosong' };
      memory.learnAlias(spoken, target);
      return { ok: true, message: `Wis sekarang ingat "${spoken}" berarti "${target}"` };
    }

    case 'save_memory': {
      const fact = String(step.fact || '').trim();
      if (!fact) return { ok: false, message: 'Isi ingatan kosong' };
      memory.addFact(fact);
      return { ok: true, message: `Disimpan ke ingatan Wis: ${fact}` };
    }

    case 'learn_skill': {
      const trigger = String(step.trigger || '').trim();
      const description = String(step.description || trigger).trim();
      const skillSteps = Array.isArray(step.steps) ? step.steps : [];
      if (!trigger || skillSteps.length === 0) {
        return { ok: false, message: 'Nama pemicu atau langkah skill belum jelas' };
      }
      const ok = memory.learnSkill({ trigger, description, steps: skillSteps });
      return ok
        ? { ok: true, isChat: true, message: `Siap, Wis sudah belajar: jika Anda bilang "${trigger}", Wis akan menjalankan ${description}.` }
        : { ok: false, message: 'Gagal menyimpan skill baru' };
    }

    case 'hotkey': {
      const keys = String(step.keys || '').trim().toLowerCase();
      if (!keys) return { ok: false, message: 'Pintasan kosong' };
      const res = await runInjector(['hotkey', keys], 3000);
      return res.stdout === 'OK'
        ? { ok: true, message: `Menjalankan ${keys}` }
        : { ok: false, message: `Pintasan '${keys}' tidak didukung` };
    }

    case 'word_new_doc': {
      return await runWordHelper('open_new');
    }

    case 'word_open_file': {
      const query = String(step.query || '').trim();
      const matched = findBestDocument(query, true) || findBestDocument(query, false);
      if (!matched) {
        return { ok: false, message: `Dokumen '${query}' tidak ditemukan di Documents/Desktop/Downloads` };
      }
      if (!/\.(docx|doc|rtf)$/i.test(matched.name)) {
        const errMsg = await shell.openPath(matched.path);
        return errMsg ? { ok: false, message: errMsg } : { ok: true, message: `Membuka ${matched.name}` };
      }
      return await runWordHelper('open_file', { filePath: matched.path });
    }

    case 'word_write': {
      const instruction = String(step.instruction || step.text || '').trim();
      if (!instruction) return { ok: false, message: 'Isi catatan kosong' };
      const drafted = await draftTextForDocument(instruction, apiKey, runtimeCtx.onUsage || null);
      return await runWordHelper('append_text', { text: drafted });
    }

    case 'word_fix': {
      const readRes = await runWordHelper('read_text');
      if (!readRes.ok || !readRes.text) {
        return { ok: false, message: readRes.message || 'Dokumen Word masih kosong' };
      }
      const instruction = String(step.instruction || 'Perbaiki ejaan, typo, dan tata bahasa agar rapi').trim();
      const fixedText = await improveDocumentText(readRes.text, instruction, apiKey, runtimeCtx.onUsage || null);
      return await runWordHelper('replace_text', { text: fixedText, mode: readRes.mode || 'document' });
    }

    case 'word_save': {
      return await runWordHelper('save', { filePath: step.fileName || '' });
    }

    case 'type_text': {
      const text = String(step.text || '').trim();
      if (!text) return { ok: false, message: 'Teks kosong' };
      clipboard.writeText(text);
      await runInjector([], 3000);
      return { ok: true, message: 'Teks ditempel' };
    }

    default:
      return { ok: false, message: step.reason || 'Perintah tidak dikenali' };
  }
}

module.exports = {
  routeCommandWithGroq,
  planCommandWithGroq,
  tryLocalFastPlan,
  findMatchingRunningWindow,
  listChromeTabs,
  probeApiQuota,
  listAllSkills
};
