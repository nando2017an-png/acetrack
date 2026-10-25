# AceTrack

Pencatat pengeluaran dan aset pribadi. PWA tanpa build step: cukup `index.html`, `style.css`, `app.js`, `sw.js`, `manifest.webmanifest`, dan folder `icons/`.

Spesifikasi lengkap ada di [RENCANA.md](RENCANA.md).

## Coba di laptop

```bash
python -m http.server 8765 --directory E:/AceCore/AceTrack
```

Lalu buka http://localhost:8765.

## Pasang di HP (GitHub Pages)

1. Buat repo baru di GitHub, misalnya `acetrack` (boleh private kalau akunmu GitHub Pro; kalau gratis, repo harus public, tapi datamu tetap aman karena hanya tersimpan di HP).
2. Upload semua file di folder ini ke repo tersebut.
3. Di repo: Settings → Pages → Source: "Deploy from a branch", Branch: `main`, folder `/ (root)` → Save.
4. Tunggu 1–2 menit, lalu buka `https://<username>.github.io/acetrack/` di Chrome HP.
5. Menu Chrome (⋮) → "Tambahkan ke layar utama" → "Instal".

## Memperbarui aplikasi

Setelah mengubah file, naikkan `VERSION` di `sw.js` (misalnya `acetrack-v2`), lalu upload ulang. HP akan memakai versi baru setelah aplikasi dibuka dua kali.

## Data

- Data hanya tersimpan di HP (localStorage), tidak dikirim ke mana pun.
- Backup rutin lewat tab Atur → Backup. File `acetrack-backup-YYYY-MM-DD.json` bisa dipulihkan lewat Restore.
- Menghapus data situs Chrome atau uninstall aplikasi akan menghapus data. Backup dulu.
