const { ipcRenderer, shell } = require('electron');

// DOM Elements - Navigation & Shell
const shellContainer = document.querySelector('.shell');
const sidebarToggleBtn = document.getElementById('toggle');
const navButtons = document.querySelectorAll('nav [data-page]');
const sections = document.querySelectorAll('.content > section');
const sectionTitleEl = document.getElementById('section-name');
const btnCloseWindow = document.getElementById('btn-close-window');

// DOM Elements - Settings (Tahap 1)
const apiKeyInput = document.getElementById('api-key');
const toggleKeyBtn = document.getElementById('toggle-key-visibility');
const linkGroq = document.getElementById('link-groq');
const languageSelect = document.getElementById('language');
const modelSelect = document.getElementById('model');
const micSelect = document.getElementById('mic-select');
const noiseGateToggle = document.getElementById('noise-gate-toggle');
const noiseGateThreshold = document.getElementById('noise-gate-threshold');
const noiseGateVal = document.getElementById('noise-gate-val');
const disableAgcToggle = document.getElementById('disable-agc-toggle');
const voiceAssistantToggle = document.getElementById('voice-assistant');
const autoStartToggle = document.getElementById('auto-start');
const btnSave = document.getElementById('btn-save');
const btnRestart = document.getElementById('btn-restart-app');
const btnQuit = document.getElementById('btn-quit-app');

// DOM Elements - Voice Profile (Tahap 2)
const badgeVoiceLocked = document.getElementById('badge-voice-locked');
const voiceStatusBanner = document.getElementById('voice-status-banner');
const voiceStatusIcon = document.getElementById('voice-status-icon');
const voiceStatusTitle = document.getElementById('voice-status-title');
const voiceStatusSubtitle = document.getElementById('voice-status-subtitle');
const lockVoiceToggle = document.getElementById('lock-voice-toggle');
const voiceMatchThreshold = document.getElementById('voice-match-threshold');
const voiceThresholdVal = document.getElementById('voice-threshold-val');
const btnRecordVoice = document.getElementById('btn-record-voice');
const btnDeleteVoice = document.getElementById('btn-delete-voice');
const enrollProgressBox = document.getElementById('enroll-progress-box');
const enrollProgressFill = document.getElementById('enroll-progress-fill');
const enrollTimerText = document.getElementById('enroll-timer-text');
const enrollRmsLevel = document.getElementById('enroll-rms-level');
const enrollFeedbackText = document.getElementById('enroll-feedback-text');
const btnTestVoice = document.getElementById('btn-test-voice');
const testResultBox = document.getElementById('test-result-box');
const testMeterFill = document.getElementById('test-meter-fill');
const testScoreText = document.getElementById('test-score-text');
const testVerdictBadge = document.getElementById('test-verdict-badge');

// DOM Elements - Library App & Web
const addForm = document.getElementById('add-form');
const formKTitle = document.getElementById('form-k-title');
const kEditId = document.getElementById('k-edit-id');
const kName = document.getElementById('k-name');
const kType = document.getElementById('k-type');
const kTarget = document.getElementById('k-target');
const kAliases = document.getElementById('k-aliases');
const btnCancelK = document.getElementById('btn-cancel-knowledge');
const kStatus = document.getElementById('k-status');
const kEntriesList = document.getElementById('entries');
const kCount = document.getElementById('count');

// DOM Elements - Log
const logList = document.getElementById('log-list');
const btnClearLogs = document.getElementById('btn-clear-logs');
const logTabBadge = document.getElementById('log-tab-badge');

// DOM Elements - Quota
const btnProbeQuota = document.getElementById('btn-probe-quota');
const btnResetUsage = document.getElementById('btn-reset-usage');
const usageProgressFill = document.getElementById('usage-progress-fill');
const usagePctLabel = document.getElementById('usage-pct-label');
const metricUsedTokens = document.getElementById('metric-used-tokens');
const metricRemTokens = document.getElementById('metric-rem-tokens');
const metricRpd = document.getElementById('metric-rpd');
const metricTpm = document.getElementById('metric-tpm');
const inputCustomLimit = document.getElementById('input-custom-limit');
const btnSetLimit = document.getElementById('btn-set-limit');
const metricAvgTask = document.getElementById('metric-avg-task');
const metricDayCap = document.getElementById('metric-day-cap');
const metricDayRem = document.getElementById('metric-day-rem');

