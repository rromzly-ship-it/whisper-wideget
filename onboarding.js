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
    name: 'GeminiX Gateway (ARSS)',
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
      'openai/gpt-oss-120b',
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

  // Update Stepper Bar UI
  stepItems.forEach(item => {
    const itemStep = parseInt(item.getAttribute('data-step'), 10);
    item.classList.remove('active', 'completed');
    if (itemStep === currentStep) {
      item.classList.add('active');
    } else if (itemStep < currentStep) {
      item.classList.add('completed');
    }
  });

  // Switch Active Step Page
  stepPages.forEach(page => {
    page.classList.remove('active');
    if (page.id === `step-${currentStep}`) {
      page.classList.add('active');
    }
  });

  // Update Summary on Step 4
  if (currentStep === 4) {
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

// Step Navigation Listeners
btnNext1.addEventListener('click', () => goToStep(2));

btnPrev2.addEventListener('click', () => goToStep(1));
btnNext2.addEventListener('click', () => goToStep(3));

btnPrev3.addEventListener('click', () => goToStep(2));
btnNext3.addEventListener('click', () => goToStep(4));

btnPrev4.addEventListener('click', () => goToStep(3));

// =========================================================================
// STEP 2: PROVIDER & API LOGIC
// =========================================================================
function setApiStatus(type, text) {
  obApiStatus.className = `api-status-badge status-${type}`;
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
    obLinkProvider.textContent = provKey === 'geminix' ? 'Buka Dashboard ARSS ↗' : 'Ambil Kunci API ↗';
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

  setApiStatus('loading', '🟡 Mengambil model...');
  obBtnFetchModels.textContent = '⏳ Mengambil...';
  obBtnFetchModels.disabled = true;

  try {
    const res = await ipcRenderer.invoke('fetch-api-models', { baseUrl: rawBase, apiKey });
    if (res && res.ok && Array.isArray(res.models) && res.models.length > 0) {
      populateModelOptions(res.models, obModelSelect.value);
      setApiStatus('success', `🟢 Terhubung (${res.models.length} Model)`);
    } else {
      setApiStatus('error', `🔴 ${res?.message || 'Gagal memuat model'}`);
    }
  } catch (err) {
    setApiStatus('error', `🔴 ${err.message}`);
  } finally {
    obBtnFetchModels.textContent = '🔄 Cek & Muat Model';
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
  obToggleKey.textContent = isKeyVisible ? '🙈' : '👁';
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
  btnFinishLaunch.textContent = '⏳ Menyiapkan Whisper Widget...';

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
      btnFinishLaunch.textContent = '🚀 Selesaikan & Buka Whisper Widget';
    }
  } catch (err) {
    alert('Error setup: ' + err.message);
    btnFinishLaunch.disabled = false;
    btnFinishLaunch.textContent = '🚀 Selesaikan & Buka Whisper Widget';
  }
});

// Window Action Buttons
btnCloseWindow.addEventListener('click', () => {
  ipcRenderer.send('close-onboarding');
});

btnMinimizeWindow.addEventListener('click', () => {
  ipcRenderer.send('minimize-onboarding');
});

// Initialize on Load
window.addEventListener('DOMContentLoaded', () => {
  updateProviderUi('geminix');
});
