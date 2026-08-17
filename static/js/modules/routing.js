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
    const showCustomers = isAdmin || !!user.canManageCustomers;
    const showRecipes = isAdmin || !!user.canManageRecipes;
    const showUsers = isAdmin || !!user.canManageUsers;
    const showScales = isAdmin || !!user.canManageScales;
    const showReports = isAdmin || !!user.canViewReports;

    const showSettings = isAdmin;

    toggleEl(dom.tabDashboard, showDashboard);
    toggleEl(dom.tabOrders, showOrders);
    toggleEl(dom.tabCustomers || document.getElementById('tab-customers'), showCustomers);
    toggleEl(dom.tabRecipes, showRecipes);
    toggleEl(dom.tabUsers, showUsers);
    toggleEl(dom.tabScales, showScales);
    toggleEl(dom.tabReports, showReports);
    toggleEl(dom.tabTraceability, showReports || showOrders);
    toggleEl(dom.tabAccounting || document.getElementById('tab-accounting'), showReports || showOrders || isAdmin);
    toggleEl(dom.tabSettings, showSettings);
    toggleEl(dom.tabAuditLogs || document.getElementById('tab-audit-logs'), showSettings);

    // Hide/show Backup options based on admin role
    const backupContainer = document.getElementById('btn-export-backup')?.parentElement;
    toggleEl(backupContainer, isAdmin);

    const allowedTabs = [];
    if (showDashboard) allowedTabs.push('dashboard');
    if (showOrders) allowedTabs.push('orders');
    if (showCustomers) allowedTabs.push('customers');
    if (showRecipes) allowedTabs.push('recipes');
    if (showUsers) allowedTabs.push('users');
    if (showScales) allowedTabs.push('scales');
    if (showReports) allowedTabs.push('reports');
    if (showReports || showOrders) allowedTabs.push('traceability');
    if (showReports || showOrders || isAdmin) allowedTabs.push('accounting');
    if (showSettings) {
        allowedTabs.push('settings');
        allowedTabs.push('audit-logs');
    }

    if (allowedTabs.length > 0 && !allowedTabs.includes(state.adminTab)) {
        state.adminTab = allowedTabs[0];
    }
}