// DOM Elements - Guide
const guideSearchInput = document.getElementById('guide-search');
const guideListContainer = document.getElementById('guide-list');

// Internal State
let currentConfig = {};
let currentKnowledgeList = [];
let isKeyVisible = false;
let isRecordingEnrollment = false;
let isTestingVoice = false;

// =========================================================================
// 1. SIDEBAR & NAVIGATION
// =========================================================================
sidebarToggleBtn.addEventListener('click', () => {
  const isCompact = shellContainer.classList.toggle('compact');
  sidebarToggleBtn.setAttribute('aria-expanded', String(!isCompact));
  sidebarToggleBtn.setAttribute('aria-label', isCompact ? 'Lebarkan sidebar' : 'Ringkas sidebar');
});

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    navButtons.forEach(b => b.removeAttribute('aria-current'));
    btn.setAttribute('aria-current', 'page');
    const targetPage = btn.getAttribute('data-page');
    sectionTitleEl.textContent = btn.getAttribute('aria-label') || 'Pengaturan';

    sections.forEach(sec => {
      sec.hidden = (sec.id !== targetPage);
    });

    if (targetPage === 'library-page') refreshKnowledgeView();
    if (targetPage === 'voice-profile-page') refreshVoiceProfileView();
    if (targetPage === 'log-page') loadCommandLogs();
    if (targetPage === 'quota-page') loadUsageSummary();
    if (targetPage === 'guide-page') renderGuideModules();
  });
});

btnCloseWindow.addEventListener('click', () => {
  ipcRenderer.send('hide-settings');
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ipcRenderer.send('hide-settings');
  }
});

// =========================================================================
// 2. GENERAL SETTINGS & TAHAP 1 NOISE GATE
// =========================================================================
toggleKeyBtn.addEventListener('click', () => {
  isKeyVisible = !isKeyVisible;
  apiKeyInput.type = isKeyVisible ? 'text' : 'password';
  toggleKeyBtn.textContent = isKeyVisible ? '🙈' : '👁';
});

linkGroq.addEventListener('click', (e) => {
  e.preventDefault();
  shell.openExternal('https://console.groq.com/keys');
});

noiseGateThreshold.addEventListener('input', () => {
  noiseGateVal.textContent = `${noiseGateThreshold.value} dB`;
});

async function loadMicrophoneDevices(selectedId) {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    micSelect.innerHTML = '<option value="default">Default Sistem</option>';
    audioInputs.forEach((dev, idx) => {
      const opt = document.createElement('option');
      opt.value = dev.deviceId;
      opt.textContent = dev.label || `Mikrofon ${idx + 1}`;
      if (dev.deviceId === selectedId) opt.selected = true;
      micSelect.appendChild(opt);
    });
  } catch (err) {
    console.warn('Gagal membaca perangkat mikrofon:', err);
  }
}

async function loadConfig() {
  currentConfig = await ipcRenderer.invoke('get-config') || {};
  apiKeyInput.value = currentConfig.apiKey || '';
  languageSelect.value = currentConfig.language || 'auto';
  modelSelect.value = currentConfig.model || 'whisper-large-v3-turbo';
  voiceAssistantToggle.checked = currentConfig.voiceAssistant !== false;
  autoStartToggle.checked = currentConfig.autoStart !== false;

  // Tahap 1 Settings
  noiseGateToggle.checked = currentConfig.noiseGateEnabled !== false;
  noiseGateThreshold.value = currentConfig.noiseGateThreshold !== undefined ? currentConfig.noiseGateThreshold : -38;
  noiseGateVal.textContent = `${noiseGateThreshold.value} dB`;
  disableAgcToggle.checked = currentConfig.autoGainControl === false;

  // Tahap 2 Settings
  lockVoiceToggle.checked = currentConfig.lockToOwnerVoice === true;
  voiceMatchThreshold.value = currentConfig.voiceMatchThreshold || 70;
  voiceThresholdVal.textContent = `${voiceMatchThreshold.value}%`;
  updateVoiceLockBadge(currentConfig.lockToOwnerVoice);

  await loadMicrophoneDevices(currentConfig.deviceId);
}

