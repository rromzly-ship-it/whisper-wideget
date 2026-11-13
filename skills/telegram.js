/**
 * Skill: Telegram Desktop Automation (0 Token / Fast Path)
 * Menangani buka Telegram Desktop dan kirim pesan via suara.
 */
module.exports = {
  id: 'telegram',
  name: 'Telegram Desktop',
  category: 'communication',
  description: 'Buka Telegram Desktop atau fokus ke jendela percakapan.',
  examples: [
    'buka telegram',
    'buka aplikasi telegram'
  ],

  matchFastPlan({ clean }) {
    if (/^(?:buka\s+(?:aplikasi\s+|app\s+)?)?telegram$/i.test(clean) || clean === 'buka telegram') {
      return {
        steps: [{ action: 'open_app', appName: 'telegram', forceNew: false }],
        summary: 'Membuka Telegram Desktop',
        replyLang: 'id',
        reply: 'Oke'
      };
    }
    return null;
  }
};
