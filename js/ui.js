// js/ui.js

function showToast(message, tone = 'info') {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;

    const toneClass = tone === 'success'
        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
        : tone === 'warning'
            ? 'bg-amber-50 border-amber-300 text-amber-800'
            : 'bg-slate-50 border-slate-300 text-slate-800';

    const toast = document.createElement('div');
    toast.className = `toast-item pointer-events-none px-4 py-2 rounded-xl border shadow-lg text-xs font-semibold ${toneClass}`;
    toast.textContent = message;
    stack.appendChild(toast);

    while (stack.children.length > 3) {
        stack.removeChild(stack.firstChild);
    }

    setTimeout(() => {
        toast.remove();
    }, 2200);
}

function updateUndoButtonState() {
    const undoBtn = document.getElementById('undo-action-btn');
    if (!undoBtn) return;
    undoBtn.disabled = actionHistory.length === 0;
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
    if (!lockBtn) return;

    if (editModeLocked) {
        lockBtn.textContent = 'Režim úprav: Vypnutý';
        lockBtn.className = 'w-full bg-slate-200 text-slate-700 text-[11px] font-bold py-2 rounded-lg';
    } else {
        lockBtn.textContent = 'Režim úprav: Zapnutý';
        lockBtn.className = 'w-full bg-slate-900 text-white text-[11px] font-bold py-2 rounded-lg';
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

    const workplaces = Object.values(customWorkplaces).filter(wp => wp.regionKey === currentRegionKey);
    if (!workplaces.length) {
        legend.classList.add('hidden');
        list.innerHTML = '';
        return;
    }

    list.innerHTML = workplaces.map(wp => {
        let assignedCount = 0;
        const regionDistricts = districtData[currentRegionKey] || {};
        Object.values(regionDistricts).forEach(item => {
            if (item.wpId === wp.id) assignedCount++;
        });

        return `
            <div class="flex items-center justify-between gap-2 text-[11px]">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${wp.color}"></span>
                    <span class="font-semibold text-slate-700 truncate">${wp.name}</span>
                </div>
                <span class="text-slate-400 font-bold">${assignedCount}</span>
            </div>
        `;
    }).join('');

    legend.classList.remove('hidden');
}

function updateDistrictFilterOptions() {
    const select = document.getElementById('district-filter-workplace');
    if (!select) return;

    const workplaces = Object.values(customWorkplaces).filter(wp => wp.regionKey === currentRegionKey);
    const prevValue = districtFilterWorkplace;

    select.innerHTML = '<option value="all">Všetky DP</option>';
    workplaces.forEach(wp => {
        const option = document.createElement('option');
        option.value = wp.id;
        option.textContent = wp.name;
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
    currentRegionKey = document.getElementById('active-region-selector').value;
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
    document.getElementById('confirm-modal-ok-btn').innerText = okLabel;
    document.getElementById('confirm-modal-cancel-btn').innerText = cancelLabel;
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
    if (editModeLocked) {
        showToast('Režim úprav je vypnutý.', 'warning');
        return;
    }

    openPromptModal(
        "Nové detašované pracovisko",
        "Zadajte názov pre plánované spoločné pracovisko:",
        'text',
        "",
        function (name) {
            if (!name) return;
            
            const id = "wp-" + Date.now();
            const color = colorPalette[colorIndex % colorPalette.length];
            colorIndex++;

            customWorkplaces[id] = {
                id: id,
                name: name,
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

            showToast(`DP ${name} bolo vytvorené.`, 'success');
        }
    );
}

function removeWorkplace(id) {
    if (editModeLocked) {
        showToast('Režim úprav je vypnutý.', 'warning');
        return;
    }

    const workplace = customWorkplaces[id];
    if (!workplace) return;

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

    if (typeof scheduleRegionSave === 'function') {
        const touched = new Set([workplace.regionKey]);
        affectedDistricts.forEach(item => touched.add(item.regionKey));
        touched.forEach(regionKey => scheduleRegionSave(regionKey));
    }

    showToast(`DP ${workplace.name} bolo odstránené.`, 'info');
}

function editDistrictFte(districtName) {
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

            showToast(`Kapacita okresu ${districtName} upravená na ${newFte} FTE.`, 'success');
        }
    );
}

function redrawUiAndStats() {
    updateDashboardWidgets();
    updateBrushStatusUi();
    updateEditLockUi();
    updateDistrictFilterOptions();
    renderLeftWorkplaceList();
    renderRightCapacityList();
    renderMapLegend();
    updateMapBrushWarning();
    updateMapActiveBrushIndicator();
    updateUndoButtonState();
}

function updateDashboardWidgets() {
    document.getElementById('active-map-kraj-badge').innerText = (currentRegionKey === 'slovakia') ? 'Slovensko' : (regionMeta[currentRegionKey]?.name.replace("ý kraj", "") || "Vybraný");

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

    if (activeDps.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs bg-slate-50">
                <span class="block font-bold text-slate-500">Zatiaľ nie sú vytvorené žiadne DP.</span>
                <span class="block mt-1">Použite tlačidlo + PRIDAŤ DP.</span>
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
                    <span class="text-[10px] text-slate-400 block font-mono font-bold uppercase tracking-wider text-left">${mappedCount} okresov | ${cumFte} FTE | ${cumMunicipalities} obcí</span>
                </div>
            </div>
            <button onclick="event.stopPropagation(); removeWorkplace('${wp.id}')" class="text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-slate-100 transition-colors shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        listContainer.appendChild(itemDiv);
    });
}

function renderRightCapacityList() {
    const container = document.getElementById('district-capacity-list');
    container.innerHTML = '';

    const modeFilterEl = document.getElementById('district-filter-mode');
    if (modeFilterEl) districtFilterMode = modeFilterEl.value;

    const workplaceFilterEl = document.getElementById('district-filter-workplace');
    if (workplaceFilterEl) districtFilterWorkplace = workplaceFilterEl.value;

    if (!districtData[currentRegionKey]) return;

    const processed = new Set();
    const uniqueDistricts = [];

    for (const dName in districtData[currentRegionKey]) {
        const norm = normalizeDistrictName(dName);
        if (processed.has(norm)) continue;
        processed.add(norm);
        uniqueDistricts.push({
            name: dName,
            fte: districtData[currentRegionKey][dName].fte,
            wpId: districtData[currentRegionKey][dName].wpId
        });
    }

    uniqueDistricts.sort((a, b) => a.name.localeCompare(b.name, 'sk'));

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
        let badgeHtml = `<span class="bg-slate-100 text-slate-500 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full">Nezaradené</span>`;
        if (dist.wpId && customWorkplaces[dist.wpId]) {
            const wp = customWorkplaces[dist.wpId];
            badgeHtml = `
                <span class="text-white text-[9px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full shadow-sm" style="background-color: ${wp.color}">
                    ${wp.name}
                </span>
            `;
        }

        const block = document.createElement('div');
        block.className = "bg-white border border-slate-200 rounded-xl p-3.5 hover:shadow-md transition-all flex items-center justify-between space-x-2";
        const muniCount = getDistrictMunicipalityCount(dist.name);
        const muniHtml = muniCount !== null
            ? `<span class="text-[10px] text-slate-400 block font-mono font-bold">Mestá a obce: <strong class="text-slate-600">${muniCount}</strong></span>`
            : '';
        block.innerHTML = `
            <div class="space-y-1.5 min-w-0 text-left">
                <div class="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span class="text-xs font-bold text-slate-800 truncate block">${dist.name}</span>
                    ${badgeHtml}
                </div>
                <span class="text-[10px] text-slate-400 block font-mono font-bold">Základná kapacita: <strong class="text-slate-600">${dist.fte} FTE</strong></span>
                ${muniHtml}
            </div>
            <button onclick="editDistrictFte('${dist.name}')" class="bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-brand-500 border border-slate-200 p-2 rounded-lg transition-colors shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            </button>
        `;
        container.appendChild(block);
    });
}
