// js/ui.js

function showToast(message, tone = 'info', options = {}) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;

    const toneClass = tone === 'success'
        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
        : tone === 'warning'
            ? 'bg-amber-50 border-amber-300 text-amber-800'
            : tone === 'danger'
                ? 'bg-red-50 border-red-300 text-red-800'
                : 'bg-slate-50 border-slate-300 text-slate-800';

    const toneIcon = tone === 'success'
        ? '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
        : tone === 'warning'
            ? '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>'
            : tone === 'danger'
                ? '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
                : '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01"></path></svg>';

    const toast = document.createElement('div');
    toast.className = `toast-item pointer-events-auto px-4 py-2 rounded-xl border shadow-lg text-xs font-semibold ${toneClass}`;

    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.innerHTML = `${toneIcon}<span class="leading-tight">${String(message || '')}</span>`;
    toast.appendChild(row);

    if (options.actionLabel && typeof options.onAction === 'function') {
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'toast-action-btn mt-1';
        actionBtn.textContent = options.actionLabel;
        actionBtn.onclick = () => {
            options.onAction();
            toast.remove();
        };
        toast.appendChild(actionBtn);
    }

    stack.appendChild(toast);

    while (stack.children.length > 3) {
        stack.removeChild(stack.firstChild);
    }

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

const auditUiState = {
    storageKey: 'dp_audit_history_v1',
    events: [],
    maxEvents: 300,
    onboardingCollapsed: false,
    mergedEvents: [],
    slovakiaRegionSummaryCollapsed: false,
    slovakiaRegionExpandedKeys: {}
};

