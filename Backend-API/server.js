/**
 * Cheesense Backend API Server
 * API untuk menerima data dari ESP32 dan menyimpan ke InfluxDB
 * 
 * URL Production: https://devel-ai.ub.ac.id/api/cheesense
 * 
 * Endpoints:
 * - POST /api/cheesense/record     - Input data dari ESP32
 * - GET  /api/cheesense/latest     - Data terakhir
 * - GET  /api/cheesense/history    - Riwayat data
 * - GET  /api/cheesense/status     - Status server & database
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Base path - kosongkan jika reverse proxy sudah handle /api/cheesense
const API_BASE = process.env.API_BASE_PATH || '';

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet());

// CORS - Allow ESP32 and frontend
app.use(cors({
    origin: '*', // Allow all origins for IoT devices
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization']
}));

// Parse JSON body
app.use(express.json({ limit: '10kb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        error: 'Too many requests, please try again later.'
    }
});
app.use(API_BASE, limiter);

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// INFLUXDB CONFIGURATION
// ============================================

const influxConfig = {
    url: process.env.INFLUXDB_URL || 'http://localhost:8086',
    token: process.env.INFLUXDB_TOKEN || '',
    org: process.env.INFLUXDB_ORG || 'cheesense',
    bucket: process.env.INFLUXDB_BUCKET || 'cheesense_db'
};

let influxClient = null;
let writeApi = null;
let queryApi = null;
let influxConnected = false;

// Initialize InfluxDB
function initInfluxDB() {
    try {
        if (!influxConfig.token || influxConfig.token === 'your-influxdb-token-here') {
            console.warn('⚠️  InfluxDB token not configured. Running in demo mode.');
            return false;
        }

        influxClient = new InfluxDB({
            url: influxConfig.url,
            token: influxConfig.token
        });

        writeApi = influxClient.getWriteApi(influxConfig.org, influxConfig.bucket, 'ns');
        writeApi.useDefaultTags({ application: 'cheesense' });

        queryApi = influxClient.getQueryApi(influxConfig.org);

        console.log('✅ InfluxDB client initialized');
        console.log(`   URL: ${influxConfig.url}`);
        console.log(`   Org: ${influxConfig.org}`);
        console.log(`   Bucket: ${influxConfig.bucket}`);
        
        influxConnected = true;
        return true;
    } catch (error) {
        console.error('❌ InfluxDB initialization error:', error.message);
        return false;
    }
}

initInfluxDB();

// ============================================
// IN-MEMORY STORAGE (Fallback/Demo Mode)
// ============================================

let memoryStorage = [];
const MAX_MEMORY_RECORDS = 1000;

function addToMemory(data) {
    memoryStorage.push(data);
    if (memoryStorage.length > MAX_MEMORY_RECORDS) {
        memoryStorage = memoryStorage.slice(-MAX_MEMORY_RECORDS);
    }
}

// ============================================
// API KEY VALIDATION (Optional)
// ============================================

function validateApiKey(req, res, next) {
    const apiKey = process.env.API_KEY;
    
    // Skip validation if API_KEY not configured
    if (!apiKey || apiKey === 'your-secret-api-key-here') {
        return next();
    }

    const providedKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!providedKey || providedKey !== apiKey) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or missing API key'
        });
    }
    
    next();
}

// ============================================
// API ENDPOINTS
// ============================================

/**
 * POST /api/cheesense/record
 * Menerima data spektrum dari ESP32/ESP8266
 * 
 * Headers:
 *   Content-Type: application/json
 *   X-API-Key: your-api-key (optional)
 * 
 * Body:
 * {
 *   "sensor_id": "cheesense_01",
 *   "f1": 415.5, "f2": 445.2, "f3": 480.8, "f4": 515.3,
 *   "f5": 555.7, "f6": 590.1, "f7": 630.4, "f8": 680.9,
 *   "clear": 750.2, "nir": 850.6
 * }
 */
