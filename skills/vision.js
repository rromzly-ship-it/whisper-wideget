/**
 * Skill: Penglihatan Layar & Klik Visual (0 Token Fast-Path + Progressive Prompt Spec)
 * Menangani klik tombol/video/link visual di layar tanpa membuang token ke LLM atau salah buka tab.
 */
module.exports = {
  id: 'vision',
  name: 'Vision Layar & Klik Visual',
  category: 'vision',
  description: 'Melihat isi layar aktif, mencari elemen UI via UIA / grid visual 5x4, mengklik, mengetik di kolom, dan scroll area tertentu.',
  intentPattern: /\b(klik|pencet|tekan|pilih|lihat|layar|ada apa|baca|gambar|video|thumbnail|kolom|tulis di|ketik di|profil|akun|tombol|album|channel|komentar|atas|bawah|kanan|kiri)\b/i,
  promptSpec: 'vision_click{targetDescription,clickType:"left|double|right"} | vision_inspect{question} | vision_click_and_type{targetDescription,text,pressEnter:true} | vision_scroll{targetDescription,direction}',
  examples: [
    'klik video pertama',
    'klik video yang di samping',
    'klik Payung Teduh Untuk Perempuan',
    'klik tombol masuk / profil',
    'ada apa di layar sekarang?'
  ],

  matchFastPlan({ clean }) {
    // 1. Perintah klik/pilih/buka visual langsung di layar (video, tombol, menu, link, sidebar)
    const clickMatch = clean.match(/^(?:klik|pilih|tekan|pencet|tonton|buka\s+video|buka\s+menu)\s+(.+)$/i);
    if (clickMatch && clickMatch[1]) {
      let target = clickMatch[1].trim();
      target = target.replace(/\b(ya|dong|saja|aja|tolong|coba|nih|kan)\b/gi, '').trim();
      if (target.length >= 2 && !/^(tab\s+baru|youtube|aplikasi|folder)$/i.test(target)) {
        return {
          steps: [{ action: 'vision_click', targetDescription: target, clickType: 'left' }],
          summary: `Klik ${target}`,
          replyLang: 'id',
          reply: `Sip, aku klik ${target} ya`
        };
      }
    }
    return null;
  }
};
