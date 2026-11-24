const { ipcRenderer, shell } = require('electron');

// DOM Elements - Navigation & Shell
const shellContainer = document.querySelector('.shell');
const sidebarToggleBtn = document.getElementById('toggle');
const navButtons = document.querySelectorAll('nav [data-page]');
const sections = document.querySelectorAll('.content > section');
const sectionTitleEl = document.getElementById('section-name');
const btnCloseWindow = document.getElementById('btn-close-window');

// DOM Elements - Settings (Tahap 1 & Universal Gateway)
const apiProviderSelect = document.getElementById('api-provider');
const apiBaseUrlInput = document.getElementById('api-base-url');
const endpointHint = document.getElementById('endpoint-hint');
const apiKeyLabel = document.getElementById('api-key-label');
const linkProvider = document.getElementById('link-provider');
const apiKeyInput = document.getElementById('api-key');
const toggleKeyBtn = document.getElementById('toggle-key-visibility');
const modelSelect = document.getElementById('model-select');
const customModelInput = document.getElementById('custom-model-input');
const btnFetchModels = document.getElementById('btn-fetch-models');
const apiStatusBadge = document.getElementById('api-status-badge');
const modelDescHint = document.getElementById('model-desc-hint');
const languageSelect = document.getElementById('language');
const micSelect = document.getElementById('mic-select');
const noiseGateToggle = document.getElementById('noise-gate-toggle');
const noiseGateThreshold = document.getElementById('noise-gate-threshold');
const noiseGateVal = document.getElementById('noise-gate-val');
const disableAgcToggle = document.getElementById('disable-agc-toggle');
const voiceAssistantToggle = document.getElementById('voice-assistant');
const autoStartToggle = document.getElementById('auto-start');
const btnSave = document.getElementById('btn-save');
const btnOpenOnboarding = document.getElementById('btn-open-onboarding');
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

// DOM Elements - Update Page
const btnCheckUpdate = document.getElementById('btn-check-update');
const btnApplyUpdate = document.getElementById('btn-apply-update');
const updateStatusBadge = document.getElementById('update-status-badge');
const updateCurrentVersion = document.getElementById('update-current-version');
const updateLatestVersion = document.getElementById('update-latest-version');
const updateMethodLabel = document.getElementById('update-method-label');
const updateProgressText = document.getElementById('update-progress-text');
const updateProgressBarWrap = document.getElementById('update-progress-bar-wrap');
const updateProgressFill = document.getElementById('update-progress-fill');
const cardReleaseNotes = document.getElementById('card-release-notes');
const releaseNotesTitle = document.getElementById('release-notes-title');
const releaseNotesContent = document.getElementById('release-notes-content');
const releaseDatePill = document.getElementById('release-date-pill');
const badgeUpdateAvailable = document.getElementById('badge-update-available');
const autoCheckUpdateToggle = document.getElementById('auto-check-update-toggle');
let latestUpdateInfo = null;

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
    if (targetPage === 'update-page') loadUpdatePageView();
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
// 2. GENERAL SETTINGS, UNIVERSAL GATEWAY & TAHAP 1 NOISE GATE
// =========================================================================
const PROVIDER_PRESETS = {
  geminix: {
    name: 'GeminiX Gateway',
    baseUrl: 'https://geminix.arss.fun/v1',
    hint: 'Contoh: https://geminix.arss.fun/v1',
    keyPlaceholder: 'sk-gx-...',
    defaultModel: 'gemini-3.8-flash-high',
    dashboardUrl: '',
    dashboardLabel: '',
    defaultModels: [
      { id: 'gemini-3.8-flash-high', desc: 'Penalaran Adaptif (~3.5s) - Rekomendasi' },
      { id: 'gemini-3-flash', desc: 'Super Cepat (~1.0s) - Respons Kilat' },
      { id: 'gemini-2.5-flash', desc: 'Stabil & Cepat (~1.2s)' },
      { id: 'gemini-3.8-pro-high', desc: 'Flagship Pro Complex Reasoning' },
      { id: 'claude-sonnet-4-6', desc: 'Claude 3.5 Sonnet (~2.5s)' },
      { id: 'claude-opus-4-6-thinking', desc: 'Claude Opus Thinking Mode' },
      { id: 'gemini-4-hydrogen-sonar', desc: 'Gemini 4 Hydrogen Sonar' },
      { id: 'gpt-oss-120b-medium', desc: 'GPT OSS 120B Model' }
    ]
  },
  groq: {
    name: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    hint: 'https://api.groq.com/openai/v1',
    keyPlaceholder: 'gsk_...',
    defaultModel: 'openai/gpt-oss-20b',
    dashboardUrl: 'https://console.groq.com/keys',
    dashboardLabel: 'Ambil Kunci Groq Gratis ↗',
    defaultModels: [
      { id: 'openai/gpt-oss-20b', desc: 'GPT OSS 20B (Cepat & Cerdas)' },
      { id: 'openai/gpt-oss-120b', desc: 'GPT OSS 120B (Penalaran Kompleks)' },
      { id: 'llama-3.3-70b-versatile', desc: 'Llama 3.3 70B Versatile' }
    ]
  },
  openai: {
    name: 'OpenAI Resmi',
    baseUrl: 'https://api.openai.com/v1',
    hint: 'https://api.openai.com/v1',
    keyPlaceholder: 'sk-...',
    defaultModel: 'gpt-4o-mini',
    dashboardUrl: 'https://platform.openai.com/api-keys',
    dashboardLabel: 'Buka OpenAI Dashboard ↗',
    defaultModels: [
      { id: 'gpt-4o-mini', desc: 'GPT-4o Mini (Cepat & Hemat)' },
      { id: 'gpt-4o', desc: 'GPT-4o (Akurasi Tinggi)' },
      { id: 'o1-mini', desc: 'o1-mini (Reasoning)' }
    ]
  },
  custom: {
    name: 'Custom Endpoint',
    baseUrl: '',
    hint: 'Contoh: http://localhost:11434/v1 atau https://openrouter.ai/api/v1',
    keyPlaceholder: 'Masukkan API Key...',
    defaultModel: '',
    dashboardUrl: '',
    dashboardLabel: '',
    defaultModels: []
  }
};