btnSave.addEventListener('click', async () => {
  const updated = {
    apiKey: apiKeyInput.value.trim(),
    language: languageSelect.value,
    model: modelSelect.value,
    deviceId: micSelect.value,
    voiceAssistant: voiceAssistantToggle.checked,
    autoStart: autoStartToggle.checked,
    // Tahap 1
    noiseGateEnabled: noiseGateToggle.checked,
    noiseGateThreshold: Number(noiseGateThreshold.value),
    autoGainControl: !disableAgcToggle.checked,
    // Tahap 2
    lockToOwnerVoice: lockVoiceToggle.checked,
    voiceMatchThreshold: Number(voiceMatchThreshold.value)
  };

  await ipcRenderer.invoke('save-config', updated);
  currentConfig = { ...currentConfig, ...updated };
  updateVoiceLockBadge(updated.lockToOwnerVoice);

  btnSave.textContent = '✓ Tersimpan!';
  setTimeout(() => {
    btnSave.textContent = 'Simpan Pengaturan';
  }, 1800);
});

btnRestart.addEventListener('click', () => {
  if (confirm('Muat ulang aplikasi Whisper Widget?')) {
    ipcRenderer.send('restart-app');
  }
});

btnQuit.addEventListener('click', () => {
  if (confirm('Keluar dari aplikasi Whisper Widget?')) {
    ipcRenderer.send('quit-app');
  }
});

// =========================================================================
// 3. VOICE IDENTITY & SPEAKER VERIFICATION (TAHAP 2)
// =========================================================================
lockVoiceToggle.addEventListener('change', () => {
  updateVoiceLockBadge(lockVoiceToggle.checked);
});

voiceMatchThreshold.addEventListener('input', () => {
  voiceThresholdVal.textContent = `${voiceMatchThreshold.value}%`;
});

function updateVoiceLockBadge(isLocked) {
  if (isLocked) {
    badgeVoiceLocked.classList.remove('hidden');
  } else {
    badgeVoiceLocked.classList.add('hidden');
  }
}

async function refreshVoiceProfileView() {
  const profile = await ipcRenderer.invoke('get-voice-profile');
  if (profile && profile.mfcc) {
    voiceStatusIcon.textContent = '🔒';
    voiceStatusTitle.textContent = 'Profil Sidik Suara Aktif (Terdaftar)';
    voiceStatusSubtitle.textContent = `Tersimpan: Pitch ~${profile.meanPitch || 130} Hz · ${profile.framesCount || 0} frame vokal · Spektral ~${profile.meanCentroid || 2400} Hz`;
    btnDeleteVoice.hidden = false;
    btnRecordVoice.textContent = '↻ Rekam Ulang Sampel Suara (5 Detik)';
  } else {
    voiceStatusIcon.textContent = '⚪';
    voiceStatusTitle.textContent = 'Belum Ada Profil Suara Terdaftar';
    voiceStatusSubtitle.textContent = 'Klik tombol di bawah untuk merekam 5 detik sampel suara pemilik.';
    btnDeleteVoice.hidden = true;
    btnRecordVoice.textContent = '● Mulai Rekam Sampel Suara (5 Detik)';
  }
}

btnDeleteVoice.addEventListener('click', async () => {
  if (confirm('Hapus profil sidik suara pemilik? Fitur kunci suara akan dinonaktifkan.')) {
    await ipcRenderer.invoke('delete-voice-profile');
    lockVoiceToggle.checked = false;
    updateVoiceLockBadge(false);
    await refreshVoiceProfileView();
    enrollFeedbackText.textContent = 'Profil suara berhasil dihapus.';
  }
});

