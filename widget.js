const { ipcRenderer } = require('electron');

const btnContainer = document.getElementById('btn-container');
const btnCircle = document.getElementById('btn-circle');
let currentState = 'idle'; // 'idle' | 'recording' | 'processing'
let mediaRecorder = null;
let audioChunks = [];
let appConfig = null;
let widgetAudioCtx = null;
let widgetAnalyser = null;
let peakDbRecorded = -100;
let vadMonitorTimer = null;

// Initial load config
ipcRenderer.invoke('get-config').then(cfg => {
  appConfig = cfg;
});

ipcRenderer.on('config-updated', (event, updatedConfig) => {
  appConfig = updatedConfig;
});

// Listen for global shortcut
ipcRenderer.on('trigger-toggle', () => {
  ipcRenderer.send('record-target-window');
  handleButtonClick();
});

// Capture target window on hover or click
window.addEventListener('mouseenter', () => {
  ipcRenderer.send('record-target-window');
});

// Shrink & disappear animation before quitting app
ipcRenderer.on('widget-shrink-out', () => {
  btnContainer.classList.add('closing');
  setTimeout(() => {
    ipcRenderer.send('widget-shrink-done');
  }, 290);
});

// Update visual state
function setState(state) {
  currentState = state;
  btnCircle.className = `state-${state}`;
  if (state === 'idle') {
    btnCircle.title = 'Klik untuk mulai bicara (Whisper)';
  } else if (state === 'recording') {
    btnCircle.title = 'Merekam ucapan... Klik untuk berhenti & tempel teks';
  } else if (state === 'processing') {
    btnCircle.title = 'Sedang mentranskripsi dengan Whisper...';
  }
}

// Universal Pointer logic (Mouse, Touchscreen, Stylus Pen)
// Gesture state machine: 'idle' | 'pending' | 'dragging' | 'menu'
let gestureMode = 'idle';
let activePointerId = null;
let lastPointerType = 'mouse';
let grabX = 0;
let grabY = 0;
let moveInFlight = false;
let nativeDragActive = false;
let moveSettledTs = 0;
let lastDragEndTime = 0;
let lastClickTriggerAt = 0;
let lastMenuTriggerAt = 0;
let holdVisualTimer = null;
let holdTriggerTimer = null;

function dbgWidget(msg) {
  try { ipcRenderer.send('log-debug', `[widget] ${msg}`); } catch {}
}

function cancelHoldTimers() {
  if (holdVisualTimer) {
    clearTimeout(holdVisualTimer);
    holdVisualTimer = null;
  }
  if (holdTriggerTimer) {
    clearTimeout(holdTriggerTimer);
    holdTriggerTimer = null;
  }
  btnContainer.classList.remove('holding');
}

function triggerMicSafe() {
  const now = Date.now();
  if (now - lastClickTriggerAt < 280) return;
  if (now - lastMenuTriggerAt < 450) return;
  lastClickTriggerAt = now;
  handleButtonClick();
}

window.addEventListener('pointerdown', (e) => {
  lastPointerType = e.pointerType || 'mouse';

  // Stylus barrel button or mouse right-click
  if (e.button === 2 || (e.pointerType === 'pen' && (e.buttons & 2))) {
    cancelHoldTimers();
    if (e.pointerType === 'pen' && (e.buttons & 2)) {
      gestureMode = 'menu';
      lastMenuTriggerAt = Date.now();
      ipcRenderer.send('toggle-radial-menu');
    }
    return;
  }
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  ipcRenderer.send('record-target-window');
  gestureMode = 'pending';
  activePointerId = e.pointerId;
  grabX = e.clientX;
  grabY = e.clientY;
  moveInFlight = false;
  moveSettledTs = 0;

  if (e.pointerType === 'touch' || e.pointerType === 'pen') {
    cancelHoldTimers();
    holdVisualTimer = setTimeout(() => {
      if (gestureMode === 'pending') {
        btnContainer.classList.add('holding');
      }
    }, 350);

    holdTriggerTimer = setTimeout(() => {
      if (gestureMode === 'pending') {
        gestureMode = 'menu';
        lastMenuTriggerAt = Date.now();
        btnContainer.classList.remove('holding');
        ipcRenderer.send('open-radial-menu');
      }
    }, 2000);
  }
});

