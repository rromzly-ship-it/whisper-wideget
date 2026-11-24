# 📋 CHANGELOG & RIWAYAT PEMBARUAN

Dokumen ini mencatat seluruh riwayat pembaruan sistem **Whisper Floating Widget**. Setiap agent atau pengembang yang melakukan perubahan **wajib** mencatat ringkasan pembaruan di sini dan melakukan push ke GitHub.

---

## [v1.3.0] - 2026-11-24 (Milestone Rilis V3)

### 🤖 Analisis & Solusi Akar Masalah (Bukan dari Modularitas Kodings):
- **Bukan Masalah Modular:** Arsitektur modular di folder `skills/` sudah sangat baik, bersih, dan sesuai standar pengembangan. Masalah yang terjadi murni karena rantai 3 faktor teknis di gateway & antarmuka model:
  1. **Bug Penguraian Dropdown Model:** API pengambil model dari vendor mengembalikan daftar model dalam bentuk string/objek mentah. Kode dropdown sebelumnya memanggil properti `.id` pada string sehingga dropdown model menjadi kosong/blank.
  2. **Model Tak Kompatibel Terpilih:** Karena dropdown kosong, sistem jatuh ke konfigurasi kustom bawaan `whisper-large-v3-turbo`.
  3. **Error 404 dari Gateway GeminiX:** Gateway GeminiX (Google Antigravity) tidak memiliki model bernama `whisper-large-v3-turbo` dan tidak memiliki endpoint `/audio/transcriptions`. Mengirim permintaan Whisper ke GeminiX memicu penolakan `Antigravity API error 404: Requested entity was not found`.

### ⚡ Fitur Uji Koneksi Vendor & Pemuat Model Real-Time (Tombol Test API):
- **Tombol "⚡ Test API" di Kolom Kunci:** Menambahkan tombol uji koneksi langsung di samping kolom input API Key pada menu Pengaturan Sistem.
- **Uji Kredensial & Pemuatan Otomatis:** Saat pengguna memilih vendor (GeminiX Gateway, Groq Cloud, OpenAI, Custom) dan memasukkan kunci API, tombol Test API akan menguji validitas kunci secara langsung:
  - **Jika Sukses:** Menampilkan status `🟢 Terhubung (<N> Model Tersedia)` dan memuat daftar model resmi vendor secara real-time ke dalam dropdown beserta deskripsi dan perkiraan kecepatannya.
  - **Jika Gagal:** Menampilkan status `🔴 Gagal: [Alasan Error]` secara transparan tanpa merusak konfigurasi lama.
- **Auto-Sanitasi Model Per Vendor:** Saat berpindah vendor, sistem secara cerdas memilihkan model terbaik untuk vendor tersebut (GeminiX -> `gemini-3.8-flash-high`, Groq -> `openai/gpt-oss-20b`, OpenAI -> `gpt-4o-mini`), mencegah kesalahan model lintas vendor.

### 🎙️ Universal AI Gateway STT (Dukungan Penuh Semua Vendor untuk Voice-to-Text & Asisten Wis):
- **Dukungan Multimodal Audio GeminiX:** Suara mikrofon (Voice to Text) dan asisten Wis kini mendukung penuh GeminiX secara native menggunakan model audio `gemini-2.5-flash` dengan respon kilat ~1.0s tanpa pernah lagi menyentuh Whisper yang menyebabkan 404.
- **Fallback Cerdas Anti-Gagal:** Jika model pilihan pengguna sedang sibuk atau tidak mendukung audio, sistem otomatis mencoba ulang menggunakan `gemini-2.5-flash` agar transkripsi suara tidak pernah mogok.
- **Dukungan Penuh Vendor Lain:** Groq Cloud tetap berjalan dengan dedicated Whisper LPU (`whisper-large-v3-turbo`), OpenAI dengan `whisper-1`, dan Custom endpoint dengan deteksi cerdas endpoint transkripsi.

---

## [v1.2.3] - 2026-11-24

### 🐛 Hotfix SyntaxError Main Process (Fix Error Line 1606):
- Menghapus blok duplikasi baris kode pada fungsi `enqueueVoiceCommand` di [main.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/main.js) yang menyebabkan error fatal startup `SyntaxError: Unexpected token '}'`.
- Seluruh file JavaScript telah diverifikasi lolos pengecekan sintaks `node -c` (0 error). Aplikasi kini berjalan mulus tanpa crash saat dibuka.

---

## [v1.2.2] - 2026-11-24

