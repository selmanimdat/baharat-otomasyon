
function renderTraceabilityTab() {
    const traceFilterBatchId = document.getElementById('trace-filter-batch-id');
    const traceFilterFirm = document.getElementById('trace-filter-firm');
    const traceFilterRecipe = document.getElementById('trace-filter-recipe');
    const traceFilterOperator = document.getElementById('trace-filter-operator');
    const traceTableBody = document.getElementById('trace-table-body');
    const traceRecordCount = document.getElementById('trace-record-count');

    if (!traceTableBody) return;

    const filterBatchId = traceFilterBatchId ? traceFilterBatchId.value.toLowerCase().trim() : '';
    const filterFirm = traceFilterFirm ? traceFilterFirm.value.toLowerCase().trim() : '';
    const filterRecipe = traceFilterRecipe ? traceFilterRecipe.value.toLowerCase().trim() : '';
    const filterOperator = traceFilterOperator ? traceFilterOperator.value.toLowerCase().trim() : '';

    // Gather all batches
    let allBatches = [];
    state.db.orders.forEach(order => {
        order.batches.forEach(batch => {
            allBatches.push({
                ...batch,
                customer: order.customer,
                recipeName: order.recipeName,
                orderId: order.id
            });
        });
    });

    // Sort batches by ID descending
    allBatches.sort((a, b) => b.id.localeCompare(a.id));

    // Apply filters
    const filtered = allBatches.filter(b => {
        if (filterBatchId && !b.id.toLowerCase().includes(filterBatchId)) return false;
        if (filterFirm && !b.customer.toLowerCase().includes(filterFirm)) return false;
        if (filterRecipe && !b.recipeName.toLowerCase().includes(filterRecipe)) return false;
        const operatorName = b.operator || '';
        if (filterOperator && !operatorName.toLowerCase().includes(filterOperator)) return false;
        return true;
    });

    // Update count
    if (traceRecordCount) {
        traceRecordCount.textContent = `${filtered.length} Parti Bulundu`;
    }

    // Render rows
    if (filtered.length === 0) {
        traceTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-slate-500 font-bold">
                    Kayıtlı veya kriterlere uyan parti bulunamadı.
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filtered.forEach(b => {
        const statusClass = b.status.toLowerCase().replace('ş', 's').replace('ı', 'i');
        const operatorDisplay = b.operator || '<span class="text-slate-500 font-normal">Atanmadı</span>';
        
        html += `
            <tr class="hover:bg-slate-900/30 transition-colors">
                <td class="p-3 font-mono font-bold text-orange-400">${b.id}</td>
                <td class="p-3">
                    <span class="block font-bold text-white">${b.customer}</span>
                    <span class="block text-xs text-slate-400 mt-0.5">${b.recipeName} (Batch ${b.no}/${b.totalBatches})</span>
                </td>
                <td class="p-3 font-medium text-slate-300">${operatorDisplay}</td>
                <td class="p-3 font-mono font-bold text-slate-200">${b.targetAmount.toFixed(2)} kg</td>
                <td class="p-3">
                    <span class="badge-status ${statusClass}">${b.status}</span>
                </td>
                <td class="p-3">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="viewBatchTraceability('${b.id}')" class="btn btn-slate py-1.5 px-3 text-xs flex items-center gap-1.5" title="İncele">
                            <i data-lucide="eye" class="w-3.5 h-3.5 text-blue-400"></i> İncele
                        </button>
                        <button onclick="printBatchLabel('${b.id}')" class="btn btn-slate py-1.5 px-3 text-xs flex items-center gap-1.5" title="Etiket Bas">
                            <i data-lucide="printer" class="w-3.5 h-3.5 text-orange-400"></i> Etiket
                        </button>
                        <button onclick="printTraceabilityPDF('${b.id}')" class="btn btn-slate py-1.5 px-3 text-xs flex items-center gap-1.5" title="Rapor Çıkar">
                            <i data-lucide="file-text" class="w-3.5 h-3.5 text-green-400"></i> Rapor
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    traceTableBody.innerHTML = html;
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function viewBatchTraceability(batchId) {
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

    if (!foundBatch) {
        alert("Parti verisi bulunamadı.");
        return;
    }

    const batchLogs = state.db.logs.filter(log => log.batchId === batchId);

    document.getElementById('trace-modal-title').textContent = `Parti: ${batchId}`;
    
    const barcodeVal = `*${batchId}*`;
    document.getElementById('trace-modal-barcode').textContent = barcodeVal;
    document.getElementById('trace-modal-barcode-text').textContent = batchId;

    document.getElementById('trace-modal-customer').textContent = foundBatch.customer;
    document.getElementById('trace-modal-recipe').textContent = foundBatch.recipeName;
    document.getElementById('trace-modal-operator').textContent = foundBatch.operator || '-';
    document.getElementById('trace-modal-target').textContent = `${foundBatch.targetAmount.toFixed(2)} kg`;

    const tableBody = document.getElementById('trace-modal-table-body');
    if (tableBody) {
        if (batchLogs.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="p-6 text-center text-slate-500 font-bold">
                        Bu partiye ait tartım kaydı henüz bulunmamaktadır.
                    </td>
                </tr>
            `;
        } else {
            let html = '';
            batchLogs.forEach(log => {
                const diff = (log.actual || 0) - (log.target || 0);
                const pct = log.target ? (diff / log.target) * 100 : 0;
                const sign = diff >= 0 ? '+' : '';
                const deviationText = `${sign}${diff.toFixed(2)} gr (${sign}${pct.toFixed(2)}%)`;
                
                const statusBadge = log.status === 'Başarılı' 
                    ? '<span class="text-status-success">Başarılı</span>' 
                    : '<span class="text-status-error">Hatalı</span>';
                
                const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : '-';
                
                html += `
                    <tr class="hover:bg-slate-900/20">
                        <td class="p-3 font-bold text-white">${log.item}</td>
                        <td class="p-3 font-mono text-slate-300">${(log.target || 0).toFixed(2)}</td>
                        <td class="p-3 font-mono text-white">${(log.actual || 0).toFixed(2)}</td>
                        <td class="p-3 font-mono ${diff >= 0 ? 'text-green-400' : 'text-red-400'}">${deviationText}</td>
                        <td class="p-3 text-xs text-slate-400">${dateStr}</td>
                        <td class="p-3 text-center">${statusBadge}</td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        }
    }

    document.getElementById('btn-trace-modal-pdf').onclick = () => printTraceabilityPDF(batchId);
    document.getElementById('btn-trace-modal-label').onclick = () => printBatchLabel(batchId);

    document.getElementById('trace-modal-overlay').classList.remove('hidden');
}

function printBatchLabel(batchId) {
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

    if (!foundBatch) {
        alert("Parti verisi bulunamadı.");
        return;
    }

    const batchLogs = state.db.logs.filter(log => log.batchId === batchId);
    const firstLog = batchLogs[0];
    
    const customer = foundBatch.customer;
    const recipeName = foundBatch.recipeName;
    const operator = foundBatch.operator || 'Operatör';
    const batchNo = foundBatch.no;
    const totalBatches = foundBatch.totalBatches;
    const targetWeight = foundBatch.targetAmount;
    
    let dateStr = new Date().toLocaleString('tr-TR');
    if (firstLog && firstLog.timestamp) {
        dateStr = new Date(firstLog.timestamp).toLocaleString('tr-TR');
    }

    const labelWindow = window.open('', '_blank', 'width=600,height=600');
    labelWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Barkod Etiketi - ${batchId}</title>
            <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
                @page {
                    size: 100mm 100mm;
                    margin: 0;
                }
                body {
                    font-family: 'Inter', sans-serif;
                    margin: 0;
                    padding: 8mm;
                    width: 84mm;
                    height: 84mm;
                    box-sizing: border-box;
                    color: #000;
                    background-color: #fff;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .header {
                    border-bottom: 2px solid #000;
                    padding-bottom: 2mm;
                    text-align: center;
                }
                .title {
                    font-size: 16px;
                    font-weight: 900;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }
                .subtitle {
                    font-size: 10px;
                    color: #555;
                    font-weight: bold;
                    margin-top: 1px;
                }
                .details {
                    margin: 3mm 0;
                    font-size: 12px;
                    line-height: 1.4;
                }
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 1mm;
                }
                .label-name {
                    font-weight: bold;
                }
                .label-val {
                    font-weight: normal;
                }
                .barcode-section {
                    text-align: center;
                    margin-top: auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .barcode {
                    font-family: 'Libre Barcode 128', sans-serif;
                    font-size: 48px;
                    line-height: 1;
                    margin: 0;
                    padding: 0;
                }
                .barcode-text {
                    font-family: monospace;
                    font-size: 11px;
                    font-weight: bold;
                    margin-top: 1mm;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">BAHARAT OTOMASYON</div>
                <div class="subtitle">ÜRETİM PARTİ ETİKETİ</div>
            </div>
            <div class="details">
                <div class="detail-row">
                    <span class="label-name">Müşteri:</span>
                    <span class="label-val">${customer}</span>
                </div>
                <div class="detail-row">
                    <span class="label-name">Reçete:</span>
                    <span class="label-val">${recipeName}</span>
                </div>
                <div class="detail-row">
                    <span class="label-name">Parti No:</span>
                    <span class="label-val">${batchNo} / ${totalBatches}</span>
                </div>
                <div class="detail-row">
                    <span class="label-name">Hedef Ağırlık:</span>
                    <span class="label-val">${targetWeight.toFixed(2)} kg</span>
                </div>
                <div class="detail-row">
                    <span class="label-name">Tarih:</span>
                    <span class="label-val">${dateStr}</span>
                </div>
                <div class="detail-row">
                    <span class="label-name">Operatör:</span>
                    <span class="label-val">${operator}</span>
                </div>
            </div>
            <div class="barcode-section">
                <div class="barcode">*${batchId}*</div>
                <div class="barcode-text">${batchId}</div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.close();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    labelWindow.document.close();
}

function printTraceabilityPDF(batchId) {
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

    if (!foundBatch) {
        alert("Parti verisi bulunamadı.");
        return;
    }

    const batchLogs = state.db.logs.filter(log => log.batchId === batchId);
    const firstLog = batchLogs[0];
    
    const customer = foundBatch.customer;
    const recipeName = foundBatch.recipeName;
    const operator = foundBatch.operator || 'Operatör';
    const targetWeight = foundBatch.targetAmount;
    
    let dateStr = new Date().toLocaleString('tr-TR');
    if (firstLog && firstLog.timestamp) {
        dateStr = new Date(firstLog.timestamp).toLocaleString('tr-TR');
    }

    let rowsHtml = '';
    if (batchLogs.length === 0) {
        rowsHtml = `
            <tr>
                <td colspan="6" class="text-center" style="padding: 10px;">
                    Bu partiye ait tartım kaydı bulunmamaktadır.
                </td>
            </tr>
        `;
    } else {
        batchLogs.forEach(log => {
            const diff = (log.actual || 0) - (log.target || 0);
            const pct = log.target ? (diff / log.target) * 100 : 0;
            const sign = diff >= 0 ? '+' : '';
            const statusClass = log.status === 'Başarılı' ? 'success' : 'error';
            
            rowsHtml += `
                <tr>
                    <td style="font-weight: bold;">${log.item}</td>
                    <td class="text-right font-mono">${(log.target || 0).toFixed(2)}</td>
                    <td class="text-right font-mono">${(log.actual || 0).toFixed(2)}</td>
                    <td class="text-right font-mono ${diff >= 0 ? 'text-green-405' : 'text-red-405'}">${sign}${diff.toFixed(2)}</td>
                    <td class="text-right font-mono">${sign}${pct.toFixed(2)}%</td>
                    <td class="text-center">
                        <span class="status-badge ${statusClass}">${log.status}</span>
                    </td>
                </tr>
            `;
        });
    }

    const pdfWindow = window.open('', '_blank', 'width=800,height=800');
    pdfWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>İzlenebilirlik Raporu - ${batchId}</title>
            <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&family=Inter:wght@400;500;600;700;850&display=swap" rel="stylesheet">
            <style>
                @page {
                    size: A4;
                    margin: 20mm;
                }
                body {
                    font-family: 'Inter', sans-serif;
                    margin: 0;
                    color: #333;
                    background-color: #fff;
                    line-height: 1.5;
                    font-size: 12px;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 3px double #000;
                    padding-bottom: 5mm;
                    margin-bottom: 6mm;
                }
                .header-title-section h1 {
                    font-size: 18px;
                    font-weight: 850;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .header-title-section p {
                    margin: 2px 0 0 0;
                    font-size: 11px;
                    color: #666;
                    font-weight: bold;
                }
                .barcode-box {
                    text-align: center;
                }
                .barcode {
                    font-family: 'Libre Barcode 128', sans-serif;
                    font-size: 40px;
                    line-height: 1;
                    margin: 0;
                }
                .barcode-text {
                    font-family: monospace;
                    font-size: 10px;
                    margin-top: 1px;
                    font-weight: bold;
                }
                .meta-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 4mm;
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    padding: 4mm;
                    border-radius: 6px;
                    margin-bottom: 6mm;
                }
                .meta-item {
                    display: flex;
                    justify-content: space-between;
                    border-bottom: 1px dashed #e2e8f0;
                    padding-bottom: 1mm;
                }
                .meta-label {
                    font-weight: bold;
                    color: #64748b;
                }
                .meta-val {
                    font-weight: bold;
                    color: #0f172a;
                }
                .section-title {
                    font-size: 13px;
                    font-weight: 850;
                    text-transform: uppercase;
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 1.5mm;
                    margin-bottom: 3mm;
                    color: #0f172a;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 8mm;
                }
                th {
                    background-color: #0f172a;
                    color: #fff;
                    font-weight: bold;
                    text-align: left;
                    padding: 2.5mm 3mm;
                    text-transform: uppercase;
                    font-size: 10px;
                }
                td {
                    padding: 2.5mm 3mm;
                    border-bottom: 1px solid #e2e8f0;
                }
                .text-right {
                    text-align: right;
                }
                .text-center {
                    text-align: center;
                }
                .font-mono {
                    font-family: monospace;
                    font-size: 11px;
                }
                .status-badge {
                    font-weight: bold;
                    padding: 0.5mm 2mm;
                    border-radius: 4px;
                    font-size: 10px;
                }
                .status-badge.success {
                    background-color: #d1fae5;
                    color: #065f46;
                }
                .status-badge.error {
                    background-color: #fee2e2;
                    color: #991b1b;
                }
                .signature-section {
                    margin-top: 15mm;
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 10mm;
                    text-align: center;
                }
                .signature-box {
                    border-top: 1px solid #000;
                    padding-top: 2mm;
                }
                .signature-title {
                    font-weight: bold;
                    font-size: 11px;
                    color: #475569;
                }
                .signature-name {
                    margin-top: 12mm;
                    font-size: 12px;
                    font-weight: bold;
                }
                .text-green-405 {
                    color: #15803d;
                }
                .text-red-405 {
                    color: #b91c1c;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-title-section">
                    <h1>Baharat Üretim İzlenebilirlik Raporu</h1>
                    <p>Ürün Kalite Güvence ve Doğrulama Kaydı</p>
                </div>
                <div class="barcode-box">
                    <div class="barcode">*${batchId}*</div>
                    <div class="barcode-text">${batchId}</div>
                </div>
            </div>
            
            <div class="meta-grid">
                <div class="meta-item">
                    <span class="meta-label">Müşteri Firma:</span>
                    <span class="meta-val">${customer}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Ürün / Reçete Adı:</span>
                    <span class="meta-val">${recipeName}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Parti (Batch) Kodu:</span>
                    <span class="meta-val font-mono">${batchId}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Parti Ağırlığı:</span>
                    <span class="meta-val">${targetWeight.toFixed(2)} kg</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Operatör Usta:</span>
                    <span class="meta-val">${operator}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Rapor Tarihi:</span>
                    <span class="meta-val">${dateStr}</span>
                </div>
            </div>

            <div class="section-title">Hammadde Tartım Detayları</div>
            <table>
                <thead>
                    <tr>
                        <th>Hammadde Adı</th>
                        <th class="text-right">Hedef (gr)</th>
                        <th class="text-right">Tartılan (gr)</th>
                        <th class="text-right">Sapma (gr)</th>
                        <th class="text-right">Hata Oranı</th>
                        <th class="text-center">Durum</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-title">Operatör (Usta)</div>
                    <div class="signature-name">${operator}</div>
                </div>
                <div class="signature-box">
                    <div class="signature-title">Kalite Kontrol Sorumlusu</div>
                    <div class="signature-name">................................</div>
                </div>
                <div class="signature-box">
                    <div class="signature-title">Üretim Müdürü</div>
                    <div class="signature-name">................................</div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.close();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    pdfWindow.document.close();
}

window.renderTraceabilityTab = renderTraceabilityTab;
window.viewBatchTraceability = viewBatchTraceability;
window.printBatchLabel = printBatchLabel;
window.printTraceabilityPDF = printTraceabilityPDF;

