
// --- LUCIDE OFFLINE SAFETY FALLBACK ---
if (typeof lucide === 'undefined') {
    window.lucide = {
        createIcons: function() {
            console.warn("Lucide icons library not loaded. Falling back safely.");
        }
    };
}

// --- NATIVE SCALE CONNECTION TEST BRIDGE ---
window.testNativeConnection = function(ip, port) {
    return new Promise((resolve) => {
        const reqId = Math.random().toString(36).substring(2);
        const timeoutId = setTimeout(() => {
            window.removeEventListener('message', handleMsg);
            document.removeEventListener('message', handleMsg);
            resolve({ success: false, message: 'timeout' });
        }, 3000);
        
        function handleMsg(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'test-connection-result' && data.reqId === reqId) {
                    clearTimeout(timeoutId);
                    window.removeEventListener('message', handleMsg);
                    document.removeEventListener('message', handleMsg);
                    resolve({ success: data.success, message: data.message });
                }
            } catch(e) {}
        }
        
        window.addEventListener('message', handleMsg);
        document.addEventListener('message', handleMsg);
        
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'test-connection',
                reqId: reqId,
                ip: ip,
                port: port
            }));
        } else {
            clearTimeout(timeoutId);
            window.removeEventListener('message', handleMsg);
            document.removeEventListener('message', handleMsg);
            resolve({ success: false, message: 'No native bridge available' });
        }
    });
};

// --- STATE MANAGEMENT ---
const state = {
    view: 'login',           // login | admin | operator
    loginStep: 'role_select', // role_select | admin_login | operator_login
    currentUser: null,       // Authenticated user object
    db: {
        users: [],
        scales: [],
        firms: [],
        recipes: [],
        orders: [],
        logs: []
    },
    adminTab: 'dashboard',      // dashboard | orders | recipes | users | scales | reports
    pollingIntervalId: null, // Checklist refresh interval ID
    
    // Smart scale state
    connectedScale: null,      // Active connected scale object
    activeWeighingItem: null,  // Currently selected recipe item to weigh: { name, targetAmount, tolerance }
    liveWeightIntervalId: null, // Poll interval ID for live weight
    beeperIntervalId: null,    // Sound warning interval ID
    
    // Recipe editor sub-state
    activeFirmId: null,
    activeRecipeId: null,
    orderSelectedFirmId: null,
    
    // Operator weighing sub-state
    selectedScale: null,     // Selected Scale object
    activeJob: null,         // { order, batch }
    weighingStep: 0,
    scaleValue: 0.0,
    tareValue: 0.0,
    showWarning: false,
    
    // Reports filtering
    filters: {
        startDate: '',
        endDate: '',
        firm: '',
        recipe: '',
        operator: ''
    }
};

