/**
 * Skill: WhatsApp Desktop & Web Automation (0 Token / Fast Path)
 * Menangani buka WhatsApp, fokus ke chat, dan kirim pesan instan via suara.
 */
const { shell } = require('electron');

module.exports = {
  id: 'whatsapp',
  name: 'WhatsApp & Pesan Suara',
  category: 'communication',
  description: 'Buka aplikasi WhatsApp Desktop atau kirim pesan cepat langsung via suara.',
  examples: [
    'buka aplikasi whatsapp',
    'buka whatsapp',
    'kirim wa ke budi bilang saya sudah sampai',
    'chat wa'
  ],

  matchFastPlan({ clean, raw }) {
    // 1. Buka aplikasi WhatsApp
    if (/^(?:buka\s+(?:aplikasi\s+|app\s+)?)?(?:whatsapp|wa)$/i.test(clean) || clean === 'buka whatsapp' || clean === 'buka wa') {
      return {
        steps: [{ action: 'open_app', appName: 'whatsapp', forceNew: false }],
        summary: 'Membuka WhatsApp Desktop',
        replyLang: 'id',
        reply: 'Oke'
      };
    }

    // 2. Kirim pesan WA cepat: "kirim wa ke [nama] bilang [pesan]"
    const sendMatch = clean.match(/^(?:kirim\s+(?:pesan\s+)?wa|chat\s+wa)\s+ke\s+([a-z0-9\s._+-]+?)\s+(?:bilang|katakan|isi|pesan)?\s+(.+)$/i);
    if (sendMatch) {
      const recipient = sendMatch[1].trim();
      const message = sendMatch[2].trim();
      return {
        steps: [
          { action: 'open_app', appName: 'whatsapp', forceNew: false },
          { action: 'whatsapp_send', recipient, message }
        ],
        summary: `Kirim WA ke ${recipient}`,
        replyLang: 'id',
        reply: `Membuka chat WhatsApp untuk ${recipient}`
      };
    }

    return null;
  }
};