// Record audio sample and extract PCM Float32Array using native Web Audio
async function capturePcmAudio(durationSec, onProgress) {
  const baseConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false
  };

  const stream = (currentConfig.deviceId && currentConfig.deviceId !== 'default')
    ? await navigator.mediaDevices.getUserMedia({ audio: { ...baseConstraints, deviceId: { exact: currentConfig.deviceId } } })
    : await navigator.mediaDevices.getUserMedia({ audio: baseConstraints });

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  const chunks = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.start();

  const startTime = Date.now();
  const totalMs = durationSec * 1000;
  const timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(100, (elapsed / totalMs) * 100);
    const remainSec = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));

    // Calculate live RMS
    const pcmData = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(pcmData);
    let sumSq = 0;
    for (let i = 0; i < pcmData.length; i++) sumSq += pcmData[i] * pcmData[i];
    const rms = Math.sqrt(sumSq / pcmData.length);
    const db = Math.round(20 * Math.log10(Math.max(1e-4, rms)));

    onProgress({ progress, remainSec, db, rms });
  }, 100);

  await new Promise(r => setTimeout(r, totalMs));
  clearInterval(timerInterval);

  await new Promise((resolve) => {
    mediaRecorder.onstop = resolve;
    mediaRecorder.stop();
  });

  stream.getTracks().forEach(t => t.stop());

  const blob = new Blob(chunks, { type: 'audio/webm' });
  const arrayBuf = await blob.arrayBuffer();
  const decoded = await audioCtx.decodeAudioData(arrayBuf);
  await audioCtx.close();

  return {
    pcm: Array.from(decoded.getChannelData(0)),
    sampleRate: decoded.sampleRate
  };
}

// Enrollment Handler (5 Seconds)
btnRecordVoice.addEventListener('click', async () => {
  if (isRecordingEnrollment) return;
  isRecordingEnrollment = true;
  btnRecordVoice.disabled = true;
  enrollProgressBox.classList.remove('hidden');
  enrollFeedbackText.textContent = '';

  try {
    const { pcm, sampleRate } = await capturePcmAudio(5, ({ progress, remainSec, db }) => {
      enrollProgressFill.style.width = `${progress}%`;
      enrollTimerText.textContent = `Merekam... Sisa ${remainSec} detik`;
      enrollRmsLevel.textContent = `Level Mic: ${db} dB`;
    });

    enrollTimerText.textContent = 'Menganalisis karakteristik akustik vokal...';
    const result = await ipcRenderer.invoke('enroll-voice-profile', { pcm, sampleRate });

    if (result && result.ok) {
      enrollFeedbackText.textContent = `✓ Berhasil! Sidik suara tersimpan (Pitch rata-rata: ${result.profile.meanPitch} Hz).`;
      lockVoiceToggle.checked = true;
      updateVoiceLockBadge(true);
      await refreshVoiceProfileView();
    } else {
      enrollFeedbackText.textContent = `Gagal: ${result?.message || 'Suara terlalu pelan atau tidak terdengar jelas.'}`;
    }
  } catch (err) {
    enrollFeedbackText.textContent = `Terjadi kesalahan mic: ${err.message}`;
  } finally {
    isRecordingEnrollment = false;
    btnRecordVoice.disabled = false;
    setTimeout(() => {
      enrollProgressBox.classList.add('hidden');
    }, 2500);
  }
});

// Live Testing Handler (3 Seconds)
btnTestVoice.addEventListener('click', async () => {
  if (isTestingVoice) return;
  const profile = await ipcRenderer.invoke('get-voice-profile');
  if (!profile) {
    alert('Daftarkan sampel suara pemilik terlebih dahulu di atas sebelum melakukan tes.');
    return;
  }

  isTestingVoice = true;
  btnTestVoice.disabled = true;
  testResultBox.classList.remove('hidden');
  testScoreText.innerHTML = 'Mendengarkan ucapan... (3 detik)';
  testMeterFill.style.width = '0%';
  testVerdictBadge.className = 'verdict-badge';
  testVerdictBadge.textContent = 'Merekam...';

  try {
    const { pcm, sampleRate } = await capturePcmAudio(3, ({ progress }) => {
      testMeterFill.style.width = `${progress * 0.5}%`;
    });

    testScoreText.innerHTML = 'Membandingkan sidik suara...';
    const evalRes = await ipcRenderer.invoke('verify-voice-match', { pcm, sampleRate });

    if (evalRes) {
      const score = evalRes.score || 0;
      testMeterFill.style.width = `${score}%`;
      testScoreText.innerHTML = `Skor Kemiripan: <strong>${score}%</strong> (Ambang: ${voiceMatchThreshold.value}%)`;

      if (evalRes.match) {
        testMeterFill.style.background = '#22c55e';
        testVerdictBadge.className = 'verdict-badge verdict-match';
        testVerdictBadge.textContent = '✓ Suara Pemilik Terverifikasi';
      } else {
        testMeterFill.style.background = '#ef4444';
        testVerdictBadge.className = 'verdict-badge verdict-mismatch';
        testVerdictBadge.textContent = '✗ Suara Ditolak (Bukan Pemilik / Noise)';
      }
    }
  } catch (err) {
    testScoreText.textContent = `Error mic: ${err.message}`;
  } finally {
    isTestingVoice = false;
    btnTestVoice.disabled = false;
  }
});

