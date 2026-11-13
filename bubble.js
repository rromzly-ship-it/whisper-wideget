const { ipcRenderer } = require('electron');

const container = document.getElementById('bubble-container');
const contentEl = document.getElementById('bubble-content');
const progressEl = document.getElementById('bubble-progress');
const progressTextEl = document.getElementById('progress-text');
const actionsEl = document.getElementById('bubble-actions');

let autoHideTimer = null;

function closeBubble() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
  container.classList.add('closing');
  setTimeout(() => {
    ipcRenderer.send('hide-speech-bubble-done');
    container.classList.remove('closing');
  }, 190);
}

// Clicking anywhere on the bubble dismisses it smoothly
container.addEventListener('click', () => {
  closeBubble();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeBubble();
});

ipcRenderer.on('bubble-update', (event, payload) => {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }

  container.classList.remove('closing');

  if (payload.progress) {
    progressEl.classList.remove('hidden');
    progressTextEl.textContent = payload.progress;
  } else {
    progressEl.classList.add('hidden');
  }

  if (payload.text !== undefined) {
    contentEl.textContent = payload.text;
  }

  if (Array.isArray(payload.actions) && payload.actions.length > 0) {
    actionsEl.innerHTML = '';
    actionsEl.classList.remove('hidden');
    payload.actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.textContent = action.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (action.type === 'open-url' && action.url) {
          ipcRenderer.send('bubble-action-open-url', action.url);
        } else if (action.type === 'run-sync') {
          ipcRenderer.send('bubble-action-sync');
        } else if (action.type === 'copy' && action.copyText) {
          navigator.clipboard.writeText(action.copyText);
        }
        if (action.autoClose !== false) {
          closeBubble();
        }
      });
      actionsEl.appendChild(btn);
    });
  } else {
    actionsEl.classList.add('hidden');
    actionsEl.innerHTML = '';
  }

  const duration = payload.duration || 4500;
  if (duration > 0) {
    autoHideTimer = setTimeout(() => {
      closeBubble();
    }, duration);
  }
});

ipcRenderer.on('bubble-close-request', () => {
  closeBubble();
});
