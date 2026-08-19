
// --- LUCIDE OFFLINE SAFETY FALLBACK ---
if (typeof lucide === 'undefined') {
    window.lucide = {
        createIcons: function() {
            console.warn("Lucide icons library not loaded. Falling back safely.");
        }
    };
}

// --- UTILS ---
window.getTodayDateStr = function() {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};


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
var state = {
    view: 'login',           // login | admin | operator
    loginStep: 'role_select', // role_select | admin_login | operator_login
    currentUser: null,       // Authenticated user object
    db: {
        users: [],
        scales: [],
        firms: [],
        recipes: [],
        orders: [],
        logs: [],
        settings: []
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
var dom = {
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
    tabDeliveries: document.getElementById('tab-deliveries'),
    tabCustomers: document.getElementById('tab-customers'),
    tabRecipes: document.getElementById('tab-recipes'),
    tabUsers: document.getElementById('tab-users'),
    tabScales: document.getElementById('tab-scales'),
    tabReports: document.getElementById('tab-reports'),
    tabTraceability: document.getElementById('tab-traceability'),
    tabAccounting: document.getElementById('tab-accounting'),
    tabCurrentAccounts: document.getElementById('tab-current-accounts'),
    tabInventory: document.getElementById('tab-inventory'),
    tabSettings: document.getElementById('tab-settings'),
    tabAuditLogs: document.getElementById('tab-audit-logs'),
    tabTrash: document.getElementById('tab-trash'),
    adminSessionUsername: document.getElementById('admin-session-username'),
    btnAdminLogout: document.getElementById('btn-admin-logout'),
    
    // Admin Panels
    panelDashboard: document.getElementById('panel-dashboard'),
    panelOrders: document.getElementById('panel-orders'),
    panelDeliveries: document.getElementById('panel-deliveries'),
    panelCustomers: document.getElementById('panel-customers'),
    panelRecipes: document.getElementById('panel-recipes'),
    panelUsers: document.getElementById('panel-users'),
    panelScales: document.getElementById('panel-scales'),
    panelReports: document.getElementById('panel-reports'),
    panelTraceability: document.getElementById('panel-traceability'),
    panelAccounting: document.getElementById('panel-accounting'),
    panelCurrentAccounts: document.getElementById('panel-current-accounts'),
    panelInventory: document.getElementById('panel-inventory'),
    panelSettings: document.getElementById('panel-settings'),

    panelAuditLogs: document.getElementById('panel-audit-logs'),
    panelTrash: document.getElementById('panel-trash'),
    
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
    
    // Settings Panel Elements
    formAddSettingsIngredient: document.getElementById('form-add-settings-ingredient'),
    settingsIngredientsList: document.getElementById('settings-ingredients-list'),
    
    // Operator Section Elements
    operatorStationSelect: document.getElementById('operator-station-select'),
    opScalesGrid: document.getElementById('op-scales-grid'),
    operatorJobsQueue: document.getElementById('operator-jobs-queue'),
    opLoggedUsername: document.getElementById('op-logged-username'),
    pendingJobsGrid: document.getElementById('pending-jobs-grid'),
    btnBackToStations: document.getElementById('btn-back-to-stations'),
    btnToggleFinishedJobs: document.getElementById('btn-toggle-finished-jobs'),
    txtToggleFinished: document.getElementById('txt-toggle-finished'),
    
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
    packagingPanel: document.getElementById('packaging-panel'),

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

// --- DB UPDATE TOAST ---
// Reçete düzenleme ekranındayken db_updated WebSocket mesajı gelince
// sayfayı sıfırlamak yerine küçük bir bildirim gösterir
function showDbUpdateToast() {
    const toastId = 'db-update-toast';
    // Var olan tostu kaldır
    document.getElementById(toastId)?.remove();

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-950/90 text-amber-200 shadow-xl backdrop-blur-sm text-sm font-semibold transition-all';
    toast.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Siparişte değişiklik yapıldı</span>
    `;
    document.body.appendChild(toast);
    // 4 saniye sonra kaldır
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
