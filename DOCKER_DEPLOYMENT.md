# CheeSense Web Dashboard - Docker Deployment

Website CheeSense telah dikonfigurasi untuk membaca data dari InfluxDB dan berjalan di Docker.

## 🚀 Cara Menjalankan

### 1. Build dan Start Container

Dari direktori root project (`/home/selene/iot_platform`), jalankan:

```bash
# Build dan start semua services termasuk CheeSense
docker-compose up -d cheesense-web

# Atau build dan start semua services sekaligus
docker-compose up -d
```

### 2. Akses Dashboard

Setelah container berjalan, akses dashboard di:

**🌐 CheeSense Dashboard:** http://localhost:8085

**API Endpoints:**
- `GET /api/latest` - Data sensor terakhir
- `GET /api/history` - Riwayat data dengan rentang waktu
- `GET /api/status` - Status koneksi InfluxDB
- `POST /api/record` - Input data dari ESP32
- `POST /api/demo/generate` - Generate data demo untuk testing

### 3. Cek Status Container

```bash
# Lihat status semua containers
docker-compose ps

# Lihat logs CheeSense
docker-compose logs -f cheesense-web

# Cek health status
docker-compose ps cheesense-web
```

## 🔧 Konfigurasi

### Environment Variables

File konfigurasi ada di `.env` di root project. Variabel yang digunakan:

```env
# InfluxDB Admin Token (harus sama dengan INFLUXDB_ADMIN_TOKEN)
INFLUXDB_ADMIN_TOKEN=your_token_here

# InfluxDB Organization
INFLUXDB_ORG=cheesense

# InfluxDB Bucket untuk CheeSense
# Catatan: Pastikan bucket 'cheesense' sudah dibuat di InfluxDB
```

### Koneksi ke InfluxDB

CheeSense akan otomatis terhubung ke InfluxDB container dengan konfigurasi:

- **URL:** `http://selene-influx-prod:8086` (internal network)
- **Organization:** `cheesense`
- **Bucket:** `cheesense`
- **Token:** Dari environment variable `INFLUXDB_ADMIN_TOKEN`

## 📊 Testing dengan Data Demo

Untuk menguji dashboard tanpa sensor fisik:

```bash
# Generate 50 data points demo
curl -X POST http://localhost:8085/api/demo/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 50}'
```

Atau buka dashboard dan refresh halaman untuk melihat data.

## 🔍 Troubleshooting

### Container tidak start

```bash
# Cek logs untuk error
docker-compose logs cheesense-web

# Rebuild container
docker-compose build cheesense-web
docker-compose up -d cheesense-web
```

### Tidak bisa connect ke InfluxDB

1. Pastikan InfluxDB container sudah running:
   ```bash
   docker-compose ps influxdb
   ```

2. Pastikan bucket 'cheesense' sudah dibuat di InfluxDB:
   ```bash
   # Akses InfluxDB UI di http://localhost:8086
   # Login dengan INFLUXDB_ADMIN_USER dan INFLUXDB_ADMIN_PASSWORD
   # Buat bucket 'cheesense' jika belum ada
   ```

3. Cek token InfluxDB sudah benar di file `.env`

### Port conflict (8085 sudah digunakan)?

Edit `docker-compose.yml`, ubah port mapping:
```yaml
ports:
  - "8086:3000"  # Ganti 8085 dengan port lain yang available
```

## 📁 Struktur Files

```
CheeSense/
├── Dockerfile              # Docker image definition
├── .dockerignore           # Files to exclude from Docker build
├── .env.example            # Template environment variables
├── server.js               # Node.js backend server
├── package.json            # Dependencies
└── public/                 # Frontend files
    ├── index.html          # Dashboard utama
    ├── history.html        # Halaman riwayat
    ├── css/
    │   └── style.css
    └── js/
        ├── dashboard.js    # Real-time visualization
        └── history.js      # Historical data charts
```

## 🔗 Integrasi dengan Services Lain

CheeSense terintegrasi dengan:

1. **InfluxDB** (`selene-influx-prod`) - Storage untuk data sensor
2. **EMQX** (optional) - Dapat menerima data via MQTT
3. **Telegraf** (optional) - Alternative data ingestion

## 📝 Notes

- Dashboard auto-refresh setiap 2 detik
- Port 8085 di host = Port 3000 di container
- Data disimpan di InfluxDB bucket 'cheesense'
- Jika InfluxDB tidak tersedia, menggunakan in-memory demo mode
- Healthcheck aktif untuk monitoring status container