let activeModelsList = [];

function updateProviderUi(providerKey) {
  const preset = PROVIDER_PRESETS[providerKey] || PROVIDER_PRESETS.custom;
  if (providerKey !== 'custom' && preset.baseUrl) {
    apiBaseUrlInput.value = preset.baseUrl;
  }
  endpointHint.textContent = preset.hint || 'Format: https://domain/v1';
  apiKeyInput.placeholder = preset.keyPlaceholder || 'Masukkan API Key...';
  
  if (preset.dashboardUrl && preset.dashboardLabel) {
    linkProvider.textContent = preset.dashboardLabel;
    linkProvider.href = preset.dashboardUrl;
    linkProvider.classList.remove('hidden');
  } else {
    linkProvider.classList.add('hidden');
  }

  // Pre-populate default models if empty
  if (activeModelsList.length === 0 && preset.defaultModels?.length > 0) {
    populateModelOptions(preset.defaultModels, preset.defaultModel);
  }
}

function setApiStatus(type, text) {
  apiStatusBadge.className = `api-status-badge status-${type}`;
  apiStatusBadge.textContent = text;
}

function populateModelOptions(models, selectedModel) {
  activeModelsList = Array.isArray(models) ? models : [];
  modelSelect.innerHTML = '';

  let hasMatch = false;
  activeModelsList.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.desc ? `${m.id} — ${m.desc}` : m.id;
    if (m.id === selectedModel) {
      opt.selected = true;
      hasMatch = true;
    }
    modelSelect.appendChild(opt);
  });

  // Custom option
  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = 'Custom / Ketik Model Lain...';
  if (!hasMatch && selectedModel) {
    customOpt.selected = true;
    customModelInput.value = selectedModel;
    customModelInput.classList.remove('hidden');
  } else {
    customModelInput.classList.add('hidden');
  }
  modelSelect.appendChild(customOpt);

  if (hasMatch) {
    customModelInput.classList.add('hidden');
  }
}

async function fetchApiModels(silent = false) {
  const rawBase = (apiBaseUrlInput.value || '').trim();
  const apiKey = (apiKeyInput.value || '').trim();

  if (!rawBase) {
    if (!silent) setApiStatus('error', 'Base URL kosong');
    return;
  }

  if (!silent) setApiStatus('loading', '🟡 Mengambil model...');
  btnFetchModels.textContent = '⏳ Mengambil...';
  btnFetchModels.disabled = true;

  try {
    const res = await ipcRenderer.invoke('fetch-api-models', { baseUrl: rawBase, apiKey });
    if (res && res.ok && Array.isArray(res.models) && res.models.length > 0) {
      const currentSelected = modelSelect.value === '__custom__' ? customModelInput.value.trim() : modelSelect.value;
      populateModelOptions(res.models, currentSelected);
      setApiStatus('success', `🟢 Terhubung (${res.models.length} Model)`);
    } else {
      setApiStatus('error', `🔴 ${res?.message || 'Gagal mengambil model'}`);
    }
  } catch (err) {
    setApiStatus('error', `🔴 ${err.message}`);
  } finally {
    btnFetchModels.textContent = '🔄 Cek & Muat Model';
    btnFetchModels.disabled = false;
  }
}