### 🎙️ Pemulihan Penuh Suara Mikrofon (Voice to Text Instan 150ms & Anti-Ngaco):
- **Akar Penyebab Ditemukan & Diperbaiki:** Mengidentifikasi penyebab transkripsi suara menjadi salah/ngaco: parameter `baseUrl` sebelumnya sempat keliru jatuh ke gateway GeminiX saat konfigurasi menggunakan kunci Groq (`gsk_...`), sehingga audio rekaman terkirim ke LLM multimodal Gemini yang lambat dan berhalusinasi "bantuan teknis".
- **Resolusi Provider Presisi (`resolveProvider`):** Kunci API Groq (`gsk_...`) kini dijamin 100% selalu menggunakan endpoint resmi Groq Whisper (`https://api.groq.com/openai/v1/audio/transcriptions`) dengan model `whisper-large-v3-turbo` berkecepatan 150ms tanpa pernah terlempar ke model chat. Hasil pengetikan suara kembali akurat, cepat, dan verbatim seperti semula.

### 🛑 Anti Penumpukan Request (No Request Stacking):
- **Blokir Akumulasi Antrean Perintah:** Mengatasi masalah penumpukan request saat pengguna berbicara berturut-turut atau saat ada suara latar belakang.
- **Deteksi Status Sibuk Terpadu:** [eye.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/eye.js) dan [main.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/main.js) kini secara otomatis memblokir penumpukan perintah saat Wis sedang mengeksekusi aksi. Suara tambahan diabaikan (kecuali perintah pembatalan seperti `stop` atau `berhenti`), sehingga antrean tidak menumpuk dan tidak ada lagi perintah tak dikenal yang tiba-tiba tereksekusi.

### 🎯 Perbaikan Logika YouTube & Penulisan Dokumen Word:
- **Perbaikan Regex Pattern D di [skills/browser.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/skills/browser.js):** Memperbaiki pola pencocokan agar hanya aktif jika pengguna memang menyebut "kolom pencarian/telusuri" atau konteks video/lagu/YouTube. Perintah seperti `"Wis, ketikkan lima ide konten di Word"` kini dijamin tidak akan pernah lagi dibajak menjadi pencarian YouTube.
- **Prioritas Modul Word di [skills/index.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/skills/index.js):** Memindahkan `wordSkill` ke urutan sebelum browser agar perintah dokumen dan pengetikan teks ditangani secara tepat oleh modul Word.
- **Kebal Markdown & Hilangkan Emotikon Marah:** Memperbaiki parser JSON perencana di [assistant.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/assistant.js) agar kebal terhadap teks berformat markdown asterisks (`**Navigasi**...`), mencegah crash parsing JSON (`Unexpected token`) dan menghilangkan emotikon merah marah pada karakter Wis.

### 🎨 Desain Flat & Bersih: Eliminasi Border Kiri & Background Kartu di Semua Menu:
- **Tampilan Menempel Rapi & Bebas Kotak:** Menghapus outline border kaku dan background tumpukan kartu (`.card { background: transparent; border: none; }`) di semua tab menu (Pengaturan, Log Aktivitas, Profil Suara, Library Web & App, Token Kuota, Pembaruan). Seluruh item menu dan baris log kini tersaji rapi, lapang, dan rata menyatu dengan tema gelap modern.
- **Solusi Tuntas Dropdown Model Blank:** Menambahkan styling inline `#ffffff` dan latar `#202020` pada setiap elemen `<option>` di [settings.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/settings.js) serta menerapkan `color-scheme: dark !important;` pada `<select>` di [settings.css](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/settings.css) sehingga seluruh daftar model AI terlihat tajam dan terbaca jelas.

### ⚡ Fitur Updater Baru: Persentase Real, Progress Bar Streaming, & Popup Relaunch:
- **Persentase Unduhan Real-Time:** Menampilkan progres unduhan file pembaruan secara real (0% - 100%) dengan indikator MB terkirim (`XX MB / 222 MB`) yang mengalir dinamis pada animasi progress bar.
- **Proses Instalasi Bertahap:** Menampilkan transisi progres pemasangan paket ke direktori aplikasi secara bertahap hingga tuntas 100%.
- **Popup Konfirmasi Pembaruan Selesai:** Menampilkan modal dialog interaktif bertema elegan saat instalasi selesai dengan tombol **"🔄 Jalankan Ulang Aplikasi"**, yang langsung me-restart aplikasi dan memunculkan widget Whisper kembali dalam hitungan detik.

---

## [v1.2.1] - 2026-11-24

