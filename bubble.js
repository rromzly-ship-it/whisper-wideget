const { ipcRenderer } = require('electron');

const container = document.getElementById('bubble-container');
const titleEl = document.getElementById('bubble-title');
const contentEl = document.getElementById('bubble-content');
const progressEl = document.getElementById('bubble-progress');
const progressTextEl = document.getElementById('progress-text');
const actionsEl = document.getElementById('bubble-actions');
const btnClose = document.getElementById('btn-close-bubble');

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
  }, 210);
}

btnClose.addEventListener('click', closeBubble);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeBubble();
});

ipcRenderer.on('bubble-update', (event, payload) => {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }

  container.classList.remove('closing');

  if (payload.title) {
    titleEl.textContent = payload.title;
  } else {
    titleEl.textContent = 'Wis';
  }

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
      btn.textContent = action.label || 'Aksi';
      btn.addEventListener('click', () => {
        ipcRenderer.send('bubble-action-click', action);
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

  // Auto-hide if duration specified (e.g. 8000ms)
  if (payload.duration && payload.duration > 0) {
    autoHideTimer = setTimeout(() => {
      closeBubble();
    }, payload.duration);
  }
});

ipcRenderer.on('bubble-close-request', () => {
  closeBubble();
});
