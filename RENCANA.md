# AceTrack — Rencana

Pencatat pengeluaran pribadi. PWA untuk Android (Poco F6), data tersimpan di HP (localStorage, diminta persisten), offline, backup/restore JSON. Logo: AceCore Nexus (ikon di header + ikon app, wordmark V di halaman Tentang).

## Navigasi bawah (4 tab)
Beranda · Laporan · Aset · Atur

## Beranda (gabungan A + B)
- Sisa jatah hari ini (progress bar) dan sisa cadangan bulan ini
- Grid kategori. Tap kategori → numpad besar muncul dari bawah
- Numpad: tombol cepat 2rb / 5rb / 10rb, tombol "000", pilihan sumber dana (default = terakhir dipakai), catatan opsional, tanggal (default hari ini)
- 5 catatan terakhir (tap untuk edit/hapus)
- Satu baris "Proyeksi akhir bulan" di kartu cadangan (muncul setelah 3 hari mencatat). Tap → ringkasan: proyeksi, rata-rata harian, hemat berturut-turut, hari paling boros, kategori terbesar.

## Model budget
- Jatah harian (default Rp 50.000) dan cadangan bulanan (default Rp 1.500.000), terpisah. Keduanya bisa diubah.
- Tiap kategori bertipe **Harian** (makan, minum, parkir) atau **Cadangan** (bensin, belanja bulanan, dll.).
- Pengeluaran kategori Harian memakai jatah hari itu. Kalau jatah habis, kelebihannya dipotong dari cadangan.
- Pengeluaran kategori Cadangan langsung dipotong dari cadangan.
- Sisa jatah harian yang tidak terpakai masuk ke cadangan di akhir hari.
- Asumsi: cadangan direset tiap awal bulan ke nilai awal.

## Laporan
- Segmen Hari / Minggu / Bulan / Tahun
- Total keluar vs budget, grafik batang (per hari dalam bulan, per bulan dalam tahun) dengan garis budget
- Rincian per kategori (nominal + persen), tap batang → daftar transaksi hari itu

## Aset (terhubung ke pengeluaran)
- Daftar platform per kelompok: Bank (BCA, BNI, Jago), Investasi (Bibit), Tunai / e-wallet
- Total aset + grafik tren (riwayat disimpan tiap perubahan)
- Pengeluaran mengurangi saldo sumber dana yang dipilih
- Pemasukan (Beranda → Catat pemasukan): jenis Gaji/Bonus/Jualan/Lainnya, pilih platform tujuan, menambah saldo. Tidak memengaruhi budget; tampil di Laporan sebagai total pemasukan dan baris hijau.
- Ubah saldo manual: selisihnya dicatat sebagai "Penyesuaian" (bank/e-wallet/tunai, tampil di Laporan sebagai "di luar catatan") atau "Nilai naik/turun" (investasi, tampil di kartu Total aset). Pengisian pertama dicatat sebagai "Saldo awal". Tap platform menampilkan 10 riwayat terakhir.
- Piutang (tombol Pinjamkan): siapa, nominal, diambil dari platform mana. "Sudah dikembalikan" memilih platform tujuan. Biaya admin opsional dipotong dari platform asal dan dicatat sebagai pengeluaran "Biaya admin" (cadangan); ikut terhapus kalau catatan piutang dihapus. Piutang tetap dihitung dalam total aset dan tidak dianggap pengeluaran.
- Transfer antar platform dengan biaya admin opsional. Biaya admin dipotong dari platform asal dan dicatat sebagai pengeluaran kategori "Biaya admin" (cadangan), yang dibuat otomatis saat pertama dipakai.

## Atur
- Ubah jatah harian dan cadangan bulanan
- Kelola kategori (nama, ikon, tipe Harian/Cadangan)
- Kelola platform aset
- Backup / restore JSON
- Tentang (logo AceCore Nexus)