// =========================================================================
// 4. LIBRARY APP & WEB
// =========================================================================
async function refreshKnowledgeView() {
  currentKnowledgeList = await ipcRenderer.invoke('get-apps-knowledge') || [];
  kCount.textContent = `Daftar Tersimpan (${currentKnowledgeList.length})`;
  kEntriesList.innerHTML = '';

  if (currentKnowledgeList.length === 0) {
    kEntriesList.innerHTML = '<p style="color:#888;margin:10px 0;">Belum ada aplikasi atau website tersimpan.</p>';
    return;
  }

  currentKnowledgeList.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'row';

    const info = document.createElement('div');
    info.innerHTML = `
      <strong>${item.name}</strong> <span style="font-size:11px;color:#60a5fa;margin-left:6px;">[${item.type === 'web' ? 'Web' : 'App'}]</span>
      <small>${item.target} ${item.aliases ? '· Alias: ' + item.aliases : ''}</small>
    `;

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const testBtn = document.createElement('button');
    testBtn.type = 'button';
    testBtn.textContent = 'Buka';
    testBtn.title = 'Uji buka link atau aplikasi ini';
    testBtn.addEventListener('click', async () => {
      const res = await ipcRenderer.invoke('test-open-knowledge', item);
      kStatus.textContent = res.message || 'Membuka...';
    });

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      kEditId.value = item.id;
      kName.value = item.name;
      kType.value = item.type || 'web';
      kTarget.value = item.target;
      kAliases.value = item.aliases || '';
      formKTitle.textContent = `Edit: ${item.name}`;
      btnCancelK.hidden = false;
      kName.focus();
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = 'Hapus';
    delBtn.addEventListener('click', async () => {
      if (confirm(`Hapus "${item.name}" dari Library?`)) {
        currentKnowledgeList.splice(index, 1);
        await ipcRenderer.invoke('save-apps-knowledge', currentKnowledgeList);
        kStatus.textContent = `"${item.name}" dihapus.`;
        refreshKnowledgeView();
      }
    });

    actions.append(testBtn, editBtn, delBtn);
    row.append(info, actions);
    kEntriesList.appendChild(row);
  });
}

kType.addEventListener('change', () => {
  kTarget.placeholder = kType.value === 'web' ? 'https://artax.id' : 'C:\\App\\Artax.exe';
});

btnCancelK.addEventListener('click', () => {
  kEditId.value = '';
  addForm.reset();
  formKTitle.textContent = 'Tambah Aplikasi atau Website';
  btnCancelK.hidden = true;
  kStatus.textContent = '';
});

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = kName.value.trim();
  const type = kType.value;
  const target = kTarget.value.trim();
  const aliases = kAliases.value.trim();
  const editId = kEditId.value.trim();

  if (!name || !target) {
    kStatus.textContent = 'Nama dan Target wajib diisi.';
    return;
  }

  if (editId) {
    const idx = currentKnowledgeList.findIndex(k => k.id === editId);
    if (idx !== -1) {
      currentKnowledgeList[idx] = { id: editId, name, type, target, aliases };
      kStatus.textContent = `"${name}" berhasil diperbarui.`;
    }
  } else {
    currentKnowledgeList.push({
      id: 'k-' + Date.now(),
      name,
      type,
      target,
      aliases
    });
    kStatus.textContent = `"${name}" berhasil ditambahkan ke Library.`;
  }

  await ipcRenderer.invoke('save-apps-knowledge', currentKnowledgeList);
  kEditId.value = '';
  addForm.reset();
  formKTitle.textContent = 'Tambah Aplikasi atau Website';
  btnCancelK.hidden = true;
  refreshKnowledgeView();
});

