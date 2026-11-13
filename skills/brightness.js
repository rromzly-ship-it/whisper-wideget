/**
 * Skill: Kontrol Kecerahan Layar (0 Token)
 * Mengatur brightness/kecerahan layar Windows ke persentase kustom sesuai ucapan pengguna.
 */
module.exports = {
  id: 'brightness',
  name: 'Kontrol Kecerahan Layar',
  category: 'system',
  description: 'Atur kecerahan / brightness layar Windows ke persentase kustom (misal: 20%, 30%, 50%, 80%).',
  examples: ['turunkan brightness jadi 20%', 'kecerahan 30%', 'atur brightness ke 50%', 'redupkan layar', 'terangkan layar'],

  matchFastPlan({ clean }) {
    // 1. Custom percentage: "turunkan brightness jadi 20%", "kecerahan 30%", "atur brightness ke 50%"
    const percentMatch = clean.match(/(?:atur\s+|set\s+|ubah\s+|turunkan\s+|naikkan\s+|bikin\s+)?(?:brightness|kecerahan|pencahayaan)(?:\s+(?:layar|screen))?(?:\s+(?:jadi|ke|menjadi))?\s*(\d{1,3})\s*(?:%|persen)?/i)
      || clean.match(/^(?:brightness|kecerahan|pencahayaan)\s*(\d{1,3})\s*(?:%|persen)?$/i);
    
    if (percentMatch) {
      const val = parseInt(percentMatch[1], 10);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        return {
          steps: [{ action: 'set_brightness', percent: val }],
          summary: `Atur kecerahan layar ke ${val}%`,
          replyLang: 'id',
          reply: `Kecerahan diatur ke ${val}%`
        };
      }
    }

    // 2. Relative adjustments (no specific number): "turunkan brightness", "naikkan kecerahan"
    if (/^(?:turunkan|kurangi|rendahkan)\s+(?:brightness|kecerahan|pencahayaan)(?:\s+(?:layar|screen))?$/i.test(clean)) {
      return {
        steps: [{ action: 'set_brightness', delta: -20 }],
        summary: 'Turunkan kecerahan layar',
        replyLang: 'id',
        reply: 'Kecerahan layar diturunkan'
      };
    }
    if (/^(?:naikkan|tambah|tinggikan)\s+(?:brightness|kecerahan|pencahayaan)(?:\s+(?:layar|screen))?$/i.test(clean)) {
      return {
        steps: [{ action: 'set_brightness', delta: 20 }],
        summary: 'Naikkan kecerahan layar',
        replyLang: 'id',
        reply: 'Kecerahan layar dinaikkan'
      };
    }

    // 3. Preset: Redupkan layar (25%) / Terangkan layar (85%)
    if (/^(?:redupkan|gelapkan)\s+layar$/i.test(clean) || clean === 'redupkan') {
      return {
        steps: [{ action: 'set_brightness', percent: 25 }],
        summary: 'Redupkan layar ke 25%',
        replyLang: 'id',
        reply: 'Layar diredupkan ke 25%'
      };
    }
    if (/^(?:terangkan|cerahkan)\s+layar$/i.test(clean) || clean === 'terangkan') {
      return {
        steps: [{ action: 'set_brightness', percent: 85 }],
        summary: 'Terangkan layar ke 85%',
        replyLang: 'id',
        reply: 'Layar diterangkan ke 85%'
      };
    }
    return null;
  }
};

