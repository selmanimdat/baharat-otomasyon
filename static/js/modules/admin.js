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
    } else if (state.adminTab === 'audit-logs') {
        const panelAudit = document.getElementById('panel-audit-logs');
        if (panelAudit) panelAudit.classList.remove('hidden');
        renderAuditLogsTab();
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
            tbody.innerHTML = `<tr><td colspan="6" class="px-2 py-3 text-center text-slate-500">Bugün tartım hareketi bulunmamaktadır.</td></tr>`;
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
        if ((state.db.scales || []).length === 0) {
            scalesMonitorList.innerHTML = `<div class="text-center text-slate-500 py-4 text-sm">Sisteme kayıtlı terazi bulunamadı.</div>`;
        } else {
            (state.db.scales || []).forEach(s => {
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

    const deliveryDateInput = document.getElementById('order-delivery-date');
    if (deliveryDateInput && !deliveryDateInput.value) {
        const todayStr = new Date();
        // Adjust for local timezone offset so we don't get yesterday if it's past UTC midnight
        todayStr.setMinutes(todayStr.getMinutes() - todayStr.getTimezoneOffset());
        deliveryDateInput.value = todayStr.toISOString().split('T')[0];
    }

    const firmDropdown = document.getElementById('order-firm-dropdown');
    const searchInput = document.getElementById('order-firm-search-input');

    // Sort firms alphabetically
    const sortedFirms = [...state.db.firms].sort((a, b) => a.name.localeCompare(b.name, 'tr'));

    // Populate hidden native select (used for form submission)
    dom.orderFirmSelect.innerHTML = '<option value="">Firma Seçiniz...</option>';
    sortedFirms.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        if (Number(state.orderSelectedFirmId) === Number(f.id)) opt.selected = true;
        dom.orderFirmSelect.appendChild(opt);
    });

    // Helper: rebuild dropdown items based on filter text
    function buildDropdownItems(filterText) {
        if (!firmDropdown) return;
        firmDropdown.innerHTML = '';
        const q = (filterText || '').toLowerCase().trim();
        const filtered = q ? sortedFirms.filter(f => f.name.toLowerCase().includes(q)) : sortedFirms;

        if (filtered.length === 0) {
            const li = document.createElement('li');
            li.className = 'px-4 py-2 text-slate-500 italic text-sm';
            li.textContent = 'Sonuç bulunamadı';
            firmDropdown.appendChild(li);
            return;
        }

        filtered.forEach(f => {
            const li = document.createElement('li');
            li.className = 'px-4 py-2 hover:bg-slate-700 cursor-pointer text-slate-300 transition-colors custom-firm-option';
            li.dataset.value = f.id;
            li.textContent = f.name;
            if (Number(state.orderSelectedFirmId) === Number(f.id)) {
                li.classList.add('bg-slate-700', 'text-white', 'font-bold');
            }
            li.addEventListener('click', () => {
                state.orderSelectedFirmId = Number(f.id);
                if (searchInput) searchInput.value = f.name;
                dom.orderFirmSelect.value = f.id;
                firmDropdown.classList.add('hidden');
                renderOrdersTab();
            });
            firmDropdown.appendChild(li);
        });
    }

    // Initial dropdown build (hidden, populated ready for focus)
    buildDropdownItems('');

    // Set search input display value for selected firm
    if (searchInput) {
        if (state.orderSelectedFirmId) {
            const sel = state.db.firms.find(f => Number(f.id) === Number(state.orderSelectedFirmId));
            if (sel) searchInput.value = sel.name;
        } else if (!searchInput.value) {
            searchInput.value = '';
        }

        // Attach events only once
        if (!searchInput.hasAttribute('data-order-firm-listener')) {
            searchInput.setAttribute('data-order-firm-listener', 'true');

            searchInput.addEventListener('focus', () => {
                buildDropdownItems(searchInput.value);
                firmDropdown && firmDropdown.classList.remove('hidden');
            });

            searchInput.addEventListener('input', () => {
                // Clear selection when user types manually
                state.orderSelectedFirmId = null;
                dom.orderFirmSelect.value = '';
                buildDropdownItems(searchInput.value);
                firmDropdown && firmDropdown.classList.remove('hidden');
                // Disable recipe select until firm is picked
                dom.orderRecipeSelect.disabled = true;
                dom.orderRecipeSelect.innerHTML = '<option value="">Önce Firma Seçin...</option>';
            });

            // Close dropdown when clicking outside the wrapper
            document.addEventListener('click', (e) => {
                const wrapper = document.getElementById('order-firm-wrapper');
                if (wrapper && !wrapper.contains(e.target)) {
                    firmDropdown && firmDropdown.classList.add('hidden');
                }
            }, true);
        }
    }

    // Populate Recipes select dropdown
    dom.orderRecipeSelect.innerHTML = '';
    if (state.orderSelectedFirmId) {
        dom.orderRecipeSelect.disabled = false;
        dom.orderRecipeSelect.innerHTML = '<option value="">Reçete Seçiniz...</option>';
        const recipes = state.db.recipes.filter(r => Number(r.firmId) === Number(state.orderSelectedFirmId) && isRecipeActive(r));
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

    // Populate Extras Custom Dropdown
    const extraDropdown = document.getElementById('order-extra-dropdown');
    const extraInput = document.getElementById('order-extra-product');

    if (extraDropdown && extraInput && typeof getRecipeOrderIngredients === 'function') {
        const ingredients = getRecipeOrderIngredients();
        let activeIndex = -1;

        function highlightItem(items, index) {
            items.forEach((item, idx) => {
                if (idx === index) {
                    item.classList.add('bg-slate-700', 'text-white', 'font-bold');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('bg-slate-700', 'text-white', 'font-bold');
                }
            });
        }

        function buildExtraDropdownItems(filterText) {
            extraDropdown.innerHTML = '';
            activeIndex = -1;
            const q = (filterText || '').toLowerCase().trim();
            const filtered = q ? ingredients.filter(ing => ing.toLowerCase().includes(q)) : ingredients;

            if (filtered.length === 0) {
                const li = document.createElement('li');
                li.className = 'px-4 py-2 text-slate-500 italic text-sm';
                li.textContent = 'Sonuç bulunamadı';
                extraDropdown.appendChild(li);
                return;
            }

            filtered.forEach(ing => {
                const li = document.createElement('li');
                li.className = 'px-4 py-2 hover:bg-slate-700 cursor-pointer text-slate-300 transition-colors custom-extra-option text-sm';
                li.textContent = ing;
                li.addEventListener('click', () => {
                    extraInput.value = ing;
                    extraDropdown.classList.add('hidden');
                });
                extraDropdown.appendChild(li);
            });
        }

        buildExtraDropdownItems('');

        if (!extraInput.hasAttribute('data-extra-listener')) {
            extraInput.setAttribute('data-extra-listener', 'true');

            extraInput.addEventListener('focus', () => {
                buildExtraDropdownItems(extraInput.value);
                extraDropdown.classList.remove('hidden');
            });

            extraInput.addEventListener('input', () => {
                buildExtraDropdownItems(extraInput.value);
                extraDropdown.classList.remove('hidden');
            });

            extraInput.addEventListener('keydown', (e) => {
                const items = extraDropdown.querySelectorAll('.custom-extra-option');
                if (items.length === 0) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (extraDropdown.classList.contains('hidden')) {
                        extraDropdown.classList.remove('hidden');
                        activeIndex = -1;
                    }
                    activeIndex = (activeIndex + 1) % items.length;
                    highlightItem(items, activeIndex);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (extraDropdown.classList.contains('hidden')) {
                        extraDropdown.classList.remove('hidden');
                        activeIndex = items.length;
                    }
                    activeIndex = (activeIndex - 1 + items.length) % items.length;
                    highlightItem(items, activeIndex);
                } else if (e.key === 'Enter') {
                    if (!extraDropdown.classList.contains('hidden') && activeIndex >= 0 && activeIndex < items.length) {
                        e.preventDefault();
                        extraInput.value = items[activeIndex].textContent;
                        extraDropdown.classList.add('hidden');
                        activeIndex = -1;
                    }
                } else if (e.key === 'Escape') {
                    extraDropdown.classList.add('hidden');
                    activeIndex = -1;
                }
            });

            document.addEventListener('click', (e) => {
                const wrapper = document.getElementById('order-extra-wrapper');
                if (wrapper && !wrapper.contains(e.target)) {
                    extraDropdown.classList.add('hidden');
                }
            }, true);
        }
    }

    window.updateOrderFormSummary();
    if (typeof window.renderOrderExtras === 'function') window.renderOrderExtras();
    renderActiveJobsListTable();
}

window.updateOrderFormSummary = function () {
    const recipeSelect = dom.orderRecipeSelect;
    const amountInput = document.getElementById('order-amount');
    const bagWeightInput = document.getElementById('order-bag-weight');
    const batchesSelect = document.getElementById('order-batches');
    const summaryCard = document.getElementById('order-summary-info');
    const totalSpiceEl = document.getElementById('summary-total-spice');
    const titleLabelEl = document.getElementById('summary-title-label');
    const portionDetailEl = document.getElementById('summary-portion-detail');

    const lblAmount = document.getElementById('lbl-order-amount');
    const lblBagWeight = document.getElementById('lbl-order-bag-weight');
    const lblBatches = document.getElementById('lbl-order-batches');
    const containerSegments = document.getElementById('container-order-segments');

    const selectedRecipeId = recipeSelect ? recipeSelect.value : null;
    const recipe = selectedRecipeId ? state.db.recipes.find(r => Number(r.id) === Number(selectedRecipeId)) : null;

    const isCustom = recipe ? !!recipe.isCustomKgBased : false;

    // Hide Paketleme Bölümleme section when isCustomKgBased is true
    if (containerSegments) {
        if (isCustom) {
            containerSegments.classList.add('hidden');
        } else {
            containerSegments.classList.remove('hidden');
        }
    }

    // Update labels dynamically
    if (lblAmount) {
        lblAmount.textContent = isCustom ? "Toplam Baharat Siparişi (KG)" : "Toplam Sipariş Miktarı (KG)";
    }
    if (lblBagWeight) {
        lblBagWeight.textContent = isCustom ? "Paket / Torba Ağırlığı (KG)" : "Varsayılan Mikser Kapasitesi (KG)";
    }
    if (bagWeightInput) {
        bagWeightInput.placeholder = isCustom ? "Örn: 25 (1 Paket Ağırlığı)" : "Örn: 250";
    }
    if (lblBatches) {
        lblBatches.textContent = isCustom ? "İş Emri Parti Sayısı" : "Parti (Bölüm) Sayısı";
    }

    const totalAmount = parseFloat(amountInput?.value) || 0;
    const bagWeight = parseFloat(bagWeightInput?.value) || 0;
    const batches = parseInt(batchesSelect?.value) || 1;

    if (totalAmount <= 0) {
        if (summaryCard) summaryCard.classList.add('hidden');
        return;
    }

    if (summaryCard) summaryCard.classList.remove('hidden');

    const portionKg = totalAmount / batches;

    if (isCustom) {
        if (titleLabelEl) titleLabelEl.textContent = "İstenen Toplam Baharat Siparişi:";
        if (totalSpiceEl) totalSpiceEl.textContent = `${totalAmount.toFixed(2)} kg`;

        let detailText = "";
        if (bagWeight > 0) {
            const totalBags = (totalAmount / bagWeight).toFixed(1).replace(/\.0$/, '');
            detailText = `Paketleme Hesabı: ${totalAmount.toFixed(2)} kg baharat, ${bagWeight} kg'lık paketlerle toplam ${totalBags} Torba / Paket yapar.`;
            if (batches > 1) {
                const bagsPerBatch = (portionKg / bagWeight).toFixed(1).replace(/\.0$/, '');
                detailText += ` | İş Emri: ${batches} Parti x ${portionKg.toFixed(2)} kg (${bagsPerBatch} Torba/Parti)`;
            }
        } else {
            detailText = `İş Emri: ${batches} Parti x ${portionKg.toFixed(2)} kg`;
        }
        if (portionDetailEl) portionDetailEl.textContent = detailText;
    } else {
        if (titleLabelEl) titleLabelEl.textContent = "Tahmini Baharat Çıktısı:";
        let estimatedSpiceKg = totalAmount;
        if (recipe && recipe.items && recipe.items.length > 0) {
            const baseAmount = (recipe.baseAmount && recipe.baseAmount !== 1.0) ? recipe.baseAmount : 100.0;
            const recipeGramsSum = recipe.items
                .filter(item => !item.is_not_included)
                .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
            estimatedSpiceKg = (recipeGramsSum / 1000.0) * (totalAmount / baseAmount);
        }
        if (totalSpiceEl) totalSpiceEl.textContent = `${estimatedSpiceKg.toFixed(2)} kg`;

        let detailText = `Parti Başına: ${batches} Parti x ${portionKg.toFixed(2)} kg`;
        if (bagWeight > 0) {
            const bagsPerBatch = Math.ceil(portionKg / bagWeight);
            const perBagKg = portionKg / bagsPerBatch;
            detailText += ` (${bagsPerBatch} Torba x ${perBagKg.toFixed(2)} kg)`;
        }
        if (portionDetailEl) portionDetailEl.textContent = detailText;
    }

    // Warning logic for normal orders
    const warningEl = document.getElementById('order-segments-warning');
    if (!isCustom && warningEl) {
        let warningHtml = '';
        const segs = window.orderSegments || [];

        if (segs.length > 0) {
            const segSum = segs.reduce((s, seg) => s + parseFloat(seg.amount || 0), 0);
            if (Math.abs(segSum - totalAmount) > 0.001) {
                warningHtml = `<i data-lucide="alert-triangle" class="w-4 h-4 inline-block mr-1"></i> UYARI: Bölümlerin toplamı (${segSum.toFixed(2)} kg), sipariş miktarına (${totalAmount.toFixed(2)} kg) eşit değil!`;
            }
        } else if (bagWeight > 0 && totalAmount > 0) {
            if (totalAmount % bagWeight !== 0) {
                const remainder = totalAmount % bagWeight;
                warningHtml = `<i data-lucide="info" class="w-4 h-4 inline-block mr-1"></i> BİLGİ: Toplam sipariş mikser kapasitesine tam bölünmüyor! Kalan ${remainder.toFixed(2)} kg. Özel bölümler tanımlayabilirsiniz.`;
            }
        }

        if (warningHtml) {
            warningEl.innerHTML = warningHtml;
            warningEl.classList.remove('hidden');
            if (window.lucide) window.lucide.createIcons();
        } else {
            warningEl.classList.add('hidden');
        }
    }
};

window.renderOrderSegments = function () {
    const tbody = document.getElementById('order-segments-list');
    const summary = document.getElementById('order-segments-summary');
    if (!tbody || !summary) return;

    tbody.innerHTML = '';
    const segs = window.orderSegments || [];

    if (segs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-slate-500 italic text-xs">Henüz bölüm eklenmedi. (Varsayılan kapasite kullanılacak)</td></tr>';
        summary.textContent = '';
        return;
    }

    let totalAmount = 0;
    segs.forEach((seg, index) => {
        totalAmount += parseFloat(seg.amount || 0);

        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors';

        tr.innerHTML = `
            <td class="p-2">
                <input type="number" step="0.1" min="0" class="input-field py-1 px-2 text-sm w-24" value="${seg.amount || ''}" data-idx="${index}" data-field="amount">
            </td>
            <td class="p-2">
                <input type="number" step="0.1" min="0" class="input-field py-1 px-2 text-sm w-32" value="${seg.bagWeight || ''}" data-idx="${index}" data-field="bagWeight">
            </td>
            <td class="p-2 font-mono text-xs text-slate-300 td-torba">
                ${(seg.amount > 0 && seg.bagWeight > 0) ? Math.ceil(seg.amount / seg.bagWeight) + ' torba' : '-'}
            </td>
            <td class="p-2 text-right">
                <button type="button" class="text-red-400 hover:text-red-300 btn-del-seg" data-idx="${index}">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Inputs event listener
    tbody.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const field = e.target.dataset.field;
            segs[idx][field] = parseFloat(e.target.value) || 0;

            // Update Torba Sayısı column inline
            const tr = e.target.closest('tr');
            const tdTorba = tr.querySelector('.td-torba');
            if (tdTorba) {
                tdTorba.textContent = (segs[idx].amount > 0 && segs[idx].bagWeight > 0) ? Math.ceil(segs[idx].amount / segs[idx].bagWeight) + ' torba' : '-';
            }

            // Update summary inline
            let newTotal = 0;
            segs.forEach(s => newTotal += parseFloat(s.amount || 0));
            summary.textContent = `Toplam Bölüm: ${segs.length} | Toplam Miktar: ${newTotal.toFixed(2)} kg`;

            if (typeof updateOrderFormSummary === 'function') updateOrderFormSummary();
        });
    });

    // Delete buttons
    tbody.querySelectorAll('.btn-del-seg').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            segs.splice(idx, 1);
            window.renderOrderSegments();
            if (typeof updateOrderFormSummary === 'function') updateOrderFormSummary();
        });
    });

    summary.textContent = `Toplam Bölüm: ${segs.length} | Toplam Miktar: ${totalAmount.toFixed(2)} kg`;
    if (window.lucide) window.lucide.createIcons();
};



function renderActiveJobsListTable() {
    // Active Jobs List
    dom.activeJobsList.innerHTML = '';

    const todayStr = getTodayDateStr();

    // Flatmap orders and batches
    const flattenedBatches = [];
    state.db.orders.forEach(o => {
        // Tarihsiz siparişleri gizle
        if (!o.deliveryDate) return;

        o.batches.forEach(b => {
            const isDelivered = (b.status === 'teslim edildi' || b.status === 'Teslim Edildi');
            const isToday = (o.deliveryDate === todayStr);

            // Gizle: Eğer "teslim edildi" ise VE bugünün siparişi DEĞİLSE gizle (Bugünün teslim edilen siparişleri listede gösterilmeye devam eder)
            if (isDelivered && !isToday) return;


            flattenedBatches.push({
                customer: o.customer,
                recipeName: o.recipeName,
                no: b.no,
                totalBatches: b.totalBatches,
                targetAmount: b.targetAmount,
                operator: b.operator || '-',
                status: b.status,
                id: b.id,
                orderId: o.id,
                deliveryDate: o.deliveryDate,
                urgency: o.urgency,
                bagWeight: b.bagWeight || o.bagWeight,
                createdAt: o.createdAt,
                createdBy: o.createdBy
            });
        });
    });

    // En yeni siparişler önce (operatör ekranı ile aynı sıralama)
    flattenedBatches.sort((a, b) => {
        if (a.orderId !== b.orderId) {
            return b.orderId - a.orderId;
        }
        return a.no - b.no;
    });

    if (flattenedBatches.length === 0) {
        dom.activeJobsList.innerHTML = '<tr><td colspan="11" class="p-8 text-center text-slate-500 italic">Aktif iş emri bulunmamaktadır.</td></tr>';
        return;
    }

    // Operatör ekranı ile aynı teslim tarihi grupları (Sıralama: Bugünün Siparişleri, Teslim Tarihi Geçenler, Gelecek Tarihli)
    const groups = {
        today: { title: 'Bugünün Siparişleri', items: [], color: 'text-orange-400', bg: 'bg-orange-500/10' },
        past: { title: 'Tarihi Geçen Siparişler', items: [], color: 'text-red-400', bg: 'bg-red-500/10' },
        future: { title: 'Gelecek Tarihli Siparişler', items: [], color: 'text-blue-400', bg: 'bg-blue-500/10' },
        nodate: { title: 'Tarihi Belirsiz', items: [], color: 'text-slate-400', bg: 'bg-slate-700/30' }
    };

    flattenedBatches.forEach(b => {
        if (!b.deliveryDate) {
            groups.nodate.items.push(b);
        } else if (b.deliveryDate === todayStr) {
            groups.today.items.push(b);
        } else if (b.deliveryDate < todayStr) {
            groups.past.items.push(b);
        } else {
            groups.future.items.push(b);
        }
    });


    const orderOfGroups = ['today', 'past', 'future', 'nodate'];


    orderOfGroups.forEach(key => {
        const g = groups[key];
        if (g.items.length === 0) return;

        const dividerTr = document.createElement('tr');
        dividerTr.className = 'section-divider';
        dividerTr.innerHTML = `
            <td colspan="11" class="py-3 px-4">
                <div class="flex items-center gap-3">
                    <div class="px-3 py-1.5 rounded-lg ${g.bg} ${g.color} font-bold tracking-wider text-sm border border-current opacity-80 uppercase whitespace-nowrap">
                        ${g.title}
                    </div>
                    <div class="h-px flex-1 bg-slate-800"></div>
                </div>
            </td>
        `;
        dom.activeJobsList.appendChild(dividerTr);

        g.items.forEach(b => {
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
            } else if (b.status === 'teslim edildi' || b.status === 'Teslim Edildi') {
                statusBadge = '<span class="badge-status bg-blue-900/50 text-blue-400 border-blue-500/30">Teslim Edildi</span>';
            } else {
                statusBadge = `<span class="badge-status bekliyor">${b.status}</span>`;
            }

            const canPrintReceipt = ['fiş kesilmedi', 'tamamlandı', 'Tamamlandı'].includes(b.status);
            const isCompleted = ['tamamlandı', 'Tamamlandı'].includes(b.status);
            const canCancel = true; // Her zaman iptal edilebilir
            const canManageOrders = state.currentUser.role === 'admin' || !!state.currentUser.canManageOrders;

            let cancelBtnStr = '';
            if (canManageOrders) {
                cancelBtnStr = `
                <button class="btn btn-red py-1 px-3 text-[10px] rounded btn-cancel-batch shadow-lg shadow-red-500/20" data-batch-id="${b.id}" title="Siparişi Sil">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5 inline"></i> Sil
                </button>
            `;
            }

            let actionBtnHtml = `
                <div class="flex flex-col gap-1 items-end">
                    <div class="flex gap-1">
                        <button class="btn btn-blue py-1 px-3 text-[10px] rounded btn-deliver-batch shadow-lg shadow-blue-500/20" data-batch-id="${b.id}">
                            <i data-lucide="check-circle-2" class="w-3.5 h-3.5 inline mr-1"></i> Teslim
                        </button>
                        ${cancelBtnStr}
                    </div>
                </div>
            `;

            let urgencyBadge = '<span class="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded font-bold uppercase tracking-wider text-[10px]">Normal</span>';
            if (b.urgency === 'acil') {
                urgencyBadge = '<span class="px-2 py-0.5 bg-red-950/80 text-red-400 border border-red-500/30 rounded font-bold uppercase tracking-wider text-[10px]">Acil</span>';
            } else if (b.urgency === 'rahat') {
                urgencyBadge = '<span class="px-2 py-0.5 bg-green-950/50 text-green-400 border border-green-500/20 rounded font-bold uppercase tracking-wider text-[10px]">Rahat</span>';
            } else if (b.urgency === 'normal') {
                urgencyBadge = '<span class="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded font-bold uppercase tracking-wider text-[10px]">Normal</span>';
            }

            tr.innerHTML = `
                <td class="px-2 py-3 font-bold text-white">${b.customer}</td>
                <td class="px-2 py-3"><a href="#" onclick="openEditOrderModal(${b.orderId}); return false;" class="text-orange-400 hover:text-orange-300 hover:underline cursor-pointer transition-colors" title="Siparişi Düzenle">${b.recipeName}</a></td>
                <td class="px-2 py-3 font-mono font-bold text-orange-400">${b.targetAmount.toFixed(2)} kg</td>
                <td class="px-2 py-3 text-slate-300 font-bold">${(!b.createdBy || b.createdBy === 'Sistem') ? 'Üretim Müdürü' : b.createdBy}</td>
                <td class="px-2 py-3 font-mono text-slate-400 text-xs">
                    ${b.createdAt ? `<div class='text-slate-300'>${new Date(b.createdAt).toLocaleDateString('tr-TR')}</div><div class='text-slate-500 text-[10px] mt-0.5'>${new Date(b.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>` : '-'}
                </td>
                <td class="px-2 py-3 text-slate-300">${b.operator}</td>
                <td class="px-2 py-3">${statusBadge}</td>
                
                <td class="px-2 py-3 text-right">${actionBtnHtml}</td>
                <td class="px-2 py-3">${urgencyBadge}</td>
                <td class="px-2 py-3 font-mono text-slate-400">Parti ${b.no}/${b.totalBatches}</td>
                <td class="px-2 py-3 font-mono text-xs text-slate-300">${b.deliveryDate || '-'}</td>
            `;

            tr.querySelector('.btn-deliver-batch')?.addEventListener('click', async () => {
                if (confirm('Bu siparişi teslim edildi olarak işaretlemek istediğinize emin misiniz?')) {
                    await apiPut(`/api/batches/${b.id}/status`, { status: 'teslim edildi' });
                    await fetchDb();
                    renderActiveJobsListTable();
                }
            });
            if (canManageOrders) {
                tr.querySelector('.btn-cancel-batch').addEventListener('click', async () => {
                    if (confirm('Bu iş emrini iptal etmek ve tüm ilgili tartım verilerini silmek istediğinize emin misiniz?')) {
                        await cancelBatch(b.id);
                    }
                });
            }

            dom.activeJobsList.appendChild(tr);
        });
    });
}

window.orderExtras = [];

window.renderOrderExtras = function () {
    const tbody = document.getElementById('order-extras-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (window.orderExtras.length === 0) {
        tbody.innerHTML = '<tr id="row-no-extras"><td colspan="4" class="p-3 text-center text-slate-500 italic">Siparişe özel ekstra ürün eklenmedi.</td></tr>';
        return;
    }

    window.orderExtras.forEach((extra, index) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors';
        const typeBadge = extra.type === 'mixer'
            ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-700/50">Miksere Girecek</span>'
            : '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-700/50">Ayrı Hazırlanacak</span>';

        tr.innerHTML = `
        <td class="p-2 font-bold text-slate-200">${extra.product}</td>
        <td class="p-2 font-mono text-orange-400">${parseFloat(extra.amount).toFixed(2)} gr</td>
        <td class="p-2">${typeBadge}</td>
        <td class="p-2 text-right">
            <button type="button" class="text-red-400 hover:text-red-300 btn-del-extra p-1" data-idx="${index}">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </td>
    `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-del-extra').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            window.orderExtras.splice(idx, 1);
            window.renderOrderExtras();
        });
    });

    if (window.lucide) window.lucide.createIcons();
};

document.addEventListener('DOMContentLoaded', () => {
    const btnAddExtra = document.getElementById('btn-add-order-extra');
    if (btnAddExtra) {
        btnAddExtra.addEventListener('click', () => {
            const product = document.getElementById('order-extra-product').value;
            const amount = document.getElementById('order-extra-amount').value;
            const isSeparateCheckbox = document.getElementById('order-extra-separate');
            const type = (isSeparateCheckbox && isSeparateCheckbox.checked) ? 'separate' : 'mixer';

            if (!product || !amount || parseFloat(amount) <= 0) {
                alert("Lütfen ürün seçin ve geçerli bir miktar girin.");
                return;
            }

            if (!window.orderExtras) window.orderExtras = [];
            window.orderExtras.push({
                product: product,
                amount: parseFloat(amount),
                type: type
            });

            document.getElementById('order-extra-product').value = '';
            document.getElementById('order-extra-amount').value = '';
            if (isSeparateCheckbox) isSeparateCheckbox.checked = false;
            window.renderOrderExtras();
        });
    }
});

window.editOrderExtras = [];

window.renderEditOrderExtras = function () {
    const tbody = document.getElementById('edit-order-extras-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (window.editOrderExtras.length === 0) {
        tbody.innerHTML = '<tr id="edit-row-no-extras"><td colspan="4" class="p-3 text-center text-slate-500 italic">Ekstra ürün bulunmuyor.</td></tr>';
        return;
    }

    window.editOrderExtras.forEach((extra, index) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors';
        const typeBadge = extra.type === 'mixer'
            ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-700/50">Miksere Girecek</span>'
            : '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-700/50">Ayrı Hazırlanacak</span>';

        tr.innerHTML = `
        <td class="p-2 font-bold text-slate-200">${extra.product}</td>
        <td class="p-2 font-mono text-orange-400">${parseFloat(extra.amount).toFixed(2)} gr</td>
        <td class="p-2">${typeBadge}</td>
        <td class="p-2 text-right">
            <button type="button" class="text-red-400 hover:text-red-300 btn-del-edit-extra p-1" data-idx="${index}">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </td>
    `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-del-edit-extra').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            window.editOrderExtras.splice(idx, 1);
            window.renderEditOrderExtras();
        });
    });

    if (window.lucide) window.lucide.createIcons();
};

document.addEventListener('DOMContentLoaded', () => {
    const btnAddEditExtra = document.getElementById('btn-add-edit-order-extra');
    if (btnAddEditExtra) {
        btnAddEditExtra.addEventListener('click', () => {
            const product = document.getElementById('edit-order-extra-product').value;
            const amount = document.getElementById('edit-order-extra-amount').value;
            const isSeparateCheckbox = document.getElementById('edit-order-extra-separate');
            const type = (isSeparateCheckbox && isSeparateCheckbox.checked) ? 'separate' : 'mixer';

            if (!product || !amount || parseFloat(amount) <= 0) {
                alert("Lütfen ürün seçin ve geçerli bir miktar girin.");
                return;
            }

            if (!window.editOrderExtras) window.editOrderExtras = [];
            window.editOrderExtras.push({
                product: product,
                amount: parseFloat(amount),
                type: type
            });

            document.getElementById('edit-order-extra-product').value = '';
            document.getElementById('edit-order-extra-amount').value = '';
            if (isSeparateCheckbox) isSeparateCheckbox.checked = false;
            window.renderEditOrderExtras();
        });
    }
});

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

function printBatchReceipt(batchId, isDetailed = false) {
    if (!batchId && window.receiptCurrentBatchId) {
        batchId = window.receiptCurrentBatchId;
    }

    let foundBatch = null;
    let foundOrder = null;
    for (const o of state.db.orders) {
        const b = o.batches.find(x => String(x.id) === String(batchId));
        if (b) {
            foundBatch = b;
            foundOrder = o;
            break;
        }
    }

    const batchLogs = state.db.logs.filter(log => String(log.batchId) === String(batchId));
    let logsToPrint = [];
    if (batchLogs.length > 0) {
        logsToPrint = batchLogs;
    } else if (foundOrder) {
        const recipe = state.db.recipes.find(r => r.name === foundOrder.recipeName || r.id === foundOrder.recipeId);
        if (recipe && recipe.items && recipe.items.length > 0) {
            const batchWeight = foundBatch ? (foundBatch.targetAmount || foundBatch.bagWeight || 100) : 100;
            logsToPrint = recipe.items.map(it => {
                let calculatedGrams = batchWeight * (it.amount || 0);
                if (recipe.isCustomKgBased) {
                    const totalRecipeGrams = recipe.items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                    const recipeTotalKg = totalRecipeGrams / 1000.0;
                    const effectiveMultiplier = batchWeight / recipeTotalKg;
                    calculatedGrams = effectiveMultiplier * (it.amount || 0);
                }
                return {
                    item: it.name,
                    target: calculatedGrams,
                    actual: calculatedGrams,
                    status: 'Başarılı'
                };
            });
        }
    }

    if (logsToPrint.length === 0) {
        logsToPrint = [{
            item: foundOrder ? foundOrder.recipeName : 'Karışım',
            target: foundBatch ? foundBatch.targetAmount : 0,
            actual: foundBatch ? foundBatch.targetAmount : 0,
            status: 'Başarılı'
        }];
    }

    const firstLog = logsToPrint[0];
    const customer = foundOrder ? foundOrder.customer : (firstLog ? firstLog.customer : 'Bilinmeyen Firma');
    const recipeName = foundOrder ? foundOrder.recipeName : (firstLog ? firstLog.recipe : 'Bilinmeyen Reçete');
    const operator = foundBatch ? (foundBatch.operator || 'Operatör') : 'Operatör';
    const batchNo = foundBatch ? foundBatch.no : 1;
    const totalBatches = foundBatch ? foundBatch.totalBatches : 1;

    let dateStr = new Date().toLocaleString('tr-TR');
    if (firstLog && firstLog.timestamp) {
        dateStr = new Date(firstLog.timestamp).toLocaleString('tr-TR');
    }

    // Determine ingredient prices
    const allSettings = state.db.settings || [];
    const priceObj = allSettings.find(s => s.key === 'ingredient_prices');
    let globalPrices = {};
    if (priceObj && priceObj.value) {
        try { globalPrices = JSON.parse(priceObj.value); } catch (e) { }
    }

    // Extract extraItems for receipt rendering
    const extraItemsData = [];
    document.querySelectorAll('.extra-item-row').forEach(row => {
        const name = row.querySelector('.extra-name')?.value || 'Ekstra Ürün';
        const qty = parseFloat(row.querySelector('.extra-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.extra-price')?.value) || 0;
        if (qty > 0) {
            extraItemsData.push({ name, qty, price });
        }
    });

    if (extraItemsData.length === 0 && foundBatch && foundBatch.extraItems) {
        try {
            const savedExtras = JSON.parse(foundBatch.extraItems);
            savedExtras.forEach(it => extraItemsData.push(it));
        } catch (e) { }
    }

    // Extract payments for receipt rendering
    const paymentsData = [];
    document.querySelectorAll('.payment-item-row').forEach(row => {
        const amount = parseFloat(row.querySelector('.payment-amount')?.value) || 0;
        const method = row.querySelector('.payment-method')?.value || 'Nakit';
        if (amount > 0) {
            paymentsData.push({ amount, method });
        }
    });

    if (paymentsData.length === 0 && foundBatch && foundBatch.payments) {
        try {
            const savedPayments = JSON.parse(foundBatch.payments);
            savedPayments.forEach(p => paymentsData.push(p));
        } catch (e) { }
    }

    let totalPaid = paymentsData.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paymentMethodStr = paymentsData.length > 0 ? paymentsData.map(p => `${p.method}: ${p.amount.toFixed(2)} TL`).join(', ') : 'Açık Hesap';

    // Determine initial order target weight (KG) entered when creating the order
    const orderTargetKg = foundBatch ? (foundBatch.targetAmount || foundBatch.bagWeight || 100) : (foundOrder ? (foundOrder.totalAmount || 100) : 100);

    // Calculate raw recipe cost from the actual recipe formula (1 KG Maliyet)
    let recipe1KgPrice = 0;
    const recipeObj = (state.db.recipes || []).find(r => r.name === recipeName || r.id === foundOrder?.recipeId);

    if (recipeObj && recipeObj.items && recipeObj.items.length > 0) {
        let mixCost = 0;
        let separateCost = 0;
        recipeObj.items.forEach(item => {
            const { pricePerKg } = resolveRecipeItemUnitPrice(item, globalPrices);
            const lineCost = calcRecipeLineTotal(item.amount, pricePerKg);
            if (item.is_separate) separateCost += lineCost;
            else mixCost += lineCost;
        });
        recipe1KgPrice = mixCost + separateCost;
    } else if (recipeObj && (recipeObj.price_per_kg || recipeObj.pricePerKg)) {
        recipe1KgPrice = recipeObj.price_per_kg || recipeObj.pricePerKg;
    }
    let recipeTotalCost = 0;
    let producedSpiceGrams = 0;
    logsToPrint.forEach(log => {
        let pricePerKg = 0;
        if (log.item in globalPrices && globalPrices[log.item]) {
            pricePerKg = globalPrices[log.item];
        } else {
            const recipeObj = state.db.recipes.find(r => r.name === foundOrder?.recipeName || r.id === foundOrder?.recipeId);
            if (recipeObj && recipeObj.items) {
                const recItem = recipeObj.items.find(i => i.name === log.item);
                if (recItem && recItem.unit_price) pricePerKg = recItem.unit_price;
            }
        }
        const unitCost = pricePerKg * ((log.actual || 0) / 1000);
        recipeTotalCost += unitCost;
        producedSpiceGrams += (log.actual || 0);
    });

    const producedSpiceKg = producedSpiceGrams > 0 ? (producedSpiceGrams / 1000) : orderTargetKg;
    let spice1KgPrice = recipe1KgPrice;

    if (recipeTotalCost > 0 && producedSpiceKg > 0) {
        spice1KgPrice = recipeTotalCost / producedSpiceKg;
    } else {
        if (!spice1KgPrice || spice1KgPrice === 0) spice1KgPrice = 150.0;
        recipeTotalCost = spice1KgPrice * producedSpiceKg;
    }

    // Build Table Rows (Row 1: Main Recipe; Rows 2+: Extra Products)
    let tableRowsHtml = '';
    let itemIndex = 1;
    let totalItemCount = 1;
    let grandWeightKg = producedSpiceKg;

    tableRowsHtml += `
        <tr>
            <td>${itemIndex++}</td>
            <td><strong>${recipeName}</strong></td>
            <td class="text-right font-mono">${orderTargetKg.toFixed(2)}/KG</td>
            <td class="text-right font-mono">TL ${spice1KgPrice.toFixed(2)}</td>
            <td class="text-right font-mono font-bold">TL ${recipeTotalCost.toFixed(2)}</td>
        </tr>
    `;

    let extraTotal = 0;
    const hasExtra = extraItemsData.length > 0;
    if (hasExtra) {
        extraItemsData.forEach(item => {
            const itemQty = item.qty || 0;
            const itemPrice = item.price || 0;
            const itemTotal = itemQty * itemPrice;
            extraTotal += itemTotal;
            grandWeightKg += itemQty;
            totalItemCount++;

            tableRowsHtml += `
                <tr>
                    <td>${itemIndex++}</td>
                    <td><strong>${item.name}</strong></td>
                    <td class="text-right font-mono">${itemQty.toFixed(2)}/KG</td>
                    <td class="text-right font-mono">TL ${itemPrice.toFixed(2)}</td>
                    <td class="text-right font-mono font-bold">TL ${itemTotal.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    const grandTotal = recipeTotalCost + extraTotal;

    const receiptHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>TEKLİF FORMU - ${batchId}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                * { box-sizing: border-box; }
                body {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    color: #222;
                    background: #f4f4f5;
                    margin: 0;
                    padding: 24px;
                    font-size: 13px;
                    line-height: 1.4;
                }
                .action-bar {
                    max-width: 960px;
                    margin: 0 auto 16px auto;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }
                .action-btn {
                    padding: 9px 16px;
                    border-radius: 8px;
                    border: none;
                    font-weight: 700;
                    font-size: 13px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                    transition: all 0.2s;
                }
                .btn-share { background: #10b981; color: #fff; }
                .btn-share:hover { background: #059669; }
                .btn-print { background: #2563eb; color: #fff; }
                .btn-print:hover { background: #1d4ed8; }
                .btn-download { background: #ea580c; color: #fff; }
                .btn-download:hover { background: #c2410c; }

                .invoice-paper {
                    max-width: 960px;
                    margin: 0 auto;
                    background: #fff;
                    padding: 40px;
                    border-radius: 6px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
                    min-height: 550px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }

                .invoice-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 30px;
                }
                .header-left .form-title {
                    font-size: 20px;
                    font-weight: 800;
                    color: #111;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .header-left .location {
                    font-size: 14px;
                    color: #444;
                    margin-top: 4px;
                }

                .header-right {
                    text-align: right;
                    font-size: 13px;
                }
                .header-right .satis-kodu-label {
                    font-size: 13px;
                    color: #555;
                }
                .header-right .satis-kodu-val {
                    font-size: 16px;
                    font-weight: 400;
                    color: #222;
                    margin-bottom: 4px;
                }
                .header-right .customer-name {
                    font-size: 17px;
                    font-weight: 700;
                    color: #000;
                    margin-bottom: 4px;
                }
                .header-right .meta-item {
                    color: #333;
                    margin-bottom: 2px;
                    font-weight: 500;
                }

                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 24px;
                }
                .items-table th {
                    text-align: left;
                    font-weight: 600;
                    color: #555;
                    font-size: 12px;
                    padding: 8px 6px;
                    border-bottom: 1px solid #ccc;
                }
                .items-table td {
                    padding: 10px 6px;
                    color: #222;
                    font-size: 13px;
                    border-bottom: 1px solid #f0f0f0;
                }
                .items-table th.text-right, .items-table td.text-right {
                    text-align: right;
                }
                .items-table th.text-center, .items-table td.text-center {
                    text-align: center;
                }
                .font-mono {
                    font-family: monospace;
                }

                .totals-summary-box {
                    min-width: 260px;
                    text-align: right;
                    font-size: 13px;
                    line-height: 1.8;
                }
                .totals-summary-box .totals-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 20px;
                }
                .totals-summary-box .totals-row span:first-child {
                    color: #555;
                }
                .totals-summary-box .totals-row span:last-child {
                    font-weight: 600;
                }
                .totals-summary-box .grand-total {
                    font-size: 16px;
                    font-weight: 800;
                    margin-top: 6px;
                    padding-top: 6px;
                    border-top: 1px solid #ccc;
                    color: #000;
                }

                .bottom-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                }

                .customer-info-box {
                    font-size: 13px;
                    color: #222;
                    line-height: 1.7;
                }
                .customer-info-box .title {
                    font-weight: 800;
                    font-size: 14px;
                    margin-bottom: 6px;
                }
                .customer-info-box .info-row {
                    margin-bottom: 2px;
                }

                @media print {
                    body { background: #fff; padding: 0; margin: 0; }
                    .action-bar { display: none !important; }
                    .invoice-paper { box-shadow: none; max-width: 100%; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="action-bar">
                <button class="action-btn btn-share" onclick="shareReceipt()">
                    <span>📲 Paylaş</span>
                </button>
                <button class="action-btn btn-print" onclick="window.print()">
                    <span>🖨️ Yazdır</span>
                </button>
                <button class="action-btn btn-download" onclick="downloadReceipt()">
                    <span>📥 İndir</span>
                </button>
            </div>

            <div class="invoice-paper" id="printable-receipt-card">
                <div>
                    <!-- Header Left & Right -->
                    <div class="invoice-header">
                        <div class="header-left">
                            <div class="form-title">TEKLİF FORMU</div>
                            <div class="location">/ Afyonkarahisar</div>
                        </div>
                        <div class="header-right">
                            <div class="satis-kodu-label">Satış Kodu</div>
                            <div class="satis-kodu-val">${batchId}</div>
                            <div class="customer-name">${customer}</div>
                            <div class="meta-item">Tarih : ${dateStr}</div>
                            <div class="meta-item">Ödeme Tipi : ${paymentMethodStr}</div>
                        </div>
                    </div>

                    <!-- Items Table (İskonto column REMOVED) -->
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 50px;">Sıra</th>
                                <th>Ürünler</th>
                                <th class="text-right" style="width: 150px;">Miktar</th>
                                <th class="text-right" style="width: 150px;">Birim Fiyatı</th>
                                <th class="text-right" style="width: 150px;">Tutar</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>

                <div>
                    <!-- Right Aligned Totals -->
                    <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
                        <div class="totals-summary-box">
                            <div class="totals-row">
                                <span>Toplam Ürün :</span>
                                <span>${totalItemCount.toFixed(2)}</span>
                            </div>
                            <div class="totals-row">
                                <span>Toplam Miktar :</span>
                                <span>${grandWeightKg.toFixed(2)}</span>
                            </div>
                            <div class="totals-row grand-total">
                                <span>Toplam :</span>
                                <span>TL ${grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Bottom Left Customer Info & Payments -->
                    <div class="bottom-section">
                        <div class="customer-info-box">
                            <div class="title">Müşteri Bilgileri</div>
                            <div class="info-row">Ödeme Yöntemi : <strong>${paymentMethodStr}</strong></div>
                            <div class="info-row">Önceki bakiye : TL 0.00</div>
                            <div class="info-row">Bugün yapılan ödeme : TL ${totalPaid.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div class="info-row">Kalan borç : TL ${(grandTotal - totalPaid).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div class="info-row" style="margin-top: 6px;">İşlem yapan : <strong>${operator.toUpperCase()}</strong></div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                function downloadReceipt() {
                    const text = document.getElementById('printable-receipt-card').innerText;
                    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'Teklif_Formu_${batchId}.txt';
                    a.click();
                }

                async function shareReceipt() {
                    const text = document.getElementById('printable-receipt-card').innerText;
                    if (navigator.share) {
                        try {
                            await navigator.share({
                                title: 'Teklif Formu - ${batchId}',
                                text: text
                            });
                        } catch (err) {}
                    } else {
                        navigator.clipboard.writeText(text);
                        alert('Form metni panoya kopyalandı! Dilediğiniz uygulamada yapıştırarak paylaşabilirsiniz.');
                    }
                }
            </script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
    } else {
        let iframe = document.getElementById('receipt-print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'receipt-print-iframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
        }
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(receiptHtml);
        doc.close();
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }

    // Extract extraItems for saving
    const savedExtraItems = [];
    document.querySelectorAll('.extra-item-row').forEach(row => {
        const name = row.querySelector('.extra-name')?.value || 'Ekstra Ürün';
        const qty = parseFloat(row.querySelector('.extra-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.extra-price')?.value) || 0;
        if (qty > 0) {
            savedExtraItems.push({ name, qty, price });
        }
    });

    // Extract payments for saving
    const savedPayments = [];
    document.querySelectorAll('.payment-item-row').forEach(row => {
        const amount = parseFloat(row.querySelector('.payment-amount')?.value) || 0;
        const method = row.querySelector('.payment-method')?.value || 'Nakit';
        if (amount > 0) {
            savedPayments.push({ amount, method });
        }
    });

    // Close extra modal
    const modal = document.getElementById('modal-extra-items');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    // Save extraItems and payments, then transition status
    if (batchId) {
        apiPut(`/api/batches/${batchId}/extra_items`, { extraItems: savedExtraItems, payments: savedPayments })
            .then(() => {
                return apiPut(`/api/batches/${batchId}/status`, { status: 'tamamlandı' });
            })
            .then(async () => {
                await fetchDb();
                if (state.view === 'admin') {
                    renderAdminPanel();
                }
            })
            .catch((err) => { console.error("Error updating batch receipt status:", err); });
    }
}

window.printBatchReceipt = printBatchReceipt;

// 2. RECIPES TAB
function isRecipeActive(recipe) {
    return recipe && recipe.isActive !== false;
}

function getRecipeOrderIngredients() {
    const settingObj = (state.db.settings || []).find(s => s.key === 'recipe_order');
    if (settingObj && settingObj.value) {
        return settingObj.value.split('\n').map(s => s.trim()).filter(Boolean);
    }
    return [];
}

function getGlobalIngredientPrices() {
    const priceObj = (state.db.settings || []).find(s => s.key === 'ingredient_prices');
    let globalPrices = {};
    if (priceObj && priceObj.value) {
        try { globalPrices = JSON.parse(priceObj.value); } catch (e) { }
    }
    return globalPrices;
}

function resolveRecipeItemUnitPrice(item, globalPrices) {
    if (item.unit_price != null && item.unit_price !== '') {
        return { pricePerKg: Number(item.unit_price), isCustom: true };
    }
    const global = globalPrices[item.name];
    return { pricePerKg: global != null ? Number(global) : 0, isCustom: false };
}

function calcRecipeLineTotal(amountGr, pricePerKg) {
    return (Number(amountGr) / 1000) * Number(pricePerKg);
}

function renderRecipePriceBadge(isCustom) {
    return isCustom
        ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold whitespace-nowrap">Özel Fiyat</span>'
        : '<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-400 border border-slate-600 font-bold whitespace-nowrap">Genel Fiyat</span>';
}


let recipeIngredientsSortable = null;
let settingsIngredientsSortable = null;

function destroyRecipeIngredientsSortable() {
    if (recipeIngredientsSortable) {
        recipeIngredientsSortable.destroy();
        recipeIngredientsSortable = null;
    }
}

function destroySettingsIngredientsSortable() {
    if (settingsIngredientsSortable) {
        settingsIngredientsSortable.destroy();
        settingsIngredientsSortable = null;
    }
}

function bindRecipeExportCsv(recipe, globalPrices) {
    const btn = document.getElementById('btn-export-recipe-csv');
    if (!btn || !recipe) return;

    btn.onclick = () => {
        const rows = [['Sıra', 'Hammadde', 'Miktar (gr)', 'Birim Fiyat (TL/kg)', 'Toplam (TL)', 'Ayrı Hazırlanır', 'Tolerans (gr)']];
        (recipe.items || []).forEach((item, i) => {
            const { pricePerKg } = resolveRecipeItemUnitPrice(item, globalPrices);
            rows.push([
                i + 1,
                item.name,
                item.amount.toFixed(2),
                pricePerKg.toFixed(2),
                calcRecipeLineTotal(item.amount, pricePerKg).toFixed(2),
                item.is_separate ? 'Evet' : 'Hayır',
                item.tolerance.toFixed(2)
            ]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${recipe.name.replace(/[^\w\s-]/g, '')}_recete.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };
}

async function saveRecipeItemField(recipeId, itemId, data) {
    try {
        const res = await apiPut(`/api/recipes/${recipeId}/items/${itemId}`, data);
        if (res && res.recipe) {
            const idx = state.db.recipes.findIndex(r => Number(r.id) === Number(recipeId));
            if (idx >= 0) state.db.recipes[idx] = res.recipe;
        }
        return res;
    } catch (e) {
        return null;
    }
}

window.pendingRecipeEdits = window.pendingRecipeEdits || {};

function updateFloatingRecipeSaveButton() {
    const btn = document.getElementById('container-floating-recipe-save');
    const count = Object.keys(window.pendingRecipeEdits || {}).length;
    if (btn) {
        if (count > 0) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    }
}

function bindRecipeIngredientInlineEdits(recipe) {
    const refreshRowTotal = (row) => {
        const itemId = Number(row.dataset.itemId);
        const currentRecipe = state.db.recipes.find(r => Number(r.id) === Number(recipe.id)) || recipe;
        const item = (currentRecipe.items || []).find(i => Number(i.id) === itemId);
        if (!item) return;

        const globalPrices = getGlobalIngredientPrices();
        const amountInput = row.querySelector('.item-amount');
        const priceInput = row.querySelector('.item-unit-price');
        const amount = parseFloat(String(amountInput?.value || '').replace(',', '.')) || 0;
        const priceStr = String(priceInput?.value || '').trim();
        let pricePerKg;
        if (priceStr) {
            pricePerKg = parseFloat(priceStr.replace(',', '.')) || 0;
        } else {
            pricePerKg = globalPrices[item.name] != null ? Number(globalPrices[item.name]) : 0;
        }

        if (priceInput) {
            if (priceStr) {
                priceInput.classList.remove('border-slate-700', 'text-slate-200', 'focus:border-blue-500');
                priceInput.classList.add('border-orange-500', 'text-orange-400', 'focus:border-orange-400');
            } else {
                priceInput.classList.remove('border-orange-500', 'text-orange-400', 'focus:border-orange-400');
                priceInput.classList.add('border-slate-700', 'text-slate-200', 'focus:border-blue-500');
            }
        }

        const totalEl = row.querySelector('.item-line-total');
        const notIncInput = row.querySelector('.item-is-not-included');
        const isNotIncluded = notIncInput ? notIncInput.checked : !!item.is_not_included;

        if (totalEl) {
            if (isNotIncluded) {
                totalEl.textContent = '0.00 ₺';
                totalEl.classList.remove('text-emerald-400');
                totalEl.classList.add('text-slate-500', 'line-through');
            } else {
                totalEl.textContent = `${calcRecipeLineTotal(amount, pricePerKg).toFixed(2)} ₺`;
                totalEl.classList.add('text-emerald-400');
                totalEl.classList.remove('text-slate-500', 'line-through');
            }
        }
    };



    dom.recipeIngredientsList.querySelectorAll('.item-amount, .item-unit-price').forEach(input => {
        input.addEventListener('input', () => {
            const itemId = Number(input.dataset.itemId);
            window.pendingRecipeEdits[itemId] = window.pendingRecipeEdits[itemId] || {};

            if (input.classList.contains('item-amount')) {
                const val = parseFloat(String(input.value).replace(',', '.'));
                if (!isNaN(val)) window.pendingRecipeEdits[itemId].amount = val;
            } else if (input.classList.contains('item-unit-price')) {
                const raw = String(input.value).trim();
                window.pendingRecipeEdits[itemId].unit_price = raw ? parseFloat(raw.replace(',', '.')) : null;
            }

            updateFloatingRecipeSaveButton();
            refreshRowTotal(input.closest('.recipe-item-row'));
            updateMixerSummaryDom();
        });
    });

    dom.recipeIngredientsList.querySelectorAll('.item-amount').forEach(input => {
        input.addEventListener('blur', () => {
            const itemId = Number(input.dataset.itemId);
            const val = parseFloat(String(input.value).replace(',', '.'));
            if (isNaN(val)) return;

            window.pendingRecipeEdits[itemId] = window.pendingRecipeEdits[itemId] || {};
            window.pendingRecipeEdits[itemId].amount = val;
            updateFloatingRecipeSaveButton();
        });
    });

    dom.recipeIngredientsList.querySelectorAll('.item-tolerance').forEach(input => {
        input.addEventListener('input', () => {
            const itemId = Number(input.dataset.itemId);
            const val = parseFloat(String(input.value).replace(',', '.'));
            if (!isNaN(val)) {
                window.pendingRecipeEdits[itemId] = window.pendingRecipeEdits[itemId] || {};
                window.pendingRecipeEdits[itemId].tolerance = val;
                updateFloatingRecipeSaveButton();
            }
        });

        input.addEventListener('blur', () => {
            const itemId = Number(input.dataset.itemId);
            const val = parseFloat(String(input.value).replace(',', '.'));
            if (isNaN(val)) return;

            window.pendingRecipeEdits[itemId] = window.pendingRecipeEdits[itemId] || {};
            window.pendingRecipeEdits[itemId].tolerance = val;
            updateFloatingRecipeSaveButton();
        });
    });

    dom.recipeIngredientsList.querySelectorAll('.item-unit-price').forEach(input => {
        input.addEventListener('blur', () => {
            const itemId = Number(input.dataset.itemId);
            const raw = String(input.value).trim();
            const val = raw ? parseFloat(raw.replace(',', '.')) : null;

            window.pendingRecipeEdits[itemId] = window.pendingRecipeEdits[itemId] || {};
            window.pendingRecipeEdits[itemId].unit_price = val;
            updateFloatingRecipeSaveButton();
            refreshRowTotal(input.closest('.recipe-item-row'));
            updateMixerSummaryDom();
        });
    });

    dom.recipeIngredientsList.querySelectorAll('.item-is-separate').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const itemId = Number(checkbox.dataset.itemId);

            window.pendingRecipeEdits[itemId] = window.pendingRecipeEdits[itemId] || {};
            window.pendingRecipeEdits[itemId].is_separate = checkbox.checked;
            updateFloatingRecipeSaveButton();
            updateMixerSummaryDom();
        });
    });

    dom.recipeIngredientsList.querySelectorAll('.item-is-not-included').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const itemId = Number(checkbox.dataset.itemId);

            window.pendingRecipeEdits[itemId] = window.pendingRecipeEdits[itemId] || {};
            window.pendingRecipeEdits[itemId].is_not_included = checkbox.checked;
            updateFloatingRecipeSaveButton();
            refreshRowTotal(checkbox.closest('.recipe-item-row'));
            updateMixerSummaryDom();
        });
    });
}

function updateMixerSummaryDom() {
    const container = document.getElementById('mixer-summary-container');
    if (!container) return;

    const activeId = state.activeRecipeId;
    if (!activeId) return;

    const recipe = state.db.recipes.find(r => Number(r.id) === Number(activeId));
    if (!recipe) return;

    const globalPrices = getGlobalIngredientPrices();

    const colorSettings = state.db.settings?.find(s => s.key === 'color_ingredients');
    let colorIngredients = [];
    if (colorSettings && colorSettings.value) {
        try { colorIngredients = JSON.parse(colorSettings.value); } catch (e) { }
    }

    // Evaluate live state
    let mixer = { count: 0, gr: 0, cost: 0 };
    let color = { count: 0, gr: 0, cost: 0 };
    let separate = { count: 0, gr: 0, cost: 0 };
    let total = { count: 0, gr: 0, cost: 0 };

    (recipe.items || []).forEach(item => {
        // Overlay pending edits
        const pending = window.pendingRecipeEdits[item.id] || {};
        const isSep = pending.is_separate !== undefined ? pending.is_separate : !!item.is_separate;
        const isNotInc = pending.is_not_included !== undefined ? pending.is_not_included : !!item.is_not_included;
        const isColor = colorIngredients.includes(item.name);

        if (!isNotInc) {
            const amt = pending.amount !== undefined ? pending.amount : (item.amount || 0);

            const pUnit = pending.unit_price !== undefined ? pending.unit_price : item.unit_price;
            let pPerKg = 0;
            if (pUnit != null && pUnit !== '') {
                pPerKg = Number(pUnit);
            } else {
                pPerKg = globalPrices[item.name] != null ? Number(globalPrices[item.name]) : 0;
            }

            const lineCost = calcRecipeLineTotal(amt, pPerKg);

            // Add to total
            total.count++;
            total.gr += amt;
            total.cost += lineCost;

            if (!isSep) {
                // Miksere Girenler
                mixer.count++;
                mixer.gr += amt;
                mixer.cost += lineCost;
            } else if (isColor) {
                // Renkler
                color.count++;
                color.gr += amt;
                color.cost += lineCost;
            } else {
                // Ayrı Hazırlananlar
                separate.count++;
                separate.gr += amt;
                separate.cost += lineCost;
            }
        }
    });

    const createTable = (title, icon, data, theme) => `
        <div class="bg-${theme}-900/10 border border-${theme}-500/20 rounded-xl overflow-hidden mt-4">
            <div class="px-4 py-2 border-b border-${theme}-500/20 bg-${theme}-950/40 flex items-center gap-2">
                <i data-lucide="${icon}" class="w-4 h-4 text-${theme}-400"></i>
                <h3 class="text-sm font-bold text-${theme}-400">${title}</h3>
            </div>
            <div class="p-4 grid grid-cols-3 gap-4 text-center divide-x divide-${theme}-800/50">
                <div>
                    <div class="text-xs text-slate-400 mb-1">Ürün Adedi</div>
                    <div class="font-mono font-bold text-slate-200 text-lg">${data.count}</div>
                </div>
                <div>
                    <div class="text-xs text-slate-400 mb-1">Toplam Miktar</div>
                    <div class="font-mono font-bold text-blue-400 text-lg">${data.gr.toFixed(2)} gr</div>
                </div>
                <div>
                    <div class="text-xs text-slate-400 mb-1">Toplam Maliyet</div>
                    <div class="font-mono font-bold text-${theme}-400 text-lg">${data.cost.toFixed(2)} ₺</div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="grid grid-cols-1 gap-2">
            ${createTable('Miksere Girenler', 'flask-conical', mixer, 'emerald')}
            ${createTable('Renkler', 'palette', color, 'rose')}
            ${createTable('Ayrı Hazırlananlar', 'layers', separate, 'amber')}
            ${createTable('Genel Özet', 'calculator', total, 'slate')}
        </div>
    `;

    // Update subtitle text if exists
    const subtitleEl = document.getElementById('recipe-subtitle');
    if (subtitleEl) {
        if (recipe.isCustomKgBased) {
            const totalKg = total.gr / 1000.0;
            subtitleEl.textContent = `${totalKg.toFixed(2)} KG BAZ KARIŞIM PARAMETRELERİ`;
        } else {
            subtitleEl.textContent = `100 KG BAZ KARIŞIM PARAMETRELERİ`;
        }
    }

    // We added lucide icons dynamically, so trigger a render
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function renderRecipeIngredientsTable(recipe, canManageRecipes) {
    const globalPrices = getGlobalIngredientPrices();
    dom.recipeIngredientsList.innerHTML = '';
    destroyRecipeIngredientsSortable();

    const orderSetting = state.db.settings?.find(s => s.key === 'recipe_order')?.value || '';
    const orderList = orderSetting.split('\n').map(s => s.trim()).filter(s => s);
    const getOrderIdx = (name) => {
        const idx = orderList.indexOf(name);
        return idx !== -1 ? idx : 999999;
    };

    const items = [...(recipe.items || [])].sort((a, b) => {
        const idxA = getOrderIdx(a.name);
        const idxB = getOrderIdx(b.name);
        if (idxA !== idxB) return idxA - idxB;
        return a.name.localeCompare(b.name, 'tr-TR');
    });

    if (items.length === 0) {
        dom.recipeIngredientsList.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-500 italic">Reçete içeriği boş. Lütfen baharat ekleyin.</td></tr>';
        updateMixerSummaryDom();
        bindRecipeExportCsv(recipe, globalPrices);
        return;
    }

    items.forEach((item, index) => {
        const { pricePerKg, isCustom } = resolveRecipeItemUnitPrice(item, globalPrices);
        const lineTotal = calcRecipeLineTotal(item.amount, pricePerKg);
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-850 hover:bg-slate-900/10 recipe-item-row';
        tr.dataset.itemId = item.id;

        const dragHandle = '<td class="p-2"></td>'; // Manual sorting disabled, forced to global setting

        const amountCell = canManageRecipes
            ? `<input type="text" inputmode="decimal" class="input-field w-24 py-1 px-2 text-sm font-mono item-amount" value="${item.amount.toFixed(2)}" data-item-id="${item.id}">`
            : `<span class="font-mono font-bold text-blue-400">${item.amount.toFixed(2)} gr</span>`;

        let priceCell;
        const customInputClasses = isCustom ? 'border-orange-500 text-orange-400 focus:border-orange-400' : 'border-slate-700 text-slate-200 focus:border-blue-500';
        const customTextClass = isCustom ? 'text-orange-400' : 'text-slate-300';

        if (canManageRecipes) {
            priceCell = `
                <div class="flex flex-col gap-1 min-w-[7rem]">
                    <input type="text" inputmode="decimal" class="input-field w-28 py-1 px-2 text-sm font-mono item-unit-price ${customInputClasses}" value="${isCustom ? item.unit_price.toFixed(2) : ''}" placeholder="${!isCustom && pricePerKg ? pricePerKg.toFixed(2) : ''}" data-item-id="${item.id}" title="${isCustom ? 'Özel fiyat' : 'Genel fiyat'}">
                </div>`;
        } else {
            priceCell = `<div class="flex items-center gap-2 flex-wrap"><span class="font-mono ${customTextClass}">${pricePerKg.toFixed(2)} ₺</span></div>`;
        }

        const notIncludedCell = canManageRecipes
            ? `<label class="relative inline-flex items-center cursor-pointer justify-center group">
                 <input type="checkbox" class="sr-only peer item-is-not-included" ${item.is_not_included ? 'checked' : ''} data-item-id="${item.id}">
                 <div class="w-6 h-6 border-2 border-slate-600 rounded-full group-hover:border-red-400 peer-checked:border-red-500 peer-checked:bg-red-500/20 transition-all flex items-center justify-center">
                     <div class="w-3 h-3 rounded-full bg-red-500 scale-0 peer-checked:scale-100 transition-transform"></div>
                 </div>
               </label>`
            : (item.is_not_included ? '<span class="text-red-400 font-bold">✓</span>' : '-');

        const separateCell = canManageRecipes
            ? `<label class="relative inline-flex items-center cursor-pointer justify-center">
                 <input type="checkbox" class="sr-only peer item-is-separate" ${item.is_separate ? 'checked' : ''} data-item-id="${item.id}">
                 <div class="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-orange-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
               </label>`
            : (item.is_separate ? '<span class="text-orange-400 font-bold">✓</span>' : '-');

        const toleranceCell = canManageRecipes
            ? `<input type="text" inputmode="decimal" class="input-field w-20 py-1 px-2 text-sm font-mono item-tolerance" value="${item.tolerance.toFixed(2)}" data-item-id="${item.id}">`
            : `<span class="font-mono text-slate-400">± ${item.tolerance.toFixed(2)}</span>`;

        const deleteBtn = canManageRecipes
            ? `<button type="button" class="btn-trash" data-item-id="${item.id}" title="Sil"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
            : '-';

        const lineTotalHtml = item.is_not_included
            ? `<td class="p-3 font-mono font-bold text-slate-500 line-through item-line-total">0.00 ₺</td>`
            : `<td class="p-3 font-mono font-bold text-emerald-400 item-line-total">${lineTotal.toFixed(2)} ₺</td>`;

        tr.innerHTML = `
            ${dragHandle}
            <td class="p-3 font-mono text-slate-500 item-sort-index">${index + 1}</td>
            <td class="p-3 font-bold text-slate-200">${item.name}</td>
            <td class="p-3">${amountCell}</td>
            <td class="p-3">${priceCell}</td>
            ${lineTotalHtml}
            <td class="p-2 text-center">${notIncludedCell}</td>
            <td class="p-2 text-center">${separateCell}</td>
            <td class="p-2 text-center">${toleranceCell}</td>
            <td class="p-3 text-center">${deleteBtn}</td>
        `;

        if (canManageRecipes) {
            tr.querySelector('.btn-trash')?.addEventListener('click', async (e) => {
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

    if (canManageRecipes) {
        bindRecipeIngredientInlineEdits(recipe);
        // Manual sorting via Sortable removed since it's forced by global settings
    }

    bindRecipeExportCsv(recipe, globalPrices);
    updateMixerSummaryDom();

    if (canManageRecipes) {
        const toggleCustomKg = document.getElementById('toggle-custom-kg-based');
        if (toggleCustomKg) {
            // Set initial state without triggering onchange
            toggleCustomKg.checked = !!recipe.isCustomKgBased;

            toggleCustomKg.onchange = async (e) => {
                const checked = e.target.checked;
                const res = await apiPut(`/api/recipes/${recipe.id}`, { is_custom_kg_based: checked });
                if (res && res.success) {
                    recipe.isCustomKgBased = checked;
                    updateMixerSummaryDom();
                } else {
                    e.target.checked = !checked;
                }
            };
        }
    }
}


window.pendingGlobalPriceChanges = window.pendingGlobalPriceChanges || {};

function updateFloatingPriceSaveButton() {
    const container = document.getElementById('container-floating-save-prices');
    const badge = document.getElementById('badge-price-changes');
    const count = Object.keys(window.pendingGlobalPriceChanges || {}).length;
    if (container) container.classList.toggle('hidden', count === 0);
    if (badge) badge.textContent = String(count);
}

function trackGlobalPriceChange(name, newPrice) {
    const globalPrices = getGlobalIngredientPrices();
    const oldPrice = globalPrices[name] ?? 0;
    const parsed = parseFloat(String(newPrice).replace(',', '.'));
    if (isNaN(parsed) || Math.abs(parsed - oldPrice) < 0.001) {
        delete window.pendingGlobalPriceChanges[name];
    } else {
        window.pendingGlobalPriceChanges[name] = { old: oldPrice, new: parsed };
    }
    updateFloatingPriceSaveButton();
}

function renderGlobalPriceChangesSummary() {
    const el = document.getElementById('global-price-changes-summary');
    if (!el) return;
    const changes = window.pendingGlobalPriceChanges;
    const names = Object.keys(changes);
    if (names.length === 0) {
        el.innerHTML = '<span class="text-slate-500 italic text-sm">Değişiklik yok.</span>';
        return;
    }
    el.innerHTML = names.map(name => {
        const c = changes[name];
        const diff = c.new - c.old;
        const diffClass = diff >= 0 ? 'text-emerald-400' : 'text-red-400';
        return `
            <div class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs">
                <div class="font-bold text-slate-200">${name}</div>
                <div class="font-mono text-slate-400 mt-1">${c.old.toFixed(2)} → <span class="text-white font-bold">${c.new.toFixed(2)} ₺</span></div>
                <div class="font-mono ${diffClass} mt-0.5">${diff >= 0 ? '+' : ''}${diff.toFixed(2)} ₺</div>
            </div>`;
    }).join('');
}

function renderGlobalPriceTargetTree() {
    const tree = document.getElementById('gp-target-tree');
    if (!tree) return;

    let html = '';
    (state.db.firms || []).forEach(firm => {
        const recipes = (state.db.recipes || []).filter(r => Number(r.firmId) === Number(firm.id) && isRecipeActive(r));
        if (recipes.length === 0) return;
        html += `
            <div class="mb-4 pb-3 border-b border-slate-800/60 last:border-0">
                <label class="flex items-center gap-2 font-bold text-slate-200 mb-2 cursor-pointer">
                    <input type="checkbox" class="gp-firm-check w-4 h-4 accent-purple-500" data-firm-id="${firm.id}">
                    <span>${firm.name}</span>
                    <span class="text-[10px] text-slate-500 font-mono">(${recipes.length} reçete)</span>
                </label>
                <div class="pl-6 space-y-1.5">
                    ${recipes.map(r => `
                        <label class="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-slate-200 transition-colors">
                            <input type="checkbox" class="gp-recipe-check w-4 h-4 accent-purple-500" data-recipe-id="${r.id}" data-firm-id="${firm.id}" data-created-at="${r.createdAt || ''}">
                            <span>${r.name}</span>
                        </label>
                    `).join('')}
                </div>
            </div>`;
    });

    tree.innerHTML = html || '<p class="text-slate-500 italic text-sm p-2">Uygulanacak reçete bulunamadı.</p>';

    tree.querySelectorAll('.gp-firm-check').forEach(firmCb => {
        firmCb.addEventListener('change', () => {
            const firmId = firmCb.dataset.firmId;
            tree.querySelectorAll(`.gp-recipe-check[data-firm-id="${firmId}"]`).forEach(rc => {
                rc.checked = firmCb.checked;
            });
        });
    });

    tree.querySelectorAll('.gp-recipe-check').forEach(rc => {
        rc.addEventListener('change', () => {
            const firmId = rc.dataset.firmId;
            const firmRecipes = [...tree.querySelectorAll(`.gp-recipe-check[data-firm-id="${firmId}"]`)];
            const firmCb = tree.querySelector(`.gp-firm-check[data-firm-id="${firmId}"]`);
            if (firmCb) {
                firmCb.checked = firmRecipes.length > 0 && firmRecipes.every(x => x.checked);
                firmCb.indeterminate = firmRecipes.some(x => x.checked) && !firmRecipes.every(x => x.checked);
            }
        });
    });
}

function applyGlobalPriceDateFilter() {
    const startEl = document.getElementById('gp-target-date-start');
    const endEl = document.getElementById('gp-target-date-end');
    const tree = document.getElementById('gp-target-tree');
    if (!startEl || !endEl || !tree) return;

    const start = startEl.value ? new Date(startEl.value) : null;
    const end = endEl.value ? new Date(endEl.value + 'T23:59:59') : null;
    if (!start && !end) return;

    tree.querySelectorAll('.gp-recipe-check').forEach(cb => {
        const created = cb.dataset.createdAt ? new Date(cb.dataset.createdAt) : null;
        if (!created || isNaN(created.getTime())) return;
        const inRange = (!start || created >= start) && (!end || created <= end);
        if (inRange) cb.checked = true;
    });

    tree.querySelectorAll('.gp-firm-check').forEach(firmCb => {
        const firmId = firmCb.dataset.firmId;
        const firmRecipes = [...tree.querySelectorAll(`.gp-recipe-check[data-firm-id="${firmId}"]`)];
        firmCb.checked = firmRecipes.length > 0 && firmRecipes.every(x => x.checked);
        firmCb.indeterminate = firmRecipes.some(x => x.checked) && !firmRecipes.every(x => x.checked);
    });
}

function openGlobalPriceModal() {
    const modal = document.getElementById('modal-global-price');
    if (!modal) return;
    renderGlobalPriceChangesSummary();
    renderGlobalPriceTargetTree();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
}

function closeGlobalPriceModal() {
    const modal = document.getElementById('modal-global-price');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function initGlobalPriceModalHandlers() {
    if (window.globalPriceModalBound) return;
    window.globalPriceModalBound = true;

    document.querySelectorAll('.btn-close-price-modal').forEach(btn => {
        btn.addEventListener('click', closeGlobalPriceModal);
    });

    document.getElementById('btn-floating-save-prices')?.addEventListener('click', openGlobalPriceModal);

    document.getElementById('gp-target-date-start')?.addEventListener('change', applyGlobalPriceDateFilter);
    document.getElementById('gp-target-date-end')?.addEventListener('change', applyGlobalPriceDateFilter);

    document.getElementById('btn-confirm-global-prices')?.addEventListener('click', async () => {
        const changes = window.pendingGlobalPriceChanges;
        const priceChanges = {};
        Object.keys(changes).forEach(k => { priceChanges[k] = changes[k].new; });

        const selectedRecipeIds = [...document.querySelectorAll('.gp-recipe-check:checked')].map(cb => Number(cb.dataset.recipeId));
        const overrideCustom = document.querySelector('input[name="gp_override_custom"]:checked')?.value === 'true';

        if (Object.keys(priceChanges).length === 0) {
            alert('Kaydedilecek fiyat değişikliği yok.');
            return;
        }

        try {
            await apiPost('/api/settings/global-prices-advanced', {
                price_changes: priceChanges,
                selected_recipe_ids: selectedRecipeIds,
                override_custom: overrideCustom
            });
            window.pendingGlobalPriceChanges = {};
            updateFloatingPriceSaveButton();
            closeGlobalPriceModal();
            await fetchDb();
            if (state.adminTab === 'settings') renderSettingsTab();
            if (state.adminTab === 'recipes') renderRecipesTab();
        } catch (e) { }
    });

    const quickModal = document.getElementById('modal-quick-global-price');
    const closeQuickModal = () => quickModal?.classList.add('hidden');
    const openQuickModal = () => quickModal?.classList.remove('hidden');

    document.querySelectorAll('.btn-close-quick-price-modal').forEach(btn => btn.addEventListener('click', closeQuickModal));
    document.getElementById('btn-floating-save-prices-quick')?.addEventListener('click', openQuickModal);

    document.getElementById('btn-confirm-quick-global-prices')?.addEventListener('click', async () => {
        const changes = window.pendingGlobalPriceChanges;
        const priceChanges = {};
        Object.keys(changes).forEach(k => { priceChanges[k] = changes[k].new; });

        // Apply to ALL recipes
        const allRecipeIds = state.db.recipes.map(r => r.id);
        const overrideCustom = document.querySelector('input[name="quick_gp_override"]:checked')?.value === 'true';

        if (Object.keys(priceChanges).length === 0) {
            alert('Kaydedilecek fiyat değişikliği yok.');
            return;
        }

        try {
            await apiPost('/api/settings/global-prices-advanced', {
                price_changes: priceChanges,
                selected_recipe_ids: allRecipeIds,
                override_custom: overrideCustom
            });
            window.pendingGlobalPriceChanges = {};
            updateFloatingPriceSaveButton();
            closeQuickModal();
            await fetchDb();
            if (state.adminTab === 'settings') renderSettingsTab();
            if (state.adminTab === 'recipes') renderRecipesTab();
        } catch (e) { }
    });

}

function renderGlobalPricesSettings() {
    initGlobalPriceModalHandlers();

    const listEl = document.getElementById('settings-global-prices-list');
    if (!listEl) return;

    const ingredients = getRecipeOrderIngredients();
    const globalPrices = getGlobalIngredientPrices();

    listEl.innerHTML = '';
    if (ingredients.length === 0) {
        listEl.innerHTML = '<tr><td colspan="3" class="p-6 text-center text-slate-500 italic">Önce hammadde sıralaması listesine ürün ekleyin.</td></tr>';
        return;
    }

    ingredients.forEach(name => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-850 hover:bg-slate-900/10';
        const currentPrice = globalPrices[name] ?? '';
        const pending = window.pendingGlobalPriceChanges[name];
        const statusHtml = pending
            ? '<span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">Değişti</span>'
            : '<span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">Kayıtlı</span>';

        tr.innerHTML = `
            <td class="p-3 font-bold text-slate-200">${name}</td>
            <td class="p-3">
                <input type="text" inputmode="decimal" class="input-field w-36 py-1.5 px-2 text-sm font-mono global-price-input" data-ingredient-name="${name.replace(/"/g, '&quot;')}" value="${currentPrice !== '' ? Number(currentPrice).toFixed(2) : ''}" placeholder="0.00">
            </td>
            <td class="p-3 global-price-status">${statusHtml}</td>
        `;

        const input = tr.querySelector('.global-price-input');
        input.addEventListener('input', () => {
            trackGlobalPriceChange(name, input.value);
            const statusCell = tr.querySelector('.global-price-status');
            if (statusCell) {
                statusCell.innerHTML = window.pendingGlobalPriceChanges[name]
                    ? '<span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">Değişti</span>'
                    : '<span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">Kayıtlı</span>';
            }
        });

        listEl.appendChild(tr);
    });
}

window.populateIngredientOptions = function populateIngredientOptions() {
    const nameInput = document.getElementById('ing-name');
    const listEl = document.getElementById('ingredient-autocomplete-list');
    if (!nameInput || !listEl) return;

    const ingredients = getRecipeOrderIngredients();

    const renderList = (filter = '') => {
        const q = filter.trim().toLowerCase();
        const filtered = q
            ? ingredients.filter(ing => ing.toLowerCase().includes(q))
            : ingredients;

        if (filtered.length === 0) {
            listEl.innerHTML = '<li class="px-3 py-2 text-slate-500 italic text-xs">Hammadde bulunamadı</li>';
            listEl.classList.remove('hidden');
            return;
        }

        listEl.innerHTML = filtered.slice(0, 50).map(ing => `
            <li class="px-3 py-2 hover:bg-slate-700 cursor-pointer text-slate-200" data-ing-name="${ing.replace(/"/g, '&quot;')}">${ing}</li>
        `).join('');
        listEl.classList.remove('hidden');

        listEl.querySelectorAll('li[data-ing-name]').forEach(li => {
            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const ingName = li.getAttribute('data-ing-name') || '';
                nameInput.value = ingName;
                listEl.classList.add('hidden');

                const priceInput = document.getElementById('ing-unit-price');
                if (priceInput && !priceInput.value.trim()) {
                    const globalPrices = getGlobalIngredientPrices();
                    if (globalPrices[ingName] != null) {
                        priceInput.placeholder = Number(globalPrices[ingName]).toFixed(2);
                    }
                }
            });
        });
    };

    if (!nameInput.dataset.autocompleteBound) {
        nameInput.dataset.autocompleteBound = '1';
        nameInput.addEventListener('focus', () => renderList(nameInput.value));
        nameInput.addEventListener('input', () => renderList(nameInput.value));
        nameInput.addEventListener('blur', () => {
            setTimeout(() => listEl.classList.add('hidden'), 150);
        });
    }

    if (document.activeElement === nameInput) {
        renderList(nameInput.value);
    }
};

function renderRecipesTab() {
    window.pendingRecipeEdits = {};
    if (typeof updateFloatingRecipeSaveButton === 'function') {
        updateFloatingRecipeSaveButton();
    }

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

        const firmSearchInput = document.getElementById('recipe-firm-search');
        if (firmSearchInput) {
            firmSearchInput.value = '';
        }

        const renderFirmList = (filterText = '') => {
            // Güvenli bir şekilde firms-list elementini yakalayalım
            const firmsListContainer = document.getElementById('firms-list') || dom.firmsList;
            if (!firmsListContainer) return; // Eğer element yoksa patlamayı önle

            firmsListContainer.innerHTML = '';
            let firms = [...state.db.firms];

            // Sort alphabetically by firm name
            firms.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));

            if (filterText) {
                const lowerFilter = filterText.toLocaleLowerCase('tr-TR');
                firms = firms.filter(f => f.name.toLocaleLowerCase('tr-TR').includes(lowerFilter));
            }

            if (firms.length === 0) {
                if (filterText) {
                    firmsListContainer.innerHTML = '<div class="text-slate-500 italic p-4 text-center col-span-full">Aradığınız kritere uygun firma bulunamadı.</div>';
                } else {
                    firmsListContainer.innerHTML = '<div class="text-slate-500 italic p-4 text-center col-span-full">Henüz sisteme kayıtlı firma bulunmuyor.</div>';
                }
            } else {
                firms.forEach(firm => {
                    const recipeCount = state.db.recipes.filter(r => Number(r.firmId) === Number(firm.id) && isRecipeActive(r)).length;
                    const card = document.createElement('div');
                    card.className = 'flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer group';
                    card.innerHTML = `
                        <div class="flex items-center gap-4 flex-1 min-w-0">
                            <div class="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
                                <i data-lucide="building-2" class="w-6 h-6 text-orange-500"></i>
                            </div>
                            <div class="flex flex-col min-w-0">
                                <span class="font-bold text-slate-200 text-lg truncate group-hover:text-white transition-colors">${firm.name}</span>
                                <span class="text-sm text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <i data-lucide="file-text" class="w-4 h-4"></i> ${recipeCount} Ürün / Reçete
                                </span>
                            </div>
                        </div>
                        <div class="shrink-0 text-slate-500 group-hover:text-orange-400 transition-colors opacity-0 group-hover:opacity-100 hidden sm:block">
                            <i data-lucide="chevron-right" class="w-6 h-6"></i>
                        </div>
                    `;
                    card.addEventListener('click', () => {
                        state.activeFirmId = firm.id;
                        state.activeRecipeId = null;
                        renderRecipesTab();
                    });
                    firmsListContainer.appendChild(card);
                });
            }
        };

        renderFirmList();

        if (firmSearchInput && !firmSearchInput.hasAttribute('data-listener-attached')) {
            firmSearchInput.addEventListener('input', (e) => {
                renderFirmList(e.target.value);
            });
            firmSearchInput.setAttribute('data-listener-attached', 'true');
        }
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
        const firm = state.db.firms.find(f => Number(f.id) === Number(state.activeFirmId));
        dom.crumbArrowFirm.classList.remove('hidden');
        dom.breadcrumbFirmName.classList.remove('hidden');
        dom.breadcrumbFirmName.textContent = firm ? firm.name : '';

        dom.firmRecipesTitle.textContent = firm ? `${firm.name} - Ürün Reçeteleri` : 'Ürün Reçeteleri';

        const recipeSearchInput = document.getElementById('recipe-search-input');
        if (recipeSearchInput) {
            recipeSearchInput.value = '';
        }

        const renderRecipeList = (filterText = '') => {
            dom.recipesListContainer.innerHTML = '';
            let recipes = state.db.recipes.filter(r => Number(r.firmId) === Number(state.activeFirmId) && isRecipeActive(r));

            // Sort alphabetically by recipe name
            recipes.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));

            if (filterText) {
                const lowerFilter = filterText.toLocaleLowerCase('tr-TR');
                recipes = recipes.filter(r => r.name.toLocaleLowerCase('tr-TR').includes(lowerFilter));
            }

            if (recipes.length === 0) {
                if (filterText) {
                    dom.recipesListContainer.innerHTML = '<div class="text-slate-500 italic p-4 text-center">Aradığınız kritere uygun reçete bulunamadı.</div>';
                } else {
                    dom.recipesListContainer.innerHTML = '<div class="text-slate-500 italic p-4 text-center">Bu firmaya henüz bir ürün tanımlanmamış.</div>';
                }
            } else {
                recipes.forEach(r => {
                    const div = document.createElement('div');
                    div.className = 'recipe-row flex items-center justify-between gap-3';
                    div.innerHTML = `
                        <div class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer recipe-row-main">
                            <i data-lucide="folder" class="w-5 h-5 text-orange-500 shrink-0"></i>
                            <span class="font-bold text-slate-200 text-lg truncate">${r.name}</span>
                            <span class="text-sm text-slate-400 font-mono shrink-0">${(r.items || []).length} Hammadde</span>
                        </div>
                        ${canManageRecipes ? `
                        <button type="button" class="btn-delete-recipe shrink-0 p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors" data-recipe-id="${r.id}" title="Reçeteyi Pasifleştir">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>` : ''}
                    `;
                    div.querySelector('.recipe-row-main')?.addEventListener('click', () => {
                        state.activeRecipeId = r.id;
                        renderRecipesTab();
                    });
                    div.querySelector('.btn-delete-recipe')?.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (!confirm(`"${r.name}" reçetesini silmek istediğinize emin misiniz?\n\nReçete pasif hale getirilecek ve listeden kaldırılacak. Mevcut siparişler etkilenmez.`)) return;
                        try {
                            await apiDelete(`/api/recipes/${r.id}`);
                            if (Number(state.activeRecipeId) === Number(r.id)) {
                                state.activeRecipeId = null;
                            }
                            await fetchDb();
                            renderRecipesTab();
                        } catch (err) {
                            // apiDelete shows alert
                        }
                    });
                    dom.recipesListContainer.appendChild(div);
                });
            }
            lucide.createIcons();
        };

        renderRecipeList();

        if (recipeSearchInput && !recipeSearchInput.hasAttribute('data-listener-attached')) {
            recipeSearchInput.addEventListener('input', (e) => {
                renderRecipeList(e.target.value);
            });
            recipeSearchInput.setAttribute('data-listener-attached', 'true');
        }
    } else if (state.activeRecipeId) {
        // Level 3: Ingredients Editor
        dom.recipeLvlIngredients.classList.remove('hidden');

        const canManageRecipes = state.currentUser.role === 'admin' || !!state.currentUser.canManageRecipes;
        const addIngredientContainer = document.getElementById('add-ingredient-container');
        if (addIngredientContainer) {
            if (canManageRecipes) {
                addIngredientContainer.classList.remove('hidden');
                if (typeof window.populateIngredientOptions === 'function') {
                    window.populateIngredientOptions();
                } else if ((state.db.settings || []).length === 0) {
                    fetch('/api/settings/recipe_order')
                        .then(r => r.ok ? r.json() : null)
                        .then(data => {
                            if (data && data.value) {
                                if (!state.db.settings) state.db.settings = [];
                                const existing = state.db.settings.find(s => s.key === 'recipe_order');
                                if (existing) existing.value = data.value;
                                else state.db.settings.push({ key: 'recipe_order', value: data.value });
                                window.populateIngredientOptions?.();
                            }
                        }).catch(() => { });
                }
            }
            else {
                addIngredientContainer.classList.add('hidden');
            }
        }

        const firm = state.db.firms.find(f => Number(f.id) === Number(state.activeFirmId));
        const recipe = state.db.recipes.find(r => Number(r.id) === Number(state.activeRecipeId));

        // Setup breadcrumbs
        dom.crumbArrowFirm.classList.remove('hidden');
        dom.breadcrumbFirmName.classList.remove('hidden');
        dom.breadcrumbFirmName.textContent = firm ? firm.name : '';
        dom.crumbArrowRecipe.classList.remove('hidden');
        dom.breadcrumbRecipeName.classList.remove('hidden');
        dom.breadcrumbRecipeName.textContent = recipe ? recipe.name : '';

        dom.recipeIngredientsTitle.textContent = recipe ? recipe.name : '';

        if (!recipe) return;

        renderRecipeIngredientsTable(recipe, canManageRecipes);
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
            { key: 'canViewSales', label: 'Satış Bilgisi' },
            { key: 'canViewDashboard', label: 'Özet Paneli' },
            { key: 'canViewTraceability', label: 'İzlenebilirlik' },
            { key: 'canViewAccounting', label: 'Fiş Kesim' },
            { key: 'canViewCurrentAccounts', label: 'Cari Hesaplar' },
            { key: 'canManageSettings', label: 'Ayarlar' }
        ];

        let permsHTML = '';
        if (u.role === 'admin') {
            permsHTML = '<span class="text-xs text-amber-500 font-bold uppercase tracking-wider">TÜM YETKİLER</span>';
        } else if (u.role === 'operator') {
            const opPerms = [
                { key: 'opCanSeeColor', label: 'Renk Yetkisi' },
                { key: 'opCanSeeGarlic', label: 'Sarımsak Yetkisi' }
            ];
            permsHTML = `<div class="flex flex-wrap gap-1.5">`;
            opPerms.forEach(p => {
                const val = !!u[p.key];
                const activeClass = val
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20'
                    : 'bg-slate-900/40 text-slate-500 border-slate-800 hover:bg-slate-800/40';
                const cursorClass = canEditThisUser ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed';
                permsHTML += `
                    <span class="px-2 py-0.5 text-xs font-bold rounded border transition-all ${activeClass} ${cursorClass} btn-toggle-perm" data-perm-key="${p.key}">
                        ${p.label}
                    </span>
                `;
            });
            permsHTML += `</div>`;
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
            <td class="px-2 py-3 font-bold text-slate-200">${u.name}</td>
            <td class="px-2 py-3">${roleBadge}</td>
            <td class="px-2 py-3 font-mono text-slate-400">${u.pass}</td>
            <td class="px-2 py-3">${permsHTML}</td>
            <td class="px-2 py-3 text-center">${deleteButton}</td>
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

        if (u.role !== 'admin' && canEditThisUser) {
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

    (state.db.scales || []).forEach(s => {
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
    if (typeof initCustomerDetailEventListeners === 'function') initCustomerDetailEventListeners();
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
            } catch (e) { }

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
window.printBatchReceiptDirect = function (batchId) {
    if (window.printReceipt) {
        window.printReceipt(batchId);
    } else {
        alert(`Parti #${batchId} fişi yazdırılıyor...`);
    }
};

window.toggleBatchAccountingStatus = async function (batchId, markCompleted) {
    try {
        const status = markCompleted ? 'fiş kesildi' : 'fiş kesilmedi';
        const res = await apiPut(`/api/batches/${batchId}/status`, { status });
        if (res.success) {
            await fetchDb();
            renderReportsTab();
        }
    } catch (e) {
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
    } catch (e) { }
}

function renderSettingsTab() {
    if ((state.db.scales || []).length >= 0) {
        renderScalesTab();
    }
    renderGlobalPricesSettings();
    updateFloatingPriceSaveButton();
    if (!dom.settingsIngredientsList) return;

    const allSettings = state.db.settings || [];
    const settingObj = allSettings.find(s => s.key === 'recipe_order');

    const renderIngredientsList = (value) => {
        let currentOrder = [];
        if (value) {
            currentOrder = value.split('\n').map(s => s.trim()).filter(Boolean);
        }

        const globalPrices = getGlobalIngredientPrices();
        const colorSettings = (state.db.settings || []).find(s => s.key === 'color_ingredients');
        let colorIngredients = [];
        if (colorSettings && colorSettings.value) {
            try { colorIngredients = JSON.parse(colorSettings.value); } catch (e) { }
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

            const itemPrice = globalPrices[item] !== undefined ? globalPrices[item] : '';
            const isColor = colorIngredients.includes(item);

            li.innerHTML = `
            <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="settings-drag-handle cursor-grab p-1 text-slate-500 hover:text-slate-300">
                    <i data-lucide="grip-vertical" class="w-4 h-4"></i>
                </div>
                <span class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0 list-index-label">
                    ${index + 1}
                </span>
                <span class="text-slate-200 font-bold truncate flex-1 ingredient-name-label">${item}</span>
                
                <div class="flex items-center gap-4 ml-2 shrink-0">
                    <label class="text-xs text-slate-400 flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition-colors">
                        <input type="checkbox" class="w-4 h-4 accent-orange-500 item-is-color rounded border-slate-700 bg-slate-900" ${isColor ? 'checked' : ''}>
                        Renk
                    </label>
                    <div class="flex items-center gap-1 border border-slate-700 bg-slate-900 rounded px-2 py-1 w-24">
                        <input type="text" inputmode="decimal" class="bg-transparent border-none outline-none text-right w-full text-sm text-slate-200 font-mono item-price" value="${itemPrice}" placeholder="0.00">
                        <span class="text-xs text-slate-500">₺</span>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0 ml-4">
                <div class="w-px h-4 bg-slate-800 mx-1"></div>
                <button class="btn-delete-item p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded transition-all" title="Sil">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;

            li.querySelector('.btn-delete-item').addEventListener('click', () => {
                if (confirm(`"${item}" hammaddesini listeden silmek istediğinize emin misiniz?`)) {
                    currentOrder.splice(index, 1);
                    saveRecipeOrderList(currentOrder);
                }
            });

            const priceInput = li.querySelector('.item-price');
            priceInput.addEventListener('input', () => {
                trackGlobalPriceChange(item, priceInput.value);
                const statusCell = li.querySelector('.global-price-status');
                if (statusCell) {
                    statusCell.innerHTML = window.pendingGlobalPriceChanges[item]
                        ? '<span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">Değişti</span>'
                        : '';
                }
            });

            const colorInput = li.querySelector('.item-is-color');
            colorInput.addEventListener('change', async () => {
                let currentColors = [];
                try {
                    const str = (state.db.settings || []).find(s => s.key === 'color_ingredients')?.value || '[]';
                    currentColors = JSON.parse(str);
                } catch (e) { }

                if (colorInput.checked) {
                    if (!currentColors.includes(item)) currentColors.push(item);
                } else {
                    currentColors = currentColors.filter(c => c !== item);
                }

                const res = await apiPost('/api/settings', { key: 'color_ingredients', value: JSON.stringify(currentColors) });
                if (res && res.success) {
                    const idx = state.db.settings.findIndex(s => s.key === 'color_ingredients');
                    if (idx >= 0) state.db.settings[idx].value = JSON.stringify(currentColors);
                    else state.db.settings.push({ key: 'color_ingredients', value: JSON.stringify(currentColors) });
                }
            });

            dom.settingsIngredientsList.appendChild(li);
        });

        destroySettingsIngredientsSortable();
        if (typeof Sortable !== 'undefined') {
            settingsIngredientsSortable = Sortable.create(dom.settingsIngredientsList, {
                handle: '.settings-drag-handle',
                animation: 150,
                ghostClass: 'bg-slate-800',
                onEnd: function () {
                    const newOrder = Array.from(dom.settingsIngredientsList.querySelectorAll('.ingredient-name-label')).map(el => el.textContent.trim());

                    // Update visual index numbers
                    dom.settingsIngredientsList.querySelectorAll('.list-index-label').forEach((el, idx) => {
                        el.textContent = idx + 1;
                    });

                    saveRecipeOrderList(newOrder);
                }
            });
        }

        lucide.createIcons();
    };

    if (settingObj && settingObj.value) {
        renderIngredientsList(settingObj.value);
        renderGlobalPricesSettings();
        return;
    }

    fetch('/api/settings/recipe_order')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (data && data.value) {
                if (!state.db.settings) state.db.settings = [];
                const existing = state.db.settings.find(s => s.key === 'recipe_order');
                if (existing) existing.value = data.value;
                else state.db.settings.push({ key: 'recipe_order', value: data.value });
                renderIngredientsList(data.value);
                window.populateIngredientOptions?.();
            } else {
                renderIngredientsList('');
            }
        }).catch(() => {
            renderIngredientsList('');
        });
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
        } catch (e) { }

        const weightStr = b.weight > 1000 ? `${(b.weight / 1000).toFixed(2)} kg` : `${b.weight} g`;

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
                const res = await apiPut(`/api/batches/${b.id}/status`, { status: newStatus });
                if (res.success) {
                    await fetchDb();
                    renderAccountingTab();
                }
            } catch (e) {
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
    const tbody = document.getElementById('cust-table-body');
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
                <td class="p-3 font-bold text-white"><a href="#" onclick="openCustomerDetail(${f.id}); return false;" class="hover:text-orange-400 hover:underline transition-colors">${f.name}</a></td>
                <td class="p-3 text-slate-300 text-xs">${f.contactPerson || '-'}</td>
                <td class="p-3 text-slate-300 text-xs font-mono">${f.phone || '-'}</td>
                <td class="p-3 text-slate-300 text-xs">${f.email || '-'}</td>
                <td class="p-3 text-slate-300 text-xs font-mono">${f.taxId || '-'}</td>
                <td class="p-3 text-slate-400 text-xs max-w-xs truncate">${f.notes || f.address || '-'}</td>
                <td class="p-3 text-right space-x-2">
                    <button onclick="openCustomerDetail(${f.id})" class="p-1.5 px-2.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 text-xs font-bold inline-flex items-center gap-1">
                        <i data-lucide="file-spreadsheet" class="w-4 h-4"></i> Cari Ekstre
                    </button>
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

window.openEditOrderModal = function (orderId) {
    const order = state.db.orders.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.getElementById('modal-edit-order');
    const form = document.getElementById('form-edit-order');
    const warning = document.getElementById('edit-order-started-warning');

    if (modal && form) {
        document.getElementById('edit-order-id').value = order.id;
        document.getElementById('edit-order-info').textContent = `${order.customer} - ${order.recipeName}`;
        document.getElementById('edit-order-total-amount').value = order.totalAmount;
        document.getElementById('edit-order-bag-weight').value = order.bagWeight;

        const recipe = state.db.recipes.find(r => r.name === order.recipeName || Number(r.id) === Number(order.recipeId));
        const isCustom = recipe ? !!recipe.isCustomKgBased : false;
        const lblEditBagWeight = document.getElementById('lbl-edit-order-bag-weight');
        if (lblEditBagWeight) {
            lblEditBagWeight.textContent = isCustom ? "Paket / Torba Ağırlığı (KG)" : "Torba Başına Kapasite (Mikser) - KG";
        }

        if (document.getElementById('edit-order-batches')) {
            const batchCount = order.batches ? order.batches.length : 1;
            document.getElementById('edit-order-batches').value = batchCount;
        }
        if (document.getElementById('edit-order-delivery-date')) {
            document.getElementById('edit-order-delivery-date').value = order.deliveryDate || '';
        }
        if (document.getElementById('edit-order-urgency')) {
            document.getElementById('edit-order-urgency').value = order.urgency || 'normal';
        }
        if (document.getElementById('edit-order-notes')) {
            document.getElementById('edit-order-notes').value = order.notes || '';
        }

        // Check if any batch is in progress
        const inProgress = order.batches.some(b => ['tartımda', 'Üretiliyor', 'mikserde', 'paketlemede'].includes(b.status));
        if (warning) {
            if (inProgress) warning.classList.remove('hidden');
            else warning.classList.add('hidden');
        }

        // Parse and render extras
        window.editOrderExtras = [];
        if (order.batches && order.batches.length > 0 && order.batches[0].extraItems) {
            try {
                window.editOrderExtras = JSON.parse(order.batches[0].extraItems) || [];
            } catch (e) {
                console.error("Error parsing extra items in edit modal", e);
                window.editOrderExtras = [];
            }
        }
        window.renderEditOrderExtras();

        // Clear inputs
        document.getElementById('edit-order-extra-product').value = '';
        document.getElementById('edit-order-extra-amount').value = '';
        const isSeparateCheckbox = document.getElementById('edit-order-extra-separate');
        if (isSeparateCheckbox) isSeparateCheckbox.checked = false;

        // Setup Autocomplete Dropdown for Edit Order extras
        const extraDropdown = document.getElementById('edit-order-extra-dropdown');
        const extraInput = document.getElementById('edit-order-extra-product');
        
        if (extraDropdown && extraInput && typeof getRecipeOrderIngredients === 'function') {
            const ingredients = getRecipeOrderIngredients();
            let activeIndex = -1;

            function highlightItem(items, index) {
                items.forEach((item, idx) => {
                    if (idx === index) {
                        item.classList.add('bg-slate-700', 'text-white', 'font-bold');
                        item.scrollIntoView({ block: 'nearest' });
                    } else {
                        item.classList.remove('bg-slate-700', 'text-white', 'font-bold');
                    }
                });
            }
            
            function buildExtraDropdownItems(filterText) {
                extraDropdown.innerHTML = '';
                activeIndex = -1;
                const q = (filterText || '').toLowerCase().trim();
                const filtered = q ? ingredients.filter(ing => ing.toLowerCase().includes(q)) : ingredients;
                
                if (filtered.length === 0) {
                    const li = document.createElement('li');
                    li.className = 'px-4 py-2 text-slate-500 italic text-sm';
                    li.textContent = 'Sonuç bulunamadı';
                    extraDropdown.appendChild(li);
                    return;
                }
                
                filtered.forEach(ing => {
                    const li = document.createElement('li');
                    li.className = 'px-4 py-2 hover:bg-slate-700 cursor-pointer text-slate-300 transition-colors custom-extra-option text-sm';
                    li.textContent = ing;
                    li.addEventListener('click', () => {
                        extraInput.value = ing;
                        extraDropdown.classList.add('hidden');
                    });
                    extraDropdown.appendChild(li);
                });
            }
            
            buildExtraDropdownItems('');
            
            if (!extraInput.hasAttribute('data-extra-listener')) {
                extraInput.setAttribute('data-extra-listener', 'true');
                
                extraInput.addEventListener('focus', () => {
                    buildExtraDropdownItems(extraInput.value);
                    extraDropdown.classList.remove('hidden');
                });
                
                extraInput.addEventListener('input', () => {
                    buildExtraDropdownItems(extraInput.value);
                    extraDropdown.classList.remove('hidden');
                });
                
                extraInput.addEventListener('keydown', (e) => {
                    const items = extraDropdown.querySelectorAll('.custom-extra-option');
                    if (items.length === 0) return;

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (extraDropdown.classList.contains('hidden')) {
                            extraDropdown.classList.remove('hidden');
                            activeIndex = -1;
                        }
                        activeIndex = (activeIndex + 1) % items.length;
                        highlightItem(items, activeIndex);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (extraDropdown.classList.contains('hidden')) {
                            extraDropdown.classList.remove('hidden');
                            activeIndex = items.length;
                        }
                        activeIndex = (activeIndex - 1 + items.length) % items.length;
                        highlightItem(items, activeIndex);
                    } else if (e.key === 'Enter') {
                        if (!extraDropdown.classList.contains('hidden') && activeIndex >= 0 && activeIndex < items.length) {
                            e.preventDefault();
                            extraInput.value = items[activeIndex].textContent;
                            extraDropdown.classList.add('hidden');
                            activeIndex = -1;
                        }
                    } else if (e.key === 'Escape') {
                        extraDropdown.classList.add('hidden');
                        activeIndex = -1;
                    }
                });
                
                document.addEventListener('click', (e) => {
                    const wrapper = document.getElementById('edit-order-extra-wrapper');
                    if (wrapper && !wrapper.contains(e.target)) {
                        extraDropdown.classList.add('hidden');
                    }
                }, true);
            }
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

document.addEventListener('click', async (e) => {
    if (e.target.closest('.btn-close-edit-order')) {
        const modal = document.getElementById('modal-edit-order');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    } else if (e.target.closest('#btn-cancel-recipe-edits')) {
        window.pendingRecipeEdits = {};
        if (typeof updateFloatingRecipeSaveButton === 'function') updateFloatingRecipeSaveButton();
        if (state.activeRecipeId) {
            renderRecipesTab();
        }
    } else if (e.target.closest('#btn-save-recipe-edits')) {
        const recipeId = state.activeRecipeId;
        if (!recipeId) return;

        const btn = e.target.closest('#btn-save-recipe-edits');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Kaydediliyor...';
        btn.disabled = true;

        try {
            const edits = window.pendingRecipeEdits;
            for (const itemIdStr of Object.keys(edits)) {
                const itemId = Number(itemIdStr);
                await saveRecipeItemField(recipeId, itemId, edits[itemIdStr]);
            }
            window.pendingRecipeEdits = {};
            if (typeof updateFloatingRecipeSaveButton === 'function') updateFloatingRecipeSaveButton();
            await fetchDb();
            renderRecipesTab();
        } catch (err) {
            alert('Kaydetme hatası: ' + err);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            if (window.lucide) window.lucide.createIcons();
        }
    }
});

document.getElementById('form-edit-order')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const orderId = document.getElementById('edit-order-id').value;
    const totalAmount = document.getElementById('edit-order-total-amount').value;
    const bagWeight = document.getElementById('edit-order-bag-weight').value;
    const batches = document.getElementById('edit-order-batches')?.value || 1;
    const deliveryDate = document.getElementById('edit-order-delivery-date')?.value;
    const urgency = document.getElementById('edit-order-urgency')?.value;
    const notes = document.getElementById('edit-order-notes')?.value;

    try {
        await apiPut(`/api/orders/${orderId}`, { totalAmount, bagWeight, batches, deliveryDate, urgency, notes, extras: window.editOrderExtras });

        const modal = document.getElementById('modal-edit-order');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        await fetchDb();
        renderOrdersTab();
    } catch (err) {
        alert('Hata: ' + err);
    }
});



window.receiptCurrentBatchId = null;

window.showExtraItemsModal = function (batchId) {
    window.receiptCurrentBatchId = batchId;

    let foundBatch = null;
    let foundOrder = null;
    for (const o of state.db.orders) {
        const b = o.batches.find(x => String(x.id) === String(batchId));
        if (b) {
            foundBatch = b;
            foundOrder = o;
            break;
        }
    }

    const batchLogs = state.db.logs.filter(log => String(log.batchId) === String(batchId));
    let itemsToDisplay = [];
    if (batchLogs.length > 0) {
        itemsToDisplay = batchLogs.map(log => ({
            item: log.item,
            actual: (log.actual || 0) > 50 ? ((log.actual || 0) / 1000) : (log.actual || 0)
        }));
    } else if (foundOrder) {
        const recipe = state.db.recipes.find(r => r.name === foundOrder.recipeName || r.id === foundOrder.recipeId);
        if (recipe && recipe.items && recipe.items.length > 0) {
            const batchWeight = foundBatch ? (foundBatch.targetAmount || foundBatch.bagWeight || 100) : 100;
            const totalPercentage = recipe.items.reduce((sum, it) => sum + (it.percentage || 0), 0) || 100;
            itemsToDisplay = recipe.items.map(it => ({
                item: it.name,
                actual: (batchWeight * (it.percentage || 0)) / totalPercentage
            }));
        }
    }
    if (itemsToDisplay.length === 0) {
        itemsToDisplay = [{
            item: foundOrder ? foundOrder.recipeName : 'Baharat Karışımı',
            actual: foundBatch ? (foundBatch.targetAmount || 0) : 0
        }];
    }

    const customer = foundOrder ? foundOrder.customer : (batchLogs[0] ? batchLogs[0].customer : 'Bilinmeyen Müşteri');
    const recipeName = foundOrder ? foundOrder.recipeName : (batchLogs[0] ? batchLogs[0].recipe : 'Baharat Reçetesi');

    const customerEl = document.getElementById('receipt-preview-customer');
    const recipeEl = document.getElementById('receipt-preview-recipe');
    if (customerEl) customerEl.textContent = customer;
    if (recipeEl) recipeEl.textContent = recipeName;

    // Populate extra product suggestions datalist
    const datalist = document.getElementById('extra-product-suggestions');
    if (datalist) {
        const knownNames = new Set();
        (state.db.recipes || []).forEach(r => {
            if (r.name) knownNames.add(r.name);
            (r.items || []).forEach(it => { if (it.name) knownNames.add(it.name); });
        });
        (state.db.logs || []).forEach(l => { if (l.item) knownNames.add(l.item); });
        datalist.innerHTML = Array.from(knownNames).map(name => `<option value="${name}"></option>`).join('');
    }

    // Determine ingredient prices
    const allSettings = state.db.settings || [];
    const priceObj = allSettings.find(s => s.key === 'ingredient_prices');
    let globalPrices = {};
    if (priceObj && priceObj.value) {
        try { globalPrices = JSON.parse(priceObj.value); } catch (e) { }
    }

    const recipePreviewList = document.getElementById('recipe-preview-list');
    let recipeHtml = '';
    let recipeTotal = 0;
    let totalActualWeight = 0;

    itemsToDisplay.forEach(item => {
        let pricePerKg = 0;
        let unitCost = 0;
        if (item.item in globalPrices) {
            pricePerKg = globalPrices[item.item];
            unitCost = pricePerKg * (item.actual || 0);
        }
        recipeTotal += unitCost;
        totalActualWeight += (item.actual || 0);

        recipeHtml += `
            <tr>
                <td class="p-3 text-slate-300">${item.item}</td>
                <td class="p-3 font-mono text-slate-400">${(item.actual || 0).toFixed(2)} kg</td>
                <td class="p-3 font-mono text-slate-400">${pricePerKg.toFixed(2)} ₺</td>
                <td class="p-3 font-mono text-white text-right font-bold">${unitCost.toFixed(2)} ₺</td>
            </tr>
        `;
    });

    if (recipePreviewList) {
        recipePreviewList.innerHTML = recipeHtml;
    }

    let recipeUnitHtml = '';
    if (totalActualWeight > 0) {
        const unitPrice = recipeTotal / totalActualWeight;
        recipeUnitHtml = `<span class="text-xs text-slate-400 mr-2">(1 KG Maliyet: ${unitPrice.toFixed(2)} ₺)</span>`;
    }

    const recipeTotalEl = document.getElementById('receipt-preview-recipe-total');
    if (recipeTotal === 0 && foundOrder) {
        const recipe = state.db.recipes.find(r => r.name === foundOrder.recipeName || r.id === foundOrder.recipeId);
        if (recipe && (recipe.price_per_kg || recipe.pricePerKg)) {
            const pKg = recipe.price_per_kg || recipe.pricePerKg;
            recipeTotal = pKg * totalActualWeight;
        }
    }

    if (recipeTotalEl) {
        recipeTotalEl.dataset.total = recipeTotal.toFixed(2);
        recipeTotalEl.innerHTML = `${recipeUnitHtml}${recipeTotal.toFixed(2)} ₺`;
    }

    // Clear extra items & payments
    document.getElementById('extra-items-list').innerHTML = '';
    document.getElementById('payment-items-container').innerHTML = '';

    // Load previously saved extra items / payments (Task 7)
    if (foundBatch && foundBatch.extraItems) {
        try {
            const extraItems = JSON.parse(foundBatch.extraItems);
            extraItems.forEach(item => {
                const list = document.getElementById('extra-items-list');
                const tr = document.createElement('tr');
                tr.className = 'extra-item-row bg-slate-900/50 hover:bg-slate-900/80 transition-colors';
                tr.innerHTML = `
                    <td class="p-3">
                        <input type="text" list="extra-product-suggestions" class="input-field py-1 px-2 text-sm extra-name" value="${item.name || ''}" placeholder="Kalem veya ürün adı...">
                    </td>
                    <td class="p-3">
                        <input type="number" step="0.01" class="input-field py-1 px-2 text-sm font-mono extra-qty" value="${item.qty || 1}" placeholder="Miktar">
                    </td>
                    <td class="p-3">
                        <input type="number" step="0.01" class="input-field py-1 px-2 text-sm font-mono extra-price" value="${item.price || 0}" placeholder="Fiyat">
                    </td>
                    <td class="p-3 text-center">
                        <button type="button" class="btn-remove-extra-item text-red-500 hover:text-red-400 p-1">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                `;
                list.appendChild(tr);
                setupExtraRowListeners(tr);
            });
        } catch (e) { console.error("Error parsing extraItems", e); }
    }

    if (foundBatch && foundBatch.payments) {
        try {
            const payments = JSON.parse(foundBatch.payments);
            payments.forEach(payment => {
                const container = document.getElementById('payment-items-container');
                const div = document.createElement('div');
                div.className = 'payment-item-row flex flex-col sm:flex-row justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700/50 gap-3';

                const methodOpts = ['Nakit', 'Kredi Kartı', 'Çek', 'Havale'].map(opt =>
                    `<option value="${opt}" ${payment.method === opt ? 'selected' : ''}>${opt}</option>`
                ).join('');

                div.innerHTML = `
                    <div class="flex items-center gap-2 w-full sm:w-auto">
                        <input type="number" step="0.01" value="${payment.amount || 0}" placeholder="Tutar (₺)" class="input-field py-1.5 px-3 text-sm font-mono font-bold text-emerald-400 w-full sm:w-32 payment-amount">
                    </div>
                    <div class="flex items-center gap-2 w-full sm:w-auto flex-1">
                        <select class="input-field py-1.5 px-3 text-sm w-full payment-method">
                            ${methodOpts}
                        </select>
                    </div>
                    <button type="button" class="btn-remove-payment-item text-red-500 hover:text-red-400 p-1 shrink-0">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                `;
                container.appendChild(div);
            });
        } catch (e) { console.error("Error parsing payments", e); }
    }

    updateReceiptTotals();

    const modal = document.getElementById('modal-extra-items');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    lucide.createIcons();
};

window.setupExtraRowListeners = function (tr) {
    const nameInput = tr.querySelector('.extra-name');
    const qtyInput = tr.querySelector('.extra-qty');
    const priceInput = tr.querySelector('.extra-price');

    const updatePriceFromName = () => {
        const val = (nameInput.value || '').trim();
        if (!val) return;

        const allSettings = state.db.settings || [];
        const priceObj = allSettings.find(s => s.key === 'ingredient_prices');
        let globalPrices = {};
        if (priceObj && priceObj.value) {
            try { globalPrices = JSON.parse(priceObj.value); } catch (e) { }
        }

        if (val in globalPrices) {
            priceInput.value = globalPrices[val];
        } else {
            const rec = (state.db.recipes || []).find(r => r.name.toLowerCase() === val.toLowerCase());
            if (rec && (rec.price_per_kg || rec.pricePerKg)) {
                priceInput.value = rec.price_per_kg || rec.pricePerKg;
            }
        }
        updateReceiptTotals();
    };

    nameInput?.addEventListener('input', updatePriceFromName);
    nameInput?.addEventListener('change', updatePriceFromName);
    qtyInput?.addEventListener('input', updateReceiptTotals);
    priceInput?.addEventListener('input', updateReceiptTotals);
};

window.updateReceiptTotals = function () {
    const recipeTotalEl = document.getElementById('receipt-preview-recipe-total');
    const recipeTotal = parseFloat(recipeTotalEl?.dataset?.total || 0) || 0;

    let extraTotal = 0;
    document.querySelectorAll('.extra-item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.extra-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.extra-price')?.value) || 0;
        extraTotal += (qty * price);
    });

    const extraTotalEl = document.getElementById('receipt-preview-extra-total');
    const grandTotalEl = document.getElementById('receipt-preview-grand-total');

    if (extraTotalEl) extraTotalEl.textContent = `${extraTotal.toFixed(2)} ₺`;
    if (grandTotalEl) grandTotalEl.textContent = `${(recipeTotal + extraTotal).toFixed(2)} ₺`;
};

document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-close-extra-modal')) {
        const modal = document.getElementById('modal-extra-items');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    if (e.target.closest('.btn-remove-extra-item')) {
        e.target.closest('.extra-item-row').remove();
        updateReceiptTotals();
    }

    if (e.target.closest('.btn-remove-payment-item')) {
        e.target.closest('.payment-item-row').remove();
    }
});

document.getElementById('btn-add-extra-item')?.addEventListener('click', () => {
    const list = document.getElementById('extra-items-list');
    if (!list) return;

    const tr = document.createElement('tr');
    tr.className = 'extra-item-row bg-slate-900/50 hover:bg-slate-900/80 transition-colors';
    tr.innerHTML = `
        <td class="p-3">
            <input type="text" list="extra-product-suggestions" class="input-field py-1 px-2 text-sm extra-name" placeholder="Kalem veya ürün adı seçin/yazın...">
        </td>
        <td class="p-3">
            <input type="number" step="0.01" class="input-field py-1 px-2 text-sm font-mono extra-qty" placeholder="Miktar" value="1">
        </td>
        <td class="p-3">
            <input type="number" step="0.01" class="input-field py-1 px-2 text-sm font-mono extra-price" placeholder="Fiyat">
        </td>
        <td class="p-3 text-center">
            <button type="button" class="btn-remove-extra-item text-red-500 hover:text-red-400 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </td>
    `;
    list.appendChild(tr);
    setupExtraRowListeners(tr);
    lucide.createIcons();
});

document.getElementById('btn-add-payment-item')?.addEventListener('click', () => {
    const container = document.getElementById('payment-items-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'payment-item-row flex flex-col sm:flex-row justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700/50 gap-3';
    div.innerHTML = `
        <div class="flex items-center gap-2 w-full sm:w-auto">
            <input type="number" step="0.01" placeholder="Tutar (₺)" class="input-field py-1.5 px-3 text-sm font-mono font-bold text-emerald-400 w-full sm:w-32 payment-amount">
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto flex-1">
            <select class="input-field py-1.5 px-3 text-sm w-full payment-method">
                <option value="Nakit">Nakit</option>
                <option value="Kredi Kartı">Kredi Kartı</option>
                <option value="Çek">Çek</option>
                <option value="Havale">Havale</option>
            </select>
        </div>
        <button type="button" class="btn-remove-payment-item text-red-500 hover:text-red-400 p-1 shrink-0">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;
    container.appendChild(div);
    lucide.createIcons();
});

document.getElementById('btn-print-normal')?.addEventListener('click', () => {
    printBatchReceipt(window.receiptCurrentBatchId, false);
});

document.getElementById('btn-print-detailed')?.addEventListener('click', () => {
    printBatchReceipt(window.receiptCurrentBatchId, true);
});

document.getElementById('btn-share-modal-receipt')?.addEventListener('click', () => {
    printBatchReceipt(window.receiptCurrentBatchId, true);
});

document.getElementById('btn-download-modal-receipt')?.addEventListener('click', () => {
    printBatchReceipt(window.receiptCurrentBatchId, true);
});


// --- CUSTOMER CARI TRANSACTIONS IMPLEMENTATION ---
window.openCustomerDetail = async function (firmId) {
    state.currentFirmId = firmId;
    const firm = (state.db.firms || []).find(f => f.id === firmId);
    if (!firm) return;

    const listLvl = document.getElementById('cust-lvl-list');
    const detailLvl = document.getElementById('cust-lvl-detail');
    if (listLvl) listLvl.classList.add('hidden');
    if (detailLvl) detailLvl.classList.remove('hidden');

    const nameEl = document.getElementById('cust-detail-name');
    const balanceEl = document.getElementById('cust-detail-balance');
    const infoEl = document.getElementById('cust-detail-info');

    if (nameEl) nameEl.textContent = firm.name;
    if (balanceEl) balanceEl.textContent = `${(firm.balance || 0).toFixed(2)} TL`;
    if (infoEl) infoEl.textContent = `Tel: ${firm.phone || '-'} | E-posta: ${firm.email || '-'} | Adres: ${firm.address || '-'}`;

    await renderCustomerTransactions(firmId);
    initCustomerDetailEventListeners();
    if (window.lucide) window.lucide.createIcons();
};

async function renderCustomerTransactions(firmId) {
    const tbody = document.getElementById('cust-tx-table-body');
    if (!tbody) return;

    let txs = [];
    try {
        const res = await fetch(`/api/transactions?firm_id=${firmId}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success) txs = data.transactions || [];
        }
    } catch (e) { console.error("Error fetching transactions", e); }

    if (txs.length === 0 && state.db.transactions) {
        txs = state.db.transactions.filter(t => t.firm_id === firmId || t.firmId === firmId);
    }

    if (txs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500 italic">Geçmiş işlem kaydı bulunmamaktadır.</td></tr>`;
        return;
    }

    let runningBalance = 0;
    const sortedAsc = [...txs].sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));
    const balanceMap = new Map();

    sortedAsc.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        const type = (t.type || '').toUpperCase();
        if (type === 'SATIŞ' || type === 'BORÇ') {
            runningBalance += amount;
        } else if (type === 'TAHSİLAT' || type === 'ALACAK' || type === 'İADE') {
            runningBalance -= amount;
        }
        balanceMap.set(t.id, runningBalance);
    });

    const sortedDesc = [...txs].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    tbody.innerHTML = sortedDesc.map(t => {
        const dateStr = t.date ? new Date(t.date).toLocaleString('tr-TR') : '-';
        const type = (t.type || 'TAHSİLAT').toUpperCase();
        const amount = parseFloat(t.amount) || 0;
        const isDebt = (type === 'SATIŞ' || type === 'BORÇ');

        const debtStr = isDebt ? `${amount.toFixed(2)} TL` : '-';
        const creditStr = !isDebt ? `${amount.toFixed(2)} TL` : '-';
        const typeBadge = isDebt ? '<span class="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-500/30 rounded font-bold">Satış / Borç</span>' : '<span class="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded font-bold">Tahsilat</span>';
        const bal = balanceMap.get(t.id) || 0;

        return `
            <tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td class="p-3 text-slate-300 font-mono">${dateStr}</td>
                <td class="p-3">${typeBadge}</td>
                <td class="p-3 text-slate-200">${t.description || '-'}</td>
                <td class="p-3 text-right font-bold text-orange-400 font-mono">${debtStr}</td>
                <td class="p-3 text-right font-bold text-emerald-400 font-mono">${creditStr}</td>
                <td class="p-3 text-right font-bold text-white font-mono">${bal.toFixed(2)} TL</td>
                <td class="p-3 text-center">-</td>
            </tr>
        `;
    }).join('');
}

function initCustomerDetailEventListeners() {
    const btnBack = document.getElementById('btn-cust-back');
    if (btnBack && !btnBack.dataset.bound) {
        btnBack.dataset.bound = "true";
        btnBack.addEventListener('click', () => {
            document.getElementById('cust-lvl-detail')?.classList.add('hidden');
            document.getElementById('cust-lvl-list')?.classList.remove('hidden');
        });
    }

    const btnDebt = document.getElementById('btn-add-debt');
    if (btnDebt && !btnDebt.dataset.bound) {
        btnDebt.dataset.bound = "true";
        btnDebt.addEventListener('click', async () => {
            if (!state.currentFirmId) return;
            const amountStr = prompt("Eklemek istediğiniz borç/satış tutarını giriniz (TL):");
            if (!amountStr) return;
            const amount = parseFloat(amountStr);
            if (isNaN(amount) || amount <= 0) {
                alert("Geçersiz tutar!");
                return;
            }
            const desc = prompt("İşlem açıklaması (İsteğe bağlı):", "Manuel Borç Kaydı") || "Manuel Borç Kaydı";

            try {
                const res = await apiPost('/api/transactions', {
                    firm_id: state.currentFirmId,
                    amount: amount,
                    description: desc,
                    type: 'SATIŞ'
                });
                if (res.success) {
                    await fetchDb();
                    window.openCustomerDetail(state.currentFirmId);
                } else {
                    alert(res.message || "İşlem kaydedilemedi!");
                }
            } catch (e) { console.error(e); }
        });
    }

    const btnPayment = document.getElementById('btn-add-payment');
    if (btnPayment && !btnPayment.dataset.bound) {
        btnPayment.dataset.bound = "true";
        btnPayment.addEventListener('click', async () => {
            if (!state.currentFirmId) return;
            const amountStr = prompt("Eklemek istediğiniz tahsilat tutarını giriniz (TL):");
            if (!amountStr) return;
            const amount = parseFloat(amountStr);
            if (isNaN(amount) || amount <= 0) {
                alert("Geçersiz tutar!");
                return;
            }
            const desc = prompt("Tahsilat açıklaması (İsteğe bağlı):", "Tahsilat") || "Tahsilat";

            try {
                const res = await apiPost('/api/transactions', {
                    firm_id: state.currentFirmId,
                    amount: amount,
                    description: desc,
                    type: 'TAHSİLAT'
                });
                if (res.success) {
                    await fetchDb();
                    window.openCustomerDetail(state.currentFirmId);
                } else {
                    alert(res.message || "İşlem kaydedilemedi!");
                }
            } catch (e) { console.error(e); }
        });
    }

    const btnPrint = document.getElementById('btn-print-ekstre');
    if (btnPrint && !btnPrint.dataset.bound) {
        btnPrint.dataset.bound = "true";
        btnPrint.addEventListener('click', () => {
            window.print();
        });
    }
}

async function renderAuditLogsTab() {
    const tbody = document.getElementById('audit-logs-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Yükleniyor...</td></tr>';

    try {
        const res = await apiGet('/api/audit_logs');
        if (res.success) {
            tbody.innerHTML = '';
            if (res.logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Geçmişte yapılan işlem bulunamadı.</td></tr>';
                return;
            }

            res.logs.forEach(log => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-800/30 transition-colors";
                
                const dateStr = new Date(log.timestamp).toLocaleString('tr-TR');
                const btnHtml = log.isReverted 
                    ? `<span class="text-xs text-slate-500 italic">Geri Alındı</span>`
                    : `<button onclick="revertAuditLog(${log.id})" class="text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"><i data-lucide="undo-2" class="w-3 h-3"></i> Geri Al</button>`;

                tr.innerHTML = `
                    <td class="px-4 py-3 whitespace-nowrap text-xs text-slate-300 font-mono">${dateStr}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-xs font-bold text-white">${log.user || 'Sistem'}</td>
                    <td class="px-4 py-3 text-xs text-slate-300">${log.description}</td>
                    <td class="px-4 py-3 whitespace-nowrap">${btnHtml}</td>
                `;
                tbody.appendChild(tr);
            });
            lucide.createIcons();
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Yükleme hatası!</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Bir hata oluştu!</td></tr>';
    }
}

window.revertAuditLog = async function(logId) {
    if (!confirm("Bu işlemi geri almak istediğinize emin misiniz?")) return;

    try {
        const res = await apiPost(`/api/audit_logs/${logId}/revert`);
        if (res.success) {
            alert("İşlem başarıyla geri alındı!");
            // Re-fetch db to sync state and re-render tab
            await fetchDb();
            renderAuditLogsTab();
        } else {
            alert(res.message || "Geri alınırken hata oluştu!");
        }
    } catch (e) {
        console.error(e);
        alert("Bir hata oluştu!");
    }
};
