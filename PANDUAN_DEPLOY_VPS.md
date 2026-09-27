# PANDUAN LENGKAP DEPLOY SISTEM UJIAN CBT KE VPS
*(Panduan ini dapat digunakan untuk semua penyedia VPS seperti Niagahoster, DomaiNesia, IDCloudHost, DigitalOcean, dll)*

> **PENTING — Shared hosting/cPanel (PHP) TIDAK BISA menjalankan aplikasi ini.**
> Aplikasi ini adalah **Node.js + Express + Vite** (bukan PHP), sehingga WAJIB di-hosting di **VPS** (atau layanan Node.js seperti Railway/Render).
> Jangan upload ke `public_html` cPanel — aplikasi tidak akan jalan. Lihat bagian 10 untuk alternatif hosting.

---

## 📋 1. Spesifikasi VPS yang Disarankan
- **Sistem Operasi**: Ubuntu 22.04 LTS atau Ubuntu 24.04 LTS (Disarankan)
- **RAM**: Minimal 1 GB (Sangat disarankan **2 GB** untuk kelancaran penilaian AI & akses bersamaan banyak siswa)
- **CPU**: Minimal 1 vCPU (Disarankan 2 vCPU)
- **Penyimpanan**: Minimal 20 GB SSD

---

## 🔑 2. Akses ke VPS melalui SSH
Setelah membeli VPS, Anda akan mendapatkan alamat **IP VPS**, user (**root**), dan **Password**.

### Di Windows (menggunakan Command Prompt atau PowerShell):
```bash
ssh root@IP_VPS_ANDA
```
*Masukkan password VPS saat diminta (karakter tidak akan muncul di layar, langsung tekan Enter).*

---

## 📂 3. Unggah Kode ke VPS

Pilih salah satu cara berikut:

### Opsi 3.1: Menggunakan Git (Paling Direkomendasikan)
Jika kode Anda sudah di-push ke GitHub / GitLab:
```bash
cd /var/www
git clone URL_REPOSITORY_ANDA cbt-exam
cd cbt-exam
```

### Opsi 3.2: Menggunakan FileZilla / WinSCP (Upload Manual ZIP)
1. Kompres semua file proyek ini menjadi file ZIP (jangan sertakan folder `node_modules` atau `dist`).
2. Buka aplikasi **FileZilla** di komputer Anda, masukkan Host: `sftp://IP_VPS_ANDA`, User: `root`, Port: `22`.
3. Upload file ZIP ke folder `/var/www/cbt-exam`.
4. Di terminal SSH VPS, ekstrak file:
   ```bash
   apt-get install -y unzip
   cd /var/www/cbt-exam
   unzip master.zip
   ```

---

## ⚙️ 4. Konfigurasi File Environment (.env)
Di dalam folder proyek `/var/www/cbt-exam`, buat atau salin file `.env`:
```bash
cp .env.example .env
nano .env
```
Pastikan variabel berikut terisi (lihat `.env.example` untuk format lengkap):
```ini
PORT=3000
NODE_ENV=production
APP_URL=https://ujian.sekolah.sch.id
ALLOWED_ORIGINS=https://ujian.sekolah.sch.id
# String acak min. 32 karakter (hasil: openssl rand -hex 32)
ADMIN_API_KEY=isi-string-acak-anda

# Kunci API Gemini (untuk fitur koreksi essay otomatis; kosongkan = penilai lokal)
GEMINI_API_KEY=AIzaSy...

# Database PostgreSQL LOKAL di VPS (lihat bagian 4b untuk instalasi)
DATABASE_URL=postgres://ujian:rahasia@127.0.0.1:5432/ujian_cbt

# Dibakar ke frontend saat `npm run build` (harus sama dengan ADMIN_API_KEY di atas)
VITE_ADMIN_API_KEY=isi-string-acak-yang-sama
```

**Aturan keamanan `.env`:**
- Jangan commit `.env` ke Git (sudah masuk `.gitignore`).
- Jangan pernah memberi awalan `VITE_` pada `DATABASE_URL` / `GEMINI_API_KEY` / secret apapun.
- Jika perlu mengganti kunci setelah build, jalankan ulang `npm run build` (nilai `VITE_` dibakar saat build).
*Tekan `CTRL + O`, lalu `ENTER` untuk menyimpan, kemudian `CTRL + X` untuk keluar dari nano.*

---

## 🐘 4b. Instalasi PostgreSQL di VPS (Wajib — Pengganti Supabase)
Sistem ini menyimpan data di **PostgreSQL lokal di VPS Anda sendiri** (tanpa layanan cloud eksternal).

```bash
# 1. Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql

# 2. Buat role & database sesuai DATABASE_URL di .env (contoh: ujian / ujian_cbt)
sudo -u postgres psql -c "CREATE ROLE ujian LOGIN PASSWORD 'rahasia';" || true
sudo -u postgres createdb -O ujian ujian_cbt || true

# 3. Verifikasi koneksi
PGPASSWORD=rahasia psql -h 127.0.0.1 -U ujian -d ujian_cbt -c "SELECT 1;"
```
> Tabel (`system_config`, `users`) **dibuat otomatis** oleh aplikasi saat pertama dijalankan — tidak perlu migrasi SQL manual.

