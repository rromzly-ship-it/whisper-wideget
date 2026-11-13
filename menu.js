const { ipcRenderer } = require('electron');

const radialMenu = document.getElementById('radial-menu');
const micHotspot = document.getElementById('mic-hotspot');
const slotSettings = document.getElementById('slot-settings');
const slotClose = document.getElementById('slot-close');
const btnSettings = document.getElementById('btn-settings');
const btnClose = document.getElementById('btn-close');

let closeTimer = null;

function restartAnimation(el) {
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

function applyFlipClasses(flippedX, flippedY) {
  radialMenu.classList.toggle('flipped-x', !!flippedX);
  radialMenu.classList.toggle('flipped-y', !!flippedY);
}

ipcRenderer.on('menu-show', (event, { flippedX, flippedY }) => {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }

  radialMenu.classList.remove('is-closing', 'is-open');
  applyFlipClasses(flippedX, flippedY);

  restartAnimation(slotSettings);
  restartAnimation(slotClose);
  void radialMenu.offsetWidth;
  radialMenu.classList.add('is-open');
});

ipcRenderer.on('menu-update-flip', (event, { flippedX, flippedY }) => {
  applyFlipClasses(flippedX, flippedY);
});

function startClosing(reason) {
  if (radialMenu.classList.contains('is-closing')) return;

  radialMenu.classList.remove('is-open');
  restartAnimation(slotSettings);
  restartAnimation(slotClose);
  void radialMenu.offsetWidth;
  radialMenu.classList.add('is-closing');

  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    closeTimer = null;
    radialMenu.classList.remove('is-closing');
    ipcRenderer.send('menu-closed-done', reason);
  }, 310);
}

ipcRenderer.on('menu-close', (event, reason) => {
  startClosing(reason || 'blur');
});

function bindActionTap(btn, onTrigger) {
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onTrigger();
  });
}

bindActionTap(btnSettings, () => startClosing('settings'));
bindActionTap(btnClose, () => {
  ipcRenderer.send('menu-will-quit');
  startClosing('quit');
});

// Support dragging all widgets (mic + eye + radial buttons) from the mic hotspot (Mouse, Touch, Stylus)
let isPointerDown = false;
let activePointerId = null;
let lastPointerType = 'mouse';
let grabX = 0;
let grabY = 0;
let moveInFlight = false;
let nativeDragActive = false;
let moveSettledTs = 0;
let hasDragged = false;

micHotspot.addEventListener('pointerdown', (e) => {
  lastPointerType = e.pointerType || 'mouse';
  if (e.button === 2 || (e.pointerType === 'pen' && (e.buttons & 2))) {
    startClosing('mic-right-click');
    return;
  }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  isPointerDown = true;
  activePointerId = e.pointerId;
  hasDragged = false;
  nativeDragActive = false;
  grabX = e.clientX;
  grabY = e.clientY;
  moveInFlight = false;
  moveSettledTs = 0;
});

micHotspot.addEventListener('pointermove', async (e) => {
  if (!isPointerDown || (activePointerId !== null && e.pointerId !== activePointerId)) return;
  if (nativeDragActive) return;
  if (moveInFlight || e.timeStamp <= moveSettledTs) return;

  const dx = e.clientX - grabX;
  const dy = e.clientY - grabY;
  const dist = Math.hypot(dx, dy);
  if (!hasDragged) {
    const threshold = (e.pointerType === 'touch' || e.pointerType === 'pen') ? 14 : 5;
    if (dist <= threshold) return;
    hasDragged = true;
    try { micHotspot.setPointerCapture(e.pointerId); } catch {}
    moveInFlight = true;
    try {
      const res = await ipcRenderer.invoke('drag-start', { pointerType: e.pointerType });
      if (isPointerDown && res && res.nativeDrag) {
        nativeDragActive = true;
        return;
      }
    } finally {
      moveInFlight = false;
    }
    if (!isPointerDown) return;
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

function finishHotspotPointer(e) {
  if (!isPointerDown || (activePointerId !== null && e.pointerId !== activePointerId)) return;
  isPointerDown = false;
  nativeDragActive = false;
  ipcRenderer.send('drag-end');
  try {
    if (activePointerId !== null && micHotspot.hasPointerCapture(activePointerId)) {
      micHotspot.releasePointerCapture(activePointerId);
    }
  } catch {}
  activePointerId = null;
  moveInFlight = false;
  if (!hasDragged && (e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen')) {
    startClosing('mic-click');
  }
}

micHotspot.addEventListener('pointerup', finishHotspotPointer);
micHotspot.addEventListener('pointercancel', () => {
  isPointerDown = false;
  nativeDragActive = false;
  ipcRenderer.send('drag-end');
  activePointerId = null;
  moveInFlight = false;
});

micHotspot.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (hasDragged || lastPointerType === 'touch' || lastPointerType === 'pen') return;
  startClosing('mic-right-click');
});

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#btn-settings') || e.target.closest('#btn-close')) {
    return;
  }
  startClosing('backdrop-click');
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    startClosing('escape');
  }
});
