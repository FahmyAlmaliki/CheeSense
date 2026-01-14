# 🧀 Cheesense Web Dashboard

**Platform IoT untuk Visualisasi Analisis Kualitas Keju secara Real-time**

Cheesense adalah platform web yang memvisualisasikan data spektrum cahaya dari sensor AS7341 untuk menganalisis kualitas keju. Sistem ini menerima data dari mikrokontroler (ESP32/ESP8266), menyimpannya ke database time-series, dan menyajikannya dalam bentuk grafik interaktif.

![Cheesense Dashboard](https://img.shields.io/badge/Platform-IoT-blue) ![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Docker](https://img.shields.io/badge/Docker-Ready-brightgreen) ![License](https://img.shields.io/badge/License-MIT-yellow)

## 📋 Daftar Isi

- [Fitur](#-fitur)
- [Arsitektur](#-arsitektur)
- [Quick Start dengan Docker](#-quick-start-dengan-docker)
- [Instalasi Manual](#-instalasi-manual)
- [Konfigurasi](#-konfigurasi)
- [Menjalankan Aplikasi](#-menjalankan-aplikasi)
- [API Endpoints](#-api-endpoints)
- [Integrasi ESP32](#-integrasi-esp32)
- [Struktur Proyek](#-struktur-proyek)

## ✨ Fitur

### Dashboard Real-time
- 📊 **Live Spectrum Visualizer** - Grafik batang dinamis 8 channel + Clear + NIR
- 🔄 **Auto-refresh** - Update otomatis setiap 2 detik
- 📡 **Status Koneksi** - Indikator online/offline
- 💡 **Analisis Cepat** - Warna dominan & status kualitas

### Riwayat Data
- 📅 **Filter Tanggal** - Date-picker untuk rentang waktu
- 📈 **Trend Chart** - Grafik garis untuk analisis temporal
- 📊 **Statistik** - Rata-rata, max, min values
- 📥 **Export CSV** - Download data ke file

### Desain UI/UX
- 🎨 **Palet Warna Keju** - Kuning #FFC107, Oranye #FF9800
- 📱 **Responsive** - Desktop, tablet, & mobile
- ⚡ **Modern** - Font Poppins, animasi halus

## 🏗 Arsitektur

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   ESP32 +   │ HTTP │   Node.js   │      │  InfluxDB   │
│   AS7341    │ ───► │   Express   │ ◄──► │   Docker    │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │   Browser   │
                     │  (Chart.js) │
```

## 🚀 Quick Start dengan Docker

### Prasyarat
- Docker & Docker Compose v2
- InfluxDB container sudah running (sudah ada di docker-compose.yml)

### Cara Tercepat - Menggunakan Helper Script

```bash
# 1. Pindah ke direktori CheeSense
cd /home/selene/iot_platform/CheeSense

# 2. Jalankan script deployment
./deploy_cheesense.sh

# 3. Pilih opsi 8 (Full deployment)
```

### Cara Manual

```bash
# 1. Build image
cd /home/selene/iot_platform
docker compose build cheesense-web

# 2. Start container
docker compose up -d cheesense-web

# 3. Cek status
docker compose ps cheesense-web
```

### Akses Dashboard

- **Dashboard:** http://localhost:8085
- **History Page:** http://localhost:8085/history
- **API Status:** http://localhost:8085/api/status

### Test dengan Demo Data

```bash
# Generate 50 data points demo
curl -X POST http://localhost:8085/api/demo/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 50}'
```

Lihat dokumentasi lengkap di [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)

## 📦 Instalasi Manual
                     └─────────────┘
```

## 📦 Instalasi

### Prerequisites
- Node.js 18+ (https://nodejs.org)
- InfluxDB 2.x (opsional, untuk production)
- npm atau yarn

### Langkah Instalasi

1. **Clone atau Download Proyek**
   ```bash
   cd CheeSense
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment (Opsional)**
   ```bash
   # Copy file example
   cp .env.example .env
   
   # Edit konfigurasi
   notepad .env
   ```

## ⚙ Konfigurasi

### File `.env` (Opsional)

```env
# InfluxDB Configuration (opsional - bisa jalan tanpa ini)
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your-influxdb-token-here
INFLUXDB_ORG=your-organization
INFLUXDB_BUCKET=cheesense_db

# Server Configuration
PORT=3000
```

> **Catatan:** Aplikasi bisa berjalan tanpa InfluxDB dalam mode demo. Data akan disimpan sementara di memory.

### Skema Database InfluxDB

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `sensor_id` | Tag | ID sensor (misal: cheesense_01) |
| `f1` - `f8` | Float | Channel spektrum AS7341 |
| `clear` | Float | Nilai clear channel |
| `nir` | Float | Nilai Near-Infrared |

## 🚀 Menjalankan Aplikasi

### Mode Development
```bash
npm run dev
```

### Mode Production
```bash
npm start
```

Akses aplikasi di browser:
- **Dashboard**: http://localhost:3000
- **Riwayat**: http://localhost:3000/history

## 📡 API Endpoints

### POST `/api/record`
Menerima data dari ESP32/ESP8266.

**Request Body:**
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

**Response:**
```json
{
  "success": true,
  "message": "Data recorded successfully",
  "data": { ... }
}
```

### GET `/api/latest`
Mengambil data terakhir.

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "sensor_id": "cheesense_01",
    "f1": 415.5,
    ...
  }
}
```

### GET `/api/history`
Mengambil riwayat data.

**Query Parameters:**
- `start` - ISO timestamp awal (opsional)
- `end` - ISO timestamp akhir (opsional)
- `limit` - Maksimal jumlah data (default: 100)

**Example:**
```
GET /api/history?start=2024-01-15T00:00:00Z&end=2024-01-15T23:59:59Z&limit=50
```

### GET `/api/status`
Mengecek status server dan database.

### POST `/api/demo/generate`
Generate data demo untuk testing.

**Request Body:**
```json
{
  "count": 50
}
```

## 🔌 Integrasi ESP32

### Contoh Kode Arduino/ESP32

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_AS7341.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server Configuration
const char* serverUrl = "http://YOUR_SERVER_IP:3000/api/record";

Adafruit_AS7341 as7341;

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
  
  // Initialize AS7341
  if (!as7341.begin()) {
    Serial.println("AS7341 not found!");
    while (1);
  }
  
  as7341.setATIME(100);
  as7341.setASTEP(999);
  as7341.setGain(AS7341_GAIN_256X);
}

void loop() {
  // Read all channels
  if (!as7341.readAllChannels()) {
    Serial.println("Error reading AS7341!");
    delay(2000);
    return;
  }
  
  // Create JSON payload
  StaticJsonDocument<512> doc;
  doc["sensor_id"] = "cheesense_01";
  doc["f1"] = as7341.getChannel(AS7341_CHANNEL_415nm_F1);
  doc["f2"] = as7341.getChannel(AS7341_CHANNEL_445nm_F2);
  doc["f3"] = as7341.getChannel(AS7341_CHANNEL_480nm_F3);
  doc["f4"] = as7341.getChannel(AS7341_CHANNEL_515nm_F4);
  doc["f5"] = as7341.getChannel(AS7341_CHANNEL_555nm_F5);
  doc["f6"] = as7341.getChannel(AS7341_CHANNEL_590nm_F6);
  doc["f7"] = as7341.getChannel(AS7341_CHANNEL_630nm_F7);
  doc["f8"] = as7341.getChannel(AS7341_CHANNEL_680nm_F8);
  doc["clear"] = as7341.getChannel(AS7341_CHANNEL_CLEAR);
  doc["nir"] = as7341.getChannel(AS7341_CHANNEL_NIR);
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Send HTTP POST
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    int httpCode = http.POST(jsonString);
    
    if (httpCode > 0) {
      Serial.printf("HTTP Response: %d\n", httpCode);
      String response = http.getString();
      Serial.println(response);
    } else {
      Serial.printf("HTTP Error: %s\n", http.errorToString(httpCode).c_str());
    }
    
    http.end();
  }
  
  delay(2000); // Send every 2 seconds
}
```

### Library yang Dibutuhkan (Arduino IDE)
- WiFi (built-in ESP32)
- HTTPClient (built-in ESP32)
- ArduinoJson by Benoit Blanchon
- Adafruit AS7341 by Adafruit

## 📁 Struktur Proyek

```
CheeSense/
├── 📄 package.json          # Dependencies & scripts
├── 📄 server.js             # Express.js backend
├── 📄 .env.example          # Environment template
├── 📄 README.md             # Dokumentasi
│
└── 📁 public/               # Frontend files
    ├── 📄 index.html        # Dashboard page
    ├── 📄 history.html      # History page
    │
    ├── 📁 css/
    │   └── 📄 style.css     # Styling
    │
    └── 📁 js/
        ├── 📄 dashboard.js  # Dashboard logic
        └── 📄 history.js    # History logic
```

## 🎨 Palet Warna

| Nama | Hex Code | Penggunaan |
|------|----------|------------|
| Primary Yellow | `#FFC107` | Branding, tombol |
| Accent Orange | `#FF9800` | Highlight, warning |
| Warm White | `#FFFDE7` | Background |
| Violet (F1) | `#8B5CF6` | Channel 415nm |
| Blue (F2) | `#3B82F6` | Channel 445nm |
| Cyan (F3) | `#06B6D4` | Channel 480nm |
| Green (F4) | `#10B981` | Channel 515nm |
| Yellow-Green (F5) | `#84CC16` | Channel 555nm |
| Yellow (F6) | `#FBBF24` | Channel 590nm |
| Orange (F7) | `#F97316` | Channel 630nm |
| Red (F8) | `#EF4444` | Channel 680nm |

## 📜 Lisensi

MIT License - Bebas digunakan untuk keperluan pendidikan dan komersial.

---

<div align="center">
  <p>Dibuat dengan ❤️ untuk analisis kualitas keju</p>
  <p>🧀 <strong>Cheesense</strong> - IoT Cheese Quality Platform</p>
</div>