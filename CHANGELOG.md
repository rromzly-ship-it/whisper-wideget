# 📋 CHANGELOG & RIWAYAT PEMBARUAN

Dokumen ini mencatat seluruh riwayat pembaruan sistem **Whisper Floating Widget**. Setiap agent atau pengembang yang melakukan perubahan **wajib** mencatat ringkasan pembaruan di sini dan melakukan push ke GitHub.

---

## [v1.1.0] - 2026-11-18 (Pembaruan Terkini)

### 📦 Windows Standalone Setup Installer (NSIS Package - Tanpa Perlu `npm install`):
- **Installer Windows Mandiri (`WhisperWidget-Setup-1.1.0.exe`):**
  - Mengonfigurasi `electron-builder` dengan target NSIS di [package.json](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/package.json) untuk menghasilkan installer Windows resmi (~212 MB).
  - Pengguna di komputer lain kini **tidak perlu** menginstal Node.js, Git, atau menjalankan perintah `npm install`. Cukup mengunduh satu file `WhisperWidget-Setup-1.1.0.exe` dan melakukan klik ganda (*double click*) layaknya instalasi aplikasi Windows modern.
  - Dilengkapi wizard instalasi standar: pemilihan direktori instalasi, opsi pembuatan shortcut Desktop dan Start Menu, serta uninstaller bersih di *Control Panel / Apps & Features*.
- **Native Unpacked Architecture (`asarUnpack`):**
  - Mengonfigurasi ekstrasi otomatis (*unpacked archive*) untuk binary native Windows: engine neural TTS offline [piper](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/piper) beserta model suara ONNX dan driver sentuh [injector.exe](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/injector.exe).
  - Memperbarui resolusi path binary di [main.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/main.js) dan [tts.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/tts.js) menggunakan `.replace('app.asar', 'app.asar.unpacked')` agar binary tetap dieksekusi secara native tanpa konflik virtual file system Chromium.
- **Proteksi Data Kredensial:**
  - File rahasia `config.json` dan `voice-profile.json` secara ketat di-exclude dari proses packaging installer, menjaga keamanan API Key pengguna saat installer dibagikan.

### ✨ Wis Jump-To-Mic Swap Mode & Instant Zero-Delay Microphone Activation:
- **Aktivasi Mikrofon Instan Tanpa Jeda / Delay (Zero Perceived Latency):**
  - Mengubah transisi status UI pada tombol mikrofon [widget.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/widget.js): `setState('recording')` kini dipanggil secara instan (0ms) begitu tombol diklik, sehingga tombol langsung berubah merah dengan ikon kotak tanpa menunggu hardware microphone selesai negosiasi.
  - Menerapkan teknik *Audio Stream Pre-Warming* pada event `pointerdown`: saat jari atau mouse menyentuh tombol, proses perolehan stream `getUserMedia` sudah berjalan di latar belakang selama durasi klik (~100-200ms), sehingga saat tombol dilepas (`pointerup`), hardware audio WASAPI sudah siap merekam tanpa jeda cold negotiation.
  - Penggunaan kembali (*reuse*) instans `AudioContext` agar tidak membuang waktu membuat dan menutup konteks audio Windows berulang-ulang.
- **Fitur Baru: Wis Jump & Replace Microphone (Karakter Menempati Posisi Mikrofon):**
  - **Animasi Loncat Masuk (*Squash & Stretch Bounce*):** Saat Wis yang sedang bertengger/tidur di atas mikrofon diklik, Wis melompat turun dengan animasi kartun elastis (`@keyframes wis-jump-in`) menuju koordinat tombol mikrofon.
  - **Mikrofon Tersembunyi Otomatis (*Auto-Hide*):** Jendela tombol mikrofon (`widgetWindow`) disembunyikan (*hidden*) saat Wis aktif, sehingga Wis sepenuhnya menggantikan posisi mikrofon.
  - **Membesar Seukuran Mikrofon (58px / Window 80x80px):** Jendela Wis (`eyeWindow`) membesar dari 64x64px menjadi 80x80px, dan diameter lingkaran kepala Wis membesar dari 32px menjadi 58px (persis seukuran tombol mikrofon) dengan efek cahaya *blue glowing pulse* saat mendengarkan.
  - **Animasi Loncat Kembali (*Jump-Out & Perch Return*):** Ketika sesi perintah selesai atau Wis dinonaktifkan (diklik lagi untuk berhenti atau idle timeout), Wis melompat kembali ke atas mikrofon (`@keyframes wis-jump-out`), ukurannya kembali ke 32px (64x64px), dan tombol mikrofon otomatis muncul kembali (*unhide*).
  - Penyesuaian cerdas penempatan bubble ucapan [main.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/main.js) dan sinkronisasi teleportasi visual [vision.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/vision.js).

