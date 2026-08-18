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
        const res = await fetch('/api/system/db');
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

                // Eğer kullanıcı reçete düzenleme/ekleme ekranındaysa (activeRecipeId set),
                // tam updateUI yerine sadece toast göster (sayfayı sıfırlama)
                if (state.view === 'admin' && state.adminTab === 'recipes' && state.activeRecipeId) {
                    showDbUpdateToast();
                } else {
                    updateUI();
                }
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


async function apiGet(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Veri çekme işlemi başarısız.');
        }
        return await res.json();
    } catch (e) {
        alert(e.message);
        throw e;
    }
}