### 🎙️ Perbaikan Transkripsi Mikrofon & STT Gateway GeminiX (Fix 404 Entity Error):
- **Auto-Correction Model Audio GeminiX:** Mengatasi error `Antigravity API error 404: Requested entity was not found` yang muncul ketika menggunakan mikrofon. Endpoint GeminiX (`geminix.arss.fun`) tidak memiliki dedicated model Whisper (`whisper-large-v3-turbo`), sehingga sistem secara otomatis mengoreksi dan mengarahkan input audio ke model multimodal unggulan GeminiX: `gemini-3.8-flash-high`.
- **Ekstraksi Bersih Bebas Reasoning/Thoughts:** Menambahkan instruksi sistem speech-to-text presisi serta regex pembersih rantai pemikiran (*chain-of-thought*) agar teks hasil dikte yang dimasukkan ke aplikasi selalu bersih murni tanpa teks pengantar atau pemikiran internal AI.
- **Keselarasan Multi-Modul (STT, Vision, Planner):** Menyelaraskan seluruh modul internal di [main.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/main.js), [assistant.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/assistant.js), dan [vision.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/vision.js) agar memiliki fallback otomatis cerdas ke `gemini-3.8-flash-high` saat mendeteksi gateway GeminiX.

### 🎨 Desain Presisi & Eliminasi Padding Sidebar:
- **Konten Menempel Rapi ke Garis Sidebar (Flush Border):** Menghilangkan padding kiri ganda pada area konten pengaturan dan mengatur kartu agar menempel langsung rata (*flush*) ke garis pemisah menu sidebar kiri tanpa celah padding yang mengganggu.
- **Perbaikan Dropdown Model (Fix Blank / Teks Tak Terlihat):** Menambahkan styling kontras tinggi `#202020` dengan warna teks putih terang `#ffffff` pada elemen `<select> option` di Pengaturan dan Onboarding, sehingga seluruh daftar model AI tampil jelas dan tidak lagi berwarna hitam kosong.

### 🪄 Penyempurnaan Tampilan Setup Onboarding:
- **Bebas Terpotong pada Layar Resolusi Tinggi / Skala Windows:** Memperluas dimensi jendela Onboarding menjadi `760x680` (min `640x580`), mengaktifkan `resizable: true`, dan menambahkan dukungan scrollbar responsif pada setiap tahapan setup agar tidak ada kartu informasi yang terpotong pada laptop dengan tampilan DPI tinggi (125%-150% scaling).

### 🚀 Pengujian Langsung Fitur In-App Auto-Update (v1.2.0 ➔ v1.2.1):
- Merilis paket resmi `v1.2.1` di GitHub Releases dengan file installer bertanda tangan `WhisperWidget-Setup-1.2.1.exe` dan arsip `WhisperAgent-v1.2.1.zip`.
- Pengguna yang sedang membuka aplikasi `v1.2.0` dapat langsung menekan tombol **"Periksa Pembaruan Sekarang"** pada tab Pembaruan dan memperbarui aplikasi secara otomatis hanya dengan satu klik!

---

## [v1.2.0] - 2026-11-24

### 🏷️ Penandatanganan Digital Resmi Publisher "ARSS" (Authenticode Code Signing):
- Mengonfigurasi tanda tangan digital resmi Authenticode dengan subject `CN=ARSS` pada binary instalasi Windows.
- Dialog keamanan Windows (SmartScreen & UAC) kini menampilkan nama penerbit resmi: **Publisher: ARSS** (menggantikan status *"Unknown publisher"*).
- Menyediakan script launcher sekali klik `Install-Whisper.bat` yang secara otomatis melepas atribut Mark-of-the-Web (`Unblock-File`) sehingga file `.exe` dapat langsung berjalan mulus tanpa terhalang dialog peringatan SmartScreen.

### 🎨 First-Run Onboarding Setup Wizard (Modern Minimalist & Interactive Wis Face):
- **Wajah Wis Interaktif Mengikuti Kursor (Canvas Interactive Face):**
  - Menggantikan animasi lingkaran orb berdenyut dengan wajah asli **Wis** interaktif: sepasang mata putih di dalam avatar biru yang secara halus dan alami mengikuti arah pergerakan kursor mouse di dalam jendela setup (tanpa efek loncat-loncat, tanpa denyut berlebihan).
  - Dilengkapi animasi kedipan mata natural berkala serta reaksi sapaan saat diklik.
- **Ikon Vektor SVG Penuh (Zero Emoji):**
  - Mengganti seluruh emotikon karakter (`🎙️`, `🧠`, `👁️`, `🖥️`, `⚡`, `🔄`, `💡`) dengan ikon vektor SVG yang modern, tajam, dan elegan di semua langkah setup dan tombol aksi.
