# 📋 CHANGELOG & RIWAYAT PEMBARUAN

Dokumen ini mencatat seluruh riwayat pembaruan sistem **Whisper Floating Widget**. Setiap agent atau pengembang yang melakukan perubahan **wajib** mencatat ringkasan pembaruan di sini dan melakukan push ke GitHub.

---

## [v1.0.7] - 2026-11-13 (Pembaruan Terkini)

### 🚀 Redesign Side Menu Pengaturan, Noise Gate (Tahap 1), & Voice Identity Kunci Suara Pemilik (Tahap 2):
- **Redesign UI Menu Pengaturan: Side Menu Modern & Collapsible:**
  - Mengubah layout tab horizontal menjadi **Side Menu / Collapsible Sidebar** modern (`.shell`, `aside`, `nav`, `main`, `header`, `.content`) sesuai persis dengan spesifikasi dan kode template pengguna.
  - Sidebar dapat diciutkan (*compact mode* 58px) dengan tombol toggle panel atau dilebarkan (232px) dengan transisi halus.
  - Navigasi 6 halaman lengkap: **Pengaturan**, **Profil Suara Pemilik**, **Library App & Web**, **Log**, **Token & Kuota**, serta **Panduan** interaktif dengan tombol "Coba".
  - Ukuran jendela diperbarui menjadi 860x640px dengan fitur resizable agar tampilan lapang dan elegan.
- **Tahap 1: Noise Gate & Sensitivitas Jarak Mikrofon:**
  - Opsi mematikan *Auto Gain Control* (AGC) agar mikrofon laptop tidak otomatis mendongkrak sensitivitas saat hening dan tidak menyerap suara orang di ruangan.
  - Filter Noise Gate dengan slider desibel (-50 dB s.d. -20 dB, default -38 dB) terintegrasi pada tombol mikrofon dikte (`widget.js`) dan asisten Wis (`eye.js`) untuk memotong desisan AC, kipas, dan obrolan latar belakang.
- **Tahap 2: Voice Identity & Speaker Verification (Kunci Suara Pemilik):**
  - Modul baru [voice-profile.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/voice-profile.js) (0 dependensi): mengekstrak sidik vokal akustik pemilik (Pitch F0, 24-band Mel filterbank, 12 MFCCs, Spectral Centroid) dan disimpan di `voice-profile.json`.
  - Halaman pendaftaran sampel suara 5 detik dengan countdown dan meter level mic di tab *"Profil Suara Pemilik"*.
  - Fasilitas live test 3 detik untuk menguji skor kemiripan suara (%) secara langsung.
  - Switch **"Kunci Mikrofon Hanya Untuk Suara Pemilik" (Lock to My Voice)**: saat aktif, ucapan dari orang lain atau noise di ruangan otomatis ditolak dan tidak diproses ke Whisper/Wis.

---

## [v1.0.6] - 2026-11-13 (Pembaruan Terkini)

### 🚀 Bahasa Santai (Non-Militer), Konteks Aktif In-Place, & Animasi Flat Huruf Z:
- **Gaya Bahasa Santai & Akrab (Menghapus Total Kata Kaku / Militer "Siap"):**
  - Wis kini berbicara dengan gaya bahasa Indonesia sehari-hari yang santai, luwes, dan akrab layaknya teman ngobrol (*"Sip, lagi diputar nih"*, *"Beres, kembali ke halaman sebelumnya ya"*, *"Sip, aku klik ya"*, *"Beres, kecerahan udah diturunin ya"*, *"Iya, lagi dibuka nih"*).
  - Menghapus kata kaku/militer "Siap" di semua modul skill (`browser`, `media`, `vision`, `apps-knowledge`, `window`, `brightness`, `scroll-zoom`, `whatsapp`, `telegram`, `macro`) dan instruksi LLM di `assistant.js`.
  - `tts.js` menormalisasi kata "oke", "ok", "okey", dan "siap" menjadi "Sip" yang terdengar renyah, natural, dan bebas dari distorsi fonetik "okret".
- **Prinsip Melanjutkan Konteks Aktif (Dilarang Membuka Tab Baru Sembarangan):**
  - Wis memegang aturan mutlak untuk selalu melanjutkan interaksi pada halaman, menu, atau jendela aplikasi yang sedang aktif di layar.
  - Perintah klik elemen visual, pilih video di samping/rekomendasi (*"klik video yang di samping"*, *"klik video yang lain"*, *"putar resep kue lapis"*, *"pilih menu panduan"*): WAJIB menggunakan `vision_click` langsung di tempat (*in-place*) pada layar aktif tanpa membuka tab baru atau mengubah URL.
  - Membuka tab baru (`ctrl+t` / `open_url`) HANYA diizinkan jika pengguna secara eksplisit dan sengaja memerintahkan membuka tab baru atau browsing dari awal (*"buka tab baru dan cari ..."*, *"buka website ..."*).
  - Penyesuaian `skills/browser.js` dan urutan prioritas di `skills/index.js` sehingga aksi in-place layar (`visionSkill`, `mediaSkill`) selalu diprioritaskan sebelum penelusuran URL.
