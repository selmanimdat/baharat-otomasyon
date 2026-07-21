function bindEvents() {
    // Sidebar responsive toggle
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const adminSidebar = document.querySelector('#view-admin aside');
    
    // Create backdrop overlay
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        document.getElementById('view-admin').appendChild(backdrop);
    }
    
    if (btnToggleSidebar) {
        btnToggleSidebar?.addEventListener('click', () => {
            adminSidebar.classList.add('sidebar-active');
            backdrop.classList.add('active');
        });
    }
    
    backdrop?.addEventListener('click', () => {
        adminSidebar.classList.remove('sidebar-active');
        backdrop.classList.remove('active');
    });
    
    // Close sidebar on any button click
    const sidebarButtons = document.querySelectorAll('#view-admin aside button, #view-admin aside a, #view-admin aside .nav-item');
    sidebarButtons.forEach(btn => {
        btn?.addEventListener('click', () => {
            adminSidebar.classList.remove('sidebar-active');
            backdrop.classList.remove('active');
        });
    });

    // Role selection clicks
    dom.btnSelectAdmin?.addEventListener('click', () => {
        state.loginStep = 'admin_login';
        updateUI();
    });
    
    dom.btnSelectOperator?.addEventListener('click', () => {
        state.loginStep = 'operator_login';
        updateUI();
    });

    // Back buttons in login
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn?.addEventListener('click', () => {
            state.loginStep = 'role_select';
            updateUI();
        });
    });

    // Admin Login Submit
    if (dom.formAdminLogin) {
        dom.formAdminLogin?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = dom.adminSelectUsername.value;
            const password = dom.formAdminLogin.password.value;
            const rememberMe = dom.adminRememberMe.checked;
            await handleLogin(username, password, 'admin', rememberMe);
        });
    }

    // Operator Login Submit
    if (dom.formOperatorLogin) {
        dom.formOperatorLogin?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = dom.formOperatorLogin.username.value.trim();
            const password = dom.formOperatorLogin.password.value.trim();
            const rememberMe = dom.opRememberMe.checked;
            await handleLogin(username, password, 'operator', rememberMe);
        });
    }

    // Logout Click
    dom.btnAdminLogout?.addEventListener('click', handleLogout);
    
    document.querySelectorAll('.btn-operator-logout').forEach(btn => {
        btn?.addEventListener('click', handleLogout);
    });

    // Admin Sidebar Tab switching
    document.getElementById('tab-dashboard')?.addEventListener('click', () => { state.adminTab = 'dashboard'; renderAdminPanel(); });
    document.getElementById('tab-orders')?.addEventListener('click', () => { state.adminTab = 'orders'; renderAdminPanel(); });
    document.getElementById('tab-customers')?.addEventListener('click', () => { state.adminTab = 'customers'; renderAdminPanel(); });
    document.getElementById('tab-recipes')?.addEventListener('click', () => { state.adminTab = 'recipes'; state.activeFirmId = null; state.activeRecipeId = null; renderAdminPanel(); });
    document.getElementById('tab-users')?.addEventListener('click', () => { state.adminTab = 'users'; renderAdminPanel(); });
    document.getElementById('tab-scales')?.addEventListener('click', () => { state.adminTab = 'scales'; renderAdminPanel(); });
    document.getElementById('tab-reports')?.addEventListener('click', () => { state.adminTab = 'reports'; renderAdminPanel(); });
    document.getElementById('tab-traceability')?.addEventListener('click', () => { state.adminTab = 'traceability'; renderAdminPanel(); });
    document.getElementById('tab-accounting')?.addEventListener('click', () => { state.adminTab = 'accounting'; renderAdminPanel(); });
    document.getElementById('tab-settings')?.addEventListener('click', () => { state.adminTab = 'settings'; renderAdminPanel(); });

    // Customer Modal Handlers
    document.getElementById('btn-add-customer')?.addEventListener('click', () => openCustomerModal());
    document.getElementById('btn-close-customer-modal')?.addEventListener('click', () => closeCustomerModal());
    document.getElementById('btn-cancel-customer-modal')?.addEventListener('click', () => closeCustomerModal());
    document.getElementById('form-customer-modal')?.addEventListener('submit', handleSaveCustomerSubmit);

    // Settings Accordion Toggles
    const btnToggleIngredients = document.getElementById('btn-toggle-setting-ingredients');
    const bodyIngredients = document.getElementById('setting-ingredients-body');
    const iconIngredients = document.getElementById('icon-toggle-ingredients');
    const lblIngredients = document.getElementById('lbl-ingredients-status');

    if (btnToggleIngredients && bodyIngredients) {
        btnToggleIngredients.addEventListener('click', () => {
            const isHidden = bodyIngredients.classList.contains('hidden');
            if (isHidden) {
                bodyIngredients.classList.remove('hidden');
                if (iconIngredients) iconIngredients.style.transform = 'rotate(180deg)';
                if (lblIngredients) {
                    lblIngredients.textContent = 'Kapat';
                    lblIngredients.className = 'text-xs font-bold font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 transition-all';
                }
            } else {
                bodyIngredients.classList.add('hidden');
                if (iconIngredients) iconIngredients.style.transform = 'rotate(0deg)';
                if (lblIngredients) {
                    lblIngredients.textContent = 'Tıklayıp Aç';
                    lblIngredients.className = 'text-xs font-bold font-mono text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 transition-all';
                }
            }
        });
    }

    const btnToggleScales = document.getElementById('btn-toggle-setting-scales');
    const bodyScales = document.getElementById('setting-scales-body');
    const iconScales = document.getElementById('icon-toggle-scales');
    const lblScales = document.getElementById('lbl-scales-status');

    if (btnToggleScales && bodyScales) {
        btnToggleScales.addEventListener('click', () => {
            const isHidden = bodyScales.classList.contains('hidden');
            if (isHidden) {
                bodyScales.classList.remove('hidden');
                if (iconScales) iconScales.style.transform = 'rotate(180deg)';
                if (lblScales) {
                    lblScales.textContent = 'Kapat';
                    lblScales.className = 'text-xs font-bold font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 transition-all';
                }
            } else {
                bodyScales.classList.add('hidden');
                if (iconScales) iconScales.style.transform = 'rotate(0deg)';
                if (lblScales) {
                    lblScales.textContent = 'Tıklayıp Aç';
                    lblScales.className = 'text-xs font-bold font-mono text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 transition-all';
                }
            }
        });
    }

    // Settings Add Ingredient
    if (dom.formAddSettingsIngredient) {
        dom.formAddSettingsIngredient.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = dom.formAddSettingsIngredient.ingredientName;
            const newName = input.value.trim();
            if (!newName) return;

            let currentOrder = [];
            const settingObj = (state.db.settings || []).find(s => s.key === 'recipe_order');
            if (settingObj && settingObj.value) {
                currentOrder = settingObj.value.split('\n').map(s => s.trim()).filter(Boolean);
            }
            
            if (currentOrder.includes(newName)) {
                alert('Bu hammadde zaten listede var.');
                return;
            }

            currentOrder.push(newName);
            
            try {
                const res = await apiPost('/api/settings', { key: 'recipe_order', value: currentOrder.join('\n') });
                if (res.success) {
                    input.value = '';
                    await fetchDb();
                    if (typeof renderSettingsTab === 'function') renderSettingsTab();
                }
            } catch(e) { }
        });
    }

    // Order Creation Form dropdown logic
    dom.orderFirmSelect?.addEventListener('change', (e) => {
        state.orderSelectedFirmId = parseInt(e.target.value) || null;
        renderOrdersTab();
    });

    dom.formCreateOrder?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(dom.formCreateOrder);
        const data = {
            firmId: fd.get('firmId'),
            recipeId: fd.get('recipeId'),
            totalAmount: fd.get('amount'),
            batches: fd.get('batches'),
            bagWeight: fd.get('bagWeight')
        };
        
        try {
            await apiPost('/api/orders', data);
            alert('Sipariş başarıyla oluşturuldu ve partilere bölündü.');
            dom.formCreateOrder.reset();
            state.orderSelectedFirmId = null;
            await fetchDb();
            renderOrdersTab();
        } catch (e) {
            // error alerted
        }
    });

    // Recipe level back navigations
    dom.breadcrumbFirms?.addEventListener('click', () => {
        state.activeFirmId = null;
        state.activeRecipeId = null;
        renderRecipesTab();
    });
    
    document.querySelectorAll('.btn-back-to-firms').forEach(btn => {
        btn?.addEventListener('click', () => {
            state.activeFirmId = null;
            state.activeRecipeId = null;
            renderRecipesTab();
        });
    });

    dom.breadcrumbFirmName?.addEventListener('click', () => {
        state.activeRecipeId = null;
        renderRecipesTab();
    });

    document.querySelectorAll('.btn-back-to-recipes').forEach(btn => {
        btn?.addEventListener('click', () => {
            state.activeRecipeId = null;
            renderRecipesTab();
        });
    });

    // Add Customer Firm
    dom.formAddFirm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = dom.formAddFirm.firmName.value.trim();
        try {
            await apiPost('/api/firms', { name });
            dom.formAddFirm.reset();
            await fetchDb();
            renderRecipesTab();
        } catch(e) {}
    });

    // Add Recipe
    dom.formAddRecipe?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = dom.formAddRecipe.recipeName.value.trim();
        try {
            await apiPost('/api/recipes', { firmId: state.activeFirmId, name });
            dom.formAddRecipe.reset();
            await fetchDb();
            renderRecipesTab();
        } catch(e) {}
    });

    // Add Ingredient
    dom.formAddIngredient?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(dom.formAddIngredient);
        const name = fd.get('name').trim();
        
        // Validate against settings list
        let allowed = [];
        const settingObj = (state.db.settings || []).find(s => s.key === 'recipe_order');
        if (settingObj && settingObj.value) {
            allowed = settingObj.value.split('\n').map(s => s.trim()).filter(Boolean);
        }
        if (!allowed.includes(name)) {
            alert('Lütfen ayarlarda tanımlı bir hammadde seçin veya listeden aratarak bulun.');
            return;
        }

        const data = {
            name: name,
            amount: parseFloat(fd.get('amount')),
            tolerance: parseFloat(fd.get('tolerance'))
        };
        try {
            await apiPost(`/api/recipes/${state.activeRecipeId}/items`, data);
            dom.formAddIngredient.reset();
            await fetchDb();
            renderRecipesTab();
        } catch(e) {}
    });

    // Add User
    dom.formAddUser?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = dom.formAddUser.name.value.trim();
        const password = dom.formAddUser.password.value.trim();
        const role = dom.formAddUser.role.value;
        try {
            await apiPost('/api/users', { name, password, role });
            dom.formAddUser.reset();
            await fetchDb();
            renderUsersTab();
        } catch (e) {}
    });

    // Add Scale
    dom.formAddScale?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(dom.formAddScale);
        const name = fd.get('name').trim();
        const ip = fd.get('ip').trim();
        const port = fd.get('port');
        const connection_type = fd.get('connection_type') || 'wired';
        const data_format = fd.get('data_format') || 'densi';
        const is_simulator = dom.formAddScale.querySelector('#scale-simulator').value === 'true';
        
        try {
            let testSuccess = false;
            let errorMessage = '';

            if (is_simulator) {
                try {
                    const simulatorUrl = `http://${ip}:${port}/api/status`;
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);
                    const res = await fetch(simulatorUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    testSuccess = res.ok;
                    if (!res.ok) errorMessage = `HTTP Hata ${res.status}`;
                } catch (err) {
                    testSuccess = false;
                    errorMessage = err.message || 'Cihaza ulaşılamadı';
                }
            } else {
                if (window.ReactNativeWebView) {
                    const nativeRes = await window.testNativeConnection(ip, port);
                    testSuccess = nativeRes.success;
                    errorMessage = nativeRes.success ? '' : (nativeRes.message || 'Bağlantı zaman aşımı');
                } else {
                    const testRes = await apiPost('/api/scales/test-connection', { ip, port, is_simulator });
                    testSuccess = testRes.success;
                    errorMessage = testRes.message;
                }
            }

            if (!testSuccess) {
                const proceed = confirm(`Cihaza bağlantı kurulamadı: ${errorMessage}\nCihazı yine de kaydetmek istiyor musunuz?`);
                if (!proceed) return;
            }
            
            const res = await apiPost('/api/scales', { name, ip, port, is_simulator, connection_type, data_format });
            if (res.success) {
                alert(`"${name}" terazisi başarıyla sisteme eklendi.`);
                dom.formAddScale.reset();
                await fetchDb();
                renderScalesTab();
            }
        } catch (e) {}
    });

    // Reports Filters event hooks
    dom.filterStartDate?.addEventListener('change', (e) => { state.filters.startDate = e.target.value; renderReportsTab(); });
    dom.filterEndDate?.addEventListener('change', (e) => { state.filters.endDate = e.target.value; renderReportsTab(); });
    dom.filterFirm?.addEventListener('change', (e) => { state.filters.firm = e.target.value; renderReportsTab(); });
    dom.filterRecipe?.addEventListener('change', (e) => { state.filters.recipe = e.target.value; renderReportsTab(); });
    dom.filterOperator?.addEventListener('change', (e) => { state.filters.operator = e.target.value; renderReportsTab(); });
    document.getElementById('filter-search')?.addEventListener('input', (e) => { state.filters.search = e.target.value; renderReportsTab(); });

    dom.btnClearFilters?.addEventListener('click', () => {
        if (dom.filterStartDate) dom.filterStartDate.value = '';
        if (dom.filterEndDate) dom.filterEndDate.value = '';
        if (dom.filterFirm) dom.filterFirm.value = '';
        if (dom.filterRecipe) dom.filterRecipe.value = '';
        if (dom.filterOperator) dom.filterOperator.value = '';
        const searchInput = document.getElementById('filter-search');
        if (searchInput) searchInput.value = '';
        state.filters = { startDate: '', endDate: '', firm: '', recipe: '', operator: '', search: '' };
        renderReportsTab();
    });

    // Traceability Filters event hooks
    const traceFilterBatchId = document.getElementById('trace-filter-batch-id');
    const traceFilterFirm = document.getElementById('trace-filter-firm');
    const traceFilterRecipe = document.getElementById('trace-filter-recipe');
    const traceFilterOperator = document.getElementById('trace-filter-operator');

    if (traceFilterBatchId) {
        traceFilterBatchId?.addEventListener('input', () => renderTraceabilityTab());
        traceFilterFirm?.addEventListener('input', () => renderTraceabilityTab());
        traceFilterRecipe?.addEventListener('input', () => renderTraceabilityTab());
        traceFilterOperator?.addEventListener('input', () => renderTraceabilityTab());
    }

    // Trace Modal event hooks
    const btnCloseTraceModal = document.getElementById('btn-close-trace-modal');
    const traceModalOverlay = document.getElementById('trace-modal-overlay');
    if (btnCloseTraceModal && traceModalOverlay) {
        btnCloseTraceModal?.addEventListener('click', () => {
            traceModalOverlay.classList.add('hidden');
        });
        traceModalOverlay?.addEventListener('click', (e) => {
            if (e.target === traceModalOverlay) {
                traceModalOverlay.classList.add('hidden');
            }
        });
    }

    // Backup Restore Upload Trigger
    dom.btnImportTrigger?.addEventListener('click', () => {
        dom.importFileInput.click();
    });

    dom.importFileInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/system/import', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (result.success) {
                alert('Yedek veritabanı dosyası başarıyla yüklendi! Sistem güncellendi.');
                await fetchDb();
                updateUI();
            } else {
                alert('Hatalı format: ' + result.message);
            }
        } catch (err) {
            alert('Dosya okunamadı: ' + err.message);
        }
        dom.importFileInput.value = ''; // Reset file input
    });

    dom.btnBackToStations?.addEventListener('click', () => {
        state.selectedScale = null;
        renderOperatorPanel();
    });

    dom.btnToggleFinishedJobs?.addEventListener('click', () => {
        state.showFinishedJobs = !state.showFinishedJobs;
        if (dom.txtToggleFinished) {
            dom.txtToggleFinished.textContent = state.showFinishedJobs ? 'Biten İşleri Gizle' : 'Biten İşleri Göster';
        }
        renderOperatorPanel();
    });

    dom.btnAbortJob?.addEventListener('click', async () => {
        if (confirm('İşlem yarıda kesilecek. Çıkmak istediğinize emin misiniz?')) {
            stopChecklistPolling();
            try {
                await disconnectScale();
            } catch (e) {}
            state.activeJob = null;
            renderOperatorPanel();
        }
    });

    dom.btnShowPackaging?.addEventListener('click', async () => {
        try {
            await apiPut(`/api/batches/${state.activeJob.batch.id}/status`, { status: 'paketlemede' });
            await fetchDb();
        } catch (e) {}
        showPackagingScreen();
    });

    dom.btnPackagingFinish?.addEventListener('click', async () => {
        dom.packagingOverlay.classList.add('hidden');
        await finishJob();
    });

    dom.btnPackagingBack?.addEventListener('click', async () => {
        try {
            await apiPut(`/api/batches/${state.activeJob.batch.id}/status`, { status: 'tartımda' });
            await fetchDb();
        } catch (e) {}
        dom.packagingOverlay.classList.add('hidden');
        renderWeighingScreen();
    });

    // Smart scale listeners
    dom.btnConnectWeighter?.addEventListener('click', () => {
        if (state.connectedScale) {
            disconnectScale();
        } else {
            openScaleModal();
        }
    });

    dom.btnCloseScaleModal?.addEventListener('click', () => {
        dom.scaleModalOverlay.classList.add('hidden');
    });

    dom.scaleModalOverlay?.addEventListener('click', (e) => {
        if (e.target === dom.scaleModalOverlay) {
            dom.scaleModalOverlay.classList.add('hidden');
        }
    });

    dom.simulatorSlider?.addEventListener('input', async () => {
        const val = parseFloat(dom.simulatorSlider.value) || 0.0;
        dom.simGross.textContent = `Brüt: ${val.toFixed(2)} gr`;
        
        if (state.connectedScale && state.connectedScale.is_simulator) {
            try {
                await fetch(`/api/scales/${state.connectedScale.id}/weight`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ weight: val })
                });
            } catch (e) {
                console.error("Failed to post simulator weight:", e);
            }
        }
    });

    dom.btnWeighingConfirm?.addEventListener('click', async () => {
        if (state.activeWeighingItem && state.activeWeighingItem.actualWeight !== undefined) {
            await approveIngredient(
                state.activeWeighingItem.name, 
                state.activeWeighingItem.targetAmount, 
                state.activeWeighingItem.actualWeight
            );
            state.activeWeighingItem = null;
            dom.simulatorFooter.classList.add('hidden');
            renderWeighingScreen();
        }
    });
}

// React Native WebView message bridge listeners
const handleReactNativeMessage = (e) => {
    try {
        const data = JSON.parse(e.data);
        if (data.type === 'weight') {
            const weightVal = parseFloat(data.weight) || 0.0;
            state.nativeWeight = weightVal;
            
            // Immediately update UI for the active scale (if not simulated)
            if (state.connectedScale && !state.connectedScale.is_simulator) {
                // Update live weight on scales tab if active
                const liveCardVal = document.getElementById(`live-card-val-${state.connectedScale.id}`);
                if (liveCardVal) {
                    liveCardVal.textContent = `ST,GS,+ ${weightVal.toFixed(2)}gr`;
                }

                if (state.activeWeighingItem) {
                    processLiveWeight(weightVal);
                }
            }
        }
    } catch(err) {}
};
window?.addEventListener('message', handleReactNativeMessage);
document?.addEventListener('message', handleReactNativeMessage);

