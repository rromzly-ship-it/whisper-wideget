# Whisper Floating Widget

Aplikasi desktop Windows berupa **Floating Widget** interaktif dan cerdas yang melayang di atas semua aplikasi. Menggabungkan teknologi **Voice-to-Text Whisper (Groq Cloud)** berkecepatan tinggi, **Offline TTS (Piper)**, dan **Modular Skill Agent** yang responsif terhadap input mouse, sentuhan jari (touchscreen), maupun pena digital (stylus pen).

---

## ✨ Fitur Utama

- 🎙️ **High-Speed Voice-to-Text:** Transkripsi suara ke teks secara instan menggunakan Groq Whisper Cloud (`whisper-large-v3`).
- 👁️ **Interactive Eye Widget:** Widget interaktif dengan mata yang melacak kursor, pena stylus, maupun sentuhan jari di layar secara akurat.
- 🖐️ **Full Touchscreen & Stylus Pen Support:** Menggunakan *Unified Pointer Events*, *HID Raw Input watcher*, dan native 120Hz drag loop untuk pergerakan widget yang sangat halus (*smooth*) tanpa lag/jitter pada berbagai skala DPI Windows.
- ⚡ **Zero-Token Fast Plan & Token Pruning:** Optimalisasi token 5-tingkat dengan eksekusi lokal instan untuk sapaan dan perintah cepat tanpa membuang token LLM.
- 🧩 **Modular Skill Architecture (`skills/`):**
  - **`greeting.js`**: Respon instan sapaan ramah ("hai wish", "halo", dll.) secara lokal tanpa latensi.
  - **`browser.js`**: Buka situs & pencarian langsung (YouTube, Google, Wikipedia, alias cerdas).
  - **`media.js`**: Kontrol pemutaran media & volume Windows secara native.
  - **`window.js`**: Manajemen jendela aktif (minimize, maximize, close, switch).
  - **`scroll-zoom.js`**: Navigasi scroll atas/bawah dan zoom halaman.
  - **`vision.js`**: Screenshot layar & otomatisasi UI berbasis visi.
  - **`word.js`**: Kontrol dokumen Microsoft Word (dikte langsung, formatting).
  - **`memory.js`**: Penyimpanan preferensi & konteks percakapan pengguna.
- 🔊 **Offline TTS Suara Alami:** Menggunakan engine Piper neural TTS lokal bahasa Indonesia (`id_ID-news_tts-medium`) dan Inggris.
- ⚙️ **Quick Settings & Radial Menu:** Tekan & tahan 2 detik untuk membuka radial menu cepat, atau klik ganda untuk membuka pengaturan lengkap dengan tombol Restart & Close.
- 📌 **Always on Top & Global Hotkey:** Melayang di atas semua jendela dengan shortcut global `Alt + Shift + V` untuk mode dikte cepat.

---

## 🚀 Panduan Instalasi & Menjalankan

### Prasyarat
- **Node.js** (v18 atau lebih baru)
- **Windows 10 / 11**

### Langkah Instalasi
1. Clone repositori ini:
   ```bash
   git clone https://github.com/rromzly-ship-it/whisper-wideget.git
   cd whisper-wideget
   ```
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Salin file konfigurasi contoh:
   ```bash
   copy config.example.json config.json
   ```
4. Dapatkan **Groq API Key** gratis di [https://console.groq.com/keys](https://console.groq.com/keys) dan masukkan ke `config.json` atau melalui menu **Pengaturan** di aplikasi.
5. Jalankan aplikasi:
   ```bash
   npm start
   ```
   Atau jalankan file `run.bat`.

---

## 📁 Struktur Direktori
```text
whisper-floating-widget/
├── skills/               # Modular skill plugins
│   ├── index.js          # Skill registry & loader
│   ├── greeting.js       # Local instant responses
│   ├── browser.js        # Web & search automation
│   ├── media.js          # Volume & playback controls
│   ├── window.js         # Window management
│   ├── scroll-zoom.js    # Scroll & zoom actions
│   ├── vision.js         # Vision analysis & UI interaction
│   ├── word.js           # MS Word integration
│   └── memory.js         # Long-term preference storage
├── piper/                # Offline neural TTS engine & models
├── injector.cs / .exe    # Native low-level pointer & drag helper
├── main.js               # Electron main process & native window management
├── assistant.js          # Core LLM & agent orchestration
├── widget.js / .html     # Floating widget UI
├── settings.js / .html   # Settings modal UI
├── eye.js / .html        # Eye tracking canvas UI
└── menu.js / .html       # Radial context menu
```

---

## 🔒 Privasi & Keamanan
- API Key Groq disimpan secara lokal di mesin Anda (`config.json`) dan tidak pernah dikirim ke repositori publik.
- Transkripsi suara hanya dikirimkan ke endpoint resmi Groq API saat perekaman diaktifkan.

---

## 📄 Lisensi
Didistribusikan di bawah lisensi MIT. Lihat file `LICENSE` jika tersedia.
