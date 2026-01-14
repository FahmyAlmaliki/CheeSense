/**
 * Cheesense History Page - JavaScript
 * Historical Data Visualization & Analysis
 * 
 * Features:
 * - Date range filtering
 * - Trend line chart
 * - Data table with export
 * - Statistical analysis
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

let comparisonChart = null;
let distributionChart = null;
let currentData = [];

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    setupEventListeners();
    checkServerStatus();
    loadHistoryData();
});

// ============================================
// Chart Initialization
// ============================================

function initializeCharts() {
    initComparisonChart();
    initDistributionChart();
}

function initComparisonChart() {
    const ctx = document.getElementById('comparisonChart');
    if (!ctx) return;
    
    comparisonChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: Object.keys(CHANNELS).slice(0, 8).map(k => CHANNELS[k].name),
            datasets: [{
                label: 'Nilai Rata-rata',
                data: new Array(8).fill(0),
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                borderColor: '#FFC107',
                borderWidth: 2,
                pointBackgroundColor: '#FFC107',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#FFC107'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    pointLabels: {
                        font: {
                            family: 'Poppins',
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function initDistributionChart() {
    const ctx = document.getElementById('distributionChart');
    if (!ctx) return;
    
    const channelKeys = Object.keys(CHANNELS).slice(0, 8);
    
    distributionChart = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: channelKeys.map(k => `${CHANNELS[k].name} (${CHANNELS[k].colorName})`),
            datasets: [{
                data: new Array(8).fill(0),
                backgroundColor: channelKeys.map(k => CHANNELS[k].color + '80'),
                borderColor: channelKeys.map(k => CHANNELS[k].color),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
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
            }
        }
    });
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Time Range selector
    const timeRangeSelect = document.getElementById('timeRange');
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', loadHistoryData);
    }
    
    // Apply Filter Button
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', loadHistoryData);
    }
    
    // Reset Filter Button
    const resetFilterBtn = document.getElementById('resetFilterBtn');
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', resetFilters);
    }
    
    // Export Button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
}

// ============================================
// Filter Handlers
// ============================================

function getTimeRangeMillis(range) {
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    
    switch (range) {
        case '15m': return 15 * minute;
        case '30m': return 30 * minute;
        case '1h': return hour;
        case '3h': return 3 * hour;
        case '6h': return 6 * hour;
        case '12h': return 12 * hour;
        case '24h': return 24 * hour;
        case '3d': return 3 * day;
        case '7d': return 7 * day;
        case '30d': return 30 * day;
        default: return hour;
    }
}

function resetFilters() {
    const timeRangeSelect = document.getElementById('timeRange');
    if (timeRangeSelect) {
        timeRangeSelect.value = '1h';
    }
    
    loadHistoryData();
}

// ============================================
// Data Loading
// ============================================

async function loadHistoryData() {
    const timeRange = document.getElementById('timeRange').value;
    const limit = document.getElementById('dataLimit').value;
    
    const now = new Date();
    const rangeMillis = getTimeRangeMillis(timeRange);
    const startDate = new Date(now.getTime() - rangeMillis);
    
    try {
        showLoading(true);
        
        const params = new URLSearchParams({
            start: startDate.toISOString(),
            end: now.toISOString(),
            limit: limit
        });
        
        const response = await fetch(`${CONFIG.API_BASE}/api/history?${params}`);
        const result = await response.json();
        
        if (result.success) {
            currentData = result.data;
            updateAllVisualization();
            showToast(`Loaded ${result.count} data points`, 'success');
        } else {
            showToast('Gagal memuat data: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error loading history:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function checkServerStatus() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/api/status`);
        const status = await response.json();
        
        setConnectionStatus(status.server === 'online');
        
        if (status.influxdb === 'not configured') {
            showToast('Mode demo aktif. Generate demo data untuk melihat grafik.', 'warning');
        }
    } catch (error) {
        setConnectionStatus(false);
    }
}

// ============================================
// Visualization Updates
// ============================================

function updateAllVisualization() {
    updateComparisonChart();
    updateDistributionChart();
    updateDataTable();
}

function updateComparisonChart() {
    if (!comparisonChart || currentData.length === 0) return;
    
    const channelKeys = Object.keys(CHANNELS).slice(0, 8);
    const avgValues = channelKeys.map(key => {
        const values = currentData.map(d => d[key] || 0);
        return values.reduce((a, b) => a + b, 0) / values.length;
    });
    
    comparisonChart.data.datasets[0].data = avgValues;
    comparisonChart.update();
}

function updateDistributionChart() {
    if (!distributionChart || currentData.length === 0) return;
    
    const channelKeys = Object.keys(CHANNELS).slice(0, 8);
    const avgValues = channelKeys.map(key => {
        const values = currentData.map(d => d[key] || 0);
        return values.reduce((a, b) => a + b, 0) / values.length;
    });
    
    distributionChart.data.datasets[0].data = avgValues;
    distributionChart.update();
}

function updateDataTable() {
    const tableBody = document.getElementById('tableBody');
    const tableInfo = document.getElementById('tableInfo');
    
    if (!tableBody) return;
    
    if (currentData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="12" class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h3>Tidak ada data</h3>
                    <p>Coba ubah filter atau generate demo data</p>
                </td>
            </tr>
        `;
        if (tableInfo) tableInfo.textContent = 'Menampilkan 0 dari 0 data';
        return;
    }
    
    let html = '';
    currentData.slice().reverse().forEach(row => {
        const date = new Date(row.timestamp);
        html += `
            <tr>
                <td>${date.toLocaleString('id-ID')}</td>
                <td>${row.sensor_id || '-'}</td>
                <td>${(row.f1 || 0).toFixed(1)}</td>
                <td>${(row.f2 || 0).toFixed(1)}</td>
                <td>${(row.f3 || 0).toFixed(1)}</td>
                <td>${(row.f4 || 0).toFixed(1)}</td>
                <td>${(row.f5 || 0).toFixed(1)}</td>
                <td>${(row.f6 || 0).toFixed(1)}</td>
                <td>${(row.f7 || 0).toFixed(1)}</td>
                <td>${(row.f8 || 0).toFixed(1)}</td>
                <td>${(row.clear || 0).toFixed(1)}</td>
                <td>${(row.nir || 0).toFixed(1)}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    if (tableInfo) tableInfo.textContent = `Menampilkan ${currentData.length} data`;
}

// ============================================
// Export Function
// ============================================

function exportToCSV() {
    if (currentData.length === 0) {
        showToast('Tidak ada data untuk diexport', 'warning');
        return;
    }
    
    // Headers dengan format yang Excel-friendly
    const headers = ['Timestamp', 'Sensor ID', '415nm', '445nm', '480nm', '515nm', '555nm', '590nm', '630nm', '680nm', 'Clear', '910nm'];
    
    // Gunakan semicolon sebagai delimiter untuk kompatibilitas Excel Indonesia
    const delimiter = ';';
    let csv = headers.join(delimiter) + '\n';
    
    currentData.forEach(row => {
        // Format timestamp yang lebih readable
        const date = new Date(row.timestamp);
        const formattedDate = date.toLocaleString('id-ID', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const values = [
            formattedDate,
            row.sensor_id || '',
            (row.f1 || 0).toFixed(1),
            (row.f2 || 0).toFixed(1),
            (row.f3 || 0).toFixed(1),
            (row.f4 || 0).toFixed(1),
            (row.f5 || 0).toFixed(1),
            (row.f6 || 0).toFixed(1),
            (row.f7 || 0).toFixed(1),
            (row.f8 || 0).toFixed(1),
            (row.clear || 0).toFixed(1),
            (row.nir || 0).toFixed(1)
        ];
        csv += values.join(delimiter) + '\n';
    });
    
    // Tambahkan BOM untuk UTF-8 agar Excel recognize encoding dengan benar
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `cheesense_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Data berhasil diexport!', 'success');
}

// ============================================
// UI Helpers
// ============================================

function setConnectionStatus(connected) {
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

function showLoading(show) {
    const container = document.querySelector('.chart-section');
    if (container) {
        if (show) {
            container.classList.add('loading');
        } else {
            container.classList.remove('loading');
        }
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
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}
