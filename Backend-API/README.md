# 🧀 Cheesense Backend API

Backend API untuk menerima data dari ESP32 dan menyimpan ke InfluxDB.

## 🌐 URL Production

```
https://devel-ai.ub.ac.id/api/cheesense
```

## 📦 Instalasi

```bash
cd Backend-API
npm install
```

## ⚙️ Konfigurasi

Edit file `.env` untuk mengatur koneksi InfluxDB:

```env
# InfluxDB Configuration
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your-influxdb-token-here
INFLUXDB_ORG=your-organization
INFLUXDB_BUCKET=cheesense_db

# Optional: API Key untuk keamanan
API_KEY=your-secret-api-key-here
```

## 🚀 Menjalankan

```bash
# Development
npm run dev

# Production
npm start
```

## 📡 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/cheesense/record` | Input data dari ESP32 |
| GET | `/api/cheesense/latest` | Data terakhir |
| GET | `/api/cheesense/history` | Riwayat data |
| GET | `/api/cheesense/status` | Status server |

## 📤 Contoh Request dari ESP32

### POST /api/cheesense/record

```json
{
  "sensor_id": "cheesense_01",
  "f1": 415.5,
  "f2": 445.2,
  "f3": 480.8,
  "f4": 515.3,
  "f5": 555.7,
  "f6": 590.1,
  "f7": 630.4,
  "f8": 680.9,
  "clear": 750.2,
  "nir": 850.6
}
```

### Response

```json
{
  "success": true,
  "message": "Data recorded successfully",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sensor_id": "cheesense_01"
}
```

## 🔌 Kode ESP32

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* serverUrl = "https://devel-ai.ub.ac.id/api/cheesense/record";

void sendData() {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<512> doc;
    doc["sensor_id"] = "cheesense_01";
    doc["f1"] = 415.5;
    // ... tambahkan field lainnya
    
    String json;
    serializeJson(doc, json);
    
    int httpCode = http.POST(json);
    http.end();
}
```
