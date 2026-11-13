# 🗺️ ROADMAP PENGEMBANGAN WHISPER FLOATING WIDGET

Dokumen ini memuat peta jalan dan rencana pengembangan terstruktur untuk **Whisper Floating Widget** berdasarkan kebutuhan dan kesepakatan fitur terbaru.

---

## 🚨 PRIORITAS SEGERA (BUGFIX & POLISHING INTERAKSI)
- [ ] **Perbaikan Logika Menu Klik Kanan (Setting & Close):**
  - **Masalah Saat Ini:** Klik kanan pada tombol mikrofon mengharuskan tombol mouse tetap ditahan agar menu tidak hilang kembali.
  - **Solusi yang Diterapkan:**
    1. Klik kanan sekali pada mikrofon ➔ Menu langsung muncul dan **tetap terbuka** (*stay open / toggle on*).
    2. Klik di luar area menu (*klik ngasal / blur*) ATAU klik kanan sekali lagi pada mikrofon ➔ Menu otomatis menutup (*toggle off*).

---

## 🎨 FASE 1: VISUAL HIDUP, BUBBLE SUBTITLE & KARAKTER WIS
- [ ] **Speech Bubble Dinamis (Balon Percakapan di Atas Wis):**
  - Balon dialog interaktif melayang di atas widget Wis untuk menampilkan respon teks, jawaban analisa, dan status.
  - Opsi tombol tindakan di dalam bubble (contoh: `[🌐 Buka di Chrome]`, `[Salin Jawaban]`).
- [ ] **Indikator Animasi Pencarian / Berpikir:**
  - Animasi pupil mata berputar (*radar scan mode*) saat Wis sedang menganalisis atau mencari data di web.
  - Progress status beranimasi di bawah bubble: *"🔍 Membaca konteks..."* ➔ *"🌐 Menelusuri informasi..."* ➔ *"💡 Menyusun analisa..."*.
- [ ] **Mode Auto-Sleep & Auto-Shrink Saat Idle:**
  - Jika tidak ada interaksi dalam periode tertentu (misal 30 detik):
    - Widget Wis dan mikrofon mengecil secara halus (*smooth shrink*) merapat ke tepi layar.
    - Raut muka Wis perlahan mengantuk lalu tertidur lelap dengan efek pernapasan santai (`z z Z`).
    - Kursor mendekat atau sentuhan layar langsung membangunkan Wis (*wake-up bounce*) ke ukuran normal.
- [ ] **Mulut Dinamis & Artikulasi Jelas (Lip-Sync A-I-U-E-O):**
  - Komponen mulut di bawah mata yang sinkron secara real-time dengan audio Piper TTS.
  - Bentuk mulut menyesuaikan fonem vokal:
    - **A / O:** Terbuka lebar / bulat.
    - **I / E:** Melebar pipih horizontal.
    - **U / M:** Mengerucut kecil.
    - **Diam:** Senyum tipis natural.

---

## 🧠 FASE 2: KECERDASAN KONTEKS SELEKSI & AUTO-STOP (VAD)
- [ ] **Smart Selection Action (Olah Teks yang Diblok):**
  - Deteksi teks yang sedang diseleksi di Word, Notepad, Browser, atau aplikasi apa pun via simulasi senyap `Ctrl + C`.
  - Kemampuan perintah suara seperti: *"Wis, perbaiki grammar teks ini"*, *"Wis, rangkum ini"*, *"Wis, terjemahkan ke bahasa Inggris"*.
  - Menimpa teks terseleksi langsung via `Ctrl + V`.
- [ ] **Smart Voice Activity Detection (Auto-Stop Tanpa Klik Pause):**
  - Menghentikan perekaman secara otomatis saat terdeteksi hening 0.7 - 1 detik, memproses suara dalam 1 paket utuh ke Groq Whisper tanpa membuang token dan bebas typo.

---

## 👁️ FASE 3: AGENTIC SCREEN RESEARCH & VISION
- [ ] **Tanya Layar Aktif ("Wis tolong jelaskan apa yang ada di layar"):**
  - Cuplikan layar otomatis menggunakan model Vision Llama 3.2 11B untuk menganalisis grafik, dokumen, atau error di layar.
- [ ] **Autonomous Research ("Wis tolong carikan info yang berkaitan dengan di layar ini"):**
  - Wis mengekstrak konteks layar ➔ melakukan pencarian mandiri di Google/YouTube/web di balik layar (backend).
  - Menyampaikan kesimpulan dan saran di Speech Bubble tanpa harus membuka browser terlebih dahulu, dengan opsi membuka link sumber langsung ke Chrome.

---

## 🖥️ FASE 4: INTEGRASI APLIKASI WINDOWS & CI/CD GITHUB
- [ ] **Modular Skills Tambahan (`skills/`):**
  - **`whatsapp.js`:** Kirim pesan WhatsApp Desktop ke kontak yang dituju via suara.
  - **`telegram.js`:** Integrasi pesan Telegram.
  - **`files.js`:** Pencarian kilat file di harddisk via utilitas Everything CLI.
  - **`macro.js`:** Pembuat jalan pintas perintah suara kustom (*Voice Macros*) via konfigurasi JSON.
- [ ] **CI/CD GitHub Actions & In-App Auto-Update:**
  - Build otomatis installer portable `.exe` di cloud GitHub Actions setiap ada tag rilis baru.
  - Pengecekan versi otomatis saat aplikasi dijalankan, memberi tahu pengguna jika ada pembaruan baru dari GitHub yang siap diterapkan.