### Backup database berkala (pg_dump)
```bash
# Backup manual
sudo -u postgres pg_dump -Fc ujian_cbt > /var/backups/ujian_cbt_$(date +%F).dump

# Backup otomatis tiap malam (cron): buka crontab -e lalu tambahkan:
# 0 2 * * * sudo -u postgres pg_dump -Fc ujian_cbt > /var/backups/ujian_cbt_$(date +\%F).dump
```

---

## 🚀 5. Metode Deploy Aplikasi (Pilih Salah Satu)

### METODE A: Menggunakan Script Otomatis & PM2 (Paling Populer & Cepat)
Kami sudah menyediakan script otomatis `deploy-vps.sh`:
```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```
Script tersebut akan otomatis:
1. Memeriksa dan menginstall Node.js v20 LTS
2. Menginstall PM2 process manager
3. Menginstall dependencies (`npm install`)
4. Membangun aplikasi (`npm run build`)
5. Menjalankan aplikasi di background via PM2

**Perintah berguna untuk PM2:**
- Cek status: `pm2 status`
- Lihat log sistem: `pm2 logs cbt-exam-system`
- Restart aplikasi: `pm2 restart cbt-exam-system`
- Stop aplikasi: `pm2 stop cbt-exam-system`
- Agar auto-start saat VPS reboot: `pm2 startup && pm2 save`

---

### METODE B: Menggunakan Docker & Docker Compose (Satu Perintah Selesai)
Jika Anda lebih menyukai container Docker:
```bash
# 1. Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 2. Jalankan aplikasi
docker compose up -d --build
```
Aplikasi akan otomatis berjalan di port `3000`.

---

## 🌐 6. Menghubungkan Domain & Nginx Reverse Proxy
Agar aplikasi dapat diakses melalui domain atau subdomain sekolah (misal: `ujian.smkfalendangjae.sch.id`) atau port standar HTTP (80) & HTTPS (443):

### 6.1 Arahkan DNS Domain ke IP VPS
Masuk ke panel domain Anda (cPanel/Cloudflare/Niagahoster), buat DNS Record:
- **Type**: `A`
- **Name**: `ujian` (atau `@` untuk domain utama)
- **IPv4 Address**: `IP_VPS_ANDA`
- **TTL**: Auto / 3600

### 6.2 Pasang dan Konfigurasi Nginx
```bash
sudo apt-get update
sudo apt-get install -y nginx

# Salin konfigurasi yang sudah disediakan
sudo cp nginx.conf.example /etc/nginx/sites-available/cbt-exam

# Edit file untuk memasukkan domain Anda
sudo nano /etc/nginx/sites-available/cbt-exam
```
Ganti baris `server_name ujian.domainanda.com;` dengan nama domain Anda, misalnya:
```nginx
server_name ujian.smkfalendangjae.sch.id;
```

Aktifkan konfigurasi dan restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/cbt-exam /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔒 7. Memasang SSL Gratis (HTTPS / Gembok Hijau)
Gunakan Certbot (Let's Encrypt) gratis:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ujian.smkfalendangjae.sch.id
```
Pilih opsi **Redirect all traffic to HTTPS** (angka 2). Selesai! Sekarang website ujian Anda sudah aman dengan HTTPS.

---

## 🔄 8. Cara Update Sistem di Kemudian Hari
Jika ada pembaruan kode di kemudian hari:
```bash
cd /var/www/cbt-exam
git pull
npm install
npm run build
pm2 reload cbt-exam-system
```
Aplikasi akan ter-update tanpa memutus koneksi siswa (*zero downtime reload*).

---

## 🛡️ 9. Checklist Keamanan Sebelum Go-Live
- [ ] PostgreSQL hanya listen di `127.0.0.1` (default) — jangan buka port 5432 ke publik (firewall VPS).
- [ ] Password role database (`ujian` pada `DATABASE_URL`) diganti dari default `rahasia`.
- [ ] `ADMIN_API_KEY` (server) = `VITE_ADMIN_API_KEY` (build frontend), panjang minimal 32 karakter acak.
- [ ] Tidak ada secret (`DATABASE_URL`, `GEMINI_API_KEY`) diawali `VITE_` atau ter-commit ke Git.
- [ ] HTTPS aktif + redirect HTTP→HTTPS di Nginx (bagian 7).
- [ ] Jalankan `npm run lint` (type check) dan `npm run build` tanpa error sebelum deploy.
- [ ] Backup berkala: menu Backup di Admin Dashboard + `pg_dump` (bagian 4b).

---

## 🏠 10. Alternatif Hosting
| Layanan | Cocok? | Keterangan |
|---|---|---|
| **VPS (Ubuntu) + Nginx + PM2** | ✅ Direkomendasikan | Paling murah & fleksibel, ikuti panduan ini |
| **Railway / Render / Fly.io** | ✅ | Platform Node.js managed; set env vars di dashboard |
| **Shared hosting cPanel (PHP)** | ❌ Tidak bisa | Tidak ada runtime Node.js — jangan upload ke `public_html` |
| **Shared hosting dengan Node selector** | ⚠️ Terbatas | Hanya jika provider menyediakan "Node.js App" selector cPanel & port forwarding; sering tidak stabil untuk ujian bersamaan |
