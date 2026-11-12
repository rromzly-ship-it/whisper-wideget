/**
 * Skill: Scroll, Auto-Scroll, & Zoom (0 Token)
 * Menangani gulir satu langkah, auto-scroll pelan/sedang/cepat, berhenti scroll, dan zoom in/out/reset.
 */
module.exports = {
  id: 'scroll-zoom',
  name: 'Scroll & Zoom Layar',
  category: 'navigasi',
  description: 'Scroll atas/bawah/kiri/kanan, auto-scroll berkelanjutan dengan kontrol kecepatan, stop scroll, dan zoom.',
  examples: ['scroll ke bawah', 'scroll pelan-pelan ke bawah', 'berhenti scroll', 'zoom in', 'zoom out', 'reset zoom'],

  matchFastPlan({ clean }) {
    if (/^(?:scroll|gulir)\s+(?:ke\s+)?(bawah|down|atas|up|kiri|left|kanan|right)$/i.test(clean)) {
      const d = clean.match(/(bawah|down|atas|up|kiri|left|kanan|right)$/i)[1];
      const dir = /bawah|down/.test(d) ? 'down' : (/atas|up/.test(d) ? 'up' : (/kiri|left/.test(d) ? 'left' : 'right'));
      return { steps: [{ action: 'scroll', direction: dir }], summary: `Scroll ${dir}`, replyLang: 'id', reply: 'Oke' };
    }

    const autoMatch = clean.match(/^(?:scroll|gulir)\s+(?:otomatis|terus(?:-menerus)?|pelan(?:-pelan)?|lambat|sedang|cepat)\s+(?:pelan(?:-pelan)?\s+|terus\s+)?(?:ke\s+)?(bawah|down|atas|up|kiri|left|kanan|right)(?:\s+sampai.*)?$/i);
    if (autoMatch) {
      const d = autoMatch[1];
      const dir = /bawah|down/.test(d) ? 'down' : (/atas|up/.test(d) ? 'up' : (/kiri|left/.test(d) ? 'left' : 'right'));
      const speed = /\bcepat\b/i.test(clean) ? 'fast' : (/\bsedang\b/i.test(clean) ? 'medium' : 'slow');
      return { steps: [{ action: 'scroll_auto', direction: dir, speed }], summary: `Auto-scroll ${dir} (${speed})`, replyLang: 'id', reply: 'Oke' };
    }

    if (/^(?:berhenti|stop)\s+(?:scroll|gulir)$/i.test(clean)) {
      return { steps: [{ action: 'scroll_stop' }], summary: 'Stop scroll', replyLang: 'id', reply: 'Oke' };
    }

    if (/^(?:zoom\s+in|perbesar(?:\s+layar)?)$/i.test(clean)) {
      return { steps: [{ action: 'zoom', mode: 'in' }], summary: 'Zoom in', replyLang: 'id', reply: 'Oke' };
    }
    if (/^(?:zoom\s+out|perkecil(?:\s+layar)?)$/i.test(clean)) {
      return { steps: [{ action: 'zoom', mode: 'out' }], summary: 'Zoom out', replyLang: 'id', reply: 'Oke' };
    }
    if (/^(?:reset\s+zoom|zoom\s+reset)$/i.test(clean)) {
      return { steps: [{ action: 'zoom', mode: 'reset' }], summary: 'Reset zoom', replyLang: 'id', reply: 'Oke' };
    }

    return null;
  }
};

