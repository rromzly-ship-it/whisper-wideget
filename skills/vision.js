/**
 * Skill: Penglihatan Layar & Klik Visual (Progressive Prompt Spec)
 * Digunakan oleh LLM Planner saat user meminta melihat layar, mengklik tombol/thumbnail, atau mengetik ke kolom tertentu.
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
    'klik tombol masuk / profil',
    'ada apa di layar sekarang?',
    'tulis di kolom pencarian: lagu Fourtwnty'
  ]
};

