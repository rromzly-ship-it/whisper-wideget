const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_ALIASES = {
  'air trade': 'iTrade ARSS Pro',
  'itrend': 'iTrade ARSS Pro',
  'i train': 'iTrade ARSS Pro',
  'i trade': 'iTrade ARSS Pro',
  'esterawan': 'EsteraOne',
  'pt estera': 'EsteraOne',
  'buka.com': 'Google Chrome',
  'buka kom': 'Google Chrome',
  'kom': 'Google Chrome',
  'koreldraw': 'CorelDRAW 2024',
  'corel': 'CorelDRAW 2024',
  '420': 'Fourtwnty',
  'empat dua puluh': 'Fourtwnty',
  'four twenty': 'Fourtwnty',
  'for twenty': 'Fourtwnty',
  'fourtwnty': 'Fourtwnty',
  'post video': 'pause video',
  'misterbis': 'MrBeast',
  'mister bis': 'MrBeast',
  'mr beast': 'MrBeast',
  'mrbeast': 'MrBeast',
  'high wish': 'Hai Wis',
  'hi wish': 'Hai Wis',
  'hai wish': 'Hai Wis',
  'halo wish': 'Halo Wis'
};

const WIS_KNOWLEDGE = `Panduan Pemakaian Wis (Whisper Agent):
1. Mulai & Berhenti: Klik ikon biru Wis di atas mikrofon (Alt+Shift+C) untuk langsung siap mendengarkan (merah) tanpa sapaan pembuka. Ucapkan perintah, jeda 1 detik agar otomatis jalan; klik lagi untuk mematikan. Tombol mikrofon besar di bawah (Alt+Shift+V) untuk dikte mengetik teks ke kursor.
2. Membuka Alt+Tab & Kontrol Jendela: Katakan "buka Alt Tab" atau "lihat aplikasi aktif" untuk daftar Alt+Tab. Katakan "buka Chrome/Corel", "minimize Chrome", "maximize Corel", atau "fullscreen aplikasi ini" untuk mengatur ukuran/tampilan jendela mana saja.
3. Cari, Putar, & Kontrol Video YouTube: Di YouTube, katakan "telusuri [lagu/channel]". Untuk memutar hasil di layar, katakan "klik video pertama", "buka video keempat", atau "putar video [judul]". Untuk kontrol cepat, katakan "pause video", "lanjutkan video", "mute", atau "fullscreen video".
4. Scroll Otomatis & Zoom: Katakan "scroll ke bawah/atas/kiri/kanan" (mata Wis berputar 3D) atau "scroll pelan-pelan ke bawah sampai saya suruh berhenti" sampai Anda ucapkan "berhenti"/"stop". Katakan "zoom in"/"perbesar" atau "zoom out"/"perkecil".
5. Melatih Ingatan, Kamus, & Skill AI Baru (Tanpa Coding): Katakan "Wis ingat kalau saya bilang X maksudnya Y" (kamus kata) atau "Wis belajar, kalau saya bilang [perintah baru], lakukan [langkah/shortcutnya]" agar AI menyimpan resep tugas baru secara permanen.
6. Log & Kuota Token: Buka menu Pengaturan -> tab Log Perintah untuk memantau antrean/hasil checklist hijau, dan tab Token & Kuota untuk melihat pemakaian token per API key serta kalkulasi kapasitas tugas harian.
7. Debug Log: Klik kanan ikon tray -> Buka Log Debug atau Buka DevTools Wis.`;

