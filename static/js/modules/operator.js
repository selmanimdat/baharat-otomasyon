function renderOperatorPanel() {
    dom.operatorStationSelect.classList.add('hidden');
    dom.operatorJobsQueue.classList.add('hidden');
    dom.operatorWeighingScreen.classList.add('hidden');
    dom.packagingOverlay.classList.add('hidden');

    // Auto-select dummy scale to bypass scale selection screen
    if (!state.selectedScale) {
        state.selectedScale = { id: 9999, name: 'Sistem Terazisi' };
    }

    if (!state.activeJob) {
        // Pending jobs queue screen
        dom.operatorJobsQueue.classList.remove('hidden');
        dom.opLoggedUsername.textContent = state.currentUser.name;

        // Flatten all orders & pending/in-progress batches
        const pendingBatches = [];
        const opActiveStatuses = ['beklemede', 'Bekliyor', 'tartımda', 'Üretiliyor', 'mikserde', 'paketlemede'];
        if (state.showFinishedJobs) {
            opActiveStatuses.push('fiş kesilmedi', 'tamamlandı', 'Tamamlandı');
        }

        state.db.orders.forEach(o => {
            o.batches.forEach(b => {
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
                        operator: b.operator
                    });
                }
            });
        });

        dom.pendingJobsGrid.innerHTML = '';
        pendingBatches.forEach(b => {
            const card = document.createElement('div');
            card.className = 'pending-job-card';
            
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

            card.innerHTML = `
                <div>
                    <div class="text-orange-400 font-extrabold text-xl">${b.customer}</div>
                    <div class="text-slate-200 text-lg mt-0.5">${b.recipeName} - ${b.targetAmount.toFixed(2)} kg</div>
                    <div class="text-xs text-slate-500 mt-1 font-mono">Parti No: ${b.no} / ${b.totalBatches} ${statusBadgeHtml}</div>
                </div>
                <button class="btn ${btnClass} py-3.5 px-6 font-bold flex items-center gap-2 text-lg rounded-xl btn-action-job">
                    <i data-lucide="${btnIcon}" class="w-5 h-5"></i> ${btnText}
                </button>
            `;

            card.querySelector('.btn-action-job').addEventListener('click', async () => {
                await joinJob(b.orderId, b.batchId);
            });

            dom.pendingJobsGrid.appendChild(card);
        });

        if (pendingBatches.length === 0) {
            dom.pendingJobsGrid.innerHTML = '<div class="text-center text-slate-500 py-12 italic">Şu an sıraya alınmış bir iş bulunmamaktadır.</div>';
        }
    } else if (state.activeJob) {
        // Active weighing interface
        dom.operatorWeighingScreen.classList.remove('hidden');
        renderWeighingScreen();
    }
    lucide.createIcons();
}

async function startJob(orderId, batchId) {
    const order = state.db.orders.find(o => o.id === orderId);
    const batch = order.batches.find(b => b.id === batchId);

    try {
        const res = await apiPost(`/api/batches/${batchId}/start`, { operator: state.currentUser.name });
        if (res.success) {
            await fetchDb();
            state.activeJob = { order, batch };
            startChecklistPolling();
            renderOperatorPanel();
        }
    } catch (e) {
        // error alerted
    }
}

async function joinJob(orderId, batchId) {
    const order = state.db.orders.find(o => o.id === orderId);
    const batch = order.batches.find(b => b.id === batchId);

    if (order && batch) {
        state.activeJob = { order, batch };
        startChecklistPolling();
        renderOperatorPanel();
    }
}

