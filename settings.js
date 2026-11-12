const { ipcRenderer, shell } = require('electron');

const settingsCard = document.querySelector('.settings-card');
const apiKeyInput = document.getElementById('api-key');
const toggleKeyBtn = document.getElementById('toggle-key-visibility');
const iconEye = document.getElementById('icon-eye');
const iconEyeOff = document.getElementById('icon-eye-off');
const linkGroq = document.getElementById('link-groq');
const languageSelect = document.getElementById('language');
const modelSelect = document.getElementById('model');
const micSelect = document.getElementById('mic-select');
const voiceAssistantCheckbox = document.getElementById('voice-assistant');
const autoStartCheckbox = document.getElementById('auto-start');
const btnSave = document.getElementById('btn-save');
const btnRestartApp = document.getElementById('btn-restart-app');
const btnQuitApp = document.getElementById('btn-quit-app');
const btnCloseWindow = document.getElementById('btn-close-window');
const tabBtnSettings = document.getElementById('tab-btn-settings');
const tabBtnLog = document.getElementById('tab-btn-log');
const tabBtnUsage = document.getElementById('tab-btn-usage');
const tabBtnGuide = document.getElementById('tab-btn-guide');
const panelSettings = document.getElementById('panel-settings');
const panelLog = document.getElementById('panel-log');
const panelUsage = document.getElementById('panel-usage');
const panelGuide = document.getElementById('panel-guide');
const settingsFooter = document.getElementById('settings-footer');
const guideSearchInput = document.getElementById('guide-search');
const guideList = document.getElementById('guide-list');
const guideStatusToast = document.getElementById('guide-status-toast');
const logTabBadge = document.getElementById('log-tab-badge');
const logSummaryText = document.getElementById('log-summary-text');
const logList = document.getElementById('log-list');
const btnClearLogs = document.getElementById('btn-clear-logs');
const usageKeyPill = document.getElementById('usage-key-pill');
const btnProbeQuota = document.getElementById('btn-probe-quota');
const btnResetUsage = document.getElementById('btn-reset-usage');
const usagePctLabel = document.getElementById('usage-pct-label');
const usageProgressFill = document.getElementById('usage-progress-fill');
const metricUsedTokens = document.getElementById('metric-used-tokens');
const metricRemTokens = document.getElementById('metric-rem-tokens');
const metricRpd = document.getElementById('metric-rpd');
const metricTpm = document.getElementById('metric-tpm');
const inputCustomLimit = document.getElementById('input-custom-limit');
const btnSetLimit = document.getElementById('btn-set-limit');
const usageAvgSource = document.getElementById('usage-avg-source');
const metricAvgTask = document.getElementById('metric-avg-task');
const metricDayCap = document.getElementById('metric-day-cap');
const metricDayRem = document.getElementById('metric-day-rem');
const usageSimTokens = document.getElementById('usage-sim-tokens');
const usageSimResult = document.getElementById('usage-sim-result');
const usageWhisperInfo = document.getElementById('usage-whisper-info');
const usageModelsList = document.getElementById('usage-models-list');
const usageTasksList = document.getElementById('usage-tasks-list');

let isClosing = false;
let activeTab = 'settings';
let latestLogs = [];
let latestUsageSummary = null;
let logTickTimer = null;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatClock(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  } catch {
    return '';
  }
}

function formatDuration(ms) {
  const sec = Math.max(0, Number(ms || 0) / 1000);
  return `${sec.toFixed(1)} dtk`;
}

function formatNumberId(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '-';
  return Number(num).toLocaleString('id-ID');
}

