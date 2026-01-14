/**
 * Cheesense Web Dashboard - Backend Server
 * IoT Platform untuk Visualisasi Analisis Kualitas Keju
 * 
 * Stack: Node.js + Express.js + InfluxDB
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// InfluxDB Configuration
const influxURL = process.env.INFLUXDB_URL || 'http://localhost:8086';
const influxToken = process.env.INFLUXDB_TOKEN || '';
const influxOrg = process.env.INFLUXDB_ORG || 'cheesense';
const influxBucket = process.env.INFLUXDB_BUCKET || 'cheesense_db';

// Initialize InfluxDB Client
let influxClient = null;
let writeApi = null;
let queryApi = null;

try {
    influxClient = new InfluxDB({ url: influxURL, token: influxToken });
    writeApi = influxClient.getWriteApi(influxOrg, influxBucket, 'ns');
    queryApi = influxClient.getQueryApi(influxOrg);
    console.log('✅ InfluxDB client initialized');
} catch (error) {
    console.warn('⚠️ InfluxDB not configured. Running in demo mode.');
}

// In-memory storage for demo mode (when InfluxDB is not available)
let demoData = [];
const MAX_DEMO_DATA = 1000;

// ============================================
// API ENDPOINTS
// ============================================

/**
 * POST /api/record
 * Menerima data spektrum dari ESP32/ESP8266
 * 
 * Body JSON:
 * {
 *   "sensor_id": "cheesense_01",
 *   "f1": 400, "f2": 450, "f3": 500, "f4": 550,
 *   "f5": 600, "f6": 650, "f7": 700, "f8": 750,
 *   "clear": 800, "nir": 850
 * }
 */
