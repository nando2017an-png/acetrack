# AceTrack — Rencana

Pencatat pengeluaran pribadi. PWA untuk Android (Poco F6), data tersimpan di HP (localStorage, diminta persisten), offline, backup/restore JSON. Logo: AceCore Nexus (ikon di header + ikon app, wordmark V di halaman Tentang).

## Navigasi bawah (4 tab)
Beranda · Laporan · Aset · Atur

## Beranda (gabungan A + B)
- Sisa jatah hari ini (progress bar) dan sisa cadangan bulan ini
- Grid kategori. Tap kategori → numpad besar muncul dari bawah
- Numpad: tombol cepat 2rb / 5rb / 10rb, tombol "000", pilihan sumber dana (default = terakhir dipakai), catatan opsional, tanggal (default hari ini)
- 3 catatan terakhir (tap untuk edit/hapus)

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
- Ubah saldo manual (gaji masuk, nilai investasi naik/turun) dan transfer antar platform

## Atur
- Ubah jatah harian dan cadangan bulanan
- Kelola kategori (nama, ikon, tipe Harian/Cadangan)
- Kelola platform aset
- Backup / restore JSON
- Tentang (logo AceCore Nexus)
