const { ipcRenderer, shell } = require('electron');

// DOM Elements - Navigation & Steps
const stepItems = document.querySelectorAll('.step-item');
const stepPages = document.querySelectorAll('.step-page');
const btnCloseWindow = document.getElementById('btn-close-window');
const btnMinimizeWindow = document.getElementById('btn-minimize-window');

// Navigation Buttons
const btnNext1 = document.getElementById('btn-next-1');
const btnPrev2 = document.getElementById('btn-prev-2');
const btnNext2 = document.getElementById('btn-next-2');
const btnPrev3 = document.getElementById('btn-prev-3');
const btnNext3 = document.getElementById('btn-next-3');
const btnPrev4 = document.getElementById('btn-prev-4');
const btnFinishLaunch = document.getElementById('btn-finish-launch');

// Step 2 Inputs - Provider & API
const obProvider = document.getElementById('ob-provider');
const obBaseUrl = document.getElementById('ob-base-url');
const obEndpointHint = document.getElementById('ob-endpoint-hint');
const obApiKeyLabel = document.getElementById('ob-api-key-label');
const obLinkProvider = document.getElementById('ob-link-provider');
const obApiKey = document.getElementById('ob-api-key');
const obToggleKey = document.getElementById('ob-toggle-key');
const obBtnFetchModels = document.getElementById('ob-btn-fetch-models');
const obModelSelect = document.getElementById('ob-model-select');
const obApiStatus = document.getElementById('ob-api-status');

// Step 3 Inputs - Preferences
const obPrefShortcut = document.getElementById('ob-pref-shortcut');
const obPrefAutostart = document.getElementById('ob-pref-autostart');
const obPrefVoiceAssistant = document.getElementById('ob-pref-voice-assistant');
const obPrefLanguage = document.getElementById('ob-pref-language');

// Step 4 Summary Elements
const sumProvider = document.getElementById('sum-provider');
const sumModel = document.getElementById('sum-model');
const sumIntegrations = document.getElementById('sum-integrations');

let currentStep = 1;
let isKeyVisible = false;

// Provider Presets
const PROVIDER_PRESETS = {
  geminix: {
    name: 'GeminiX Gateway',
    baseUrl: 'https://geminix.arss.fun/v1',
    hint: 'Endpoint default GeminiX: https://geminix.arss.fun/v1',
    keyPlaceholder: 'sk-gx-...',
    defaultModel: 'gemini-3.8-flash-high',
    defaultModels: [
      'gemini-3.8-flash-high',
      'gemini-3-flash',
      'gemini-3.8-pro-high',
      'gemini-2.5-flash',
      'claude-sonnet-4-6',
      'claude-opus-4-6-thinking'
    ],
    dashboardUrl: ''
  },
  groq: {
    name: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    hint: 'Endpoint resmi Groq Cloud: https://api.groq.com/openai/v1',
    keyPlaceholder: 'gsk_...',
    defaultModel: 'whisper-large-v3',
    defaultModels: [
      'whisper-large-v3',
      'whisper-large-v3-turbo',
      'openai/gpt-oss-20b',
      'meta/llama-3.3-70b-versatile'
    ],
    dashboardUrl: 'https://console.groq.com/keys'
  },
  openai: {
    name: 'OpenAI Official',
    baseUrl: 'https://api.openai.com/v1',
    hint: 'Endpoint resmi OpenAI: https://api.openai.com/v1',
    keyPlaceholder: 'sk-...',
    defaultModel: 'gpt-4o-mini',
    defaultModels: [
      'whisper-1',
      'gpt-4o-mini',
      'gpt-4o'
    ],
    dashboardUrl: 'https://platform.openai.com/api-keys'
  },
  custom: {
    name: 'Custom Gateway',
    baseUrl: '',
    hint: 'Masukkan Base URL OpenAI-compatible gateway Anda',
    keyPlaceholder: 'Kunci API gateway Anda...',
    defaultModel: '',
    defaultModels: [],
    dashboardUrl: ''
  }
};

// =========================================================================
// STEPPER NAVIGATION
// =========================================================================
function goToStep(step) {
  if (step < 1 || step > 4) return;
  currentStep = step;

  stepPages.forEach((page, idx) => {
    page.classList.toggle('active', idx + 1 === step);
  });

  stepItems.forEach((item, idx) => {
    const itemStep = idx + 1;
    item.classList.remove('active', 'completed');
    if (itemStep === step) {
      item.classList.add('active');
    } else if (itemStep < step) {
      item.classList.add('completed');
    }
  });

  if (step === 4) {
    updateConfirmationSummary();
  }
}