// --- DOM ELEMENTS REFERENCE ---
const dom = {
    // Views
    viewLogin: document.getElementById('view-login'),
    viewAdmin: document.getElementById('view-admin'),
    viewOperator: document.getElementById('view-operator'),
    
    // Login Steps
    loginStepRole: document.getElementById('login-step-role'),
    loginStepAdmin: document.getElementById('login-step-admin'),
    loginStepOperator: document.getElementById('login-step-operator'),
    
    // Login Elements
    btnSelectAdmin: document.getElementById('btn-select-admin'),
    btnSelectOperator: document.getElementById('btn-select-operator'),
    formAdminLogin: document.getElementById('form-admin-login'),
    adminSelectUsername: document.getElementById('admin-select-username'),
    adminRememberMe: document.getElementById('admin-remember-me'),
    formOperatorLogin: document.getElementById('form-operator-login'),
    opRememberMe: document.getElementById('op-remember-me'),
    
    // Admin navigation
    tabDashboard: document.getElementById('tab-dashboard'),
    tabOrders: document.getElementById('tab-orders'),
    tabRecipes: document.getElementById('tab-recipes'),
    tabUsers: document.getElementById('tab-users'),
    tabScales: document.getElementById('tab-scales'),
    tabReports: document.getElementById('tab-reports'),
    tabTraceability: document.getElementById('tab-traceability'),
    adminSessionUsername: document.getElementById('admin-session-username'),
    btnAdminLogout: document.getElementById('btn-admin-logout'),
    
    // Admin Panels
    panelDashboard: document.getElementById('panel-dashboard'),
    panelOrders: document.getElementById('panel-orders'),
    panelRecipes: document.getElementById('panel-recipes'),
    panelUsers: document.getElementById('panel-users'),
    panelScales: document.getElementById('panel-scales'),
    panelReports: document.getElementById('panel-reports'),
    panelTraceability: document.getElementById('panel-traceability'),
    
    // Admin Forms
    formCreateOrder: document.getElementById('form-create-order'),
    orderFirmSelect: document.getElementById('order-firm-select'),
    orderRecipeSelect: document.getElementById('order-recipe-select'),
    activeJobsList: document.getElementById('active-jobs-list'),
    
    // Recipe Tab Elements
    breadcrumbFirms: document.getElementById('breadcrumb-firms'),
    crumbArrowFirm: document.getElementById('crumb-arrow-firm'),
    breadcrumbFirmName: document.getElementById('breadcrumb-firm-name'),
    crumbArrowRecipe: document.getElementById('crumb-arrow-recipe'),
    breadcrumbRecipeName: document.getElementById('breadcrumb-recipe-name'),
    recipeLvlFirms: document.getElementById('recipe-lvl-firms'),
    recipeLvlRecipes: document.getElementById('recipe-lvl-recipes'),
    recipeLvlIngredients: document.getElementById('recipe-lvl-ingredients'),
    firmsGrid: document.getElementById('firms-grid'),
    formAddFirm: document.getElementById('form-add-firm'),
    firmRecipesTitle: document.getElementById('firm-recipes-title'),
    recipesListContainer: document.getElementById('recipes-list-container'),
    formAddRecipe: document.getElementById('form-add-recipe'),
    recipeIngredientsTitle: document.getElementById('recipe-ingredients-title'),
    recipeIngredientsList: document.getElementById('recipe-ingredients-list'),
    formAddIngredient: document.getElementById('form-add-ingredient'),
    
    // User Panel Elements
    formAddUser: document.getElementById('form-add-user'),
    usersListBody: document.getElementById('users-list-body'),
    
    // Scales Panel Elements
    formAddScale: document.getElementById('form-add-scale'),
    scalesGrid: document.getElementById('scales-grid'),
    
    // Reports Panel Elements
    reportsRecordCount: document.getElementById('reports-record-count'),
    filterStartDate: document.getElementById('filter-start-date'),
    filterEndDate: document.getElementById('filter-end-date'),
    filterFirm: document.getElementById('filter-firm'),
    filterRecipe: document.getElementById('filter-recipe'),
    filterOperator: document.getElementById('filter-operator'),
    btnClearFilters: document.getElementById('btn-clear-filters'),
    reportsTableBody: document.getElementById('reports-table-body'),
    
    // Operator Section Elements
    operatorStationSelect: document.getElementById('operator-station-select'),
    opScalesGrid: document.getElementById('op-scales-grid'),
    operatorJobsQueue: document.getElementById('operator-jobs-queue'),
    opLoggedUsername: document.getElementById('op-logged-username'),
    pendingJobsGrid: document.getElementById('pending-jobs-grid'),
    btnBackToStations: document.getElementById('btn-back-to-stations'),
    
    // Operator Weighing Elements
    operatorWeighingScreen: document.getElementById('operator-weighing-screen'),
    weighingCustomer: document.getElementById('weighing-customer'),
    weighingRecipe: document.getElementById('weighing-recipe'),
    weighingBatchBadge: document.getElementById('weighing-batch-badge'),
    weighingOperatorName: document.getElementById('weighing-operator-name'),
    btnAbortJob: document.getElementById('btn-abort-job'),
    weighingIndicatorPane: document.getElementById('weighing-indicator-pane'),
    weighingIngredientName: document.getElementById('weighing-ingredient-name'),
    weighingTargetDisplay: document.getElementById('weighing-target-display'),
    weighingNetWeight: document.getElementById('weighing-net-weight'),
    warningOverlay: document.getElementById('warning-overlay'),
    warningDesc: document.getElementById('warning-desc'),
    btnWarningForce: document.getElementById('btn-warning-force'),
    btnWarningCancel: document.getElementById('btn-warning-cancel'),
    packagingOverlay: document.getElementById('packaging-overlay'),
    packTotalBags: document.getElementById('pack-total-bags'),
    packBagsList: document.getElementById('pack-bags-list'),
    btnPackagingFinish: document.getElementById('btn-packaging-finish'),
    simulatorFooter: document.getElementById('simulator-footer'),
    simSliderContainer: document.getElementById('sim-slider-container'),
    simulatorSlider: document.getElementById('simulator-slider'),
    simTare: document.getElementById('sim-tare'),
    simGross: document.getElementById('sim-gross'),
    btnWeighingConfirm: document.getElementById('btn-weighing-confirm'),
    btnWeighingConfirmText: document.getElementById('btn-weighing-confirm-text'),
    simLiveContainer: document.getElementById('sim-live-container'),
    simLiveUrl: document.getElementById('sim-live-url'),
    simLiveJitter: document.getElementById('sim-live-jitter'),
    simLiveWeight: document.getElementById('sim-live-weight'),
    
    operatorChecklistContainer: document.getElementById('operator-checklist-container'),
    checklistCompletionPanel: document.getElementById('checklist-completion-panel'),
    btnShowPackaging: document.getElementById('btn-show-packaging'),

    // Smart scale connection UI
    btnConnectWeighter: document.getElementById('btn-connect-weighter'),
    scaleModalOverlay: document.getElementById('scale-modal-overlay'),
    btnCloseScaleModal: document.getElementById('btn-close-scale-modal'),
    modalScalesList: document.getElementById('modal-scales-list'),
    modalConnectionStatus: document.getElementById('modal-connection-status'),

    // Backup & DB control
    btnImportTrigger: document.getElementById('btn-import-trigger'),
    importFileInput: document.getElementById('import-file-input')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    await checkAuth();
    lucide.createIcons();
    startGlobalBackgroundPolling();
});

// --- API FETCH WRAPPERS ---
async function apiPost(url, data = {}) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Bir hata oluştu.');
        }
        return await res.json();
    } catch (e) {
        alert(e.message);
        throw e;
    }
}

async function apiDelete(url) {
    try {
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Silme işlemi başarısız.');
        }
        return await res.json();
    } catch (e) {
        alert(e.message);
        throw e;
    }
}