function loadAuditHistoryFromStorage() {
    try {
        const raw = localStorage.getItem(auditUiState.storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        auditUiState.events = parsed.slice(0, auditUiState.maxEvents);
    } catch (err) {
        auditUiState.events = [];
    }
}

function saveAuditHistoryToStorage() {
    try {
        localStorage.setItem(auditUiState.storageKey, JSON.stringify(auditUiState.events.slice(0, auditUiState.maxEvents)));
    } catch (err) {
        // ignore storage errors
    }
}

function formatAuditTimestamp(ms) {
    const stamp = Number(ms || 0);
    if (!stamp) return '-';
    const d = new Date(stamp);
    return d.toLocaleString('sk-SK');
}

function buildAuditUserLabel(eventItem) {
    if (eventItem.userEmail) return eventItem.userEmail;
    if (eventItem.userUid) return eventItem.userUid;
    return 'lokálne';
}

function normalizeAuditEvent(eventItem) {
    if (!eventItem || typeof eventItem !== 'object') return null;
    return {
        id: String(eventItem.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        action: String(eventItem.action || 'unknown'),
        detail: String(eventItem.detail || ''),
        regionKey: eventItem.regionKey ? String(eventItem.regionKey) : null,
        districtName: eventItem.districtName ? String(eventItem.districtName) : null,
        workplaceId: eventItem.workplaceId ? String(eventItem.workplaceId) : null,
        userUid: eventItem.userUid ? String(eventItem.userUid) : null,
        userEmail: eventItem.userEmail ? String(eventItem.userEmail) : null,
        userRole: eventItem.userRole ? String(eventItem.userRole) : null,
        createdAtMs: Number(eventItem.createdAtMs || Date.now())
    };
}

function addAuditEvent(action, payload = {}) {
    const access = getAccessContextSafe();
    const eventItem = normalizeAuditEvent({
        action,
        detail: payload.detail || '',
        regionKey: payload.regionKey || currentRegionKey || null,
        districtName: payload.districtName || null,
        workplaceId: payload.workplaceId || null,
        userUid: access.uid || null,
        userEmail: access.email || null,
        userRole: access.role || 'viewer',
        createdAtMs: Date.now()
    });
    if (!eventItem) return;

    auditUiState.events.unshift(eventItem);
    if (auditUiState.events.length > auditUiState.maxEvents) {
        auditUiState.events = auditUiState.events.slice(0, auditUiState.maxEvents);
    }
    saveAuditHistoryToStorage();

    if (typeof appendAuditEvent === 'function') {
        appendAuditEvent(eventItem);
    }
}

function renderAuditRows(events) {
    const body = document.getElementById('audit-table-body');
    if (!body) return;

    if (!events.length) {
        body.innerHTML = `
            <tr>
                <td colspan="5" class="px-3 py-6 text-center text-slate-500">Zatiaľ nie sú dostupné žiadne audit záznamy.</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = events.map((eventItem) => {
        const regionLabel = eventItem.regionKey
            ? (regionMeta[eventItem.regionKey]?.seat || regionMeta[eventItem.regionKey]?.name || eventItem.regionKey)
            : '-';

        return `
            <tr>
                <td class="px-3 py-2 text-slate-600 whitespace-nowrap">${formatAuditTimestamp(eventItem.createdAtMs)}</td>
                <td class="px-3 py-2 text-slate-700">${buildAuditUserLabel(eventItem)}</td>
                <td class="px-3 py-2 font-bold text-slate-800 uppercase">${eventItem.action}</td>
                <td class="px-3 py-2 text-slate-700">${eventItem.detail || '-'}</td>
                <td class="px-3 py-2 text-slate-700">${regionLabel}</td>
            </tr>
        `;
    }).join('');
}

function updateAuditFilterOptions(events) {
    const regionSelect = document.getElementById('audit-filter-region');
    const userSelect = document.getElementById('audit-filter-user');
    if (!regionSelect || !userSelect) return;

    const prevRegion = regionSelect.value || 'all';
    const prevUser = userSelect.value || 'all';

    const regionValues = new Set();
    const userValues = new Set();
    events.forEach((item) => {
        if (item.regionKey) regionValues.add(item.regionKey);
        const userLabel = buildAuditUserLabel(item);
        if (userLabel) userValues.add(userLabel);
    });

    const regionOptions = ['<option value="all">Všetky kraje</option>'];
    Array.from(regionValues)
        .sort((a, b) => (regionMeta[a]?.seat || a).localeCompare(regionMeta[b]?.seat || b, 'sk'))
        .forEach((regionKey) => {
            const label = regionMeta[regionKey]?.seat || regionMeta[regionKey]?.name || regionKey;
            regionOptions.push(`<option value="${regionKey}">${label}</option>`);
        });
    regionSelect.innerHTML = regionOptions.join('');

    const userOptions = ['<option value="all">Všetci používatelia</option>'];
    Array.from(userValues)
        .sort((a, b) => a.localeCompare(b, 'sk'))
        .forEach((userLabel) => {
            userOptions.push(`<option value="${userLabel}">${userLabel}</option>`);
        });
    userSelect.innerHTML = userOptions.join('');

    regionSelect.value = Array.from(regionValues).includes(prevRegion) ? prevRegion : 'all';
    userSelect.value = Array.from(userValues).includes(prevUser) ? prevUser : 'all';
}

function getAuditFilteredEvents(events) {
    const todayOnly = Boolean(document.getElementById('audit-filter-today')?.checked);
    const regionFilter = document.getElementById('audit-filter-region')?.value || 'all';
    const userFilter = document.getElementById('audit-filter-user')?.value || 'all';

    let out = [...events];

    if (todayOnly) {
        const now = new Date();
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        out = out.filter((item) => Number(item.createdAtMs || 0) >= dayStart);
    }

    if (regionFilter !== 'all') {
        out = out.filter((item) => item.regionKey === regionFilter);
    }

    if (userFilter !== 'all') {
        out = out.filter((item) => buildAuditUserLabel(item) === userFilter);
    }

    return out;
}

function applyAuditFiltersAndRender() {
    const base = auditUiState.mergedEvents || [];
    const filtered = getAuditFilteredEvents(base).slice(0, 200);
    renderAuditRows(filtered);

    const status = document.getElementById('audit-status');
    if (status) {
        status.textContent = `Zobrazené záznamy: ${filtered.length} / ${base.length}.`;
    }
}

function resetAuditFilters() {
    const today = document.getElementById('audit-filter-today');
    const region = document.getElementById('audit-filter-region');
    const user = document.getElementById('audit-filter-user');
    if (today) today.checked = false;
    if (region) region.value = 'all';
    if (user) user.value = 'all';
    applyAuditFiltersAndRender();
}

async function refreshAuditModal() {
    const status = document.getElementById('audit-status');
    if (status) status.textContent = 'Načítavam históriu...';

    let events = [...auditUiState.events];
    if (typeof listAuditEvents === 'function') {
        const cloudEvents = await listAuditEvents(150);
        if (cloudEvents && cloudEvents.length) {
            const byId = new Map();
            [...cloudEvents, ...events].forEach((item) => {
                const normalized = normalizeAuditEvent(item);
                if (normalized && !byId.has(normalized.id)) {
                    byId.set(normalized.id, normalized);
                }
            });
            events = Array.from(byId.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
        }
    }

    auditUiState.mergedEvents = events;
    updateAuditFilterOptions(events);
    applyAuditFiltersAndRender();
}

function pruneAuditLogsNow() {
    const access = getAccessContextSafe();
    if (!access.isAuthenticated || access.role !== 'admin') {
        showToast('Mazanie auditu je dostupné iba pre admina.', 'warning');
        return;
    }

    openConfirmModal(
        'Vymazať staré logy?',
        'Odstránia sa audit záznamy staršie ako 7 dní.',
        async (confirmed) => {
            if (!confirmed) return;

            const status = document.getElementById('audit-status');
            if (status) status.textContent = 'Prebieha mazanie starých logov...';

            let deletedCount = 0;
            if (typeof pruneAuditEventsOlderThanRetention === 'function') {
                deletedCount = Number(await pruneAuditEventsOlderThanRetention(true)) || 0;
            }

            await refreshAuditModal();
            showToast(
                deletedCount > 0
                    ? `Vymazané staré logy: ${deletedCount}.`
                    : 'Nenašli sa žiadne logy staršie ako 7 dní.',
                'success'
            );
        },
        'Vymazať staré',
        'Zrušiť'
    );
}

function openAuditModal() {
    const access = getAccessContextSafe();
    if (!access.isAuthenticated || access.role !== 'admin') {
        showToast('Audit je dostupný iba pre admina.', 'warning');
        return;
    }

    const modal = document.getElementById('audit-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    refreshAuditModal();
}

function closeAuditModal(event) {
    if (event && event.target && event.target.id !== 'audit-modal') return;
    const modal = document.getElementById('audit-modal');
    if (!modal) return;
    modal.style.display = 'none';
}

window.applyAuditFiltersAndRender = applyAuditFiltersAndRender;
window.resetAuditFilters = resetAuditFilters;
window.pruneAuditLogsNow = pruneAuditLogsNow;
window.toggleSlovakiaRegionSummaryPanel = toggleSlovakiaRegionSummaryPanel;
window.toggleSlovakiaRegionDetail = toggleSlovakiaRegionDetail;

function toggleOnboardingPanel() {
    auditUiState.onboardingCollapsed = !auditUiState.onboardingCollapsed;
    const content = document.getElementById('onboarding-content');
    const btn = document.getElementById('onboarding-toggle-btn');
    if (content) content.style.display = auditUiState.onboardingCollapsed ? 'none' : '';
    if (btn) btn.textContent = auditUiState.onboardingCollapsed ? 'Ukázať' : 'Skryť';
}

function updateOnboardingPanel() {
    const card = document.getElementById('onboarding-card');
    const tip = document.getElementById('onboarding-next-tip');
    const list = document.getElementById('onboarding-step-list');
    if (!card || !tip || !list) return;

    const hasRegion = currentRegionKey !== 'slovakia';
    const regionWorkplaces = Object.values(customWorkplaces || {}).filter((wp) => wp.regionKey === currentRegionKey);
    const hasDp = hasRegion && regionWorkplaces.length > 0;
    const hasBrush = Boolean(activeWorkplaceId);

    let assignedCount = 0;
    if (hasRegion && districtData[currentRegionKey]) {
        Object.values(districtData[currentRegionKey]).forEach((item) => {
            if (item?.wpId) assignedCount += 1;
        });
    }
    const hasAssignments = assignedCount > 0;

    const steps = [
        { done: hasRegion, label: 'Vyberte konkrétny kraj (nie Slovensko).' },
        { done: hasDp, label: 'Vytvorte aspoň jedno DP.' },
        { done: hasBrush, label: 'Aktivujte DP ako štetec.' },
        { done: hasAssignments, label: 'Priraďte okresy do DP klikom na mapu.' }
    ];

    let nextTip = 'Vyberte konkrétny kraj a začnite modelovať.';
    if (hasRegion && !hasDp) nextTip = 'Pridajte prvé DP cez tlačidlo + PRIDAŤ DP.';
    if (hasDp && !hasBrush) nextTip = 'Kliknite na DP vľavo, tým aktivujete štetec.';
    if (hasBrush && !hasAssignments) nextTip = 'Kliknite do okresov na mape, aby ste ich priradili.';
    if (hasAssignments) nextTip = 'Skontrolujte kapacity vpravo a prípadne exportujte PNG.';

    tip.textContent = nextTip;
    list.innerHTML = steps.map((step) => `
        <div class="flex items-center gap-2 text-[11px] ${step.done ? 'text-emerald-700' : 'text-slate-700'}">
            <span class="w-4 h-4 rounded-full flex items-center justify-center font-black ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">${step.done ? '✓' : '•'}</span>
            <span>${step.label}</span>
        </div>
    `).join('');
}

function toggleAuthForm() {
    const formContainer = document.getElementById('auth-form-container');
    const toggleBtn = document.getElementById('auth-toggle-form-btn');
    if (!formContainer || !toggleBtn) return;
    
    const isHidden = formContainer.classList.contains('hidden');
    if (isHidden) {
        formContainer.classList.remove('hidden');
        toggleBtn.classList.add('hidden');
        document.getElementById('auth-email-input')?.focus();
    } else {
        formContainer.classList.add('hidden');
        toggleBtn.classList.remove('hidden');
    }
}

async function handleEmailSignIn() {
    const emailInput = document.getElementById('auth-email-input');
    const passwordInput = document.getElementById('auth-password-input');
    if (!emailInput || !passwordInput) return;
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        showToast('Email a heslo sú povinné.', 'warning');
        return;
    }
    
    const success = await requestFirebaseSignIn(email, password);
    if (success) {
        emailInput.value = '';
        passwordInput.value = '';
        document.getElementById('auth-form-container').classList.add('hidden');
        document.getElementById('auth-toggle-form-btn')?.classList.remove('hidden');
        showToast('Prihlásenie úspešné.', 'success');
        addAuditEvent('sign-in', { detail: 'Používateľ sa prihlásil.' });
    }
}

function openPasswordModal() {
    const access = getAccessContextSafe();
    if (!access.isAuthenticated) {
        showToast('Najprv sa prihláste.', 'warning');
        return;
    }

    const modal = document.getElementById('password-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    const current = document.getElementById('password-current-input');
    const next = document.getElementById('password-new-input');
    const confirm = document.getElementById('password-new-confirm-input');
    if (current) current.value = '';
    if (next) next.value = '';
    if (confirm) confirm.value = '';
    current?.focus();
}

function closePasswordModal(event) {
    if (event && event.target && event.target.id !== 'password-modal') return;
    const modal = document.getElementById('password-modal');
    if (!modal) return;
    modal.style.display = 'none';
}

async function submitPasswordChange() {
    const currentInput = document.getElementById('password-current-input');
    const nextInput = document.getElementById('password-new-input');
    const confirmInput = document.getElementById('password-new-confirm-input');
    if (!currentInput || !nextInput || !confirmInput) return;

    const currentPassword = currentInput.value || '';
    const newPassword = nextInput.value || '';
    const confirmPassword = confirmInput.value || '';

    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Vyplňte všetky polia.', 'warning');
        return;
    }

    if (newPassword.length < 8) {
        showToast('Nové heslo musí mať aspoň 8 znakov.', 'warning');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('Nové heslá sa nezhodujú.', 'warning');
        return;
    }

    if (currentPassword === newPassword) {
        showToast('Nové heslo musí byť odlišné od aktuálneho.', 'warning');
        return;
    }

    if (typeof requestFirebasePasswordChange !== 'function') {
        showToast('Zmena hesla nie je dostupná.', 'warning');
        return;
    }

    const result = await requestFirebasePasswordChange(currentPassword, newPassword);
    if (!result?.ok) {
        if (result?.code === 'auth/wrong-password' || result?.code === 'auth/invalid-credential') {
            showToast('Aktuálne heslo nie je správne.', 'warning');
        } else if (result?.code === 'auth/weak-password') {
            showToast('Nové heslo je príliš slabé.', 'warning');
        } else if (result?.code === 'auth/too-many-requests') {
            showToast('Priveľa pokusov. Skúste to neskôr.', 'warning');
        } else {
            showToast('Zmena hesla zlyhala.', 'warning');
        }
        return;
    }

    closePasswordModal();
    showToast('Heslo bolo úspešne zmenené.', 'success');
}

// Allow Enter key to submit the form
document.addEventListener('DOMContentLoaded', () => {
    loadAuditHistoryFromStorage();
    updateOnboardingPanel();

    const passwordInput = document.getElementById('auth-password-input');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleEmailSignIn();
            }
        });
    }

    const confirmNewPasswordInput = document.getElementById('password-new-confirm-input');
    if (confirmNewPasswordInput) {
        confirmNewPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitPasswordChange();
            }
        });
    }
});

function updateUndoButtonState() {
    const undoBtn = document.getElementById('undo-action-btn');
    const undoReason = document.getElementById('undo-disabled-reason');
    if (!undoBtn) return;
    undoBtn.disabled = actionHistory.length === 0 || !canEditCurrentRegion();
    undoBtn.title = undoBtn.disabled ? 'Vrátenie je momentálne nedostupné' : 'Vrátiť poslednú zmenu';

    if (undoReason) {
        if (!canEditCurrentRegion()) {
            undoReason.textContent = 'Vrátenie zmien je dostupné len pri editovateľnom kraji.';
        } else if (actionHistory.length === 0) {
            undoReason.textContent = 'Nie je dostupná žiadna akcia na vrátenie.';
        } else {
            undoReason.textContent = '';
        }
    }
}

function getAccessContextSafe() {
    if (typeof getCurrentAccessContext !== 'function') {
        return {
            role: 'admin',
            regionKey: null,
            isAuthenticated: false,
            canEditAny: true
        };
    }
    return getCurrentAccessContext();
}

function canEditCurrentRegion() {
    if (currentRegionKey === 'slovakia') return false;
    if (typeof canCurrentUserEditRegion !== 'function') return true;
    return canCurrentUserEditRegion(currentRegionKey);
}

let adminUsersCache = [];

function getRegionOptionsHtml(selectedRegionKey) {
    const keys = Object.keys(regionMeta || {});
    const selected = selectedRegionKey || '';
    const options = ['<option value="">-</option>'];
    keys.forEach((key) => {
        const seat = regionMeta[key]?.seat || key;
        options.push(`<option value="${key}" ${selected === key ? 'selected' : ''}>${seat}</option>`);
    });
    return options.join('');
}

function renderUserAdminRows(users) {
    const body = document.getElementById('user-admin-table-body');
    if (!body) return;
    const access = getAccessContextSafe();

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="4" class="px-3 py-6 text-center text-slate-500">Nie sú dostupné žiadne používateľské záznamy.</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = users.map((user) => {
        const isRegionEditor = user.role === 'region_editor';
        const isCurrentUser = access.uid && user.uid === access.uid;
        return `
            <tr>
                <td class="px-3 py-2 font-semibold text-slate-700">${user.email || user.uid}</td>
                <td class="px-3 py-2">
                    <select id="user-role-${user.uid}" onchange="onUserRoleChanged('${user.uid}')" class="bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700 focus:outline-none ${isCurrentUser ? 'opacity-60 cursor-not-allowed' : ''}" ${isCurrentUser ? 'disabled' : ''}>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
                        <option value="region_editor" ${user.role === 'region_editor' ? 'selected' : ''}>region_editor</option>
                        <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>viewer</option>
                    </select>
                </td>
                <td class="px-3 py-2">
                    <select id="user-region-${user.uid}" class="bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700 focus:outline-none ${(isRegionEditor && !isCurrentUser) ? '' : 'opacity-60'}" ${(isRegionEditor && !isCurrentUser) ? '' : 'disabled'}>
                        ${getRegionOptionsHtml(user.regionKey)}
                    </select>
                </td>
                <td class="px-3 py-2 text-right">
                    <button onclick="saveUserAccessChange('${user.uid}')" class="${isCurrentUser ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'} text-[11px] font-bold px-3 py-1.5 rounded-lg" ${isCurrentUser ? 'disabled' : ''}>${isCurrentUser ? 'Vlastný účet' : 'Uložiť'}</button>
                </td>
            </tr>
        `;
    }).join('');
}

function onUserRoleChanged(uid) {
    const roleSelect = document.getElementById(`user-role-${uid}`);
    const regionSelect = document.getElementById(`user-region-${uid}`);
    if (!roleSelect || !regionSelect) return;

    const isRegionEditor = roleSelect.value === 'region_editor';
    regionSelect.disabled = !isRegionEditor;
    regionSelect.classList.toggle('opacity-60', !isRegionEditor);
    if (!isRegionEditor) {
        regionSelect.value = '';
    }
}

async function refreshUserAdminTable() {
    const status = document.getElementById('user-admin-status');
    if (status) status.textContent = 'Načítavam používateľov...';

    if (typeof listFirebaseUsers !== 'function') {
        if (status) status.textContent = 'Správa používateľov nie je dostupná.';
        return;
    }

    adminUsersCache = await listFirebaseUsers();
    renderUserAdminRows(adminUsersCache);
    if (status) {
        status.textContent = adminUsersCache.length
            ? `Načítané: ${adminUsersCache.length} používateľov.`
            : 'Používateľské dáta sa nenačítali.';
    }
}

async function saveUserAccessChange(uid) {
    const access = getAccessContextSafe();
    if (access.uid && uid === access.uid) {
        showToast('Nemôžete meniť vlastnú rolu.', 'warning');
        return;
    }

    const roleSelect = document.getElementById(`user-role-${uid}`);
    const regionSelect = document.getElementById(`user-region-${uid}`);
    if (!roleSelect || !regionSelect) return;

    const role = roleSelect.value;
    const regionKey = role === 'region_editor' ? (regionSelect.value || null) : null;

    if (role === 'region_editor' && !regionKey) {
        showToast('Pre region_editor musíte zvoliť región.', 'warning');
        return;
    }

    if (typeof updateFirebaseUserAccess !== 'function') {
        showToast('Ukladanie používateľov nie je dostupné.', 'warning');
        return;
    }

    const ok = await updateFirebaseUserAccess(uid, { role, regionKey });
    if (!ok) {
        showToast('Uloženie používateľa zlyhalo.', 'warning');
        return;
    }

    showToast('Používateľ bol aktualizovaný.', 'success');
    await refreshUserAdminTable();
    redrawUiAndStats();
}

async function openUserAdminModal() {
    const access = getAccessContextSafe();
    if (!access.isAuthenticated || access.role !== 'admin') {
        showToast('Správa používateľov je povolená iba pre admina.', 'warning');
        return;
    }

    const modal = document.getElementById('user-admin-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    await refreshUserAdminTable();
}

function closeUserAdminModal(event) {
    if (event && event.target && event.target.id !== 'user-admin-modal') return;
    const modal = document.getElementById('user-admin-modal');
    if (!modal) return;
    modal.style.display = 'none';
}

function renderAccessPanel() {
    const panel = document.getElementById('access-panel');
    const roleBadge = document.getElementById('access-role-badge');
    const regionBadge = document.getElementById('access-region-badge');
    const formContainer = document.getElementById('auth-form-container');
    const signInBtn = document.getElementById('auth-sign-in-btn');
    const toggleFormBtn = document.getElementById('auth-toggle-form-btn');
    const signOutBtn = document.getElementById('auth-sign-out-btn');
    const reloadBtn = document.getElementById('auth-reload-btn');
    const changePasswordBtn = document.getElementById('auth-change-password-btn');
    const openUserAdminBtn = document.getElementById('open-user-admin-btn');
    const openAuditBtn = document.getElementById('open-audit-btn');
    const addDpBtn = document.getElementById('add-dp-btn');
    const resetBtn = document.getElementById('reset-model-btn');
    const addDpReason = document.getElementById('add-dp-disabled-reason');
    const resetReason = document.getElementById('reset-disabled-reason');

    if (!panel || !roleBadge || !regionBadge) return;

    const access = getAccessContextSafe();
    panel.classList.remove('hidden');

    const roleLabel = access.role === 'admin'
        ? 'admin'
        : access.role === 'region_editor'
            ? 'region'
            : 'viewer';

    roleBadge.textContent = roleLabel;
    roleBadge.className = access.role === 'admin'
        ? 'text-[10px] font-bold uppercase bg-emerald-600 text-white px-2 py-0.5 rounded-full'
        : access.role === 'region_editor'
            ? 'text-[10px] font-bold uppercase bg-blue-600 text-white px-2 py-0.5 rounded-full'
            : 'text-[10px] font-bold uppercase bg-slate-700 text-slate-100 px-2 py-0.5 rounded-full';

    regionBadge.textContent = access.regionKey || 'all';
    
    // Keep auth controls consistent after redraws (e.g. region switch after failed sign-in).
    if (toggleFormBtn && signOutBtn) {
        const isAuthenticated = access.isAuthenticated;
        const isFormOpen = Boolean(formContainer && !formContainer.classList.contains('hidden'));
        toggleFormBtn.classList.toggle('hidden', isAuthenticated || isFormOpen);
        signOutBtn.classList.toggle('hidden', !isAuthenticated);
        if (reloadBtn) {
            reloadBtn.classList.toggle('hidden', !isAuthenticated);
        }
        if (changePasswordBtn) {
            changePasswordBtn.classList.toggle('hidden', !isAuthenticated);
        }
    }
    // Reset form to hidden if somehow still visible when authenticated
    if (formContainer && access.isAuthenticated && !formContainer.classList.contains('hidden')) {
        formContainer.classList.add('hidden');
    }

    if (openUserAdminBtn) {
        const showForAdmin = access.isAuthenticated && access.role === 'admin';
        openUserAdminBtn.classList.toggle('hidden', !showForAdmin);
    }

    if (openAuditBtn) {
        const showForAdmin = access.isAuthenticated && access.role === 'admin';
        openAuditBtn.classList.toggle('hidden', !showForAdmin);
    }

    const canEdit = canEditCurrentRegion();
    if (addDpBtn) {
        addDpBtn.disabled = !canEdit;
        addDpBtn.classList.toggle('opacity-50', !canEdit);
        addDpBtn.classList.toggle('cursor-not-allowed', !canEdit);
        addDpBtn.title = canEdit ? 'Vytvoriť nové detašované pracovisko' : 'Pridanie DP je nedostupné';
    }

    if (addDpReason) {
        if (canEdit) {
            addDpReason.textContent = '';
        } else if (currentRegionKey === 'slovakia') {
            addDpReason.textContent = 'Pridanie DP je dostupné až po výbere konkrétneho kraja.';
        } else {
            addDpReason.textContent = 'Nemáte oprávnenie upravovať tento kraj.';
        }
    }

    if (resetBtn) {
        const isAdmin = access.role === 'admin';
        resetBtn.disabled = !isAdmin;
        resetBtn.classList.toggle('opacity-50', !isAdmin);
        resetBtn.classList.toggle('cursor-not-allowed', !isAdmin);
        resetBtn.title = isAdmin ? 'Vymazať model (admin)' : 'Reset modelu je povolený iba pre admina';
    }

    if (resetReason) {
        resetReason.textContent = access.role === 'admin' ? '' : 'Reset modelu je povolený iba pre admina.';
    }
}

function updateBrushStatusUi() {
    const badge = document.getElementById('active-brush-badge');
    const clearBtn = document.getElementById('clear-brush-btn');

    if (!badge || !clearBtn) return;

    if (!activeWorkplaceId || !customWorkplaces[activeWorkplaceId]) {
        badge.textContent = 'Žiadny';
        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase';
        badge.style.backgroundColor = '';
        clearBtn.disabled = true;
        return;
    }

    badge.textContent = customWorkplaces[activeWorkplaceId].name;
    badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full text-white uppercase';
    badge.style.backgroundColor = customWorkplaces[activeWorkplaceId].color;
    clearBtn.disabled = false;
}

function updateWorkflowChips(totalRegionalFte, assignedRegionalFte) {
    const chips = [
        document.getElementById('step-chip-1'),
        document.getElementById('step-chip-2'),
        document.getElementById('step-chip-3'),
        document.getElementById('step-chip-4')
    ];

    const hasRegion = !!currentRegionKey;
    const hasWorkplace = Object.values(customWorkplaces).some(wp => wp.regionKey === currentRegionKey);
    const hasAssignments = assignedRegionalFte > 0;
    const fullyAssigned = totalRegionalFte > 0 && assignedRegionalFte === totalRegionalFte;

    const states = [hasRegion, hasWorkplace, hasAssignments, fullyAssigned];

    chips.forEach((chip, idx) => {
        if (!chip) return;
        const done = states[idx];
        chip.className = `px-2 py-1 rounded-lg border text-center ${done ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-500'}`;
    });
}

function updateEditLockUi() {
    const lockBtn = document.getElementById('edit-lock-btn');
    const lockReason = document.getElementById('edit-lock-disabled-reason');
    if (!lockBtn) return;

    if (!canEditCurrentRegion()) {
        lockBtn.textContent = 'Režim úprav: Nedostupný';
        lockBtn.className = 'flex-1 ui-btn-secondary text-xs py-3 px-4 rounded-xl cursor-not-allowed opacity-60';
        lockBtn.disabled = true;
        lockBtn.title = 'Režim úprav je nedostupný pre aktuálny kontext';
        if (lockReason) {
            lockReason.textContent = currentRegionKey === 'slovakia'
                ? 'Režim úprav je dostupný až po výbere konkrétneho kraja.'
                : 'Nemáte oprávnenie upravovať tento kraj.';
        }
        return;
    }

    lockBtn.disabled = false;
    lockBtn.title = editModeLocked ? 'Kliknite pre zapnutie režimu úprav' : 'Kliknite pre vypnutie režimu úprav';
    if (lockReason) lockReason.textContent = '';

    if (editModeLocked) {
        lockBtn.textContent = 'Režim úprav: Vypnutý';
        lockBtn.className = 'flex-1 ui-btn-secondary text-xs py-3 px-4 rounded-xl';
    } else {
        lockBtn.textContent = 'Režim úprav: Zapnutý';
        lockBtn.className = 'flex-1 ui-btn-primary text-xs py-3 px-4 rounded-xl';
    }
}

function updateMapBrushWarning() {
    const warning = document.getElementById('map-brush-warning');
    if (!warning) return;

    if (currentRegionKey === 'slovakia') {
        warning.textContent = 'Pre priraďovanie okresov vyberte konkrétny kraj.';
        warning.classList.remove('hidden');
        return;
    }

    if (editModeLocked) {
        warning.textContent = 'Režim úprav je vypnutý. Zapnite ho tlačidlom v ľavom paneli.';
        warning.classList.remove('hidden');
        return;
    }

    if (!activeWorkplaceId) {
        warning.textContent = 'Vyberte DP v ľavom paneli, aby ste mohli priraďovať okresy.';
        warning.classList.remove('hidden');
        return;
    }

    warning.classList.add('hidden');
}

function updateMapActiveBrushIndicator() {
    const indicator = document.getElementById('map-active-brush-indicator');
    if (!indicator) return;

    if (!activeWorkplaceId || !customWorkplaces[activeWorkplaceId]) {
        indicator.textContent = 'Štetec: Žiadny';
        indicator.className = 'absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 border border-slate-300 text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl shadow-lg pointer-events-none';
        indicator.style.backgroundColor = '';
        indicator.style.borderColor = '';
        indicator.style.borderWidth = '';
        indicator.style.borderStyle = '';
        return;
    }

    const activeWp = customWorkplaces[activeWorkplaceId];
    indicator.textContent = `Štetec: ${activeWp.name}`;
    indicator.className = 'absolute top-16 left-1/2 -translate-x-1/2 z-[1000] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg pointer-events-none';
    indicator.style.backgroundColor = activeWp.color;
    indicator.style.borderColor = 'rgba(255,255,255,0.8)';
    indicator.style.borderWidth = '1px';
    indicator.style.borderStyle = 'solid';
}

function renderMapLegend() {
    const legend = document.getElementById('map-legend');
    const list = document.getElementById('map-legend-list');
    if (!legend || !list) return;

    // Map legend is intentionally disabled in live view; export legend is generated separately.
    legend.classList.add('hidden');
    list.innerHTML = '';
}

function updateDistrictFilterOptions() {
    const select = document.getElementById('district-filter-workplace');
    if (!select) return;

    const workplaces = currentRegionKey === 'slovakia'
        ? Object.values(customWorkplaces)
        : Object.values(customWorkplaces).filter(wp => wp.regionKey === currentRegionKey);
    const prevValue = districtFilterWorkplace;

    select.innerHTML = '<option value="all">Všetky DP</option>';
    workplaces
        .sort((a, b) => {
            if (currentRegionKey === 'slovakia') {
                const regionCmp = (regionMeta[a.regionKey]?.name || a.regionKey).localeCompare((regionMeta[b.regionKey]?.name || b.regionKey), 'sk');
                if (regionCmp !== 0) return regionCmp;
            }
            return (a.name || '').localeCompare((b.name || ''), 'sk');
        })
        .forEach(wp => {
        const option = document.createElement('option');
        option.value = wp.id;
        option.textContent = currentRegionKey === 'slovakia'
            ? `${wp.name} (${regionMeta[wp.regionKey]?.seat || wp.regionKey})`
            : wp.name;
        select.appendChild(option);
        });

    if (workplaces.some(wp => wp.id === prevValue)) {
        select.value = prevValue;
    } else {
        districtFilterWorkplace = 'all';
        select.value = 'all';
    }
}

function syncRegionSelector(value) {
    const selector = document.getElementById('active-region-selector');
    if (!selector) return;

    selector.value = value;
    if (selector.value === value) return;

    const optionIndex = Array.from(selector.options).findIndex(option => option.value === value);
    if (optionIndex >= 0) {
        selector.selectedIndex = optionIndex;
    }
}

async function changeRegion() {
    const newRegionKey = document.getElementById('active-region-selector').value;
    
    // Save previous region when switching away from Slovakia
    if (currentRegionKey === 'slovakia' && newRegionKey !== 'slovakia') {
        previousRegionKey = newRegionKey;
    } else if (newRegionKey !== 'slovakia') {
        // Also update when switching between regions
        previousRegionKey = newRegionKey;
    }
    
    currentRegionKey = newRegionKey;
    activeWorkplaceId = null; 

    if (typeof loadAllRegionsFromCloud === 'function' && currentRegionKey === 'slovakia') {
        await loadAllRegionsFromCloud({ silent: true, skipRedraw: true });
    } else if (typeof loadRegionFromCloud === 'function') {
        await loadRegionFromCloud(currentRegionKey, { silent: true, skipRedraw: true });
    }
    
    if (currentRegionKey === 'slovakia') {
        recenterToSlovakia();
    } else {
        recenterToSelectedRegion();
    }
    
    if (offlineModeActive) {
        drawOfflineNodeMap();
    } else if (geojsonLayer) {
        geojsonLayer.eachLayer(layer => geojsonLayer.resetStyle(layer));
    }
    redrawUiAndStats();
}

function openPromptModal(title, subtitle, type = 'text', defaultVal = "", callback = null) {
    document.getElementById('prompt-modal-title').innerText = title;
    document.getElementById('prompt-modal-subtitle').innerText = subtitle;
    
    const txtInput = document.getElementById('prompt-text-input');
    const numInput = document.getElementById('prompt-num-input');
    
    promptMode = type;
    currentPromptCallback = callback;

    if (type === 'text') {
        txtInput.classList.remove('hidden');
        numInput.classList.add('hidden');
        txtInput.value = defaultVal;
        txtInput.focus();
    } else if (type === 'number') {
        txtInput.classList.add('hidden');
        numInput.classList.remove('hidden');
        numInput.value = defaultVal;
        numInput.focus();
    } else {
        txtInput.classList.add('hidden');
        numInput.classList.add('hidden');
    }

    document.getElementById('custom-prompt-modal').style.display = 'flex';
}

function closeCustomPrompt() {
    document.getElementById('custom-prompt-modal').style.display = 'none';
    currentPromptCallback = null;
}

function openConfirmModal(title, subtitle, callback, okLabel = 'Potvrdiť', cancelLabel = 'Zrušiť') {
    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-subtitle').innerText = subtitle;
    const okBtn = document.getElementById('confirm-modal-ok-btn');
    const cancelBtn = document.getElementById('confirm-modal-cancel-btn');
    okBtn.innerText = okLabel;
    cancelBtn.innerText = cancelLabel;

    const isDanger = /odstran|zmaza|vymaza/i.test(okLabel);
    okBtn.className = `flex-1 text-white text-xs font-extrabold py-3 px-4 rounded-xl transition-colors ${isDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-500 hover:bg-brand-600'}`;
    cancelBtn.className = 'flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold py-3 px-4 rounded-xl transition-colors';

    currentConfirmCallback = callback;
    document.getElementById('custom-confirm-modal').style.display = 'flex';
}

function closeCustomConfirm() {
    document.getElementById('custom-confirm-modal').style.display = 'none';
    currentConfirmCallback = null;
}

function submitCustomConfirm(result) {
    const callback = currentConfirmCallback;
    closeCustomConfirm();
    if (callback) callback(result);
}

function openGuideModal() {
    document.getElementById('guide-modal').style.display = 'flex';
    addAuditEvent('guide-open', { detail: 'Otvorený návod.' });
}

function closeGuideModal(event) {
    if (event && event.target && event.target.id !== 'guide-modal') return;
    document.getElementById('guide-modal').style.display = 'none';
}

function clearActiveWorkplace() {
    if (!activeWorkplaceId) return;
    activeWorkplaceId = null;
    redrawUiAndStats();
    showToast('Aktívny štetec bol vypnutý.', 'info');
}

function toggleEditLock() {
    if (!canEditCurrentRegion()) {
        showToast('Nemáte oprávnenie upravovať tento kraj.', 'warning');
        return;
    }

    editModeLocked = !editModeLocked;
    redrawUiAndStats();
    showToast(editModeLocked ? 'Režim úprav bol vypnutý.' : 'Režim úprav bol zapnutý.', 'info');
}

function changeDistrictFilterMode() {
    const filter = document.getElementById('district-filter-mode');
    districtFilterMode = filter ? filter.value : 'all';
    renderRightCapacityList();
}

function changeDistrictFilterWorkplace() {
    const filter = document.getElementById('district-filter-workplace');
    districtFilterWorkplace = filter ? filter.value : 'all';
    renderRightCapacityList();
}

function normalizeWorkplaceName(name) {
    return String(name || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeColorValue(color) {
    return String(color || '').trim().toLowerCase();
}

function ensureRowVisibleInScrollablePanel(row) {
    if (!row) return;

    const panel = row.closest('section.overflow-y-auto');
    if (!panel) return;

    const panelRect = panel.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const stickyHeader = panel.querySelector('.panel-sticky-header');
    const stickyBottom = stickyHeader
        ? (stickyHeader.getBoundingClientRect().bottom - panelRect.top)
        : 0;

    const topPadding = Math.max(12, stickyBottom + 8);
    const bottomPadding = 12;
    const visibleTop = panelRect.top + topPadding;
    const visibleBottom = panelRect.bottom - bottomPadding;

    const rowIsInPreferredZone = rowRect.top >= visibleTop && rowRect.bottom <= visibleBottom;
    if (rowIsInPreferredZone) return;

    const rowTopInPanelContent = panel.scrollTop + (rowRect.top - panelRect.top);
    const targetScrollTop = Math.max(0, rowTopInPanelContent - topPadding);
    panel.scrollTop = targetScrollTop;
}

function setDistrictListHoverState(districtName, isHovered) {
    const norm = normalizeDistrictName(districtName);
    if (!norm) return;

    const rows = document.querySelectorAll('[data-district-norm]');
    rows.forEach((row) => {
        if (row.dataset.districtNorm === norm) {
            row.classList.toggle('district-row-hovered', !!isHovered);
            if (isHovered) {
                ensureRowVisibleInScrollablePanel(row);
            }
        }
    });
}

function hslToHex(h, s, l) {
    const sat = Math.max(0, Math.min(100, Number(s))) / 100;
    const lig = Math.max(0, Math.min(100, Number(l))) / 100;
    const c = (1 - Math.abs(2 * lig - 1)) * sat;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;

    if (hp >= 0 && hp < 1) {
        r = c;
        g = x;
    } else if (hp >= 1 && hp < 2) {
        r = x;
        g = c;
    } else if (hp >= 2 && hp < 3) {
        g = c;
        b = x;
    } else if (hp >= 3 && hp < 4) {
        g = x;
        b = c;
    } else if (hp >= 4 && hp < 5) {
        r = x;
        b = c;
    } else {
        r = c;
        b = x;
    }

    const m = lig - c / 2;
    const toHex = (v) => {
        const n = Math.round((v + m) * 255);
        return n.toString(16).padStart(2, '0');
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getNextUniqueWorkplaceColor() {
    const usedGlobal = new Set(
        Object.values(customWorkplaces || {})
            .map((wp) => normalizeColorValue(wp?.color))
            .filter(Boolean)
    );

    const paletteColor = (colorPalette || []).find((color) => !usedGlobal.has(normalizeColorValue(color)));
    if (paletteColor) {
        return paletteColor;
    }

    // Palette exhausted: generate stable high-contrast unique colors.
    const start = Object.keys(customWorkplaces || {}).length;
    for (let i = 0; i < 720; i++) {
        const hue = ((start + i) * 137.508) % 360;
        const candidate = hslToHex(hue, 78, 50);
        if (!usedGlobal.has(normalizeColorValue(candidate))) {
            return candidate;
        }
    }

    // Last-resort fallback should practically never be needed.
    return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
}

function repairDuplicateWorkplaceColors() {
    const entries = Object.values(customWorkplaces || {});
    if (!entries.length) {
        return { changedCount: 0, touchedRegions: [] };
    }

    const ordered = [...entries].sort((a, b) => {
        const regionCmp = String(a?.regionKey || '').localeCompare(String(b?.regionKey || ''), 'sk');
        if (regionCmp !== 0) return regionCmp;
        const idCmp = String(a?.id || '').localeCompare(String(b?.id || ''), 'sk');
        if (idCmp !== 0) return idCmp;
        return String(a?.name || '').localeCompare(String(b?.name || ''), 'sk');
    });

    const usedGlobal = new Set();
    const touchedRegions = new Set();
    let changedCount = 0;

    ordered.forEach((wp) => {
        if (!wp?.id || !customWorkplaces[wp.id]) return;

        const currentColor = normalizeColorValue(wp.color);
        if (currentColor && !usedGlobal.has(currentColor)) {
            usedGlobal.add(currentColor);
            return;
        }

        const nextColor = getNextUniqueWorkplaceColor();
        customWorkplaces[wp.id].color = nextColor;
        usedGlobal.add(normalizeColorValue(nextColor));
        touchedRegions.add(customWorkplaces[wp.id].regionKey);
        changedCount += 1;
    });

    return {
        changedCount,
        touchedRegions: Array.from(touchedRegions).filter(Boolean)
    };
}

function submitCustomPrompt() {
    if (currentPromptCallback) {
        let value;
        if (promptMode === 'text') {
            value = document.getElementById('prompt-text-input').value.trim();
        } else if (promptMode === 'number') {
            value = parseInt(document.getElementById('prompt-num-input').value) || 0;
        }
        currentPromptCallback(value);
    }
    closeCustomPrompt();
}

function openAddDPPrompt() {
    if (!canEditCurrentRegion()) {
        showToast('Nemáte oprávnenie upravovať tento kraj.', 'warning');
        return;
    }

    if (editModeLocked) {
        showToast('Režim úprav je vypnutý.', 'warning');
        return;
    }

    // Skontroluj, či sú všetky okresy v kraji už priradené
    if (districtData[currentRegionKey]) {
        let totalDistricts = 0;
        let assignedDistricts = 0;
        
        for (const dName in districtData[currentRegionKey]) {
            const item = districtData[currentRegionKey][dName];
            totalDistricts++;
            if (item.wpId) {
                assignedDistricts++;
            }
        }
        
        if (totalDistricts > 0 && assignedDistricts === totalDistricts) {
            showToast('Všetky okresy v kraji sú už priradené. Nemožno vytvoriť nové DP.', 'warning');
            return;
        }
    }

    openPromptModal(
        "Nové detašované pracovisko",
        "Zadajte názov pre plánované spoločné pracovisko:",
        'text',
        "",
        function (name) {
            const cleanedName = String(name || '').replace(/\s+/g, ' ').trim();
            if (!cleanedName) return;

            const targetNorm = normalizeWorkplaceName(cleanedName);
            const duplicateExists = Object.values(customWorkplaces).some((wp) => {
                if (wp.regionKey !== currentRegionKey) return false;
                return normalizeWorkplaceName(wp.name) === targetNorm;
            });

            if (duplicateExists) {
                showToast('DP s rovnakým názvom v tomto kraji už existuje.', 'warning');
                return;
            }
            
            const id = "wp-" + Date.now();
            const color = getNextUniqueWorkplaceColor();

            customWorkplaces[id] = {
                id: id,
                name: cleanedName,
                color: color,
                regionKey: currentRegionKey
            };

            addHistoryAction({
                type: 'create-workplace',
                workplace: { ...customWorkplaces[id] }
            });

            activeWorkplaceId = null;
            redrawUiAndStats();

            if (typeof scheduleRegionSave === 'function') {
                scheduleRegionSave(currentRegionKey);
            }

            addAuditEvent('create-dp', {
                detail: `Vytvorené DP ${cleanedName}.`,
                workplaceId: id,
                regionKey: currentRegionKey
            });
            showToast(`DP ${cleanedName} bolo vytvorené.`, 'success');
        }
    );
}

function editWorkplaceName(id) {
    if (!canEditCurrentRegion()) {
        showToast('Nemáte oprávnenie upravovať tento kraj.', 'warning');
        return;
    }

    if (editModeLocked) {
        showToast('Režim úprav je vypnutý.', 'warning');
        return;
    }

    const workplace = customWorkplaces[id];
    if (!workplace) return;

    openPromptModal(
        'Upraviť názov DP',
        'Zadajte nový názov pre detašované pracovisko:',
        'text',
        workplace.name,
        function (newName) {
            const cleanedName = String(newName || '').replace(/\s+/g, ' ').trim();
            if (!cleanedName) return;

            if (cleanedName === workplace.name) {
                return;
            }

            const targetNorm = normalizeWorkplaceName(cleanedName);
            const duplicateExists = Object.values(customWorkplaces).some((wp) => {
                if (wp.id === id) return false;
                if (wp.regionKey !== currentRegionKey) return false;
                return normalizeWorkplaceName(wp.name) === targetNorm;
            });

            if (duplicateExists) {
                showToast('DP s rovnakým názvom v tomto kraji už existuje.', 'warning');
                return;
            }

            customWorkplaces[id].name = cleanedName;
            redrawUiAndStats();

            if (typeof saveRegionImmediately === 'function') {
                saveRegionImmediately(currentRegionKey);
            } else if (typeof scheduleRegionSave === 'function') {
                scheduleRegionSave(currentRegionKey);
            }

            addAuditEvent('rename-dp', {
                detail: `Premenované DP ${workplace.name} -> ${cleanedName}.`,
                workplaceId: id,
                regionKey: currentRegionKey
            });
            showToast(`DP bolo premenované na ${cleanedName}.`, 'success');
        }
    );
}

function removeWorkplace(id) {
    if (!canEditCurrentRegion()) {
        showToast('Nemáte oprávnenie upravovať tento kraj.', 'warning');
        return;
    }

    if (editModeLocked) {
        showToast('Režim úprav je vypnutý.', 'warning');
        return;
    }

    const workplace = customWorkplaces[id];
    if (!workplace) return;

    openConfirmModal(
        'Odstrániť detašované pracovisko',
        `Naozaj chcete odstrániť DP ${workplace.name}? Zrušia sa aj jeho priradenia okresov.`,
        function (confirmed) {
            if (!confirmed) return;

            const affectedDistricts = [];
            for (const rKey in districtData) {
                for (const dist in districtData[rKey]) {
                    if (districtData[rKey][dist].wpId === id) {
                        affectedDistricts.push({ regionKey: rKey, districtName: dist, wpId: id });
                        districtData[rKey][dist].wpId = null;
                    }
                }
            }

            addHistoryAction({
                type: 'remove-workplace',
                workplace: { ...workplace },
                affectedDistricts
            });

            delete customWorkplaces[id];
            if (activeWorkplaceId === id) activeWorkplaceId = null;
            
            if (offlineModeActive) {
                drawOfflineNodeMap();
            } else if (geojsonLayer) {
                geojsonLayer.eachLayer(layer => geojsonLayer.resetStyle(layer));
            }
            redrawUiAndStats();

            const touched = new Set([workplace.regionKey]);
            affectedDistricts.forEach(item => touched.add(item.regionKey));
            touched.forEach(regionKey => {
                if (typeof saveRegionImmediately === 'function') {
                    saveRegionImmediately(regionKey);
                    return;
                }
                if (typeof scheduleRegionSave === 'function') {
                    scheduleRegionSave(regionKey);
                }
            });

            addAuditEvent('remove-dp', {
                detail: `Odstránené DP ${workplace.name}, dotknuté okresy: ${affectedDistricts.length}.`,
                workplaceId: id,
                regionKey: workplace.regionKey
            });
            showToast(`DP ${workplace.name} bolo odstránené.`, 'danger');
        },
        'Odstrániť',
        'Zrušiť'
    );
}

function editDistrictFte(districtName) {
    const regionKey = getRegionKeyForDistrict(districtName);
    if (typeof canCurrentUserEditRegion === 'function' && !canCurrentUserEditRegion(regionKey)) {
        showToast('Nemáte oprávnenie upravovať tento kraj.', 'warning');
        return;
    }

    if (editModeLocked) {
        showToast('Režim úprav je vypnutý.', 'warning');
        return;
    }

    const currentFte = getDistrictFteValue(districtName);
    openPromptModal(
        "Upraviť kapacity",
        `Zadajte nový systemizovaný počet FTE pre okres ${districtName}:`,
        'number',
        currentFte,
        function (newFte) {
            if (newFte === currentFte) {
                return;
            }

            setDistrictFteValue(districtName, newFte);
            addHistoryAction({
                type: 'fte-update',
                districtName,
                previousFte: currentFte,
                nextFte: newFte
            });

            if (offlineModeActive) {
                drawOfflineNodeMap();
            }
            redrawUiAndStats();

            const regionKey = getRegionKeyForDistrict(districtName);
            if (typeof scheduleRegionSave === 'function' && regionKey) {
                scheduleRegionSave(regionKey);
            }

            addAuditEvent('fte-update', {
                detail: `Okres ${districtName}: ${currentFte} -> ${newFte} FTE.`,
                districtName,
                regionKey
            });
            showToast(`Kapacita okresu ${districtName} upravená na ${newFte} FTE.`, 'success');
        }
    );
}

function redrawUiAndStats() {
    updateDashboardWidgets();
    updateSlovakiaRegionSummaryPanel();
    renderAccessPanel();
    updateBrushStatusUi();
    updateEditLockUi();
    updateDistrictFilterOptions();
    renderLeftWorkplaceList();
    renderRightCapacityList();
    renderMapLegend();
    updateMapActiveBrushIndicator();
    updateUndoButtonState();
    updateOnboardingPanel();
}

function toggleSlovakiaRegionSummaryPanel() {
    auditUiState.slovakiaRegionSummaryCollapsed = !auditUiState.slovakiaRegionSummaryCollapsed;
    updateSlovakiaRegionSummaryPanel();
}

function toggleSlovakiaRegionDetail(regionKey) {
    if (!regionKey) return;
    auditUiState.slovakiaRegionExpandedKeys[regionKey] = !auditUiState.slovakiaRegionExpandedKeys[regionKey];
    updateSlovakiaRegionSummaryPanel();
}

function updateSlovakiaRegionSummaryPanel() {
    const panel = document.getElementById('slovakia-region-summary-panel');
    const content = document.getElementById('slovakia-region-summary-content');
    const rows = document.getElementById('slovakia-region-summary-rows');
    const toggleBtn = document.getElementById('slovakia-region-summary-toggle-btn');
    if (!panel || !content || !rows || !toggleBtn) return;

    const showPanel = currentRegionKey === 'slovakia';
    panel.classList.toggle('hidden', !showPanel);
    if (!showPanel) return;

    content.style.display = auditUiState.slovakiaRegionSummaryCollapsed ? 'none' : '';
    toggleBtn.textContent = auditUiState.slovakiaRegionSummaryCollapsed ? 'Ukázať' : 'Skryť';
    if (auditUiState.slovakiaRegionSummaryCollapsed) return;

    const municipalityDataLoaded = typeof districtMunicipalityCounts !== 'undefined'
        && districtMunicipalityCounts
        && Object.keys(districtMunicipalityCounts).length > 0;

    const regionRows = Object.keys(regionMeta || {})
        .map((regionKey) => {
            const districtMap = districtData[regionKey] || {};
            const districtByNorm = new Map();
            let districtCount = 0;
            let municipalityCount = 0;

            Object.keys(districtMap).forEach((districtName) => {
                const norm = normalizeDistrictName(districtName);
                if (districtByNorm.has(norm)) return;
                districtByNorm.set(norm, districtName);
                districtCount += 1;

                if (municipalityDataLoaded && typeof getDistrictMunicipalityCount === 'function') {
                    const m = Number(getDistrictMunicipalityCount(districtName));
                    if (Number.isFinite(m) && m > 0) municipalityCount += m;
                }
            });

            const districts = Array.from(districtByNorm.values())
                .map((districtName) => {
                    let municipality = null;
                    if (municipalityDataLoaded && typeof getDistrictMunicipalityCount === 'function') {
                        const m = Number(getDistrictMunicipalityCount(districtName));
                        municipality = Number.isFinite(m) && m > 0 ? m : 0;
                    }
                    return { districtName, municipality };
                })
                .sort((a, b) => a.districtName.localeCompare(b.districtName, 'sk'));

            return {
                regionKey,
                label: regionMeta[regionKey]?.seat || regionMeta[regionKey]?.name || regionKey,
                districtCount,
                municipalityCount: municipalityDataLoaded ? municipalityCount : null,
                districts
            };
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'sk'));

    if (!regionRows.length) {
        rows.innerHTML = '<div class="py-2 text-[11px] text-slate-500">Nie sú dostupné regionálne údaje.</div>';
        return;
    }

    rows.innerHTML = `${municipalityDataLoaded ? '' : '<div class="mb-1 px-1 py-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded">Načítavam počty obcí...</div>'}` + regionRows.map((item) => {
        const expanded = Boolean(auditUiState.slovakiaRegionExpandedKeys[item.regionKey]);
        const districtsHtml = expanded
            ? (item.districts.length
                ? item.districts.map((districtItem) => `
                    <div class="grid grid-cols-[1fr_auto] gap-x-2 py-0.5 text-[10px]">
                        <span class="text-slate-600 truncate" title="${districtItem.districtName}">${districtItem.districtName}</span>
                        <span class="font-semibold text-slate-700 text-right">${districtItem.municipality === null ? '...' : districtItem.municipality}</span>
                    </div>
                `).join('')
                : '<div class="py-1 text-[10px] text-slate-500">Žiadne okresy.</div>')
            : '';

        return `
            <div class="border-b border-slate-100 last:border-b-0 py-1">
                <div class="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center text-[11px]">
                    <button type="button" onclick="toggleSlovakiaRegionDetail('${item.regionKey}')" class="text-left font-semibold text-slate-700 hover:text-slate-900 truncate" title="${expanded ? 'Skryť okresy' : 'Zobraziť okresy'}">
                        <span class="inline-block w-4 text-slate-500">${expanded ? '▾' : '▸'}</span>${item.label}
                    </button>
                    <span class="font-bold text-slate-700 text-right">${item.districtCount}</span>
                    <span class="font-bold text-slate-700 text-right">${item.municipalityCount === null ? '...' : item.municipalityCount}</span>
                </div>
                ${expanded ? `<div class="mt-1 ml-4 pl-2 border-l border-slate-200">${districtsHtml}</div>` : ''}
            </div>
        `;
    }).join('');
}

function updateDashboardWidgets() {
    const activeRegionBadge = document.getElementById('active-map-kraj-badge');
    if (activeRegionBadge) {
        const regionLabel = (currentRegionKey === 'slovakia')
            ? 'Slovensko'
            : (regionMeta[currentRegionKey]?.name || 'Vybraný kraj');
        activeRegionBadge.innerText = regionLabel;
        activeRegionBadge.title = regionLabel;
    }

    let totalRegionalFte = 0;
    let assignedRegionalFte = 0;

    if (currentRegionKey === 'slovakia') {
        for (const rKey in districtData) {
            const processed = new Set();
            for (const dName in districtData[rKey]) {
                const norm = normalizeDistrictName(dName);
                if (processed.has(norm)) continue;
                processed.add(norm);
                const item = districtData[rKey][dName];
                totalRegionalFte += item.fte;
                if (item.wpId) assignedRegionalFte += item.fte;
            }
        }
    } else {
        if (districtData[currentRegionKey]) {
            const processed = new Set();
            for (const dName in districtData[currentRegionKey]) {
                const norm = normalizeDistrictName(dName);
                if (processed.has(norm)) continue;
                processed.add(norm);

                const item = districtData[currentRegionKey][dName];
                totalRegionalFte += item.fte;
                if (item.wpId) {
                    assignedRegionalFte += item.fte;
                }
            }
        }
    }

    document.getElementById('current-region-fte-sum').innerText = `${totalRegionalFte} FTE`;
    document.getElementById('current-assigned-fte-sum').innerText = `${assignedRegionalFte} FTE`;
    document.getElementById('current-unassigned-fte-sum').innerText = `${totalRegionalFte - assignedRegionalFte} FTE`;
    updateWorkflowChips(totalRegionalFte, assignedRegionalFte);

    let globalAssignedFte = 0;
    for (const rKey in districtData) {
        const processed = new Set();
        for (const dName in districtData[rKey]) {
            const norm = normalizeDistrictName(dName);
            if (processed.has(norm)) continue;
            processed.add(norm);

            const item = districtData[rKey][dName];
            if (item.wpId) {
                globalAssignedFte += item.fte;
            }
        }
    }
    document.getElementById('global-assigned-count').innerText = globalAssignedFte;
}

function renderLeftWorkplaceList() {
    const listContainer = document.getElementById('wp-brush-list');
    listContainer.innerHTML = '';

    const activeDps = Object.values(customWorkplaces).filter(wp => wp.regionKey === currentRegionKey);
    const canEdit = canEditCurrentRegion();

    if (activeDps.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs bg-slate-50">
                <span class="block font-bold text-slate-500">Zatiaľ nie sú vytvorené žiadne DP.</span>
                <span class="block mt-1">Použite tlačidlo + VYTVORIŤ DP.</span>
            </div>
        `;
        return;
    }

    activeDps.forEach(wp => {
        const isSelected = wp.id === activeWorkplaceId;
        
        let cumFte = 0;
        let mappedCount = 0;
        let cumMunicipalities = 0;
        if (districtData[currentRegionKey]) {
            const processed = new Set();
            for (const dName in districtData[currentRegionKey]) {
                const norm = normalizeDistrictName(dName);
                if (processed.has(norm)) continue;
                processed.add(norm);

                const item = districtData[currentRegionKey][dName];
                if (item.wpId === wp.id) {
                    cumFte += item.fte;
                    mappedCount++;
                    const muniCount = getDistrictMunicipalityCount(dName);
                    if (muniCount !== null) {
                        cumMunicipalities += muniCount;
                    }
                }
            }
        }

        const itemDiv = document.createElement('div');
        itemDiv.className = `flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
            isSelected ? 'border-brand-500 bg-orange-50/50 shadow-md ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:bg-slate-50'
        }`;
        itemDiv.onclick = () => {
            activeWorkplaceId = (activeWorkplaceId === wp.id) ? null : wp.id;
            redrawUiAndStats();
        };

        itemDiv.innerHTML = `
            <div class="flex items-center space-x-2.5">
                <span class="w-4 h-4 rounded-full border border-slate-900/10 shrink-0" style="background-color: ${wp.color}"></span>
                <div>
                    <span class="text-xs font-extrabold text-slate-800 uppercase block text-left">${wp.name}</span>
                    <span class="text-[9px] text-slate-600 block font-bold uppercase tracking-wide text-left">${mappedCount} okresov | ${cumFte} FTE | ${cumMunicipalities} obcí</span>
                </div>
            </div>
            <div class="flex items-center space-x-1 shrink-0">
                <button onclick="event.stopPropagation(); editWorkplaceName('${wp.id}')" class="text-slate-400 hover:text-brand-500 p-1 rounded-md hover:bg-slate-100 transition-colors" title="Premenovať DP">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                </button>
                <button onclick="event.stopPropagation(); removeWorkplace('${wp.id}')" class="text-red-500 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors" title="Odstrániť DP">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `;

        if (!canEdit) {
            const btns = itemDiv.querySelectorAll('button');
            btns.forEach((btn) => {
                btn.disabled = true;
                btn.classList.add('opacity-40', 'cursor-not-allowed');
            });
        }

        listContainer.appendChild(itemDiv);
    });
}

function renderRightCapacityList() {
    const container = document.getElementById('district-capacity-list');
    container.innerHTML = '';
    const canEdit = canEditCurrentRegion();

    const modeFilterEl = document.getElementById('district-filter-mode');
    if (modeFilterEl) districtFilterMode = modeFilterEl.value;

    const workplaceFilterEl = document.getElementById('district-filter-workplace');
    if (workplaceFilterEl) districtFilterWorkplace = workplaceFilterEl.value;

    const districtEditReason = document.getElementById('district-edit-disabled-reason');
    if (districtEditReason) {
        districtEditReason.textContent = canEdit
            ? ''
            : currentRegionKey === 'slovakia'
                ? 'Úpravy okresov sú dostupné až po výbere konkrétneho kraja.'
                : 'Nemáte oprávnenie upravovať okresy v tomto kraji.';
    }

    const uniqueDistricts = [];
    const processed = new Set();

    if (currentRegionKey === 'slovakia') {
        for (const regionKey in districtData) {
            for (const dName in districtData[regionKey]) {
                const norm = normalizeDistrictName(dName);
                const compositeKey = `${regionKey}::${norm}`;
                if (processed.has(compositeKey)) continue;
                processed.add(compositeKey);

                uniqueDistricts.push({
                    name: dName,
                    regionKey,
                    fte: districtData[regionKey][dName].fte,
                    wpId: districtData[regionKey][dName].wpId
                });
            }
        }
    } else {
        if (!districtData[currentRegionKey]) return;

        for (const dName in districtData[currentRegionKey]) {
            const norm = normalizeDistrictName(dName);
            if (processed.has(norm)) continue;
            processed.add(norm);
            uniqueDistricts.push({
                name: dName,
                regionKey: currentRegionKey,
                fte: districtData[currentRegionKey][dName].fte,
                wpId: districtData[currentRegionKey][dName].wpId
            });
        }
    }

    uniqueDistricts.sort((a, b) => {
        if (currentRegionKey === 'slovakia') {
            const regionCmp = (regionMeta[a.regionKey]?.name || a.regionKey).localeCompare((regionMeta[b.regionKey]?.name || b.regionKey), 'sk');
            if (regionCmp !== 0) return regionCmp;
        }
        return a.name.localeCompare(b.name, 'sk');
    });

    const filteredDistricts = uniqueDistricts.filter(dist => {
        const modeMatch = districtFilterMode === 'all'
            ? true
            : districtFilterMode === 'assigned'
                ? !!dist.wpId
                : !dist.wpId;

        const workplaceMatch = districtFilterWorkplace === 'all'
            ? true
            : dist.wpId === districtFilterWorkplace;

        return modeMatch && workplaceMatch;
    });

    if (!filteredDistricts.length) {
        container.innerHTML = `
            <div class="text-center py-6 border border-slate-200 rounded-xl text-slate-400 text-xs bg-slate-50">
                Žiadne okresy nespĺňajú aktuálny filter.
            </div>
        `;
        return;
    }

    filteredDistricts.forEach(dist => {
        let badgeHtml = `<span class="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">Nezaradené</span>`;
        if (dist.wpId && customWorkplaces[dist.wpId]) {
            const wp = customWorkplaces[dist.wpId];
            badgeHtml = `
                <span class="text-white text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full shadow-sm" style="background-color: ${wp.color}">
                    ${wp.name}
                </span>
            `;
        }

        const block = document.createElement('div');
        block.dataset.districtNorm = normalizeDistrictName(dist.name);
        block.className = "bg-white border border-slate-200 rounded-xl p-3.5 hover:shadow-md transition-all flex items-center justify-between space-x-2";
        const muniCount = getDistrictMunicipalityCount(dist.name);
        const regionName = regionMeta[dist.regionKey]?.name || dist.regionKey;
        const regionHtml = currentRegionKey === 'slovakia'
            ? `<span class="text-[10px] text-slate-500 block font-semibold">Kraj: <strong class="text-slate-700">${regionName}</strong></span>`
            : '';
        const muniHtml = muniCount !== null
            ? `<span class="text-xs text-slate-700 block font-semibold">Mestá a obce: <strong class="text-slate-800">${muniCount}</strong></span>`
            : '';
        block.innerHTML = `
            <div class="space-y-1.5 min-w-0 text-left">
                <div class="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span class="text-xs font-bold text-slate-800 truncate block">${dist.name}</span>
                    ${badgeHtml}
                </div>
                ${regionHtml}
                <span class="text-xs text-slate-700 block font-semibold">Základná kapacita: <strong class="text-slate-800">${dist.fte} FTE</strong></span>
                ${muniHtml}
            </div>
            <button onclick="editDistrictFte('${dist.name}')" class="bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-brand-500 border border-slate-200 p-2 rounded-lg transition-colors shrink-0" ${canEdit ? '' : 'disabled'} title="Upraviť FTE okresu">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            </button>
        `;

        if (!canEdit) {
            const editBtn = block.querySelector('button');
            if (editBtn) {
                editBtn.classList.add('opacity-40', 'cursor-not-allowed');
            }
        }

        block.addEventListener('mouseenter', () => {
            setDistrictListHoverState(dist.name, true);
            if (typeof highlightDistrictOnMapByName === 'function') {
                highlightDistrictOnMapByName(dist.name);
            }
        });

        block.addEventListener('mouseleave', () => {
            setDistrictListHoverState(dist.name, false);
            if (typeof clearDistrictHoverOnMap === 'function') {
                clearDistrictHoverOnMap();
            }
        });

        container.appendChild(block);
    });
}

function performDistrictSearch() {
    const searchInput = document.getElementById('district-search-input');
    const searchResult = document.getElementById('district-search-result');
    
    if (!searchInput || !searchResult) return;
    
    const query = searchInput.value.trim().toLowerCase();
    
    if (!query) {
        searchResult.classList.add('hidden');
        searchResult.innerHTML = '';
        return;
    }
    
    // Search across all regions
    let foundDistrict = null;
    let foundRegionKey = null;
    
    for (const regionKey in districtData) {
        for (const districtName in districtData[regionKey]) {
            if (normalizeDistrictName(districtName).includes(normalizeDistrictName(query))) {
                foundDistrict = {
                    name: districtName,
                    fte: districtData[regionKey][districtName].fte,
                    wpId: districtData[regionKey][districtName].wpId
                };
                foundRegionKey = regionKey;
                break;
            }
        }
        if (foundDistrict) break;
    }
    
    if (!foundDistrict || !foundRegionKey) {
        searchResult.innerHTML = `<div class="text-slate-500 font-semibold">Okres nenájdený.</div>`;
        searchResult.classList.remove('hidden');
        return;
    }
    
    const regionMeta = {
        "banska-bystrica": "Banskobystrický kraj",
        "bratislavsky": "Bratislavský kraj",
        "trnava": "Trnavský kraj",
        "trencin": "Trenčiansky kraj",
        "nitra": "Nitriansky kraj",
        "zilina": "Žilinský kraj",
        "presov": "Prešovský kraj",
        "kosice": "Košický kraj"
    };
    
    let workplaceName = "Nepriradené";
    if (foundDistrict.wpId && customWorkplaces[foundDistrict.wpId]) {
        workplaceName = customWorkplaces[foundDistrict.wpId].name;
    }
    
    const muniCount = getDistrictMunicipalityCount(foundDistrict.name);
    const muniHtml = muniCount !== null ? `<div class="flex justify-between"><span class="text-slate-600">Mestá a obce:</span><strong class="text-slate-800">${muniCount}</strong></div>` : '';
    
    searchResult.innerHTML = `
        <div class="flex justify-between"><span class="text-slate-600">Okres:</span><strong class="text-slate-800">${foundDistrict.name}</strong></div>
        <div class="flex justify-between"><span class="text-slate-600">Kraj:</span><strong class="text-slate-800">${regionMeta[foundRegionKey] || foundRegionKey}</strong></div>
        <div class="flex justify-between"><span class="text-slate-600">Priradené k DP:</span><strong class="text-slate-800">${workplaceName}</strong></div>
        ${muniHtml}
        <div class="flex justify-between"><span class="text-slate-600">Kapacita FTE:</span><strong class="text-slate-800">${foundDistrict.fte}</strong></div>
    `;
    searchResult.classList.remove('hidden');
}

function clearDistrictSearch() {
    const searchInput = document.getElementById('district-search-input');
    const searchResult = document.getElementById('district-search-result');
    
    if (searchInput) searchInput.value = '';
    if (searchResult) {
        searchResult.classList.add('hidden');
        searchResult.innerHTML = '';
    }
}

async function reloadCurrentRegionData() {
    const access = getAccessContextSafe();
    if (!access.isAuthenticated) {
        showToast('Najprv sa prihláste.', 'warning');
        return;
    }

    const reloadBtn = document.getElementById('auth-reload-btn');
    if (reloadBtn) {
        reloadBtn.disabled = true;
        reloadBtn.style.opacity = '0.6';
    }

    try {
        if (currentRegionKey === 'slovakia') {
            // Reload all regions if currently viewing Slovakia
            if (typeof loadAllRegionsFromCloud === 'function') {
                await loadAllRegionsFromCloud({ silent: true, skipRedraw: false });
            }
        } else {
            // Reload just the current region
            if (typeof loadRegionFromCloud === 'function') {
                await loadRegionFromCloud(currentRegionKey, { silent: true, skipRedraw: false });
            }
        }
        
        // Refresh UI after reload
        redrawUiAndStats();
        
        showToast('Dáta boli úspešne reloadnuté z Firestore.', 'success');
    } catch (err) {
        console.error('Failed to reload region data', err);
        showToast('Reload dát zlyhal. Skúste to neskôr.', 'warning');
    } finally {
        if (reloadBtn) {
            reloadBtn.disabled = false;
            reloadBtn.style.opacity = '1';
        }
    }
}
