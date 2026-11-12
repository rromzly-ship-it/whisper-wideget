/**
 * Skill: Sapaan Cepat (0 Token)
 * Menangani sapaan dan variasi transkripsi Whisper ("high wish", "hi wish", dll.) tanpa memanggil API LLM.
 */
module.exports = {
  id: 'greeting',
  name: 'Sapaan Cepat',
  category: 'percakapan',
  description: 'Membalas sapaan seperti Hai Wis, Halo Wis, atau Apa Kabar secara instan (0 token).',
  examples: ['Hai Wis', 'High wish', 'Halo Wis', 'Apa kabar Wis'],

  matchFastPlan({ rawLow }) {
    if (
      /^(?:hai|halo|hei|hi|hey|high)\s*(?:wis|wish|wiz|whiz)?$/i.test(rawLow) ||
      /^(?:selamat\s+(?:pagi|siang|sore|malam)|apa\s+kabar|gimana\s+kabarnya)(?:\s+(?:wis|wish|wiz))?$/i.test(rawLow) ||
      /^(?:tes|test|pagi|siang|malam)$/i.test(rawLow)
    ) {
      return {
        steps: [{ action: 'chat_reply', reply: 'Halo, ada yang bisa Wis bantu?' }],
        summary: 'Sapaan',
        replyLang: 'id',
        reply: 'Halo, ada yang bisa Wis bantu?'
      };
    }
    return null;
  }
};

