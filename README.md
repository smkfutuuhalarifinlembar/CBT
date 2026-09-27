<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Sistem Ujian Essay Online (CBT)

Aplikasi ujian berbasis web: **Node.js + Express + Vite + React + PostgreSQL lokal** (tanpa layanan cloud — Supabase/Firebase sudah dihapus).

## Prasyarat
- Node.js 20+ 
- PostgreSQL 14+ berjalan di `localhost:5432` (lihat `PANDUAN_DEPLOY_VPS.md` bagian 4b untuk instalasi & pembuatan database)

## Menjalankan Secara Lokal
```bash
# 1. Install dependensi
npm install

# 2. Buat file .env (isi DATABASE_URL & kunci)
copy .env.example .env      # Windows — lalu edit isinya

# 3. Jalankan server + frontend (mode dev, hot-reload)
npm run dev
```
Buka **http://localhost:3000**

Tabel (`system_config`, `users`) dibuat **otomatis** saat pertama kali dijalankan.

### Login admin awal
Atur di `.env` (sudah terisi contoh):
- Email: `admin@sekolah.local`
- Sandi: `UbahSaya123!`
> **Ganti sandi ini** setelah login pertama (menu admin → pengguna).

## Build untuk Produksi
```bash
npm run build      # vite build + bundling server → dist/
npm start          # jalankan dist/server.cjs
```

## Struktur Penting
| File | Fungsi |
|---|---|
| `server.ts` | Express: API ujian, koreksi AI (Gemini), auth login, /api/db/* |
| `db.ts` | Lapisan PostgreSQL (skema + query) |
| `src/services/storage.ts` | Klien API frontend + cache localStorage |
| `.env` | Konfigurasi rahasia (jangan commit) |
| `PANDUAN_DEPLOY_VPS.md` | Panduan lengkap deploy ke VPS (PM2/Nginx/SSL/PostgreSQL) |

## Perintah Berguna
- `npm run lint` — type check TypeScript
- `npm run build` — build produksi
- `npm run dev` — mode pengembangan

