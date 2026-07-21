function renderAdminPanel() {
    updateNavigationPermissions();

    // Highlight sidebar tabs
    document.querySelectorAll('#view-admin aside .nav-item').forEach(el => el.classList.remove('active'));
    const activeTabEl = document.getElementById(`tab-${state.adminTab}`);
    if (activeTabEl) activeTabEl.classList.add('active');

    // Toggle panels
    document.querySelectorAll('#view-admin .tab-panel').forEach(p => p.classList.add('hidden'));

    if (state.adminTab === 'dashboard') {
        const panelDash = document.getElementById('panel-dashboard');
        if (panelDash) panelDash.classList.remove('hidden');
        renderDashboardTab();
    } else if (state.adminTab === 'orders') {
        const panelOrd = document.getElementById('panel-orders');
        if (panelOrd) panelOrd.classList.remove('hidden');
        renderOrdersTab();
    } else if (state.adminTab === 'customers') {
        const panelCust = document.getElementById('panel-customers');
        if (panelCust) panelCust.classList.remove('hidden');
        renderCustomersTab();
    } else if (state.adminTab === 'recipes') {
        const panelRec = document.getElementById('panel-recipes');
        if (panelRec) panelRec.classList.remove('hidden');
        renderRecipesTab();
    } else if (state.adminTab === 'users') {
        const panelUsr = document.getElementById('panel-users');
        if (panelUsr) panelUsr.classList.remove('hidden');
        renderUsersTab();
    } else if (state.adminTab === 'scales') {
        const panelScl = document.getElementById('panel-scales');
        if (panelScl) panelScl.classList.remove('hidden');
        renderScalesTab();
    } else if (state.adminTab === 'reports') {
        const panelRep = document.getElementById('panel-reports');
        if (panelRep) panelRep.classList.remove('hidden');
        renderReportsTab();
    } else if (state.adminTab === 'traceability') {
        const panelTrace = document.getElementById('panel-traceability');
        if (panelTrace) panelTrace.classList.remove('hidden');
        renderTraceabilityTab();
    } else if (state.adminTab === 'accounting') {
        const panelAcc = document.getElementById('panel-accounting');
        if (panelAcc) panelAcc.classList.remove('hidden');
        renderAccountingTab();
    } else if (state.adminTab === 'settings') {
        const panelSet = document.getElementById('panel-settings');
        if (panelSet) panelSet.classList.remove('hidden');
        renderSettingsTab();
    }
}

// --- ADMIN TABS DETAIL IMPLEMENTATION ---

// Global chart instances
let chartProdTrendInstance = null;
let chartMixtureDistInstance = null;

// 0. DASHBOARD TAB
function renderDashboardTab() {
    // 1. Clock
    if (!window.dashClockInterval) {
        window.dashClockInterval = setInterval(() => {
            const clockEl = document.getElementById('dash-clock');
            if (clockEl) {
                clockEl.textContent = new Date().toLocaleTimeString('tr-TR');
            }
        }, 1000);
    }
    
    const clockEl = document.getElementById('dash-clock');
    if (clockEl) {
        clockEl.textContent = new Date().toLocaleTimeString('tr-TR');
    }

    // 2. Permissions check for financial card
    const canViewSales = state.currentUser.role === 'admin' || !!state.currentUser.canViewSales;
    const salesCardEl = document.getElementById('dash-sales-card');
    if (salesCardEl) {
        if (canViewSales) {
            salesCardEl.classList.remove('hidden');
        } else {
            salesCardEl.classList.add('hidden');
        }
    }

    // Helper to extract local YYYY-MM-DD
    const getLocalStr = (val) => {
        if (!val) return '';
        const d = new Date(val);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // 3. Compute stats for 4 cards
    const todayStr = getLocalStr(new Date());
    const todayLogs = (state.db.logs || []).filter(log => getLocalStr(log.timestamp) === todayStr && (log.status === 'Başarılı' || log.status === 'success'));
    
    // 3.1 Daily Production Sum (kg) -> WeighingLog actual is in grams
    let totalTodayProdGrams = 0;
    todayLogs.forEach(log => {
        totalTodayProdGrams += (parseFloat(log.actual) || 0);
    });
    const totalTodayProdKg = totalTodayProdGrams / 1000.0;

    const prodStatEl = document.getElementById('dash-stat-prod');
    if (prodStatEl) {
        prodStatEl.textContent = `${totalTodayProdKg.toFixed(2)} kg`;
    }

    // 3.2 Batches status counts
    let pendingReceiptsCount = 0;
    let completedReceiptsCount = 0;
    let activeBatchesCount = 0;

    (state.db.orders || []).forEach(order => {
        if (order.batches) {
            order.batches.forEach(b => {
                const st = (b.status || '').toLowerCase();
                if (st === 'tamamlandı' || st === 'fiş kesildi' || b.receiptPrinted) {
                    completedReceiptsCount++;
                } else if (st === 'fiş kesilmedi' || st === 'bekliyor') {
                    pendingReceiptsCount++;
                } else {
                    activeBatchesCount++;
                }
            });
        }
    });

    const pendingEl = document.getElementById('dash-stat-pending-receipts');
    if (pendingEl) pendingEl.textContent = pendingReceiptsCount;

    const completedEl = document.getElementById('dash-stat-completed-receipts');
    if (completedEl) completedEl.textContent = completedReceiptsCount;

    const activeEl = document.getElementById('dash-stat-active-batches');
    if (activeEl) activeEl.textContent = activeBatchesCount;

    // 4. Render Chart: Son 7 Günlük Üretim Trend (Chart.js)
    const days = [];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(getLocalStr(d));
        labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }

    const prodData = [];
    days.forEach(dayStr => {
        const logsForDay = (state.db.logs || []).filter(log => getLocalStr(log.timestamp) === dayStr && (log.status === 'Başarılı' || log.status === 'success'));
        let dayGrams = 0;
        logsForDay.forEach(log => {
            dayGrams += (parseFloat(log.actual) || 0);
        });
        const dayKg = dayGrams / 1000.0;
        prodData.push(dayKg.toFixed(2));
    });

    const datasets = [
        {
            label: 'Günlük Üretim (kg)',
            data: prodData,
            borderColor: 'rgb(249, 115, 22)', // Orange accent
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            tension: 0.35,
            fill: true
        }
    ];

    const trendCanvas = document.getElementById('chart-production-trend');
    if (trendCanvas) {
        if (chartProdTrendInstance) {
            chartProdTrendInstance.destroy();
        }
        
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#cbd5e1',
                        font: { family: 'Outfit', size: 11 }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(71, 85, 105, 0.15)' },
                    ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(71, 85, 105, 0.15)' },
                    ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } },
                    title: {
                        display: true,
                        text: 'Üretim Hacmi (kg)',
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 10, weight: 'bold' }
                    }
                }
            }
        };

        chartProdTrendInstance = new Chart(trendCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: chartOptions
        });
    }

    // 4.2 Mixture Distribution (Top 5 Recipes)
    const recipeHacim = {};
    state.db.logs.forEach(log => {
        if (log.actual > 0) {
            recipeHacim[log.recipe] = (recipeHacim[log.recipe] || 0) + log.actual;
        }
    });

    const sortedRecipes = Object.entries(recipeHacim)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const distLabels = sortedRecipes.map(entry => entry[0]);
    const distData = sortedRecipes.map(entry => entry[1].toFixed(2));

    const distCanvas = document.getElementById('chart-mixture-distribution');
    if (distCanvas) {
        if (chartMixtureDistInstance) {
            chartMixtureDistInstance.destroy();
        }

        chartMixtureDistInstance = new Chart(distCanvas, {
            type: 'doughnut',
            data: {
                labels: distLabels.length > 0 ? distLabels : ['Kayıt Yok'],
                datasets: [{
                    data: distData.length > 0 ? distData : [100],
                    backgroundColor: distData.length > 0 ? [
                        'rgba(249, 115, 22, 0.8)', // Orange
                        'rgba(14, 165, 233, 0.8)',  // Sky
                        'rgba(168, 85, 247, 0.8)', // Purple
                        'rgba(16, 185, 129, 0.8)', // Emerald
                        'rgba(239, 68, 68, 0.8)'   // Red
                    ] : ['rgba(71, 85, 105, 0.2)'],
                    borderWidth: 2,
                    borderColor: '#0f172a'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#cbd5e1',
                            font: { family: 'Outfit', size: 10 }
                        }
                    }
                }
            }
        });
    }

    // 5. Recent Logs
    const recentLogs = state.db.logs.slice(0, 5);
    const tbody = document.getElementById('dash-recent-logs-body');
    if (tbody) {
        tbody.innerHTML = '';
        if (recentLogs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500">Bugün tartım hareketi bulunmamaktadır.</td></tr>`;
        } else {
            recentLogs.forEach(log => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-900/40 hover:bg-slate-900/20 text-slate-300';
                
                let timeStr = '';
                if (log.timestamp) {
                    const dateObj = new Date(log.timestamp);
                    timeStr = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                }
                
                const badgeClass = log.status === 'Başarılı' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20';

                tr.innerHTML = `
                    <td class="p-3 font-mono text-xs">${timeStr}</td>
                    <td class="p-3 font-semibold text-slate-200">${log.customer || ''}</td>
                    <td class="p-3 text-slate-300">${log.recipe || ''} <span class="text-xs text-slate-500">(${log.item || ''})</span></td>
                    <td class="p-3 font-mono text-slate-400">${((log.targetAmount !== undefined ? log.targetAmount : log.target) || 0).toFixed(2)} kg</td>
                    <td class="p-3 font-mono text-slate-200 font-bold">${((log.actualAmount !== undefined ? log.actualAmount : log.actual) || 0).toFixed(2)} kg</td>
                    <td class="p-3 text-center">
                        <span class="px-2 py-0.5 text-xs font-bold rounded-full border ${badgeClass}">${log.status || ''}</span>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    // 6. Scales Monitor
    const scalesMonitorList = document.getElementById('dash-scales-monitor-list');
    if (scalesMonitorList) {
        scalesMonitorList.innerHTML = '';
        if (state.db.scales.length === 0) {
            scalesMonitorList.innerHTML = `<div class="text-center text-slate-500 py-4 text-sm">Sisteme kayıtlı terazi bulunamadı.</div>`;
        } else {
            state.db.scales.forEach(s => {
                const div = document.createElement('div');
                div.className = 'bg-slate-900/60 p-3 rounded-xl border border-slate-850 flex items-center justify-between';
                
                const statusColor = s.status ? 'bg-green-500' : 'bg-slate-600';
                const statusText = s.status ? 'Aktif' : 'Pasif';
                const statusClass = s.status ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-slate-400 bg-slate-500/10 border-slate-500/20';

                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="w-2.5 h-2.5 rounded-full ${statusColor} ${s.status ? 'animate-pulse' : ''}"></span>
                        <div>
                            <div class="font-bold text-xs text-slate-200">${s.name}</div>
                            <div class="text-[10px] text-slate-500 font-mono">${s.ip}:${s.port} ${s.is_simulator ? '(Simülasör)' : '(Fiziksel)'}</div>
                        </div>
                    </div>
                    <span class="px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusClass}">${statusText}</span>
                `;
                scalesMonitorList.appendChild(div);
            });
        }
    }
}