function startChecklistPolling() {
    stopChecklistPolling();
    state.pollingIntervalId = setInterval(async () => {
        if (state.view === 'operator' && state.activeJob) {
            await fetchDb();
            const freshOrder = state.db.orders.find(o => o.id === state.activeJob.order.id);
            const freshBatch = freshOrder ? freshOrder.batches.find(b => b.id === state.activeJob.batch.id) : null;
            if (!freshBatch || ['fiş kesilmedi', 'tamamlandı', 'Tamamlandı', 'iptal'].includes(freshBatch.status)) {
                state.activeJob = null;
                dom.packagingOverlay.classList.add('hidden');
                stopChecklistPolling();
                renderOperatorPanel();
                return;
            }
            state.activeJob.batch = freshBatch;
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
    } catch (e) {}
}

function openScaleModal() {
    dom.modalScalesList.innerHTML = '';
    dom.modalConnectionStatus.classList.add('hidden');
    dom.scaleModalOverlay.classList.remove('hidden');

    if (state.db.scales.length === 0) {
        dom.modalScalesList.innerHTML = '<div class="text-center text-slate-500 py-6 italic">Kayıtlı terazi cihazı bulunamadı.</div>';
        return;
    }

    state.db.scales.forEach(s => {
        const item = document.createElement('div');
        item.className = 'p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-orange-500/50 cursor-pointer transition-all flex items-center justify-between';
        
        const typeBadge = s.is_simulator 
            ? `<span class="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Simülasyon</span>`
            : `<span class="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">Fiziksel</span>`;

        item.innerHTML = `
            <div>
                <div class="font-bold text-slate-200 text-sm flex items-center gap-2">
                    ${s.name}
                    ${typeBadge}
                </div>
                <div class="text-xs text-slate-500 font-mono mt-1">${s.ip}:${s.port}</div>
            </div>
            <i data-lucide="chevron-right" class="w-5 h-5 text-slate-600"></i>
        `;

        item.addEventListener('click', () => connectToScale(s));
        dom.modalScalesList.appendChild(item);
    });
    lucide.createIcons();
}

async function connectToScale(scale) {
    const statusEl = dom.modalConnectionStatus;
    statusEl.classList.remove('hidden');
    statusEl.textContent = `Bağlantı kuruluyor: ${scale.name}...`;
    statusEl.className = 'p-3 rounded-xl bg-slate-950 border border-slate-850 text-xs font-mono text-center text-slate-450';

    try {
        // For simulator, also verify client-side reachability first
        if (scale.is_simulator) {
            try {
                const simulatorUrl = `http://${scale.ip}:${scale.port}/api/status`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1500);
                const testRes = await fetch(simulatorUrl, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!testRes.ok) {
                    throw new Error(`HTTP Hata ${testRes.status}`);
                }
            } catch (err) {
                statusEl.textContent = `Bağlantı Hatası: Simülatör HTTP adresine ulaşılamadı (${scale.ip}:${scale.port}). Lütfen simülatörün çalıştığından emin olun.`;
                statusEl.className = 'p-3 rounded-xl bg-red-950/20 border border-red-500/30 text-xs font-mono text-center font-bold text-red-400';
                return;
            }
        }

        const isNativeApp = !!(window.ReactNativeWebView || window.AndroidScale);
        let success = false;
        let message = '';

        if (isNativeApp) {
            success = true;
        } else {
            const res = await apiPost(`/api/scales/${scale.id}/connect`);
            success = res.success;
            message = res.message;
        }

        if (success) {
            state.connectedScale = scale;
            if (window.AndroidScale && window.AndroidScale.connectToScale) {
                window.AndroidScale.connectToScale(scale.ip, String(scale.port));
            }
            if (window.ReactNativeWebView && !scale.is_simulator) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'connect',
                    ip: scale.ip,
                    port: String(scale.port)
                }));
            }
            statusEl.textContent = `BAĞLANTI BAŞARILI! ${scale.name} terazisine bağlanıldı.`;
            statusEl.className = 'p-3 rounded-xl bg-green-950/20 border border-green-500/30 text-xs font-mono text-center font-bold text-green-400';
            
            // Update connect button in header
            dom.btnConnectWeighter.innerHTML = `<i data-lucide="scale" class="w-4 h-4"></i> ${scale.name} (Kes)`;
            dom.btnConnectWeighter.className = 'btn btn-green px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 rounded-xl shadow-lg shadow-green-950/20';
            lucide.createIcons();

            // Handle simulator footer visibility
            if (scale.is_simulator) {
                dom.simulatorFooter.classList.remove('hidden');
                dom.simSliderContainer.classList.add('hidden'); // Hide manual slider
                dom.simLiveContainer.classList.remove('hidden'); // Show live stream monitor
                dom.simLiveUrl.textContent = `http://${scale.ip}:${scale.port}/api/status`;
                dom.simLiveJitter.textContent = '-';
                dom.simLiveWeight.textContent = '0.00 gr';
            } else {
                dom.simulatorFooter.classList.add('hidden');
                dom.simLiveContainer.classList.add('hidden');
            }

            // Start polling live weight
            startWeightPolling();

            // Auto close modal
            setTimeout(() => {
                dom.scaleModalOverlay.classList.add('hidden');
            }, 1200);
        } else {
            statusEl.textContent = `Bağlantı Hatası: ${message || 'Bilinmeyen Hata'}`;
            statusEl.className = 'p-3 rounded-xl bg-red-950/20 border border-red-500/30 text-xs font-mono text-center font-bold text-red-400';
        }
    } catch (e) {
        statusEl.textContent = `Bağlantı kurulamadı (TCP Zaman Aşımı/Hata)`;
        statusEl.className = 'p-3 rounded-xl bg-red-950/20 border border-red-500/30 text-xs font-mono text-center font-bold text-red-400';
    }
}

