const { BrowserWindow, desktopCapturer, screen } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const usage = require('./usage');

const injectorPath = path.join(__dirname, 'injector.exe');
let gridCanvasWin = null;

function getForegroundRect() {
  return new Promise((resolve) => {
    if (!fs.existsSync(injectorPath)) {
      resolve(null);
      return;
    }
    execFile(injectorPath, ['fg_rect'], { encoding: 'utf8', timeout: 1200 }, (err, stdout) => {
      if (err || !stdout) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed && typeof parsed.width === 'number' ? parsed : null);
      } catch {
        resolve(null);
      }
    });
  });
}

async function getTargetDisplay(eyeWindow, widgetWindow) {
  try {
    const fg = await getForegroundRect();
    if (fg) {
      const centerPhys = {
        x: Math.round(fg.x + fg.width / 2),
        y: Math.round(fg.y + fg.height / 2)
      };
      const centerDip = typeof screen.screenToDipPoint === 'function'
        ? screen.screenToDipPoint(centerPhys)
        : centerPhys;
      return screen.getDisplayNearestPoint(centerDip);
    }

    let pt = null;
    if (eyeWindow && !eyeWindow.isDestroyed()) {
      const [ex, ey] = eyeWindow.getPosition();
      pt = { x: ex + 32, y: ey + 32 };
    } else if (widgetWindow && !widgetWindow.isDestroyed()) {
      const [wx, wy] = widgetWindow.getPosition();
      pt = { x: wx + 40, y: wy + 40 };
    } else {
      pt = screen.getCursorScreenPoint();
    }
    return screen.getDisplayNearestPoint(pt);
  } catch {
    return screen.getPrimaryDisplay();
  }
}

function getPhysicalRectForDisplay(display) {
  const b = display.bounds;
  try {
    if (typeof screen.dipToScreenRect === 'function') {
      return screen.dipToScreenRect(null, b);
    }
  } catch {}
  const sf = display.scaleFactor || 1;
  return {
    x: Math.round(b.x * sf),
    y: Math.round(b.y * sf),
    width: Math.round(b.width * sf),
    height: Math.round(b.height * sf)
  };
}

function captureForegroundUiElements(physRect) {
  return new Promise((resolve) => {
    if (!fs.existsSync(injectorPath)) {
      resolve({ title: '', process: '', elements: [] });
      return;
    }
    execFile(injectorPath, ['ui_tree'], { encoding: 'utf8', timeout: 1500 }, (err, stdout) => {
      if (err || !stdout) {
        resolve({ title: '', process: '', elements: [] });
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        const pw = Math.max(1, physRect.width);
        const ph = Math.max(1, physRect.height);
        const rawEls = Array.isArray(parsed.elements) ? parsed.elements : [];
        const mapped = [];
        for (const el of rawEls) {
          const cx = el.x + el.w / 2;
          const cy = el.y + el.h / 2;
          const x_pct = Number((((cx - physRect.x) / pw) * 100).toFixed(1));
          const y_pct = Number((((cy - physRect.y) / ph) * 100).toFixed(1));
          if (x_pct >= 0 && x_pct <= 100 && y_pct >= 0 && y_pct <= 100) {
            mapped.push({ role: el.t, name: el.n, x_pct, y_pct });
          }
        }
        resolve({ title: parsed.title || '', process: parsed.process || '', elements: mapped });
      } catch {
        resolve({ title: '', process: '', elements: [] });
      }
    });
  });
}

function captureViaInjectorGrid(physRect) {
  return new Promise((resolve) => {
    if (!fs.existsSync(injectorPath)) {
      resolve(null);
      return;
    }
    const tmpPath = path.join(os.tmpdir(), `wis-grid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`);
    const args = [
      'screenshot_grid',
      String(physRect.x),
      String(physRect.y),
      String(physRect.width),
      String(physRect.height),
      tmpPath
    ];
    execFile(injectorPath, args, { encoding: 'utf8', timeout: 4500 }, (err, stdout) => {
      try {
        if (!err && String(stdout || '').trim() === 'OK' && fs.existsSync(tmpPath)) {
          const buf = fs.readFileSync(tmpPath);
          if (buf.length > 0) {
            resolve(`data:image/jpeg;base64,${buf.toString('base64')}`);
            return;
          }
        }
      } catch {} finally {
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      }
      resolve(null);
    });
  });
}