// 1. ORDERS TAB
function renderOrdersTab() {
    const canManageOrders = state.currentUser.role === 'admin' || !!state.currentUser.canManageOrders;
    const orderCreationCard = document.getElementById('order-creation-card');
    if (orderCreationCard) {
        if (canManageOrders) orderCreationCard.classList.remove('hidden');
        else orderCreationCard.classList.add('hidden');
    }

    // Populate Firms select dropdown
    dom.orderFirmSelect.innerHTML = '<option value="">Firma Seçiniz...</option>';
    state.db.firms.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        if (state.orderSelectedFirmId === f.id) {
            opt.selected = true;
        }
        dom.orderFirmSelect.appendChild(opt);
    });

    // Populate Recipes select dropdown
    dom.orderRecipeSelect.innerHTML = '';
    if (state.orderSelectedFirmId) {
        dom.orderRecipeSelect.disabled = false;
        dom.orderRecipeSelect.innerHTML = '<option value="">Reçete Seçiniz...</option>';
        const recipes = state.db.recipes.filter(r => r.firmId === state.orderSelectedFirmId);
        recipes.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.name;
            dom.orderRecipeSelect.appendChild(opt);
        });
    } else {
        dom.orderRecipeSelect.disabled = true;
        dom.orderRecipeSelect.innerHTML = '<option value="">Önce Firma Seçin...</option>';
    }

    renderActiveJobsListTable();
}

function renderActiveJobsListTable() {
    // Active Jobs List
    dom.activeJobsList.innerHTML = '';
    
    // Flatmap orders and batches
    const flattenedBatches = [];
    state.db.orders.forEach(o => {
        o.batches.forEach(b => {
            flattenedBatches.push({
                customer: o.customer,
                recipeName: o.recipeName,
                no: b.no,
                totalBatches: b.totalBatches,
                targetAmount: b.targetAmount,
                operator: b.operator || '-',
                status: b.status,
                id: b.id
            });
        });
    });

    flattenedBatches.reverse().forEach(b => {
        const tr = document.createElement('tr');
        tr.className = 'border-t border-slate-800 hover:bg-slate-900/20';
        
        let statusBadge = '';
        if (b.status === 'beklemede' || b.status === 'Bekliyor') {
            statusBadge = '<span class="badge-status bekliyor">Beklemede</span>';
        } else if (b.status === 'tartımda' || b.status === 'Üretiliyor') {
            statusBadge = '<span class="badge-status tartimda">Tartımda</span>';
        } else if (b.status === 'mikserde') {
            statusBadge = '<span class="badge-status mikserde">Mikserde</span>';
        } else if (b.status === 'paketlemede') {
            statusBadge = '<span class="badge-status paketlemede">Paketlemede</span>';
        } else if (b.status === 'fiş kesilmedi') {
            statusBadge = '<span class="badge-status fis-kesilmedi">Fiş Kesilmedi</span>';
        } else if (b.status === 'tamamlandı' || b.status === 'Tamamlandı') {
            statusBadge = '<span class="badge-status tamamlandi">Tamamlandı</span>';
        } else {
            statusBadge = `<span class="badge-status bekliyor">${b.status}</span>`;
        }

        const canPrintReceipt = ['fiş kesilmedi', 'tamamlandı', 'Tamamlandı'].includes(b.status);
        const canCancel = ['beklemede', 'Bekliyor', 'tartımda', 'Üretiliyor', 'mikserde', 'paketlemede'].includes(b.status);
        const canManageOrders = state.currentUser.role === 'admin' || !!state.currentUser.canManageOrders;
        
        let actionBtnHtml = '';
        if (canPrintReceipt) {
            actionBtnHtml = `
                <button class="btn btn-emerald-outline py-1 px-3 text-xs rounded btn-print-receipt" data-batch-id="${b.id}">
                    <i data-lucide="printer" class="w-3.5 h-3.5 inline mr-1"></i> Fiş
                </button>
            `;
        } else if (canCancel && canManageOrders) {
            actionBtnHtml = `
                <button class="btn btn-red-outline py-1 px-3 text-xs rounded btn-cancel-batch" data-batch-id="${b.id}">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5 inline mr-1"></i> İptal
                </button>
            `;
        } else {
            actionBtnHtml = '-';
        }

        tr.innerHTML = `
            <td class="p-4 font-bold text-white">${b.customer}</td>
            <td class="p-4 text-slate-300">${b.recipeName}</td>
            <td class="p-4 font-mono text-slate-400">Parti ${b.no}/${b.totalBatches}</td>
            <td class="p-4 font-mono font-bold text-orange-400">${b.targetAmount.toFixed(2)} kg</td>
            <td class="p-4 text-slate-300">${b.operator}</td>
            <td class="p-4">${statusBadge}</td>
            <td class="p-4 text-right">${actionBtnHtml}</td>
        `;
        
        if (canPrintReceipt) {
            tr.querySelector('.btn-print-receipt').addEventListener('click', () => {
                printBatchReceipt(b.id);
            });
        } else if (canCancel && canManageOrders) {
            tr.querySelector('.btn-cancel-batch').addEventListener('click', async () => {
                if (confirm('Bu iş emrini iptal etmek ve tüm ilgili tartım verilerini silmek istediğinize emin misiniz?')) {
                    await cancelBatch(b.id);
                }
            });
        }
        
        dom.activeJobsList.appendChild(tr);
    });

    if (flattenedBatches.length === 0) {
        dom.activeJobsList.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-500 italic">Aktif iş emri bulunmamaktadır.</td></tr>';
    }
}

