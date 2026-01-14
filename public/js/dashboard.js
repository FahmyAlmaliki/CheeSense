/**
 * Cheesense Dashboard - Main JavaScript
 * Real-time Spectrum Visualization
 * 
 * Features:
 * - Live Bar Chart with spectrum colors
 * - Auto-refresh every 2 seconds
 * - Channel detail cards
 * - Distribution pie chart
 */

// ============================================
// Configuration & Constants
// ============================================

// Auto-detect base path from URL
const getBasePath = () => {
    const path = window.location.pathname;
    // If path starts with /cheesense, use it as base
    if (path.startsWith('/cheesense')) {
        return '/cheesense';
    }
    return '';
};

const CONFIG = {
    API_BASE: getBasePath(), // Auto-detect base path for reverse proxy
    REFRESH_INTERVAL: 2000, // 2 seconds
    ANIMATION_DURATION: 500
};

// AS7341 Spectrum Channel Information
const CHANNELS = {
    f1: { name: 'F1', wavelength: '415nm', color: '#8B5CF6', colorName: 'Violet' },
    f2: { name: 'F2', wavelength: '445nm', color: '#3B82F6', colorName: 'Blue' },
    f3: { name: 'F3', wavelength: '480nm', color: '#06B6D4', colorName: 'Cyan' },
    f4: { name: 'F4', wavelength: '515nm', color: '#10B981', colorName: 'Green' },
    f5: { name: 'F5', wavelength: '555nm', color: '#84CC16', colorName: 'Yellow-Green' },
    f6: { name: 'F6', wavelength: '590nm', color: '#FBBF24', colorName: 'Yellow' },
    f7: { name: 'F7', wavelength: '630nm', color: '#F97316', colorName: 'Orange' },
    f8: { name: 'F8', wavelength: '680nm', color: '#EF4444', colorName: 'Red' },
    clear: { name: 'Clear', wavelength: 'Broadband', color: '#94A3B8', colorName: 'Clear' },
    nir: { name: 'NIR', wavelength: '910nm', color: '#6366F1', colorName: 'Near-IR' }
};

// ============================================
// Global State
// ============================================

let spectrumChart = null;
let pieChart = null;
let gaugeChart = null;
let refreshInterval = null;
let isConnected = false;

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    initializeChannelGrid();
    setupEventListeners();
    startDataPolling();
    checkServerStatus();
});

// ============================================
// Chart Initialization
// ============================================

function initializeCharts() {
    initSpectrumChart();
    initPieChart();
    initGaugeChart();
}

function initSpectrumChart() {
    const ctx = document.getElementById('spectrumChart').getContext('2d');
    
    const channelKeys = Object.keys(CHANNELS);
    const labels = channelKeys.map(key => `${CHANNELS[key].name}\n${CHANNELS[key].wavelength}`);
    const colors = channelKeys.map(key => CHANNELS[key].color);
    
    spectrumChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Spektrum Value',
                data: new Array(10).fill(0),
                backgroundColor: colors.map(c => c + 'CC'), // Add transparency
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: CONFIG.ANIMATION_DURATION
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#212121',
                    bodyColor: '#757575',
                    borderColor: '#FFC107',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        title: function(context) {
                            const key = Object.keys(CHANNELS)[context[0].dataIndex];
                            return `${CHANNELS[key].name} - ${CHANNELS[key].colorName}`;
                        },
                        label: function(context) {
                            return `Value: ${context.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            family: 'Poppins'
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Poppins',
                            size: 11
                        },
                        maxRotation: 0
                    }
                }
            }
        }
    });
}

function initPieChart() {
    const ctx = document.getElementById('pieChart').getContext('2d');
    
    const channelKeys = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];
    const labels = channelKeys.map(key => `${CHANNELS[key].name} (${CHANNELS[key].colorName})`);
    const colors = channelKeys.map(key => CHANNELS[key].color);
    
    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: new Array(8).fill(0),
                backgroundColor: colors.map(c => c + 'CC'),
                borderColor: colors,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: CONFIG.ANIMATION_DURATION
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: {
                            family: 'Poppins',
                            size: 11
                        },
                        padding: 10,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#212121',
                    bodyColor: '#757575',
                    borderColor: '#FFC107',
                    borderWidth: 1
                }
            },
            cutout: '60%'
        }
    });
}

function initGaugeChart() {
    const ctx = document.getElementById('gaugeChart').getContext('2d');
    
    gaugeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Clear', 'NIR'],
            datasets: [{
                label: 'Value',
                data: [0, 0],
                backgroundColor: [CHANNELS.clear.color + 'CC', CHANNELS.nir.color + 'CC'],
                borderColor: [CHANNELS.clear.color, CHANNELS.nir.color],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: CONFIG.ANIMATION_DURATION
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#212121',
                    bodyColor: '#757575',
                    borderColor: '#FFC107',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Poppins',
                            weight: '600'
                        }
                    }
                }
            }
        }
    });
}

// ============================================
// Channel Grid
// ============================================

function initializeChannelGrid() {
    const grid = document.getElementById('channelGrid');
    if (!grid) return;
    
    let html = '';
    Object.keys(CHANNELS).forEach(key => {
        const channel = CHANNELS[key];
        html += `
            <div class="channel-card ${key}" id="channel-${key}">
                <div class="channel-color" style="background: ${channel.color}"></div>
                <div class="channel-name">${channel.name}</div>
                <div class="channel-wavelength">${channel.wavelength}</div>
                <div class="channel-value" id="value-${key}">0</div>
            </div>
        `;
    });
    grid.innerHTML = html;
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchLatestData();
            showToast('Data refreshed!', 'success');
        });
    }
    
    // Generate demo data button
    const generateDemoBtn = document.getElementById('generateDemoBtn');
    if (generateDemoBtn) {
        generateDemoBtn.addEventListener('click', generateDemoData);
    }
}

// ============================================
// Data Fetching
// ============================================

function startDataPolling() {
    // Initial fetch
    fetchLatestData();
    
    // Set up interval
    refreshInterval = setInterval(fetchLatestData, CONFIG.REFRESH_INTERVAL);
}

async function fetchLatestData() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/api/latest`);
        const result = await response.json();
        
        if (result.success && result.data) {
            updateDashboard(result.data);
            setConnectionStatus(true);
        } else {
            console.warn('No data available');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        setConnectionStatus(false);
    }
}