async function disconnectScale() {
    if (!state.connectedScale) return;
    const isNativeApp = !!(window.ReactNativeWebView || window.AndroidScale);
    if (!isNativeApp) {
        try {
            await apiPost(`/api/scales/${state.connectedScale.id}/disconnect`);
        } catch (e) {}
    }

    if (window.AndroidScale && window.AndroidScale.disconnectScale) {
        window.AndroidScale.disconnectScale();
    }
    if (window.ReactNativeWebView && state.connectedScale && !state.connectedScale.is_simulator) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'disconnect'
        }));
    }

    state.connectedScale = null;
    state.activeWeighingItem = null;
    stopWeightPolling();

    dom.btnConnectWeighter.innerHTML = `<i data-lucide="scale" class="w-4 h-4"></i> Akıllı Tartıya Bağlan`;
    dom.btnConnectWeighter.className = 'btn btn-orange px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 rounded-xl shadow-lg shadow-orange-950/20';
    lucide.createIcons();

    dom.simulatorFooter.classList.add('hidden');
    dom.simLiveContainer.classList.add('hidden');
    renderWeighingScreen();
}

function startWeightPolling() {
    stopWeightPolling();
    if (!state.connectedScale) return;

    state.liveWeightIntervalId = setInterval(async () => {
        if (!state.connectedScale) {
            stopWeightPolling();
            return;
        }

        try {
            const isNativeApp = !!(window.ReactNativeWebView || window.AndroidScale);
            if (window.appWs && window.appWs.readyState === WebSocket.OPEN && !state.connectedScale.is_simulator && !isNativeApp) {
                // Weight updates will be received via WebSocket pushed events
                return;
            }

            let liveWeight = 0.0;
            let jitterEnabled = false;

            if (isNativeApp && !state.connectedScale.is_simulator) {
                liveWeight = state.nativeWeight !== undefined ? state.nativeWeight : 0.0;
                jitterEnabled = false;
            } else if (state.connectedScale.is_simulator) {
                const simulatorUrl = `http://${state.connectedScale.ip}:${state.connectedScale.port}/api/status`;
                const res = await fetch(simulatorUrl);
                const data = await res.json();
                liveWeight = parseFloat(data.weight) || 0.0;
                jitterEnabled = !!(data.fluctuate || data.jitter);
                
                // Update live simulator stream monitor info in operator view
                if (dom.simLiveWeight) {
                    dom.simLiveWeight.textContent = `${liveWeight.toFixed(2)} gr`;
                }
                if (dom.simLiveJitter) {
                    dom.simLiveJitter.textContent = jitterEnabled ? 'Aktif' : 'Pasif';
                    dom.simLiveJitter.className = jitterEnabled ? 'text-orange-400 font-bold' : 'text-slate-400';
                }
            } else {
                const res = await fetch(`/api/scales/${state.connectedScale.id}/weight`);
                const data = await res.json();
                if (data.success) {
                    liveWeight = parseFloat(data.weight) || 0.0;
                }
            }
            
            // Update live weight on scales tab if active
            const liveCardVal = document.getElementById(`live-card-val-${state.connectedScale.id}`);
            if (liveCardVal) {
                liveCardVal.textContent = `ST,GS,+ ${liveWeight.toFixed(2)}gr`;
            }

            if (state.activeWeighingItem) {
                processLiveWeight(liveWeight);
            }
        } catch (e) {
            console.error("Scale weight polling error:", e);
        }
    }, 250);
}