function switchTab(tabName) {
  activeTab = (tabName === 'log' || tabName === 'usage' || tabName === 'guide') ? tabName : 'settings';
  const showSettings = activeTab === 'settings';
  const showLog = activeTab === 'log';
  const showUsage = activeTab === 'usage';
  const showGuide = activeTab === 'guide';

  tabBtnSettings.classList.toggle('is-active', showSettings);
  tabBtnSettings.setAttribute('aria-selected', String(showSettings));
  tabBtnLog.classList.toggle('is-active', showLog);
  tabBtnLog.setAttribute('aria-selected', String(showLog));
  tabBtnUsage.classList.toggle('is-active', showUsage);
  tabBtnUsage.setAttribute('aria-selected', String(showUsage));
  tabBtnGuide.classList.toggle('is-active', showGuide);
  tabBtnGuide.setAttribute('aria-selected', String(showGuide));

  panelSettings.classList.toggle('hidden', !showSettings);
  settingsFooter.classList.toggle('hidden', !showSettings);
  panelLog.classList.toggle('hidden', !showLog);
  panelUsage.classList.toggle('hidden', !showUsage);
  panelGuide.classList.toggle('hidden', !showGuide);

  if (showLog) {
    ipcRenderer.invoke('get-command-logs').then(renderCommandLogs).catch(() => { });
  } else if (showUsage) {
    ipcRenderer.invoke('get-usage-summary').then(renderUsageSummary).catch(() => { });
  } else if (showGuide) {
    loadAndRenderGuide();
  }
}

function renderStatusCircle(item) {
  if (item.status === 'done') {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  }
  if (item.status === 'error') {
    return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  }
  if (item.status === 'queued') {
    const qNum = item.queuePos > 0 ? item.queuePos : '';
    return `<span class="log-spinner"></span>${qNum ? `<span class="log-queue-num">${qNum}</span>` : ''}`;
  }
  return `<span class="log-spinner"></span>`;
}

function updateLiveDurations() {
  const now = Date.now();
  const els = logList.querySelectorAll('.log-duration[data-created]');
  els.forEach((el) => {
    const created = Number(el.getAttribute('data-created'));
    if (created > 0) {
      el.textContent = formatDuration(now - created);
    }
  });
}

function syncDurationTicker(hasActive) {
  if (hasActive && !logTickTimer) {
    logTickTimer = setInterval(updateLiveDurations, 200);
  } else if (!hasActive && logTickTimer) {
    clearInterval(logTickTimer);
    logTickTimer = null;
  }
}