async function apiPut(url, data) {
    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Güncelleme işlemi başarısız.');
        }
        return await res.json();
    } catch (e) {
        alert(e.message);
        throw e;
    }
}

async function fetchDb() {
    try {
        const res = await fetch('/api/db');
        state.db = await res.json();
    } catch (e) {
        console.error("Database fetch error", e);
    }
}

function initWebSocket() {
    if (window.appWs) {
        try { window.appWs.close(); } catch(e) {}
    }
    
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.hostname}:5001`;
    
    const ws = new WebSocket(wsUrl);
    window.appWs = ws;
    
    ws.onopen = () => {
        console.log("WebSocket connected successfully.");
    };
    
    ws.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'db_updated') {
                console.log("Real-time DB update notification received.");
                await fetchDb();
                updateUI();
            } else if (data.type === 'weight_update') {
                if (state.connectedScale && state.connectedScale.id == data.scale_id) {
                    const weight = parseFloat(data.weight) || 0.0;
                    
                    // Update live weight on scales tab if active
                    const liveCardVal = document.getElementById(`live-card-val-${state.connectedScale.id}`);
                    if (liveCardVal) {
                        liveCardVal.textContent = `ST,GS,+ ${weight.toFixed(2)}gr`;
                    }
                    
                    // Update live scale value display in operator row
                    if (state.activeWeighingItem) {
                        processLiveWeight(weight);
                    }
                }
            }
        } catch (e) {
            console.error("Error handling WebSocket message:", e);
        }
    };
    
    ws.onclose = () => {
        console.log("WebSocket closed. Reconnecting in 3 seconds...");
        setTimeout(initWebSocket, 3000);
    };
    
    ws.onerror = (err) => {
        console.error("WebSocket error:", err);
    };
}

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/status');
        const auth = await res.json();
        if (auth.authenticated) {
            state.currentUser = auth.user;
            state.view = auth.user.role === 'operator' ? 'operator' : 'admin';
        } else {
            // Try auto-login if rememberedUser is present
            const remembered = localStorage.getItem('rememberedUser');
            if (remembered) {
                try {
                    const parsed = JSON.parse(remembered);
                    const loginRes = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: parsed.username,
                            password: parsed.password,
                            role: parsed.role
                        })
                    });
                    if (loginRes.ok) {
                        const data = await loginRes.json();
                        if (data.success) {
                            state.currentUser = data.user;
                            state.view = data.user.role === 'operator' ? 'operator' : 'admin';
                        }
                    } else {
                        localStorage.removeItem('rememberedUser');
                    }
                } catch (err) {
                    console.error("Auto-login error:", err);
                }
            }
            
            if (!state.currentUser) {
                state.currentUser = null;
                state.view = 'login';
            }
        }
        await fetchDb();
        updateUI();
        initWebSocket();
    } catch (e) {
        state.view = 'login';
        updateUI();
        initWebSocket();
    }
}

// --- NAVIGATION & ROUTING ---
function updateUI() {
    // Hide all main views
    dom.viewLogin.classList.add('hidden');
    dom.viewAdmin.classList.add('hidden');
    dom.viewOperator.classList.add('hidden');

    if (state.view === 'login') {
        dom.viewLogin.classList.remove('hidden');
        renderLoginSteps();
    } else if (state.view === 'admin') {
        dom.viewAdmin.classList.remove('hidden');
        dom.adminSessionUsername.textContent = state.currentUser.name;
        renderAdminPanel();
    } else if (state.view === 'operator') {
        dom.viewOperator.classList.remove('hidden');
        renderOperatorPanel();
    }
    lucide.createIcons();
}

function renderLoginSteps() {
    dom.loginStepRole.classList.add('hidden');
    dom.loginStepAdmin.classList.add('hidden');
    dom.loginStepOperator.classList.add('hidden');

    if (state.loginStep === 'role_select') {
        dom.loginStepRole.classList.remove('hidden');
    } else if (state.loginStep === 'admin_login') {
        dom.loginStepAdmin.classList.remove('hidden');
        renderAdminUserList();
    } else if (state.loginStep === 'operator_login') {
        dom.loginStepOperator.classList.remove('hidden');
        dom.formOperatorLogin.reset();
    }
}

function renderAdminUserList() {
    const admins = state.db.users.filter(u => ['admin', 'manager', 'secretary'].includes(u.role));
    if (dom.adminSelectUsername) {
        dom.adminSelectUsername.innerHTML = admins.map(admin => {
            let roleLabel = '';
            if (admin.role === 'admin') roleLabel = 'Müdür';
            else if (admin.role === 'manager') roleLabel = 'Yönetici';
            else if (admin.role === 'secretary') roleLabel = 'Sekreterya';
            return `<option value="${admin.name}">${admin.name} (${roleLabel})</option>`;
        }).join('');
    }
    if (dom.formAdminLogin) {
        dom.formAdminLogin.reset();
    }
}

async function handleLogin(username, password, role, rememberMe = false) {
    try {
        const res = await apiPost('/api/auth/login', { username, password, role });
        if (res.success) {
            state.currentUser = res.user;
            state.view = res.user.role === 'operator' ? 'operator' : 'admin';
            state.loginStep = 'role_select';
            
            if (rememberMe) {
                localStorage.setItem('rememberedUser', JSON.stringify({ username, password, role }));
            } else {
                localStorage.removeItem('rememberedUser');
            }
            
            await fetchDb();
            updateUI();
        }
    } catch (e) {
        // Error already alerted in apiPost
    }
}

async function handleLogout() {
    try {
        await apiPost('/api/auth/logout');
    } catch (e) {}
    localStorage.removeItem('rememberedUser');
    stopChecklistPolling();
    try {
        await disconnectScale();
    } catch (e) {}
    state.currentUser = null;
    state.view = 'login';
    state.loginStep = 'role_select';
    state.selectedScale = null;
    state.activeJob = null;
    state.weighingStep = 0;
    state.scaleValue = 0;
    state.tareValue = 0;
    updateUI();
}

function updateNavigationPermissions() {
    const user = state.currentUser;
    if (!user) return;

    const isAdmin = user.role === 'admin';

    const toggleEl = (el, show) => {
        if (!el) return;
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    };

    const showDashboard = ['admin', 'manager', 'secretary'].includes(user.role);
    const showOrders = isAdmin || !!user.canManageOrders;
    const showRecipes = isAdmin || !!user.canManageRecipes;
    const showUsers = isAdmin || !!user.canManageUsers;
    const showScales = isAdmin || !!user.canManageScales;
    const showReports = isAdmin || !!user.canViewReports;

    toggleEl(dom.tabDashboard, showDashboard);
    toggleEl(dom.tabOrders, showOrders);
    toggleEl(dom.tabRecipes, showRecipes);
    toggleEl(dom.tabUsers, showUsers);
    toggleEl(dom.tabScales, showScales);
    toggleEl(dom.tabReports, showReports);
    toggleEl(dom.tabTraceability, showReports || showOrders);

    // Hide/show Backup options based on admin role
    const backupContainer = document.getElementById('btn-export-backup')?.parentElement;
    toggleEl(backupContainer, isAdmin);

    const allowedTabs = [];
    if (showDashboard) allowedTabs.push('dashboard');
    if (showOrders) allowedTabs.push('orders');
    if (showRecipes) allowedTabs.push('recipes');
    if (showUsers) allowedTabs.push('users');
    if (showScales) allowedTabs.push('scales');
    if (showReports) allowedTabs.push('reports');
    if (showReports || showOrders) allowedTabs.push('traceability');

    if (allowedTabs.length > 0 && !allowedTabs.includes(state.adminTab)) {
        state.adminTab = allowedTabs[0];
    }
}

// --- ADMIN PANEL RENDERING ---
function renderAdminPanel() {
    updateNavigationPermissions();

    // Highlight sidebar tabs
    if (dom.tabDashboard) dom.tabDashboard.classList.remove('active');
    dom.tabOrders.classList.remove('active');
    dom.tabRecipes.classList.remove('active');
    dom.tabUsers.classList.remove('active');
    dom.tabScales.classList.remove('active');
    dom.tabReports.classList.remove('active');
    if (dom.tabTraceability) dom.tabTraceability.classList.remove('active');

    const activeTabEl = document.getElementById(`tab-${state.adminTab}`);
    if (activeTabEl) activeTabEl.classList.add('active');

    // Toggle panels
    if (dom.panelDashboard) dom.panelDashboard.classList.add('hidden');
    dom.panelOrders.classList.add('hidden');
    dom.panelRecipes.classList.add('hidden');
    dom.panelUsers.classList.add('hidden');
    dom.panelScales.classList.add('hidden');
    dom.panelReports.classList.add('hidden');
    if (dom.panelTraceability) dom.panelTraceability.classList.add('hidden');

    if (state.adminTab === 'dashboard') {
        if (dom.panelDashboard) dom.panelDashboard.classList.remove('hidden');
        renderDashboardTab();
    } else if (state.adminTab === 'orders') {
        dom.panelOrders.classList.remove('hidden');
        renderOrdersTab();
    } else if (state.adminTab === 'recipes') {
        dom.panelRecipes.classList.remove('hidden');
        renderRecipesTab();
    } else if (state.adminTab === 'users') {
        dom.panelUsers.classList.remove('hidden');
        renderUsersTab();
    } else if (state.adminTab === 'scales') {
        dom.panelScales.classList.remove('hidden');
        renderScalesTab();
    } else if (state.adminTab === 'reports') {
        dom.panelReports.classList.remove('hidden');
        renderReportsTab();
    } else if (state.adminTab === 'traceability') {
        if (dom.panelTraceability) dom.panelTraceability.classList.remove('hidden');
        renderTraceabilityTab();
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

    // 3. Compute stats
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogs = state.db.logs.filter(log => log.timestamp && log.timestamp.startsWith(todayStr));
    
    // Daily Production Sum
    const totalTodayProd = todayLogs.reduce((sum, log) => sum + (log.actual || 0), 0);
    const prodStatEl = document.getElementById('dash-stat-prod');
    if (prodStatEl) {
        prodStatEl.textContent = `${totalTodayProd.toFixed(2)} kg`;
    }

    // Daily Sales Sum
    let totalTodaySales = 0;
    todayLogs.forEach(log => {
        const recipe = state.db.recipes.find(r => r.name === log.recipe);
        const pricePerKg = recipe ? (recipe.pricePerKg || 150.0) : 150.0;
        totalTodaySales += (log.actual || 0) * pricePerKg;
    });
    const salesStatEl = document.getElementById('dash-stat-sales');
    if (salesStatEl) {
        salesStatEl.textContent = `${totalTodaySales.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
    }

    // Batches count
    let completedBatchesCount = 0;
    let totalBatchesCount = 0;
    state.db.orders.forEach(order => {
        if (order.batches) {
            order.batches.forEach(b => {
                totalBatchesCount++;
                if (b.status === 'Tamamlandı') {
                    completedBatchesCount++;
                }
            });
        }
    });
    const batchesStatEl = document.getElementById('dash-stat-batches');
    if (batchesStatEl) {
        batchesStatEl.textContent = `${completedBatchesCount} / ${totalBatchesCount}`;
    }

    // Active scales count
    const activeScales = state.db.scales.filter(s => s.status);
    const totalScales = state.db.scales.length;
    const scalesStatEl = document.getElementById('dash-stat-scales');
    if (scalesStatEl) {
        scalesStatEl.textContent = `${activeScales.length} / ${totalScales}`;
    }

    // 4. Render Charts (Chart.js)
    
    // 4.1 Production & Sales Trend (Last 7 Days)
    const days = [];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split('T')[0];
        days.push(dayStr);
        labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }

    const prodData = [];
    const salesData = [];

    days.forEach(dayStr => {
        const logsForDay = state.db.logs.filter(log => log.timestamp && log.timestamp.startsWith(dayStr));
        const prodSum = logsForDay.reduce((sum, log) => sum + (log.actual || 0), 0);
        
        let salesSum = 0;
        logsForDay.forEach(log => {
            const recipe = state.db.recipes.find(r => r.name === log.recipe);
            const pricePerKg = recipe ? (recipe.pricePerKg || 150.0) : 150.0;
            salesSum += (log.actual || 0) * pricePerKg;
        });

        prodData.push(prodSum.toFixed(2));
        salesData.push(salesSum.toFixed(2));
    });

    const datasets = [
        {
            label: 'Üretim (kg)',
            data: prodData,
            borderColor: 'rgb(249, 115, 22)', // Orange
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            yAxisID: 'y',
            tension: 0.35,
            fill: true
        }
    ];

    if (canViewSales) {
        datasets.push({
            label: 'Satış Değeri (TL)',
            data: salesData,
            borderColor: 'rgb(16, 185, 129)', // Emerald
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            yAxisID: 'y1',
            tension: 0.35,
            fill: true
        });
    }

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

        if (canViewSales) {
            chartOptions.scales.y1 = {
                type: 'linear',
                display: true,
                position: 'right',
                grid: { drawOnChartArea: false },
                ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } },
                title: {
                    display: true,
                    text: 'Satış Tutarı (TL)',
                    color: '#94a3b8',
                    font: { family: 'Outfit', size: 10, weight: 'bold' }
                }
            };
        }

        chartProdTrendInstance = new Chart(trendCanvas, {
            type: 'line',
            data: { labels, datasets },
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
                    <td class="p-3 font-mono text-slate-400">${(log.target || 0).toFixed(2)} kg</td>
                    <td class="p-3 font-mono text-slate-200 font-bold">${(log.actual || 0).toFixed(2)} kg</td>
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
            if (canManageRecipes) addIngredientContainer.classList.remove('hidden');
            else addIngredientContainer.classList.add('hidden');
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

    dom.scalesGrid.innerHTML = '';
    state.db.scales.forEach(s => {
        const card = document.createElement('div');
        card.className = 'scale-card relative p-5 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col justify-between';
        
        const typeBadge = s.is_simulator 
            ? `<span class="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">Simülasyon</span>`
            : `<span class="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20">Fiziksel</span>`;

        const deleteButtonHtml = canManageScales
            ? `<button class="btn-trash absolute top-4 right-4 btn-delete-scale text-slate-500 hover:text-red-400 transition-colors" data-scale-id="${s.id}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
            : '';

        card.innerHTML = `
            <div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="font-bold text-lg text-slate-200">${s.name}</span>
                    ${typeBadge}
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
            const statusEl = document.getElementById(`test-status-${s.id}`);
            statusEl.textContent = 'Test ediliyor...';
            statusEl.className = 'text-xs font-mono text-slate-450';
            try {
                if (s.is_simulator) {
                    const simulatorUrl = `http://${s.ip}:${s.port}/api/status`;
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);
                    const res = await fetch(simulatorUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (res.ok) {
                        statusEl.textContent = 'ONLINE';
                        statusEl.className = 'text-xs font-bold font-mono text-green-400';
                    } else {
                        statusEl.textContent = 'OFFLINE (HTTP Hata)';
                        statusEl.className = 'text-xs font-bold font-mono text-red-400';
                    }
                } else {
                    let testSuccess = false;
                    let nativeMessage = '';
                    if (window.ReactNativeWebView) {
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

                    if (testSuccess) {
                        statusEl.textContent = 'ONLINE';
                        statusEl.className = 'text-xs font-bold font-mono text-green-400';
                    } else {
                        statusEl.textContent = 'OFFLINE' + (nativeMessage ? ` (${nativeMessage})` : '');
                        statusEl.className = 'text-xs font-bold font-mono text-red-400';
                    }
                }
            } catch (e) {
                statusEl.textContent = 'OFFLINE';
                statusEl.className = 'text-xs font-bold font-mono text-red-400';
            }
        });

        if (canManageScales) {
            card.querySelector('.btn-delete-scale').addEventListener('click', async () => {
                if (confirm(`"${s.name}" terazisini silmek istediğinize emin misiniz?`)) {
                    await apiDelete(`/api/scales/${s.id}`);
                    await fetchDb();
                    renderScalesTab();
                }
            });
        }

        dom.scalesGrid.appendChild(card);
    });
    lucide.createIcons();
}

