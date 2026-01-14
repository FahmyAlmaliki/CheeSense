/**
 * ============================================
 * CHEESENSE ESP32 - KODE LENGKAP
 * ============================================
 * 
 * Kode untuk ESP32 + Sensor AS7341
 * Mengirim data spektrum ke API Cheesense
 * 
 * API URL: https://devel-ai.ub.ac.id/api/cheesense/record
 * 
 * Library yang dibutuhkan:
 * - WiFi (built-in ESP32)
 * - HTTPClient (built-in ESP32)
 * - ArduinoJson by Benoit Blanchon
 * - Adafruit AS7341 by Adafruit
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_AS7341.h>

// ============================================
// KONFIGURASI - UBAH SESUAI KEBUTUHAN
// ============================================

// WiFi Configuration
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// API Configuration
const char* API_URL = "https://devel-ai.ub.ac.id/api/cheesense/record";
const char* SENSOR_ID = "cheesense_01";

// Optional: API Key (jika diaktifkan di server)
const char* API_KEY = "";  // Kosongkan jika tidak pakai

// Interval pengiriman data (ms)
const unsigned long SEND_INTERVAL = 2000;  // 2 detik

// ============================================
// INISIALISASI
// ============================================

Adafruit_AS7341 as7341;
unsigned long lastSendTime = 0;

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println();
    Serial.println("╔═══════════════════════════════════════╗");
    Serial.println("║   🧀 CHEESENSE ESP32                  ║");
    Serial.println("║   Cheese Quality Analyzer             ║");
    Serial.println("╚═══════════════════════════════════════╝");
    Serial.println();

    // Connect to WiFi
    connectWiFi();

    // Initialize AS7341 sensor
    initSensor();

    Serial.println("\n✅ System ready! Starting data transmission...\n");
}

void loop() {
    // Check WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("⚠️ WiFi disconnected. Reconnecting...");
        connectWiFi();
    }

    // Send data at interval
    if (millis() - lastSendTime >= SEND_INTERVAL) {
        lastSendTime = millis();
        readAndSendData();
    }
}

// ============================================
// WIFI CONNECTION
// ============================================

void connectWiFi() {
    Serial.print("📶 Connecting to WiFi: ");
    Serial.println(WIFI_SSID);

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.println("✅ WiFi Connected!");
        Serial.print("   IP Address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println();
        Serial.println("❌ WiFi connection failed!");
        Serial.println("   Retrying in 5 seconds...");
        delay(5000);
        ESP.restart();
    }
}

// ============================================
// SENSOR INITIALIZATION
// ============================================

void initSensor() {
    Serial.println("🔬 Initializing AS7341 sensor...");

    if (!as7341.begin()) {
        Serial.println("❌ AS7341 sensor not found!");
        Serial.println("   Check wiring:");
        Serial.println("   - SDA -> GPIO21");
        Serial.println("   - SCL -> GPIO22");
        Serial.println("   - VCC -> 3.3V");
        Serial.println("   - GND -> GND");
        
        while (1) {
            delay(1000);
        }
    }

    // Configure sensor
    as7341.setATIME(100);
    as7341.setASTEP(999);
    as7341.setGain(AS7341_GAIN_256X);

    Serial.println("✅ AS7341 sensor initialized!");
    Serial.println("   ATIME: 100");
    Serial.println("   ASTEP: 999");
    Serial.println("   Gain: 256X");
}

// ============================================
// READ SENSOR & SEND DATA
// ============================================

void readAndSendData() {
    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    Serial.println("📊 Reading sensor data...");

    // Read all channels
    if (!as7341.readAllChannels()) {
        Serial.println("❌ Error reading AS7341 sensor!");
        return;
    }

    // Get channel values
    uint16_t f1 = as7341.getChannel(AS7341_CHANNEL_415nm_F1);
    uint16_t f2 = as7341.getChannel(AS7341_CHANNEL_445nm_F2);
    uint16_t f3 = as7341.getChannel(AS7341_CHANNEL_480nm_F3);
    uint16_t f4 = as7341.getChannel(AS7341_CHANNEL_515nm_F4);
    uint16_t f5 = as7341.getChannel(AS7341_CHANNEL_555nm_F5);
    uint16_t f6 = as7341.getChannel(AS7341_CHANNEL_590nm_F6);
    uint16_t f7 = as7341.getChannel(AS7341_CHANNEL_630nm_F7);
    uint16_t f8 = as7341.getChannel(AS7341_CHANNEL_680nm_F8);
    uint16_t clear = as7341.getChannel(AS7341_CHANNEL_CLEAR);
    uint16_t nir = as7341.getChannel(AS7341_CHANNEL_NIR);

    // Print values
    Serial.println("   Channel Values:");
    Serial.printf("   F1 (415nm): %d\n", f1);
    Serial.printf("   F2 (445nm): %d\n", f2);
    Serial.printf("   F3 (480nm): %d\n", f3);
    Serial.printf("   F4 (515nm): %d\n", f4);
    Serial.printf("   F5 (555nm): %d\n", f5);
    Serial.printf("   F6 (590nm): %d\n", f6);
    Serial.printf("   F7 (630nm): %d\n", f7);
    Serial.printf("   F8 (680nm): %d\n", f8);
    Serial.printf("   Clear: %d\n", clear);
    Serial.printf("   NIR: %d\n", nir);

    // Create JSON payload
    StaticJsonDocument<512> doc;
    doc["sensor_id"] = SENSOR_ID;
    doc["f1"] = f1;
    doc["f2"] = f2;
    doc["f3"] = f3;
    doc["f4"] = f4;
    doc["f5"] = f5;
    doc["f6"] = f6;
    doc["f7"] = f7;
    doc["f8"] = f8;
    doc["clear"] = clear;
    doc["nir"] = nir;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    // Send to API
    sendToAPI(jsonPayload);
}

// ============================================
// SEND DATA TO API
// ============================================

void sendToAPI(String jsonPayload) {
    Serial.println("📤 Sending data to API...");
    Serial.print("   URL: ");
    Serial.println(API_URL);

    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");

    // Add API Key if configured
    if (strlen(API_KEY) > 0) {
        http.addHeader("X-API-Key", API_KEY);
    }

    // Set timeout
    http.setTimeout(10000);  // 10 seconds

    // Send POST request
    int httpCode = http.POST(jsonPayload);

    if (httpCode > 0) {
        Serial.printf("   HTTP Response: %d\n", httpCode);
        
        if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
            String response = http.getString();
            Serial.println("   ✅ Data sent successfully!");
            
            // Parse response
            StaticJsonDocument<256> resDoc;
            DeserializationError error = deserializeJson(resDoc, response);
            
            if (!error) {
                const char* message = resDoc["message"];
                Serial.print("   Server: ");
                Serial.println(message);
            }
        } else {
            Serial.println("   ⚠️ Server returned error");
            String response = http.getString();
            Serial.print("   Response: ");
            Serial.println(response);
        }
    } else {
        Serial.printf("   ❌ HTTP Error: %s\n", http.errorToString(httpCode).c_str());
    }

    http.end();
    Serial.println();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Function to find dominant color
String getDominantColor(uint16_t f1, uint16_t f2, uint16_t f3, uint16_t f4,
                        uint16_t f5, uint16_t f6, uint16_t f7, uint16_t f8) {
    uint16_t values[] = {f1, f2, f3, f4, f5, f6, f7, f8};
    const char* colors[] = {"Violet", "Blue", "Cyan", "Green", 
                           "Yellow-Green", "Yellow", "Orange", "Red"};
    
    uint16_t maxVal = 0;
    int maxIdx = 0;
    
    for (int i = 0; i < 8; i++) {
        if (values[i] > maxVal) {
            maxVal = values[i];
            maxIdx = i;
        }
    }
    
    return String(colors[maxIdx]);
}