function stopWeightPolling() {
    if (state.liveWeightIntervalId) {
        clearInterval(state.liveWeightIntervalId);
        state.liveWeightIntervalId = null;
    }
}

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
        valEl.textContent = `${weight.toFixed(2)} gr`;
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

    if (state.activeJob.batch.status === 'paketlemede') {
        showPackagingScreen();
        return;
    } else {
        dom.packagingOverlay.classList.add('hidden');
    }

    dom.weighingCustomer.textContent = state.activeJob.order.customer;
    dom.weighingRecipe.textContent = state.activeJob.order.recipeName;
    dom.weighingBatchBadge.textContent = `Parti ${state.activeJob.batch.no} (${state.activeJob.batch.targetAmount.toFixed(2)} kg)`;
    dom.weighingOperatorName.textContent = state.currentUser.name;

    const activeBatchLogs = state.db.logs.filter(l => l.batchId === state.activeJob.batch.id && l.status === 'Başarılı');
    const scaleFactor = state.activeJob.batch.targetAmount;

    dom.operatorChecklistContainer.innerHTML = '';
    
    // Sort items based on settings
    let itemsToRender = [...state.activeJob.order.recipeItems];
    const recipeOrderSetting = (state.db.settings || []).find(s => s.key === 'recipe_order');
    if (recipeOrderSetting && recipeOrderSetting.value) {
        const orderLines = recipeOrderSetting.value.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean);
        itemsToRender.sort((a, b) => {
            const idxA = orderLines.indexOf(a.name.trim().toLowerCase());
            const idxB = orderLines.indexOf(b.name.trim().toLowerCase());
            const posA = idxA === -1 ? Infinity : idxA;
            const posB = idxB === -1 ? Infinity : idxB;
            if (posA !== posB) {
                return posA - posB;
            }
            return a.name.localeCompare(b.name);
        });
    }
    
    itemsToRender.forEach(item => {
        const targetAmount = item.amount * scaleFactor;
        const logEntry = activeBatchLogs.find(l => l.item === item.name);
        const isApproved = !!logEntry;

        const row = document.createElement('div');
        row.id = `recipe-item-row-${item.name}`;

        let leftContent = '';
        let rightContent = '';

        if (isApproved) {
            row.className = 'glass-card p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all border-green-500/30 bg-green-950/10';
            leftContent = `
                <div>
                    <div class="font-extrabold text-lg text-slate-100 uppercase tracking-wide">${item.name}</div>
                    <div class="text-sm font-mono text-green-400 mt-0.5">Miktar: ${logEntry.actual} gr</div>
                </div>
            `;
            rightContent = `
                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-2 text-green-400 font-bold text-sm">
                        <i data-lucide="check-circle" class="w-5 h-5"></i>
                        <span>Onaylandı (${logEntry.operator})</span>
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
                        <div>
                            <div class="font-extrabold text-xl text-slate-100 uppercase tracking-wide flex items-center gap-2">
                                <span class="animate-pulse w-2 h-2 rounded-full bg-red-500"></span>
                                ${item.name}
                            </div>
                            <div class="text-2xl font-black font-mono text-slate-200 mt-2 flex items-center gap-2">
                                <span id="live-val-${item.name}">0.00 gr</span>
                                <span class="text-xs text-slate-500 font-normal flex-wrap">/ hedef: ${targetAmount.toFixed(2)} gr</span>
                            </div>
                            <div class="text-xs text-slate-400 font-mono mt-1">Tolerans: ±${(item.tolerance * scaleFactor).toFixed(2)} gr</div>
                        </div>
                    `;
                    rightContent = `
                        <div class="flex flex-col items-start sm:items-end gap-1">
                            <span class="px-3 py-1.5 text-xs font-bold uppercase rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1.5">
                                <i data-lucide="scale" class="w-4 h-4 animate-bounce"></i> Tartılıyor
                            </span>
                        </div>
                    `;
                } else {
                    row.className = 'glass-card p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all border-slate-800 bg-slate-900/40 hover:border-orange-500/30 cursor-pointer';
                    leftContent = `
                        <div>
                            <div class="font-extrabold text-lg text-slate-200 uppercase tracking-wide">${item.name}</div>
                            <div class="text-sm font-mono text-orange-400/70 mt-0.5">Hedef: ${targetAmount.toFixed(2)} gr</div>
                        </div>
                    `;
                    rightContent = `
                        <button class="btn btn-orange/20 border border-orange-500/20 text-orange-400 btn-select-item py-2 px-4 font-bold text-xs rounded-lg flex items-center gap-1.5 hover:bg-orange-500 hover:text-white transition-all">
                            <i data-lucide="scale" class="w-4 h-4"></i> TARTIMA BAŞLA
                        </button>
                    `;
                }
            } else {
                row.className = 'glass-card p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all border-slate-800 bg-slate-900/50';
                leftContent = `
                    <div>
                        <div class="font-extrabold text-lg text-slate-100 uppercase tracking-wide">${item.name}</div>
                        <div class="text-sm font-mono text-orange-400 mt-0.5">Hedef: ${targetAmount.toFixed(2)} gr</div>
                    </div>
                `;
                rightContent = `
                    <button class="btn btn-orange btn-approve-item py-2 px-4 font-bold text-sm rounded-lg flex items-center gap-1.5 shadow-lg shadow-orange-950/20">
                        <i data-lucide="check" class="w-4 h-4"></i> ONAYLA
                    </button>
                `;
            }

            row.innerHTML = leftContent + rightContent;

            if (state.connectedScale) {
                if (!isActive) {
                    const startWeighing = async (e) => {
                        state.activeWeighingItem = {
                            name: item.name,
                            targetAmount: targetAmount,
                            tolerance: item.tolerance * scaleFactor
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

                        renderWeighingScreen();
                    };
                    row.addEventListener('click', startWeighing);
                }
            } else {
                row.querySelector('.btn-approve-item').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await approveIngredient(item.name, targetAmount);
                });
            }
        }

        dom.operatorChecklistContainer.appendChild(row);
    });

    const allApproved = state.activeJob.order.recipeItems.every(item =>
        activeBatchLogs.some(l => l.item === item.name)
    );

    if (allApproved) {
        dom.checklistCompletionPanel.classList.remove('hidden');
        dom.simulatorFooter.classList.add('hidden');
    } else {
        dom.checklistCompletionPanel.classList.add('hidden');
    }

    lucide.createIcons();
}