async function cancelBatch(batchId) {
    try {
        const res = await fetch(`/api/batches/${batchId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            alert('İş emri başarıyla iptal edildi.');
            await fetchDb();
            renderAdminPanel();
        } else {
            alert('Hata: ' + data.message);
        }
    } catch (e) {
        alert('İşlem sırasında bir bağlantı hatası oluştu.');
    }
}

function printBatchReceipt(batchId) {
    const batchLogs = state.db.logs.filter(log => log.batchId === batchId);
    if (batchLogs.length === 0) {
        alert("Bu partiye ait tartım verisi bulunmamaktadır.");
        return;
    }
    
    // Find the batch from state
    let foundBatch = null;
    let foundOrder = null;
    for (const o of state.db.orders) {
        const b = o.batches.find(x => x.id === batchId);
        if (b) {
            foundBatch = b;
            foundOrder = o;
            break;
        }
    }
    
    const firstLog = batchLogs[0];
    const customer = foundOrder ? foundOrder.customer : (firstLog ? firstLog.customer : 'Bilinmeyen Firma');
    const recipeName = foundOrder ? foundOrder.recipeName : (firstLog ? firstLog.recipe : 'Bilinmeyen Reçete');
    const operator = foundBatch ? foundBatch.operator : (firstLog ? firstLog.operator : 'Operatör');
    const batchNo = foundBatch ? foundBatch.no : 1;
    const totalBatches = foundBatch ? foundBatch.totalBatches : 1;
    
    let dateStr = new Date().toLocaleString('tr-TR');
    if (firstLog && firstLog.timestamp) {
        dateStr = new Date(firstLog.timestamp).toLocaleString('tr-TR');
    }

    let rowsHtml = '';
    let totalTarget = 0;
    let totalActual = 0;

    batchLogs.forEach(log => {
        const diff = (log.actual || 0) - (log.target || 0);
        totalTarget += (log.target || 0);
        totalActual += (log.actual || 0);
        
        const badgeText = log.status === 'Başarılı' ? 'TAMAM' : 'HATA';
        const diffText = diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
        
        rowsHtml += `
            <tr>
                <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd;">${log.item}</td>
                <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd; text-align: right; font-family: monospace;">${(log.target || 0).toFixed(2)}</td>
                <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd; text-align: right; font-family: monospace;">${(log.actual || 0).toFixed(2)}</td>
                <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd; text-align: right; font-family: monospace;">${diffText}</td>
                <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd; text-align: center; font-weight: bold;">${badgeText}</td>
            </tr>
        `;
    });

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Üretim Fişi - ${batchId}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                body {
                    font-family: 'Courier Prime', 'Courier New', monospace;
                    color: #000;
                    background: #fff;
                    margin: 0;
                    padding: 20px;
                    font-size: 13px;
                }
                .receipt {
                    max-width: 450px;
                    margin: 0 auto;
                    border: 1px solid #ccc;
                    padding: 15px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 15px;
                    border-bottom: 2px dashed #000;
                    padding-bottom: 10px;
                }
                .title {
                    font-size: 16px;
                    font-weight: bold;
                    margin: 5px 0;
                }
                .meta-table {
                    width: 100%;
                    margin-bottom: 15px;
                }
                .meta-table td {
                    padding: 2px 0;
                }
                .meta-label {
                    font-weight: bold;
                    width: 130px;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                .items-table th {
                    border-bottom: 2px solid #000;
                    padding: 6px 4px;
                    text-align: left;
                }
                .totals {
                    border-top: 2px dashed #000;
                    padding-top: 10px;
                    margin-bottom: 30px;
                }
                .totals-row {
                    display: flex;
                    justify-content: space-between;
                    font-weight: bold;
                    margin-bottom: 4px;
                }
                .signatures {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 40px;
                    border-top: 1px dashed #000;
                    padding-top: 15px;
                }
                .sig-box {
                    width: 45%;
                    text-align: center;
                }
                @media print {
                    body { padding: 0; }
                    .receipt { border: none; max-width: 100%; }
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <div class="title">BAHARAT OTOMASYON</div>
                    <div>ENDÜSTRİYEL TARTIM SİSTEMİ</div>
                    <div style="font-weight: bold; margin-top: 8px;">ÜRETİM PARTİ FİŞİ</div>
                </div>
                
                <table class="meta-table">
                    <tr>
                        <td class="meta-label">Parti No:</td>
                        <td>${batchId}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Müşteri Firma:</td>
                        <td>${customer}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Reçete Adı:</td>
                        <td>${recipeName}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Parti / Döngü:</td>
                        <td>${batchNo} / ${totalBatches}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Operatör Usta:</td>
                        <td>${operator}</td>
                    </tr>
                    <tr>
                        <td class="meta-label">Tarih / Saat:</td>
                        <td>${dateStr}</td>
                    </tr>
                </table>
                
                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width: 30%;">Baharat</th>
                            <th style="width: 18%; text-align: right;">Hedef</th>
                            <th style="width: 18%; text-align: right;">Tartılan</th>
                            <th style="width: 18%; text-align: right;">Fark</th>
                            <th style="width: 16%; text-align: center;">Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                
                <div class="totals">
                    <div class="totals-row">
                        <span>TOPLAM HEDEF HACİM:</span>
                        <span>${totalTarget.toFixed(2)} kg</span>
                    </div>
                    <div class="totals-row">
                        <span>TOPLAM GERÇEKLEŞEN:</span>
                        <span>${totalActual.toFixed(2)} kg</span>
                    </div>
                    <div class="totals-row" style="font-size: 14px; margin-top: 6px;">
                        <span>TOPLAM HATA HACMİ:</span>
                        <span>${(totalActual - totalTarget).toFixed(2)} kg</span>
                    </div>
                </div>
                
                <div class="signatures">
                    <div class="sig-box">
                        <div>OPERATÖR USTA</div>
                        <div style="margin-top: 30px; border-bottom: 1px solid #ccc; height: 10px;"></div>
                        <div style="font-size: 11px; margin-top: 5px; color: #666;">${operator}</div>
                    </div>
                    <div class="sig-box">
                        <div>KALİTE KONTROL</div>
                        <div style="margin-top: 30px; border-bottom: 1px solid #ccc; height: 10px;"></div>
                        <div style="font-size: 11px; margin-top: 5px; color: #666;">İmza</div>
                    </div>
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                }
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();

    // Transition status to 'tamamlandı'
    apiPut(`/api/batches/${batchId}/status`, { status: 'tamamlandı' })
        .then(async () => {
            await fetchDb();
            if (state.view === 'admin') {
                renderAdminPanel();
            }
        })
        .catch(() => {});
}

window.printBatchReceipt = printBatchReceipt;

// 2. RECIPES TAB
function renderRecipesTab() {
    // Hide all sub-levels
    dom.recipeLvlFirms.classList.add('hidden');
    dom.recipeLvlRecipes.classList.add('hidden');
    dom.recipeLvlIngredients.classList.add('hidden');
    
    // Breadcrumb updates
    dom.crumbArrowFirm.classList.add('hidden');
    dom.breadcrumbFirmName.classList.add('hidden');
    dom.crumbArrowRecipe.classList.add('hidden');
    dom.breadcrumbRecipeName.classList.add('hidden');

    if (!state.activeFirmId) {
        // Level 1: Firms Grid
        dom.recipeLvlFirms.classList.remove('hidden');
        
        const canManageRecipes = state.currentUser.role === 'admin' || !!state.currentUser.canManageRecipes;
        const addFirmContainer = document.getElementById('add-firm-container');
        if (addFirmContainer) {
            if (canManageRecipes) addFirmContainer.classList.remove('hidden');
            else addFirmContainer.classList.add('hidden');
        }
        
        dom.firmsGrid.innerHTML = '';
        state.db.firms.forEach(firm => {
            const recipeCount = state.db.recipes.filter(r => r.firmId === firm.id).length;
            const card = document.createElement('div');
            card.className = 'firm-card';
            card.innerHTML = `
                <div class="firm-card-title">${firm.name}</div>
                <div class="firm-card-subtitle">${recipeCount} Ürün / Reçete Tanımlı</div>
            `;
            card.addEventListener('click', () => {
                state.activeFirmId = firm.id;
                state.activeRecipeId = null;
                renderRecipesTab();
            });
            dom.firmsGrid.appendChild(card);
        });
    } else if (state.activeFirmId && !state.activeRecipeId) {
        // Level 2: Recipes list of selected Firm
        dom.recipeLvlRecipes.classList.remove('hidden');
        
        const canManageRecipes = state.currentUser.role === 'admin' || !!state.currentUser.canManageRecipes;
        const addRecipeContainer = document.getElementById('add-recipe-container');
        if (addRecipeContainer) {
            if (canManageRecipes) addRecipeContainer.classList.remove('hidden');
            else addRecipeContainer.classList.add('hidden');
        }
        
        // Setup breadcrumbs
        const firm = state.db.firms.find(f => f.id === state.activeFirmId);
        dom.crumbArrowFirm.classList.remove('hidden');
        dom.breadcrumbFirmName.classList.remove('hidden');
        dom.breadcrumbFirmName.textContent = firm.name;
        
        dom.firmRecipesTitle.textContent = `${firm.name} - Ürün Reçeteleri`;

        // Render recipes rows
        dom.recipesListContainer.innerHTML = '';
        const recipes = state.db.recipes.filter(r => r.firmId === state.activeFirmId);
        
        recipes.forEach(r => {
            const div = document.createElement('div');
            div.className = 'recipe-row';
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <i data-lucide="folder" class="w-5 h-5 text-orange-500"></i>
                    <span class="font-bold text-slate-200 text-lg">${r.name}</span>
                </div>
                <span class="text-sm text-slate-400 font-mono">${r.items.length} Hammadde</span>
            `;
            div.addEventListener('click', () => {
                state.activeRecipeId = r.id;
                renderRecipesTab();
            });
            dom.recipesListContainer.appendChild(div);
        });

        if (recipes.length === 0) {
            dom.recipesListContainer.innerHTML = '<div class="text-slate-500 italic p-4 text-center">Bu firmaya henüz bir ürün tanımlanmamış.</div>';
        }
    } else if (state.activeRecipeId) {
        // Level 3: Ingredients Editor
        dom.recipeLvlIngredients.classList.remove('hidden');

        const canManageRecipes = state.currentUser.role === 'admin' || !!state.currentUser.canManageRecipes;
        const addIngredientContainer = document.getElementById('add-ingredient-container');
        if (addIngredientContainer) {
            if (canManageRecipes) {
                addIngredientContainer.classList.remove('hidden');
                const ingOptions = document.getElementById('ingredient-options');
                if (ingOptions) {
                    ingOptions.innerHTML = '';
                    const allSettings = state.db.settings || [];
                    const settingObj = allSettings.find(s => s.key === 'recipe_order');
                    if (settingObj && settingObj.value) {
                        const orderLines = settingObj.value.split('\n').map(s => s.trim()).filter(Boolean);
                        orderLines.forEach(ing => {
                            const opt = document.createElement('option');
                            opt.value = ing;
                            ingOptions.appendChild(opt);
                        });
                    } else {
                        // Fallback: fetch fresh from server if settings not yet loaded
                        fetch('/api/settings/recipe_order')
                            .then(r => r.ok ? r.json() : null)
                            .then(data => {
                                if (data && data.value) {
                                    data.value.split('\n').map(s => s.trim()).filter(Boolean).forEach(ing => {
                                        const opt = document.createElement('option');
                                        opt.value = ing;
                                        ingOptions.appendChild(opt);
                                    });
                                }
                            }).catch(() => {});
                    }
                }
            }
            else {
                addIngredientContainer.classList.add('hidden');
            }
        }

        const firm = state.db.firms.find(f => f.id === state.activeFirmId);
        const recipe = state.db.recipes.find(r => r.id === state.activeRecipeId);
        
        // Setup breadcrumbs
        dom.crumbArrowFirm.classList.remove('hidden');
        dom.breadcrumbFirmName.classList.remove('hidden');
        dom.breadcrumbFirmName.textContent = firm.name;
        dom.crumbArrowRecipe.classList.remove('hidden');
        dom.breadcrumbRecipeName.classList.remove('hidden');
        dom.breadcrumbRecipeName.textContent = recipe.name;

        dom.recipeIngredientsTitle.textContent = recipe.name;

        // Render ingredients table
        dom.recipeIngredientsList.innerHTML = '';
        recipe.items.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-850 hover:bg-slate-900/10';
            
            const deleteBtnHtml = canManageRecipes 
                ? `<button class="btn-trash" data-item-id="${item.id}" title="Sil"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
                : '-';

            tr.innerHTML = `
                <td class="p-3 font-mono text-slate-500">${index + 1}</td>
                <td class="p-3 font-bold text-slate-200">${item.name}</td>
                <td class="p-3 font-mono font-bold text-blue-400">${item.amount.toFixed(2)} gr</td>
                <td class="p-3 font-mono text-slate-400">± ${item.tolerance.toFixed(2)} gr</td>
                <td class="p-3 text-center">
                    ${deleteBtnHtml}
                </td>
            `;

            if (canManageRecipes) {
                tr.querySelector('.btn-trash').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`"${item.name}" malzemesini silmek istediğinize emin misiniz?`)) {
                        await apiDelete(`/api/recipes/${recipe.id}/items/${item.id}`);
                        await fetchDb();
                        renderRecipesTab();
                    }
                });
            }

            dom.recipeIngredientsList.appendChild(tr);
        });

        if (recipe.items.length === 0) {
            dom.recipeIngredientsList.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-500 italic">Reçete içeriği boş. Lütfen baharat ekleyin.</td></tr>';
        }
    }
    lucide.createIcons();
}

// 3. PERSONNEL TAB
function renderUsersTab() {
    const canManageUsers = state.currentUser.role === 'admin' || !!state.currentUser.canManageUsers;
    const addUserContainer = document.getElementById('add-user-container');
    if (addUserContainer) {
        if (canManageUsers) addUserContainer.classList.remove('hidden');
        else addUserContainer.classList.add('hidden');
    }

    dom.usersListBody.innerHTML = '';
    state.db.users.forEach(u => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-850 hover:bg-slate-900/10';
        
        let roleBadge = '';
        if (u.role === 'admin') {
            roleBadge = '<span class="px-2 py-1 text-xs font-bold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">Birincil Yönetici</span>';
        } else if (u.role === 'manager') {
            roleBadge = '<span class="px-2 py-1 text-xs font-bold rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">Yönetici</span>';
        } else if (u.role === 'secretary') {
            roleBadge = '<span class="px-2 py-1 text-xs font-bold rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">Sekreterya</span>';
        } else {
            roleBadge = '<span class="px-2 py-1 text-xs font-bold rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/20">Operatör</span>';
        }

        const canDeleteThisUser = 
            state.currentUser.role === 'admin' || 
            (state.currentUser.role === 'manager' && u.role !== 'admin' && u.role !== 'manager');

        const deleteButton = (u.role !== 'admin' && canDeleteThisUser)
            ? `<button class="btn-trash btn-delete-user" data-user-id="${u.id}"><i data-lucide="trash-2" class="w-5 h-5"></i></button>`
            : '';

        const canEditThisUser = 
            state.currentUser.role === 'admin' || 
            (state.currentUser.role === 'manager' && u.role !== 'admin' && u.role !== 'manager');

        const perms = [
            { key: 'canManageRecipes', label: 'Reçete' },
            { key: 'canManageCustomers', label: 'Firma' },
            { key: 'canManageOrders', label: 'Sipariş' },
            { key: 'canManageUsers', label: 'Personel' },
            { key: 'canManageScales', label: 'Terazi' },
            { key: 'canViewReports', label: 'Rapor' },
            { key: 'canViewSales', label: 'Satış Bilgisi' }
        ];

        let permsHTML = '';
        if (u.role === 'admin') {
            permsHTML = '<span class="text-xs text-amber-500 font-bold uppercase tracking-wider">TÜM YETKİLER</span>';
        } else if (u.role === 'operator') {
            permsHTML = '<span class="text-xs text-slate-500 font-bold uppercase tracking-wider">YETKİ YOK (Sadece Tartım)</span>';
        } else {
            permsHTML = `<div class="flex flex-wrap gap-1.5">`;
            perms.forEach(p => {
                const val = u[p.key];
                const activeClass = val 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                    : 'bg-slate-900/40 text-slate-500 border-slate-800 hover:bg-slate-800/40';
                const cursorClass = canEditThisUser ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed';
                permsHTML += `
                    <span class="px-2 py-0.5 text-xs font-bold rounded border transition-all ${activeClass} ${cursorClass} btn-toggle-perm" data-perm-key="${p.key}">
                        ${p.label}
                    </span>
                `;
            });
            permsHTML += `</div>`;
        }

        tr.innerHTML = `
            <td class="p-4 font-bold text-slate-200">${u.name}</td>
            <td class="p-4">${roleBadge}</td>
            <td class="p-4 font-mono text-slate-400">${u.pass}</td>
            <td class="p-4">${permsHTML}</td>
            <td class="p-4 text-center">${deleteButton}</td>
        `;

        if (u.role !== 'admin' && canDeleteThisUser) {
            tr.querySelector('.btn-delete-user').addEventListener('click', async () => {
                if (confirm(`"${u.name}" isimli ustayı sistemden silmek istediğinize emin misiniz?`)) {
                    await apiDelete(`/api/users/${u.id}`);
                    await fetchDb();
                    renderUsersTab();
                }
            });
        }

        if (u.role !== 'admin' && u.role !== 'operator' && canEditThisUser) {
            tr.querySelectorAll('.btn-toggle-perm').forEach(el => {
                el.addEventListener('click', async () => {
                    const key = el.getAttribute('data-perm-key');
                    const newVal = !u[key];
                    try {
                        await apiPut(`/api/users/${u.id}/permissions`, {
                            [key]: newVal
                        });
                        await fetchDb();
                        renderUsersTab();
                    } catch (e) {
                        alert('Yetki güncellenemedi: ' + e.message);
                    }
                });
            });
        }

        dom.usersListBody.appendChild(tr);
    });
    lucide.createIcons();
}

// 4. SCALES TAB
function renderScalesTab() {
    const canManageScales = state.currentUser.role === 'admin' || !!state.currentUser.canManageScales;
    const addScaleContainer = document.getElementById('add-scale-container');
    if (addScaleContainer) {
        if (canManageScales) addScaleContainer.classList.remove('hidden');
        else addScaleContainer.classList.add('hidden');
    }

    const scalesGridSettings = document.getElementById('scales-grid-settings');
    const grids = [dom.scalesGrid, scalesGridSettings].filter(Boolean);
    grids.forEach(g => g.innerHTML = '');

    state.db.scales.forEach(s => {
        grids.forEach(grid => {
            const card = document.createElement('div');
            card.className = 'scale-card relative p-5 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between';
            
            const typeBadge = s.is_simulator 
                ? `<span class="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">Simülasyon</span>`
                : `<span class="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20">Fiziksel</span>`;

            const connText = s.connection_type === 'remote' ? 'Kablosuz' : 'Kablolu';
            const formatText = s.data_format === 'densi' ? 'Densi' : 'Sayısal';
            const iconBadge = s.connection_type === 'remote' ? '<i data-lucide="wifi" class="w-3 h-3"></i>' : '<i data-lucide="ethernet-port" class="w-3 h-3"></i>';

            const deleteButtonHtml = canManageScales
                ? `<button class="btn-trash absolute top-4 right-4 btn-delete-scale text-slate-500 hover:text-red-400 transition-colors" data-scale-id="${s.id}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
                : '';

            card.innerHTML = `
                <div>
                    <div class="flex items-center gap-2 mb-2">
                        <span class="font-bold text-lg text-slate-200">${s.name}</span>
                        ${typeBadge}
                    </div>
                    <div class="flex items-center gap-2 mt-1 mb-2">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 uppercase flex items-center gap-1">
                            ${iconBadge} ${connText}
                        </span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-900/30 text-orange-400 border border-orange-500/20 uppercase flex items-center gap-1">
                            <i data-lucide="file-code-2" class="w-3 h-3"></i> ${formatText}
                        </span>
                    </div>
                    <div class="text-xs text-slate-450 font-mono mb-3">${s.ip}:${s.port}</div>
                    <div class="bg-slate-950/80 p-3 rounded-lg font-mono text-xs text-slate-400 border border-slate-850 flex items-center justify-between mb-4">
                        <span>Terazi Verisi:</span>
                        <span class="text-orange-400 font-bold" id="live-card-val-${s.id}">ST,GS,+ 0.00gr</span>
                    </div>
                </div>
                
                <div class="flex items-center gap-4">
                    <button class="btn btn-slate-outline py-1.5 px-3 text-xs font-bold btn-test-scale" data-scale-id="${s.id}">
                        Bağlantıyı Test Et
                    </button>
                    <span class="text-xs font-mono font-bold" id="test-status-${s.id}"></span>
                </div>

                ${deleteButtonHtml}
            `;

            card.querySelector('.btn-test-scale').addEventListener('click', async () => {
                const statusEl = card.querySelector(`#test-status-${s.id}`);
                if (statusEl) {
                    statusEl.textContent = 'Test ediliyor...';
                    statusEl.className = 'text-xs font-mono text-slate-450';
                }
                try {
                    let testSuccess = false;
                    let nativeMessage = '';
                    if (s.is_simulator) {
                        const simulatorUrl = `http://${s.ip}:${s.port}/api/status`;
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 2000);
                        const res = await fetch(simulatorUrl, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        testSuccess = res.ok;
                    } else if (window.ReactNativeWebView) {
                        const nativeRes = await window.testNativeConnection(s.ip, s.port);
                        testSuccess = nativeRes.success;
                        nativeMessage = nativeRes.message || '';
                    } else {
                        const res = await apiPost('/api/scales/test-connection', {
                            ip: s.ip,
                            port: s.port,
                            is_simulator: s.is_simulator
                        });
                        testSuccess = res.success;
                        nativeMessage = res.message || '';
                    }

                    if (statusEl) {
                        if (testSuccess) {
                            statusEl.textContent = 'ONLINE';
                            statusEl.className = 'text-xs font-bold font-mono text-green-400';
                        } else {
                            statusEl.textContent = 'OFFLINE' + (nativeMessage ? ` (${nativeMessage})` : '');
                            statusEl.className = 'text-xs font-bold font-mono text-red-400';
                        }
                    }
                } catch (e) {
                    if (statusEl) {
                        statusEl.textContent = 'OFFLINE (Hata)';
                        statusEl.className = 'text-xs font-bold font-mono text-red-400';
                    }
                }
            });

            if (canManageScales) {
                const btnDelete = card.querySelector('.btn-delete-scale');
                if (btnDelete) {
                    btnDelete.addEventListener('click', async () => {
                        if (confirm(`"${s.name}" terazisini silmek istediğinize emin misiniz?`)) {
                            await deleteScale(s.id);
                        }
                    });
                }
            }

            grid.appendChild(card);
        });
    });
    if (window.lucide) window.lucide.createIcons();
}