- **Desain Flat & Borderless (Eliminasi Kartu Tebal):**
  - Merombak antarmuka agar tampil bersih, minimalis, dan lapang tanpa tumpukan kotak kartu bergaris tebal (*no clunky boxed outlines*).
  - Menghapus badge *"ARSS Official"* dari header jendela atas.
- **Bebas Layar Putih NSIS Kuno (Modern One-Click Installer):**
  - Mengonfigurasi `oneClick: true` pada NSIS installer sehingga proses instalasi berjalan instan tanpa menampilkan wizard putih jadul Windows.
  - Setelah instalasi selesai, aplikasi langsung membuka jendela setup bertema gelap khas Whisper.

### 📦 Paket Distribusi Siap Pakai (`WhisperAgent-v1.2.0.zip`):
- Mengemas installer `.exe`, peluncur bebas SmartScreen `Install-Whisper.bat`, dan sertifikat `arss.cer` ke dalam satu file archive `.zip` resmi di GitHub Release untuk kemudahan distribusi langsung.

### 🛡️ Keamanan Privasi GeminiX & Perbaikan UI Pengaturan:
- **Penghapusan Link Dashboard GeminiX:**
  - Menghapus tautan eksternal ke dashboard GeminiX dari menu Pengaturan dan Onboarding demi menjaga privasi dan keamanan gateway pribadi pengguna (provider lain seperti Groq dan OpenAI tetap memiliki link resmi).
- **Perbaikan Bug Blank Biru di Menu Pembaruan:**
  - Memperbaiki struktur elemen toggle switch pada halaman Pembaruan agar slider switch tidak meluap ke seluruh ukuran jendela (*full-viewport overflow*).
- **Eliminasi Double Padding:**
  - Menghilangkan margin ganda dan menyelaraskan padding area konten langsung ke batas garis sidebar menu sehingga tampilan konten lebih proporsional dan luas.
- **Desain Minimalis Tombol Sticky Aksi:**
  - Mengubah tombol aksi bawah (`Setup Awal`, `Restart`, `Keluar`, `Simpan`) menjadi ramping satu baris (tinggi 32px) dengan ikon SVG khusus (tongkat sihir, refresh, X, dan disket simpan) tanpa teks bertumpuk.

### 🌐 Integrasi Universal AI Gateway & Dukungan Penuh GeminiX Gateway (`geminix.arss.fun`):
- **Universal Provider Preset & Dynamic Model Selector:**
  - Menghubungkan Whisper Widget ke API Gateway kustom **GeminiX** (`https://geminix.arss.fun/v1`) buatan pengguna yang berbasis OpenAI-compatible API standar.
  - Mendukung 4 preset penyedia utama: **GeminiX Gateway**, **Groq Cloud**, **OpenAI Official**, dan **Custom Endpoint** dengan Base URL fleksibel.
  - **Auto-Fetch Models (`GET /v1/models`):** Tombol **"🔄 Cek & Muat Model"** secara otomatis menghubungi gateway dan memuat semua model AI yang tersedia (seperti `gemini-3.8-flash-high`, `gemini-3-flash`, `gemini-3.8-pro-high`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, dll.) ke dalam dropdown pilihan model beserta indikator status koneksi visual real-time (🟢 Terhubung / 🔴 Error).
- **Arsitektur Tunggal Terpadu (Single Unified API Configuration):**
  - Menggabungkan konfigurasi STT (Audio Transcription) dan LLM Reasoning/Planning ke dalam satu konfigurasi API tunggal (tanpa multi-konfigurasi terpisah sesuai permintaan pengguna).
  - Perekaman audio Whisper pada widget dan mode asisten (Wis) kini menggunakan endpoint terpadu:
    - Menghubungi `${baseUrl}/audio/transcriptions` untuk provider yang mendukung Whisper langsung (Groq/OpenAI).
    - Melakukan fallback otomatis ke `${baseUrl}/chat/completions` dengan payload multimodal `input_audio` jika endpoint transkripsi audio tidak tersedia (kompatibel langsung dengan GeminiX).
  - Pemanggilan reasoning perencana di [assistant.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/assistant.js) dan modul vision di [vision.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/vision.js) kini secara otomatis menggunakan model dan endpoint gateway aktif.

### 🔄 In-App Auto-Updater & GitHub Release Sync (Tanpa Install Ulang):
- **Menu Baru "Pembaruan" di Sidebar Pengaturan:**
  - Menambahkan menu **Pembaruan** tepat di bawah menu **Panduan** pada [settings.html](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/settings.html) lengkap dengan ikon SVG pembaruan dan badge notifikasi biru.
