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
    document.getElementById('tab-audit-logs')?.addEventListener('click', () => { state.adminTab = 'audit-logs'; renderAdminPanel(); });
    
    document.getElementById('tab-switch-operator')?.addEventListener('click', () => {
        state.view = 'operator';
        updateUI();
    });

    document.getElementById('btn-return-to-admin')?.addEventListener('click', () => {
        state.view = 'admin';
        updateUI();
    });

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
            if (state.pendingRecipeOrder && state.pendingRecipeOrder.length > 0) {
                currentOrder = [...state.pendingRecipeOrder];
            } else {
                const settingObj = (state.db.settings || []).find(s => s.key === 'recipe_order');
                if (settingObj && settingObj.value) {
                    currentOrder = settingObj.value.split('\n').map(s => s.trim()).filter(Boolean);
                }
            }
            
            if (currentOrder.includes(newName)) {
                alert('Bu hammadde zaten listede var.');
                return;
            }

            currentOrder.push(newName);
            input.value = '';
            state.pendingRecipeOrder = currentOrder;
            document.getElementById('settings-recipe-order-actions')?.classList.remove('hidden');
            if (typeof renderIngredientsList === 'function') {
                // Not accessible directly here because renderIngredientsList is scoped in admin.js
                // So we'll just set the state and re-render the whole settings tab, but we need a way
                // to not lose the pending state!
                // Ah, renderSettingsTab fetches from state.db.settings by default.
                // We must update state.db.settings temporarily or render manually.
            }
            // For now, let's just temporarily update state.db.settings so renderSettingsTab uses it
            const existing = (state.db.settings || []).find(s => s.key === 'recipe_order');
            if (existing) existing.value = currentOrder.join('\n');
            else state.db.settings.push({ key: 'recipe_order', value: currentOrder.join('\n') });
            
            if (typeof renderSettingsTab === 'function') renderSettingsTab();
            setTimeout(() => {
                document.getElementById('settings-recipe-order-actions')?.classList.remove('hidden');
            }, 50);
        });
    }

    // Check Ingredient Logic
    document.getElementById('input-check-ingredient')?.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        const resultsContainer = document.getElementById('check-ingredient-results');
        if (!resultsContainer) return;
        
        if (val.length < 2) {
            resultsContainer.innerHTML = '<span class="text-slate-500 italic text-xs">Yazmaya başlayın... (en az 2 harf)</span>';
            return;
        }

        let currentOrder = [];
        if (state.pendingRecipeOrder && state.pendingRecipeOrder.length > 0) {
            currentOrder = [...state.pendingRecipeOrder];
        } else {
            const settingObj = (state.db.settings || []).find(s => s.key === 'recipe_order');
            if (settingObj && settingObj.value) {
                currentOrder = settingObj.value.split('\n').map(s => s.trim()).filter(Boolean);
            }
        }
        
        const matches = currentOrder.filter(item => item.toLowerCase().includes(val));
        
        if (matches.length === 0) {
            resultsContainer.innerHTML = '<span class="text-emerald-500 font-bold text-xs"><i data-lucide="check-circle" class="w-3 h-3 inline"></i> Bu ürün listede yok. Eklenebilir.</span>';
        } else {
            const matchHtml = matches.map(m => `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-xs">${m}</span>`).join(' ');
            resultsContainer.innerHTML = `<div class="flex flex-wrap gap-2">${matchHtml}</div>`;
        }
        lucide.createIcons();
    });

    // Order Creation Form dropdown logic
    dom.orderFirmSelect?.addEventListener('change', (e) => {
        state.orderSelectedFirmId = parseInt(e.target.value) || null;
        renderOrdersTab();
    });

    dom.orderRecipeSelect?.addEventListener('change', () => {
        if (state.orderSelectedFirmId) {
            const setting = (state.db.settings || []).find(s => s.key === 'firm_mixer_capacities');
            if (setting && setting.value) {
                try {
                    const data = JSON.parse(setting.value);
                    const capacities = data[String(state.orderSelectedFirmId)] || [];
                    if (capacities.length > 1) {
                        window.orderSegments = capacities.map((cap, i) => ({
                            id: Date.now() + i,
                            amount: 0,
                            bagWeight: cap
                        }));
                        const input = document.getElementById('order-bag-weight');
                        if (input) input.value = '';
                        if (typeof window.renderOrderSegments === 'function') window.renderOrderSegments();
                    } else if (capacities.length === 1) {
                        const input = document.getElementById('order-bag-weight');
                        if (input) input.value = capacities[0];
                        window.orderSegments = [];
                        if (typeof window.renderOrderSegments === 'function') window.renderOrderSegments();
                    } else {
                        window.orderSegments = [];
                        if (typeof window.renderOrderSegments === 'function') window.renderOrderSegments();
                    }
                } catch(e) {}
            } else {
                window.orderSegments = [];
                if (typeof window.renderOrderSegments === 'function') window.renderOrderSegments();
            }
        }
        if (typeof updateOrderFormSummary === 'function') updateOrderFormSummary();
    });
    document.getElementById('order-amount')?.addEventListener('input', () => {
        if (typeof updateOrderFormSummary === 'function') updateOrderFormSummary();
    });
    document.getElementById('order-bag-weight')?.addEventListener('input', () => {
        if (typeof updateOrderFormSummary === 'function') updateOrderFormSummary();
    });
    document.getElementById('order-batches')?.addEventListener('change', () => {
        if (typeof updateOrderFormSummary === 'function') updateOrderFormSummary();
    });


    document.getElementById('btn-add-order-segment')?.addEventListener('click', () => {
        if (!window.orderSegments) window.orderSegments = [];
        window.orderSegments.push({ id: Date.now(), amount: 0, bagWeight: 0 });
        if (typeof window.renderOrderSegments === 'function') window.renderOrderSegments();
        if (typeof updateOrderFormSummary === 'function') updateOrderFormSummary();
    });


    dom.formCreateOrder?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(dom.formCreateOrder);
        let bagWeightVal = fd.get('bagWeight');
        if ((!bagWeightVal || !parseFloat(bagWeightVal)) && window.orderSegments && window.orderSegments.length > 0) {
            const firstSeg = window.orderSegments.find(s => s.bagWeight && parseFloat(s.bagWeight) > 0);
            if (firstSeg) {
                bagWeightVal = firstSeg.bagWeight;
            } else {
                bagWeightVal = 250;
            }
        }

        const data = {
            firmId: fd.get('firmId'),
            recipeId: fd.get('recipeId'),
            totalAmount: fd.get('amount'),
            batches: fd.get('batches'),
            bagWeight: bagWeightVal,
            deliveryDate: fd.get('deliveryDate') || getTodayDateStr(),
            urgency: fd.get('urgency') || 'normal',
            notes: fd.get('notes') || ''
        };
        
        if (window.orderSegments && window.orderSegments.length > 0) {
            data.segments = window.orderSegments;
        }

        if (window.orderExtras && window.orderExtras.length > 0) {
            data.extras = window.orderExtras;
        }

        try {
            await apiPost('/api/orders', data);
            
            // Auto save capacity to settings (Overwrite with the capacities actually used in this order)
            if (data.firmId) {
                let uniqueCapacities = [];
                if (data.bagWeight) {
                    const cap = Number(data.bagWeight);
                    if (!isNaN(cap) && cap > 0) uniqueCapacities.push(cap);
                }
                if (data.segments && data.segments.length > 0) {
                    data.segments.forEach(seg => {
                        const cap = Number(seg.bagWeight);
                        if (!isNaN(cap) && cap > 0 && !uniqueCapacities.includes(cap)) {
                            uniqueCapacities.push(cap);
                        }
                    });
                }

                const setting = (state.db.settings || []).find(s => s.key === 'firm_mixer_capacities');
                let capData = {};
                if (setting && setting.value) {
                    try { capData = JSON.parse(setting.value); } catch(e) {}
                }
                const fKey = String(data.firmId);
                
                // Overwrite the capacities for this firm
                capData[fKey] = uniqueCapacities;
                
                await apiPost('/api/settings', {
                    key: 'firm_mixer_capacities',
                    value: JSON.stringify(capData)
                });
            }

            alert('Sipariş başarıyla oluşturuldu ve partilere bölündü.');
            dom.formCreateOrder.reset();
            window.orderSegments = [];
            window.orderExtras = [];
            if (typeof window.renderOrderSegments === 'function') window.renderOrderSegments();
            if (typeof window.renderOrderExtras === 'function') window.renderOrderExtras();
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
            state.viewingArchive = false;
            state.currentArchiveIndex = 0;
            state.archiveList = [];
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
    let isAddingIngredientToRecipe = false;
    dom.formAddIngredient?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isAddingIngredientToRecipe) return;

        const fd = new FormData(dom.formAddIngredient);
        const name = (fd.get('name') || '').trim();
        if (!name) return;
        
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

        // Check if ingredient already exists in active recipe
        const activeRecipe = (state.db.recipes || []).find(r => Number(r.id) === Number(state.activeRecipeId));
        if (activeRecipe && activeRecipe.items) {
            const alreadyExists = activeRecipe.items.some(item => (item.name || '').trim().toLowerCase() === name.toLowerCase());
            if (alreadyExists) {
                alert(`"${name}" hammaddesi bu reçetede zaten ekli! Aynı ürünü tekrar ekleyemezsiniz.`);
                return;
            }
        }

        const amountVal = parseFloat(fd.get('amount'));
        const toleranceVal = parseFloat(fd.get('tolerance'));
        if (isNaN(amountVal)) {
            alert('Lütfen geçerli bir miktar giriniz.');
            return;
        }

        const unitPriceRaw = fd.get('unit_price');
        const unitPrice = unitPriceRaw && unitPriceRaw.trim() !== '' ? parseFloat(unitPriceRaw) : null;

        const data = {
            name: name,
            amount: amountVal,
            tolerance: isNaN(toleranceVal) ? 1.0 : toleranceVal,
            unit_price: unitPrice
        };

        isAddingIngredientToRecipe = true;
        const submitBtn = dom.formAddIngredient.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            await apiPost(`/api/recipes/${state.activeRecipeId}/items`, data);
            dom.formAddIngredient.reset();
            const listEl = document.getElementById('ingredient-autocomplete-list');
            if (listEl) listEl.classList.add('hidden');
            await fetchDb();
            renderRecipesTab();

            // Auto-scroll DOWN and focus for rapid sequential adding
            setTimeout(() => {
                const addContainer = document.getElementById('add-ingredient-container');
                if (addContainer) {
                    addContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }
                const ingNameInput = document.getElementById('ing-name');
                if (ingNameInput) {
                    ingNameInput.focus({ preventScroll: true });
                }
            }, 150);
        } catch(e) {
            console.error(e);
        } finally {
            isAddingIngredientToRecipe = false;
            if (submitBtn) submitBtn.disabled = false;
        }
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
        if (dom.checklistCompletionPanel) dom.checklistCompletionPanel.classList.add('hidden');
        showPackagingScreen();
    });

    dom.btnPackagingFinish?.addEventListener('click', async () => {
        if (dom.packagingPanel) dom.packagingPanel.classList.add('hidden');
        await finishJob();
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

