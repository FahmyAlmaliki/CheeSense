# CheeSense Reverse Proxy Configuration

Website CheeSense sekarang sudah dikonfigurasi untuk berjalan di sub-path `/cheesense` untuk reverse proxy.

## 🔧 Konfigurasi yang Sudah Diterapkan

1. **Environment Variable BASE_PATH**: `/cheesense`
2. **Port**: 8085 (host) → 3000 (container)
3. **Auto-detection**: Frontend JavaScript otomatis mendeteksi base path
4. **API Routes**: Semua API endpoint sekarang di `/cheesense/api/*`

## 🌐 URL Akses

### Lokal (Development)
- Dashboard: http://localhost:8085/cheesense/
- History: http://localhost:8085/cheesense/history
- API Status: http://localhost:8085/cheesense/api/status

### Production (Reverse Proxy)
- Dashboard: https://devel-ai.ub.ac.id/cheesense/
- History: https://devel-ai.ub.ac.id/cheesense/history
- API Status: https://devel-ai.ub.ac.id/cheesense/api/status

## 📋 Nginx Reverse Proxy Configuration

Tambahkan konfigurasi berikut ke Nginx:

```nginx
# CheeSense IoT Dashboard
location /cheesense/ {
    proxy_pass http://localhost:8085/cheesense/;
    proxy_http_version 1.1;
    
    # Headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket support (if needed in future)
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # Buffer settings
    proxy_buffering off;
    proxy_request_buffering off;
}
```

## 🔄 Alternative: Apache Reverse Proxy

Jika menggunakan Apache, tambahkan ke VirtualHost:

```apache
# CheeSense IoT Dashboard
ProxyPreserveHost On
ProxyPass /cheesense/ http://localhost:8085/cheesense/
ProxyPassReverse /cheesense/ http://localhost:8085/cheesense/

<Location /cheesense/>
    Require all granted
</Location>
```

## 🧪 Testing

### Test API Endpoint
```bash
# Lokal
curl http://localhost:8085/cheesense/api/status

# Production
curl https://devel-ai.ub.ac.id/cheesense/api/status
```

### Test HTML Page
```bash
# Lokal
curl -I http://localhost:8085/cheesense/

# Production
curl -I https://devel-ai.ub.ac.id/cheesense/
```

### Generate Demo Data
```bash
# Lokal
curl -X POST http://localhost:8085/cheesense/api/demo/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 50}'

# Production
curl -X POST https://devel-ai.ub.ac.id/cheesense/api/demo/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 50}'
```

## 📊 API Endpoints (dengan Base Path)

- `GET  /cheesense/api/status` - Status server & InfluxDB
- `GET  /cheesense/api/latest` - Data sensor terakhir
- `GET  /cheesense/api/history` - Riwayat data
- `POST /cheesense/api/record` - Input data dari ESP32
- `POST /cheesense/api/demo/generate` - Generate demo data

## 🔌 ESP32 Configuration

Update endpoint di ESP32 untuk production:

```cpp
// Change from:
// const char* serverUrl = "http://192.168.1.100:3001/api/record";

// To:
const char* serverUrl = "https://devel-ai.ub.ac.id/cheesense/api/record";
```

## ⚙️ Mengubah Base Path

Jika perlu menggunakan base path lain (misal `/sensor` atau `/iot`), edit `docker-compose.yml`:

```yaml
environment:
  - BASE_PATH=/sensor  # Ganti sesuai kebutuhan
```

Kemudian rebuild dan restart:
```bash
docker compose build cheesense-web
docker compose up -d cheesense-web
```

## 🐛 Troubleshooting

### "Cannot GET /cheesense" Error
- Pastikan BASE_PATH sudah diset di docker-compose.yml
- Restart container setelah perubahan konfigurasi

### Assets (CSS/JS) tidak load
- Periksa browser console untuk error
- Pastikan reverse proxy meneruskan request untuk static files
- Cek permission file di container

### API calls gagal di browser
1. Buka Developer Tools → Network tab
2. Cek apakah API calls menggunakan path yang benar
3. Periksa CORS headers di response

### Redirect loop
- Pastikan proxy_pass di Nginx/Apache menggunakan trailing slash yang konsisten
- Contoh yang benar: `proxy_pass http://localhost:8085/cheesense/;`

## ✅ Checklist Deployment

- [x] Container running di port 8085
- [x] BASE_PATH environment variable set
- [x] API endpoint accessible: `/cheesense/api/status`
- [x] Frontend auto-detect base path
- [ ] Reverse proxy configuration ditambahkan
- [ ] Test akses dari production URL
- [ ] Update ESP32 endpoint URL

## 📝 Notes

- Frontend JavaScript otomatis mendeteksi base path dari `window.location.pathname`
- Tidak perlu konfigurasi tambahan di frontend
- Semua assets (CSS, JS) menggunakan relative path
- Navigation links otomatis disesuaikan dengan base path
