let lastOperatorPanelDataStr = null;
let lastWeighingScreenDataStr = null;

function renderOperatorPanel() {
    dom.operatorStationSelect.classList.add('hidden');
    dom.operatorJobsQueue.classList.add('hidden');
    dom.operatorWeighingScreen.classList.add('hidden');
    if (dom.packagingPanel) dom.packagingPanel.classList.add('hidden');

    // Auto-select dummy scale to bypass scale selection screen
    if (!state.selectedScale) {
        state.selectedScale = { id: 9999, name: 'Sistem Terazisi' };
    }

    // Always show pending jobs queue screen
    dom.operatorJobsQueue.classList.remove('hidden');
    if (true) {
        dom.opLoggedUsername.textContent = state.currentUser.name;

        // Show back to admin button if the user is an admin/manager
        const btnBackToAdmin = document.getElementById('btn-back-to-admin');
        if (btnBackToAdmin) {
            if (state.currentUser.role !== 'operator') {
                btnBackToAdmin.classList.remove('hidden');
            } else {
                btnBackToAdmin.classList.add('hidden');
            }
        }

        // Flatten all orders & pending/in-progress batches
        const pendingBatches = [];
        const opActiveStatuses = ['beklemede', 'Bekliyor', 'tartımda', 'Üretiliyor', 'mikserde', 'paketlemede'];
        if (state.showFinishedJobs) {
            opActiveStatuses.push('fiş kesilmedi', 'tamamlandı', 'Tamamlandı');
        }

        state.db.orders.forEach(o => {
            if (o.isActive === false) return;
            o.batches.forEach(b => {
                // Teslim tarihi olmayan siparişleri gizle
                if (!o.deliveryDate) return;

                if (opActiveStatuses.includes(b.status)) {
                    pendingBatches.push({
                        orderId: o.id,
                        batchId: b.id,
                        customer: o.customer,
                        recipeName: o.recipeName,
                        targetAmount: b.targetAmount,
                        no: b.no,
                        totalBatches: b.totalBatches,
                        status: b.status,
                        operator: b.operator,
                        deliveryDate: o.deliveryDate,
                        urgency: o.urgency
                    });
                }
            });
        });

        // Sort pending batches by ID descending (newest first)
        pendingBatches.sort((a, b) => {
            // assuming batch id format like orderId-batchNo, we can sort by orderId desc then batchNo asc
            // Or since order id is sequential and batches are sequential, we can string compare if they are padded, but they might not be.
            // Let's just sort by orderId descending, then batchNo ascending
            if (a.orderId !== b.orderId) {
                return b.orderId - a.orderId;
            }
            return a.no - b.no;
        });

        // HASH CHECK (Method 2)
        const currentDataStr = JSON.stringify({ pendingBatches, user: state.currentUser.name });
        let skipQueueRender = false;
        if (lastOperatorPanelDataStr === currentDataStr) {
            skipQueueRender = true;
        } else {
            lastOperatorPanelDataStr = currentDataStr;
        }

        if (!skipQueueRender) {

            // SMART DOM UPDATE (Method 3) -> Replaced with Full render since Hash Check prevents flicker
            if (pendingBatches.length === 0) {
                dom.pendingJobsGrid.innerHTML = '<div class="text-center text-slate-500 py-12 italic" id="empty-jobs-msg">Şu an sıraya alınmış bir iş bulunmamaktadır.</div>';
                skipQueueRender = true;
            }

            let todayTitle = 'Bugünün Siparişleri';
            let pastTitle = 'Tarihi Geçen Siparişler';
            let futureTitle = 'Gelecek Tarihli Siparişler';

            const todayStr = getTodayDateStr();
            const groups = {
                today: { title: todayTitle, items: [], color: 'text-orange-400', bg: 'bg-orange-500/10' },
                past: { title: pastTitle, items: [], color: 'text-red-400', bg: 'bg-red-500/10' },
                future: { title: futureTitle, items: [], color: 'text-blue-400', bg: 'bg-blue-500/10' }
            };

            pendingBatches.forEach(b => {
                if (!b.deliveryDate || b.deliveryDate === todayStr) {
                    groups.today.items.push(b);
                } else if (b.deliveryDate < todayStr) {
                    groups.past.items.push(b);
                } else {
                    groups.future.items.push(b);
                }
            });

            let newHtml = '';
            const orderOfGroups = ['today', 'past', 'future'];

            orderOfGroups.forEach(key => {
                const g = groups[key];
                if (g.items.length === 0) return;

                newHtml += `
                <div class="col-span-full mt-4 mb-2 flex items-center gap-3">
                    <div class="px-3 py-1.5 rounded-lg ${g.bg} ${g.color} font-bold tracking-wider text-sm border border-current opacity-80 uppercase">
                        ${g.title}
                    </div>
                    <div class="h-px flex-1 bg-slate-800"></div>
                </div>
            `;

                g.items.forEach(b => {
                    const isFinished = ['fiş kesilmedi', 'tamamlandı', 'Tamamlandı'].includes(b.status);
                    const isStarted = ['tartımda', 'Üretiliyor', 'mikserde', 'paketlemede'].includes(b.status);

                    let btnText = 'BAŞLA';
                    let btnIcon = 'play';
                    let btnClass = 'btn-orange';

                    if (isFinished) {
                        btnText = 'GÖR';
                        btnIcon = 'eye';
                        btnClass = 'btn-slate';
                    } else if (isStarted) {
                        btnText = 'KATIL';
                        btnIcon = 'users';
                        btnClass = 'btn-blue';
                    }

                    let statusBadgeHtml = '';
                    if (isFinished) {
                        statusBadgeHtml = `<span class="inline-block text-xs font-bold text-green-400 bg-green-950/80 px-2 py-0.5 rounded border border-green-500/30 uppercase tracking-wider mt-1">TAMAMLANDI</span>`;
                    } else if (isStarted && b.operator) {
                        statusBadgeHtml = `<span class="text-xs text-blue-400 block mt-1 font-semibold uppercase tracking-wider">Aktif Usta: ${b.operator}</span>`;
                    }

                    let urgencyBadge = '';
                    let borderColor = 'border-slate-800';

                    if (b.urgency === 'acil') {
                        urgencyBadge = '<span class="px-2 py-0.5 bg-red-950/80 text-red-400 border border-red-500/30 rounded font-bold uppercase tracking-wider text-[10px] shadow-[0_0_10px_rgba(248,113,113,0.2)]">Acil</span>';
                        borderColor = 'border-red-900/50';
                    } else if (b.urgency === 'rahat') {
                        urgencyBadge = '<span class="px-2 py-0.5 bg-green-950/50 text-green-400 border border-green-500/20 rounded font-bold uppercase tracking-wider text-[10px]">Rahat</span>';
                        borderColor = 'border-green-900/30';
                    }

                    let dateBadge = b.deliveryDate ? `<span class="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px]"><i data-lucide="calendar" class="w-3 h-3 inline pb-0.5"></i> ${b.deliveryDate}</span>` : '';

                    newHtml += `
                    <div id="pending-job-${b.batchId}" class="pending-job-card glass-card p-4 sm:p-5 border ${borderColor} rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 transition-all hover:bg-slate-800/30">
                        <div class="flex-1 min-w-0 w-full">
                            <div class="flex items-center gap-2 mb-1 flex-wrap">
                                <div class="text-orange-400 font-extrabold text-base sm:text-xl break-words leading-snug">${b.customer}</div>
                                ${urgencyBadge}
                                ${dateBadge}
                            </div>
                            <div class="text-slate-200 font-bold text-sm sm:text-lg mt-1 break-words leading-snug">${b.recipeName} - <span class="text-orange-300 font-extrabold">${b.targetAmount.toFixed(2)} kg</span></div>
                            <div class="text-xs text-slate-500 mt-1.5 font-mono">Parti No: ${b.no} / ${b.totalBatches} ${statusBadgeHtml}</div>
                        </div>
                        <button class="btn ${btnClass} w-full sm:w-auto py-3 sm:py-3.5 px-5 sm:px-6 font-bold flex items-center justify-center gap-2 text-base sm:text-lg rounded-xl btn-action-job shrink-0" data-batch-id="${b.batchId}">
                            <i data-lucide="${btnIcon}" class="w-5 h-5"></i> ${btnText}
                        </button>
                    </div>
                `;
                });
            });

            dom.pendingJobsGrid.innerHTML = newHtml;

            // Attach event listeners
            document.querySelectorAll('.btn-action-job').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const btnEl = e.currentTarget;
                    btnEl.disabled = true;
                    const originalHtml = btnEl.innerHTML;
                    btnEl.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> BEKLEYİN...';
                    lucide.createIcons();
                    
                    const bId = btnEl.getAttribute('data-batch-id');
                    const b = pendingBatches.find(x => x.batchId === bId);
                    if (b) {
                        await joinJob(b.orderId, b.batchId);
                    }
                    
                    if (btnEl) {
                        btnEl.disabled = false;
                        btnEl.innerHTML = originalHtml;
                        lucide.createIcons();
                    }
                });
            });
        } // close if (!skipQueueRender)
    }

    if (state.activeJob) {
        // Active weighing interface
        dom.operatorJobsQueue.classList.add('hidden');
        dom.operatorWeighingScreen.classList.remove('hidden');
        renderWeighingScreen();
    }
    lucide.createIcons();
}