function updateConfirmationSummary() {
  const prov = PROVIDER_PRESETS[obProvider.value] || { name: 'Custom Gateway' };
  sumProvider.textContent = `${prov.name} (${obBaseUrl.value.trim() || 'Default'})`;
  sumModel.textContent = obModelSelect.value || 'gemini-3.8-flash-high';

  const intItems = [];
  if (obPrefShortcut.checked) intItems.push('Desktop Shortcut');
  if (obPrefAutostart.checked) intItems.push('Auto-start');
  if (obPrefVoiceAssistant.checked) intItems.push('Wis Assistant');
  sumIntegrations.textContent = intItems.length > 0 ? intItems.join(', ') : 'Standar (Manual)';
}

btnNext1?.addEventListener('click', () => goToStep(2));
btnPrev2?.addEventListener('click', () => goToStep(1));
btnNext2?.addEventListener('click', () => goToStep(3));
btnPrev3?.addEventListener('click', () => goToStep(2));
btnNext3?.addEventListener('click', () => goToStep(4));
btnPrev4?.addEventListener('click', () => goToStep(3));

// =========================================================================
// STEP 2: PROVIDER & API LOGIC
// =========================================================================
function setApiStatus(status, text) {
  obApiStatus.className = `api-status-badge status-${status}`;
  obApiStatus.textContent = text;
}

function updateProviderUi(provKey) {
  const p = PROVIDER_PRESETS[provKey] || PROVIDER_PRESETS.geminix;
  if (p.baseUrl) obBaseUrl.value = p.baseUrl;
  obEndpointHint.textContent = p.hint;
  obApiKey.placeholder = p.keyPlaceholder;
  obApiKeyLabel.textContent = `API Key ${p.name}`;

  if (p.dashboardUrl) {
    obLinkProvider.style.display = 'inline-block';
    obLinkProvider.href = p.dashboardUrl;
    obLinkProvider.textContent = 'Ambil Kunci API ↗';
  } else {
    obLinkProvider.style.display = 'none';
  }

  populateModelOptions(p.defaultModels, p.defaultModel);
  setApiStatus('idle', 'Belum Terhubung');
}

function populateModelOptions(models, selectedModel) {
  obModelSelect.innerHTML = '';
  const list = (models && models.length > 0) ? models : ['gemini-3.8-flash-high'];

  list.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    if (m === selectedModel) opt.selected = true;
    obModelSelect.appendChild(opt);
  });
}

async function fetchApiModels() {
  const rawBase = (obBaseUrl.value || '').trim();
  const apiKey = (obApiKey.value || '').trim();

  if (!rawBase) {
    setApiStatus('error', 'Base URL kosong');
    return;
  }

  setApiStatus('loading', 'Mengambil model...');
  obBtnFetchModels.disabled = true;

  try {
    const res = await ipcRenderer.invoke('fetch-api-models', { baseUrl: rawBase, apiKey });
    if (res && res.ok && Array.isArray(res.models) && res.models.length > 0) {
      populateModelOptions(res.models, obModelSelect.value);
      setApiStatus('success', `Terhubung (${res.models.length} Model)`);
    } else {
      setApiStatus('error', res?.message || 'Gagal memuat model');
    }
  } catch (err) {
    setApiStatus('error', err.message);
  } finally {
    obBtnFetchModels.disabled = false;
  }
}

obProvider.addEventListener('change', () => {
  updateProviderUi(obProvider.value);
});

obBtnFetchModels.addEventListener('click', () => {
  fetchApiModels();
});

obToggleKey.addEventListener('click', () => {
  isKeyVisible = !isKeyVisible;
  obApiKey.type = isKeyVisible ? 'text' : 'password';
  obToggleKey.style.opacity = isKeyVisible ? '1' : '0.6';
  obToggleKey.title = isKeyVisible ? 'Sembunyikan Key' : 'Lihat Key';
});

obLinkProvider.addEventListener('click', (e) => {
  e.preventDefault();
  const url = obLinkProvider.href;
  if (url && url.startsWith('http')) {
    shell.openExternal(url);
  }
});