- **Penyempurnaan Animasi Tidur Huruf Z (Flat & Bebas Kotak Terpotong):**
  - Menghapus text-shadow berwarna biru pada partikel huruf `Z` sehingga tampil minimalis flat putih bersih (`#FFFFFF`).
  - Memperbaiki lintasan dan batas animasi `float-z`: partikel Z melayang ke atas-kanan sambil mengecil secara dinamis (`scale(0.1)`) dan memudar perlahan (`opacity: 0`) jauh sebelum mencapai batas jendela Electron 64x64, sehingga sama sekali tidak pernah terpotong oleh batas kotak jendela (*no margin clipping*).
- **Optimasi VAD Anti Speaker Bleed:**
  - Menambahkan algoritma adaptive drop-off VAD dan hard ceiling timeout (2.8s) agar audio laptop dari video yang sedang berputar tidak menahan jeda perintah suara pengguna.

---

## [v1.0.5] - 2026-11-13 (Pembaruan Terkini)

### 🚀 Fitur Baru Library Aplikasi & Website Kustom + Polishing Total:
- **Fitur Baru "Library App & Web" di Menu Pengaturan (`settings.html`/`settings.js`):**
  - Tab baru untuk mendaftarkan website atau aplikasi kustom (contoh: **Artax**).
  - Menyimpan nama, tipe (`web` / `app`), target URL/path, dan variasi cara penyebutan (*voice aliases*).
  - Terintegrasi langsung dengan modul skill [skills/apps-knowledge.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/skills/apps-knowledge.js) untuk eksekusi instan 0ms (0 token), serta diinjeksikan ke prompt LLM sebagai knowledge base Wis.
- **Perbaikan Ucapan "Oke" (Eliminasi Bunyi "Okret"):**
  - Normalisasi fonetik di `tts.js` memetakan kata "oke", "ok", dan "okey" menjadi "Siap" yang terdengar natural dan jernih pada Piper Indonesian TTS.
  - Menghapus instruksi balasan generik "Oke" di sistem prompt LLM dan menggantinya dengan konfirmasi ramah dan spesifik (*"Siap, membuka YouTube"*, *"Siap, memutar video"*, *"Video dimainkan"*).
- **Redesign Speech Bubble Minimalis Gaya WhatsApp:**
  - Menghapus total header bar (ikon mata, judul Wis, tombol silang) sesuai permintaan pengguna; murni hanya menampilkan teks pesan.
  - Desain bubble mengadopsi gaya chat bubble abu-abu gelap WhatsApp (`#202c33`), teks `#e9edef`, dan tail segitiga rapi mengarah ke Wis.
  - Ukuran jendela diperkecil dan auto-fit agar kompak dan tidak menghalangi tampilan layar.
- **Perbaikan Kontrol Kecerahan Layar (Brightness):**
  - Mengatasi kendala sintaks CIM dengan `Invoke-CimMethod -MethodName WmiSetBrightness`.
  - Mendukung persentase kustom ("turunkan brightness jadi 20%") serta perintah relatif ("turunkan brightness", "naikkan kecerahan").
- **Penyempurnaan Visual Karakter Wis:**
  - Animasi mulut artikulasi kini diwarnai putih bersih (`#FFFFFF`) serasi dengan mata (menghilangkan warna hitam).
  - Animasi huruf `Z` tidur kini berukuran besar, beranimasi mengambang keluar dari kepala Wis ke arah atas-kanan tanpa terpotong lingkaran mata.

---

## [v1.0.4] - 2026-11-13

### 🐛 Perbaikan Bug Sintaks & Deklarasi Ganda:
- **Perbaikan SyntaxError di `skills/index.js`:**
  - Menghapus deklarasi ganda modul skill (`brightnessSkill`, `whatsappSkill`, `telegramSkill`, `filesSkill`, `macroSkill`) yang memicu error saat modul dimuat di *main process*.
  - Membersihkan duplikasi elemen pada array `SKILL_MODULES`.
- **Perbaikan SyntaxError di `eye.js`:**
  - Menghapus deklarasi ganda variabel renderer (`activeTtsAnalyser`, `lastInteractionTime`, `isAngry`, `angryTimer`).