async function startJob(orderId, batchId) {
    try {
        const res = await apiPost(`/api/batches/${batchId}/start`, { operator: state.currentUser.name });
        if (res.success) {
            await fetchDb();
            // Use fresh references from updated state.db
            const freshOrder = state.db.orders.find(o => o.id === orderId);
            const freshBatch = freshOrder ? freshOrder.batches.find(b => b.id === batchId) : null;
            if (freshOrder && freshBatch) {
                state.activeJob = { order: freshOrder, batch: freshBatch };
                lastWeighingScreenDataStr = null;
                startChecklistPolling();
                renderOperatorPanel();
            }
        }
    } catch (e) {
        // error alerted
    }
}

async function joinJob(orderId, batchId) {
    // Avoid blocking the UI with a full DB fetch when joining an already running job
    // await fetchDb(); 
    
    const order = state.db.orders.find(o => o.id === orderId);
    const batch = order ? order.batches.find(b => b.id === batchId) : null;

    if (order && batch) {
        state.activeJob = { order, batch };
        lastWeighingScreenDataStr = null;
        startChecklistPolling();
        renderOperatorPanel();
    }
}



function startChecklistPolling() {
    stopChecklistPolling();
    state.pollingIntervalId = setInterval(async () => {
        if (state.view === 'operator' && state.activeJob) {
            await fetchDb();

            // Polling'in eski fetchDb cevabı üzerine yazmasını önle:
            // API'den onaylanmış ama henüz sunucudan dönmemiş logları yeniden uygula.
            if (state.confirmedLogs && state.confirmedLogs.size > 0) {
                if (!state.db.logs) state.db.logs = [];
                state.confirmedLogs.forEach((logData, key) => {
                    const alreadyInServer = state.db.logs.some(l =>
                        String(l.batchId) === String(logData.batchId) &&
                        l.item === logData.item &&
                        (l.status === 'Başarılı' || l.status === 'Dahil Değil')
                    );
                    if (alreadyInServer) {
                        state.confirmedLogs.delete(key); // Sunucu artık biliyor, takibe gerek yok
                    } else {
                        state.db.logs.push(logData); // Sunucu henüz bilmiyor, yeniden ekle
                    }
                });
            }

            const freshOrder = state.db.orders.find(o => o.id === state.activeJob.order.id);
            const freshBatch = freshOrder ? freshOrder.batches.find(b => b.id === state.activeJob.batch.id) : null;
            if (!freshBatch || ['iptal'].includes(freshBatch.status)) {
                state.activeJob = null;
                if (dom.packagingPanel) dom.packagingPanel.classList.add('hidden');
                stopChecklistPolling();
                renderOperatorPanel();
                return;
            }
            state.activeJob.batch = freshBatch;
            state.activeJob.order = freshOrder;
            renderWeighingScreen();
        } else {
            stopChecklistPolling();
        }
    }, 2000);
}

function stopChecklistPolling() {
    if (state.pollingIntervalId) {
        clearInterval(state.pollingIntervalId);
        state.pollingIntervalId = null;
    }
}

// --- SMART SCALE ENTEGRASYONU ---

function playBeep(frequency = 800, duration = 120) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
        osc.start();
        osc.stop(ctx.currentTime + duration / 1000);
    } catch (e) { }
}

function openScaleModal() { }
async function connectToScale() { }
async function disconnectScale() { }
function startWeightPolling() { }
function stopWeightPolling() { }