apiProviderSelect.addEventListener('change', () => {
  updateProviderUi(apiProviderSelect.value);
  if (apiKeyInput.value.trim()) {
    fetchApiModels(false);
  }
});

btnFetchModels.addEventListener('click', () => {
  fetchApiModels(false);
});

modelSelect.addEventListener('change', () => {
  if (modelSelect.value === '__custom__') {
    customModelInput.classList.remove('hidden');
    customModelInput.focus();
  } else {
    customModelInput.classList.add('hidden');
  }
});

linkProvider.addEventListener('click', (e) => {
  e.preventDefault();
  const url = linkProvider.href;
  if (url && url.startsWith('http')) {
    shell.openExternal(url);
  }
});

toggleKeyBtn.addEventListener('click', () => {
  isKeyVisible = !isKeyVisible;
  apiKeyInput.type = isKeyVisible ? 'text' : 'password';
  toggleKeyBtn.textContent = isKeyVisible ? '🙈' : '👁';
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
  
  // Detect provider
  let prov = currentConfig.provider;
  if (!prov) {
    if (currentConfig.baseUrl?.includes('geminix') || currentConfig.apiKey?.startsWith('sk-gx-')) {
      prov = 'geminix';
    } else if (currentConfig.apiKey?.startsWith('gsk_')) {
      prov = 'groq';
    } else if (currentConfig.apiKey?.startsWith('sk-')) {
      prov = 'openai';
    } else {
      prov = 'geminix';
    }
  }
  apiProviderSelect.value = prov;
  updateProviderUi(prov);

  if (currentConfig.baseUrl) {
    apiBaseUrlInput.value = currentConfig.baseUrl;
  }
  apiKeyInput.value = currentConfig.apiKey || '';
  
  const savedModel = currentConfig.model || PROVIDER_PRESETS[prov]?.defaultModel || 'gemini-3.8-flash-high';
  populateModelOptions(PROVIDER_PRESETS[prov]?.defaultModels || [], savedModel);

  languageSelect.value = currentConfig.language || 'auto';
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

  // Auto fetch models if key is present
  if (apiKeyInput.value.trim()) {
    fetchApiModels(true);
  }
}

btnSave.addEventListener('click', async () => {
  const selectedModel = modelSelect.value === '__custom__' 
    ? (customModelInput.value.trim() || 'gemini-3.8-flash-high') 
    : modelSelect.value;

  const rawBase = apiBaseUrlInput.value.trim();
  const cleanBase = rawBase.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');

  const updated = {
    provider: apiProviderSelect.value,
    baseUrl: cleanBase,
    apiKey: apiKeyInput.value.trim(),
    model: selectedModel,
    language: languageSelect.value,
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

if (btnOpenOnboarding) {
  btnOpenOnboarding.addEventListener('click', () => {
    ipcRenderer.invoke('open-onboarding');
  });
}

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
// 7. IN-APP UPDATE & GITHUB SYNC
// =========================================================================
function setUpdateStatus(type, text) {
  if (!updateStatusBadge) return;
  updateStatusBadge.className = `api-status-badge status-${type}`;
  updateStatusBadge.textContent = text;
}

async function checkForUpdates(manual = false) {
  if (manual) {
    setUpdateStatus('loading', '🟡 Memeriksa...');
    if (btnCheckUpdate) {
      btnCheckUpdate.disabled = true;
      btnCheckUpdate.textContent = '⏳ Memeriksa...';
    }
    if (updateProgressText) updateProgressText.textContent = 'Menghubungkan ke GitHub...';
  }

  try {
    const res = await ipcRenderer.invoke('check-app-update');
    if (!res || !res.ok) {
      if (manual) {
        setUpdateStatus('error', '🔴 Gagal Cek Update');
        if (updateProgressText) updateProgressText.textContent = res?.message || 'Tidak dapat menghubungi GitHub';
      }
      return;
    }

    latestUpdateInfo = res;
    if (updateCurrentVersion) updateCurrentVersion.textContent = res.currentVersion;
    if (updateLatestVersion) updateLatestVersion.textContent = res.latestVersion || res.currentVersion;
    if (updateMethodLabel) updateMethodLabel.textContent = res.isGit ? 'Git Instant Sync' : 'Installer Otomatis';

    if (res.hasUpdate) {
      setUpdateStatus('success', '🟢 Update Tersedia!');
      if (badgeUpdateAvailable) badgeUpdateAvailable.classList.remove('hidden');
      if (btnApplyUpdate) {
        btnApplyUpdate.classList.remove('hidden');
        btnApplyUpdate.textContent = res.isGit ? '🚀 Perbarui Otomatis & Relaunch' : '⬇️ Unduh & Perbarui Otomatis';
      }
      if (updateProgressText) {
        updateProgressText.textContent = res.isGit
          ? `Tersedia pembaruan di GitHub (${res.gitBehind || 1} commit baru). Klik perbarui untuk reload langsung!`
          : `Versi baru ${res.latestVersion} tersedia di GitHub!`;
      }

      if (res.releaseNotes && cardReleaseNotes) {
        cardReleaseNotes.classList.remove('hidden');
        if (releaseNotesTitle) releaseNotesTitle.textContent = res.releaseTitle || `Catatan Rilis ${res.latestVersion}`;
        if (releaseNotesContent) releaseNotesContent.textContent = res.releaseNotes;
        if (releaseDatePill && res.publishedAt) {
          try {
            releaseDatePill.textContent = new Date(res.publishedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' });
          } catch {
            releaseDatePill.textContent = '';
          }
        }
      }
    } else {
      setUpdateStatus('idle', 'Aplikasi Terkini');
      if (badgeUpdateAvailable) badgeUpdateAvailable.classList.add('hidden');
      if (btnApplyUpdate) btnApplyUpdate.classList.add('hidden');
      if (manual && updateProgressText) {
        updateProgressText.textContent = 'Aplikasi sudah menggunakan versi terbaru.';
      }
    }
  } catch (err) {
    if (manual) {
      setUpdateStatus('error', '🔴 Error');
      if (updateProgressText) updateProgressText.textContent = err.message;
    }
  } finally {
    if (manual && btnCheckUpdate) {
      btnCheckUpdate.disabled = false;
      btnCheckUpdate.textContent = '🔄 Periksa Pembaruan Sekarang';
    }
  }
}

async function applyUpdate() {
  if (!latestUpdateInfo) return;

  if (btnApplyUpdate) {
    btnApplyUpdate.disabled = true;
    btnApplyUpdate.textContent = '⏳ Memproses Pembaruan...';
  }
  if (btnCheckUpdate) btnCheckUpdate.disabled = true;

  if (updateProgressText) {
    updateProgressText.textContent = latestUpdateInfo.isGit 
      ? 'Sedang menarik kode terbaru dari GitHub (git pull origin main)...'
      : 'Sedang mengunduh file update dari GitHub...';
  }

  if (updateProgressBarWrap) {
    updateProgressBarWrap.classList.remove('hidden');
    if (updateProgressFill) updateProgressFill.style.width = '45%';
  }

  try {
    const res = await ipcRenderer.invoke('apply-app-update', { downloadUrl: latestUpdateInfo.downloadUrl });
    if (res && res.ok) {
      if (updateProgressFill) updateProgressFill.style.width = '100%';
      setUpdateStatus('success', '🟢 Berhasil!');
      if (updateProgressText) updateProgressText.textContent = res.message || 'Pembaruan berhasil! Merestart aplikasi...';
    } else {
      if (updateProgressBarWrap) updateProgressBarWrap.classList.add('hidden');
      setUpdateStatus('error', '🔴 Gagal');
      if (updateProgressText) updateProgressText.textContent = res?.message || 'Gagal menerapkan pembaruan';
      if (btnApplyUpdate) btnApplyUpdate.disabled = false;
      if (btnCheckUpdate) btnCheckUpdate.disabled = false;
    }
  } catch (err) {
    if (updateProgressBarWrap) updateProgressBarWrap.classList.add('hidden');
    setUpdateStatus('error', '🔴 Error');
    if (updateProgressText) updateProgressText.textContent = err.message;
    if (btnApplyUpdate) btnApplyUpdate.disabled = false;
    if (btnCheckUpdate) btnCheckUpdate.disabled = false;
  }
}

function loadUpdatePageView() {
  if (!latestUpdateInfo) {
    checkForUpdates(true);
  }
}

if (btnCheckUpdate) {
  btnCheckUpdate.addEventListener('click', () => checkForUpdates(true));
}

if (btnApplyUpdate) {
  btnApplyUpdate.addEventListener('click', () => applyUpdate());
}

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
  setTimeout(() => checkForUpdates(false), 3000);
});