---

## [v1.0.9] - 2026-11-18

### 🚀 Perbaikan Startup Launcher (`Whisper.exe` & `Whisper.vbs`) dan Auto-Recovery Node Environment:
- **Auto-Recovery dari `ELECTRON_RUN_AS_NODE` di `main.js`:**
  - Menambahkan mekanisme pendeteksi otomatis di baris awal [main.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/main.js#L1-L20): jika dijalankan dari environment VS Code / terminal yang mengekspor variabel `ELECTRON_RUN_AS_NODE=1`, aplikasi tidak lagi crash melainkan otomatis membersihkan environment dan me-relaunch proses ke mode GUI Electron resmi secara instan dan mulus.
  - Memperbaiki deklarasi ganda modul `path` dan `fs`.
- **Perbaikan Peluncur Windows (`Whisper.exe` & `Whisper.vbs`):**
  - Mengoreksi penanganan window mode pada [Whisper.vbs](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/Whisper.vbs) dari mode tersembunyi (*SW_HIDE / 0*) ke mode tampilan aktif (*SW_SHOWNORMAL / 1*).
  - Memperbarui [launcher.cs](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/launcher.cs) dengan mematikan `CreateNoWindow` agar Chromium dapat menginisialisasi subsistem jendela desktop tanpa hambatan.
  - Meng-compile ulang [Whisper.exe](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/Whisper.exe) dengan target Windows GUI Executable dan ikon aplikasi.
- **Focus On Second-Instance:**
  - Jika aplikasi sudah berjalan dan pengguna mengklik ulang `Whisper.exe`, widget suara dan Wis langsung direstore dan difokuskan ke bagian depan layar (*bring to front*).

---

## [v1.0.8] - 2026-11-18

### 🛡️ Eliminasi Total Halusinasi Jeda Hening ("Hai", "Terima Kasih") & Repetition Loop Whisper:
- **Investigasi Akar Masalah Halusinasi Whisper:**
  - Whisper OpenAI adalah model sequence-to-sequence autoregresif yang dilatih dari ratusan ribu jam video publik (YouTube) lengkap dengan teks penutup dan pembuka.
  - Saat mikrofon diaktifkan namun ada jeda diam (*silence/low energy*) atau klik mikrofon di awal/akhir rekaman, model memprediksi token probabilitas tertinggi dari korpus internet: kata pembuka *"Hai"* / *"Halo"* dan kata penutup video *"Terima kasih"* / *"Terima kasih sudah menonton"* / *"Thank you for watching"*.
  - Dalam kondisi entropi rendah (audio hening/desis), decoder autoregresif terjebak dalam *degeneration loop*, menghasilkan pengulangan token tak berujung seperti *"hai hai hai hai..."*.
- **Solusi Berlapis 3 Tingkat (Three-Layer Protection):**
  1. **Sampling Deterministik (`temperature: 0.0`) & Prompt Conditioning:**
     - Menambahkan parameter `temperature: '0.0'` pada request API Whisper di [widget.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/widget.js) dan [eye.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/eye.js) guna mengunci decoding greedy dan mematikan stochastic sampling saat audio hening.
     - Menyematkan prompt conditioning dikte (*"Dikte suara bahasa Indonesia dan English. Teks langsung dan akurat tanpa teks penutup."*) agar model fokus pada teks lisan murni dan tidak memunculkan teks outro/subtitle YouTube.
  2. **Modul Pembersih Halusinasi Khusus ([whisper-cleaner.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/whisper-cleaner.js)):**
     - *Solitary Filter:* Mendeteksi dan membuang total (menjadi string kosong `""`) jika hasil transkripsi hanya berupa kata hening tunggal (*"Hai"*, *"Halo"*, *"Terima kasih"*, *"Terima kasih sudah menonton"*, *"Thank you for watching"*, *"Please subscribe"*, *"3d printing"*, dll).
     - *Repetition Loop Buster:* Memotong dan membersihkan pola perulangan kata beruntun seperti `hai hai hai...`, `dan dan dan...`, dsb.
     - *Leading & Trailing Scrub:* Menghapus kata sapaan/penutup liar yang menempel di ujung kalimat akibat jeda hening sesaat sebelum/sesudah pengguna berbicara.
  3. **Auto-Discard Guard di Widget Dikte:**
     - Hasil transkripsi yang terdeteksi sebagai halusinasi/hening otomatis dibuang sehingga tidak ada teks sampah yang ter-paste ke aplikasi pengguna.
- **Privasi Profil Akustik:**
  - Menambahkan `voice-profile.json` ke `.gitignore` agar sidik suara biometrik pribadi pengguna tidak ter-commit ke repositori publik.

---

## [v1.0.7] - 2026-11-13

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