- **Pembersihan & Kompatibilitas `Whisper.exe`:**
  - Memperbarui `launcher.cs` dan meng-compile ulang `Whisper.exe` agar secara eksplisit membersihkan variabel `ELECTRON_RUN_AS_NODE` di level process sehingga widget selalu muncul normal saat di-double click.
  - Mematikan background task dev process sehingga tidak memblokir single-instance lock aplikasi.
- **Resilience di `main.js` & `checkForGitHubUpdates`:**
  - Menambahkan impor `execSync` yang hilang di `child_process`.
  - Melindungi pengecekan git commit dan GitHub Updates dengan fallback aman dan timeout request agar tidak pernah mengalami uncaught error.
- **Verifikasi & Eksekusi:**
  - Seluruh file JS (`main.js`, `assistant.js`, `skills/index.js`, `eye.js`, dll.) telah divalidasi dengan `node -c` dan berhasil berjalan mulus tanpa popup error.

---

## [v1.0.3] - 2026-11-13

### 🚀 Penyelesaian Penuh Roadmap Fase 1 - 4 & Fitur Baru:
- **Sinkronisasi Respon Cepat & Eliminasi Delay Suara:**
  - Perbaikan regex wake-word & prefix bertumpuk (`hey wis tolong buka aplikasi whatsapp`).
  - Penambahan WhatsApp, Telegram, Spotify, dan VS Code ke registri *Fast Plan* lokal tanpa jeda LLM (eksekusi instant <1ms).
  - Mekanisme `ttsCache` prewarm konfirmasi instan (*"Oke"*, *"Siap"*, *"Baik"*) dan pengiriman suara sinkron paralel via `onImmediateSpeech` sebelum aksi selesai.
- **Speech Bubble Mengambang Dinamis (`bubble.html` / `bubble.js`):**
  - Jendela mengambang transparan di atas kepala Wis untuk menampilkan progress pencarian (*"🔍 Membaca konteks..."*), ringkasan jawaban, dan tombol aksi interaktif (`[🌐 Buka di Chrome]`, `[Salin Jawaban]`).
- **Indikator Kemarahan / Frustrasi Saat Lag atau Kuota Habis:**
  - Deteksi otomatis latency cloud request (>3.2 detik) atau error 429 quota exhaustion.
  - Wis berubah warna menjadi merah kemarahan (`#EF4444`), urat anime kemarahan (`💢`) berdenyut di dahi, micro-stomp loncat kecil di tempat, geleng-geleng kepala cepat (*extraYaw*), diiringi peringatan Speech Bubble.
- **Kontrol Kecerahan Layar Kustom (Brightness Control):**
  - Modul skill baru `skills/brightness.js` untuk atur persentase (*"turunkan brightness jadi 20%"*, *"kecerahan 50%"*) dan preset (*"redupkan layar"*, *"terangkan layar"*) via Windows CIM/WMI tanpa dependensi eksternal.
- **Mulut Dinamis Berartikulasi (Lip-Sync A-I-U-E-O) & Mode Idle Sleep:**
  - Formant audio Piper TTS diolah secara real-time via `AnalyserNode` ke proyeksi viseme mulut (A/O terbuka lebar, I/E melebar, U/M mengerucut, senyum santai).
  - Mode tidur otomatis (22 detik mengantuk, 35 detik tertidur lelap dengan efek menyusut 0.72 dan partikel melayang `z z Z`). Bangun seketika saat kursor/sentuhan mendekat.
- **Modular Skills Baru & Voice Macros:**
  - Ditambahkan modul `skills/whatsapp.js`, `skills/telegram.js`, `skills/files.js` (Everything CLI), dan `skills/macro.js` (`macros.json`).
- **Perbaikan Menu Panduan / Manual Book ("▶ Coba"):**
  - Penambahan Modul 8 (Brightness) dan Modul 9 (Komunikasi WhatsApp & Telegram) di `settings.js`.
  - Tombol "▶ Coba" kini mengeksekusi langsung aksi suara dengan feedback visual toast `⏳ Menguji...` ➔ `✓ Sukses`.
- **CI/CD GitHub Actions & In-App Auto-Update Notifier:**
  - Workflow `.github/workflows/build.yml` untuk build installer otomatis setiap ada tag rilis.
  - Pengecekan versi otomatis saat aplikasi dijalankan via GitHub Releases API.

---

## [v1.0.2] - 2026-11-13