// 5. REPORTS TAB IMPLEMENTATION
let currentReportCategory = 'production';
let isReportChartsVisible = false;
let chartReportMainInstance = null;
let chartReportDistInstance = null;

function initReportsEventListeners() {
    const btnProd = document.getElementById('btn-rpt-prod');
    const btnAcc = document.getElementById('btn-rpt-acc');
    const btnOp = document.getElementById('btn-rpt-op');
    const btnLogs = document.getElementById('btn-rpt-logs');

    if (btnProd && !btnProd.getAttribute('data-bound')) {
        const tabs = [btnProd, btnAcc, btnOp, btnLogs].filter(Boolean);
        tabs.forEach(btn => {
            btn.setAttribute('data-bound', 'true');
            btn.addEventListener('click', () => {
                if (btn === btnProd) currentReportCategory = 'production';
                else if (btn === btnAcc) currentReportCategory = 'accounting';
                else if (btn === btnOp) currentReportCategory = 'operator';
                else if (btn === btnLogs) currentReportCategory = 'logs';
                renderReportsTab();
            });
        });

        // Filter Inputs Event Bindings
        const bindInput = (id, key, evt = 'change') => {
            const el = document.getElementById(id);
            if (el && !el.getAttribute('data-bound')) {
                el.setAttribute('data-bound', 'true');
                el.addEventListener(evt, (e) => {
                    state.filters[key] = e.target.value;
                    renderReportsTab();
                });
            }
        };

        bindInput('filter-start-date', 'startDate');
        bindInput('filter-end-date', 'endDate');
        bindInput('filter-firm', 'firm');
        bindInput('filter-recipe', 'recipe');
        bindInput('filter-operator', 'operator');
        bindInput('filter-search', 'search', 'input');

        // Clear Filters
        const btnClear = document.getElementById('btn-clear-filters');
        if (btnClear && !btnClear.getAttribute('data-bound')) {
            btnClear.setAttribute('data-bound', 'true');
            btnClear.addEventListener('click', () => {
                state.filters = { startDate: '', endDate: '', firm: '', recipe: '', operator: '', search: '' };
                const startEl = document.getElementById('filter-start-date');
                const endEl = document.getElementById('filter-end-date');
                const firmEl = document.getElementById('filter-firm');
                const recipeEl = document.getElementById('filter-recipe');
                const opEl = document.getElementById('filter-operator');
                const searchEl = document.getElementById('filter-search');

                if (startEl) startEl.value = '';
                if (endEl) endEl.value = '';
                if (firmEl) firmEl.value = '';
                if (recipeEl) recipeEl.value = '';
                if (opEl) opEl.value = '';
                if (searchEl) searchEl.value = '';

                renderReportsTab();
            });
        }

        // Quick date buttons
        document.querySelectorAll('.btn-quick-date').forEach(btn => {
            if (btn.getAttribute('data-bound')) return;
            btn.setAttribute('data-bound', 'true');
            btn.addEventListener('click', () => {
                const range = btn.getAttribute('data-range');
                const now = new Date();
                const startEl = document.getElementById('filter-start-date');
                const endEl = document.getElementById('filter-end-date');

                const formatDateInput = (d) => {
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                };

                if (range === 'today') {
                    if (startEl) startEl.value = formatDateInput(now);
                    if (endEl) endEl.value = formatDateInput(now);
                } else if (range === 'yesterday') {
                    const yest = new Date();
                    yest.setDate(yest.getDate() - 1);
                    if (startEl) startEl.value = formatDateInput(yest);
                    if (endEl) endEl.value = formatDateInput(yest);
                } else if (range === 'week') {
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 6);
                    if (startEl) startEl.value = formatDateInput(weekAgo);
                    if (endEl) endEl.value = formatDateInput(now);
                } else if (range === 'month') {
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    if (startEl) startEl.value = formatDateInput(monthStart);
                    if (endEl) endEl.value = formatDateInput(now);
                } else if (range === 'all') {
                    if (startEl) startEl.value = '';
                    if (endEl) endEl.value = '';
                }

                state.filters.startDate = startEl ? startEl.value : '';
                state.filters.endDate = endEl ? endEl.value : '';
                renderReportsTab();
            });
        });

        // Toggle Charts
        const btnToggleCharts = document.getElementById('btn-toggle-report-charts');
        if (btnToggleCharts && !btnToggleCharts.getAttribute('data-bound')) {
            btnToggleCharts.setAttribute('data-bound', 'true');
            btnToggleCharts.addEventListener('click', () => {
                isReportChartsVisible = !isReportChartsVisible;
                const wrapper = document.getElementById('report-charts-wrapper');
                if (wrapper) {
                    if (isReportChartsVisible) wrapper.classList.remove('hidden');
                    else wrapper.classList.add('hidden');
                }
                renderReportsTab();
            });
        }

        // CSV Export & Print
        const btnExportCsv = document.getElementById('btn-export-report-csv');
        if (btnExportCsv && !btnExportCsv.getAttribute('data-bound')) {
            btnExportCsv.setAttribute('data-bound', 'true');
            btnExportCsv.addEventListener('click', exportReportToCSV);
        }

        const btnPrint = document.getElementById('btn-print-report');
        if (btnPrint && !btnPrint.getAttribute('data-bound')) {
            btnPrint.setAttribute('data-bound', 'true');
            btnPrint.addEventListener('click', () => window.print());
        }
    }
}