window.addEventListener('pointermove', async (e) => {
  if (activePointerId === null || e.pointerId !== activePointerId) return;
  if (gestureMode !== 'pending' && gestureMode !== 'dragging') return;
  if (nativeDragActive) return;
  if (moveInFlight || e.timeStamp <= moveSettledTs) return;

  const dx = e.clientX - grabX;
  const dy = e.clientY - grabY;
  const dist = Math.hypot(dx, dy);

  if (gestureMode === 'pending') {
    const threshold = (e.pointerType === 'touch' || e.pointerType === 'pen') ? 14 : 5;
    if (dist <= threshold) return;

    // Enter DRAGGING mode: cancel hold timers/ring & hand off to 120Hz native main-process drag
    gestureMode = 'dragging';
    cancelHoldTimers();
    try { btnContainer.setPointerCapture(e.pointerId); } catch {}
    moveInFlight = true;
    try {
      const res = await ipcRenderer.invoke('drag-start', { pointerType: e.pointerType });
      if (gestureMode === 'dragging' && res && res.nativeDrag) {
        nativeDragActive = true;
        return;
      }
    } finally {
      moveInFlight = false;
    }
    if (gestureMode !== 'dragging') return;
  }

  const stepX = Math.round(dx);
  const stepY = Math.round(dy);
  if (stepX === 0 && stepY === 0) return;

  moveInFlight = true;
  try {
    await ipcRenderer.invoke('move-widget-step', { dx: stepX, dy: stepY });
    await new Promise((r) => requestAnimationFrame(r));
  } finally {
    moveSettledTs = performance.now();
    moveInFlight = false;
  }
});

function finishPointerInteraction(e) {
  if (activePointerId !== null && e.pointerId !== activePointerId) return;
  const finishedMode = gestureMode;
  cancelHoldTimers();
  gestureMode = 'idle';
  nativeDragActive = false;
  ipcRenderer.send('drag-end');

  try {
    if (activePointerId !== null && btnContainer.hasPointerCapture(activePointerId)) {
      btnContainer.releasePointerCapture(activePointerId);
    }
  } catch {}
  activePointerId = null;
  moveInFlight = false;

  if (finishedMode === 'dragging') {
    lastDragEndTime = Date.now();
    return;
  }

  if (finishedMode === 'pending' && (e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen')) {
    triggerMicSafe();
  }
}

window.addEventListener('pointerup', finishPointerInteraction);
window.addEventListener('pointercancel', (e) => {
  if (gestureMode === 'dragging') lastDragEndTime = Date.now();
  dbgWidget(`pointercancel mode=${gestureMode} type=${e.pointerType}`);
  cancelHoldTimers();
  gestureMode = 'idle';
  nativeDragActive = false;
  ipcRenderer.send('drag-end');
  activePointerId = null;
  moveInFlight = false;
});

// Fallback click handler in case touch/pen synthesizes click without normal pointerup
btnContainer.addEventListener('click', (e) => {
  if (e.button !== 0) return;
  if (gestureMode !== 'idle') return;
  if (Date.now() - lastDragEndTime < 450) return;
  triggerMicSafe();
});

// Mouse right-click toggles radial menu (touch/pen OS press-and-hold contextmenu is suppressed to avoid double-trigger or drag conflict)
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (gestureMode === 'dragging' || (Date.now() - lastDragEndTime < 450)) return;
  if (lastPointerType === 'touch' || lastPointerType === 'pen') return;
  lastMenuTriggerAt = Date.now();
  ipcRenderer.send('toggle-radial-menu');
});

// Toggle recording or finish
async function handleButtonClick() {
  ipcRenderer.send('hide-radial-menu');

  if (currentState === 'processing') {
    return; // Don't interrupt processing
  }

  if (currentState === 'idle') {
    await startRecording();
  } else if (currentState === 'recording') {
    await stopRecording();
  }
}

async function getAudioStream() {
  const baseAudio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: appConfig?.autoGainControl === true
  };

  if (appConfig && appConfig.deviceId && appConfig.deviceId !== 'default') {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { ...baseAudio, deviceId: { exact: appConfig.deviceId } }
      });
    } catch (e) {
      console.warn('Selected mic unavailable, falling back to default:', e);
    }
  }

  return await navigator.mediaDevices.getUserMedia({ audio: baseAudio });
}