const DEFAULT_SKILLS = [
  {
    id: 'tampilkan-desktop',
    trigger: 'tampilkan desktop',
    synonyms: ['bersihkan layar', 'ke desktop', 'sembunyikan semua jendela'],
    category: 'jendela',
    description: 'Minimalkan semua jendela & tampilkan desktop (Win+D)',
    steps: [{ action: 'hotkey', keys: 'win+d' }],
    builtin: true
  },
  {
    id: 'ambil-screenshot',
    trigger: 'ambil screenshot',
    synonyms: ['tangkap layar', 'screenshot layar', 'crop layar'],
    category: 'sistem',
    description: 'Buka Snipping Tool untuk screenshot area layar (Win+Shift+S)',
    steps: [{ action: 'hotkey', keys: 'win+shift+s' }],
    builtin: true
  },
  {
    id: 'naikkan-volume',
    trigger: 'naikkan volume',
    synonyms: ['keraskan suara', 'besarkan volume', 'volume up'],
    category: 'audio',
    description: 'Naikkan volume suara laptop (+3 langkah)',
    steps: [
      { action: 'hotkey', keys: 'volume_up' },
      { action: 'hotkey', keys: 'volume_up' },
      { action: 'hotkey', keys: 'volume_up' }
    ],
    builtin: true
  },
  {
    id: 'turunkan-volume',
    trigger: 'turunkan volume',
    synonyms: ['kecilkan suara', 'pelankan suara', 'volume down'],
    category: 'audio',
    description: 'Turunkan volume suara laptop (-3 langkah)',
    steps: [
      { action: 'hotkey', keys: 'volume_down' },
      { action: 'hotkey', keys: 'volume_down' },
      { action: 'hotkey', keys: 'volume_down' }
    ],
    builtin: true
  },
  {
    id: 'bisukan-suara',
    trigger: 'bisukan suara',
    synonyms: ['matikan suara laptop', 'mute laptop', 'mute suara'],
    category: 'audio',
    description: 'Mute / unmute suara sistem Windows',
    steps: [{ action: 'hotkey', keys: 'volume_mute' }],
    builtin: true
  },
  {
    id: 'belah-layar-kiri',
    trigger: 'belah layar kiri',
    synonyms: ['geser jendela ke kiri', 'snap kiri'],
    category: 'jendela',
    description: 'Tempel jendela aktif di separuh kiri layar (Win+Left)',
    steps: [{ action: 'hotkey', keys: 'win+left' }],
    builtin: true
  },
  {
    id: 'belah-layar-kanan',
    trigger: 'belah layar kanan',
    synonyms: ['geser jendela ke kanan', 'snap kanan'],
    category: 'jendela',
    description: 'Tempel jendela aktif di separuh kanan layar (Win+Right)',
    steps: [{ action: 'hotkey', keys: 'win+right' }],
    builtin: true
  },
  {
    id: 'buka-clipboard',
    trigger: 'buka clipboard',
    synonyms: ['riwayat copy', 'riwayat tempel', 'clipboard windows'],
    category: 'produktivitas',
    description: 'Buka riwayat clipboard Windows (Win+V)',
    steps: [{ action: 'hotkey', keys: 'win+v' }],
    builtin: true
  },
  {
    id: 'salin-semua',
    trigger: 'salin semua',
    synonyms: ['copy semua', 'kopi semua'],
    category: 'produktivitas',
    description: 'Pilih semua lalu copy teks (Ctrl+A lalu Ctrl+C)',
    steps: [
      { action: 'hotkey', keys: 'ctrl+a' },
      { action: 'hotkey', keys: 'ctrl+c' }
    ],
    builtin: true
  },
  {
    id: 'buka-task-manager',
    trigger: 'buka task manager',
    synonyms: ['cek task manager', 'lihat proses berjalan'],
    category: 'sistem',
    description: 'Buka Windows Task Manager',
    steps: [{ action: 'open_app', appName: 'Task Manager', forceNew: false }],
    builtin: true
  }
];

let loadedMemory = null;

function getSkillsFilePath() {
  return path.join(__dirname, 'skills.json');
}

function getMemoryFilePath() {
  return path.join(__dirname, 'wis-memory.json');
}

function getLegacyAppDataMemoryPath() {
  try {
    return path.join(app.getPath('userData'), 'wis-memory.json');
  } catch {
    return '';
  }
}

function createInitialMemory() {
  return {
    aliases: { ...DEFAULT_ALIASES },
    facts: [],
    skills: DEFAULT_SKILLS.map(s => ({ ...s, synonyms: [...(s.synonyms || [])], steps: [...s.steps] })),
    history: [],
    activeApp: null,
    syncUrl: ''
  };
}