let lastBeepTime = 0;
function processLiveWeight(weight) {
    if (!state.activeWeighingItem) return;
    const target = state.activeWeighingItem.targetAmount;
    const tolerance = state.activeWeighingItem.tolerance;
    const minAcceptable = target - tolerance;
    const maxAcceptable = target + tolerance;

    // Warning zone starts at 90% of the minimum acceptable weight
    const warnZoneStart = 0.90 * minAcceptable;

    const rowEl = document.getElementById(`recipe-item-row-${state.activeWeighingItem.name}`);
    if (!rowEl) return;

    const valEl = document.getElementById(`live-val-${state.activeWeighingItem.name}`);
    if (valEl) {
        valEl.textContent = `${weight.toFixed(3)} kg`;
    }

    const confirmBtn = dom.btnWeighingConfirm;
    const confirmTxt = dom.btnWeighingConfirmText;

    if (weight >= minAcceptable && weight <= maxAcceptable) {
        // SUCCESS (Green)
        rowEl.className = 'glass-card p-5 rounded-2xl border transition-all scale-[1.02] border-green-500 bg-green-950/20 text-slate-100 shadow-xl';

        confirmBtn.disabled = false;
        confirmBtn.className = 'w-full md:w-auto h-24 px-14 btn btn-green rounded-2xl text-2xl font-black shadow-xl shadow-green-950/40 flex flex-col items-center justify-center min-w-[260px] hover:scale-[1.02] active:scale-[0.98] transition-all';
        confirmTxt.innerHTML = '<i data-lucide="check-circle" class="w-8 h-8 mb-1"></i><span>TARTIMI ONAYLA</span>';
        lucide.createIcons();

        state.activeWeighingItem.actualWeight = weight;
    } else {
        // OUT OF RANGE (Red)
        rowEl.className = 'glass-card p-5 rounded-2xl border transition-all scale-[1.02] border-red-500 bg-red-950/20 text-slate-100 shadow-xl';

        confirmBtn.disabled = true;
        confirmBtn.className = 'w-full md:w-auto h-24 px-14 btn btn-slate rounded-2xl text-2xl font-black opacity-50 cursor-not-allowed flex flex-col items-center justify-center min-w-[260px]';
        confirmTxt.innerHTML = '<i data-lucide="alert-triangle" class="w-8 h-8 mb-1"></i><span>UYGUN DEĞİL</span>';
        lucide.createIcons();

        if (weight >= warnZoneStart && weight < minAcceptable) {
            const distance = minAcceptable - weight;
            const totalDistance = minAcceptable - warnZoneStart;
            const ratio = distance / totalDistance;

            const beepDelay = 100 + (ratio * 600);
            const now = Date.now();
            if (now - lastBeepTime > beepDelay) {
                playBeep(850 + (1 - ratio) * 200, 100);
                lastBeepTime = now;
            }
        }
    }
}


function startGlobalBackgroundPolling() {
    setInterval(async () => {
        if (state.currentUser) {
            if (state.view === 'operator' && !state.activeJob) {
                await fetchDb();
                renderOperatorPanel();
            } else if (state.view === 'admin' && state.adminTab === 'orders') {
                await fetchDb();
                renderActiveJobsListTable();
            }
        }
    }, 3000);
}

