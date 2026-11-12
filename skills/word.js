/**
 * Skill: Automasi Microsoft Word (Progressive Prompt Spec)
 * Digunakan oleh LLM Planner saat user meminta membuat, membuka, menulis, memperbaiki typo/ejaan, atau menyimpan dokumen Word.
 */
module.exports = {
  id: 'word',
  name: 'Automasi Microsoft Word',
  category: 'produktivitas',
  description: 'Buat dokumen Word baru, buka file dokumen, tulis draf catatan via AI, perbaiki typo/tata bahasa, dan simpan dokumen.',
  intentPattern: /\b(word|dokumen|surat|catat|tugas|laporan|revisi|perbaiki|typo|simpan|\.doc|\.pdf)\b/i,
  promptSpec: 'word_new_doc{} | word_open_file{query} | word_write{instruction} | word_fix{instruction} | word_save{fileName}',
  examples: [
    'buka word baru',
    'buka file laporan bulan ini',
    'tulis catatan tentang rencana kerja',
    'perbaiki ejaan teks ini',
    'simpan dokumen'
  ]
};