function renderReportsTab() {
    initReportsEventListeners();

    if (!state.filters) {
        state.filters = { startDate: '', endDate: '', firm: '', recipe: '', operator: '', search: '' };
    }

    // 1. Update Sub-Tab Buttons Visual Active States
    const btnProd = document.getElementById('btn-rpt-prod');
    const btnAcc = document.getElementById('btn-rpt-acc');
    const btnOp = document.getElementById('btn-rpt-op');
    const btnLogs = document.getElementById('btn-rpt-logs');

    [btnProd, btnAcc, btnOp, btnLogs].forEach(b => {
        if (!b) return;
        b.className = 'btn-rpt-tab btn btn-slate py-2 px-4 text-xs font-bold rounded-lg flex items-center gap-2 transition-all';
    });
    if (currentReportCategory === 'production' && btnProd) btnProd.className = 'btn-rpt-tab active btn btn-orange py-2 px-4 text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-orange-950/20';
    else if (currentReportCategory === 'accounting' && btnAcc) btnAcc.className = 'btn-rpt-tab active btn btn-orange py-2 px-4 text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-orange-950/20';
    else if (currentReportCategory === 'operator' && btnOp) btnOp.className = 'btn-rpt-tab active btn btn-orange py-2 px-4 text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-orange-950/20';
    else if (currentReportCategory === 'logs' && btnLogs) btnLogs.className = 'btn-rpt-tab active btn btn-orange py-2 px-4 text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-orange-950/20';

    const logs = state.db.logs || [];
    const orders = state.db.orders || [];

    // 2. Populate Dropdowns cleanly
    const operators = [...new Set(logs.map(l => l.operator).concat(orders.flatMap(o => (o.batches || []).map(b => b.operator))).filter(Boolean))];
    const firms = [...new Set(logs.map(l => l.customer).concat(orders.map(o => o.customer || o.firm_name)).filter(Boolean))];
    const recipes = [...new Set(logs.map(l => l.recipe).concat(orders.map(o => o.recipeName || o.recipe_name)).filter(Boolean))];

    const fillSelectOptions = (selectEl, options, activeVal, placeholder) => {
        if (!selectEl) return;
        selectEl.innerHTML = `<option value="">${placeholder}</option>`;
        options.forEach(optVal => {
            const opt = document.createElement('option');
            opt.value = optVal;
            opt.textContent = optVal;
            if (optVal === activeVal) opt.selected = true;
            selectEl.appendChild(opt);
        });
        selectEl.value = activeVal || '';
    };

    fillSelectOptions(document.getElementById('filter-firm') || dom.filterFirm, firms, state.filters.firm || '', 'Tüm Müşteriler');
    fillSelectOptions(document.getElementById('filter-recipe') || dom.filterRecipe, recipes, state.filters.recipe || '', 'Tüm Reçeteler');
    fillSelectOptions(document.getElementById('filter-operator') || dom.filterOperator, operators, state.filters.operator || '', 'Tüm Operatörler');

    // Sync inputs to DOM
    const startEl = document.getElementById('filter-start-date');
    const endEl = document.getElementById('filter-end-date');
    const searchEl = document.getElementById('filter-search');
    if (startEl) startEl.value = state.filters.startDate || '';
    if (endEl) endEl.value = state.filters.endDate || '';
    if (searchEl) searchEl.value = state.filters.search || '';

    // 3. Extract Filter Criteria directly from state.filters
    const startDateStr = state.filters.startDate || '';
    const endDateStr = state.filters.endDate || '';
    const selectedFirm = state.filters.firm || '';
    const selectedRecipe = state.filters.recipe || '';
    const selectedOperator = state.filters.operator || '';
    const searchTerm = (state.filters.search || '').toLowerCase().trim();

    const getLocalStr = (val) => {
        if (!val) return '';
        const d = new Date(val);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Filter Logs
    const filteredLogs = logs.filter(l => {
        const logDateStr = getLocalStr(l.timestamp);
        const dateMatch = (!startDateStr || logDateStr >= startDateStr) && (!endDateStr || logDateStr <= endDateStr);
        const firmMatch = !selectedFirm || l.customer === selectedFirm;
        const recipeMatch = !selectedRecipe || l.recipe === selectedRecipe;
        const opMatch = !selectedOperator || l.operator === selectedOperator;
        const searchMatch = !searchTerm || 
            (l.customer || '').toLowerCase().includes(searchTerm) ||
            (l.recipe || '').toLowerCase().includes(searchTerm) ||
            (l.operator || '').toLowerCase().includes(searchTerm) ||
            (l.item || '').toLowerCase().includes(searchTerm);

        return dateMatch && firmMatch && recipeMatch && opMatch && searchMatch;
    });

    // Filter Orders / Batches
    let filteredBatches = [];
    orders.forEach(o => {
        (o.batches || []).forEach(b => {
            const bDateStr = getLocalStr(b.completed_at || b.created_at || o.created_at);
            const dateMatch = (!startDateStr || bDateStr >= startDateStr) && (!endDateStr || bDateStr <= endDateStr);
            const customer = o.customer || o.firm_name || 'Bilinmeyen Müşteri';
            const recipe = o.recipeName || o.recipe_name || 'Standart Reçete';
            const operator = b.operator || b.operator_name || 'Usta';

            const firmMatch = !selectedFirm || customer === selectedFirm;
            const recipeMatch = !selectedRecipe || recipe === selectedRecipe;
            const opMatch = !selectedOperator || operator === selectedOperator;
            const code = b.batch_code || `PRT-${b.id}`;

            const searchMatch = !searchTerm ||
                code.toLowerCase().includes(searchTerm) ||
                customer.toLowerCase().includes(searchTerm) ||
                recipe.toLowerCase().includes(searchTerm) ||
                operator.toLowerCase().includes(searchTerm);

            if (dateMatch && firmMatch && recipeMatch && opMatch && searchMatch) {
                filteredBatches.push({
                    id: b.id,
                    orderId: o.id,
                    code: code,
                    customer: customer,
                    recipe: recipe,
                    operator: operator,
                    weight: b.targetAmount || b.actual_total_weight || b.total_target_weight || 0,
                    status: b.status || 'bekliyor',
                    timestamp: b.completed_at || b.created_at || new Date().toISOString(),
                    receiptPrinted: b.receiptPrinted,
                    rawBatch: b
                });
            }
        });
    });

    const recordCountEl = document.getElementById('reports-record-count');
    if (recordCountEl) {
        if (currentReportCategory === 'accounting') recordCountEl.textContent = `${filteredBatches.length} Parti / Fiş Bulundu`;
        else recordCountEl.textContent = `${filteredLogs.length} Tartım Logu Bulundu`;
    }

    // UPDATE KPI CARDS ACCORDING TO CATEGORY
    const kpiTitle1 = document.getElementById('rpt-kpi-title-1');
    const kpiVal1 = document.getElementById('rpt-kpi-val-1');
    const kpiSub1 = document.getElementById('rpt-kpi-sub-1');

    const kpiTitle2 = document.getElementById('rpt-kpi-title-2');
    const kpiVal2 = document.getElementById('rpt-kpi-val-2');
    const kpiSub2 = document.getElementById('rpt-kpi-sub-2');

    const kpiTitle3 = document.getElementById('rpt-kpi-title-3');
    const kpiVal3 = document.getElementById('rpt-kpi-val-3');
    const kpiSub3 = document.getElementById('rpt-kpi-sub-3');

    const kpiTitle4 = document.getElementById('rpt-kpi-title-4');
    const kpiVal4 = document.getElementById('rpt-kpi-val-4');
    const kpiSub4 = document.getElementById('rpt-kpi-sub-4');

    const totalGramsWeighed = filteredLogs.reduce((sum, l) => sum + (l.status === 'Başarılı' || l.status === 'success' ? (parseFloat(l.actual) || 0) : 0), 0);
    const totalKgWeighed = totalGramsWeighed / 1000.0;
    const totalSuccessfulLogs = filteredLogs.filter(l => l.status === 'Başarılı' || l.status === 'success').length;
    const accuracyRate = filteredLogs.length > 0 ? ((totalSuccessfulLogs / filteredLogs.length) * 100).toFixed(1) : '100.0';

    if (currentReportCategory === 'production') {
        if (kpiTitle1) kpiTitle1.textContent = 'Toplam Üretim (kg)';
        if (kpiVal1) kpiVal1.textContent = `${totalKgWeighed.toFixed(2)} kg`;
        if (kpiSub1) kpiSub1.textContent = 'Tartılan net ham madde hacmi';

        const completedCount = filteredBatches.filter(b => b.status === 'tamamlandı' || b.status === 'Tamamlandı' || b.status === 'fiş kesildi' || b.receiptPrinted).length;
        if (kpiTitle2) kpiTitle2.textContent = 'Tamamlanan Partiler';
        if (kpiVal2) kpiVal2.textContent = completedCount;
        if (kpiSub2) kpiSub2.textContent = 'Üretimi biten parti sayısı';

        const activeRecipesCount = new Set(filteredLogs.map(l => l.recipe)).size;
        if (kpiTitle3) kpiTitle3.textContent = 'İşlenen Reçeteler';
        if (kpiVal3) kpiVal3.textContent = activeRecipesCount;
        if (kpiSub3) kpiSub3.textContent = 'Filtredeki reçete çeşit sayısı';

        if (kpiTitle4) kpiTitle4.textContent = 'Tartım Başarı Oranı';
        if (kpiVal4) kpiVal4.textContent = `%${accuracyRate}`;
        if (kpiSub4) kpiSub4.textContent = 'Tolerans içi doğru tartım %';

    } else if (currentReportCategory === 'accounting') {
        const completedSlips = filteredBatches.filter(b => b.status === 'tamamlandı' || b.status === 'Tamamlandı' || b.status === 'fiş kesildi' || b.receiptPrinted);
        const pendingSlips = filteredBatches.filter(b => !completedSlips.includes(b));
        
        let completedWeightKg = completedSlips.reduce((sum, b) => {
            let w = parseFloat(b.weight) || 0;
            if (w > 10000) w = w / 1000.0;
            return sum + w;
        }, 0);

        if (kpiTitle1) kpiTitle1.textContent = 'Kesilen Fiş Hacmi';
        if (kpiVal1) kpiVal1.textContent = `${completedWeightKg.toFixed(2)} kg`;
        if (kpiSub1) kpiSub1.textContent = 'Fişi kesilen toplam parti ağırlığı';

        if (kpiTitle2) kpiTitle2.textContent = 'Kesilen Fişler';
        if (kpiVal2) kpiVal2.textContent = completedSlips.length;
        if (kpiSub2) kpiSub2.textContent = 'Tamamlanan fiş adedi';

        if (kpiTitle3) kpiTitle3.textContent = 'Kesilmeyen Fişler';
        if (kpiVal3) kpiVal3.textContent = pendingSlips.length;
        if (kpiSub3) kpiSub3.textContent = 'Bekleyen parti adedi';

        if (kpiTitle4) kpiTitle4.textContent = 'Toplam İş Emri';
        if (kpiVal4) kpiVal4.textContent = filteredBatches.length;
        if (kpiSub4) kpiSub4.textContent = 'Filtrelenen tüm partiler';

    } else if (currentReportCategory === 'operator') {
        const uniqueOperatorsCount = new Set(filteredLogs.map(l => l.operator).filter(Boolean)).size;

        if (kpiTitle1) kpiTitle1.textContent = 'Aktif Operatörler';
        if (kpiVal1) kpiVal1.textContent = uniqueOperatorsCount;
        if (kpiSub1) kpiSub1.textContent = 'Tartım yapan usta sayısı';

        if (kpiTitle2) kpiTitle2.textContent = 'Toplam Tartım Adedi';
        if (kpiVal2) kpiVal2.textContent = filteredLogs.length;
        if (kpiSub2) kpiSub2.textContent = 'Operatörlerin yaptığı işlem';

        if (kpiTitle3) kpiTitle3.textContent = 'Tartılan Hacim (kg)';
        if (kpiVal3) kpiVal3.textContent = `${totalKgWeighed.toFixed(2)} kg`;
        if (kpiSub3) kpiSub3.textContent = 'Operatörlerin tarttığı kg';

        if (kpiTitle4) kpiTitle4.textContent = 'Ort. Verimlilik / Başarı';
        if (kpiVal4) kpiVal4.textContent = `%${accuracyRate}`;
        if (kpiSub4) kpiSub4.textContent = 'Doğru tartım oranı';

    } else {
        if (kpiTitle1) kpiTitle1.textContent = 'Toplam Log Kaydı';
        if (kpiVal1) kpiVal1.textContent = filteredLogs.length;
        if (kpiSub1) kpiSub1.textContent = 'Tüm ham tartım kayıtları';

        if (kpiTitle2) kpiTitle2.textContent = 'Başarılı İşlemler';
        if (kpiVal2) kpiVal2.textContent = totalSuccessfulLogs;
        if (kpiSub2) kpiSub2.textContent = 'Hatasız gerçekleşenler';

        const failedLogsCount = filteredLogs.length - totalSuccessfulLogs;
        if (kpiTitle3) kpiTitle3.textContent = 'İptal / Hatalı';
        if (kpiVal3) kpiVal3.textContent = failedLogsCount;
        if (kpiSub3) kpiSub3.textContent = 'Tolerans dışı veya iptal';

        if (kpiTitle4) kpiTitle4.textContent = 'Toplam Üretim (kg)';
        if (kpiVal4) kpiVal4.textContent = `${totalKgWeighed.toFixed(2)} kg`;
        if (kpiSub4) kpiSub4.textContent = 'Net üretilen toplam ağırlık';
    }

    // 4. RENDER CHARTS IF VISIBLE
    if (isReportChartsVisible && window.Chart) {
        const canvasMain = document.getElementById('chart-report-main');
        const canvasDist = document.getElementById('chart-report-dist');

        if (canvasMain) {
            if (chartReportMainInstance) chartReportMainInstance.destroy();

            const dateMap = {};
            filteredLogs.forEach(l => {
                if (l.status === 'Başarılı' || l.status === 'success') {
                    const dStr = getLocalStr(l.timestamp);
                    dateMap[dStr] = (dateMap[dStr] || 0) + ((parseFloat(l.actual) || 0) / 1000.0);
                }
            });
            const mainLabels = Object.keys(dateMap).sort();
            const mainData = mainLabels.map(d => dateMap[d].toFixed(2));

            chartReportMainInstance = new Chart(canvasMain, {
                type: 'line',
                data: {
                    labels: mainLabels.length > 0 ? mainLabels : ['Veri Yok'],
                    datasets: [{
                        label: 'Üretim Hacmi (kg)',
                        data: mainData.length > 0 ? mainData : [0],
                        borderColor: '#ea580c',
                        backgroundColor: 'rgba(234, 88, 12, 0.2)',
                        borderWidth: 2,
                        tension: 0.35,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#cbd5e1', font: { family: 'Outfit', size: 11 } } } },
                    scales: {
                        x: { grid: { color: 'rgba(71, 85, 105, 0.15)' }, ticks: { color: '#94a3b8' } },
                        y: { grid: { color: 'rgba(71, 85, 105, 0.15)' }, ticks: { color: '#94a3b8' } }
                    }
                }
            });
        }

        if (canvasDist) {
            if (chartReportDistInstance) chartReportDistInstance.destroy();

            const distMap = {};
            if (currentReportCategory === 'operator') {
                filteredLogs.forEach(l => {
                    const op = l.operator || 'Bilinmeyen Usta';
                    distMap[op] = (distMap[op] || 0) + ((parseFloat(l.actual) || 0) / 1000.0);
                });
            } else {
                filteredLogs.forEach(l => {
                    const rec = l.recipe || 'Standart Reçete';
                    distMap[rec] = (distMap[rec] || 0) + ((parseFloat(l.actual) || 0) / 1000.0);
                });
            }

            const distLabels = Object.keys(distMap);
            const distData = distLabels.map(k => distMap[k].toFixed(2));

            chartReportDistInstance = new Chart(canvasDist, {
                type: 'bar',
                data: {
                    labels: distLabels.length > 0 ? distLabels : ['Veri Yok'],
                    datasets: [{
                        label: currentReportCategory === 'operator' ? 'Operatör Hacmi (kg)' : 'Reçete Dağılımı (kg)',
                        data: distData.length > 0 ? distData : [0],
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'],
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#cbd5e1', font: { family: 'Outfit', size: 11 } } } },
                    scales: {
                        x: { grid: { color: 'rgba(71, 85, 105, 0.15)' }, ticks: { color: '#94a3b8' } },
                        y: { grid: { color: 'rgba(71, 85, 105, 0.15)' }, ticks: { color: '#94a3b8' } }
                    }
                }
            });
        }
    }

    // 5. RENDER DYNAMIC TABLE
    const tableHead = document.getElementById('reports-table-head');
    const tableBody = document.getElementById('reports-table-body');

    if (!tableHead || !tableBody) return;

    if (currentReportCategory === 'accounting') {
        tableHead.innerHTML = `
            <tr>
                <th class="p-3">Parti Kodu</th>
                <th class="p-3">Müşteri Firma</th>
                <th class="p-3">Reçete / Ürün</th>
                <th class="p-3">Usta Operatör</th>
                <th class="p-3 font-mono">Parti Ağırlığı</th>
                <th class="p-3">Tamamlanma Tarihi</th>
                <th class="p-3 text-center">Fiş Durumu</th>
                <th class="p-3 text-right">İşlemler</th>
            </tr>
        `;

        if (filteredBatches.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500 italic">Kriterlere uygun muhasebe / fiş kaydı bulunamadı.</td></tr>`;
            return;
        }

        tableBody.innerHTML = filteredBatches.map(b => {
            const isCompleted = b.status === 'tamamlandı' || b.status === 'Tamamlandı' || b.status === 'fiş kesildi' || b.receiptPrinted;
            const statusBadge = isCompleted
                ? `<span class="px-2.5 py-1 text-[10px] font-bold font-mono rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Fiş Kesildi</span>`
                : `<span class="px-2.5 py-1 text-[10px] font-bold font-mono rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">Fiş Kesilmedi</span>`;

            let dateStr = '-';
            try {
                dateStr = new Date(b.timestamp).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
            } catch (e) {}

            let weightVal = parseFloat(b.weight) || 0;
            if (weightVal > 10000) weightVal = weightVal / 1000.0;
            const weightStr = `${weightVal.toFixed(2)} kg`;

            return `
                <tr class="border-b border-slate-850 hover:bg-slate-900/40 text-slate-300">
                    <td class="p-3 font-mono font-bold text-orange-400">${b.code}</td>
                    <td class="p-3 font-bold text-white">${b.customer}</td>
                    <td class="p-3 text-slate-300">${b.recipe}</td>
                    <td class="p-3 text-slate-300">${b.operator}</td>
                    <td class="p-3 font-mono font-bold text-slate-200">${weightStr}</td>
                    <td class="p-3 text-slate-400 font-mono text-[11px]">${dateStr}</td>
                    <td class="p-3 text-center">${statusBadge}</td>
                    <td class="p-3 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                            <button onclick="window.printBatchReceiptDirect('${b.id}')" class="btn btn-slate py-1 px-2 text-[11px] font-bold rounded-lg border border-slate-700 flex items-center gap-1">
                                <i data-lucide="printer" class="w-3 h-3 text-slate-400"></i> Fiş Yazdır
                            </button>
                            <button onclick="window.toggleBatchAccountingStatus('${b.id}', ${!isCompleted})" class="btn ${isCompleted ? 'btn-slate' : 'btn-emerald'} py-1 px-2 text-[11px] font-bold rounded-lg flex items-center gap-1">
                                ${isCompleted ? 'Beklemeye Al' : 'Fiş Kes'}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } else if (currentReportCategory === 'operator') {
        tableHead.innerHTML = `
            <tr>
                <th class="p-3">Operatör Usta</th>
                <th class="p-3 text-center">Toplam Tartım Adedi</th>
                <th class="p-3 text-center">Başarılı Tartım</th>
                <th class="p-3 text-center">Tolerans Dışı</th>
                <th class="p-3 text-center font-mono">Toplam Tartılan (kg)</th>
                <th class="p-3 text-center">Başarı Oranı</th>
            </tr>
        `;

        const opMap = {};
        filteredLogs.forEach(l => {
            const op = l.operator || 'Bilinmeyen Usta';
            if (!opMap[op]) opMap[op] = { total: 0, success: 0, failed: 0, grams: 0 };
            opMap[op].total++;
            if (l.status === 'Başarılı' || l.status === 'success') {
                opMap[op].success++;
                opMap[op].grams += (parseFloat(l.actual) || 0);
            } else {
                opMap[op].failed++;
            }
        });

        const opRows = Object.entries(opMap);
        if (opRows.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 italic">Kriterlere uygun operatör verisi bulunamadı.</td></tr>`;
            return;
        }

        tableBody.innerHTML = opRows.map(([opName, data]) => {
            const kg = (data.grams / 1000.0).toFixed(2);
            const rate = ((data.success / data.total) * 100).toFixed(1);
            return `
                <tr class="border-b border-slate-850 hover:bg-slate-900/40 text-slate-300">
                    <td class="p-3 font-bold text-white flex items-center gap-2">
                        <i data-lucide="user-check" class="w-4 h-4 text-orange-400"></i> ${opName}
                    </td>
                    <td class="p-3 text-center font-mono font-bold">${data.total} işlem</td>
                    <td class="p-3 text-center font-mono text-emerald-400 font-bold">${data.success}</td>
                    <td class="p-3 text-center font-mono text-red-400 font-bold">${data.failed}</td>
                    <td class="p-3 text-center font-mono text-orange-400 font-bold">${kg} kg</td>
                    <td class="p-3 text-center font-mono font-bold">
                        <div class="flex items-center justify-center gap-2">
                            <div class="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div class="bg-purple-500 h-1.5 rounded-full" style="width: ${rate}%"></div>
                            </div>
                            <span class="text-purple-400">%${rate}</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } else {
        // Production or Detailed Logs Tab
        tableHead.innerHTML = `
            <tr>
                <th class="p-3">Tarih / Saat</th>
                <th class="p-3">Müşteri Firma</th>
                <th class="p-3">Reçete Adı</th>
                <th class="p-3">Operatör Usta</th>
                <th class="p-3">Tartılan Baharat</th>
                <th class="p-3 font-mono">Hedef</th>
                <th class="p-3 font-mono">Gerçekleşen</th>
                <th class="p-3 font-mono">Fark</th>
                <th class="p-3 text-center">Durum</th>
            </tr>
        `;

        if (filteredLogs.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-500 italic">Kriterlere uygun tartım kaydı bulunamadı.</td></tr>`;
            return;
        }

        tableBody.innerHTML = filteredLogs.map(l => {
            const dateObj = new Date(l.timestamp);
            const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('tr-TR') : '-';
            const timeStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString('tr-TR') : l.timestamp;

            const isSuccess = l.status === 'Başarılı' || l.status === 'success';
            const statusBadge = isSuccess
                ? `<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Başarılı</span>`
                : `<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/10 text-red-400 border border-red-500/20">Hatalı</span>`;

            const targetVal = parseFloat(l.target !== undefined ? l.target : l.targetAmount) || 0;
            const actualVal = parseFloat(l.actual !== undefined ? l.actual : l.actualAmount) || 0;
            const diffVal = actualVal - targetVal;
            const diffStr = diffVal >= 0 ? `+${diffVal.toFixed(1)} gr` : `${diffVal.toFixed(1)} gr`;
            const diffClass = Math.abs(diffVal) <= 2 ? 'text-emerald-400' : 'text-red-400';

            return `
                <tr class="border-b border-slate-850 hover:bg-slate-900/40 text-slate-300">
                    <td class="p-3 text-slate-400">
                        <div class="font-bold text-slate-200 text-xs">${dateStr}</div>
                        <div class="text-[10px] font-mono text-slate-500">${timeStr}</div>
                    </td>
                    <td class="p-3 font-bold text-white">${l.customer || '-'}</td>
                    <td class="p-3 text-slate-300">${l.recipe || '-'}</td>
                    <td class="p-3 text-slate-300">${l.operator || '-'}</td>
                    <td class="p-3 font-mono text-xs text-orange-400 font-bold">${l.item || '-'}</td>
                    <td class="p-3 font-mono">${targetVal.toFixed(1)} gr</td>
                    <td class="p-3 font-mono font-bold text-slate-200">${actualVal.toFixed(1)} gr</td>
                    <td class="p-3 font-mono text-xs font-bold ${diffClass}">${diffStr}</td>
                    <td class="p-3 text-center">${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }

    if (window.lucide) window.lucide.createIcons();
}

// Global action handlers for accounting report table buttons
window.printBatchReceiptDirect = function(batchId) {
    if (window.printReceipt) {
        window.printReceipt(batchId);
    } else {
        alert(`Parti #${batchId} fişi yazdırılıyor...`);
    }
};

window.toggleBatchAccountingStatus = async function(batchId, markCompleted) {
    try {
        const status = markCompleted ? 'fiş kesildi' : 'fiş kesilmedi';
        const res = await apiPost(`/api/batches/${batchId}/status`, { status });
        if (res.success) {
            await fetchDb();
            renderReportsTab();
        }
    } catch(e) {
        alert('İşlem başarısız: ' + e.message);
    }
};

function exportReportToCSV() {
    const logs = state.db.logs || [];
    if (logs.length === 0) {
        alert('İndirilecek rapor verisi bulunamadı.');
        return;
    }

    let csvContent = "\uFEFFTarih,Musteri,Recete,Operator,Baharat,Hedef_Gram,Gerceklesen_Gram,Fark_Gram,Durum\n";
    logs.forEach(l => {
        const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleString('tr-TR') : '-';
        const cust = (l.customer || '-').replace(/,/g, ' ');
        const rec = (l.recipe || '-').replace(/,/g, ' ');
        const op = (l.operator || '-').replace(/,/g, ' ');
        const item = (l.item || '-').replace(/,/g, ' ');
        const target = parseFloat(l.target || 0);
        const actual = parseFloat(l.actual || 0);
        const diff = (actual - target).toFixed(1);
        const st = l.status || '-';

        csvContent += `"${dateStr}","${cust}","${rec}","${op}","${item}",${target},${actual},${diff},"${st}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Baharat_Otomasyon_Rapor_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 8. SETTINGS TAB
async function saveRecipeOrderList(newList) {
    try {
        const res = await apiPost('/api/settings', { key: 'recipe_order', value: newList.join('\n') });
        if (res.success) {
            await fetchDb();
            renderSettingsTab();
        }
    } catch(e) {}
}

function renderSettingsTab() {
    renderScalesTab();
    if (!dom.settingsIngredientsList) return;

    const allSettings = state.db.settings || [];
    const settingObj = allSettings.find(s => s.key === 'recipe_order');

    // If settings not loaded yet, fetch directly from API and re-render
    if (allSettings.length === 0 || !settingObj) {
        fetch('/api/settings/recipe_order')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.value) {
                    // Inject into state so future calls work
                    if (!state.db.settings) state.db.settings = [];
                    const existing = state.db.settings.find(s => s.key === 'recipe_order');
                    if (existing) {
                        existing.value = data.value;
                    } else {
                        state.db.settings.push({ key: 'recipe_order', value: data.value });
                    }
                    renderSettingsTab(); // re-render now that we have data
                } else {
                    dom.settingsIngredientsList.innerHTML = '<li class="text-slate-500 text-sm italic py-4 text-center border border-dashed border-slate-700 rounded-lg">Listede henüz hammadde yok. Yukarıdan ekleyebilirsiniz.</li>';
                }
            }).catch(() => {
                dom.settingsIngredientsList.innerHTML = '<li class="text-slate-500 text-sm italic py-4 text-center border border-dashed border-slate-700 rounded-lg">Listede henüz hammadde yok. Yukarıdan ekleyebilirsiniz.</li>';
            });
        return;
    }
    
    let currentOrder = [];
    if (settingObj && settingObj.value) {
        currentOrder = settingObj.value.split('\n').map(s => s.trim()).filter(Boolean);
    }

    dom.settingsIngredientsList.innerHTML = '';
    
    if (currentOrder.length === 0) {
        dom.settingsIngredientsList.innerHTML = '<li class="text-slate-500 text-sm italic py-4 text-center border border-dashed border-slate-700 rounded-lg">Listede henüz hammadde yok. Yukarıdan ekleyebilirsiniz.</li>';
        return;
    }

    currentOrder.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg group hover:border-slate-700 transition-all';
        
        const isFirst = index === 0;
        const isLast = index === currentOrder.length - 1;

        li.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                    ${index + 1}
                </span>
                <span class="text-slate-200 font-bold">${item}</span>
            </div>
            <div class="flex items-center gap-1">
                <button class="btn-move-up p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded transition-all disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent" ${isFirst ? 'disabled' : ''} title="Yukarı Taşı">
                    <i data-lucide="arrow-up" class="w-4 h-4"></i>
                </button>
                <button class="btn-move-down p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded transition-all disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent" ${isLast ? 'disabled' : ''} title="Aşağı Taşı">
                    <i data-lucide="arrow-down" class="w-4 h-4"></i>
                </button>
                <div class="w-px h-4 bg-slate-800 mx-1"></div>
                <button class="btn-delete-item p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded transition-all" title="Sil">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;

        li.querySelector('.btn-move-up').addEventListener('click', () => {
            if (isFirst) return;
            const temp = currentOrder[index - 1];
            currentOrder[index - 1] = currentOrder[index];
            currentOrder[index] = temp;
            saveRecipeOrderList(currentOrder);
        });

        li.querySelector('.btn-move-down').addEventListener('click', () => {
            if (isLast) return;
            const temp = currentOrder[index + 1];
            currentOrder[index + 1] = currentOrder[index];
            currentOrder[index] = temp;
            saveRecipeOrderList(currentOrder);
        });

        li.querySelector('.btn-delete-item').addEventListener('click', () => {
            if (confirm(`"${item}" hammaddesini listeden silmek istediğinize emin misiniz?`)) {
                currentOrder.splice(index, 1);
                saveRecipeOrderList(currentOrder);
            }
        });

        dom.settingsIngredientsList.appendChild(li);
    });

    lucide.createIcons();
}

// 9. ACCOUNTING & SLIPS TAB
let currentAccFilter = 'all';

function renderAccountingTab() {
    const tableBody = document.getElementById('accounting-table-body');
    const searchInput = document.getElementById('acc-search-input');
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();

    // Collect all batches from state.db.orders
    let allBatches = [];
    (state.db.orders || []).forEach(ord => {
        (ord.batches || []).forEach(b => {
            const isRelevant = ['fiş kesilmedi', 'tamamlandı', 'Tamamlandı', 'paketlemede', 'mikserde'].includes(b.status);
            if (isRelevant) {
                allBatches.push({
                    id: b.id,
                    orderId: ord.id,
                    batchCode: b.batch_code || `PRT-${b.id.toString().substring(0, 6)}`,
                    customer: ord.firm_name || 'Bilinmeyen Müşteri',
                    recipe: ord.recipe_name || 'Standart Reçete',
                    weight: b.actual_total_weight || b.total_target_weight || 0,
                    timestamp: b.completed_at || b.created_at || new Date().toISOString(),
                    status: b.status || 'fiş kesilmedi',
                    operator: b.operator_name || 'Usta'
                });
            }
        });
    });

    // Sort newest first
    allBatches.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Metrics calculation
    const pendingBatches = allBatches.filter(b => b.status === 'fiş kesilmedi');
    const completedBatches = allBatches.filter(b => b.status === 'tamamlandı' || b.status === 'Tamamlandı');
    
    let rawWeightSum = allBatches.reduce((acc, b) => acc + (parseFloat(b.weight) || 0), 0);
    let totalWeightKg = rawWeightSum > 1000 ? rawWeightSum / 1000 : rawWeightSum;

    const elPending = document.getElementById('acc-metric-pending');
    const elCompleted = document.getElementById('acc-metric-completed');
    const elWeight = document.getElementById('acc-metric-weight');
    const elTotal = document.getElementById('acc-metric-total');

    if (elPending) elPending.textContent = pendingBatches.length;
    if (elCompleted) elCompleted.textContent = completedBatches.length;
    if (elWeight) elWeight.textContent = `${totalWeightKg.toFixed(1)} Kg`;
    if (elTotal) elTotal.textContent = allBatches.length;

    // Filtering
    let filtered = allBatches.filter(b => {
        if (currentAccFilter === 'pending') return b.status === 'fiş kesilmedi';
        if (currentAccFilter === 'completed') return b.status === 'tamamlandı' || b.status === 'Tamamlandı';
        return true;
    });

    if (searchTerm) {
        filtered = filtered.filter(b => 
            b.batchCode.toLowerCase().includes(searchTerm) ||
            b.customer.toLowerCase().includes(searchTerm) ||
            b.recipe.toLowerCase().includes(searchTerm)
        );
    }

    // Filter Buttons UI
    const btnAll = document.getElementById('btn-acc-filter-all');
    const btnPending = document.getElementById('btn-acc-filter-pending');
    const btnCompleted = document.getElementById('btn-acc-filter-completed');

    if (btnAll && btnPending && btnCompleted) {
        [btnAll, btnPending, btnCompleted].forEach(btn => {
            btn.className = 'btn btn-slate py-2 px-4 text-xs font-bold';
        });
        if (currentAccFilter === 'all') btnAll.className = 'btn btn-orange py-2 px-4 text-xs font-bold';
        else if (currentAccFilter === 'pending') btnPending.className = 'btn btn-orange py-2 px-4 text-xs font-bold';
        else if (currentAccFilter === 'completed') btnCompleted.className = 'btn btn-orange py-2 px-4 text-xs font-bold';

        btnAll.onclick = () => { currentAccFilter = 'all'; renderAccountingTab(); };
        btnPending.onclick = () => { currentAccFilter = 'pending'; renderAccountingTab(); };
        btnCompleted.onclick = () => { currentAccFilter = 'completed'; renderAccountingTab(); };
    }

    if (searchInput && !searchInput.dataset.listener) {
        searchInput.dataset.listener = 'true';
        searchInput.addEventListener('input', () => renderAccountingTab());
    }

    // Render Table
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500 font-bold">Kayıtlı muhasebe / fiş verisi bulunamadı.</td></tr>`;
        return;
    }

    filtered.forEach(b => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-900/60 hover:bg-slate-900/30 text-slate-300 transition-colors';

        const isCompleted = b.status === 'tamamlandı' || b.status === 'Tamamlandı';
        const badgeHtml = isCompleted
            ? `<span class="px-2.5 py-1 text-[10px] font-bold font-mono rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Fiş Kesildi</span>`
            : `<span class="px-2.5 py-1 text-[10px] font-bold font-mono rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Fiş Kesilmedi</span>`;

        let dateStr = '-';
        try {
            dateStr = new Date(b.timestamp).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        } catch(e) {}

        const weightStr = b.weight > 1000 ? `${(b.weight/1000).toFixed(2)} kg` : `${b.weight} g`;

        tr.innerHTML = `
            <td class="p-3 font-mono text-orange-400 font-bold">${b.batchCode}</td>
            <td class="p-3 font-bold text-white">${b.customer}</td>
            <td class="p-3">${b.recipe}</td>
            <td class="p-3 font-mono font-bold text-slate-200">${weightStr}</td>
            <td class="p-3 text-slate-400 font-mono text-[11px]">${dateStr}</td>
            <td class="p-3">${badgeHtml}</td>
            <td class="p-3 text-right space-x-2">
                <button class="btn btn-slate py-1 px-3 text-xs btn-acc-toggle" data-batch-id="${b.id}">
                    <i data-lucide="${isCompleted ? 'rotate-ccw' : 'check'}" class="w-3.5 h-3.5 inline mr-1"></i>
                    ${isCompleted ? 'Beklemeye Al' : 'Fiş Kes'}
                </button>
                <button class="btn btn-orange py-1 px-3 text-xs btn-acc-print" data-batch-id="${b.id}">
                    <i data-lucide="printer" class="w-3.5 h-3.5 inline mr-1"></i> Fiş Yazdır
                </button>
            </td>
        `;

        // Toggle action
        tr.querySelector('.btn-acc-toggle').addEventListener('click', async () => {
            const newStatus = isCompleted ? 'fiş kesilmedi' : 'tamamlandı';
            try {
                const res = await apiPost(`/api/operator/batch/${b.id}/status`, { status: newStatus });
                if (res.success) {
                    await fetchDb();
                    renderAccountingTab();
                }
            } catch(e) {
                console.error(e);
            }
        });

        // Print action
        tr.querySelector('.btn-acc-print').addEventListener('click', () => {
            showReceiptModal(b.id);
        });

        tableBody.appendChild(tr);
    });

    if (window.lucide) window.lucide.createIcons();
}

// --- CUSTOMER MANAGEMENT TAB IMPLEMENTATION ---
function renderCustomersTab() {
    const totalCustEl = document.getElementById('cust-metric-total');
    const totalRecEl = document.getElementById('cust-metric-recipes');
    const totalOrdEl = document.getElementById('cust-metric-orders');
    const tbody = document.getElementById('customer-table-body');
    const searchInput = document.getElementById('cust-search-input');

    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = "true";
        searchInput.addEventListener('input', () => renderCustomersTab());
    }

    const firms = state.db.firms || [];
    const recipes = state.db.recipes || [];
    const orders = state.db.orders || [];

    if (totalCustEl) totalCustEl.textContent = firms.length;
    if (totalRecEl) totalRecEl.textContent = recipes.length;
    if (totalOrdEl) totalOrdEl.textContent = orders.filter(o => o.status !== 'Tamamlandı').length;

    const query = (searchInput?.value || '').toLowerCase().trim();

    const filteredFirms = firms.filter(f => {
        if (!query) return true;
        return (f.name || '').toLowerCase().includes(query) ||
               (f.contactPerson || '').toLowerCase().includes(query) ||
               (f.phone || '').toLowerCase().includes(query) ||
               (f.email || '').toLowerCase().includes(query) ||
               (f.taxId || '').toLowerCase().includes(query);
    });

    if (!tbody) return;

    if (filteredFirms.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-slate-500 text-sm">
                    <i data-lucide="building-2" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                    Kayıtlı müşteri bulunamadı.
                </td>
            </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    tbody.innerHTML = filteredFirms.map(f => {
        return `
            <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                <td class="p-3 font-bold text-white">${f.name}</td>
                <td class="p-3 text-slate-300 text-xs">${f.contactPerson || '-'}</td>
                <td class="p-3 text-slate-300 text-xs font-mono">${f.phone || '-'}</td>
                <td class="p-3 text-slate-300 text-xs">${f.email || '-'}</td>
                <td class="p-3 text-slate-300 text-xs font-mono">${f.taxId || '-'}</td>
                <td class="p-3 text-slate-400 text-xs max-w-xs truncate">${f.notes || f.address || '-'}</td>
                <td class="p-3 text-right space-x-2">
                    <button onclick="openCustomerModal(${f.id})" class="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteFirm(${f.id})" class="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

function openCustomerModal(firmId = null) {
    const modal = document.getElementById('customer-modal-overlay');
    const title = document.getElementById('customer-modal-title');
    const form = document.getElementById('form-customer-modal');
    if (!modal || !form) return;

    form.reset();

    if (firmId) {
        const firm = (state.db.firms || []).find(f => f.id === firmId);
        if (firm) {
            title.innerHTML = `<i data-lucide="edit-3" class="w-6 h-6 text-orange-400"></i> Müşteri Bilgilerini Düzenle`;
            document.getElementById('cust-modal-id').value = firm.id;
            document.getElementById('cust-modal-name').value = firm.name || '';
            document.getElementById('cust-modal-contact').value = firm.contactPerson || '';
            document.getElementById('cust-modal-phone').value = firm.phone || '';
            document.getElementById('cust-modal-email').value = firm.email || '';
            document.getElementById('cust-modal-tax').value = firm.taxId || '';
            document.getElementById('cust-modal-address').value = firm.address || '';
            document.getElementById('cust-modal-notes').value = firm.notes || '';
        }
    } else {
        title.innerHTML = `<i data-lucide="building-2" class="w-6 h-6 text-orange-400"></i> Yeni Müşteri Ekle`;
        document.getElementById('cust-modal-id').value = '';
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

function closeCustomerModal() {
    const modal = document.getElementById('customer-modal-overlay');
    if (modal) modal.classList.add('hidden');
}

async function handleSaveCustomerSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('cust-modal-id').value;
    const name = document.getElementById('cust-modal-name').value.trim();
    const contactPerson = document.getElementById('cust-modal-contact').value.trim();
    const phone = document.getElementById('cust-modal-phone').value.trim();
    const email = document.getElementById('cust-modal-email').value.trim();
    const taxId = document.getElementById('cust-modal-tax').value.trim();
    const address = document.getElementById('cust-modal-address').value.trim();
    const notes = document.getElementById('cust-modal-notes').value.trim();

    if (!name) {
        alert('Müşteri adı zorunludur!');
        return;
    }

    try {
        let res;
        if (id) {
            res = await apiPut(`/api/firms/${id}`, { name, contactPerson, phone, email, taxId, address, notes });
        } else {
            res = await apiPost('/api/firms', { name, contactPerson, phone, email, taxId, address, notes });
        }

        if (res.success) {
            closeCustomerModal();
            await fetchDb();
            renderAdminPanel();
        }
    } catch (err) {
        alert(err.message || 'Müşteri kaydedilemedi.');
    }
}

