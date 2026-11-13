/**
 * Skill: Navigasi Browser & YouTube (0 Token + Progressive Prompt Spec)
 * Menangani buka YouTube, cari konten langsung (MrBeast, Fourtwnty, dll.), kontrol tab Chrome, dan navigasi halaman.
 */
const QUERY_ALIAS_MAP = {
  'misterbis': 'MrBeast',
  'mister bis': 'MrBeast',
  'mr beast': 'MrBeast',
  'mrbeast': 'MrBeast',
  '420': 'Fourtwnty',
  'four twenty': 'Fourtwnty',
  'for twenty': 'Fourtwnty',
  'fourtwenty': 'Fourtwnty',
  'fourtwnty': 'Fourtwnty',
  'esterawan': 'EsteraOne',
  'itrend': 'iTrade ARSS Pro',
  'air trade': 'iTrade ARSS Pro'
};

function applyQueryAliases(query) {
  let res = String(query || '').trim();
  for (const [spoken, target] of Object.entries(QUERY_ALIAS_MAP)) {
    res = res.replace(new RegExp(`\\b${spoken}\\b`, 'gi'), target);
  }
  return res;
}

module.exports = {
  id: 'browser',
  name: 'Navigasi Browser & YouTube',
  category: 'browser',
  description: 'Buka YouTube, cari konten YouTube langsung, pindah tab Chrome, tab baru/tutup, maju/mundur/refresh halaman.',
  intentPattern: /\b(tab|chrome|youtube|yutub|browser|web|situs|halaman|cari|tonton|whatsapp|meet|link|google|buka\.com)\b/i,
  promptSpec: 'chrome_select_tab{keyword} | youtube_search{query}',
  examples: [
    'buka youtube',
    'buka youtube konten misterbis',
    'buka tab whatsapp',
    'tab berikutnya / tab sebelumnya',
    'tab baru / tutup tab / kembali'
  ],

  matchFastPlan({ clean }) {
    // 1. Buka YouTube langsung jika diminta eksplisit
    if (/^(?:buka|ke|tampilkan|jalankan)\s+(?:situs\s+|halaman\s+|aplikasi\s+|tab\s+)?(?:youtube|yutub)(?:\s+(?:saja|aja|dong|ya))?$/i.test(clean)) {
      return { steps: [{ action: 'open_url', url: 'https://www.youtube.com' }], summary: 'Buka YouTube', replyLang: 'id', reply: 'Sip, membuka YouTube ya' };
    }

    // 2. Buka YouTube + langsung cari konten HANYA jika diminta eksplisit mencari di YouTube dari awal
    let ytQuery = null;
    const ytMatch1 = clean.match(/^(?:buka\s+)?(?:youtube|yutub)[\s,]+(?:dan\s+)?(?:buka\s+)?(?:cari\s+|search\s+|konten\s+|content\s+|channel\s+)?(.+)$/i);
    if (ytMatch1 && ytMatch1[1]) {
      ytQuery = ytMatch1[1];
    } else {
      const ytMatch2 = clean.match(/^(?:cari|search)\s+(.+?)\s+di\s+(?:youtube|yutub)$/i);
      if (ytMatch2 && ytMatch2[1]) {
        ytQuery = ytMatch2[1];
      }
    }

    if (ytQuery) {
      let cleanYt = ytQuery.replace(/\b(ya|dong|saja|aja|tolong|coba|nih|kan)\b/gi, '').trim();
      cleanYt = cleanYt.replace(/^(?:buka\s+(?:konten|content)\s+|konten\s+|content\s+|cari\s+|search\s+)/i, '').trim();
      if (cleanYt.length >= 2 && !/^(ini|itu|semua)$/i.test(cleanYt)) {
        const finalQuery = applyQueryAliases(cleanYt);
        return {
          steps: [{ action: 'open_url', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(finalQuery)}` }],
          summary: `Buka YouTube cari ${finalQuery}`,
          replyLang: 'id',
          reply: `Sip, mencari ${finalQuery} di YouTube ya`
        };
      }
    }

    // 3. Navigasi & tab browser
    if (/^(?:(?:tolong|coba)\s+)?(?:kembali(?:\s+ke\s+halaman(?:\s+\w+)?)?(?:\s+yang)?\s+sebelumnya|halaman\s+sebelumnya|kembali|back)$/i.test(clean)) {
      return { steps: [{ action: 'hotkey', keys: 'browser_back' }], summary: 'Kembali ke halaman sebelumnya', replyLang: 'id', reply: 'Beres, kembali ke halaman sebelumnya ya' };
    }
    if (/^(?:maju(?:\s+ke\s+halaman\s+(?:berikutnya|selanjutnya))?|halaman\s+(?:berikutnya|selanjutnya)|forward)$/i.test(clean)) {
      return { steps: [{ action: 'hotkey', keys: 'browser_forward' }], summary: 'Maju satu halaman', replyLang: 'id', reply: 'Beres, maju ke halaman selanjutnya ya' };
    }
    if (/^(?:buka\s+)?tab\s+baru$|^new\s+tab$/i.test(clean)) {
      return { steps: [{ action: 'hotkey', keys: 'ctrl+t' }], summary: 'Buka tab baru', replyLang: 'id', reply: 'Sip, tab baru dibuka ya' };
    }
    if (/^(?:tutup\s+tab(?:\s+ini)?|close\s+tab)$/i.test(clean)) {
      return { steps: [{ action: 'hotkey', keys: 'ctrl+w' }], summary: 'Tutup tab', replyLang: 'id', reply: 'Beres, tab udah ditutup ya' };
    }
    if (/^(?:(?:ber)?pindah\s+ke\s+|buka\s+|kembali\s+ke\s+)?tab\s+sebelumnya$|^previous\s+tab$/i.test(clean)) {
      return { steps: [{ action: 'hotkey', keys: 'ctrl+shift+tab' }], summary: 'Pindah ke tab sebelumnya', replyLang: 'id', reply: 'Sip, pindah ke tab sebelumnya ya' };
    }
    if (/^(?:(?:ber)?pindah\s+ke\s+|buka\s+)?tab\s+(?:berikutnya|selanjutnya)$|^next\s+tab$/i.test(clean)) {
      return { steps: [{ action: 'hotkey', keys: 'ctrl+tab' }], summary: 'Pindah ke tab berikutnya', replyLang: 'id', reply: 'Sip, pindah ke tab berikutnya ya' };
    }
    const tabTargetMatch = clean.match(/^(?:(?:ber)?pindah\s+ke\s+|buka\s+)tab\s+([a-z0-9 ._+-]{2,28})(?:\s+di\s+browser.*)?$/i);
    if (tabTargetMatch && !/^(baru|sebelumnya|berikutnya|selanjutnya|ini|terakhir)$/i.test(tabTargetMatch[1].trim())) {
      const kw = tabTargetMatch[1].trim();
      return { steps: [{ action: 'chrome_select_tab', keyword: kw }], summary: `Pindah ke tab ${kw}`, replyLang: 'id', reply: `Sip, pindah ke tab ${kw} ya` };
    }
    if (/^(?:refresh|muat ulang)(?:\s+halaman)?$/i.test(clean)) {
      return { steps: [{ action: 'hotkey', keys: 'f5' }], summary: 'Refresh halaman', replyLang: 'id', reply: 'Beres, halaman dimuat ulang ya' };
    }

    return null;
  }
};

