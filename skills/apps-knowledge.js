/**
 * Skill: Knowledge Library Aplikasi & Web Kustom Pengguna (0 Token)
 * Menangani akses instan ke website kustom, dashboard internal, atau aplikasi lokal
 * yang didaftarkan pengguna di Menu Pengaturan (misal: Artax, portal kerja, dll.).
 */
const fs = require('fs');
const path = require('path');

const KNOWLEDGE_FILE = path.join(__dirname, '..', 'apps-knowledge.json');

function loadKnowledge() {
  try {
    if (fs.existsSync(KNOWLEDGE_FILE)) {
      const data = fs.readFileSync(KNOWLEDGE_FILE, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch (e) {
    console.warn('Gagal membaca apps-knowledge.json:', e.message);
  }
  return [];
}

module.exports = {
  id: 'apps-knowledge',
  name: 'Library App & Web Kustom',
  category: 'knowledge',
  description: 'Akses cepat ke aplikasi atau website kustom yang didaftarkan pengguna di Menu Pengaturan.',
  examples: ['buka artax', 'buka web artax', 'ke artax', 'akses portal kantor'],

  matchFastPlan({ clean, rawLow }) {
    const list = loadKnowledge();
    if (!Array.isArray(list) || list.length === 0) return null;

    // Normalisasi input user: hilangkan kata perintah awalan
    const stripped = clean
      .replace(/^(?:buka|ke|tampilkan|jalankan|kunjungi|akses)\s+(?:situs\s+|website\s+|web\s+|aplikasi\s+|portal\s+|program\s+|app\s+)?/i, '')
      .replace(/\s+(?:dong|ya|aja|saja)$/i, '')
      .trim()
      .toLowerCase();

    for (const item of list) {
      if (!item || !item.name || !item.target) continue;

      const candidates = [];
      if (item.name) candidates.push(item.name.toLowerCase());
      if (item.spoken) candidates.push(item.spoken.toLowerCase());
      if (Array.isArray(item.aliases)) {
        item.aliases.forEach(a => {
          if (a) candidates.push(String(a).trim().toLowerCase());
        });
      }

      for (const cand of candidates) {
        if (!cand) continue;
        // Match exact stripped name OR full clean command
        const candRegex = new RegExp(`^(?:buka\\s+|ke\\s+|akses\\s+)?(?:situs\\s+|web\\s+|aplikasi\\s+)?${cand.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}$`, 'i');
        
        if (stripped === cand || candRegex.test(clean) || candRegex.test(rawLow)) {
          const isWeb = (item.type === 'web') || /^https?:\/\//i.test(item.target);
          return {
            steps: [
              isWeb
                ? { action: 'open_url', url: item.target }
                : { action: 'open_app', appName: item.target, forceNew: false }
            ],
            summary: `Buka ${item.name}`,
            replyLang: 'id',
            reply: `Siap, membuka ${item.name}`
          };
        }
      }
    }

    return null;
  }
};