function renderWeighingScreen() {
    if (!state.activeJob) return;

    // Defensive guard for state.db
    const dbLogs = (state.db && state.db.logs) || [];
    const dbRecipes = (state.db && state.db.recipes) || [];
    const dbSettings = (state.db && state.db.settings) || [];

    const activeBatchLogs = dbLogs.filter(l => l.batchId === state.activeJob.batch.id && (l.status === 'Başarılı' || l.status === 'Dahil Değil'));

    // Ensure recipeItems is always an array — fallback to recipe lookup from state.db.recipes
    let recipeItems = state.activeJob.order.recipeItems || [];
    if (recipeItems.length === 0) {
        const firmName = state.activeJob.order.customer;
        const recipeName = state.activeJob.order.recipeName;
        const fallbackRecipe = dbRecipes.find(r => r.name === recipeName && r.firmName === firmName)
            || dbRecipes.find(r => r.name === recipeName);
        if (fallbackRecipe && fallbackRecipe.items && fallbackRecipe.items.length > 0) {
            recipeItems = fallbackRecipe.items;
            state.activeJob.order.recipeItems = recipeItems; // cache it
        }
    }
    //filter non included items
    recipeItems = recipeItems.filter(item => !item.is_not_included);
    // Parse extra items from batch
    let batchExtraItems = [];
    if (state.activeJob.batch.extraItems) {
        try { batchExtraItems = JSON.parse(state.activeJob.batch.extraItems); } catch (e) { batchExtraItems = []; }
    }
    const extraMixerItems = batchExtraItems.filter(e => e.type === 'mixer');
    const extraSeparateItems = batchExtraItems.filter(e => e.type === 'separate');

    // HASH CHECK (Method 2)
    const currentDataStr = JSON.stringify({
        order: state.activeJob.order,
        batchStatus: state.activeJob.batch.status,
        logs: activeBatchLogs,
        activeWeighingItem: state.activeWeighingItem?.name || null,
        connectedScale: state.connectedScale?.ip || null,
        showInlineRef: state.showInlineRef,
        extraItems: state.activeJob.batch.extraItems || null
    });

    if (lastWeighingScreenDataStr === currentDataStr) {
        lucide.createIcons();
        if (state.activeJob.batch.status === 'paketlemede') {
            showPackagingScreen();
        }
        return; // No changes, skip DOM update
    }
    lastWeighingScreenDataStr = currentDataStr;

    dom.weighingCustomer.textContent = state.activeJob.order.customer;
    dom.weighingRecipe.textContent = state.activeJob.order.recipeName;
    dom.weighingBatchBadge.textContent = `Parti ${state.activeJob.batch.no} (${state.activeJob.batch.targetAmount.toFixed(2)} kg)`;
    dom.weighingOperatorName.textContent = state.currentUser.name;

    if (dom.weighingOrderNotesContainer && dom.weighingOrderNotesText) {
        if (state.activeJob.order.notes && state.activeJob.order.notes.trim() !== '') {
            dom.weighingOrderNotesText.textContent = state.activeJob.order.notes;
            dom.weighingOrderNotesContainer.classList.remove('hidden');
        } else {
            dom.weighingOrderNotesText.textContent = '';
            dom.weighingOrderNotesContainer.classList.add('hidden');
        }
    }

    if (state.activeJob.batch.status === 'paketlemede') {
        showPackagingScreen();
        return;
    } else {
        if (dom.packagingPanel) dom.packagingPanel.classList.add('hidden');
    }

    // Populate Reference Recipe Panel
    if (dom.refRecipeTbody) {
        dom.refRecipeTbody.innerHTML = '';
        const orderAmount = parseFloat(state.activeJob.order.totalAmount || state.activeJob.order.amount) || 0;
        const totalRecipeGrams = recipeItems.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
        const recipeTotalKg = totalRecipeGrams / 1000.0;

        recipeItems.forEach(item => {
            const baseGr = parseFloat(item.amount) || 0;
            let totalKg = 0;
            if (state.activeJob.order.isCustomKgBased) {
                const multiplier = recipeTotalKg > 0 ? (orderAmount / recipeTotalKg) : 0;
                totalKg = (baseGr * multiplier) / 1000.0;
            } else {
                totalKg = (baseGr * orderAmount) / 1000.0;
            }

            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-800 hover:bg-slate-800/50 transition-colors';
            tr.innerHTML = `
                <td class="p-3 font-bold text-slate-300">${item.name}</td>
                <td class="p-3 text-right font-mono text-slate-400">${baseGr.toFixed(2)} gr</td>
                <td class="p-3 text-right font-mono text-orange-400 font-bold">${totalKg.toFixed(3)} kg</td>
            `;
            dom.refRecipeTbody.appendChild(tr);
        });
    }


    // Toggle logic for reference panel
    if (dom.btnToggleRefRecipe && !dom.btnToggleRefRecipe.getAttribute('data-bound')) {
        dom.btnToggleRefRecipe.setAttribute('data-bound', 'true');
        dom.btnToggleRefRecipe.addEventListener('click', () => {
            if (dom.operatorReferencePanel.classList.contains('translate-x-full')) {
                dom.operatorReferencePanel.classList.remove('translate-x-full');
            } else {
                dom.operatorReferencePanel.classList.add('translate-x-full');
            }
        });
    }

    if (dom.btnCloseRefRecipe && !dom.btnCloseRefRecipe.getAttribute('data-bound')) {
        dom.btnCloseRefRecipe.setAttribute('data-bound', 'true');
        dom.btnCloseRefRecipe.addEventListener('click', () => {
            dom.operatorReferencePanel.classList.add('translate-x-full');
        });
    }


    // Update main checklist titles
    document.getElementById('checklist-main-title').textContent = `${state.activeJob.order.customer} - ${state.activeJob.order.recipeName}`;
    document.getElementById('checklist-sub-title').textContent = `Parti ${state.activeJob.batch.no} (${state.activeJob.batch.targetAmount.toFixed(2)} kg) - Lütfen hammaddeleri teyit edin.`;

    const scaleFactor = state.activeJob.batch.targetAmount;

    let normalItems = recipeItems.filter(item => !item.is_separate);
    let separateItems = recipeItems.filter(item => item.is_separate);

    const recipeOrderSetting = dbSettings.find(s => s.key === 'recipe_order');
    if (recipeOrderSetting && recipeOrderSetting.value) {
        const orderLines = recipeOrderSetting.value.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean);
        const sorter = (a, b) => {
            const idxA = orderLines.indexOf(a.name.trim().toLowerCase());
            const idxB = orderLines.indexOf(b.name.trim().toLowerCase());
            const posA = idxA === -1 ? Infinity : idxA;
            const posB = idxB === -1 ? Infinity : idxB;
            if (posA !== posB) return posA - posB;
            return a.name.localeCompare(b.name);
        };
        normalItems.sort(sorter);
        separateItems.sort(sorter);
    }

    let itemsToRender = [...normalItems, ...separateItems];

    const recipeObj = dbRecipes.find(r => r.name === state.activeJob.order.recipeName);

    // The DB defaults baseAmount to 1.0, but the industry standard is 100kg base for recipes.
    let baseAmount = recipeObj && recipeObj.baseAmount ? recipeObj.baseAmount : 100.0;
    if (baseAmount === 1.0) baseAmount = 100.0;

    const colorObj = dbSettings ? dbSettings.find(s => s.key === 'color_ingredients') : null;
    let colorIngredients = [];
    if (colorObj && colorObj.value) {
        try { colorIngredients = JSON.parse(colorObj.value); } catch (e) { }
    }

    if (recipeObj && recipeObj.hideSeparateColors) {
        itemsToRender = itemsToRender.filter(item => {
            if (item.is_separate && colorIngredients.includes(item.name)) {
                return false;
            }
            return true;
        });
    }

    if (itemsToRender.length === 0) {
        dom.operatorChecklistContainer.innerHTML = `
            <div class="glass-card p-8 rounded-2xl border border-slate-800 text-center space-y-3 my-6">
                <div class="inline-flex p-3 bg-amber-950/40 rounded-2xl text-amber-400 border border-amber-500/20 mb-2">
                    <i data-lucide="alert-circle" class="w-8 h-8"></i>
                </div>
                <h3 class="text-xl font-bold text-slate-200">Görüntülenecek Hammadde Bulunamadı</h3>
                <p class="text-slate-400 text-sm max-w-md mx-auto">
                    Bu reçeteye tanımlı hammadde bulunmamaktadır veya kullanıcının bu siparişteki maddeleri görme yetkisi bulunmamaktadır.
                </p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Calculate the actual total weight of the recipe items (in grams) for display purposes
    let totalRecipeGrams = 0;
    recipeItems.forEach(i => totalRecipeGrams += parseFloat(i.amount) || 0);


    // SMART DOM UPDATE (Method 3)


    const expectedIds = new Set();
    let hasDrawnDivider = false;

    // Add mixer extra items to the end of normal items (before separate divider)
    const mixerExtraRenderItems = extraMixerItems.map(e => ({
        name: e.product + ' (Ekstra)',
        amount: e.amount,
        tolerance: 0,
        is_separate: false,
        is_not_included: false,
        _isExtra: true,
        _extraType: 'mixer'
    }));

    // Add separate extra items to separate section
    const separateExtraRenderItems = extraSeparateItems.map(e => ({
        name: e.product + ' (Ekstra)',
        amount: e.amount,
        tolerance: 0,
        is_separate: true,
        is_not_included: false,
        _isExtra: true,
        _extraType: 'separate'
    }));

    // Combine: normal items + mixer extras, then separate items + separate extras
    const normalItemsWithExtras = [...normalItems, ...mixerExtraRenderItems];
    const separateItemsWithExtras = [...separateItems, ...separateExtraRenderItems];
    const itemsToRenderWithExtras = [...normalItemsWithExtras, ...separateItemsWithExtras];

    itemsToRenderWithExtras.forEach(item => {
        if (item.is_separate && !hasDrawnDivider) {
            hasDrawnDivider = true;
            expectedIds.add('divider-separate');
            let divider = document.getElementById('divider-separate');
            if (!divider) {
                divider = document.createElement('div');
                divider.id = 'divider-separate';
                divider.className = 'w-full my-6 text-center border-t border-slate-700/50 pt-4';
                divider.innerHTML = '<span class="text-[#f5f5dc] font-black uppercase tracking-widest text-lg bg-slate-950 px-4">AYRI HAZIRLANACAK ÜRÜNLER</span>';
            }
            dom.operatorChecklistContainer.appendChild(divider);
        }

        const containerId = `item-container-${item.name.replace(/\s+/g, '-')}`;
        expectedIds.add(containerId);

        let itemContainer = document.getElementById(containerId);
        let isNew = false;
        if (!itemContainer) {
            itemContainer = document.createElement('div');
            itemContainer.id = containerId;
            itemContainer.className = 'flex flex-col gap-1.5';
            isNew = true;
        } else {
            itemContainer.innerHTML = ''; // clear for smart inner update without breaking parent scroll
        }

        // Target weight in KG = (item.amount (gr) / (baseAmount (kg) * 1000)) * batchTarget (kg)
        let targetAmountKg;
        let toleranceKg;

        if (item._isExtra) {
            // Extra items: amount is already in grams per batch total, scale proportionally
            // amount is stored as grams per total order amount, scale to batch
            const orderTotal = state.activeJob.order.totalAmount || scaleFactor;
            targetAmountKg = (item.amount / 1000.0) * (scaleFactor / orderTotal);
            toleranceKg = 0;
        } else {
            targetAmountKg = (item.amount / (baseAmount * 1000)) * scaleFactor;
            toleranceKg = (item.tolerance / (baseAmount * 1000)) * scaleFactor;

            if (state.activeJob.order.isCustomKgBased) {
                const totalRecipeGrams = (state.activeJob.order.recipeItems || []).reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
                const recipeTotalKg = totalRecipeGrams / 1000.0;
                const effectiveMultiplier = scaleFactor / recipeTotalKg;
                targetAmountKg = (item.amount * effectiveMultiplier) / 1000.0;
                toleranceKg = (item.tolerance * effectiveMultiplier) / 1000.0;
            }
        }

        let separateDetailsHTML = '';
        if (item.is_separate && !item._isExtra) {
            const bagWeight = state.activeJob.batch.bagWeight || 100.0;
            const totalBags = Math.max(1, Math.ceil(scaleFactor / bagWeight));
            const targetPerBag = targetAmountKg / totalBags;
            separateDetailsHTML = `<div class="text-sm font-bold mt-1 text-orange-300/80">${totalBags} Paket x ${targetPerBag.toFixed(3)} kg</div>`;
        }

        // Extra item badge HTML
        const extraBadgeHTML = item._isExtra
            ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-900/40 text-violet-300 border border-violet-600/40 uppercase tracking-wider">Reçeteye Ek</span>`
            : '';

        const logEntry = activeBatchLogs.find(l => l.item === item.name);
        const isApproved = !!logEntry && (logEntry.status === 'Başarılı' || logEntry.status === 'Dahil Değil');

        const row = document.createElement('div');
        row.id = `recipe-item-row-${item.name}`;

        let leftContent = '';
        let rightContent = '';

        if (item._isExtra) {
            // Extra items: can be approved/confirmed
            const isExtraMixer = item._extraType === 'mixer';
            const extraLogEntry = activeBatchLogs.find(l => l.item === item.name);
            const isExtraApproved = !!extraLogEntry && (extraLogEntry.status === 'Başarılı' || extraLogEntry.status === 'Dahil Değil');

            if (isExtraApproved) {
                const qtyDisplay = extraLogEntry.status === 'Dahil Değil' ? '-' : `${parseFloat(extraLogEntry.actual).toFixed(3)} kg`;
                const iconClass = extraLogEntry.status === 'Dahil Değil' ? 'x-circle' : 'check-circle';
                const colorClass = extraLogEntry.status === 'Dahil Değil' ? 'border-slate-500/30 bg-slate-800/50 opacity-70' : (isExtraMixer ? 'border-violet-500/30 bg-violet-950/10' : 'border-amber-500/30 bg-amber-950/10');
                const amtColor = extraLogEntry.status === 'Dahil Değil' ? 'text-slate-400' : (isExtraMixer ? 'text-violet-400' : 'text-amber-400');

                row.className = `glass-card p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${colorClass}`;
                row.innerHTML = `
                    <div class="flex items-center justify-between w-full sm:w-auto gap-4 flex-wrap">
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <div class="font-bold text-xl text-slate-200 uppercase tracking-tight">${item.name}</div>
                                ${extraBadgeHTML}
                            </div>
                        </div>
                        <div class="text-3xl font-black font-mono ${amtColor}">${qtyDisplay}</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="flex items-center gap-2 ${amtColor} font-bold text-sm">
                            <i data-lucide="${iconClass}" class="w-5 h-5"></i>
                            <span>${extraLogEntry.status === 'Dahil Değil' ? 'Atlandı' : `Onaylandı (${extraLogEntry.operator})`}</span>
                        </div>
                        <button class="btn btn-red-outline btn-undo-extra-item py-1.5 px-3 font-bold text-xs rounded-lg flex items-center gap-1 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Geri Al
                        </button>
                    </div>
                `;
                row.querySelector('.btn-undo-extra-item')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await undoIngredient(item.name);
                });
            } else {
                const extraBgClass = isExtraMixer
                    ? 'border-violet-700/30 bg-violet-950/20'
                    : 'border-amber-700/30 bg-amber-950/10';
                const extraTextClass = isExtraMixer ? 'text-violet-200' : 'text-amber-200';
                const extraAmtClass = isExtraMixer ? 'text-violet-300' : 'text-amber-300';

                row.className = `glass-card p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${extraBgClass}`;
                row.innerHTML = `
                    <div class="flex items-center justify-between w-full sm:w-auto gap-3 flex-wrap">
                        <div class="flex items-center gap-2 flex-wrap">
                            <div class="font-bold text-lg ${extraTextClass} uppercase tracking-tight">${item.name}</div>
                            ${extraBadgeHTML}
                        </div>
                        <div class="text-2xl font-black font-mono ${extraAmtClass}">${targetAmountKg.toFixed(3)} kg</div>
                    </div>
                    <div class="flex items-center gap-2 mt-2 sm:mt-0">
                        <div class="text-xs text-slate-500 italic">${isExtraMixer ? 'Miksere eklenecek' : 'Ayrı hazırlanacak'}</div>
                        <button class="btn btn-approve-extra-item ${isExtraMixer ? 'bg-violet-700/80 hover:bg-violet-600 border border-violet-500/40 text-white' : 'bg-amber-700/80 hover:bg-amber-600 border border-amber-500/40 text-white'} py-2 px-4 font-bold text-sm rounded-lg flex items-center gap-1.5 transition-all">
                            <i data-lucide="check" class="w-4 h-4"></i> ONAYLA
                        </button>
                    </div>
                `;
                row.querySelector('.btn-approve-extra-item')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await approveIngredient(item.name, targetAmountKg);
                });
            }
        } else if (isApproved) {
            let undoStatus = logEntry.status === 'Dahil Değil' ? 'Atlandı' : `Onaylandı (${logEntry.operator})`;
            let qtyDisplay = logEntry.status === 'Dahil Değil' ? '-' : `${parseFloat(logEntry.actual).toFixed(3)} kg`;
            let iconClass = logEntry.status === 'Dahil Değil' ? 'x-circle' : 'check-circle';

            row.className = logEntry.status === 'Dahil Değil'
                ? 'glass-card p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all border-slate-500/30 bg-slate-800/50 opacity-70'
                : 'glass-card p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all border-green-500/30 bg-green-950/10';

            leftContent = `
                <div class="flex items-center justify-between w-full sm:w-auto gap-4 flex-wrap">
                    <div>
                        <div class="font-extrabold text-2xl text-slate-100 uppercase tracking-wide">${item.name}</div>
                        ${separateDetailsHTML}
                    </div>
                    <div class="text-3xl font-black font-mono ${logEntry.status === 'Dahil Değil' ? 'text-slate-400' : 'text-green-400'}">${qtyDisplay}</div>
                </div>
            `;
            rightContent = `
                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-2 ${logEntry.status === 'Dahil Değil' ? 'text-slate-400' : 'text-green-400'} font-bold text-sm">
                        <i data-lucide="${iconClass}" class="w-5 h-5"></i>
                        <span>${undoStatus}</span>
                    </div>
                    <button class="btn btn-red-outline btn-undo-item py-1.5 px-3 font-bold text-xs rounded-lg flex items-center gap-1 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                        <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Geri Al
                    </button>
                </div>
            `;
            row.innerHTML = leftContent + rightContent;
            row.querySelector('.btn-undo-item')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await undoIngredient(item.name);
            });
        } else {
            const isActive = state.connectedScale && state.activeWeighingItem && state.activeWeighingItem.name === item.name;

            if (state.connectedScale) {
                if (isActive) {
                    row.className = 'glass-card p-5 rounded-2xl border transition-all scale-[1.02] border-red-500 bg-red-950/20 text-slate-100 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4';
                    leftContent = `
                        <div class="w-full sm:w-auto overflow-hidden">
                            <div class="flex items-center justify-between gap-2 flex-nowrap w-full mb-2">
                                <div class="font-extrabold text-3xl text-slate-100 uppercase tracking-tighter whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-2" style="font-stretch: condensed;">
                                    <span class="animate-pulse w-3 h-3 rounded-full bg-red-500 shrink-0"></span>
                                    ${item.name}
                                </div>
                                <div class="text-4xl font-black font-mono text-orange-400 whitespace-nowrap shrink-0">${targetAmountKg.toFixed(3)} kg</div>
                            </div>
                            ${separateDetailsHTML}
                            <div class="text-3xl font-black font-mono text-slate-200 mt-4 flex flex-col sm:flex-row sm:items-baseline gap-2">
                                <div class="flex items-baseline gap-2">
                                    <span class="text-sm text-slate-400 uppercase">Tartılan:</span>
                                    <span id="live-val-${item.name}" class="text-5xl text-white">0.000 kg</span>
                                </div>
                            </div>
                            <div class="text-base text-slate-400 font-mono mt-2">Tolerans: ±${toleranceKg.toFixed(3)} kg</div>
                        </div>
                    `;
                    rightContent = `
                        <div class="flex flex-col items-start sm:items-end gap-1">
                            <span class="px-3 py-1.5 text-sm font-bold uppercase rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1.5">
                                <i data-lucide="scale" class="w-5 h-5 animate-bounce"></i> Tartılıyor
                            </span>
                        </div>
                    `;
                } else {
                    const bgClass = item.is_separate ? 'border-[#f5f5dc]/40 bg-[#f5f5dc]/10 hover:border-[#f5f5dc]/60' : 'border-slate-800 bg-slate-900/40 hover:border-orange-500/30';
                    const textClass = item.is_separate ? 'text-[#f5f5dc]' : 'text-slate-200';
                    row.className = `glass-card p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all cursor-pointer ${bgClass}`;
                    leftContent = `
                        <div class="flex items-center justify-between gap-3 flex-nowrap w-full sm:w-auto overflow-hidden">
                            <div class="flex-1 overflow-hidden">
                                <div class="font-extrabold text-2xl ${textClass} uppercase tracking-tighter whitespace-nowrap overflow-hidden text-ellipsis" style="font-stretch: condensed;">${item.name}</div>
                                ${separateDetailsHTML}
                            </div>
                            <div class="text-3xl font-black font-mono text-orange-400/90 whitespace-nowrap shrink-0">${targetAmountKg.toFixed(3)} kg</div>
                        </div>
                    `;
                    let skipBtnHTML = item.is_separate ? `
                        <button class="btn btn-slate-outline btn-skip-item py-2 px-4 font-bold text-sm rounded-lg flex items-center gap-1.5 hover:bg-slate-700 hover:text-white transition-all border border-slate-600 text-slate-300">
                            <i data-lucide="x-circle" class="w-5 h-5"></i> DAHİL DEĞİL
                        </button>
                    ` : '';

                    rightContent = `
                        <div class="flex items-center justify-end w-full sm:w-auto gap-2 mt-2 sm:mt-0">
                            <button class="btn btn-orange-outline border border-orange-500/20 text-orange-400 btn-select-item py-2 px-4 font-bold text-sm rounded-lg flex items-center gap-1.5 hover:bg-orange-500 hover:text-white transition-all">
                                <i data-lucide="scale" class="w-5 h-5"></i> TARTIMA BAŞLA
                            </button>
                            ${skipBtnHTML}
                        </div>
                    `;
                }
            } else {
                const bgClass = item.is_separate ? 'border-[#f5f5dc]/40 bg-[#f5f5dc]/10' : 'border-slate-800 bg-slate-900/50';
                const textClass = item.is_separate ? 'text-[#f5f5dc]' : 'text-slate-100';
                row.className = `glass-card p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${bgClass}`;
                leftContent = `
                    <div class="flex items-center justify-between gap-3 flex-nowrap w-full sm:w-auto overflow-hidden">
                        <div class="flex-1 overflow-hidden">
                            <div class="font-extrabold text-2xl ${textClass} uppercase tracking-tighter whitespace-nowrap overflow-hidden text-ellipsis" style="font-stretch: condensed;">${item.name}</div>
                            ${separateDetailsHTML}
                        </div>
                        <div class="text-3xl font-black font-mono text-orange-400 whitespace-nowrap shrink-0">${targetAmountKg.toFixed(3)} kg</div>
                    </div>
                `;
                let skipBtnHTML = item.is_separate ? `
                    <button class="btn btn-slate-outline btn-skip-item py-2 px-4 font-bold text-sm rounded-lg flex items-center gap-1.5 hover:bg-slate-700 hover:text-white transition-all border border-slate-600 text-slate-300">
                        <i data-lucide="x-circle" class="w-5 h-5"></i> DAHİL DEĞİL
                    </button>
                ` : '';

                rightContent = `
                    <div class="flex items-center justify-end w-full sm:w-auto gap-2 mt-2 sm:mt-0">
                        <button class="btn btn-orange btn-approve-item py-2 px-6 font-bold text-base rounded-lg flex items-center gap-1.5 shadow-lg shadow-orange-950/20 hover:scale-105 transition-all">
                            <i data-lucide="check" class="w-5 h-5"></i> ONAYLA
                        </button>
                        ${skipBtnHTML}
                    </div>
                `;
            }

            row.innerHTML = leftContent + rightContent;

            if (state.connectedScale) {
                if (!isActive && !item._isExtra) {
                    const startWeighing = async (e) => {
                        state.activeWeighingItem = {
                            name: item.name,
                            targetAmount: targetAmountKg,
                            tolerance: toleranceKg
                        };

                        if (state.connectedScale.is_simulator) {
                            dom.simLiveUrl.textContent = `http://${state.connectedScale.ip}:${state.connectedScale.port}/api/status`;
                        }

                        dom.simulatorFooter.classList.remove('hidden');
                        if (state.connectedScale.is_simulator) {
                            dom.simSliderContainer.classList.add('hidden');
                            dom.simLiveContainer.classList.remove('hidden');
                        } else {
                            dom.simSliderContainer.classList.add('hidden');
                            dom.simLiveContainer.classList.add('hidden');
                        }

                        // Set bottom confirm button to "UYGUN DEĞİL" initially
                        const confirmBtn = dom.btnWeighingConfirm;
                        const confirmTxt = dom.btnWeighingConfirmText;
                        confirmBtn.disabled = true;
                        confirmBtn.className = 'w-full md:w-auto h-24 px-14 btn btn-slate rounded-2xl text-2xl font-black opacity-50 cursor-not-allowed flex flex-col items-center justify-center min-w-[260px]';
                        confirmTxt.innerHTML = '<i data-lucide="alert-triangle" class="w-8 h-8 mb-1"></i><span>UYGUN DEĞİL</span>';

                        // Force refresh
                        lastWeighingScreenDataStr = null;
                        renderWeighingScreen();
                    };
                    row.addEventListener('click', startWeighing);
                }
            } else {
                const approveBtn = row.querySelector('.btn-approve-item');
                if (approveBtn) {
                    approveBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await approveIngredient(item.name, targetAmountKg);
                    });
                }
            }

            const skipBtn = row.querySelector('.btn-skip-item');
            if (skipBtn) {
                skipBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm('Bu ürünü tartıma dahil etmek istemediğinize emin misiniz?')) {
                        await approveIngredient(item.name, targetAmountKg, null, 'Dahil Değil');
                    }
                });
            }
        }

        itemContainer.appendChild(row);

        // Only show inline ref for actual recipe items, not extra items
        if (!item._isExtra) {
            const baseGr = parseFloat(item.amount) || 0;
            const isHidden = state.showInlineRef ? '' : 'hidden';
            const refDiv = document.createElement('div');
            refDiv.className = `inline-ref-info ${isHidden} px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs sm:text-sm font-mono text-slate-400 flex flex-wrap gap-x-4 gap-y-1 items-center justify-between shadow-inner`;
            refDiv.innerHTML = `
                <div><span class="text-orange-400/80 font-bold uppercase tracking-wider text-[10px]">Reçete Toplamı:</span> <span class="text-white ml-1">${totalRecipeGrams.toFixed(2)} gr</span></div>
                <div><span class="text-orange-400/80 font-bold uppercase tracking-wider text-[10px]">Ürünün Reçetedeki Miktarı:</span> <span class="text-white ml-1">${baseGr.toFixed(2)} gr</span></div>
            `;
            itemContainer.appendChild(refDiv);
        }

        // Always append to guarantee correct order based on itemsToRender without losing node state
        dom.operatorChecklistContainer.appendChild(itemContainer);
    });

    // Remove old items that no longer exist (and also clear any innerHTML injected warnings that lack IDs)
    Array.from(dom.operatorChecklistContainer.children).forEach(child => {
        if (!child.id || !expectedIds.has(child.id)) {
            child.remove();
        }
    });

    const btnToggleInline = document.getElementById('btn-toggle-inline-ref');
    if (btnToggleInline && !btnToggleInline.getAttribute('data-bound')) {
        btnToggleInline.setAttribute('data-bound', 'true');
        btnToggleInline.addEventListener('click', () => {
            state.showInlineRef = !state.showInlineRef;
            // Force refresh to apply classes immediately
            lastWeighingScreenDataStr = null;
            renderWeighingScreen();
        });
    }

    lucide.createIcons();

    // Sadece miksere girecek NORMAL ürünlerin tamamı onaylandı mı?
    const normalCheckItems = recipeItems.filter(item => !item.is_separate);

    const allNormalApproved = normalCheckItems.every(item =>
        activeBatchLogs.some(log => log.item === item.name)
    );

    console.log('[PACKAGING CHECK]', {
        recipeItems,
        normalCheckItems,
        activeBatchLogs,
        allNormalApproved
    });

    if (allNormalApproved) {
        dom.simulatorFooter.classList.add('hidden');
        if (state.activeJob && state.activeJob.batch && state.activeJob.batch.status === 'paketlemede') {
            if (dom.checklistCompletionPanel) dom.checklistCompletionPanel.classList.add('hidden');
            showPackagingScreen();
        } else {
            if (dom.checklistCompletionPanel) {
                dom.checklistCompletionPanel.classList.remove('hidden');

                const totalActual = (() => {
                    let base = activeBatchLogs.reduce((sum, log) => {
                        const recipeItem = state.activeJob.order.recipeItems.find(i => i.name === log.item);
                        if (recipeItem && recipeItem.is_separate) return sum;
                        return sum + parseFloat(log.actual);
                    }, 0);
                    // Add mixer extra items weight
                    let extraItemsForTotal = [];
                    if (state.activeJob.batch.extraItems) {
                        try { extraItemsForTotal = JSON.parse(state.activeJob.batch.extraItems); } catch (e) { }
                    }
                    const bw = state.activeJob.batch.targetAmount;
                    const ot = state.activeJob.order.totalAmount || bw;
                    const mixerExtra = extraItemsForTotal
                        .filter(e => e.type === 'mixer')
                        .reduce((sum, e) => sum + ((e.amount / 1000.0) * (bw / ot)), 0);
                    return base + mixerExtra;
                })();
                let summaryDiv = document.getElementById('completion-summary');
                if (!summaryDiv) {
                    summaryDiv = document.createElement('div');
                    summaryDiv.id = 'completion-summary';
                    summaryDiv.className = 'my-6 bg-slate-900/70 p-6 rounded-2xl border border-green-500/40 shadow-inner flex flex-col items-center justify-center max-w-md mx-auto';
                    dom.checklistCompletionPanel.insertBefore(summaryDiv, dom.checklistCompletionPanel.querySelector('#btn-show-packaging'));
                }
                summaryDiv.innerHTML = `
                    <span class="text-slate-400 font-bold uppercase text-sm mb-2 tracking-widest">TOPLAM TARTILAN AĞIRLIK</span>
                    <div class="text-5xl font-black font-mono text-green-400">${totalActual.toFixed(3)} kg</div>
                `;
            }
            if (dom.packagingPanel) dom.packagingPanel.classList.add('hidden');
        }
    } else {
        if (dom.checklistCompletionPanel) dom.checklistCompletionPanel.classList.add('hidden');
        if (dom.packagingPanel) dom.packagingPanel.classList.add('hidden');
    }

    lucide.createIcons();
}

