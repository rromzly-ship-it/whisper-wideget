/**
 * Skill: Custom Voice Macros (0 Token / Fast Path)
 * Menjalankan rantai perintah kustom yang dibuat pengguna di macros.json tanpa coding.
 */
const fs = require('fs');
const path = require('path');

let cachedMacros = null;
let lastLoadAt = 0;

function loadMacros() {
  const now = Date.now();
  if (cachedMacros && (now - lastLoadAt < 5000)) return cachedMacros;
  try {
    const p = path.join(__dirname, '..', 'macros.json');
    if (fs.existsSync(p)) {
      cachedMacros = JSON.parse(fs.readFileSync(p, 'utf8'));
    } else {
      cachedMacros = [];
    }
  } catch {
    cachedMacros = [];
  }
  lastLoadAt = now;
  return cachedMacros;
}

module.exports = {
  id: 'macro',
  name: 'Voice Macros Kustom',
  category: 'automation',
  description: 'Jalankan serangkaian perintah otomatis sesuai konfigurasi di macros.json.',
  examples: [
    'mode kerja',
    'mode santai'
  ],

  matchFastPlan({ clean }) {
    const list = loadMacros();
    for (const item of list) {
      if (item.trigger && item.trigger.toLowerCase().trim() === clean) {
        return {
          steps: Array.isArray(item.steps) ? item.steps : [],
          summary: item.description || `Macro: ${item.trigger}`,
          replyLang: 'id',
          reply: item.reply || 'Oke, macro dijalankan'
        };
      }
    }
    return null;
  }
};

