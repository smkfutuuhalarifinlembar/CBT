#!/bin/bash
# ==============================================================
# Script Otomatis Deploy Sistem Ujian CBT Essay ke VPS (Ubuntu/Debian)
# ==============================================================
set -e

echo "🚀 Memulai proses persiapan & deploy sistem ujian..."

# 1. Pastikan Node.js 20 terpasang
if ! command -v node &> /dev/null || ! node -v | grep -q "v20\|v22\|v18"; then
    echo "📦 Menginstall Node.js LTS (v20)..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ NPM version: $(npm -v)"

# 2. Pasang PM2 secara global jika belum ada
if ! command -v pm2 &> /dev/null; then
    echo "📦 Menginstall PM2 process manager..."
    sudo npm install -g pm2
fi

# 3. Validasi file .env
if [ ! -f .env ]; then
    echo "⚠️ File .env belum ditemukan! Membuat .env dari .env.example..."
    cp .env.example .env
    echo "⚠️ Harap periksa dan sesuaikan file .env jika ada konfigurasi khusus."
fi

# 3.5. Install PostgreSQL lokal (pengganti Supabase) & buat database sesuai DATABASE_URL
if ! command -v psql &> /dev/null; then
    echo "🐘 Menginstall PostgreSQL..."
    sudo apt-get update
    sudo apt-get install -y postgresql
fi

if [ -f .env ]; then
    DB_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -n "$DB_URL" ]; then
        DB_USER=$(echo "$DB_URL" | sed -E 's#^postgres(ql)?://([^:]+):.*#\2#')
        DB_PASS=$(echo "$DB_URL" | sed -E 's#^[^:]+://[^:]+:([^@]+)@.*#\1#')
        DB_NAME=$(echo "$DB_URL" | sed -E 's#.*/([^/?]+).*#\1#')
        echo "🐘 Mengecek database '$DB_NAME' untuk role '$DB_USER'..."
        sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
            || sudo -u postgres psql -c "CREATE ROLE \"$DB_USER\" LOGIN PASSWORD '$DB_PASS';"
        sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
            || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
        echo "✅ Database PostgreSQL siap."
    fi
fi

# 4. Install dependencies
echo "📦 Menginstall dependencies aplikasi..."
npm install

# 5. Build aplikasi (Frontend Vite & Backend Server)
echo "🔨 Membangun sistem (npm run build)..."
npm run build

# 6. Jalankan atau restart aplikasi via PM2
echo "🚀 Menjalankan aplikasi dengan PM2..."
if pm2 list | grep -q "cbt-exam-system"; then
    pm2 reload ecosystem.config.cjs --update-env
else
    pm2 start ecosystem.config.cjs
fi

pm2 save

echo ""
echo "=========================================================="
echo "🎉 DEPLOY BERHASIL!"
echo "Aplikasi berjalan di background pada port 3000."
echo "Cek status aplikasi: pm2 status"
echo "Lihat logs: pm2 logs cbt-exam-system"
echo "=========================================================="
