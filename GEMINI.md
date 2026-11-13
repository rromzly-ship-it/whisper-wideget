# Instructions for Antigravity & AI Agents

Lihat panduan lengkap aturan kerja di: [AGENTS.md](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/AGENTS.md) dan [CHANGELOG.md](file:///c:/Users/Admin/Downloads/whisper-floating-widget/whisper-floating-widget/CHANGELOG.md).

## Aturan Utama Proyek Ini:
1. **Wajib Push ke GitHub:** Setiap selesai melakukan perubahan/update pada aplikasi Whisper, wajib catat di `CHANGELOG.md`, lakukan git commit, dan push langsung ke GitHub: `git push origin main`.
2. **Wajib Cek Update Terakhir Saat Menarik Data / Memulai Sesi:** Saat baru mulai atau setelah menarik data dari GitHub (`git pull`), periksa `CHANGELOG.md` atau `git log -1` dan laporkan update terakhir kepada user.
3. **Proteksi API Key:** Jangan pernah meng-commit `config.json`. Selalu pastikan ada di `.gitignore`.
4. **Skill Modular:** Semua penambahan skill baru wajib diletakkan di folder `skills/` secara modular.