function mergeSkillsList(baseSkills, incomingSkills) {
  const map = new Map();
  for (const s of baseSkills) {
    if (s && s.trigger) map.set(String(s.trigger).toLowerCase(), s);
  }
  for (const s of incomingSkills) {
    if (s && s.trigger && Array.isArray(s.steps) && s.steps.length > 0) {
      map.set(String(s.trigger).toLowerCase(), s);
    }
  }
  return Array.from(map.values()).slice(-80);
}

function loadMemory() {
  if (loadedMemory) return loadedMemory;
  const fresh = createInitialMemory();
  let migratedOrSeeded = false;

  let skillsData = null;
  try {
    const sf = getSkillsFilePath();
    if (fs.existsSync(sf)) {
      skillsData = JSON.parse(fs.readFileSync(sf, 'utf8'));
    } else {
      migratedOrSeeded = true;
    }
  } catch {
    migratedOrSeeded = true;
  }

  let memData = null;
  try {
    const mf = getMemoryFilePath();
    if (fs.existsSync(mf)) {
      memData = JSON.parse(fs.readFileSync(mf, 'utf8'));
    } else {
      migratedOrSeeded = true;
      const legacy = getLegacyAppDataMemoryPath();
      if (legacy && fs.existsSync(legacy)) {
        memData = JSON.parse(fs.readFileSync(legacy, 'utf8'));
      }
    }
  } catch {}

  const mergedAliases = {
    ...DEFAULT_ALIASES,
    ...((memData && memData.aliases) || {}),
    ...((skillsData && skillsData.aliases) || {})
  };

  let mergedSkills = fresh.skills;
  if (memData && Array.isArray(memData.skills)) {
    mergedSkills = mergeSkillsList(mergedSkills, memData.skills);
  }
  if (skillsData && Array.isArray(skillsData.skills)) {
    mergedSkills = mergeSkillsList(mergedSkills, skillsData.skills);
  }

  loadedMemory = {
    aliases: mergedAliases,
    facts: Array.isArray(memData?.facts) ? memData.facts.slice(-40) : [],
    skills: mergedSkills,
    history: Array.isArray(memData?.history) ? memData.history.slice(-25) : [],
    activeApp: memData?.activeApp || null,
    syncUrl: (skillsData && skillsData.syncUrl) || ''
  };

  if (migratedOrSeeded) {
    saveMemory();
  }
  return loadedMemory;
}

function saveMemory() {
  if (!loadedMemory) return;
  try {
    const skillsPayload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      syncUrl: loadedMemory.syncUrl || '',
      aliases: loadedMemory.aliases || {},
      skills: Array.isArray(loadedMemory.skills) ? loadedMemory.skills : []
    };
    fs.writeFileSync(getSkillsFilePath(), JSON.stringify(skillsPayload, null, 2), 'utf8');

    const localMemPayload = {
      facts: loadedMemory.facts || [],
      history: loadedMemory.history || [],
      activeApp: loadedMemory.activeApp || null
    };
    fs.writeFileSync(getMemoryFilePath(), JSON.stringify(localMemPayload, null, 2), 'utf8');
  } catch {}
}

function learnAlias(spokenPhrase, targetName) {
  const mem = loadMemory();
  const key = String(spokenPhrase || '').trim().toLowerCase();
  const val = String(targetName || '').trim();
  if (!key || !val) return false;
  mem.aliases[key] = val;
  saveMemory();
  return true;
}

function addFact(factText) {
  const mem = loadMemory();
  const clean = String(factText || '').trim();
  if (!clean) return false;
  if (!mem.facts.includes(clean)) {
    mem.facts.push(clean);
    if (mem.facts.length > 40) mem.facts = mem.facts.slice(-40);
    saveMemory();
  }
  return true;
}