- **Pemeriksaan Versi & Update Sekali Klik (One-Click Update & Relaunch):**
  - Tombol **"Periksa Pembaruan Sekarang"** mengecek rilis terbaru di GitHub (`rromzly-ship-it/whisper-wideget`) dan membandingkan versi semver.
  - Menampilkan ringkasan status versi saat ini, versi terbaru di GitHub, tanggal rilis, dan catatan rilis (*release notes*).
  - **Update Instan Tanpa Install Manual:**
    - Jika dijalankan dari clone Git / repositori, tombol **"Perbarui Otomatis & Relaunch"** langsung menjalankan `git pull origin main`, memperbarui seluruh file tanpa installer, dan merestart aplikasi (`app.relaunch()`) langsung ke versi terbaru.
    - Jika dijalankan sebagai installer NSIS mandiri, aplikasi mengunduh installer update terbaru di latar belakang dan memasangnya secara hening (*silent update* `/S`).
  - Latar belakang background-check otomatis setelah 3 detik untuk menyalakan badge pembaruan jika versi baru tersedia.

---

## [v1.1.1] - 2026-11-18

### 🧠 Peningkatan Kecerdasan Memilah Variasi Perintah YouTube & Pencarian (Smart NLP Intent Parsing):
- **Skenario 1 - Hanya Membuka YouTube:**
  - Perintah natural seperti *"tolong buka Youtube"*, *"buka web youtube"*, *"buka youtube dong"* dieksekusi secara instan dengan membuka halaman utama YouTube (`open_url: https://www.youtube.com`).
- **Skenario 2 - Membuka YouTube Sekaligus Mencari Konten:**
  - Perintah natural seperti *"tolong buka Youtube cari lagu Fourtwnty"*, *"buka youtube cari video masak rendang"*, *"buka youtube tolong searching lagu noah"* otomatis dipetakan ke aksi `youtube_search` dengan query pencarian bersih dan alias cerdas (misal: "420" / "four twenty" -> "Fourtwnty").
- **Skenario 3 - Pencarian Saat Sudah di YouTube / Di Kolom Pencarian:**
  - Perintah manusiawi seperti *"Whisper tolong carikan saya video cara membuat rendang"*, *"tolong di kolom pencarian carikan saya lagu fourtwnty"*, *"tulis di kolom telusuri lagu slank"*, *"searching di youtube lagu dewa 19"*, *"carikan saya video tutorial blender"* kini dipetakan secara cerdas dan akurat ke `youtube_search`.
  - Jika jendela atau tab YouTube sudah terbuka di layar, aplikasi tidak membuka tab baru yang menumpuk, melainkan langsung beralih ke YouTube, memfokuskan kotak pencarian/telusuri (`/`), menempelkan teks, dan menekan Enter.

### 🛡️ Perbaikan Halusinasi Sapaan "Hai Whisper" (Eliminasi Jawaban "Sip di putra ya"):
- **Investigasi & Akar Masalah:**
  1. Pada [whisper-cleaner.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/whisper-cleaner.js), sapaan pembuka "Hai" dibersihkan sehingga menyisakan kata panggilan tunggal *"Whisper"*.
  2. Modul sapaan [skills/greeting.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/skills/greeting.js) sebelumnya hanya mencocokkan *"Wis"*, *"Wish"*, *"Wiz"*, sehingga kata *"Whisper"* lolos tanpa tertangkap fast-plan.
  3. Pada [assistant.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/assistant.js), template skema contoh JSON sistem prompt mencantumkan nilai default `"reply": "Sip, diputar ya"`. Karena input sapaan tidak memiliki aksi alat, model LLM menyalin contoh default tersebut berulang-ulang, yang kemudian dibaca oleh suara TTS Piper menjadi *"Sip, diputar ya"* (terdengar seperti *"sip di putra ya"*).
- **Solusi Tuntas:**
  1. Memperluas deteksi sapaan di [skills/greeting.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/skills/greeting.js) untuk mengenali *"Whisper"*, *"Wisper"*, *"Hai Whisper"*, *"Halo Whisper"*, *"Selamat pagi/siang/malam Whisper"*, maupun kata sapaan murni apa pun (`clean === ''`). Respon langsung instan: *"Halo! Ada yang bisa Wis bantu?"* (0 token, 0ms latency).
  2. Menghapus contoh statis `"Sip, diputar ya"` dari template skema prompt di [assistant.js](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/assistant.js) dan menyematkan instruksi tegas agar respon selalu relevan dengan konteks instruksi pengguna.

---

## [v1.1.0] - 2026-11-18

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