// 5. REPORTS TAB
function renderReportsTab() {
    // Populate dynamic filter options once (avoid loop repeats if option exists)
    const operators = [...new Set(state.db.logs.map(l => l.operator))];
    const firms = [...new Set(state.db.logs.map(l => l.customer))];
    const recipes = [...new Set(state.db.logs.map(l => l.recipe))];

    // Populate dropdowns
    const oldFirmVal = dom.filterFirm.value;
    dom.filterFirm.innerHTML = '<option value="">Tümü</option>';
    firms.forEach(f => {
        if (f) {
            const opt = document.createElement('option');
            opt.value = f; opt.textContent = f;
            if (f === oldFirmVal) opt.selected = true;
            dom.filterFirm.appendChild(opt);
        }
    });

    const oldRecipeVal = dom.filterRecipe.value;
    dom.filterRecipe.innerHTML = '<option value="">Tümü</option>';
    recipes.forEach(r => {
        if (r) {
            const opt = document.createElement('option');
            opt.value = r; opt.textContent = r;
            if (r === oldRecipeVal) opt.selected = true;
            dom.filterRecipe.appendChild(opt);
        }
    });

    const oldOpVal = dom.filterOperator.value;
    dom.filterOperator.innerHTML = '<option value="">Tümü</option>';
    operators.forEach(o => {
        if (o) {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            if (o === oldOpVal) opt.selected = true;
            dom.filterOperator.appendChild(opt);
        }
    });

    // Apply Filter Logic
    const filteredLogs = state.db.logs.filter(log => {
        const logDate = new Date(log.timestamp);
        const start = state.filters.startDate ? new Date(state.filters.startDate) : null;
        const end = state.filters.endDate ? new Date(state.filters.endDate) : null;
        if (end) end.setHours(23, 59, 59);

        const dateMatch = (!start || logDate >= start) && (!end || logDate <= end);
        const operatorMatch = !state.filters.operator || log.operator === state.filters.operator;
        const firmMatch = !state.filters.firm || log.customer === state.filters.firm;
        const recipeMatch = !state.filters.recipe || log.recipe === state.filters.recipe;

        return dateMatch && operatorMatch && firmMatch && recipeMatch;
    });

    dom.reportsRecordCount.textContent = `${filteredLogs.length} Kayıt Bulundu`;

    // Render table
    dom.reportsTableBody.innerHTML = '';
    filteredLogs.forEach(l => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-850 hover:bg-slate-900/10';
        
        const dateObj = new Date(l.timestamp);
        const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('tr-TR') : '-';
        const timeStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString('tr-TR') : l.timestamp;

        const statusBadge = l.status === 'Başarılı' 
            ? '<span class="text-status-success text-xs">Başarılı</span>'
            : '<span class="text-status-error text-xs">Hatalı</span>';

        tr.innerHTML = `
            <td class="p-3 text-slate-450">
                <div class="font-bold text-slate-200 text-xs">${dateStr}</div>
                <div class="text-[10px]">${timeStr}</div>
            </td>
            <td class="p-3 font-bold text-slate-200">${l.customer || '-'}</td>
            <td class="p-3 text-slate-300">${l.recipe || '-'}</td>
            <td class="p-3 text-slate-300">${l.operator}</td>
            <td class="p-3 font-mono text-xs text-orange-400">${l.item}</td>
            <td class="p-3 font-mono">${l.target} gr</td>
            <td class="p-3 font-mono">${l.actual} gr</td>
            <td class="p-3 text-center">${statusBadge}</td>
        `;
        dom.reportsTableBody.appendChild(tr);
    });

    if (filteredLogs.length === 0) {
        dom.reportsTableBody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500 italic">Kriterlere uygun tartım kaydı bulunamadı.</td></tr>';
    }
}


