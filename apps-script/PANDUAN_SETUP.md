# Panduan Setup Google Apps Script — Absensi Stand SI UNCAL

Waktu setup: ~5 menit. Lakukan SATU KALI sebelum pameran.

---

## Langkah 1 — Buat Google Sheets

1. Buka [sheets.google.com](https://sheets.google.com)
2. Buat spreadsheet baru, beri nama: **"Absensi Stand SI UNCAL"**
3. Biarkan kosong (header akan dibuat otomatis saat data pertama masuk)

---

## Langkah 2 — Buat Google Apps Script

1. Di Spreadsheet yang baru dibuat, klik menu **Extensions → Apps Script**
2. Hapus semua kode yang ada di editor
3. Copy-paste seluruh isi file `absensi.gs` ke editor
4. Klik ikon **Save** (atau Ctrl+S)
5. Beri nama project: **"Absensi SI UNCAL"**

---

## Langkah 3 — Deploy sebagai Web App

1. Klik tombol biru **"Deploy"** → pilih **"New deployment"**
2. Klik ikon ⚙️ di sebelah "Select type" → pilih **"Web app"**
3. Isi pengaturan:
   - **Description**: Absensi Stand SI UNCAL
   - **Execute as**: Me
   - **Who has access**: **Anyone** ← PENTING, harus "Anyone"
4. Klik **"Deploy"**
5. Jika diminta izin, klik **"Authorize access"** → pilih akun Google → klik "Allow"
6. **Copy URL Web App** yang muncul — bentuknya seperti:
   ```
   https://script.google.com/macros/s/AKfycbXXXXXXXXXX/exec
   ```

---

## Langkah 4 — Pasang URL ke index.html

1. Buka file `/Users/bob/Documents/SIUNCAL/index.html`
2. Cari baris ini:
   ```javascript
   var APPS_SCRIPT_URL = "GANTI_DENGAN_URL_APPS_SCRIPT_ANDA";
   ```
3. Ganti dengan URL dari langkah 3:
   ```javascript
   var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbXXXXXXXXXX/exec";
   ```
4. Save file → push/deploy ke Vercel

---

## Langkah 5 — Test

1. Buka website Vercel di tab incognito
2. Tunggu 1.5 detik → modal absensi muncul
3. Isi nama + rating → klik "Saya Sudah Mengunjungi ✓"
4. Buka Google Sheets → data harus sudah masuk

---

## Cara Melihat Data Pengunjung

- Buka Google Sheets **"Absensi Stand SI UNCAL"**
- Kolom: Timestamp | Nama | Rating | User Agent
- Data muncul real-time setiap ada yang submit

---

## Hapus Setelah Pameran

Setelah 10 September 2026, widget otomatis berhenti muncul (ada expiry date di kode).
Untuk benar-benar menghapus dari kode, cari blok komentar ini di `index.html`:
```
<!-- ABSENSI PENGUNJUNG STAND — SI UNCAL (Sementara 2 hari) -->
```
dan hapus semua kode hingga:
```
<!-- ====== END ABSENSI ====== -->
```
