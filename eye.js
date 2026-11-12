const { ipcRenderer } = require('electron');

const container = document.getElementById('eye-container');
const eyeCircle = document.getElementById('eye-circle');
const pointerOrbit = document.getElementById('pointer-orbit');
const canvas = document.getElementById('eye-canvas');
const ctx = canvas.getContext('2d');

let appConfig = null;
let currentState = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking' | 'success' | 'error'
let activeSession = false;
let isSpeaking = false;
let isGliding = false;
let activeStream = null;
let audioCtx = null;
let analyser = null;
let vadTimer = null;
let ignoreNextStop = false;
let mediaRecorder = null;
let audioChunks = [];
let resetTimer = null;
let currentAudioSource = null;
let segmentSeq = 0;
let ambientFloor = 0.004;
let vadHasSpoken = false;

function dbgLog(msg) {
  try {
    ipcRenderer.send('log-debug', `[eye] ${msg}`);
  } catch {}
}

// Initial config load
ipcRenderer.invoke('get-config').then(cfg => {
  appConfig = cfg;
});

ipcRenderer.on('config-updated', (event, updatedConfig) => {
  appConfig = updatedConfig;
});

ipcRenderer.on('trigger-command-toggle', () => {
  handleEyeClick();
});

ipcRenderer.on('eye-shrink-out', () => {
  stopAssistantSession();
  pointerOrbit.classList.remove('visible');
  container.classList.add('closing');
});

// =========================================================================
// Wis Orbiting Pointer & Glide / Vanish / Reappear Visuals
// =========================================================================
ipcRenderer.on('wis-glide-start', (event, { angleDeg }) => {
  isGliding = true;
  pointerOrbit.style.setProperty('--ptr-angle', `${angleDeg}deg`);
  pointerOrbit.classList.add('visible');
  eyeCircle.className = 'state-thinking';
  expression = 'curiga';
});

ipcRenderer.on('wis-vanish', () => {
  pointerOrbit.classList.remove('visible');
  container.classList.remove('wis-reappear');
  void container.offsetWidth;
  container.classList.add('wis-vanish');
});

ipcRenderer.on('wis-reappear', () => {
  isGliding = false;
  container.classList.remove('wis-vanish');
  void container.offsetWidth;
  container.classList.add('wis-reappear');
  setTimeout(() => {
    container.classList.remove('wis-reappear');
  }, 260);
});

ipcRenderer.on('wis-eye-anim', (event, payload) => {
  if (!payload || !payload.type) return;
  const now = performance.now();
  if (payload.type === 'scroll-single') {
    const dir = String(payload.direction || 'down').toLowerCase();
    const spin = Math.PI * 2;
    impulseSpin = {
      startTime: now,
      duration: 580,
      targetYaw: dir === 'right' ? spin : (dir === 'left' ? -spin : 0),
      targetPitch: dir === 'down' ? spin : (dir === 'up' ? -spin : 0)
    };
  } else if (payload.type === 'scroll-auto-start') {
    const rate = payload.speed === 'fast' ? 4.6 : (payload.speed === 'medium' ? 3.2 : 1.9);
    continuousScroll = { dir: String(payload.direction || 'down').toLowerCase(), rate, pitch: 0, yaw: 0 };
  } else if (payload.type === 'scroll-auto-stop') {
    continuousScroll = null;
  } else if (payload.type === 'zoom') {
    if (payload.mode === 'reset') {
      zoomOverride = null;
    } else {
      zoomOverride = { mode: payload.mode === 'in' ? 'zoomin' : 'zoomout', until: now + 1600 };
    }
  }
});

// =========================================================================
// 3D Interactive Eye Character Engine (Crisp Vector Eyes over GPU CSS Orb)
// =========================================================================
const poses = {
  normal:    { height: 1,    width: 1,    tilt: 0,    lift: 0,    arch: 0 },
  senang:    { height: .24,  width: 1.4,  tilt: 0,    lift: -.07, arch: .09 },
  kaget:     { height: 1.17, width: 1.35, tilt: 0,    lift: -.06, arch: 0 },
  curiga:    { height: .55,  width: 1.15, tilt: .26,  lift: 0,    arch: 0 },
  mengantuk: { height: .43,  width: 1.05, tilt: -.12, lift: .06,  arch: 0 },
  tidur:     { height: .10,  width: 1.28, tilt: 0,    lift: .08,  arch: -.06 },
  zoomin:    { height: 1.56, width: 1.48, tilt: 0,    lift: -.02, arch: 0 },
  zoomout:   { height: .44,  width: .48,  tilt: 0,    lift: .04,  arch: 0 }
};

