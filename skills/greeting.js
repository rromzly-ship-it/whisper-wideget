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

  matchFastPlan({ raw, rawLow, clean }) {
    if (
      /^(?:hai|halo|hei|hi|hey|high)\s*(?:wis|wish|wiz|whiz|whisper|wisper)?$/i.test(rawLow) ||
      /^(?:whisper|wisper|wis|wish|wiz)$/i.test(rawLow) ||
      /^(?:(?:selamat\s+)?(?:pagi|siang|sore|malam)|apa\s+kabar|gimana\s+kabarnya)(?:\s+(?:wis|wish|wiz|whiz|whisper|wisper))?$/i.test(rawLow) ||
      /^(?:tes|test|pagi|siang|malam)$/i.test(rawLow) ||
      clean === ''
    ) {
      return {
        steps: [{ action: 'chat_reply', reply: 'Halo! Ada yang bisa Wis bantu?' }],
        summary: 'Sapaan ramah',
        replyLang: 'id',
        reply: 'Halo! Ada yang bisa Wis bantu?'
      };
    }
    return null;
  }
};