async function startRecording() {
  if (!appConfig || !appConfig.apiKey) {
    alert('Silakan masukkan Kunci API Groq terlebih dahulu di Pengaturan.');
    ipcRenderer.invoke('open-settings');
    return;
  }

  try {
    const stream = await getAudioStream();

    audioChunks = [];
    peakDbRecorded = -100;

    // Attach Analyser for Noise Gate Level Tracking
    try {
      widgetAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = widgetAudioCtx.createMediaStreamSource(stream);
      widgetAnalyser = widgetAudioCtx.createAnalyser();
      widgetAnalyser.fftSize = 512;
      source.connect(widgetAnalyser);

      const pcmBuf = new Float32Array(widgetAnalyser.fftSize);
      vadMonitorTimer = setInterval(() => {
        if (!widgetAnalyser) return;
        widgetAnalyser.getFloatTimeDomainData(pcmBuf);
        let sumSq = 0;
        for (let i = 0; i < pcmBuf.length; i++) sumSq += pcmBuf[i] * pcmBuf[i];
        const rms = Math.sqrt(sumSq / pcmBuf.length);
        const db = 20 * Math.log10(Math.max(1e-4, rms));
        if (db > peakDbRecorded) peakDbRecorded = db;
      }, 50);
    } catch (audioErr) {
      console.warn('Widget AudioContext init warning:', audioErr);
    }

    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (vadMonitorTimer) {
        clearInterval(vadMonitorTimer);
        vadMonitorTimer = null;
      }
      if (widgetAudioCtx) {
        try { await widgetAudioCtx.close(); } catch {}
        widgetAudioCtx = null;
        widgetAnalyser = null;
      }
      stream.getTracks().forEach(track => track.stop());
      await processAudio();
    };

    mediaRecorder.start();
    setState('recording');
  } catch (err) {
    console.error('Error accessing microphone:', err);
    alert('Tidak dapat mengakses mikrofon: ' + err.message);
    setState('idle');
  }
}

async function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    setState('processing');
    mediaRecorder.stop();
  }
}

async function processAudio() {
  if (audioChunks.length === 0) {
    setState('idle');
    return;
  }

  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  audioChunks = [];

  // Minimum size check (e.g. accidental micro-click < 100ms)
  if (audioBlob.size < 1000) {
    setState('idle');
    return;
  }

  // Tahap 1: Noise Gate Check
  if (appConfig?.noiseGateEnabled !== false) {
    const threshold = (appConfig && appConfig.noiseGateThreshold !== undefined) ? appConfig.noiseGateThreshold : -38;
    if (peakDbRecorded < threshold) {
      dbgWidget(`Noise gate: peak level ${Math.round(peakDbRecorded)} dB is below threshold ${threshold} dB, discarded.`);
      setState('idle');
      return;
    }
  }

  // Tahap 2: Voice Lock / Speaker Verification Check
  if (appConfig?.lockToOwnerVoice === true) {
    try {
      const arrBuf = await audioBlob.arrayBuffer();
      const tempCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const decoded = await tempCtx.decodeAudioData(arrBuf);
      await tempCtx.close();
      const pcm = Array.from(decoded.getChannelData(0));
      const evalRes = await ipcRenderer.invoke('verify-voice-match', {
        pcm,
        sampleRate: decoded.sampleRate,
        threshold: appConfig.voiceMatchThreshold || 70
      });

      if (evalRes && !evalRes.match) {
        dbgWidget(`Voice lock rejected: similarity ${evalRes.score}% is below ${evalRes.minThreshold}%`);
        btnCircle.title = `Suara tidak cocok dengan profil pemilik (${evalRes.score}%)`;
        setState('idle');
        return;
      }
    } catch (vErr) {
      dbgWidget(`Voice lock verification error: ${vErr.message}`);
    }
  }

  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'speech.webm');
    formData.append('model', appConfig.model || 'whisper-large-v3-turbo');
    formData.append('response_format', 'json');
    if (appConfig.language && appConfig.language !== 'auto') {
      formData.append('language', appConfig.language);
    }

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${appConfig.apiKey.trim()}`
      },
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP error ${response.status}`);
    }

    const result = await response.json();
    const transcribedText = result.text ? result.text.trim() : '';

    if (transcribedText) {
      // Auto-inject text into active application
      await ipcRenderer.invoke('paste-text', transcribedText);
    }
  } catch (err) {
    console.error('Groq Whisper transcription failed:', err);
    alert('Gagal mentranskripsi suara:\n' + err.message);
  } finally {
    setState('idle');
  }
}