let impulseSpin = null;
let continuousScroll = null;
let zoomOverride = null;
let lastSegMaxRms = 0;
let currentAudioCancel = null;

const pose = { ...poses.normal };
const gaze = { x: 0, y: 0 };
const desktopPointer = { x: 0, y: 0, active: false };
let expression = 'normal';
let blinkStart = -Infinity;
let doubleBlink = Infinity;
let nextBlink = performance.now() + 1800;
let lastFrame = performance.now();

const center = 84;
const radius = 82;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = t => t * t * (3 - 2 * t);

// Global desktop cursor tracking from main process
ipcRenderer.on('cursor-pos', (event, { dx, dy }) => {
  const dist = Math.hypot(dx, dy);
  const range = Math.max(260, dist);
  desktopPointer.x = clamp(dx / range, -1, 1);
  desktopPointer.y = clamp(dy / range, -1, 1);
  desktopPointer.active = true;
});

function setEyeState(state, message, autoResume = true) {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }

  currentState = state;
  eyeCircle.className = `state-${state}`;

  if (state === 'idle') {
    expression = 'normal';
    pointerOrbit.classList.remove('visible');
    eyeCircle.title = 'Whisper Agent (Wis) — Klik sekali untuk ngobrol atau perintah langsung';
  } else if (state === 'listening') {
    expression = 'kaget';
    blinkStart = performance.now();
    eyeCircle.title = 'Wis mendengarkan... Otomatis jalan setelah jeda. Klik lagi untuk berhenti.';
  } else if (state === 'thinking') {
    expression = 'curiga';
    eyeCircle.title = 'Wis sedang berpikir & menjalankan perintah...';
  } else if (state === 'speaking') {
    expression = 'senang';
    eyeCircle.title = message || 'Wis sedang berbicara...';
  } else if (state === 'success') {
    expression = 'senang';
    eyeCircle.title = message || 'Perintah berhasil dijalankan!';
    if (autoResume) {
      resetTimer = setTimeout(() => {
        if (activeSession) {
          startNextListeningSegment();
        } else {
          setEyeState('idle');
        }
      }, 900);
    }
  } else if (state === 'error') {
    expression = 'mengantuk';
    eyeCircle.title = message || 'Perintah tidak dikenali';
    if (autoResume) {
      resetTimer = setTimeout(() => {
        if (activeSession) {
          startNextListeningSegment();
        } else {
          setEyeState('idle');
        }
      }, 1000);
    }
  }
}

function openness(now) {
  if (expression === 'tidur') return 1;
  if (now >= doubleBlink || now >= nextBlink) {
    const second = now >= doubleBlink;
    blinkStart = now;
    doubleBlink = !second && Math.random() < .15 ? now + 245 : Infinity;
    nextBlink = now + 2400 + Math.random() * 4100;
  }
  const elapsed = now - blinkStart;
  if (elapsed < 65) return 1 - .98 * smooth(clamp(elapsed / 65, 0, 1));
  return .02 + .98 * smooth(clamp((elapsed - 65) / 135, 0, 1));
}

function projectSphere(x, y, rotation) {
  const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  const tx = x * rotation.cy + z * rotation.sy;
  const tz1 = z * rotation.cy - x * rotation.sy;
  const ty = y * rotation.cp + tz1 * rotation.sp;
  const fz = tz1 * rotation.cp - y * rotation.sp;
  return { tx, ty, fz };
}