app.post('/api/record', async (req, res) => {
    try {
        const { sensor_id, f1, f2, f3, f4, f5, f6, f7, f8, clear, nir } = req.body;

        // Validate required fields
        if (!sensor_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'sensor_id is required' 
            });
        }

        const timestamp = new Date();
        const dataPoint = {
            timestamp: timestamp.toISOString(),
            sensor_id,
            f1: parseFloat(f1) || 0,
            f2: parseFloat(f2) || 0,
            f3: parseFloat(f3) || 0,
            f4: parseFloat(f4) || 0,
            f5: parseFloat(f5) || 0,
            f6: parseFloat(f6) || 0,
            f7: parseFloat(f7) || 0,
            f8: parseFloat(f8) || 0,
            clear: parseFloat(clear) || 0,
            nir: parseFloat(nir) || 0
        };

        // Try to write to InfluxDB
        if (writeApi) {
            const point = new Point('spectral_data')
                .tag('sensor_id', sensor_id)
                .floatField('f1', dataPoint.f1)
                .floatField('f2', dataPoint.f2)
                .floatField('f3', dataPoint.f3)
                .floatField('f4', dataPoint.f4)
                .floatField('f5', dataPoint.f5)
                .floatField('f6', dataPoint.f6)
                .floatField('f7', dataPoint.f7)
                .floatField('f8', dataPoint.f8)
                .floatField('clear', dataPoint.clear)
                .floatField('nir', dataPoint.nir)
                .timestamp(timestamp);

            writeApi.writePoint(point);
            await writeApi.flush();
        }

        // Also store in demo data (in-memory)
        demoData.push(dataPoint);
        if (demoData.length > MAX_DEMO_DATA) {
            demoData = demoData.slice(-MAX_DEMO_DATA);
        }

        console.log(`📊 Data recorded from ${sensor_id}`);
        res.json({ success: true, message: 'Data recorded successfully', data: dataPoint });

    } catch (error) {
        console.error('Error recording data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/latest
 * Mengambil 1 data terakhir untuk dashboard real-time
 */
app.get('/api/latest', async (req, res) => {
    try {
        let latestData = null;

        // Try to get from InfluxDB first
        if (queryApi) {
            const query = `
                from(bucket: "${influxBucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "spectral_data")
                |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
                |> sort(columns: ["_time"], desc: true)
                |> limit(n: 1)
            `;

            const results = [];
            await new Promise((resolve, reject) => {
                queryApi.queryRows(query, {
                    next(row, tableMeta) {
                        const data = tableMeta.toObject(row);
                        results.push(data);
                    },
                    error(error) {
                        console.warn('InfluxDB query error, using demo data:', error.message);
                        resolve();
                    },
                    complete() {
                        resolve();
                    }
                });
            });

            if (results.length > 0) {
                const row = results[0];
                latestData = {
                    timestamp: row._time,
                    sensor_id: row.sensor_id,
                    f1: row.f1, f2: row.f2, f3: row.f3, f4: row.f4,
                    f5: row.f5, f6: row.f6, f7: row.f7, f8: row.f8,
                    clear: row.clear, nir: row.nir
                };
            }
        }

        // Fallback to demo data
        if (!latestData && demoData.length > 0) {
            latestData = demoData[demoData.length - 1];
        }

        // If no data at all, return demo placeholder
        if (!latestData) {
            latestData = {
                timestamp: new Date().toISOString(),
                sensor_id: 'demo',
                f1: 0, f2: 0, f3: 0, f4: 0,
                f5: 0, f6: 0, f7: 0, f8: 0,
                clear: 0, nir: 0,
                isDemo: true
            };
        }

        res.json({ success: true, data: latestData });

    } catch (error) {
        console.error('Error fetching latest data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/history
 * Mengambil array data untuk grafik riwayat
 * Query params: start, end (ISO timestamp)
 */
app.get('/api/history', async (req, res) => {
    try {
        const { start, end, limit = 100 } = req.query;
        
        const startTime = start ? new Date(start) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endTime = end ? new Date(end) : new Date();

        let historyData = [];

        // Try to get from InfluxDB first
        if (queryApi) {
            const query = `
                from(bucket: "${influxBucket}")
                |> range(start: ${startTime.toISOString()}, stop: ${endTime.toISOString()})
                |> filter(fn: (r) => r._measurement == "spectral_data")
                |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
                |> sort(columns: ["_time"], desc: false)
                |> limit(n: ${parseInt(limit)})
            `;

            await new Promise((resolve, reject) => {
                queryApi.queryRows(query, {
                    next(row, tableMeta) {
                        const data = tableMeta.toObject(row);
                        historyData.push({
                            timestamp: data._time,
                            sensor_id: data.sensor_id,
                            f1: data.f1, f2: data.f2, f3: data.f3, f4: data.f4,
                            f5: data.f5, f6: data.f6, f7: data.f7, f8: data.f8,
                            clear: data.clear, nir: data.nir
                        });
                    },
                    error(error) {
                        console.warn('InfluxDB query error, using demo data:', error.message);
                        resolve();
                    },
                    complete() {
                        resolve();
                    }
                });
            });
        }

        // Fallback to demo data
        if (historyData.length === 0 && demoData.length > 0) {
            historyData = demoData.filter(d => {
                const ts = new Date(d.timestamp);
                return ts >= startTime && ts <= endTime;
            }).slice(-parseInt(limit));
        }

        res.json({ 
            success: true, 
            data: historyData,
            count: historyData.length,
            range: { start: startTime.toISOString(), end: endTime.toISOString() }
        });

    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/status
 * Mengecek status koneksi server dan database
 */
app.get('/api/status', async (req, res) => {
    const status = {
        server: 'online',
        influxdb: 'unknown',
        lastDataTime: null,
        dataCount: demoData.length
    };

    // Check InfluxDB connection
    if (queryApi) {
        try {
            const query = `from(bucket: "${influxBucket}") |> range(start: -1m) |> limit(n: 1)`;
            await new Promise((resolve) => {
                queryApi.queryRows(query, {
                    next() {},
                    error() { 
                        status.influxdb = 'disconnected';
                        resolve();
                    },
                    complete() {
                        status.influxdb = 'connected';
                        resolve();
                    }
                });
            });
        } catch {
            status.influxdb = 'error';
        }
    } else {
        status.influxdb = 'not configured';
    }

    // Get last data time
    if (demoData.length > 0) {
        status.lastDataTime = demoData[demoData.length - 1].timestamp;
    }

    res.json(status);
});

/**
 * POST /api/demo/generate
 * Generate demo data for testing
 */
app.post('/api/demo/generate', (req, res) => {
    const count = parseInt(req.body.count) || 50;
    const now = Date.now();

    for (let i = 0; i < count; i++) {
        const timestamp = new Date(now - (count - i) * 60000); // 1 minute intervals
        demoData.push({
            timestamp: timestamp.toISOString(),
            sensor_id: 'cheesense_demo',
            f1: 300 + Math.random() * 200,  // 415nm - Violet
            f2: 350 + Math.random() * 200,  // 445nm - Blue
            f3: 400 + Math.random() * 200,  // 480nm - Cyan
            f4: 450 + Math.random() * 200,  // 515nm - Green
            f5: 500 + Math.random() * 250,  // 555nm - Yellow-Green
            f6: 550 + Math.random() * 300,  // 590nm - Yellow (highest for cheese)
            f7: 480 + Math.random() * 250,  // 630nm - Orange
            f8: 400 + Math.random() * 200,  // 680nm - Red
            clear: 600 + Math.random() * 300,
            nir: 350 + Math.random() * 200
        });
    }

    // Keep only last MAX_DEMO_DATA
    if (demoData.length > MAX_DEMO_DATA) {
        demoData = demoData.slice(-MAX_DEMO_DATA);
    }

    res.json({ 
        success: true, 
        message: `Generated ${count} demo data points`,
        totalData: demoData.length
    });
});

// ============================================
// SERVE FRONTEND
// ============================================

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve history page
app.get('/history', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   🧀 CHEESENSE WEB DASHBOARD                          ║
    ║   IoT Platform untuk Analisis Kualitas Keju           ║
    ║                                                       ║
    ╠═══════════════════════════════════════════════════════╣
    ║                                                       ║
    ║   🌐 Server running at: http://localhost:${PORT}         ║
    ║   📊 Dashboard: http://localhost:${PORT}/                ║
    ║   📈 History:   http://localhost:${PORT}/history         ║
    ║                                                       ║
    ╠═══════════════════════════════════════════════════════╣
    ║   API Endpoints:                                      ║
    ║   POST /api/record    - Input data dari ESP32         ║
    ║   GET  /api/latest    - Data terakhir                 ║
    ║   GET  /api/history   - Riwayat data                  ║
    ║   GET  /api/status    - Status server                 ║
    ║   POST /api/demo/generate - Generate demo data        ║
    ╚═══════════════════════════════════════════════════════╝
    `);
});
