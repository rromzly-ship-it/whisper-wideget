/**
 * Skill: Kontrol Media & Audio (0 Token)
 * Menangani pause/play video, mute, fullscreen video, serta volume sistem secara instan.
 */
module.exports = {
  id: 'media',
  name: 'Kontrol Media & Volume',
  category: 'audio-video',
  description: 'Pause/play video, mute video, fullscreen video, serta kontrol cepat media.',
  examples: ['pause video', 'lanjutkan video', 'mute', 'fullscreen video'],

  matchFastPlan({ clean }) {
    if (/^(?:pause|post|jeda|hentikan|lanjutkan|lanjut|resume)\s+(?:video(?:\s+ini)?|lagu(?:\s+ini)?|musik(?:\s+ini)?)$/i.test(clean) || clean === 'pause') {
      return { steps: [{ action: 'hotkey', keys: 'k' }], summary: 'Pause/Play video', replyLang: 'id', reply: 'Oke' };
    }
    if (/^(?:mute|unmute|bisukan|senyapkan)(?:\s+(?:video|suara|audio))?$/i.test(clean)) {
      return { steps: [{ action: 'hotkey', keys: 'm' }], summary: 'Mute video', replyLang: 'id', reply: 'Oke' };
    }
    if (/^(?:fullscreen|layar penuh)\s+video(?:\s+ini)?$/i.test(clean)) {
      return { steps: [{ action: 'hotkey', keys: 'f' }], summary: 'Fullscreen video', replyLang: 'id', reply: 'Oke' };
    }
    return null;
  }
};