function learnSkill({ trigger, description = '', steps = [], synonyms = [], category = 'kustom' } = {}) {
  const mem = loadMemory();
  if (!Array.isArray(mem.skills)) mem.skills = [];
  const trig = String(trigger || '').trim().toLowerCase().replace(/[.!?]+$/g, '');
  const validSteps = Array.isArray(steps) ? steps.filter(s => s && typeof s.action === 'string') : [];
  if (!trig || validSteps.length === 0) return false;

  const entry = {
    id: trig.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `skill-${Date.now()}`,
    trigger: trig,
    synonyms: Array.isArray(synonyms) ? synonyms.map(x => String(x || '').trim().toLowerCase()).filter(Boolean) : [],
    category: String(category || 'kustom').trim().toLowerCase(),
    description: String(description || trig).trim().slice(0, 120),
    steps: validSteps,
    builtin: false,
    learnedAt: new Date().toISOString()
  };

  const idx = mem.skills.findIndex(s => s.trigger === trig);
  if (idx >= 0) {
    mem.skills[idx] = entry;
  } else {
    mem.skills.push(entry);
    if (mem.skills.length > 80) mem.skills = mem.skills.slice(-80);
  }
  saveMemory();
  return true;
}

function removeSkill(trigger) {
  const mem = loadMemory();
  const trig = String(trigger || '').trim().toLowerCase();
  if (!trig || !Array.isArray(mem.skills)) return false;
  const before = mem.skills.length;
  mem.skills = mem.skills.filter(s => String(s.trigger || '').toLowerCase() !== trig);
  if (mem.skills.length !== before) {
    saveMemory();
    return true;
  }
  return false;
}