async function approveIngredient(itemName, targetAmount, actualAmount = null) {
    if (actualAmount === null) actualAmount = targetAmount;
    const logData = {
        batchId: state.activeJob.batch.id,
        operator: state.currentUser.name,
        customer: state.activeJob.order.customer,
        recipe: state.activeJob.order.recipeName,
        item: itemName,
        target: parseFloat(targetAmount).toFixed(2),
        actual: parseFloat(actualAmount).toFixed(2),
        status: 'Başarılı'
    };

    try {
        const res = await apiPost('/api/logs', logData);
        if (res.success) {
            await fetchDb();
            const activeBatchLogs = state.db.logs.filter(l => l.batchId === state.activeJob.batch.id && l.status === 'Başarılı');
            const allApproved = state.activeJob.order.recipeItems.every(item =>
                activeBatchLogs.some(l => l.item === item.name)
            );
            if (allApproved) {
                try {
                    await apiPut(`/api/batches/${state.activeJob.batch.id}/status`, { status: 'mikserde' });
                    await fetchDb();
                } catch (e) {}
            }
            renderWeighingScreen();
        }
    } catch (e) {
        // error logged by apiPost
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

function showPackagingScreen() {
    const batchWeight = state.activeJob.batch.targetAmount;
    const bagWeight = state.activeJob.batch.bagWeight || 20.0;
    
    const fullBags = Math.floor(batchWeight / bagWeight);
    const remainder = batchWeight - (fullBags * bagWeight);
    let totalBags = fullBags;
    if (remainder > 0.01) {
        totalBags += 1;
    }
    
    dom.packTotalBags.textContent = `${totalBags} Adet`;
    dom.packBagsList.innerHTML = '';
    
    if (fullBags > 0) {
        const li = document.createElement('li');
        li.innerHTML = `<b>${fullBags} adet</b> x ${bagWeight.toFixed(2)} kg torba`;
        dom.packBagsList.appendChild(li);
    }
    if (remainder > 0.01) {
        const li = document.createElement('li');
        li.innerHTML = `<b>1 adet</b> x ${remainder.toFixed(2)} kg torba (Kalan)`;
        dom.packBagsList.appendChild(li);
    }
    
    dom.packagingOverlay.classList.remove('hidden');
}

async function finishJob() {
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