function renderCommandLogs(logs) {
  latestLogs = Array.isArray(logs) ? logs : [];

  const runningCount = latestLogs.filter(x => x.status === 'running').length;
  const queuedCount = latestLogs.filter(x => x.status === 'queued').length;
  const doneCount = latestLogs.filter(x => x.status === 'done').length;
  const errorCount = latestLogs.filter(x => x.status === 'error').length;
  const activeCount = runningCount + queuedCount;

  syncDurationTicker(activeCount > 0);

  if (activeCount > 0) {
    logTabBadge.textContent = String(activeCount);
    logTabBadge.classList.remove('hidden', 'all-done');
    logTabBadge.classList.add('has-active');
  } else if (doneCount > 0) {
    logTabBadge.textContent = String(doneCount);
    logTabBadge.classList.remove('hidden', 'has-active');
    logTabBadge.classList.add('all-done');
  } else {
    logTabBadge.classList.add('hidden');
  }

  if (latestLogs.length === 0) {
    logSummaryText.textContent = 'Belum ada perintah';
    logList.innerHTML = `
      <div class="log-empty">
        Belum ada perintah suara.<br>
        Klik ikon Wis lalu ucapkan perintah untuk memantau antrean &amp; status pengerjaan di sini.
      </div>`;
    return;
  }

  const parts = [];
  if (runningCount > 0) parts.push(`${runningCount} diproses`);
  if (queuedCount > 0) parts.push(`${queuedCount} antrean`);
  if (doneCount > 0) parts.push(`${doneCount} selesai`);
  if (errorCount > 0) parts.push(`${errorCount} gagal`);
  logSummaryText.textContent = parts.join(' · ') || `${latestLogs.length} perintah`;

  logList.innerHTML = latestLogs.map((item) => {
    const isActive = item.status === 'running' || item.status === 'queued';
    const durText = isActive
      ? formatDuration(Date.now() - Number(item.createdAt || Date.now()))
      : formatDuration(item.durationMs || 0);
    const durAttr = isActive ? ` data-created="${Number(item.createdAt || Date.now())}"` : '';
    const stageText = item.stage || (item.status === 'done' ? 'Selesai' : 'Memproses...');
    const tokTotal = Number(item.usage?.totalTokens || 0);
    const durWithTokens = tokTotal > 0 ? `${durText} · ${formatNumberId(tokTotal)} tkn` : durText;

    return `
      <div class="log-item status-${escapeHtml(item.status)}">
        <div class="log-circle" aria-label="${escapeHtml(item.status)}">
          ${renderStatusCircle(item)}
        </div>
        <div class="log-body">
          <div class="log-top">
            <span class="log-title">${escapeHtml(item.transcript || '(Perintah kosong)')}</span>
            <span class="log-time">${escapeHtml(formatClock(item.createdAt))}</span>
          </div>
          <div class="log-bottom">
            <span class="log-stage" title="${escapeHtml(stageText)}">${escapeHtml(stageText)}</span>
            <span class="log-duration"${durAttr}>${escapeHtml(durWithTokens)}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function updateSimulationPreview() {
  if (!latestUsageSummary) {
    usageSimResult.textContent = '';
    return;
  }
  const simVal = Number(usageSimTokens.value);
  const avg = (Number.isFinite(simVal) && simVal >= 100) ? simVal : latestUsageSummary.avgTokensPerTask;
  const lim = latestUsageSummary.dailyTokenLimit;
  const rem = latestUsageSummary.remainingDailyTokens;
  if (!lim || !avg) {
    usageSimResult.textContent = '';
    return;
  }
  let cap = Math.floor(lim / avg);
  let remTasks = rem !== null ? Math.floor(rem / avg) : cap;
  if (latestUsageSummary.rpdLimit !== null) cap = Math.min(cap, latestUsageSummary.rpdLimit);
  if (latestUsageSummary.rpdRemaining !== null) remTasks = Math.min(remTasks, latestUsageSummary.rpdRemaining);
  usageSimResult.textContent = (Number.isFinite(simVal) && simVal >= 100)
    ? `≈ ${formatNumberId(cap)}/hr (sisa ${formatNumberId(remTasks)})`
    : '';
}

function renderUsageSummary(summary) {
  latestUsageSummary = summary || null;
  if (!summary) return;

  usageKeyPill.textContent = `API: ${summary.keyHint || 'Belum diisi'}`;
  const limit = summary.dailyTokenLimit;
  const used = Number(summary.primaryTokensUsed || 0);
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  usagePctLabel.textContent = limit ? `${pct}%` : 'TPD -';
  usageProgressFill.style.width = `${pct}%`;
  usageProgressFill.classList.toggle('is-warn', pct >= 80);

  metricUsedTokens.textContent = limit
    ? `${formatNumberId(used)} / ${formatNumberId(limit)}`
    : `${formatNumberId(summary.totalTokensToday)} tkn`;
  metricRemTokens.textContent = summary.remainingDailyTokens !== null
    ? `${formatNumberId(summary.remainingDailyTokens)} tkn`
    : '-';

  metricRpd.textContent = summary.rpdLimit !== null
    ? `${formatNumberId(summary.rpdRemaining)} / ${formatNumberId(summary.rpdLimit)}`
    : 'Belum dicek';
  metricTpm.textContent = summary.tpmLimit !== null
    ? `${formatNumberId(summary.tpmRemaining)} / ${formatNumberId(summary.tpmLimit)}`
    : 'Belum dicek';

  if (document.activeElement !== inputCustomLimit) {
    inputCustomLimit.value = summary.customDailyTokenLimit || summary.dailyTokenLimit || '';
  }

  usageAvgSource.textContent = summary.isEstimatedAvg
    ? 'Estimasi awal'
    : `Dari ${summary.taskTokenSamples} tugas API ini`;
  metricAvgTask.textContent = `${formatNumberId(summary.avgTokensPerTask)} tkn`;
  metricDayCap.textContent = summary.estimatedTasksPerDay !== null
    ? `± ${formatNumberId(summary.estimatedTasksPerDay)} tugas`
    : '-';
  metricDayRem.textContent = summary.estimatedRemainingTasksToday !== null
    ? `± ${formatNumberId(summary.estimatedRemainingTasksToday)} lagi`
    : '-';
  updateSimulationPreview();

  usageWhisperInfo.textContent = `Whisper: ${summary.whisperCallsToday || 0} call (${Number(summary.whisperSecondsToday || 0).toFixed(1)} dtk)`;

  const models = Array.isArray(summary.models) ? summary.models : [];
  usageModelsList.innerHTML = models.length === 0
    ? '<div class="usage-empty-mini">Belum ada pemanggilan API pada API key ini hari ini. Klik "Cek Data API" atau beri 1 perintah.</div>'
    : models.map((m) => {
      const limParts = [];
      if (m.rpdRemaining !== null && m.rpdLimit !== null) limParts.push(`RPD ${formatNumberId(m.rpdRemaining)}/${formatNumberId(m.rpdLimit)}`);
      if (m.tpmRemaining !== null && m.tpmLimit !== null) limParts.push(`TPM ${formatNumberId(m.tpmRemaining)}/${formatNumberId(m.tpmLimit)}`);
      const rightTxt = `${m.calls}x · ${formatNumberId(m.tokens)} tkn${limParts.length ? ' · ' + limParts.join(' · ') : ''}`;
      return `<div class="usage-mini-row"><span class="usage-mini-left">${escapeHtml(m.model)}</span><span class="usage-mini-right">${escapeHtml(rightTxt)}</span></div>`;
    }).join('');

  const tasks = Array.isArray(summary.recentTasks) ? summary.recentTasks : [];
  usageTasksList.innerHTML = tasks.length === 0
    ? ''
    : tasks.slice(0, 6).map((t) => `
      <div class="usage-mini-row">
        <span class="usage-mini-left" title="${escapeHtml(t.transcript)}">${escapeHtml(t.transcript || '(Kosong)')}</span>
        <span class="usage-mini-right">${formatNumberId(t.totalTokens)} tkn (In ${formatNumberId(t.promptTokens)} / Out ${formatNumberId(t.completionTokens)})</span>
      </div>`).join('');
}

const MANUAL_MODULES = [
  {
    id: 'basics',
    badge: 'Modul 1',
    title: 'Aktivasi Wis, Dikte Teks, & Sapaan',
    desc: 'Klik ikon mata biru (Alt+Shift+C) untuk masuk mode standby merah tanpa sapaan pembuka. Ucapkan perintah lalu jeda ~0.9 detik. Tombol mikrofon besar di bawah (Alt+Shift+V) khusus untuk mengetikkan ucapan langsung ke posisi kursor.',
    examples: [
      { say: 'Aplikasi apa yang lagi saya buka sekarang?', note: 'Cek ingatan aplikasi aktif Wis saat ini', runnable: true },
      { say: 'Halo Wis, kamu bisa apa saja?', note: 'Minta Wis menjelaskan kemampuannya lewat suara', runnable: true }
    ]
  },
  {
    id: 'windows',
    badge: 'Modul 2',
    title: 'Buka Aplikasi, Alt+Tab, & Kontrol Jendela',
    desc: 'Jika aplikasi sudah terbuka di Alt+Tab, Wis otomatis pindah ke jendela itu (tidak membuka duplikat). Anda juga bisa langsung mengecilkan, membesarkan, atau fullscreen aplikasi mana pun.',
    examples: [
      { say: 'Buka Alt Tab', note: 'Menampilkan daftar semua jendela terbuka', runnable: true },
      { say: 'Buka Chrome', note: 'Pindah ke Chrome yang terbuka atau buka baru', runnable: true },
      { say: 'Minimize Chrome', note: 'Mengecilkan jendela Chrome ke taskbar', runnable: true },
      { say: 'Maximize aplikasi ini', note: 'Membesarkan jendela aktif di layar', runnable: true },
      { say: 'Fullscreen aplikasi ini', note: 'Masuk/keluar mode layar penuh (F11)', runnable: true },
      { say: 'Buka folder Downloads', note: 'Folder: Downloads, Documents, Desktop, Recycle Bin', runnable: true }
    ]
  },
  {
    id: 'youtube',
    badge: 'Modul 3',
    title: 'YouTube, Browser, & Kontrol Video Cepat',
    desc: 'Cari lagu/channel di YouTube, buka video berdasarkan urutan ke-1 s/d ke-10 atau judul, pindah tab, kembali, serta kontrol play/pause/mute super cepat tanpa jeda Vision.',
    examples: [
      { say: 'Buka YouTube', note: 'Membuka YouTube di browser', runnable: true },
      { say: 'Telusuri 420', note: 'Otomatis mencari "Fourtwnty" di kolom Telusuri YouTube', runnable: true },
      { say: 'Klik video pertama', note: 'Bisa urutan ke-1 s/d ke-10 ("video keempat") atau sebut judul', runnable: true },
      { say: 'Pause video ini', note: 'Jeda/lanjutkan video instan (shortcut K)', runnable: true },
      { say: 'Fullscreen video', note: 'Layar penuh pemutar YouTube (shortcut F)', runnable: true },
      { say: 'Kembali ke halaman sebelumnya', note: 'Navigasi Back (Alt+Left)', runnable: true }
    ]
  },
  {
    id: 'vision',
    badge: 'Modul 4',
    title: 'Penglihatan Layar (Vision) & Klik Elemen',
    desc: 'Wis dapat melihat layar lewat UI Automation + Grid Catur 5x4 (A1-E4), lalu meluncur mengklik profil Chrome, tombol, menu, atau mengetik ke kotak input tertentu.',
    examples: [
      { say: 'Lihat layar ini, ada apa saja?', note: 'Membaca & merangkum isi layar aktif saat ini', runnable: true },
      { say: 'Pilih profil Chrome [Nama]', note: 'Mengklik profil browser atau tombol sesuai nama', runnable: false },
      { say: 'Klik tombol Generate', note: 'Mengarahkan kursor visual lalu klik elemen target', runnable: false }
    ]
  },
  {
    id: 'scrollzoom',
    badge: 'Modul 5',
    title: 'Scroll Otomatis 3D & Zoom Layar',
    desc: 'Mata Wis ikut bergulir 3D ke atas/bawah/kiri/kanan saat menggulir, melotot saat zoom in, dan mengecil saat zoom out.',
    examples: [
      { say: 'Scroll ke bawah', note: 'Gulir sekali ke bawah / atas / kiri / kanan', runnable: true },
      { say: 'Scroll pelan-pelan ke bawah sampai saya suruh berhenti', note: 'Gulir kontinu lembut sampai ada perintah berhenti', runnable: true },
      { say: 'Berhenti', note: 'Menghentikan scroll otomatis langsung', runnable: true },
      { say: 'Zoom in', note: 'Perbesar tampilan (Ctrl + Plus) atau bilang "Zoom out" / "Reset zoom"', runnable: true }
    ]
  },
  {
    id: 'word',
    badge: 'Modul 6',
    title: 'Microsoft Word & Dokumen',
    desc: 'Buat dokumen baru, buka file dari Documents/Desktop/Downloads, buat draf tulisan otomatis, perbaiki typo/tata bahasa, dan simpan.',
    examples: [
      { say: 'Buat dokumen Word baru', note: 'Membuka Word dengan dokumen kosong baru', runnable: true },
      { say: 'Tulis surat permohonan izin kerja', note: 'AI menulis draf rapi langsung ke dokumen Word', runnable: false },
      { say: 'Perbaiki ejaan dan tata bahasa dokumen ini', note: 'Merevisi isi dokumen Word agar rapi', runnable: false },
      { say: 'Simpan dokumen', note: 'Menyimpan perubahan Word', runnable: false }
    ]
  },
  {
    id: 'selflearn',
    badge: 'Modul 7',
    title: 'Ajari AI Skill & Kamus Baru (Tanpa Coding)',
    desc: 'Anda bisa mengajari Wis kosakata khusus (learn_alias) maupun resep tugas baru / multi-langkah (learn_skill). Skill yang sudah dipelajari persis dijalankan instan 0 token AI!',
    examples: [
      { say: 'Wis belajar, kalau saya bilang bersihkan layar, minimize Chrome', note: 'Mengajari skill baru permanen ke wis-memory.json', runnable: true },
      { say: 'Wis ingat kalau saya bilang air trade maksudnya iTrade', note: 'Menambahkan kamus pengucapan baru', runnable: true },
      { say: 'Wis ingat catatan bahwa saya suka musik indie', note: 'Menyimpan fakta pribadi ke ingatan Wis', runnable: true }
    ]
  },
  {
    id: 'monitor',
    badge: 'Modul 8',
    title: 'Pantau Antrean (Log) & Kapasitas (Token & Kuota)',
    desc: 'Tab Log menampilkan antrean perintah real-time (spinner biru/amber -> checklist hijau saat selesai, plus biaya tokennya). Tab Token & Kuota menghitung sisa RPD/TPM API Key aktif dan perkiraan kapasitas tugas per hari.',
    examples: []
  }
];

let cachedMemoryOverview = null;

async function loadAndRenderGuide() {
  cachedMemoryOverview = await ipcRenderer.invoke('get-memory-overview').catch(() => ({ skills: [], facts: [], aliases: [] }));
  renderGuideModules();
}

function showGuideToast(msg) {
  guideStatusToast.textContent = msg;
  guideStatusToast.classList.remove('hidden');
  clearTimeout(showGuideToast._t);
  showGuideToast._t = setTimeout(() => {
    guideStatusToast.classList.add('hidden');
  }, 2000);
}

function renderGuideModules() {
  const q = String(guideSearchInput?.value || '').trim().toLowerCase();
  const filtered = MANUAL_MODULES.filter((mod) => {
    if (!q) return true;
    if (mod.title.toLowerCase().includes(q) || mod.desc.toLowerCase().includes(q)) return true;
    return mod.examples.some(ex => ex.say.toLowerCase().includes(q) || ex.note.toLowerCase().includes(q));
  });

  const blocks = filtered.map((mod) => {
    const exHtml = mod.examples.map((ex) => `
      <div class="guide-cmd-row">
        <div class="guide-cmd-info">
          <span class="guide-cmd-say">"${escapeHtml(ex.say)}"</span>
          <span class="guide-cmd-note">${escapeHtml(ex.note)}</span>
        </div>
        ${ex.runnable ? `<button type="button" class="btn-try-cmd" data-cmd="${escapeHtml(ex.say)}">▶ Coba</button>` : ''}
      </div>`).join('');

    return `
      <div class="guide-module">
        <div class="guide-module-head">
          <span class="guide-module-title">${escapeHtml(mod.title)}</span>
          <span class="guide-module-badge">${escapeHtml(mod.badge)}</span>
        </div>
        <div class="guide-module-desc">${escapeHtml(mod.desc)}</div>
        ${exHtml ? `<div class="guide-examples">${exHtml}</div>` : ''}
      </div>`;
  });

  const mem = cachedMemoryOverview || { skills: [], facts: [], aliases: [] };
  const skillsHtml = mem.skills.length === 0
    ? '<div class="usage-empty-mini">Belum ada skill kustom tersimpan.</div>'
    : mem.skills.map((s) => {
      const synTxt = Array.isArray(s.synonyms) && s.synonyms.length ? ` · juga: ${s.synonyms.slice(0, 2).join(', ')}` : '';
      return `
      <div class="guide-cmd-row">
        <div class="guide-cmd-info">
          <span class="guide-cmd-say">"${escapeHtml(s.trigger)}"</span>
          <span class="guide-cmd-note">${escapeHtml(s.description || '')}${escapeHtml(synTxt)}</span>
        </div>
        <button type="button" class="btn-try-cmd" data-cmd="${escapeHtml(s.trigger)}">▶ Jalankan</button>
      </div>`;
    }).join('');

  const aliasesPreview = mem.aliases.slice(-8).map(([k, v]) => `${k} → ${v}`).join(' · ');

  blocks.push(`
    <div class="guide-module guide-mem-card">
      <div class="guide-module-head">
        <span class="guide-module-title">Skill Portabel &amp; Kamus (skills.json)</span>
        <span class="guide-module-badge">${mem.skills.length} skill · ${mem.aliases.length} alias</span>
      </div>
      <div class="guide-examples">${skillsHtml}</div>
      ${aliasesPreview ? `<div class="guide-module-desc">Kamus terbaru: ${escapeHtml(aliasesPreview)}</div>` : ''}
    </div>`);

  guideList.innerHTML = blocks.join('');

  guideList.querySelectorAll('.btn-try-cmd').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const cmd = btn.getAttribute('data-cmd');
      if (!cmd) return;
      btn.disabled = true;
      await ipcRenderer.invoke('enqueue-voice-command', { transcript: cmd }).catch(() => {});
      btn.disabled = false;
      showGuideToast(`Dikirim: "${cmd.slice(0, 22)}${cmd.length > 22 ? '...' : ''}"`);
    });
  });
}

tabBtnSettings.addEventListener('click', () => switchTab('settings'));
tabBtnLog.addEventListener('click', () => switchTab('log'));
tabBtnUsage.addEventListener('click', () => switchTab('usage'));
tabBtnGuide.addEventListener('click', () => switchTab('guide'));
guideSearchInput.addEventListener('input', renderGuideModules);
btnClearLogs.addEventListener('click', async () => {
  const remaining = await ipcRenderer.invoke('clear-completed-logs').catch(() => []);
  renderCommandLogs(remaining);
});
btnProbeQuota.addEventListener('click', async () => {
  const candidateKey = apiKeyInput.value.trim();
  btnProbeQuota.disabled = true;
  btnProbeQuota.textContent = 'Mengecek...';
  try {
    const res = await ipcRenderer.invoke('probe-api-quota', candidateKey);
    renderUsageSummary(res);
  } catch (err) {
    usageAvgSource.textContent = (err && err.message) ? err.message.slice(0, 48) : 'Gagal cek API';
  } finally {
    btnProbeQuota.disabled = false;
    btnProbeQuota.textContent = 'Cek Data API';
  }
});
btnSetLimit.addEventListener('click', async () => {
  const summary = await ipcRenderer.invoke('set-custom-daily-limit', inputCustomLimit.value);
  renderUsageSummary(summary);
});
btnResetUsage.addEventListener('click', async () => {
  const summary = await ipcRenderer.invoke('reset-today-usage');
  renderUsageSummary(summary);
});
usageSimTokens.addEventListener('input', updateSimulationPreview);

ipcRenderer.on('command-logs-updated', (event, logs) => {
  renderCommandLogs(logs);
});

ipcRenderer.on('usage-updated', (event, summary) => {
  renderUsageSummary(summary);
});

function playOpenAnimation(originX, originY) {
  isClosing = false;
  if (originX !== undefined && originY !== undefined) {
    settingsCard.style.setProperty('--origin-x', `${originX}px`);
    settingsCard.style.setProperty('--origin-y', `${originY}px`);
  }
  settingsCard.classList.remove('is-closing', 'is-open');
  settingsCard.style.animation = 'none';
  void settingsCard.offsetWidth;
  settingsCard.style.animation = '';
  settingsCard.classList.add('is-open');
}

function closeWithAnimation() {
  if (isClosing) return;
  isClosing = true;
  settingsCard.classList.remove('is-open');
  settingsCard.style.animation = 'none';
  void settingsCard.offsetWidth;
  settingsCard.style.animation = '';
  settingsCard.classList.add('is-closing');

  setTimeout(() => {
    ipcRenderer.send('settings-closed-done');
  }, 210);
}

async function applyConfigToForm(config) {
  if (!config) return;
  if (config.apiKey) apiKeyInput.value = config.apiKey;
  if (config.language) languageSelect.value = config.language;
  if (config.model) modelSelect.value = config.model;
  voiceAssistantCheckbox.checked = config.voiceAssistant !== false;
  if (config.autoStart !== undefined) autoStartCheckbox.checked = config.autoStart;
  await loadMicrophones(config.deviceId);
}

ipcRenderer.on('settings-open', async (event, { originX, originY }) => {
  const [config, logs, usageSummary] = await Promise.all([
    ipcRenderer.invoke('get-config'),
    ipcRenderer.invoke('get-command-logs').catch(() => []),
    ipcRenderer.invoke('get-usage-summary').catch(() => null)
  ]);
  await applyConfigToForm(config);
  renderCommandLogs(logs);
  renderUsageSummary(usageSummary);
  btnSave.disabled = false;
  btnSave.textContent = 'Simpan';
  playOpenAnimation(originX, originY);
});

ipcRenderer.on('settings-request-close', () => {
  closeWithAnimation();
});

// Populate available microphones
async function loadMicrophones(selectedDeviceId) {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    micSelect.innerHTML = '<option value="default">Default Sistem</option>';

    audioInputs.forEach((device, idx) => {
      if (device.deviceId === 'default' || device.deviceId === 'communications') return;
      const opt = document.createElement('option');
      opt.value = device.deviceId;
      opt.textContent = device.label || `Mikrofon ${idx + 1}`;
      micSelect.appendChild(opt);
    });

    if (selectedDeviceId) {
      micSelect.value = selectedDeviceId;
      if (!micSelect.value) micSelect.value = 'default';
    }
  } catch (err) {
    console.warn('Could not list audio devices:', err);
  }
}

// Load current configuration, logs & usage
ipcRenderer.invoke('get-config').then(applyConfigToForm);
ipcRenderer.invoke('get-command-logs').then(renderCommandLogs).catch(() => { });
ipcRenderer.invoke('get-usage-summary').then(renderUsageSummary).catch(() => { });

// Close window via top-right X button
btnCloseWindow.addEventListener('click', () => {
  closeWithAnimation();
});

// Close on Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeWithAnimation();
});

// Toggle password visibility with crisp SVG icons
toggleKeyBtn.addEventListener('click', () => {
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    iconEye.classList.add('hidden');
    iconEyeOff.classList.remove('hidden');
  } else {
    apiKeyInput.type = 'password';
    iconEye.classList.remove('hidden');
    iconEyeOff.classList.add('hidden');
  }
});

// Open external browser for Groq registration
linkGroq.addEventListener('click', (e) => {
  e.preventDefault();
  shell.openExternal('https://console.groq.com/keys');
});

// Save configuration
btnSave.addEventListener('click', async () => {
  const newConfig = {
    apiKey: apiKeyInput.value.trim(),
    language: languageSelect.value,
    model: modelSelect.value,
    deviceId: micSelect.value,
    voiceAssistant: voiceAssistantCheckbox.checked,
    autoStart: autoStartCheckbox.checked
  };

  btnSave.disabled = true;
  btnSave.textContent = 'Menyimpan...';

  await ipcRenderer.invoke('save-config', newConfig);

  btnSave.textContent = 'Tersimpan!';
  setTimeout(() => {
    closeWithAnimation();
  }, 260);
});

if (btnRestartApp) {
  btnRestartApp.addEventListener('click', () => {
    ipcRenderer.send('restart-app');
  });
}

if (btnQuitApp) {
  btnQuitApp.addEventListener('click', () => {
    ipcRenderer.send('quit-app');
  });
}