app.post(`${API_BASE}/record`, validateApiKey, async (req, res) => {
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
            sensor_id: String(sensor_id),
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

        // Write to InfluxDB
        if (writeApi && influxConnected) {
            try {
                const point = new Point('spectral_data')
                    .tag('sensor_id', dataPoint.sensor_id)
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
                
                console.log(`📊 Data written to InfluxDB from ${sensor_id}`);
            } catch (influxError) {
                console.error('InfluxDB write error:', influxError.message);
                // Continue and store in memory as fallback
            }
        }

        // Also store in memory (for fallback/demo)
        addToMemory(dataPoint);

        res.status(201).json({
            success: true,
            message: 'Data recorded successfully',
            timestamp: dataPoint.timestamp,
            sensor_id: dataPoint.sensor_id
        });

    } catch (error) {
        console.error('Error recording data:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/cheesense/latest
 * Mengambil data terakhir untuk dashboard real-time
 */
app.get(`${API_BASE}/latest`, async (req, res) => {
    try {
        let latestData = null;

        // Try InfluxDB first
        if (queryApi && influxConnected) {
            try {
                const query = `
                    from(bucket: "${influxConfig.bucket}")
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
                            results.push(tableMeta.toObject(row));
                        },
                        error(error) {
                            console.warn('InfluxDB query error:', error.message);
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
            } catch (queryError) {
                console.warn('InfluxDB query failed:', queryError.message);
            }
        }

        // Fallback to memory storage
        if (!latestData && memoryStorage.length > 0) {
            latestData = memoryStorage[memoryStorage.length - 1];
        }

        // No data available
        if (!latestData) {
            return res.json({
                success: true,
                data: null,
                message: 'No data available'
            });
        }

        res.json({
            success: true,
            data: latestData
        });

    } catch (error) {
        console.error('Error fetching latest data:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/cheesense/history
 * Mengambil riwayat data untuk grafik trend
 * 
 * Query params:
 *   - start: ISO timestamp (default: 24 jam lalu)
 *   - end: ISO timestamp (default: sekarang)
 *   - limit: max records (default: 100)
 *   - sensor_id: filter by sensor (optional)
 */
app.get(`${API_BASE}/history`, async (req, res) => {
    try {
        const { start, end, limit = 100, sensor_id } = req.query;
        
        const startTime = start ? new Date(start) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endTime = end ? new Date(end) : new Date();
        const maxLimit = Math.min(parseInt(limit), 1000);

        let historyData = [];

        // Try InfluxDB first
        if (queryApi && influxConnected) {
            try {
                let query = `
                    from(bucket: "${influxConfig.bucket}")
                    |> range(start: ${startTime.toISOString()}, stop: ${endTime.toISOString()})
                    |> filter(fn: (r) => r._measurement == "spectral_data")
                `;

                if (sensor_id) {
                    query += `|> filter(fn: (r) => r.sensor_id == "${sensor_id}")`;
                }

                query += `
                    |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
                    |> sort(columns: ["_time"], desc: false)
                    |> limit(n: ${maxLimit})
                `;

                await new Promise((resolve) => {
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
                            console.warn('InfluxDB history query error:', error.message);
                            resolve();
                        },
                        complete() {
                            resolve();
                        }
                    });
                });
            } catch (queryError) {
                console.warn('InfluxDB history query failed:', queryError.message);
            }
        }

        // Fallback to memory storage
        if (historyData.length === 0 && memoryStorage.length > 0) {
            historyData = memoryStorage
                .filter(d => {
                    const ts = new Date(d.timestamp);
                    const matchTime = ts >= startTime && ts <= endTime;
                    const matchSensor = !sensor_id || d.sensor_id === sensor_id;
                    return matchTime && matchSensor;
                })
                .slice(-maxLimit);
        }

        res.json({
            success: true,
            data: historyData,
            count: historyData.length,
            range: {
                start: startTime.toISOString(),
                end: endTime.toISOString()
            }
        });

    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/cheesense/status
 * Mengecek status server dan database
 */
app.get(`${API_BASE}/status`, async (req, res) => {
    const status = {
        server: 'online',
        timestamp: new Date().toISOString(),
        influxdb: 'unknown',
        memoryRecords: memoryStorage.length,
        config: {
            apiBasePath: API_BASE,
            influxUrl: influxConfig.url,
            influxOrg: influxConfig.org,
            influxBucket: influxConfig.bucket
        }
    };

    // Check InfluxDB connection
    if (queryApi && influxConnected) {
        try {
            const query = `from(bucket: "${influxConfig.bucket}") |> range(start: -1m) |> limit(n: 1)`;
            await new Promise((resolve) => {
                queryApi.queryRows(query, {
                    next() {},
                    error() {
                        status.influxdb = 'error';
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

    res.json(status);
});

/**
 * POST /api/cheesense/demo/generate
 * Generate demo data untuk testing
 */
app.post(`${API_BASE}/demo/generate`, (req, res) => {
    const count = Math.min(parseInt(req.body.count) || 50, 200);
    const now = Date.now();

    for (let i = 0; i < count; i++) {
        const timestamp = new Date(now - (count - i) * 60000);
        addToMemory({
            timestamp: timestamp.toISOString(),
            sensor_id: 'cheesense_demo',
            f1: 300 + Math.random() * 200,
            f2: 350 + Math.random() * 200,
            f3: 400 + Math.random() * 200,
            f4: 450 + Math.random() * 200,
            f5: 500 + Math.random() * 250,
            f6: 550 + Math.random() * 300,
            f7: 480 + Math.random() * 250,
            f8: 400 + Math.random() * 200,
            clear: 600 + Math.random() * 300,
            nir: 350 + Math.random() * 200
        });
    }

    res.json({
        success: true,
        message: `Generated ${count} demo records`,
        totalRecords: memoryStorage.length
    });
});

// ============================================
// ROOT & HEALTH CHECK
// ============================================

app.get(`${API_BASE}`, (req, res) => {
    res.json({
        name: 'Cheesense API',
        version: '1.0.0',
        description: 'IoT API untuk Analisis Kualitas Keju',
        endpoints: {
            'POST /record': 'Input data dari ESP32',
            'GET /latest': 'Data terakhir',
            'GET /history': 'Riwayat data',
            'GET /status': 'Status server'
        },
        documentation: 'https://github.com/cheesense/api-docs'
    });
});

app.get(`${API_BASE}/health`, (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🧀 CHEESENSE BACKEND API                                    ║
║   IoT API untuk Analisis Kualitas Keju                        ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║   🌐 Server:  http://localhost:${PORT}                           ║
║                                                               ║
║   Production URL:                                             ║
║   https://devel-ai.ub.ac.id/api/cheesense                     ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║   Endpoints:                                                  ║
║   POST /record     - Input data dari ESP32                    ║
║   GET  /latest     - Data terakhir                            ║
║   GET  /history    - Riwayat data                             ║
║   GET  /status     - Status server                            ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    if (writeApi) {
        await writeApi.close();
    }
    process.exit(0);
});
