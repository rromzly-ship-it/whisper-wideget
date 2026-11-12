/**
 * Skill: Ingatan, Kamus Alias, & Belajar Skill Baru (Progressive Prompt Spec)
 * Digunakan oleh LLM Planner saat user melatih Wis mengingat fakta, istilah alias, atau resep perintah baru.
 */
module.exports = {
  id: 'memory',
  name: 'Ingatan, Alias & Belajar Skill',
  category: 'pembelajaran',
  description: 'Menyimpan fakta pribadi, memetakan salah dengar/alias ucapan, dan melatih skill kustom baru via suara tanpa coding.',
  intentPattern: /\b(ingat|belajar|pelajari|alias|skill|lupa|maksudnya|kalau bilang|arti)\b/i,
  promptSpec: 'learn_alias{spoken,target} | save_memory{fact} | learn_skill{trigger,description,steps}',
  examples: [
    'Wis ingat kalau saya bilang air trade maksudnya iTrade ARSS Pro',
    'Wis belajar, kalau saya bilang bersih-bersih, tampilkan desktop'
  ]
};