// =========================================================================
// 5. LIVE COMMAND ACTIVITY LOG
// =========================================================================
async function loadCommandLogs() {
  const logs = await ipcRenderer.invoke('get-command-logs') || [];
  renderLogs(logs);
}

function renderLogs(logs) {
  if (!logs || logs.length === 0) {
    logList.innerHTML = '<div class="log-empty">Belum ada riwayat perintah suara.<br>Ucapkan perintah ke Wis untuk memantau aktivitasnya di sini.</div>';
    logTabBadge.classList.add('hidden');
    return;
  }

  logTabBadge.textContent = String(logs.length);
  logTabBadge.classList.remove('hidden');
  logList.innerHTML = '';

  logs.forEach(log => {
    const item = document.createElement('div');
    item.className = 'log-item';

    const statusTag = log.status === 'done'
      ? '<span class="log-status-tag tag-done">Selesai</span>'
      : (log.status === 'running'
        ? '<span class="log-status-tag tag-running">Berjalan</span>'
        : '<span class="log-status-tag tag-error">Gagal</span>');

    item.innerHTML = `
      <div class="log-left">
        <span class="log-user">"${log.transcript || '-'}"</span>
        <span class="log-reply">${log.reply || log.summary || '-'}</span>
      </div>
      <div>${statusTag}</div>
    `;
    logList.appendChild(item);
  });
}

btnClearLogs.addEventListener('click', async () => {
  await ipcRenderer.invoke('clear-completed-logs');
  loadCommandLogs();
});

ipcRenderer.on('command-logs-updated', (e, logs) => {
  renderLogs(logs);
});

// =========================================================================
// 6. TOKEN & KUOTA GROQ API
// =========================================================================
async function loadUsageSummary() {
  const summary = await ipcRenderer.invoke('get-usage-summary');
  if (!summary) return;

  const used = summary.todayTokens || 0;
  const limit = summary.dailyLimit || 200000;
  const pct = Math.min(100, Math.round((used / limit) * 100));

  usageProgressFill.style.width = `${pct}%`;
  usagePctLabel.textContent = `${pct}%`;
  metricUsedTokens.textContent = used.toLocaleString('id-ID');
  metricRemTokens.textContent = Math.max(0, limit - used).toLocaleString('id-ID');
  metricRpd.textContent = summary.rpd ? `${summary.rpdRemaining || '-'} / ${summary.rpdLimit || '-'}` : '-';
  metricTpm.textContent = summary.tpmLimit ? summary.tpmLimit.toLocaleString('id-ID') : '-';

  if (summary.avgTokensPerTask) {
    metricAvgTask.textContent = `${summary.avgTokensPerTask.toLocaleString('id-ID')} tkn`;
  }
  if (summary.dailyCapacityTasks) {
    metricDayCap.textContent = `${summary.dailyCapacityTasks} tugas`;
  }
  if (summary.remainingTasksToday !== undefined) {
    metricDayRem.textContent = `${summary.remainingTasksToday} tugas`;
  }
}

btnProbeQuota.addEventListener('click', async () => {
  btnProbeQuota.textContent = 'Memeriksa...';
  await ipcRenderer.invoke('probe-api-quota');
  await loadUsageSummary();
  btnProbeQuota.textContent = 'Cek Kuota API';
});

btnResetUsage.addEventListener('click', async () => {
  if (confirm('Reset hitungan statistik token hari ini?')) {
    await ipcRenderer.invoke('reset-today-usage');
    await loadUsageSummary();
  }
});