### 🐛 Perbaikan Bug Interaksi & Peta Jalan:
- **Perbaikan Menu Klik Kanan (Setting & Close):**
  - Mengatasi masalah menu radial yang mengharuskan tombol klik kanan mouse ditahan.
  - Sekarang sekali klik kanan pada mikrofon akan memunculkan menu dan **tetap terbuka** (*toggle on*).
  - Mengklik sekali lagi pada mikrofon ATAU mengklik di area luar menu (*klik ngasal / blur*) akan menutup menu secara halus (*toggle off*).
- **Penyusunan Dokumen Roadmap Resmi (`ROADMAP.md`):**
  - Mendokumentasikan rencana pengembangan Fase 1 s/d Fase 4 (Speech Bubble, mode tidur/ngantuk idle, artikulasi mulut A-I-U-E-O, Smart Selection teks, dan integrasi OS).

---

## [v1.0.1] - 2026-11-13

### 📢 Standardisasi Aturan Proyek & Sinkronisasi GitHub:
- **Aturan Wajib Push Otomatis (`AGENTS.md` & `GEMINI.md`):**
  - Menetapkan aturan wajib bagi setiap AI Agent (Antigravity, Cursor, Claude, Copilot, dll.) dan kontributor untuk selalu memperbarui `CHANGELOG.md` dan mem-push perubahan ke GitHub (`git push origin main`) setiap kali selesai melakukan pembaruan/bugfix.
- **Mekanisme Peringatan Update Otomatis saat Penarikan Data (Sync / Pull):**
  - Membuat tool sinkronisasi `sync.js` (`npm run sync` dan `npm run check-update`).
  - Menambahkan Git hook `post-merge` sehingga ketika ada agent atau developer yang melakukan `git pull`, sistem otomatis menampilkan rincian commit terakhir dan ringkasan pembaruan dari `CHANGELOG.md` di konsol terminal.
- **Proteksi Kunci API & Panduan AI:**
  - Penegasan aturan larangan unignore `config.json` dan kewajiban arsitektur modular `skills/`.

---

## [v1.0.0] - 2026-11-13

### 🚀 Fitur Baru & Optimalisasi:
- **Arsitektur Modular Skill (`skills/`):**
  - Pemisahan kemampuan asisten ke dalam modul terpisah: `greeting.js`, `browser.js`, `media.js`, `window.js`, `scroll-zoom.js`, `vision.js`, `word.js`, dan `memory.js`.
  - Registri sentral dan progressive skill disclosure di `skills/index.js`.
- **Zero-Token Fast Plan & Pruning:**
  - Respon lokal instan tanpa konsumsi token LLM untuk sapaan ("hai wish", "halo", dll.).
  - Pemangkasan riwayat percakapan volatile dan caching prefix prompt untuk efisiensi token maksimal.
- **Dukungan Penuh Touchscreen & Stylus Pen:**
  - Menggantikan mouse event lama dengan *Unified Pointer Events*.
  - Menghilangkan getaran/jitter pada layar ber-DPI tinggi (150%+) dengan native 120Hz drag loop dan *HID Raw Input pointer watcher* (`injector.cs` / `injector.exe`).
  - Pencegahan bentrok antara aksi drag layar sentuh dengan menu radial / setting / tombol close.
- **Widget Eye Tracking & Tampilan Bersih:**
  - Menghapus efek shadow dan highlight tap gelap agar widget tampil mulus, bersih, dan modern seperti native Windows app.
  - Widget mata interaktif yang melacak kursor, stylus, maupun sentuhan jari.
- **Tombol Restart & Tutup Aplikasi:**
  - Penambahan tombol *Restart Aplikasi* dan *Tutup Aplikasi* langsung di jendela Pengaturan dan System Tray.
- **Integrasi Repositori GitHub:**
  - Repositori publik resmi dibuat di GitHub: `https://github.com/rromzly-ship-it/whisper-wideget`.
  - Proteksi API key via `.gitignore` dan penyediaan `config.example.json`.

---

## 📌 Aturan Kerja Bagi Pengembang / AI Agent
1. **Wajib Push Setelah Update:** Setiap kali menyelesaikan perbaikan bug atau penambahan fitur, Anda **wajib** memperbarui file ini (`CHANGELOG.md`), membuat git commit yang jelas, dan melakukan `git push origin main`.
2. **Wajib Baca Update Terakhir Sebelum Mulai:** Sebelum melakukan perubahan, selalu baca entri paling atas dari `CHANGELOG.md` atau jalankan `git log -1` untuk mengetahui konteks pembaruan terakhir.
3. **Proteksi API Key:** Jangan pernah menghapus `config.json` dari `.gitignore` atau mengunggah API key riil ke GitHub.