async function ensureGridCanvasWindow() {
  if (gridCanvasWin && !gridCanvasWin.isDestroyed()) return gridCanvasWin;
  gridCanvasWin = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: { offscreen: true }
  });
  await gridCanvasWin.loadURL('data:text/html,<html><body style="margin:0;background:#000;"></body></html>');
  gridCanvasWin.on('closed', () => { gridCanvasWin = null; });
  return gridCanvasWin;
}

async function captureDesktopWithGrid(eyeWindow, widgetWindow) {
  const targetDisplay = await getTargetDisplay(eyeWindow, widgetWindow);
  const bounds = targetDisplay.bounds;
  const physRect = getPhysicalRectForDisplay(targetDisplay);
  const targetWidth = 960;
  const targetHeight = Math.round((targetWidth * bounds.height) / bounds.width);

  // Never hide widgetWindow or eyeWindow before moving so neither blinks on screen
  let nativeGriddedUrl = null;
  let rawDataUrl = null;
  let uiContext = { title: '', process: '', elements: [] };
  const [gridRes, uiRes] = await Promise.all([
    captureViaInjectorGrid(physRect),
    captureForegroundUiElements(physRect)
  ]);
  nativeGriddedUrl = gridRes;
  uiContext = uiRes;

  if (!nativeGriddedUrl) {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: targetWidth, height: targetHeight }
    });
    const source = sources.find(s => String(s.display_id) === String(targetDisplay.id)) || sources[0];
    if (source && !source.thumbnail.isEmpty()) {
      rawDataUrl = source.thumbnail.toDataURL();
    }
  }

  if (nativeGriddedUrl) {
    return { dataUrl: nativeGriddedUrl, bounds, uiContext };
  }

  if (!rawDataUrl) {
    throw new Error('Gagal mengambil screenshot layar');
  }

  // Fallback: Draw crisp 5x4 Chessboard Grid (A1..E4) in offscreen canvas
  const win = await ensureGridCanvasWindow();
  const griddedUrl = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.width, h = img.height;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const cols = ['A', 'B', 'C', 'D', 'E'];
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.56)';
        ctx.lineWidth = 1.5;
        ctx.font = 'bold 15px Arial';
        for (let ci = 0; ci < 5; ci++) {
          const x = Math.round(w * ci / 5);
          if (ci > 0) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
          for (let ri = 0; ri < 4; ri++) {
            const y = Math.round(h * ri / 4);
            if (ci === 0 && ri > 0) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
            const lbl = cols[ci] + (ri + 1);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.68)'; ctx.fillRect(x + 3, y + 3, 27, 18);
            ctx.fillStyle = '#FFFF00'; ctx.fillText(lbl, x + 5, y + 17);
          }
        }
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Gagal memproses grid layar'));
      img.src = ${JSON.stringify(rawDataUrl)};
    })
  `);

  return { dataUrl: griddedUrl, bounds, uiContext };
}

async function callGroqVision(prompt, griddedDataUrl, apiKey, { jsonMode = true, maxTokens = 320, onUsage = null } = {}) {
  const activeModel = 'qwen/qwen3.8-27b';
  const body = {
    model: activeModel,
    temperature: jsonMode ? 0 : 0.2,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: griddedDataUrl } }
        ]
      }
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
    const err = await response.json().catch(() => ({}));
    const errMsg = err.error?.message || `Vision HTTP ${response.status}`;
    if (response.status === 429) {
      usage.recordRateLimitError({ apiKey, model: activeModel, errMsg, headers: response.headers });
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  if (data.usage) {
    usage.recordLlmCall({ apiKey, model: data.model || activeModel, phase: 'vision', usage: data.usage, headers: response.headers });
    onUsage?.({ phase: 'vision', model: data.model || activeModel, usage: data.usage });
  }
  return (data.choices?.[0]?.message?.content || '').trim();
}

function findBestUiMatch(targetDescription, uiContext) {
  const els = uiContext && Array.isArray(uiContext.elements) ? uiContext.elements : [];
  if (els.length === 0) return null;

  const q = String(targetDescription || '').toLowerCase();
  const isSearchInputQuery = /\b(telusuri|kolom pencarian|kotak pencarian|search|cari|input)\b/.test(q) && !/\b(video|channel|profil|tombol)\b/.test(q);
  const asksChromeTab = /\btab\b/.test(q);

  if (isSearchInputQuery) {
    const edits = els.filter(e => (e.role === 'Edit' || e.role === 'Combo') && e.y_pct >= 3 && e.y_pct <= 22);
    let bestEdit = null;
    let bestScore = 0;
    for (const el of edits) {
      const name = String(el.name || '').toLowerCase();
      let score = 0;
      if (name.includes('telusuri')) score += 150;
      if (name === 'search' || name.includes('search')) score += 120;
      if (/address|url|bilah alamat|bilah penelusuran google/.test(name)) score -= 80;
      if (el.x_pct >= 25 && el.x_pct <= 70) score += 25;
      if (score > bestScore) {
        bestScore = score;
        bestEdit = el;
      }
    }
    if (bestEdit && bestScore >= 100) {
      return { found: true, x_pct: bestEdit.x_pct, y_pct: bestEdit.y_pct, label: bestEdit.name, source: 'uia-input' };
    }
    return null;
  }

  // Ordinal YouTube / feed item match ("video pertama" .. "video kesepuluh" / "ke-4")
  const ordinalMap = {
    pertama: 0, kesatu: 0, satu: 0, 'ke-1': 0, ke1: 0, 'paling atas': 0,
    kedua: 1, dua: 1, 'ke-2': 1, ke2: 1,
    ketiga: 2, tiga: 2, 'ke-3': 2, ke3: 2,
    keempat: 3, empat: 3, 'ke-4': 3, ke4: 3,
    kelima: 4, lima: 4, 'ke-5': 4, ke5: 4,
    keenam: 5, enam: 5, 'ke-6': 5, ke6: 5,
    ketujuh: 6, tujuh: 6, 'ke-7': 6, ke7: 6,
    kedelapan: 7, delapan: 7, 'ke-8': 7, ke8: 7,
    kesembilan: 8, sembilan: 8, 'ke-9': 8, ke9: 8,
    kesepuluh: 9, sepuluh: 9, 'ke-10': 9, ke10: 9
  };
  const ordinalMatch = q.match(/\b(pertama|kesatu|paling atas|kedua|ketiga|keempat|kelima|keenam|ketujuh|kedelapan|kesembilan|kesepuluh|ke-?\d+|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\b/);
  if (ordinalMatch && /\b(video|konten|hasil|thumbnail|kartu|lagu)\b/.test(q)) {
    const rawOrd = ordinalMatch[1].toLowerCase().replace(/\s+/g, ' ');
    let idx = ordinalMap[rawOrd];
    if (idx === undefined) {
      const mNum = rawOrd.match(/\d+/);
      idx = mNum ? Math.max(0, Number(mNum[0]) - 1) : 0;
    }
    const rawFeed = els
      .filter(e => e.role === 'Link' && e.y_pct >= 18 && e.x_pct >= 16 && e.name.length >= 8 && !e.name.startsWith('@'))
      .sort((a, b) => (Math.abs(a.y_pct - b.y_pct) < 5 ? a.x_pct - b.x_pct : a.y_pct - b.y_pct));
    // Collapse duplicate/overlapping links from the same video card (within 6% X and 5% Y)
    const feedLinks = [];
    for (const item of rawFeed) {
      if (!feedLinks.some(prev => Math.abs(prev.x_pct - item.x_pct) < 6 && Math.abs(prev.y_pct - item.y_pct) < 5)) {
        feedLinks.push(item);
      }
    }
    if (feedLinks[idx]) {
      return { found: true, x_pct: feedLinks[idx].x_pct, y_pct: feedLinks[idx].y_pct, label: feedLinks[idx].name, source: 'uia-ordinal' };
    }
  }

  const isSideVideo = /\b(samping|kanan|sebelah kanan|yang lain|rekomendasi|terkait|berikutnya)\b/i.test(q);
  if (isSideVideo) {
    const sideFeed = els
      .filter(e => (e.role === 'Link' || e.role === 'Button' || e.role === 'ListItem' || e.role === 'Text' || e.role === 'Image') && e.x_pct >= 50 && e.y_pct >= 12 && String(e.name || '').length >= 3)
      .sort((a, b) => a.y_pct - b.y_pct);
    if (sideFeed.length > 0) {
      const pickIdx = /\b(kedua|ke-2|2|lain)\b/i.test(q) && sideFeed.length > 1 ? 1 : 0;
      const target = sideFeed[pickIdx] || sideFeed[0];
      return { found: true, x_pct: target.x_pct, y_pct: target.y_pct, label: target.name || 'Video rekomendasi samping', source: 'uia-sidebar' };
    }
  }

  // Direct text token match over page elements (strictly exclude Chrome tab bar unless asking for Tab)
  const stop = new Set(['yang', 'di', 'pada', 'ke', 'video', 'judul', 'thumbnail', 'tombol', 'klik', 'buka', 'putar', 'cari', 'channel', 'bagian', 'layar', 'youtube', 'chrome', 'muncul', 'adalah', 'atau', 'itu', 'dong', 'ya', 'aja', 'tolong']);
  const tokens = q.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && !stop.has(w));
  if (tokens.length === 0) return null;

  let bestEl = null;
  let bestScore = 0;
  for (const el of els) {
    if (!asksChromeTab && (el.role === 'Tab' || el.y_pct < 6)) continue;
    const nameLow = String(el.name || '').toLowerCase();
    let hits = 0;
    for (const tok of tokens) {
      if (nameLow.includes(tok)) {
        hits++;
      } else {
        const tokSub = tok.slice(1);
        if (tokSub.length >= 3 && nameLow.includes(tokSub)) {
          hits += 0.8;
        }
      }
    }
    if (hits > 0) {
      let score = (hits / tokens.length) * 100 + hits * 15;
      if (el.role === 'Link' || el.role === 'Button') score += 10;
      if (score > bestScore) {
        bestScore = score;
        bestEl = el;
      }
    }
  }
  if (bestEl && bestScore >= 45) {
    return { found: true, x_pct: bestEl.x_pct, y_pct: bestEl.y_pct, label: bestEl.name, source: 'uia-text' };
  }
  return null;
}

function cellToPct(cellStr, posX, posY) {
  const cols = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const s = String(cellStr || '').trim().toUpperCase();
  const ci = cols[s[0]];
  const ri = parseInt(s.slice(1), 10) - 1;
  if (ci === undefined || Number.isNaN(ri) || ri < 0 || ri > 3) return null;
  const cx = Math.max(4, Math.min(96, Number(posX) || 50));
  const cy = Math.max(4, Math.min(96, Number(posY) || 50));
  return {
    x_pct: Number((ci * 20 + cx * 0.2).toFixed(1)),
    y_pct: Number((ri * 25 + cy * 0.25).toFixed(1))
  };
}

async function locateTargetWithVision(targetDescription, griddedDataUrl, apiKey, uiContext = null, onUsage = null) {
  const direct = findBestUiMatch(targetDescription, uiContext);
  if (direct) {
    return direct;
  }

  const els = uiContext && Array.isArray(uiContext.elements) ? uiContext.elements : [];
  const filteredEls = els.filter(e => e.role !== 'Tab' && e.y_pct >= 5).slice(0, 30);
  const compactRows = filteredEls.map(e => `${e.role}|${String(e.name || '').slice(0, 50)}|${e.x_pct},${e.y_pct}`).join('\n');
  const uiList = filteredEls.length > 0
    ? `\nUI(${uiContext.title || 'Win'} role|name|x%,y%):\n${compactRows}`
    : '';

  const prompt = `5x4 yellow grid (cols A-E L->R, rows 1-4 T->B, labels A1..E4 top-left).