btnSetLimit.addEventListener('click', async () => {
  const val = Number(inputCustomLimit.value);
  if (val && val >= 1000) {
    await ipcRenderer.invoke('set-custom-daily-limit', val);
    await loadUsageSummary();
    inputCustomLimit.value = '';
  }
});

ipcRenderer.on('usage-summary-updated', () => {
  loadUsageSummary();
});

// =========================================================================
// 7. PANDUAN DENGAN TOMBOL "COBA" INTERAKTIF
// =========================================================================
const GUIDE_COMMANDS = [
  {
    title: 'Navigasi YouTube & Web',
    desc: 'Buka YouTube dan langsung cari lagu/konten tanpa klik manual.',
    example: 'buka youtube cari lofi hip hop',
    category: 'browser'
  },
  {
    title: 'Kontrol Media & Video',
    desc: 'Jeda, lanjutkan, mute, atau aktifkan layar penuh pada video aktif.',
    example: 'play video',
    category: 'media'
  },
  {
    title: 'Klik Video Samping / Rekomendasi',
    desc: 'Klik video yang ada di kolom rekomendasi samping YouTube.',
    example: 'klik video di samping',
    category: 'vision'
  },
  {
    title: 'Pengaturan Kecerahan Layar',
    desc: 'Ubah tingkat kecerahan layar laptop secara presisi atau bertahap.',
    example: 'turunkan brightness jadi 30%',
    category: 'brightness'
  },
  {
    title: 'Buka Aplikasi & Web dari Library',
    desc: 'Membuka aplikasi atau web yang didaftarkan di tab Library secara instan.',
    example: 'buka artax',
    category: 'knowledge'
  },
  {
    title: 'Manajemen Jendela Windows',
    desc: 'Kecilkan, besarkan, atau tutup jendela aplikasi aktif.',
    example: 'minimize jendela',
    category: 'window'
  },
  {
    title: 'Scroll Layar Otomatis',
    desc: 'Menggulir halaman web atau dokumen secara perlahan.',
    example: 'scroll pelan-pelan ke bawah',
    category: 'navigasi'
  },
  {
    title: 'Tanya Isi Layar (Vision)',
    desc: 'Minta Wis melihat layar dan menjawab apa yang sedang terbuka.',
    example: 'ada apa di layar sekarang?',
    category: 'vision'
  }
];

function renderGuideModules(filterQuery = '') {
  guideListContainer.innerHTML = '';
  const q = String(filterQuery || '').toLowerCase().trim();

  const filtered = GUIDE_COMMANDS.filter(item => {
    return !q || item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q) || item.example.toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    guideListContainer.innerHTML = '<p style="color:#888;">Tidak ada perintah yang sesuai pencarian.</p>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'guide-item';

    const info = document.createElement('div');
    info.className = 'guide-item-info';
    info.innerHTML = `
      <span class="guide-item-title">${item.title}</span>
      <span class="guide-item-desc">${item.desc}</span>
      <span class="guide-item-example">Ucapkan: "${item.example}"</span>
    `;

    const tryBtn = document.createElement('button');
    tryBtn.type = 'button';
    tryBtn.className = 'btn-try-guide';
    tryBtn.textContent = 'Coba';
    tryBtn.title = `Jalankan perintah "${item.example}" sekarang`;
    tryBtn.addEventListener('click', async () => {
      tryBtn.textContent = 'Menjalankan...';
      tryBtn.disabled = true;
      try {
        await ipcRenderer.invoke('execute-voice-command', item.example);
        tryBtn.textContent = '✓ Berhasil';
      } catch (err) {
        tryBtn.textContent = 'Gagal';
      } finally {
        setTimeout(() => {
          tryBtn.textContent = 'Coba';
          tryBtn.disabled = false;
        }, 2200);
      }
    });

    card.append(info, tryBtn);
    guideListContainer.appendChild(card);
  });
}

guideSearchInput.addEventListener('input', () => {
  renderGuideModules(guideSearchInput.value);
});

// =========================================================================
// INITIALIZATION
// =========================================================================
window.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await refreshKnowledgeView();
  await refreshVoiceProfileView();
  loadCommandLogs();
  loadUsageSummary();
  renderGuideModules();
});
