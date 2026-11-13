/**
 * Skill: Kontrol Media & Audio (0 Token)
 * Menangani pause/play video, mute, fullscreen video, serta klik/putar video berdasarkan judul secara instan.
 */
module.exports = {
  id: 'media',
  name: 'Kontrol Media & Volume',
  category: 'audio-video',
  description: 'Pause/play video, mute video, fullscreen video, serta putar video tertentu.',
  examples: ['play video', 'pause video', 'lanjutkan video', 'mute', 'fullscreen video', 'putar video kue lapis'],

  matchFastPlan({ clean }) {
    // 1. Play / Pause / Jeda / Lanjutkan video umum
    if (/^(?:play|putar|mainkan|pause|post|jeda|hentikan|lanjutkan|lanjut|resume)\s+(?:video(?:\s+(?:ini|nya))?|lagu(?:\s+(?:ini|nya))?|musik(?:\s+(?:ini|nya))?)$|^play$|^putar$|^pause$/i.test(clean)) {
      const isPause = /pause|post|jeda|hentikan/i.test(clean);
      return {
        steps: [{ action: 'hotkey', keys: 'k' }],
        summary: isPause ? 'Jeda video' : 'Putar video',
        replyLang: 'id',
        reply: isPause ? 'Video dijeda' : 'Video dimainkan'
      };
    }

    // 2. Putar / Play video berdasarkan judul yang terlihat di layar
    const titlePlayMatch = clean.match(/^(?:play|putar|tonton|mainkan|klik)\s+video\s+(.+)$/i);
    if (titlePlayMatch && titlePlayMatch[1]) {
      const targetTitle = titlePlayMatch[1].replace(/\b(ya|dong|saja|aja|tolong|coba)\b/gi, '').trim();
      if (targetTitle && !/^(ini|nya|itu)$/i.test(targetTitle)) {
        return {
          steps: [{ action: 'vision_click', targetDescription: `video ${targetTitle}`, clickType: 'left' }],
          summary: `Putar video ${targetTitle}`,
          replyLang: 'id',
          reply: `Siap, memutar video ${targetTitle}`
        };
      }
    }

    // 3. Mute / Unmute
    if (/^(?:mute|unmute|bisukan|senyapkan)(?:\s+(?:video|suara|audio))?$/i.test(clean)) {
      return {
        steps: [{ action: 'hotkey', keys: 'm' }],
        summary: 'Mute/Unmute audio video',
        replyLang: 'id',
        reply: 'Suara video disesuaikan'
      };
    }

    // 4. Fullscreen
    if (/^(?:fullscreen|layar penuh)\s+video(?:\s+ini)?$/i.test(clean)) {
      return {
        steps: [{ action: 'hotkey', keys: 'f' }],
        summary: 'Layar penuh video',
        replyLang: 'id',
        reply: 'Layar penuh diaktifkan'
      };
    }

    return null;
  }
};
