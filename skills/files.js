/**
 * Skill: Pencarian File Cepat Windows (0 Token / Fast Path)
 * Menemukan file di harddisk (Documents, Downloads, Desktop) dan membukanya langsung.
 */
module.exports = {
  id: 'files',
  name: 'Pencarian File Pintar',
  category: 'system',
  description: 'Cari file di komputer dan buka secara otomatis (PDF, Excel, Word, Gambar).',
  examples: [
    'cari file laporan keuangan',
    'buka file proposal.pdf',
    'temukan file catatan'
  ],

  matchFastPlan({ clean }) {
    const searchMatch = clean.match(/^(?:cari|temukan|buka)\s+file\s+([a-z0-9\s._+-]+)$/i);
    if (searchMatch && searchMatch[1]) {
      const fileName = searchMatch[1].trim();
      return {
        steps: [{ action: 'search_open_file', query: fileName }],
        summary: `Mencari file "${fileName}"`,
        replyLang: 'id',
        reply: `Mencari file ${fileName}`
      };
    }
    return null;
  }
};

