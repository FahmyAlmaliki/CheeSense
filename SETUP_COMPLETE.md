# 🎉 CheeSense Web Dashboard - Setup Selesai!

Website CheeSense telah berhasil dikonfigurasi dan berjalan di Docker!

## ✅ Yang Sudah Dikonfigurasi

1. ✅ **Dockerfile** - Image Node.js 18 Alpine dengan health check
2. ✅ **Docker Compose** - Service `cheesense-web` terintegrasi dengan InfluxDB
3. ✅ **Environment Variables** - Otomatis menggunakan config dari `.env` root
4. ✅ **InfluxDB Connection** - Terhubung ke `selene-influx-prod` container
5. ✅ **Port Mapping** - Port 3001 (host) → 3000 (container)
6. ✅ **Health Check** - Monitoring otomatis untuk container status
7. ✅ **Helper Script** - `deploy_cheesense.sh` untuk kemudahan deployment

## 🌐 Akses Dashboard

**Dashboard Utama:** http://localhost:8085

**Halaman History:** http://localhost:8085/history

**API Status:** http://localhost:8085/api/status

## 🔧 Perintah Penting

```bash
# Start CheeSense
docker compose up -d cheesense-web

# Stop CheeSense
docker compose stop cheesense-web

# Restart CheeSense
docker compose restart cheesense-web

# View logs
docker compose logs -f cheesense-web

# Check status
docker compose ps cheesense-web

# Rebuild image
docker compose build cheesense-web
```

## 🎲 Generate Demo Data (untuk Testing)

```bash
# Generate 50 data points
curl -X POST http://localhost:8085/api/demo/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 50}'
```

## 📡 API Endpoints

- `GET /api/status` - Status server dan koneksi InfluxDB
- `GET /api/latest` - Data sensor terakhir
- `GET /api/history?start=...&end=...&limit=100` - Data history dengan filter
- `POST /api/record` - Input data dari ESP32 (Body: JSON dengan f1-f8, clear, nir)
- `POST /api/demo/generate` - Generate demo data untuk testing

## 🔌 Kirim Data dari ESP32

```cpp
// HTTP POST ke:
// http://YOUR_SERVER_IP:8085/api/record

// Body JSON:
{
  "sensor_id": "cheesense_01",
  "f1": 400, "f2": 450, "f3": 500, "f4": 550,
  "f5": 600, "f6": 650, "f7": 700, "f8": 750,
  "clear": 800, "nir": 850
}
```

## 📊 Konfigurasi InfluxDB

Website sudah otomatis terhubung ke InfluxDB dengan setting:

- **URL:** `http://selene-influx-prod:8086` (internal Docker network)
- **Organization:** `cheesense`
- **Bucket:** `cheesense`
- **Token:** Dari environment variable `INFLUXDB_ADMIN_TOKEN`

**Penting:** Pastikan bucket `cheesense` sudah dibuat di InfluxDB!
- Akses InfluxDB UI: http://localhost:8086
- Login dengan credentials dari `.env`
- Buat bucket bernama `cheesense` jika belum ada

## 🐛 Troubleshooting

### Container tidak start?
```bash
docker compose logs cheesense-web
```

### InfluxDB not connected?
1. Cek InfluxDB container running: `docker compose ps influxdb`
2. Cek bucket 'cheesense' sudah dibuat di http://localhost:8086
3. Cek token di `.env` sudah benar

### Port 8085 sudah digunakan?
Edit `docker-compose.yml`, ubah port:
```yaml
ports:
  - "8086:3000"  # Ganti 8085 dengan port lain
```

## 📚 Dokumentasi Lengkap

- **Docker Deployment:** [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
- **Full README:** [README.md](README.md)
- **Helper Script:** `./deploy_cheesense.sh`

## 🎯 Next Steps

1. **Pastikan bucket 'cheesense' ada di InfluxDB**
   - Buka http://localhost:8086
   - Buat bucket jika belum ada

2. **Test dengan Demo Data**
   ```bash
   curl -X POST http://localhost:8085/api/demo/generate -H "Content-Type: application/json" -d '{"count": 50}'
   ```

3. **Buka Dashboard**
   - http://localhost:8085

4. **Integrasikan dengan ESP32**
   - Ubah endpoint di ESP32 ke `http://YOUR_SERVER_IP:8085/api/record`
   - Data akan otomatis masuk ke InfluxDB dan tampil di dashboard

---

**Status Saat Ini:**
- ✅ Docker Image: Built
- ✅ Container: Running (healthy)
- ✅ InfluxDB: Connected
- ✅ Port: 8085 (accessible)

Selamat! Website CheeSense siap digunakan! 🧀🎉
