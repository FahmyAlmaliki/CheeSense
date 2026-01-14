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

let trendChart = null;
let comparisonChart = null;
let distributionChart = null;
let currentData = [];
let selectedChannels = 'all';
let chartType = 'line';

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeDateInputs();
    initializeCharts();
    setupEventListeners();
    checkServerStatus();
    loadHistoryData();
});

// ============================================
// Date Input Initialization
// ============================================

function initializeDateInputs() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (startDateInput) {
        startDateInput.value = formatDateForInput(oneHourAgo);
    }
    if (endDateInput) {
        endDateInput.value = formatDateForInput(now);
    }
}

function formatDateForInput(date) {
    return date.toISOString().slice(0, 16);
}

// ============================================
// Chart Initialization
// ============================================

function initializeCharts() {
    initTrendChart();
    initComparisonChart();
    initDistributionChart();
}

function initTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    
    const datasets = Object.keys(CHANNELS).map(key => ({
        label: `${CHANNELS[key].name} (${CHANNELS[key].wavelength})`,
        data: [],
        borderColor: CHANNELS[key].color,
        backgroundColor: CHANNELS[key].color + '20',
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        hidden: !['f5', 'f6', 'f7'].includes(key) // Show only yellow-green, yellow, orange by default
    }));
    
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            animation: {
                duration: CONFIG.ANIMATION_DURATION
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            family: 'Poppins',
                            size: 11
                        },
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#212121',
                    bodyColor: '#757575',
                    borderColor: '#FFC107',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                x: {
                    type: 'category',
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            family: 'Poppins',
                            size: 10
                        },
                        maxRotation: 45,
                        maxTicksLimit: 15
                    }
                },
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
                }
            }
        }
    });
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
    
    // Quick Filter Buttons
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleQuickFilter(e.target));
    });
    
    // Chart Type Buttons
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleChartTypeChange(e.target));
    });
    
    // Channel Select
    const channelSelect = document.getElementById('channelSelect');
    if (channelSelect) {
        channelSelect.addEventListener('change', handleChannelChange);
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

function handleQuickFilter(btn) {
    // Update active state
    document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const range = btn.dataset.range;
    const now = new Date();
    let startDate;
    
    switch (range) {
        case '1h':
            startDate = new Date(now.getTime() - 60 * 60 * 1000);
            break;
        case '6h':
            startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            break;
        case '24h':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(now.getTime() - 60 * 60 * 1000);
    }
    
    document.getElementById('startDate').value = formatDateForInput(startDate);
    document.getElementById('endDate').value = formatDateForInput(now);
    
    loadHistoryData();
}

function handleChartTypeChange(btn) {
    document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    chartType = btn.dataset.type;
    updateTrendChartType();
}

function handleChannelChange() {
    const select = document.getElementById('channelSelect');
    selectedChannels = select.value;
    updateTrendChartVisibility();
}

function resetFilters() {
    initializeDateInputs();
    
    document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.quick-filter-btn[data-range="1h"]').classList.add('active');
    
    const channelSelect = document.getElementById('channelSelect');
    if (channelSelect) {
        channelSelect.value = 'all';
    }
    
    loadHistoryData();
}

// ============================================
// Data Loading
// ============================================

async function loadHistoryData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const limit = document.getElementById('dataLimit').value;
    
    try {
        showLoading(true);
        
        const params = new URLSearchParams({
            start: new Date(startDate).toISOString(),
            end: new Date(endDate).toISOString(),
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
    updateStats();
    updateTrendChart();
    updateComparisonChart();
    updateDistributionChart();
    updateDataTable();
}

function updateStats() {
    const totalDataEl = document.getElementById('totalData');
    const avgValueEl = document.getElementById('avgValue');
    const maxValueEl = document.getElementById('maxValue');
    const minValueEl = document.getElementById('minValue');
    
    if (currentData.length === 0) {
        if (totalDataEl) totalDataEl.textContent = '0';
        if (avgValueEl) avgValueEl.textContent = '-';
        if (maxValueEl) maxValueEl.textContent = '-';
        if (minValueEl) minValueEl.textContent = '-';
        return;
    }
    
    // Calculate statistics for F6 (Yellow - most relevant for cheese)
    const f6Values = currentData.map(d => d.f6 || 0);
    const avg = f6Values.reduce((a, b) => a + b, 0) / f6Values.length;
    const max = Math.max(...f6Values);
    const min = Math.min(...f6Values);
    
    if (totalDataEl) totalDataEl.textContent = currentData.length;
    if (avgValueEl) avgValueEl.textContent = avg.toFixed(2);
    if (maxValueEl) maxValueEl.textContent = max.toFixed(2);
    if (minValueEl) minValueEl.textContent = min.toFixed(2);
}

function updateTrendChart() {
    if (!trendChart || currentData.length === 0) return;
    
    // Prepare labels (timestamps)
    const labels = currentData.map(d => {
        const date = new Date(d.timestamp);
        return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    });
    
    // Update each dataset
    const channelKeys = Object.keys(CHANNELS);
    channelKeys.forEach((key, index) => {
        if (trendChart.data.datasets[index]) {
            trendChart.data.datasets[index].data = currentData.map(d => d[key] || 0);
        }
    });
    
    trendChart.data.labels = labels;
    trendChart.update();
    
    updateTrendChartVisibility();
}

function updateTrendChartType() {
    if (!trendChart) return;
    
    trendChart.config.type = chartType;
    
    // Adjust options based on type
    if (chartType === 'bar') {
        trendChart.data.datasets.forEach(ds => {
            ds.fill = false;
            ds.borderWidth = 1;
        });
    } else {
        trendChart.data.datasets.forEach(ds => {
            ds.fill = false;
            ds.borderWidth = 2;
        });
    }
    
    trendChart.update();
}

function updateTrendChartVisibility() {
    if (!trendChart) return;
    
    const channelKeys = Object.keys(CHANNELS);
    
    if (selectedChannels === 'all') {
        // Show default channels (F5, F6, F7)
        channelKeys.forEach((key, index) => {
            trendChart.data.datasets[index].hidden = !['f5', 'f6', 'f7'].includes(key);
        });
    } else {
        // Show only selected channel
        channelKeys.forEach((key, index) => {
            trendChart.data.datasets[index].hidden = key !== selectedChannels;
        });
    }
    
    trendChart.update();
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
    
    const headers = ['Timestamp', 'Sensor ID', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'Clear', 'NIR'];
    
    let csv = headers.join(',') + '\n';
    
    currentData.forEach(row => {
        const values = [
            new Date(row.timestamp).toISOString(),
            row.sensor_id || '',
            row.f1 || 0,
            row.f2 || 0,
            row.f3 || 0,
            row.f4 || 0,
            row.f5 || 0,
            row.f6 || 0,
            row.f7 || 0,
            row.f8 || 0,
            row.clear || 0,
            row.nir || 0
        ];
        csv += values.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
