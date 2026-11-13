# 🤖 ATURAN KERJA & STANDAR PENGEMBANGAN AI AGENT (AGENTS.md)

Dokumen ini adalah aturan permanen (*system instruction*) untuk semua AI Agent (Antigravity, Claude, Cursor, Copilot, dll.) dan kontributor yang bekerja pada repositori **Whisper Floating Widget** (`rromzly-ship-it/whisper-wideget`).

---

## 🚨 ATURAN 1: WAJIB PUSH KE GITHUB SETIAP ADA PEMBARUAN (MANDATORY PUSH)
Setiap kali Anda menyelesaikan suatu tugas, perbaikan bug (*bugfix*), refaktorisasi, atau penambahan fitur baru:
1. **Perbarui `CHANGELOG.md`:** Tuliskan ringkasan pembaruan Anda di bagian paling atas dengan format tanggal dan rincian perubahan yang jelas.
2. **Commit yang Rapi:** Jalankan `git add .` dan buat commit dengan format konvensional (contoh: `feat: ...`, `fix: ...`, `refactor: ...`).
3. **Wajib Langsung Push:** Jalankan `git push origin main` agar repositori di GitHub selalu sinkron dan mencerminkan kode terbaru.

---

## 📢 ATURAN 2: WAJIB CEK & BERITAHU UPDATE TERAKHIR SAAT MENARIK DATA (MANDATORY SYNC AWARENESS)
Setiap kali Anda atau agen lain baru membuka proyek ini, melakukan `git pull`, atau mengklon repositori:
1. **Wajib Baca Update Terakhir:** Buka dan baca bagian paling atas dari [CHANGELOG.md](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/CHANGELOG.md) atau jalankan:
   ```bash
   git log -1 --stat
   ```
2. **Beritahu Pengguna / Agen Lain:** Beritahukan secara ringkas kepada pengguna apa status dan update terakhir yang tercatat sebelum Anda mulai mengutak-atik kode, sehingga tidak terjadi tumpang tindih (*conflict*) logika.

---

## 🔒 ATURAN 3: KEAMANAN KUNCI API (SECRET PROTECTION)
1. File `config.json` menyimpan API Key pribadi pengguna (`gsk_...`). **DILARANG KERAS** menghapus `config.json` dari `.gitignore` atau meng-commit file tersebut ke GitHub.
2. Jika ada penambahan opsi konfigurasi baru, perbarui file `config.example.json` dengan nilai dummy/placeholder yang aman.

---

## 🧩 ATURAN 4: ARSITEKTUR SKILL HARUS MODULAR
1. Setiap kemampuan atau fitur perintah asisten baru **wajib** dibuat dalam file terpisah di direktori `skills/` (misal: `skills/nama-skill.js`).
2. Daftarkan skill baru ke `skills/index.js` agar dikenali secara otomatis oleh orchestrator `assistant.js`.
3. Jaga efisiensi token dengan menerapkan fast-plan lokal untuk perintah-perintah deterministik (tanpa membuang token ke LLM).

---

## 🖐️ ATURAN 5: KOMPATIBILITAS INPUT (TOUCH, PEN, MOUSE)
1. Hindari penggunaan event mouse murni (`mousedown`, `mouseup`, `mousemove`) pada elemen yang dapat diinteraksi; selalu gunakan **Pointer Events** (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) dengan atribut `touch-action: none;` dan styling bebas tap-highlight.
2. Pergerakan widget di layar sentuh ditangani oleh native loop dan raw input watcher (`injector.exe`) untuk menjaga pergerakan tetap 120Hz smooth tanpa patah-patah.

