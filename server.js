/**
 * CheeSense Web Dashboard - Backend Server
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
const BASE_PATH = process.env.BASE_PATH || '';

// Middleware
app.use(cors());
app.use(express.json());

// Static files with base path support
if (BASE_PATH) {
    app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));
} else {
    app.use(express.static(path.join(__dirname, 'public')));
}

// InfluxDB Configuration
const influxURL = process.env.INFLUXDB_URL || 'http://localhost:8086';
const influxToken = process.env.INFLUXDB_TOKEN || '';
const influxOrg = process.env.INFLUXDB_ORG || 'cheesense';
const influxBucket = process.env.INFLUXDB_BUCKET || 'cheesense';

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
// FUZZY LOGIC CLASSIFICATION
// ============================================

// Fuzzy Logic Configuration
const THRESHOLD = 6458;  // Threshold value for fresh/spoiled classification
const K = 1700;           // Smoothness factor for sigmoid function

/**
 * Calculate fuzzy membership value for "Fresh" category
 * Uses sigmoid function for smooth transition
 * @param {number} x - Intensity value (f5/555nm)
 * @returns {number} Fresh confidence (0-1)
 */
function fuzzyFreshMembership(x) {
    return 1 / (1 + Math.exp(-(x - THRESHOLD) / K));
}

/**
 * Classify cheese quality based on spectral intensity
 * @param {number} intensity_555nm - F5 channel value (555nm)
 * @returns {object} Classification result with confidence levels
 */
function classifySample(intensity_555nm) {
    const fresh = fuzzyFreshMembership(intensity_555nm);
    const spoiled = 1 - fresh;

    let status;
    if (fresh > 0.5) {
        status = "Fresh";
    } else if (fresh > 0.25) {
        status = "Moderate";
    } else {
        status = "Spoiled";
    }

    return {
        intensity_555nm: intensity_555nm,
        fresh_confidence: Number(fresh.toFixed(3)),
        spoiled_confidence: Number(spoiled.toFixed(3)),
        status: status
    };
}

// ============================================
// API ENDPOINTS
// ============================================

// Create router for API routes
const apiRouter = express.Router();

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
apiRouter.post('/record', async (req, res) => {
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

        // Add fuzzy classification based on F5 (555nm)
        const classification = classifySample(dataPoint.f5);
        dataPoint.classification = classification;

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
apiRouter.get('/latest', async (req, res) => {
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

        // Add classification if not already present
        if (!latestData.classification) {
            latestData.classification = classifySample(latestData.f5 || 0);
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
apiRouter.get('/history', async (req, res) => {
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

        // Add classification to all history data if not present
        historyData = historyData.map(record => {
            if (!record.classification) {
                record.classification = classifySample(record.f5 || 0);
            }
            return record;
        });

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
 * POST /api/classify
 * Klasifikasi sampel berdasarkan intensitas 555nm
 * 
 * Body JSON:
 * {
 *   "intensity_555nm": 6500
 * }
 */
apiRouter.post('/classify', (req, res) => {
    try {
        const { intensity_555nm } = req.body;

        if (typeof intensity_555nm !== "number") {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid input. intensity_555nm must be a number' 
            });
        }

        const result = classifySample(intensity_555nm);
        res.json({ success: true, data: result });

    } catch (error) {
        console.error('Error classifying sample:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/status
 * Mengecek status koneksi server dan database
 */
apiRouter.get('/status', async (req, res) => {
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
apiRouter.post('/demo/generate', (req, res) => {
    const count = parseInt(req.body.count) || 50;
    const now = Date.now();

    for (let i = 0; i < count; i++) {
        const timestamp = new Date(now - (count - i) * 60000); // 1 minute intervals
        const f5_value = 500 + Math.random() * 250;  // 555nm - Yellow-Green
        const dataPoint = {
            timestamp: timestamp.toISOString(),
            sensor_id: 'cheesense_demo',
            f1: 300 + Math.random() * 200,  // 415nm - Violet
            f2: 350 + Math.random() * 200,  // 445nm - Blue
            f3: 400 + Math.random() * 200,  // 480nm - Cyan
            f4: 450 + Math.random() * 200,  // 515nm - Green
            f5: f5_value,
            f6: 550 + Math.random() * 300,  // 590nm - Yellow (highest for cheese)
            f7: 480 + Math.random() * 250,  // 630nm - Orange
            f8: 400 + Math.random() * 200,  // 680nm - Red
            clear: 600 + Math.random() * 300,
            nir: 350 + Math.random() * 200
        };
        // Add classification
        dataPoint.classification = classifySample(f5_value);
        demoData.push(dataPoint);
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

// Mount API router
if (BASE_PATH) {
    app.use(BASE_PATH + '/api', apiRouter);
} else {
    app.use('/api', apiRouter);
}

// ============================================
// SERVE FRONTEND
// ============================================

// Create page router
const pageRouter = express.Router();

// Serve index.html for root
pageRouter.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve history page
pageRouter.get('/history', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

// Mount page router
if (BASE_PATH) {
    app.use(BASE_PATH, pageRouter);
} else {
    app.use('/', pageRouter);
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    const basePath = BASE_PATH || '';
    console.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   🧀 CHEESENSE WEB DASHBOARD                          ║
    ║   IoT Platform untuk Analisis Kualitas Keju           ║
    ║                                                       ║
    ╠═══════════════════════════════════════════════════════╣
    ║                                                       ║
    ║   🌐 Server running at: http://localhost:${PORT}${basePath}     ║
    ║   📊 Dashboard: http://localhost:${PORT}${basePath}/            ║
    ║   📈 History:   http://localhost:${PORT}${basePath}/history     ║
    ║                                                       ║
    ╠═══════════════════════════════════════════════════════╣
    ║   API Endpoints:                                      ║
    ║   POST ${basePath}/api/record    - Input data dari ESP32      ║
    ║   GET  ${basePath}/api/latest    - Data terakhir              ║
    ║   GET  ${basePath}/api/history   - Riwayat data               ║
    ║   GET  ${basePath}/api/status    - Status server              ║
    ║   POST ${basePath}/api/demo/generate - Generate demo data     ║
    ╚═══════════════════════════════════════════════════════╝
    `);
});