Find center of: "${targetDescription}"${uiList}
Rules:
- Never pick browser top tab strip or close/minimize bar for webpage videos/search boxes.
- For ordinal items ("video pertama/kedua/ke-N"), count visual thumbnails L->R, T->B below pills.
- For sidebar / recommendation items ("di samping", "sebelah kanan", "yang lain"): look at the right sidebar (cols D-E) next to the main video player.
JSON ONLY: {"found":true,"cell":"A1..E4","pos_in_cell_x":0..100,"pos_in_cell_y":0..100,"label":"short"} OR {"found":false,"reason":"singkat ID"}`;

  const raw = await callGroqVision(prompt, griddedDataUrl, apiKey, { jsonMode: true, maxTokens: 280, onUsage });
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);
  if (!parsed || !parsed.found) return parsed;

  if (parsed.cell) {
    const pct = cellToPct(parsed.cell, parsed.pos_in_cell_x, parsed.pos_in_cell_y);
    if (pct) {
      return { found: true, x_pct: pct.x_pct, y_pct: pct.y_pct, label: parsed.label || targetDescription, cell: parsed.cell, source: 'vision-cell' };
    }
  }
  return parsed;
}

async function inspectScreenWithVision(question, griddedDataUrl, apiKey, uiContext = null, replyLang = 'id', onUsage = null) {
  const uiNames = uiContext && Array.isArray(uiContext.elements) && uiContext.elements.length > 0
    ? uiContext.elements.slice(0, 28).map(e => String(e.name || '').slice(0, 40)).filter(Boolean).join(' | ')
    : '';
  const uiList = uiNames ? `\nUI(${uiContext.title || ''}): ${uiNames}` : '';
  const langInstruction = replyLang === 'en'
    ? 'Reply in 1-2 short TTS-friendly English sentences (no markdown/emojis).'
    : 'Jawab 1-2 kalimat singkat Bahasa Indonesia untuk suara TTS (tanpa markdown/emoji).';

  const prompt = `Wis inspecting screenshot. Question: "${question}"${uiList}\n${langInstruction}`;

  return await callGroqVision(prompt, griddedDataUrl, apiKey, { jsonMode: false, maxTokens: 280, onUsage });
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

async function glideWisToTarget({ eyeWindow, widgetWindow, targetDipX, targetDipY, eyeOffsetX, eyeOffsetY, onArrive }) {
  if (!eyeWindow || eyeWindow.isDestroyed()) {
    if (onArrive) await onArrive();
    return;
  }

  const [startX, startY] = eyeWindow.getPosition();
  const startCenterX = startX + 32;
  const startCenterY = startY + 32;

  const dx = targetDipX - startCenterX;
  const dy = targetDipY - startCenterY;
  const dist = Math.hypot(dx, dy);
  const angleRad = Math.atan2(dy, dx);
  // Default SVG arrow points UP (-90deg), so rotate clockwise by angleDeg + 90
  const pointerAngleDeg = Math.round((angleRad * 180 / Math.PI) + 90);

  // Stop Wis orb 28px behind target so the orbiting arrow tip touches (targetDipX, targetDipY)
  const offsetDist = Math.min(28, dist * 0.5);
  const destCenterX = targetDipX - Math.cos(angleRad) * offsetDist;
  const destCenterY = targetDipY - Math.sin(angleRad) * offsetDist;

  const display = screen.getDisplayNearestPoint({ x: Math.round(targetDipX), y: Math.round(targetDipY) });
  const bounds = display.bounds;
  const destX = Math.max(bounds.x, Math.min(Math.round(destCenterX - 32), bounds.x + bounds.width - 64));
  const destY = Math.max(bounds.y, Math.min(Math.round(destCenterY - 32), bounds.y + bounds.height - 64));

  eyeWindow.webContents.send('wis-glide-start', { angleDeg: pointerAngleDeg });

  // Smooth 60fps glide animation
  const duration = Math.max(280, Math.min(540, Math.round(dist * 0.65)));
  const startTime = Date.now();

  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (!eyeWindow || eyeWindow.isDestroyed()) {
        clearInterval(timer);
        resolve();
        return;
      }
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = easeInOutCubic(t);
      const curX = Math.round(startX + (destX - startX) * eased);
      const curY = Math.round(startY + (destY - startY) * eased);
      eyeWindow.setPosition(curX, curY);

      if (t >= 1) {
        clearInterval(timer);
        resolve();
      }
    }, 16);
  });

  // Pause cleanly after Wis finishes gliding so movement and click never turn into drag-select
  await new Promise(r => setTimeout(r, 120));

  // Execute real click/type while temporarily ignoring mouse events on Wis so OS click lands cleanly underneath
  if (!eyeWindow.isDestroyed()) {
    eyeWindow.setIgnoreMouseEvents(true);
  }
  try {
    if (onArrive) await onArrive();
  } finally {
    if (eyeWindow && !eyeWindow.isDestroyed()) {
      eyeWindow.setIgnoreMouseEvents(false);
    }
  }

  await new Promise(r => setTimeout(r, 150));

  // Vanish at target location, then silently teleport back above Microphone and pop back in
  if (eyeWindow && !eyeWindow.isDestroyed()) {
    eyeWindow.webContents.send('wis-vanish');
    await new Promise(r => setTimeout(r, 210));
    eyeWindow.setOpacity(0);

    if (widgetWindow && !widgetWindow.isDestroyed()) {
      const [wx, wy] = widgetWindow.getPosition();
      eyeWindow.setPosition(wx + eyeOffsetX, wy + eyeOffsetY);
    } else {
      eyeWindow.setPosition(startX, startY);
    }

    eyeWindow.setOpacity(1);
    eyeWindow.webContents.send('wis-reappear');
  }
}

function dispose() {
  if (gridCanvasWin && !gridCanvasWin.isDestroyed()) {
    try { gridCanvasWin.close(); } catch {}
    gridCanvasWin = null;
  }
}

module.exports = {
  captureDesktopWithGrid,
  locateTargetWithVision,
  inspectScreenWithVision,
  glideWisToTarget,
  findBestUiMatch,
  cellToPct,
  dispose
};