function drawEye(side, open, rotation) {
  const height = .52 * pose.height * open;
  const width = Math.min(.26 * pose.width, height * .85 + .085);
  const cap = Math.min(width, height) / 2;
  const arch = pose.arch * open;
  const tilt = pose.tilt * side;
  const eyeY = -.08 + pose.lift + (1 - open) * .042;

  const centerProj = projectSphere(side * .27, eyeY, rotation);
  if (centerProj.fz <= -0.32) return;

  ctx.beginPath();
  for (let step = 0; step < 48; step++) {
    const angle = step / 48 * Math.PI * 2;
    const horizontal = width > height;
    const u = cap * Math.cos(angle) + (horizontal ? Math.sign(Math.cos(angle)) * (width / 2 - cap) : 0);
    const v = cap * Math.sin(angle) + (!horizontal ? Math.sign(Math.sin(angle)) * (height / 2 - cap) : 0);
    const curvedV = v + arch * (2 * u / width) ** 2;
    const x = side * .27 + u * Math.cos(tilt) - curvedV * Math.sin(tilt);
    const y = eyeY + u * Math.sin(tilt) + curvedV * Math.cos(tilt);
    const proj = projectSphere(x, y, rotation);
    let pxNorm = proj.tx;
    let pyNorm = proj.ty;
    if (proj.fz < 0) {
      const len = Math.hypot(pxNorm, pyNorm) || 1;
      pxNorm /= len;
      pyNorm /= len;
    }
    const px = center + radius * pxNorm;
    const py = center + radius * pyNorm;
    if (step === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function frame(now) {
  const dt = Math.min(now - lastFrame, 48);
  lastFrame = now;
  const ease = 1 - Math.exp(-dt / 85);

  let aim;
  if (isGliding) {
    aim = { x: 0, y: -0.08 };
  } else if (currentState === 'listening') {
    aim = { x: 0, y: -0.04 };
  } else if (currentState === 'thinking') {
    aim = { x: Math.sin(now / 240) * 0.40, y: -0.24 };
  } else if (currentState === 'speaking' || currentState === 'success') {
    aim = { x: Math.sin(now / 320) * 0.12, y: -0.06 };
  } else if (currentState === 'error') {
    aim = { x: 0, y: 0.16 };
  } else {
    const drift = Math.sin(now / 1900) * .035;
    aim = desktopPointer.active ? desktopPointer : { x: drift, y: 0 };
  }

  gaze.x += (aim.x - gaze.x) * ease;
  gaze.y += (aim.y - gaze.y) * ease;

  if (zoomOverride && now > zoomOverride.until) {
    zoomOverride = null;
  }
  const activePoseKey = zoomOverride ? zoomOverride.mode : expression;
  const targetPose = poses[activePoseKey] || poses.normal;
  for (const key of Object.keys(pose)) {
    pose[key] += (targetPose[key] - pose[key]) * ease;
  }

  let extraYaw = 0;
  let extraPitch = 0;

  if (continuousScroll) {
    const stepRad = (continuousScroll.rate * dt) / 1000;
    if (continuousScroll.dir === 'down') continuousScroll.pitch += stepRad;
    else if (continuousScroll.dir === 'up') continuousScroll.pitch -= stepRad;
    else if (continuousScroll.dir === 'right') continuousScroll.yaw += stepRad;
    else if (continuousScroll.dir === 'left') continuousScroll.yaw -= stepRad;
    extraYaw += continuousScroll.yaw;
    extraPitch += continuousScroll.pitch;
  }

  if (impulseSpin) {
    const t = (now - impulseSpin.startTime) / impulseSpin.duration;
    if (t >= 1) {
      impulseSpin = null;
    } else {
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      extraYaw += impulseSpin.targetYaw * eased;
      extraPitch += impulseSpin.targetPitch * eased;
    }
  }

  const yaw = gaze.x * .70 + extraYaw;
  const pitch = gaze.y * .63 + extraPitch;
  const rotation = { cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch) };

  ctx.clearRect(0, 0, 168, 168);
  ctx.fillStyle = '#FFFFFF';
  const open = openness(now);
  drawEye(-1, open, rotation);
  drawEye(1, open, rotation);

  requestAnimationFrame(frame);
}

frame(lastFrame);

// =========================================================================
// Piper TTS Playback with Anti-Echo Guard
// =========================================================================
async function playPiperWavBase64(wavBase64, mood = 'speaking', message = '') {
  if (!wavBase64 || !activeSession) return;

  isSpeaking = true;
  // Pass autoResume=false so setEyeState('error') never triggers a second listener mid-speech
  setEyeState(mood, message, false);

  try {
    const ctxAudio = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctxAudio.state === 'suspended') {
      await ctxAudio.resume();
    }

    const binary = atob(wavBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const audioBuffer = await ctxAudio.decodeAudioData(bytes.buffer);
    const timeoutMs = Math.max(4000, Math.round((audioBuffer.duration || 3) * 1000) + 2500);

    await new Promise((resolve) => {
      if (!activeSession) {
        resolve();
        return;
      }
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(guardTimer);
        if (currentAudioCancel === cancelAudio) currentAudioCancel = null;
        if (currentAudioSource === source) currentAudioSource = null;
        resolve();
      };
      const cancelAudio = () => {
        try { source.stop(); } catch {}
        done();
      };
      const source = ctxAudio.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctxAudio.destination);
      currentAudioSource = source;
      currentAudioCancel = cancelAudio;
      const guardTimer = setTimeout(() => {
        dbgLog('tts audio timeout fallback after ' + timeoutMs + 'ms');
        cancelAudio();
      }, timeoutMs);
      source.onended = done;
      source.start(0);
    });
  } catch (err) {
    console.warn('TTS playback error:', err);
    dbgLog('tts playback error: ' + (err && err.message ? err.message : err));
  } finally {
    // Brief echo tail buffer before re-enabling microphone VAD (skip if already interrupted)
    if (isSpeaking) {
      await new Promise(r => setTimeout(r, 50));
    }
    isSpeaking = false;
  }
}

