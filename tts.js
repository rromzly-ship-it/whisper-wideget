const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const piperDir = path.join(__dirname, 'piper');
const piperExeCandidates = [
  path.join(piperDir, 'piper', 'piper.exe'),
  path.join(piperDir, 'piper.exe')
];

const VOICE_MODELS = {
  id: { file: path.join(piperDir, 'id_ID-news_tts-medium.onnx'), lengthScale: '0.94' },
  en: { file: path.join(piperDir, 'en_US-amy-low.onnx'), lengthScale: '0.96' }
};

function findPiperExe() {
  for (const p of piperExeCandidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function isModelAvailable(lang = 'id') {
  const cfg = VOICE_MODELS[lang] || VOICE_MODELS.id;
  return !!findPiperExe() && fs.existsSync(cfg.file);
}

function isAvailable() {
  return isModelAvailable('id') || isModelAvailable('en');
}

function sanitizeForSpeech(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, 'link')
    .replace(/[*_`#~|]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 420);
}

function detectSpeechLang(text, explicitHint = 'auto') {
  // Keep one consistent speaker persona (id_ID-news_tts-medium) so voice identity never flips mid-session
  if (isModelAvailable('id')) return 'id';
  const hint = String(explicitHint || 'auto').toLowerCase();
  if ((hint === 'en' || hint.startsWith('en-')) && isModelAvailable('en')) return 'en';
  return 'id';
}

function normalizePronunciationForLang(text, lang) {
  let out = String(text || '');
  if (lang === 'id') {
    const idPhonetics = [
      [/\boke\b/gi, 'Siap'],
      [/\bok\b/gi, 'Siap'],
      [/\bokey\b/gi, 'Siap'],
      [/\bAlt\+Tab\b|\bAlt-Tab\b/gi, 'Alt Tab'],
      [/\bFourtwnty\b|\b420\b/gi, 'For Twenti'],
      [/\bMr\.?\s*Beast\b/gi, 'Mister Bis'],
      [/\bGoogle Chrome\b/gi, 'Gugel Krom'],
      [/\bChrome\b/gi, 'Krom'],
      [/\bYouTube\b/gi, 'Yutub'],
      [/\bGoogle\b/gi, 'Gugel'],
      [/\bCorelDRAW\b|\bCorel\b/gi, 'Korel'],
      [/\bMicrosoft Word\b/gi, 'Maikrosof Werd'],
      [/\bWord\b/gi, 'Werd'],
      [/\bzoom in\b/gi, 'zum in'],
      [/\bzoom out\b/gi, 'zum aut'],
      [/\bscroll(ing)?\b/gi, 'skrol'],
      [/\bdownloads?\b/gi, 'daunlod'],
      [/\bscreenshot\b/gi, 'skrinshot'],
      [/\bdesktop\b/gi, 'deskop'],
      [/\bEsteraOne\b/gi, 'Estera Wan'],
      [/\biTrade\b/gi, 'Ai Tred'],
      [/\bchannel\b/gi, 'cenel']
    ];
    for (const [re, rep] of idPhonetics) {
      out = out.replace(re, rep);
    }
  } else if (lang === 'en') {
    out = out.replace(/\bWis\b/g, 'Wiz');
  }
  return out;
}

function createVoiceWorker(modelPath, lengthScale) {
  let proc = null;
  let stdoutBuf = '';
  const queue = [];
  let currentJob = null;

  function finishCurrentJob(reportedPath) {
    const job = currentJob;
    if (!job) return;
    currentJob = null;
    clearTimeout(job.timer);

    const wavFile = fs.existsSync(job.wavPath) ? job.wavPath : reportedPath;
    try {
      if (fs.existsSync(wavFile)) {
        const buf = fs.readFileSync(wavFile);
        try { fs.unlinkSync(wavFile); } catch {}
        job.resolve(buf.toString('base64'));
      } else {
        job.resolve(null);
      }
    } catch {
      job.resolve(null);
    }
    processNext();
  }

  function ensureStarted() {
    if (proc && !proc.killed) return true;
    const exe = findPiperExe();
    if (!exe || !fs.existsSync(modelPath)) return false;

    proc = spawn(exe, [
      '--model', modelPath,
      '--length_scale', lengthScale,
      '--sentence_silence', '0.18',
      '--json-input',
      '--quiet'
    ], {
      cwd: path.dirname(exe),
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true
    });

    stdoutBuf = '';
    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      let idx;
      while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, idx).trim();
        stdoutBuf = stdoutBuf.slice(idx + 1);
        if (line && currentJob) {
          finishCurrentJob(line);
        }
      }
    });

    proc.on('exit', () => {
      proc = null;
      if (currentJob) {
        const job = currentJob;
        currentJob = null;
        clearTimeout(job.timer);
        job.resolve(null);
        processNext();
      }
    });
    return true;
  }

  function processNext() {
    if (currentJob || queue.length === 0) return;
    if (!ensureStarted()) {
      while (queue.length > 0) queue.shift().resolve(null);
      return;
    }

    const job = queue.shift();
    currentJob = job;

    job.timer = setTimeout(() => {
      if (currentJob === job) {
        currentJob = null;
        try { if (fs.existsSync(job.wavPath)) fs.unlinkSync(job.wavPath); } catch {}
        job.resolve(null);
        processNext();
      }
    }, 12000);

    try {
      const payload = JSON.stringify({ text: job.text, output_file: job.wavPath }) + '\n';
      proc.stdin.write(payload, 'utf8');
    } catch {
      clearTimeout(job.timer);
      currentJob = null;
      job.resolve(null);
      processNext();
    }
  }

  return {
    warmup: () => ensureStarted(),
    synthesize: (text, wavPath) => new Promise((resolve) => {
      queue.push({ text, wavPath, resolve, timer: null });
      processNext();
    }),
    shutdown: () => {
      if (proc && !proc.killed) {
        try { proc.kill(); } catch {}
      }
      proc = null;
    }
  };
}

const workers = {};
function getWorker(lang) {
  const key = (lang === 'en' && isModelAvailable('en')) ? 'en' : 'id';
  if (!workers[key]) {
    const cfg = VOICE_MODELS[key];
    workers[key] = createVoiceWorker(cfg.file, cfg.lengthScale);
  }
  return workers[key];
}

const ttsCache = new Map();

async function synthesizeWavBase64(rawText, langHint = 'auto') {
  const clean = sanitizeForSpeech(rawText);
  if (!clean || !isAvailable()) return null;

  const chosenLang = detectSpeechLang(clean, langHint);
  const spokenText = normalizePronunciationForLang(clean, chosenLang);
  const cacheKey = `${chosenLang}:${spokenText.toLowerCase()}`;

  if (ttsCache.has(cacheKey)) {
    return ttsCache.get(cacheKey);
  }

  const tempDir = app ? app.getPath('temp') : os.tmpdir();
  const wavPath = path.join(tempDir, `wis-tts-${chosenLang}-${Date.now()}-${Math.floor(Math.random() * 10000)}.wav`);
  const b64 = await getWorker(chosenLang).synthesize(spokenText, wavPath);

  if (b64 && clean.length < 50) {
    ttsCache.set(cacheKey, b64);
  }
  return b64;
}

function prewarmCache() {
  const commonPhrases = ['Oke', 'Siap', 'Baik', 'Halo', 'Hai'];
  for (const p of commonPhrases) {
    synthesizeWavBase64(p, 'id').catch(() => {});
  }
}

function warmup(lang = 'id') {
  if (isModelAvailable(lang)) {
    getWorker(lang).warmup();
  }
}

function shutdown() {
  for (const key of Object.keys(workers)) {
    workers[key].shutdown();
    delete workers[key];
  }
}

module.exports = {
  isAvailable,
  isModelAvailable,
  detectSpeechLang,
  normalizePronunciationForLang,
  warmup,
  prewarmCache,
  synthesizeWavBase64,
  shutdown
};