// =========================================================================
// STEP 4: FINISH & LAUNCH
// =========================================================================
btnFinishLaunch.addEventListener('click', async () => {
  btnFinishLaunch.disabled = true;
  btnFinishLaunch.querySelector('span').textContent = 'Menyiapkan Whisper Widget...';

  const cleanBase = obBaseUrl.value.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');

  const configData = {
    provider: obProvider.value,
    baseUrl: cleanBase,
    apiKey: obApiKey.value.trim(),
    model: obModelSelect.value || 'gemini-3.8-flash-high',
    language: obPrefLanguage.value,
    autoStart: obPrefAutostart.checked,
    voiceAssistant: obPrefVoiceAssistant.checked,
    createShortcut: obPrefShortcut.checked,
    setupCompleted: true
  };

  try {
    const res = await ipcRenderer.invoke('finish-onboarding', configData);
    if (!res || !res.ok) {
      alert('Gagal menyelesaikan setup:\n' + (res?.message || 'Terjadi kesalahan sistem'));
      btnFinishLaunch.disabled = false;
      btnFinishLaunch.querySelector('span').textContent = 'Selesaikan & Buka Whisper Widget';
    }
  } catch (err) {
    alert('Error setup: ' + err.message);
    btnFinishLaunch.disabled = false;
    btnFinishLaunch.querySelector('span').textContent = 'Selesaikan & Buka Whisper Widget';
  }
});

// Window Action Buttons
btnCloseWindow.addEventListener('click', () => {
  ipcRenderer.send('close-onboarding');
});

btnMinimizeWindow.addEventListener('click', () => {
  ipcRenderer.send('minimize-onboarding');
});

// =========================================================================
// WIS INTERACTIVE FACE (Mouse-Tracking Eyes, No Jumping/Pulsing)
// =========================================================================
function initWisInteractiveFace() {
  const canvas = document.getElementById('wis-face-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const pill = document.getElementById('wis-interactive-face');

  let gaze = { x: 0, y: 0 };
  let targetGaze = { x: 0, y: 0 };
  let isBlinking = false;
  let blinkProgress = 1;
  let lastBlink = performance.now();

  window.addEventListener('mousemove', (e) => {
    if (!pill) return;
    const rect = pill.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = (e.clientX - centerX) / (window.innerWidth / 2);
    const dy = (e.clientY - centerY) / (window.innerHeight / 2);
    targetGaze.x = Math.max(-1, Math.min(1, dx));
    targetGaze.y = Math.max(-1, Math.min(1, dy));
  });

  pill.addEventListener('click', () => {
    isBlinking = true;
    blinkProgress = 0;
  });

  function render(now) {
    gaze.x += (targetGaze.x - gaze.x) * 0.12;
    gaze.y += (targetGaze.y - gaze.y) * 0.12;

    if (!isBlinking && now - lastBlink > 3500 + Math.random() * 2000) {
      isBlinking = true;
      blinkProgress = 0;
      lastBlink = now;
    }

    if (isBlinking) {
      blinkProgress += 0.085;
      if (blinkProgress >= 1) {
        blinkProgress = 1;
        isBlinking = false;
      }
    }

    const eyeOpen = isBlinking ? (blinkProgress < 0.5 ? 1 - blinkProgress * 2 : (blinkProgress - 0.5) * 2) : 1;
    const eyeH = Math.max(3, 26 * Math.max(0.08, eyeOpen));
    const eyeW = 14;

    ctx.clearRect(0, 0, 136, 136);

    const offsetX = gaze.x * 12;
    const offsetY = gaze.y * 10;
    const leftEyeX = 68 - 18 + offsetX;
    const rightEyeX = 68 + 18 + offsetX;
    const eyeY = 68 + offsetY;

    ctx.fillStyle = '#FFFFFF';

    drawRoundedPill(ctx, leftEyeX - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH, eyeW / 2);
    drawRoundedPill(ctx, rightEyeX - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH, eyeW / 2);

    requestAnimationFrame(render);
  }

  function drawRoundedPill(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) {
      c.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
    } else {
      c.rect(x, y, w, h);
    }
    c.fill();
  }

  requestAnimationFrame(render);
}

// Initialize on Load
window.addEventListener('DOMContentLoaded', () => {
  updateProviderUi('geminix');
  initWisInteractiveFace();
});