function findMatchingSkills(transcript) {
  const mem = loadMemory();
  const skills = Array.isArray(mem.skills) ? mem.skills : [];
  if (skills.length === 0) return [];
  const low = String(transcript || '').toLowerCase().trim();
  const words = new Set(low.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length >= 2));

  const scored = [];
  for (const s of skills) {
    if (!s || !s.trigger) continue;
    const phrases = [s.trigger, ...(Array.isArray(s.synonyms) ? s.synonyms : [])];
    let best = 0;
    for (const ph of phrases) {
      const cleanPh = String(ph || '').toLowerCase().trim();
      if (!cleanPh) continue;
      if (low.includes(cleanPh)) {
        best = Math.max(best, 100 + cleanPh.length);
        continue;
      }
      const trigWords = cleanPh.split(/\s+/).filter(w => w.length >= 2);
      if (trigWords.length > 0) {
        const hits = trigWords.filter(w => words.has(w)).length;
        if (hits === trigWords.length || (trigWords.length >= 2 && hits / trigWords.length >= 0.7)) {
          best = Math.max(best, Math.round((hits / trigWords.length) * 80));
        }
      }
    }
    if (best > 0) scored.push({ skill: s, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.skill);
}

function findExactSkill(transcript) {
  const mem = loadMemory();
  const skills = Array.isArray(mem.skills) ? mem.skills : [];
  const clean = String(transcript || '').trim().toLowerCase().replace(/^(?:hai|halo|tolong|coba|wis|hai wis)\s+/i, '').replace(/[.!?]+$/g, '').trim();
  if (!clean) return null;
  return skills.find((s) => {
    if (!s) return false;
    if (String(s.trigger || '').toLowerCase() === clean) return true;
    return Array.isArray(s.synonyms) && s.synonyms.some(syn => String(syn || '').toLowerCase() === clean);
  }) || null;
}

function recordHistory({ user, summary, app: appName, action }) {
  const mem = loadMemory();
  mem.history.push({
    ts: new Date().toISOString(),
    user: String(user || '').slice(0, 140),
    summary: String(summary || '').slice(0, 120),
    app: appName || '',
    action: action || ''
  });
  if (mem.history.length > 25) {
    mem.history = mem.history.slice(-25);
  }
  saveMemory();
}

function findMatchingAliases(transcript) {
  const mem = loadMemory();
  const low = String(transcript || '').toLowerCase();
  const hits = [];
  for (const [spoken, target] of Object.entries(mem.aliases)) {
    if (spoken && low.includes(spoken)) {
      hits.push({ spoken, target });
    }
  }
  return hits;
}

function isTutorialQuestion(transcript) {
  return /\b(bagaimana\s+cara(nya)?|gimana\s+cara(nya)?|cara\s+(buka|ngebuka|klik|mengklik|putar|memutar)|tutorial|panduan|cara pakai|cara menggunakan|cara kerja|how do i|how to use|bisa apa saja|what can you do)\b/i.test(
    String(transcript || '')
  );
}

function getWhisperPromptHints(chromeTabs = []) {
  const mem = loadMemory();
  const customTargets = Array.from(new Set(Object.values(mem.aliases)))
    .map(v => v.split(/[-|]/)[0].trim())
    .filter(v => v.length >= 2 && v.length <= 24)
    .slice(0, 8);
  const tabTokens = (chromeTabs || [])
    .slice(0, 6)
    .map(t => String(typeof t === 'string' ? t : (t.name || '')).split(/[-–|]/)[0].trim())
    .filter(v => v.length >= 2 && v.length <= 22);

  const terms = Array.from(new Set([
    'Wis', 'Chrome', 'CorelDRAW', 'YouTube', 'Fourtwnty', 'MrBeast', 'Word',
    ...customTargets,
    ...tabTokens,
    'telusuri', 'klik video pertama', 'scroll', 'berhenti', 'stop', 'zoom in', 'zoom out', 'ingat'
  ]));
  return `Wis ID & EN: ${terms.join(', ')}.`.slice(0, 220);
}

let screenSnapshot = {
  title: '',
  updatedAt: 0,
  items: []
};

function setActiveApp({ process: procName, title } = {}) {
  const mem = loadMemory();
  const cleanTitle = String(title || '').trim().slice(0, 80);
  const cleanProc = String(procName || '').trim().slice(0, 40);
  if (!cleanTitle && !cleanProc) return;
  mem.activeApp = {
    process: cleanProc || mem.activeApp?.process || '',
    title: cleanTitle || mem.activeApp?.title || '',
    updatedAt: new Date().toISOString()
  };
  saveMemory();
}

function setScreenSnapshot(uiContext) {
  if (!uiContext) return;
  if (uiContext.title || uiContext.process) {
    setActiveApp({ process: uiContext.process, title: uiContext.title });
  }
  const els = Array.isArray(uiContext.elements) ? uiContext.elements : [];
  const names = Array.from(new Set(
    els.map(e => String(e.name || '').trim()).filter(n => n.length >= 2 && n.length <= 75)
  )).slice(0, 18);
  screenSnapshot = {
    title: String(uiContext.title || '').slice(0, 80),
    updatedAt: Date.now(),
    items: names
  };
}

function clearScreenSnapshot() {
  screenSnapshot = { title: '', updatedAt: 0, items: [] };
}

function getPromptContext(transcript) {
  const mem = loadMemory();
  const matchedAliases = findMatchingAliases(transcript);
  const matchedSkills = findMatchingSkills(transcript);
  const recentHistory = mem.history.slice(-2).map(h => `${String(h.user || '').slice(0, 40)}=>${String(h.summary || '').slice(0, 40)}`);
  // Volatile screen snapshot: expire after 20s so stale UI never bloats unrelated prompts
  const freshScreen = (Date.now() - screenSnapshot.updatedAt < 20000 && screenSnapshot.items.length > 0)
    ? { title: screenSnapshot.title, items: screenSnapshot.items.slice(0, 8) }
    : null;
  return {
    activeApp: mem.activeApp || null,
    matchedAliases,
    matchedSkills,
    skillsCount: Array.isArray(mem.skills) ? mem.skills.length : 0,
    facts: mem.facts.slice(-3),
    recentHistory,
    freshScreen,
    tutorialGuide: isTutorialQuestion(transcript) ? WIS_KNOWLEDGE : ''
  };
}

module.exports = {
  loadMemory,
  saveMemory,
  learnAlias,
  addFact,
  learnSkill,
  removeSkill,
  findMatchingSkills,
  findExactSkill,
  recordHistory,
  setActiveApp,
  setScreenSnapshot,
  clearScreenSnapshot,
  findMatchingAliases,
  isTutorialQuestion,
  getWhisperPromptHints,
  getPromptContext,
  getSkillsFilePath,
  getMemoryFilePath,
  WIS_KNOWLEDGE
};