// --- OPERATOR PANEL RENDERING ---
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
        state.db.orders.forEach(o => {
            o.batches.forEach(b => {
                const opActiveStatuses = ['beklemede', 'Bekliyor', 'tartımda', 'Üretiliyor', 'mikserde', 'paketlemede'];
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
            
            const isStarted = ['tartımda', 'Üretiliyor', 'mikserde', 'paketlemede'].includes(b.status);
            const btnText = isStarted ? 'KATIL' : 'BAŞLA';
            const btnIcon = isStarted ? 'users' : 'play';
            const btnClass = isStarted ? 'btn-blue' : 'btn-orange';
            const opInfoText = isStarted && b.operator ? `<span class="text-xs text-blue-400 block mt-1 font-semibold uppercase tracking-wider">Aktif Usta: ${b.operator}</span>` : '';

            card.innerHTML = `
                <div>
                    <div class="text-orange-400 font-extrabold text-xl">${b.customer}</div>
                    <div class="text-slate-200 text-lg mt-0.5">${b.recipeName} - ${b.targetAmount.toFixed(2)} kg</div>
                    <div class="text-xs text-slate-500 mt-1 font-mono">Parti No: ${b.no} / ${b.totalBatches} ${opInfoText}</div>
                </div>
                <button class="btn ${btnClass} py-3.5 px-6 font-bold flex items-center gap-2 text-lg rounded-xl btn-action-job">
                    <i data-lucide="${btnIcon}" class="w-5 h-5"></i> ${btnText}
                </button>
            `;

            card.querySelector('.btn-action-job').addEventListener('click', async () => {
                if (isStarted) {
                    await joinJob(b.orderId, b.batchId);
                } else {
                    await startJob(b.orderId, b.batchId);
                }
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
    }

    dom.weighingCustomer.textContent = state.activeJob.order.customer;
    dom.weighingRecipe.textContent = state.activeJob.order.recipeName;
    dom.weighingBatchBadge.textContent = `Parti ${state.activeJob.batch.no} (${state.activeJob.batch.targetAmount.toFixed(2)} kg)`;
    dom.weighingOperatorName.textContent = state.currentUser.name;

    const activeBatchLogs = state.db.logs.filter(l => l.batchId === state.activeJob.batch.id && l.status === 'Başarılı');
    const scaleFactor = state.activeJob.batch.targetAmount;

    dom.operatorChecklistContainer.innerHTML = '';
    
    state.activeJob.order.recipeItems.forEach(item => {
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
                <div class="flex items-center gap-2 text-green-400 font-bold text-sm">
                    <i data-lucide="check-circle" class="w-5 h-5"></i>
                    <span>Onaylandı (${logEntry.operator})</span>
                </div>
            `;
            row.innerHTML = leftContent + rightContent;
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

// --- BINDING EVENTS ---
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
        btnToggleSidebar.addEventListener('click', () => {
            adminSidebar.classList.add('sidebar-active');
            backdrop.classList.add('active');
        });
    }
    
    backdrop.addEventListener('click', () => {
        adminSidebar.classList.remove('sidebar-active');
        backdrop.classList.remove('active');
    });
    
    // Close sidebar on any button click
    const sidebarButtons = document.querySelectorAll('#view-admin aside button, #view-admin aside a, #view-admin aside .nav-item');
    sidebarButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            adminSidebar.classList.remove('sidebar-active');
            backdrop.classList.remove('active');
        });
    });

    // Role selection clicks
    dom.btnSelectAdmin.addEventListener('click', () => {
        state.loginStep = 'admin_login';
        updateUI();
    });
    
    dom.btnSelectOperator.addEventListener('click', () => {
        state.loginStep = 'operator_login';
        updateUI();
    });

    // Back buttons in login
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => {
            state.loginStep = 'role_select';
            updateUI();
        });
    });

    // Admin Login Submit
    if (dom.formAdminLogin) {
        dom.formAdminLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = dom.adminSelectUsername.value;
            const password = dom.formAdminLogin.password.value;
            const rememberMe = dom.adminRememberMe.checked;
            await handleLogin(username, password, 'admin', rememberMe);
        });
    }

    // Operator Login Submit
    if (dom.formOperatorLogin) {
        dom.formOperatorLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = dom.formOperatorLogin.username.value.trim();
            const password = dom.formOperatorLogin.password.value.trim();
            const rememberMe = dom.opRememberMe.checked;
            await handleLogin(username, password, 'operator', rememberMe);
        });
    }

    // Logout Click
    dom.btnAdminLogout.addEventListener('click', handleLogout);
    
    document.querySelectorAll('.btn-operator-logout').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });

    // Admin Sidebar Tab switching
    if (dom.tabDashboard) dom.tabDashboard.addEventListener('click', () => { state.adminTab = 'dashboard'; renderAdminPanel(); });
    dom.tabOrders.addEventListener('click', () => { state.adminTab = 'orders'; renderAdminPanel(); });
    dom.tabRecipes.addEventListener('click', () => { state.adminTab = 'recipes'; state.activeFirmId = null; state.activeRecipeId = null; renderAdminPanel(); });
    dom.tabUsers.addEventListener('click', () => { state.adminTab = 'users'; renderAdminPanel(); });
    dom.tabScales.addEventListener('click', () => { state.adminTab = 'scales'; renderAdminPanel(); });
    dom.tabReports.addEventListener('click', () => { state.adminTab = 'reports'; renderAdminPanel(); });
    if (dom.tabTraceability) dom.tabTraceability.addEventListener('click', () => { state.adminTab = 'traceability'; renderAdminPanel(); });

    // Order Creation Form dropdown logic
    dom.orderFirmSelect.addEventListener('change', (e) => {
        state.orderSelectedFirmId = parseInt(e.target.value) || null;
        renderOrdersTab();
    });

    dom.formCreateOrder.addEventListener('submit', async (e) => {
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
    dom.breadcrumbFirms.addEventListener('click', () => {
        state.activeFirmId = null;
        state.activeRecipeId = null;
        renderRecipesTab();
    });
    
    document.querySelectorAll('.btn-back-to-firms').forEach(btn => {
        btn.addEventListener('click', () => {
            state.activeFirmId = null;
            state.activeRecipeId = null;
            renderRecipesTab();
        });
    });

    dom.breadcrumbFirmName.addEventListener('click', () => {
        state.activeRecipeId = null;
        renderRecipesTab();
    });

    document.querySelectorAll('.btn-back-to-recipes').forEach(btn => {
        btn.addEventListener('click', () => {
            state.activeRecipeId = null;
            renderRecipesTab();
        });
    });

    // Add Customer Firm
    dom.formAddFirm.addEventListener('submit', async (e) => {
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
    dom.formAddRecipe.addEventListener('submit', async (e) => {
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
    dom.formAddIngredient.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(dom.formAddIngredient);
        const data = {
            name: fd.get('name').trim(),
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
    dom.formAddUser.addEventListener('submit', async (e) => {
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
    dom.formAddScale.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(dom.formAddScale);
        const name = fd.get('name').trim();
        const ip = fd.get('ip').trim();
        const port = fd.get('port');
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
            
            const res = await apiPost('/api/scales', { name, ip, port, is_simulator });
            if (res.success) {
                alert(`"${name}" terazisi başarıyla sisteme eklendi.`);
                dom.formAddScale.reset();
                await fetchDb();
                renderScalesTab();
            }
        } catch (e) {}
    });

    // Reports Filters event hooks
    dom.filterStartDate.addEventListener('change', (e) => { state.filters.startDate = e.target.value; renderReportsTab(); });
    dom.filterEndDate.addEventListener('change', (e) => { state.filters.endDate = e.target.value; renderReportsTab(); });
    dom.filterFirm.addEventListener('change', (e) => { state.filters.firm = e.target.value; renderReportsTab(); });
    dom.filterRecipe.addEventListener('change', (e) => { state.filters.recipe = e.target.value; renderReportsTab(); });
    dom.filterOperator.addEventListener('change', (e) => { state.filters.operator = e.target.value; renderReportsTab(); });

    dom.btnClearFilters.addEventListener('click', () => {
        dom.filterStartDate.value = '';
        dom.filterEndDate.value = '';
        dom.filterFirm.value = '';
        dom.filterRecipe.value = '';
        dom.filterOperator.value = '';
        state.filters = { startDate: '', endDate: '', firm: '', recipe: '', operator: '' };
        renderReportsTab();
    });

    // Traceability Filters event hooks
    const traceFilterBatchId = document.getElementById('trace-filter-batch-id');
    const traceFilterFirm = document.getElementById('trace-filter-firm');
    const traceFilterRecipe = document.getElementById('trace-filter-recipe');
    const traceFilterOperator = document.getElementById('trace-filter-operator');

    if (traceFilterBatchId) {
        traceFilterBatchId.addEventListener('input', () => renderTraceabilityTab());
        traceFilterFirm.addEventListener('input', () => renderTraceabilityTab());
        traceFilterRecipe.addEventListener('input', () => renderTraceabilityTab());
        traceFilterOperator.addEventListener('input', () => renderTraceabilityTab());
    }

    // Trace Modal event hooks
    const btnCloseTraceModal = document.getElementById('btn-close-trace-modal');
    const traceModalOverlay = document.getElementById('trace-modal-overlay');
    if (btnCloseTraceModal && traceModalOverlay) {
        btnCloseTraceModal.addEventListener('click', () => {
            traceModalOverlay.classList.add('hidden');
        });
        traceModalOverlay.addEventListener('click', (e) => {
            if (e.target === traceModalOverlay) {
                traceModalOverlay.classList.add('hidden');
            }
        });
    }

    // Backup Restore Upload Trigger
    dom.btnImportTrigger.addEventListener('click', () => {
        dom.importFileInput.click();
    });

    dom.importFileInput.addEventListener('change', async (e) => {
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

    // Operator back actions
    dom.btnBackToStations.addEventListener('click', () => {
        state.selectedScale = null;
        renderOperatorPanel();
    });

    dom.btnAbortJob.addEventListener('click', async () => {
        if (confirm('İşlem yarıda kesilecek. Çıkmak istediğinize emin misiniz?')) {
            stopChecklistPolling();
            try {
                await disconnectScale();
            } catch (e) {}
            state.activeJob = null;
            renderOperatorPanel();
        }
    });

    dom.btnShowPackaging.addEventListener('click', async () => {
        try {
            await apiPut(`/api/batches/${state.activeJob.batch.id}/status`, { status: 'paketlemede' });
            await fetchDb();
        } catch (e) {}
        showPackagingScreen();
    });

    dom.btnPackagingFinish.addEventListener('click', async () => {
        dom.packagingOverlay.classList.add('hidden');
        await finishJob();
    });

    // Smart scale listeners
    dom.btnConnectWeighter.addEventListener('click', () => {
        if (state.connectedScale) {
            disconnectScale();
        } else {
            openScaleModal();
        }
    });

    dom.btnCloseScaleModal.addEventListener('click', () => {
        dom.scaleModalOverlay.classList.add('hidden');
    });

    dom.scaleModalOverlay.addEventListener('click', (e) => {
        if (e.target === dom.scaleModalOverlay) {
            dom.scaleModalOverlay.classList.add('hidden');
        }
    });

    dom.simulatorSlider.addEventListener('input', async () => {
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

    dom.btnWeighingConfirm.addEventListener('click', async () => {
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
window.addEventListener('message', handleReactNativeMessage);
document.addEventListener('message', handleReactNativeMessage);

// --- BATCH TRACEABILITY & PRINTING FUNCTIONS ---

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

