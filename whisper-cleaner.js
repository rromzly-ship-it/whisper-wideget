/**
 * Whisper Hallucination & Repetition Cleaner
 * Membersihkan anomali khas model OpenAI Whisper pada audio hening/jeda:
 * 1. Halusinasi penutup YouTube ('Terima kasih', 'Terima kasih sudah menonton', 'Thank you for watching')
 * 2. Halusinasi pembuka jeda ('Hai', 'Halo')
 * 3. Repetition loop / perulangan token tak berujung ('hai hai hai hai...', 'dan dan dan')
 * 4. Halusinasi murni audio hening/noise
 */

const SOLITARY_HALLUCINATIONS = [
  /^(?:hai|halo|hei|hi)[.!,?]*$/i,
  /^(?:terima\s+kasih(?:\s+(?:banyak|sudah\s+menonton|telah\s+menonton))?)[.!,?]*$/i,
  /^(?:thank\s+you(?:\s+(?:very\s+much|so\s+much|for\s+watching))?|thanks(?:\s+for\s+watching)?)[.!,?]*$/i,
  /^(?:please\s+subscribe|subscribe|like\s+and\s+subscribe|subtitles?\s+by.*|see\s+you|sampai\s+jumpa|bye(?:\s+bye)?)[.!,?]*$/i,
  /^(?:3d\s+printing|you|okay|ok|uh+|um+|hmm+|ah+)[.!,?]*$/i
];

function cleanWhisperTranscript(raw) {
  let text = String(raw || '').trim();
  if (!text) return '';

  // 1. Jika teks murni hanya berupa frasa halusinasi hening tunggal, buang total (jadikan string kosong)
  for (const pattern of SOLITARY_HALLUCINATIONS) {
    if (pattern.test(text)) {
      return '';
    }
  }

  // 2. Bersihkan perulangan kata beruntun (Repetition Loop: 'hai hai hai hai...', 'dan dan dan...')
  // Spesifik kata halusinasi berulang 2x atau lebih
  text = text.replace(/(?:\b(hai|halo|hei|hi|terima\s+kasih|thank\s+you|dan|nya|oke|ok|yes|no)\b[\s,.]*){2,}/gi, '');
  // Umum kata apa saja yang berulang 3x berturut-turut
  text = text.replace(/\b([a-zA-Z0-9_]+)(?:[\s,.]+\1){2,}\b/gi, '');

  // 3. Bersihkan halusinasi pembuka di awal kalimat (misal: 'Hai, tolong buka Google' -> 'tolong buka Google')
  text = text.replace(/^(?:hai|halo|hei|hi|terima\s+kasih(?:\s+(?:sudah|telah)\s+menonton|\s+banyak)?|thank\s+you(?:\s+for\s+watching)?)[,.:;!\s\-]+(?=\S)/i, '');

  // 4. Bersihkan halusinasi penutup di akhir kalimat (misal: 'buka aplikasi word terima kasih' -> 'buka aplikasi word')
  text = text.replace(/[,.:;!\s\-]+(?:terima\s+kasih(?:\s+(?:sudah|telah)\s+menonton|\s+banyak)?|thank\s+you(?:\s+for\s+watching)?|sampai\s+jumpa|see\s+you|bye(?:\s+bye)?|hai(?:\s+hai)*)[.!]?$/i, '');

  text = text.trim();

  // 5. Cek ulang jika setelah pembersihan teks hanya menyisakan frasa halusinasi
  for (const pattern of SOLITARY_HALLUCINATIONS) {
    if (pattern.test(text)) {
      return '';
    }
  }

  return text;
}

module.exports = {
  cleanWhisperTranscript
};