function stopCurrentAudio() {
  isSpeaking = false;
  if (currentAudioCancel) {
    const fn = currentAudioCancel;
    currentAudioCancel = null;
    fn();
  } else if (currentAudioSource) {
    try { currentAudioSource.stop(); } catch {}
    currentAudioSource = null;
  }
}

// =========================================================================
// Universal Pointer Drag, Tap, Long-Press Menu (Mouse, Touchscreen, Stylus Pen)
// Gesture state machine: 'idle' | 'pending' | 'dragging' | 'menu'
// =========================================================================
let gestureMode = 'idle';
let activePointerId = null;
let lastPointerType = 'mouse';
let grabX = 0;
let grabY = 0;
let moveInFlight = false;
let nativeDragActive = false;
let moveSettledTs = 0;
let lastDragEndTime = 0;
let lastEyeClickAt = 0;
let lastEyeMenuAt = 0;
let longPressTimer = null;

function clearEyeLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function triggerEyeSafe() {
  const now = Date.now();
  if (now - lastEyeClickAt < 300) return;
  if (now - lastEyeMenuAt < 450) return;
  lastEyeClickAt = now;
  handleEyeClick();
}

window.addEventListener('pointerdown', (e) => {
  lastPointerType = e.pointerType || 'mouse';

  // Stylus barrel button or mouse right-click opens radial menu
  if (e.button === 2 || (e.pointerType === 'pen' && (e.buttons & 2))) {
    gestureMode = 'menu';
    lastEyeMenuAt = Date.now();
    clearEyeLongPress();
    ipcRenderer.send('open-radial-menu');
    return;
  }
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  gestureMode = 'pending';
  activePointerId = e.pointerId;
  grabX = e.clientX;
  grabY = e.clientY;
  moveInFlight = false;
  moveSettledTs = 0;

  if (e.pointerType === 'touch' || e.pointerType === 'pen') {
    clearEyeLongPress();
    longPressTimer = setTimeout(() => {
      if (gestureMode === 'pending') {
        gestureMode = 'menu';
        lastEyeMenuAt = Date.now();
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
    gestureMode = 'dragging';
    clearEyeLongPress();
    try { container.setPointerCapture(e.pointerId); } catch {}
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

function finishEyePointer(e) {
  if (activePointerId !== null && e.pointerId !== activePointerId) return;
  const finishedMode = gestureMode;
  clearEyeLongPress();
  gestureMode = 'idle';
  nativeDragActive = false;
  ipcRenderer.send('drag-end');

  try {
    if (activePointerId !== null && container.hasPointerCapture(activePointerId)) {
      container.releasePointerCapture(activePointerId);
    }
  } catch {}
  activePointerId = null;
  moveInFlight = false;

  if (finishedMode === 'dragging') {
    lastDragEndTime = Date.now();
    return;
  }

  if (finishedMode === 'pending' && (e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen')) {
    triggerEyeSafe();
  }
}

window.addEventListener('pointerup', finishEyePointer);
window.addEventListener('pointercancel', () => {
  if (gestureMode === 'dragging') lastDragEndTime = Date.now();
  clearEyeLongPress();
  gestureMode = 'idle';
  nativeDragActive = false;
  ipcRenderer.send('drag-end');
  activePointerId = null;
  moveInFlight = false;
});

container.addEventListener('click', (e) => {
  if (e.button !== 0) return;
  if (gestureMode !== 'idle') return;
  if (Date.now() - lastDragEndTime < 450) return;
  triggerEyeSafe();
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (gestureMode === 'dragging' || gestureMode === 'menu' || (Date.now() - lastDragEndTime < 450)) return;
  if (lastPointerType === 'touch' || lastPointerType === 'pen') return;
  lastEyeMenuAt = Date.now();
  ipcRenderer.send('toggle-radial-menu');
});

async function handleEyeClick() {
  ipcRenderer.send('hide-radial-menu');

  if (activeSession) {
    stopAssistantSession();
    return;
  }
  await startAssistantSession();
}

async function getAudioStream() {
  const baseAudio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
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

async function initMicAnalyser() {
  activeStream = await getAudioStream();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  const source = audioCtx.createMediaStreamSource(activeStream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
}

async function startAssistantSession() {
  if (!appConfig || !appConfig.apiKey) {
    alert('Silakan masukkan Kunci API Groq terlebih dahulu di Pengaturan.');
    ipcRenderer.invoke('open-settings');
    return;
  }

  try {
    await initMicAnalyser();
    activeSession = true;
    const track = activeStream && activeStream.getAudioTracks()[0];
    dbgLog(`session start track="${track ? track.label : 'none'}" ctx=${audioCtx ? audioCtx.state : 'none'} voice=${appConfig.voiceAssistant !== false}`);

    // Enter listening standby directly without speaking an initial greeting
    if (activeSession) {
      await startNextListeningSegment();
    }
  } catch (err) {
    console.error('Error accessing microphone:', err);
    dbgLog('session start mic error: ' + (err && err.message ? err.message : err));
    stopAssistantSession('mic-error');
    setEyeState('error', 'Mikrofon tidak dapat diakses', false);
  }
}

function stopAssistantSession(reason = 'user') {
  if (activeSession) {
    dbgLog(`session stop reason=${reason}`);
  }
  activeSession = false;
  vadHasSpoken = false;
  segmentSeq++;
  ignoreNextStop = true;
  continuousScroll = null;
  impulseSpin = null;
  zoomOverride = null;
  ipcRenderer.send('stop-auto-scroll');
  stopCurrentAudio();

  if (vadTimer) {
    clearInterval(vadTimer);
    vadTimer = null;
  }
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch {}
  }
  mediaRecorder = null;
  audioChunks = [];

  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }
  if (audioCtx) {
    try { audioCtx.close(); } catch {}
    audioCtx = null;
    analyser = null;
  }
  setEyeState('idle');
}

async function startNextListeningSegment() {
  if (!activeSession) return;

  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  if (vadTimer) {
    clearInterval(vadTimer);
    vadTimer = null;
  }

  // Safely tear down any previous recorder before starting a fresh segment
  const oldRec = mediaRecorder;
  mediaRecorder = null;
  if (oldRec && oldRec.state !== 'inactive') {
    ignoreNextStop = true;
    try { oldRec.stop(); } catch {}
  }

  // Recover audio stream if track ended or audio context was closed
  const hasLiveTrack = activeStream && activeStream.getAudioTracks().some(t => t.readyState === 'live');
  if (!hasLiveTrack || !audioCtx || !analyser) {
    dbgLog('re-acquiring mic stream before next segment');
    try {
      if (activeStream) activeStream.getTracks().forEach(t => t.stop());
      if (audioCtx) { try { await audioCtx.close(); } catch {} }
      await initMicAnalyser();
    } catch (err) {
      dbgLog('mic re-acquire failed: ' + err.message);
      stopAssistantSession('mic-lost');
      return;
    }
  } else if (audioCtx.state === 'suspended') {
    await audioCtx.resume().catch(() => {});
  }

  if (!activeSession) return;

  const segChunks = [];
  ignoreNextStop = false;
  vadHasSpoken = false;
  const segId = ++segmentSeq;

  let nextRec = null;
  try {
    nextRec = new MediaRecorder(activeStream, { mimeType: 'audio/webm' });
  } catch (e) {
    console.error('MediaRecorder init failed:', e);
    dbgLog('MediaRecorder init failed: ' + e.message);
    stopAssistantSession('recorder-fail');
    return;
  }

  mediaRecorder = nextRec;

  nextRec.ondataavailable = (event) => {
    if (segId !== segmentSeq) return;
    if (event.data && event.data.size > 0 && !isSpeaking) {
      segChunks.push(event.data);
    }
  };

  nextRec.onerror = (ev) => {
    dbgLog('MediaRecorder error: ' + (ev && ev.error ? ev.error.message : 'unknown'));
  };

  let speechAccumMs = 0;
  let lastVoiceTime = 0;
  let hasSpoken = false;
  let maxRmsSeen = 0;

  nextRec.onstop = () => {
    if (segId !== segmentSeq || ignoreNextStop || !activeSession) {
      return;
    }
    const blob = segChunks.length > 0 ? new Blob(segChunks, { type: 'audio/webm' }) : null;
    const capturedPeak = maxRmsSeen;
    // Immediately restart listening so microphone never goes blind during Whisper HTTPS upload
    startNextListeningSegment().catch(() => {});
    processVoiceCommand(blob, capturedPeak).catch((err) => {
      dbgLog('async processVoiceCommand error: ' + (err && err.message ? err.message : err));
    });
  };

  nextRec.start(100);
  setEyeState('listening');
  dbgLog(`listening segment #${segId} started (floor=${ambientFloor.toFixed(4)})`);

  const POLL_MS = 50;
  const MIN_SPEECH_MS = 100;
  const MICRO_GAP_RESET_MS = 240;
  const SILENCE_COMMIT_MS = 480;
  const IDLE_SLEEP_MS = 35000;

  const dataBuf = new Float32Array(analyser.fftSize);
  const segmentStart = performance.now();

  vadTimer = setInterval(() => {
    if (segId !== segmentSeq || !activeSession || !analyser || currentState !== 'listening') {
      clearInterval(vadTimer);
      vadTimer = null;
      return;
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    if (activeStream && activeStream.getAudioTracks().every(t => t.readyState !== 'live')) {
      clearInterval(vadTimer);
      vadTimer = null;
      dbgLog('mic track ended during listening -> restarting segment');
      startNextListeningSegment();
      return;
    }

    if (isSpeaking) {
      speechAccumMs = 0;
      hasSpoken = false;
      vadHasSpoken = false;
      return;
    }

    analyser.getFloatTimeDomainData(dataBuf);
    let sumSq = 0;
    for (let i = 0; i < dataBuf.length; i++) {
      sumSq += dataBuf[i] * dataBuf[i];
    }
    const rms = Math.sqrt(sumSq / dataBuf.length);
    if (rms > maxRmsSeen) maxRmsSeen = rms;
    const now = performance.now();

    const speechThreshold = Math.max(0.008, Math.min(0.022, ambientFloor * 3.0));

    if (rms > speechThreshold) {
      speechAccumMs += POLL_MS;
      lastVoiceTime = now;
      if (!hasSpoken && speechAccumMs >= MIN_SPEECH_MS) {
        hasSpoken = true;
        vadHasSpoken = true;
        dbgLog(`speech detected rms=${rms.toFixed(4)} thr=${speechThreshold.toFixed(4)}`);
      }
    } else {
      if (!hasSpoken) {
        ambientFloor = Math.max(0.0012, ambientFloor * 0.90 + rms * 0.10);
        if (speechAccumMs > 0 && (now - lastVoiceTime > MICRO_GAP_RESET_MS)) {
          speechAccumMs = 0;
        }
        if (now - segmentStart >= IDLE_SLEEP_MS) {
          dbgLog(`idle timeout 35s (maxRms=${maxRmsSeen.toFixed(4)} floor=${ambientFloor.toFixed(4)})`);
          stopAssistantSession('idle');
        }
      } else if (now - lastVoiceTime >= SILENCE_COMMIT_MS) {
        clearInterval(vadTimer);
        vadTimer = null;
        vadHasSpoken = false;
        lastSegMaxRms = maxRmsSeen;
        dbgLog(`silence commit (peak=${maxRmsSeen.toFixed(4)} chunks=${audioChunks.length})`);
        commitCurrentSegment();
      }
    }
  }, POLL_MS);
}

function commitCurrentSegment() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

async function processVoiceCommand(audioBlob, segPeak = 0) {
  if (!audioBlob || audioBlob.size < 900) {
    dbgLog(`process skipped: tiny/empty blob (${audioBlob ? audioBlob.size : 0} bytes)`);
    return;
  }
  dbgLog(`transcribing audioBlob bytes=${audioBlob.size}`);

  try {
    const promptHints = await ipcRenderer.invoke('get-whisper-prompt').catch(() => '');
    const formData = new FormData();
    formData.append('file', audioBlob, 'command.webm');
    formData.append('model', appConfig.model || 'whisper-large-v3');
    formData.append('response_format', 'verbose_json');
    formData.append('prompt', promptHints || 'Wis ID & EN: Chrome, CorelDRAW, YouTube, WhatsApp, Word, iTrade, EsteraOne, telusuri, scroll, berhenti, zoom in, zoom out.');
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
    const transcript = result.text ? result.text.trim() : '';
    const detectedLang = String(result.language || '').trim().toLowerCase();
    const audioDurationSec = Number(result.duration || 0);
    const segs = Array.isArray(result.segments) ? result.segments : [];
    const avgNoSpeech = segs.length > 0
      ? segs.reduce((acc, s) => acc + (s.no_speech_prob || 0), 0) / segs.length
      : 0;

    ipcRenderer.send('record-whisper-usage', {
      model: appConfig.model || 'whisper-large-v3',
      audioSeconds: audioDurationSec
    });

    const isAutoLang = !appConfig.language || appConfig.language === 'auto';
    const isAllowedLang = !detectedLang || /^(indonesian|malay|english|id|ms|en)$/.test(detectedLang);
    const cleanForNoise = transcript.replace(/[^\w\s]/g, '').trim().toLowerCase();
    const words = cleanForNoise.split(/\s+/).filter(Boolean);
    const hasCoreCommandWord = /\b(buka|klik|putar|play|pause|post|telusuri|cari|scroll|zoom|chrome|youtube|whatsapp|corel|word|alt|tab|stop|berhenti|ingat|belajar|pelajari|minimize|maximize|fullscreen|layar penuh|wis|wish|high|hai|halo|hi|back|kembali)\b/i.test(transcript);
    const isUnexpectedScript = /[\u0400-\u04FF\u0600-\u06FF\u0900-\u0E7F\u1EA0-\u1EFF\u01A0\u01AF\u0110\u0111\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF¡¿ãõ]/i.test(transcript);
    const isForeignLangNoise = isAutoLang && !isAllowedLang && (segPeak < 0.095 || words.length > 7 || !hasCoreCommandWord);
    const isCommonHallucination = /^(3d printing|thank you|thank you for watching|thanks for watching|please subscribe|subscribe to my channel|like and subscribe|subtitles by|wondering why|wondering what|mbc|bye|you|okay|in|on|at|to|it|is|the|a|an|ing|e a[ií]|ol[aá]|hmm+|uh+|um+|ah+)$/i.test(cleanForNoise);
    const isPromptEcho = /\b(wis id|zoom in.*zoom out|chrome.*coreldraw.*youtube|scroll.*berhenti)\b/i.test(cleanForNoise) && segPeak < 0.08;
    const isTinyFragment = words.length === 1 && cleanForNoise.length <= 2 && !/^(ok|no|ya|hi)$/i.test(cleanForNoise);
    const isVideoPlaybackNarration = (words.length >= 16 && /^(verification of|watching this video|in this video|subscribe|welcome back)/i.test(transcript));

    const isNoiseHallucination =
      isUnexpectedScript ||
      isForeignLangNoise ||
      isVideoPlaybackNarration ||
      isPromptEcho ||
      isTinyFragment ||
      (segPeak < 0.35 && isCommonHallucination) ||
      segPeak < 0.025 ||
      (avgNoSpeech > 0.55 && segPeak < 0.045);

    dbgLog(`whisper transcript="${transcript}" lang=${detectedLang || '?'} dur=${audioDurationSec.toFixed(1)}s noSpeech=${avgNoSpeech.toFixed(2)} peak=${segPeak.toFixed(4)} ignored=${isNoiseHallucination}`);

    if (!activeSession) return;

    if (!transcript || isNoiseHallucination) {
      dbgLog('ignored empty, foreign noise, or low-volume hallucination');
      return;
    }

    dbgLog(`enqueueing command="${transcript}"`);
    await ipcRenderer.invoke('enqueue-voice-command', {
      transcript,
      whisperModel: appConfig.model || 'whisper-large-v3',
      whisperSeconds: audioDurationSec
    });
  } catch (err) {
    console.error('Voice command error:', err);
    dbgLog('Voice command error: ' + (err && err.message ? err.message : err));
  }
}

ipcRenderer.on('wis-play-tts', async (event, payload) => {
  if (!activeSession || !payload || !payload.wavBase64 || appConfig?.voiceAssistant === false) return;
  if (vadHasSpoken || isSpeaking) {
    dbgLog('skipping TTS playback while user is speaking or audio is already playing');
    return;
  }
  if (vadTimer) {
    clearInterval(vadTimer);
    vadTimer = null;
  }
  isSpeaking = true;
  const rec = mediaRecorder;
  mediaRecorder = null;
  if (rec && rec.state !== 'inactive') {
    ignoreNextStop = true;
    try { rec.stop(); } catch {}
  }
  audioChunks = [];

  // Barge-in detector: allow user to interrupt TTS immediately by speaking
  let bargeInTimer = null;
  if (analyser) {
    const bargeBuf = new Float32Array(analyser.fftSize);
    let loudHits = 0;
    const bargeStartedAt = performance.now();
    bargeInTimer = setInterval(() => {
      if (!isSpeaking || !activeSession || !analyser) {
        clearInterval(bargeInTimer);
        return;
      }
      // Give initial 250ms before enabling barge-in so speaker onset isn't misread
      if (performance.now() - bargeStartedAt < 250) return;
      analyser.getFloatTimeDomainData(bargeBuf);
      let sq = 0;
      for (let i = 0; i < bargeBuf.length; i++) sq += bargeBuf[i] * bargeBuf[i];
      const rms = Math.sqrt(sq / bargeBuf.length);
      const bargeThr = Math.max(0.055, ambientFloor * 7.5);
      if (rms > bargeThr) {
        loudHits++;
        if (loudHits >= 2) {
          dbgLog(`barge-in detected rms=${rms.toFixed(4)} > ${bargeThr.toFixed(4)}, interrupting TTS`);
          clearInterval(bargeInTimer);
          stopCurrentAudio();
        }
      } else {
        loudHits = 0;
      }
    }, 60);
  }

  try {
    await playPiperWavBase64(payload.wavBase64, payload.ok ? 'speaking' : 'error', payload.replyText || '');
  } finally {
    if (bargeInTimer) clearInterval(bargeInTimer);
  }

  if (activeSession) {
    await startNextListeningSegment();
  }
});