async function checkServerStatus() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/api/status`);
        const status = await response.json();
        
        setConnectionStatus(status.server === 'online');
        
        if (status.influxdb === 'not configured') {
            showToast('InfluxDB tidak dikonfigurasi. Menggunakan mode demo.', 'warning');
        }
    } catch (error) {
        setConnectionStatus(false);
    }
}

async function generateDemoData() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/api/demo/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ count: 50 })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`${result.message}`, 'success');
            fetchLatestData();
        } else {
            showToast('Gagal generate demo data', 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// ============================================
// Dashboard Update
// ============================================

function updateDashboard(data) {
    updateStatusCards(data);
    updateSpectrumChart(data);
    updateChannelGrid(data);
    updatePieChart(data);
    updateGaugeChart(data);
}

function updateStatusCards(data) {
    // Sensor ID
    const sensorIdEl = document.getElementById('sensorId');
    if (sensorIdEl) {
        sensorIdEl.textContent = data.sensor_id || 'Unknown';
    }
    
    // Last Update
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl && data.timestamp) {
        const date = new Date(data.timestamp);
        lastUpdateEl.textContent = date.toLocaleString('id-ID');
    }
    
    // Dominant Color
    const dominantColorEl = document.getElementById('dominantColor');
    if (dominantColorEl) {
        const dominant = findDominantChannel(data);
        if (dominant) {
            dominantColorEl.textContent = `${dominant.colorName} - ${dominant.wavelength}`;
        }
    }
    
    // Quality Status (simple analysis based on yellow/orange values)
    const qualityStatusEl = document.getElementById('qualityStatus');
    if (qualityStatusEl) {
        const quality = analyzeQuality(data);
        qualityStatusEl.textContent = quality.status;
        qualityStatusEl.style.color = quality.color;
    }
}

function updateSpectrumChart(data) {
    if (!spectrumChart) return;
    
    const values = [
        data.f1 || 0, data.f2 || 0, data.f3 || 0, data.f4 || 0,
        data.f5 || 0, data.f6 || 0, data.f7 || 0, data.f8 || 0,
        data.clear || 0, data.nir || 0
    ];
    
    spectrumChart.data.datasets[0].data = values;
    spectrumChart.update('none'); // Disable animation for smoother updates
}

function updateChannelGrid(data) {
    Object.keys(CHANNELS).forEach(key => {
        const valueEl = document.getElementById(`value-${key}`);
        if (valueEl) {
            const value = data[key] || 0;
            valueEl.textContent = value.toFixed(1);
        }
    });
}

function updatePieChart(data) {
    if (!pieChart) return;
    
    const values = [
        data.f1 || 0, data.f2 || 0, data.f3 || 0, data.f4 || 0,
        data.f5 || 0, data.f6 || 0, data.f7 || 0, data.f8 || 0
    ];
    
    pieChart.data.datasets[0].data = values;
    pieChart.update('none');
}

function updateGaugeChart(data) {
    if (!gaugeChart) return;
    
    gaugeChart.data.datasets[0].data = [data.clear || 0, data.nir || 0];
    gaugeChart.update('none');
}

// ============================================
// Analysis Functions
// ============================================

function findDominantChannel(data) {
    const channelKeys = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];
    let maxValue = -1;
    let dominantKey = null;
    
    channelKeys.forEach(key => {
        const value = data[key] || 0;
        if (value > maxValue) {
            maxValue = value;
            dominantKey = key;
        }
    });
    
    return dominantKey ? CHANNELS[dominantKey] : null;
}

function analyzeQuality(data) {
    // Simple quality analysis based on cheese color characteristics
    // Good cheese typically has higher yellow/orange (F6, F7) values
    const yellowValue = data.f6 || 0;
    const orangeValue = data.f7 || 0;
    const avgSpectrum = (yellowValue + orangeValue) / 2;
    
    if (avgSpectrum === 0) {
        return { status: 'Menunggu Data...', color: '#757575' };
    } else if (avgSpectrum > 500) {
        return { status: 'Sangat Baik ✓', color: '#4CAF50' };
    } else if (avgSpectrum > 300) {
        return { status: 'Baik', color: '#8BC34A' };
    } else if (avgSpectrum > 150) {
        return { status: 'Cukup', color: '#FFC107' };
    } else {
        return { status: 'Perlu Perhatian', color: '#FF9800' };
    }
}

// ============================================
// UI Helpers
// ============================================

function setConnectionStatus(connected) {
    isConnected = connected;
    const indicator = document.getElementById('connectionStatus');
    if (!indicator) return;
    
    const statusText = indicator.querySelector('.status-text');
    
    if (connected) {
        indicator.classList.remove('disconnected');
        indicator.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        indicator.classList.remove('connected');
        indicator.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
        <span class="toast-close" onclick="this.parentElement.remove()">×</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// ============================================
// Cleanup
// ============================================

window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});