async function approveIngredient(itemName, targetAmount, actualAmount = null, customStatus = 'Başarılı') {
    if (actualAmount === null) actualAmount = targetAmount;

    const batchId = state.activeJob.batch.id;

    // Zaten onaylanmışsa çık (çift tıklama koruması)
    if (!state.db.logs) state.db.logs = [];
    if (state.db.logs.some(l =>
        l.batchId === batchId && l.item === itemName &&
        (l.status === 'Başarılı' || l.status === 'Dahil Değil')
    )) return;

    const wasIdle = ['beklemede', 'Bekliyor'].includes(state.activeJob.batch.status);

    // Batch ilk kez başlıyorsa arka planda başlat (beklemeden)
    if (wasIdle) {
        state.activeJob.batch.status = 'tartımda';
        state.activeJob.batch.operator = state.currentUser.name;
        fetch(`/api/batches/${batchId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operator: state.currentUser.name })
        }).catch(e => console.error('Batch başlatma:', e));
    }

    const logData = {
        batchId,
        operator: state.currentUser.name,
        customer: state.activeJob.order.customer,
        recipe: state.activeJob.order.recipeName,
        item: itemName,
        target: parseFloat(targetAmount).toFixed(3),
        actual: parseFloat(actualAmount).toFixed(3),
        status: customStatus
    };

    try {
        // Sadece log POST'u bekle (~200ms) — fetchDb YOK
        const res = await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logData)
        });
        const result = await res.json();

        if (result.success) {
            // Logu confirmedLogs Map'ine kaydet — polling eski fetchDb cevabı yazsa bile korunur
            if (!state.confirmedLogs) state.confirmedLogs = new Map();
            state.confirmedLogs.set(`${batchId}:${itemName}`, logData);

            // state.db.logs'a ekle
            if (!state.db.logs.some(l =>
                l.batchId === batchId && l.item === itemName &&
                (l.status === 'Başarılı' || l.status === 'Dahil Değil')
            )) {
                state.db.logs.push(logData);
            }

            // Hemen render
            lastWeighingScreenDataStr = null;
            renderWeighingScreen();

            // Tüm normal ürünler onaylandı mı? (yerel state üzerinden)
            const activeBatchLogs = state.db.logs.filter(l =>
                l.batchId === batchId && (l.status === 'Başarılı' || l.status === 'Dahil Değil')
            );
            const normalItems = state.activeJob.order.recipeItems.filter(i => !i.is_separate);
            const allNormalApproved = normalItems.every(item =>
                activeBatchLogs.some(l => l.item === item.name &&
                    (l.status === 'Başarılı' || l.status === 'Dahil Değil'))
            );

            if (allNormalApproved) {
                // Mikserde durumuna geç — tamamen arka planda, beklemeden
                (async () => {
                    try {
                        await fetch(`/api/batches/${batchId}/status`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'mikserde' })
                        });
                        await fetchDb();
                        lastWeighingScreenDataStr = null;
                        renderWeighingScreen();
                    } catch (e) { console.error('Mikserde durum hatası:', e); }
                })();
            }
        } else {
            alert('Onaylama başarısız: ' + (result.message || 'Hata'));
        }
    } catch (e) {
        console.error('Onaylama hatası:', e);
        alert('Bağlantı hatası oluştu.');
    }
}

async function undoIngredient(itemName) {
    if (!state.activeJob || !state.activeJob.batch) return;
    if (!confirm(`${itemName} tartım onayını geri almak istediğinize emin misiniz?`)) return;

    try {
        const res = await apiPost(`/api/batches/${state.activeJob.batch.id}/logs/undo`, { item: itemName });
        if (res.success) {
            await fetchDb();
            if (state.activeWeighingItem && state.activeWeighingItem.name === itemName) {
                state.activeWeighingItem = null;
            }
            renderWeighingScreen();
        } else {
            alert('Hata: ' + (res.message || 'Geri alma işlemi başarısız.'));
        }
    } catch (e) {
        console.error("Undo error:", e);
    }
}

function calcPackagingLines(segments, batchTargetAmount, orderTotalAmount, totalActualWeighed) {
    const orderTotal = orderTotalAmount || batchTargetAmount;
    const batchRatio = batchTargetAmount / orderTotal;
    const segTotal = segments.reduce((sum, s) => sum + s.amount, 0) || orderTotal;

    return segments.map(seg => {
        const segAmount = seg.amount * batchRatio;
        const bagWeight = seg.bagWeight;
        const remainder = segAmount % bagWeight;
        const bagCount = (Math.abs(remainder) < 0.001 || Math.abs(remainder - bagWeight) < 0.001)
            ? Math.max(1, Math.round(segAmount / bagWeight))
            : Math.max(1, Math.ceil(segAmount / bagWeight));
        const segmentSpice = totalActualWeighed * (seg.amount / segTotal);
        const spicePerBag = segmentSpice / bagCount;
        return { bagWeight, bagCount, spicePerBag, segAmount };
    });
}

function showPackagingScreen() {
    const batchWeight = state.activeJob.batch.targetAmount;
    const order = state.activeJob.order;
    const orderTotal = order.totalAmount || batchWeight;
    const bagWeight = state.activeJob.batch.bagWeight || order.bagWeight || 100.0;

    const normalItems = state.activeJob.order.recipeItems.filter(i => !i.is_separate).map(i => i.name);
    const activeBatchLogs = state.db.logs.filter(l => l.batchId === state.activeJob.batch.id && (l.status === 'Başarılı' || l.status === 'Dahil Değil') && normalItems.includes(l.item));
    let totalActualWeighed = activeBatchLogs.reduce((sum, log) => sum + parseFloat(log.actual), 0);

    // Add mixer extra items weight to packaging calculation
    let batchExtraItemsPkg = [];
    if (state.activeJob.batch.extraItems) {
        try { batchExtraItemsPkg = JSON.parse(state.activeJob.batch.extraItems); } catch (e) { batchExtraItemsPkg = []; }
    }
    const mixerExtraKg = batchExtraItemsPkg
        .filter(e => e.type === 'mixer')
        .reduce((sum, e) => sum + ((e.amount / 1000.0) * (batchWeight / orderTotal)), 0);
    totalActualWeighed += mixerExtraKg;

    const hasSavedSegments = order.packagingSegments && order.packagingSegments.length > 1;
    const packagingSegments = hasSavedSegments
        ? order.packagingSegments
        : [{ amount: orderTotal, bagWeight: bagWeight }];

    const lines = calcPackagingLines(packagingSegments, batchWeight, orderTotal, totalActualWeighed);
    const totalBags = lines.reduce((sum, l) => sum + l.bagCount, 0);

    if (dom.packTotalBags) {
        dom.packTotalBags.textContent = `${totalBags} Adet`;
    }

    if (dom.packBagsList) {
        dom.packBagsList.innerHTML = lines.map(line => `
            <li class="flex justify-between items-center text-sm bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 mb-1">
                <span class="text-orange-300 font-bold">${line.bagWeight.toFixed(0)} kg <span class="text-slate-400 font-normal">× ${line.bagCount} torba</span></span>
                <span class="text-green-400 font-bold">${line.spicePerBag.toFixed(2)} kg <span class="text-slate-500 font-normal text-xs">baharat</span></span>
            </li>
        `).join('');
    }

    if (dom.packagingPanel) dom.packagingPanel.classList.remove('hidden');

    lucide.createIcons();
}

async function finishJob() {
    const activeBatchLogs = state.db.logs.filter(l => l.batchId === state.activeJob.batch.id && (l.status === 'Başarılı' || l.status === 'Dahil Değil'));
    const normalItems = state.activeJob.order.recipeItems.filter(i => !i.is_separate);
    const allNormalApproved = normalItems.every(item => {
        if (window.confirmedLogs && window.confirmedLogs.has(item.name)) return true;
        return activeBatchLogs.some(l => l.item === item.name);
    });
    if (!allNormalApproved) {
        alert('Lütfen işi bitirmeden önce tüm ana ürünlerin tartımını onaylayın!');
        return;
    }

    try {
        const res = await apiPost(`/api/batches/${state.activeJob.batch.id}/finish`);
        if (res.success) {
            alert('Üretim Tamamlandı! İş emri başarıyla tamamlandı.');
            await fetchDb();
            state.activeJob = null;
            state.weighingStep = 0;
            state.scaleValue = 0;
            state.tareValue = 0;
            renderOperatorPanel();
        }
    } catch (e) {
        // error handled
    }
}

