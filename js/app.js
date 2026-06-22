// js/app.js

let currentRegionKey = "slovakia";
let districtMunicipalityCounts = {};
let activeWorkplaceId = null; 
let offlineModeActive = false; 

let districtData = getDefaultDistrictData(); // Uses function from data.js
let customWorkplaces = {};
window.colorIndex = 0;
let editModeLocked = false;
let actionHistory = [];
let districtFilterMode = 'all';
let districtFilterWorkplace = 'all';

let map;
let geojsonLayer; 
let krajeLayer;   
let krajeOutlineLayer = null;
let cityLabelLayerGroup = null;
let fallbackMarkerLayerGroup = null;
let selectedRegionBounds;

let currentPromptCallback = null;
let currentConfirmCallback = null;
let promptMode = 'text';

function addHistoryAction(action) {
    actionHistory.push(action);
    if (actionHistory.length > 100) actionHistory.shift();
    updateUndoButtonState();
}

function undoLastAction() {
    const lastAction = actionHistory.pop();
    if (!lastAction) {
        updateUndoButtonState();
        return;
    }

    if (lastAction.type === 'district-assignment') {
        setDistrictWorkplaceId(lastAction.districtName, lastAction.previousWpId);
        showToast(`Vrátené: ${lastAction.districtName}`, 'info');
    }

    if (lastAction.type === 'fte-update') {
        setDistrictFteValue(lastAction.districtName, lastAction.previousFte);
        showToast(`Vrátené FTE pre ${lastAction.districtName}`, 'info');
    }

    if (lastAction.type === 'create-workplace') {
        delete customWorkplaces[lastAction.workplace.id];
        if (activeWorkplaceId === lastAction.workplace.id) activeWorkplaceId = null;
        showToast(`DP ${lastAction.workplace.name} bolo odstránené (undo).`, 'info');
    }

    if (lastAction.type === 'remove-workplace') {
        customWorkplaces[lastAction.workplace.id] = lastAction.workplace;
        lastAction.affectedDistricts.forEach(item => {
            if (districtData[item.regionKey] && districtData[item.regionKey][item.districtName]) {
                districtData[item.regionKey][item.districtName].wpId = item.wpId;
            }
        });
        showToast(`DP ${lastAction.workplace.name} bolo obnovené (undo).`, 'info');
    }

    if (offlineModeActive) {
        drawOfflineNodeMap();
    } else {
        refreshMapLayerState();
    }

    redrawUiAndStats();

    if (typeof scheduleRegionSave === 'function') {
        if (lastAction.type === 'district-assignment' || lastAction.type === 'fte-update') {
            const regionKey = getRegionKeyForDistrict(lastAction.districtName);
            if (regionKey) scheduleRegionSave(regionKey);
        }

        if (lastAction.type === 'create-workplace' || lastAction.type === 'remove-workplace') {
            const touched = new Set();
            if (lastAction.workplace?.regionKey) touched.add(lastAction.workplace.regionKey);
            (lastAction.affectedDistricts || []).forEach(item => touched.add(item.regionKey));
            touched.forEach(regionKey => scheduleRegionSave(regionKey));
        }
    }
}

async function loadMunicipalityCountsFromLocalFiles() {
    const xmlPaths = ['./data/obce.xml', 'data/obce.xml'];
    for (const path of xmlPaths) {
        try {
            const res = await fetch(path);
            if (!res.ok) continue;
            const xmlText = await res.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
            const rows = Array.from(xmlDoc.querySelectorAll('ROW'));
            if (!rows.length) continue;

            const counts = {};
            rows.forEach(row => {
                const districtNode = row.querySelector('COLUMN[NAME="TEXT"]');
                const districtName = districtNode ? districtNode.textContent.trim() : null;
                if (!districtName) return;
                const norm = getCanonicalDistrictNorm(districtName);
                counts[norm] = (counts[norm] || 0) + 1;
            });
            return counts;
        } catch (err) {
            // try next path
        }
    }

    if (window.__citiesRegionsDistrictsGeojson) {
        const counts = {};
        (window.__citiesRegionsDistrictsGeojson.features || []).forEach(f => {
            const districtName = f.properties && f.properties.district;
            if (!districtName) return;
            const norm = getCanonicalDistrictNorm(districtName);
            counts[norm] = (counts[norm] || 0) + 1;
        });
        return counts;
    }

    const tryPaths = ['./data/cities_regions_districts_epsg_4326.geojson', 'data/cities_regions_districts_epsg_4326.geojson'];
    for (const path of tryPaths) {
        try {
            const res = await fetch(path);
            if (!res.ok) continue;
            const data = await res.json();
            const counts = {};
            (data.features || []).forEach(f => {
                const districtName = f.properties && f.properties.district;
                if (!districtName) return;
                const norm = getCanonicalDistrictNorm(districtName);
                counts[norm] = (counts[norm] || 0) + 1;
            });
            return counts;
        } catch (err) {
            // try next path
        }
    }

    return null;
}

async function fetchMunicipalityCounts() {
    if (typeof isFirebaseSyncEnabled === 'function' && isFirebaseSyncEnabled() && typeof loadDistrictMetaFromCloud === 'function') {
        const cloud = await loadDistrictMetaFromCloud({ silent: true });
        if (cloud.loaded && Object.keys(cloud.counts || {}).length > 0) {
            districtMunicipalityCounts = cloud.counts;
            renderRightCapacityList();
            return;
        }
    }

    const localCounts = await loadMunicipalityCountsFromLocalFiles();
    if (localCounts) {
        districtMunicipalityCounts = localCounts;
        renderRightCapacityList();
        return;
    }

    console.warn("Municipality count data could not be loaded.");
}



function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.body.appendChild(s);
    });
}

function buildExportLegendData(exportWhole) {
    const scopeRegionKeys = exportWhole ? Object.keys(districtData) : [currentRegionKey];
    const items = [];

    scopeRegionKeys.forEach((rKey, regionIndex) => {
        if (exportWhole) {
            items.push({
                kind: 'region-header',
                label: `kraj ${regionMeta[rKey]?.seat || regionMeta[rKey]?.name || rKey}`,
                regionKey: rKey
            });
        }

        const legendByWpId = {};
        const districts = districtData[rKey] || {};

        Object.entries(districts).forEach(([dName, item]) => {
            const wpId = item?.wpId;
            const wp = wpId ? customWorkplaces[wpId] : null;
            if (!wp) return;

            if (!legendByWpId[wpId]) {
                legendByWpId[wpId] = {
                    id: wpId,
                    name: wp.name,
                    color: wp.color,
                    fte: 0,
                    municipalities: 0,
                    municipalitiesKnown: false,
                    regionKey: rKey,
                    regionOrder: regionIndex
                };
            }

            legendByWpId[wpId].fte += Number(item?.fte || 0);
            const muniCount = getDistrictMunicipalityCount(dName);
            if (muniCount !== null) {
                legendByWpId[wpId].municipalities += muniCount;
                legendByWpId[wpId].municipalitiesKnown = true;
            }
        });

        const regionItems = Object.values(legendByWpId).sort((a, b) => a.name.localeCompare(b.name, 'sk'));
        items.push(...regionItems);

        if (exportWhole && regionIndex < scopeRegionKeys.length - 1 && regionItems.length) {
            items.push({ kind: 'region-gap' });
        }
    });

    const totals = items.reduce((acc, item) => {
        if (item.kind === 'region-gap') return acc;
        acc.fte += item.fte;
        if (item.municipalitiesKnown) {
            acc.municipalities += item.municipalities;
            acc.hasMunicipalityData = true;
        }
        return acc;
    }, { fte: 0, municipalities: 0, hasMunicipalityData: false });

    return { items, totals };
}

function fitLegendName(ctx, text, maxWidth) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 1 && ctx.measureText(`${out}...`).width > maxWidth) {
        out = out.slice(0, -1);
    }
    return `${out}...`;
}

function composeExportCanvasWithLegend(mapCanvas, exportWhole) {
    const { items, totals } = buildExportLegendData(exportWhole);
    if (!items.length) return mapCanvas;

    const targetHeight = mapCanvas.height;
    const titleHeight = 26;
    const headerHeight = 20;
    const footerHeight = 26;
    const verticalPadding = 16;
    const rowHeight = 17;
    const availableRowsHeight = targetHeight - (verticalPadding * 2) - titleHeight - headerHeight - footerHeight;
    const maxRowsPerColumn = Math.max(1, Math.floor(availableRowsHeight / rowHeight));
    const columnCount = Math.max(1, Math.ceil(items.length / maxRowsPerColumn));
    const columnWidth = 220;
    const legendWidth = 24 + (columnCount * columnWidth);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = mapCanvas.width + legendWidth;
    outCanvas.height = mapCanvas.height;

    const ctx = outCanvas.getContext('2d');
    ctx.drawImage(mapCanvas, 0, 0);

    const legendX = mapCanvas.width;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(legendX, 0, legendWidth, outCanvas.height);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(legendX + 0.5, 0);
    ctx.lineTo(legendX + 0.5, outCanvas.height);
    ctx.stroke();

    const scopeLabel = exportWhole ? 'SLOVENSKA REPUBLIKA' : (regionMeta[currentRegionKey]?.name || 'AKTUALNY KRAJ').toUpperCase();
    const baseX = legendX + 12;
    let y = 16;

    ctx.fillStyle = '#475569';
    ctx.font = '700 12px Inter, sans-serif';
    ctx.fillText(`LEGENDA DP - ${scopeLabel}`, baseX, y);
    y += titleHeight;

    ctx.font = '700 11px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    for (let col = 0; col < columnCount; col++) {
        const colX = baseX + (col * columnWidth);
        ctx.fillText('DP', colX, y);
        ctx.fillText('FTE', colX + 138, y);
        ctx.fillText('OBCE', colX + 170, y);
    }

    y += 10;
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(baseX, y);
    ctx.lineTo(baseX + (columnCount * columnWidth) - 12, y);
    ctx.stroke();

    const firstRowY = y + 14;
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillStyle = '#0f172a';

    let virtualRow = 0;
    items.forEach((item) => {
        if (item.kind === 'region-header') {
            const rowY = firstRowY + (virtualRow * rowHeight);
            ctx.fillStyle = '#0f172a';
            ctx.font = '800 12px Inter, sans-serif';
            ctx.fillText(item.label, baseX, rowY);

            ctx.strokeStyle = '#cbd5e1';
            ctx.beginPath();
            ctx.moveTo(baseX, rowY + 4);
            ctx.lineTo(baseX + (columnCount * columnWidth) - 12, rowY + 4);
            ctx.stroke();

            virtualRow += 1;
            return;
        }

        if (item.kind === 'region-gap') {
            virtualRow += 1;
            return;
        }

        const col = Math.floor(virtualRow / maxRowsPerColumn);
        const row = virtualRow % maxRowsPerColumn;
        const colX = baseX + (col * columnWidth);
        const rowY = firstRowY + (row * rowHeight);

        ctx.beginPath();
        ctx.fillStyle = item.color;
        ctx.arc(colX + 4, rowY - 3, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        const fittedName = fitLegendName(ctx, item.name, 124);
        ctx.fillText(fittedName, colX + 14, rowY);
        ctx.fillText(String(item.fte), colX + 138, rowY);
        ctx.fillText(item.municipalitiesKnown ? String(item.municipalities) : '-', colX + 170, rowY);

        virtualRow += 1;
    });

    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(baseX, outCanvas.height - 26);
    ctx.lineTo(baseX + (columnCount * columnWidth) - 12, outCanvas.height - 26);
    ctx.stroke();

    ctx.font = '700 12px Inter, sans-serif';
    ctx.fillStyle = '#334155';
    const totalText = totals.hasMunicipalityData
        ? `${totals.fte} FTE | ${totals.municipalities} obci`
        : `${totals.fte} FTE`;
    ctx.fillText('Spolu', baseX, outCanvas.height - 8);
    ctx.fillText(totalText, baseX + 68, outCanvas.height - 8);

    return outCanvas;
}

function exportMapAsPng() {
    if (currentRegionKey === 'slovakia') {
        openConfirmModal(
            'Export PNG',
            'Ste v režime celej SR. Možnosť Aktuálny kraj je neaktívna. Exportovať celú SR?',
            function (confirmed) {
                if (!confirmed) return;
                executeMapPngExport(true);
            },
            'Celá SR',
            'Zrušiť'
        );
        return;
    }

    openConfirmModal(
        'Export PNG',
        'Exportovať celé Slovensko? Celá SR alebo aktuálny kraj.',
        function (choice) {
            if (choice === null || choice === undefined) return;
            executeMapPngExport(choice === true);
        },
        'Celá SR',
        'Aktuálny kraj'
    );
}

async function executeMapPngExport(exportWhole) {
    const prevRegion = currentRegionKey; 
    let tooltipPanePreviousVisibility = '';

    try {
        if (exportWhole) {
            recenterToSlovakia(false);
        } else {
            recenterToSelectedRegion(false);
        }

        closeAllMapTooltips();
        if (map && map.getPane('tooltipPane')) {
            tooltipPanePreviousVisibility = map.getPane('tooltipPane').style.visibility || '';
            map.getPane('tooltipPane').style.visibility = 'hidden';
        }

        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await new Promise(r => setTimeout(r, 1500));
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'); 
        
        const mapEl = document.getElementById('real-tactical-map'); 
        const mapCanvas = await html2canvas(mapEl, { 
            useCORS: true, 
            logging: false, 
            scale: 2 
        });
        
        const canvas = composeExportCanvasWithLegend(mapCanvas, exportWhole);
        const dataUrl = canvas.toDataURL('image/png'); 
        const a = document.createElement('a'); 
        a.href = dataUrl; 
        a.download = `map_export_${exportWhole ? 'slovakia' : (prevRegion || 'region')}_${Date.now()}.png`; 
        document.body.appendChild(a); 
        a.click(); 
        a.remove(); 
    } catch (err) {
        console.error('Export PNG failed', err); 
        openPromptModal('Export PNG zlyhal', 'Export do PNG sa nepodaril. Skontrolujte konzolu pre chyby.', 'info');
        showToast('Export PNG zlyhal.', 'warning');
    } finally {
        if (map && map.getPane('tooltipPane')) {
            map.getPane('tooltipPane').style.visibility = tooltipPanePreviousVisibility;
        }

        currentRegionKey = prevRegion; 
        if (prevRegion === 'slovakia') recenterToSlovakia(true);
        else recenterToSelectedRegion(true);
        redrawUiAndStats(); 
    }
}

function resetModelData() {
    if (typeof canCurrentUserEditAny === 'function' && !canCurrentUserEditAny()) {
        if (typeof showToast === 'function') {
            showToast('Reset je povolený iba pre administrátora.', 'warning');
        }
        return;
    }

    openConfirmModal(
        'POZOR: FINÁLNY RESET MAPY',
        '⚠️ TÁTO AKCIA JE NEVRATNÁ! ⚠️\n\nZadaním "ÁNO" vymažete:\n• Všetky detašované pracoviská (DP)\n• Všetky priradenia okresov\n• Všetky zmeny od začiatku\n\nPokračovať?',
        function (confirmed) {
            if (!confirmed) return;

            // Second step: ask user to type confirmation
            openPromptModal(
                'Posledné potvrdenie',
                'Zadajte "ÁNO" (bez úvodzoviek) aby ste potvrdili trvalý reset mapy:',
                'text',
                '',
                function (userInput) {
                    if (userInput?.trim().toUpperCase() !== 'ÁNO') {
                        if (typeof showToast === 'function') {
                            showToast('Reset bol zrušený - text sa nezhodoval.', 'info');
                        }
                        return;
                    }

                    // Perform actual reset
                    customWorkplaces = {};
                    districtData = getDefaultDistrictData();
                    activeWorkplaceId = null;
                    actionHistory = [];
                    window.colorIndex = 0;
                    if (offlineModeActive) {
                        drawOfflineNodeMap();
                    } else if (geojsonLayer) {
                        refreshMapLayerState();
                    }
                    currentRegionKey = 'slovakia';
                    recenterToSlovakia();
                    redrawUiAndStats();

                    if (typeof scheduleSaveForAllRegions === 'function') {
                        scheduleSaveForAllRegions();
                    }

                    openPromptModal('Reset dokončený', 'Mapa bola úplne resetovaná na pôvodný stav. Všetky dáta boli vymazané.', 'info');
                    showToast('Model bol úplne resetovaný. Všetky zmeny boli ZMAZANÉ.', 'warning');
                }
            );
        },
        'Pokračovať',
        'Zrušiť'
    );
}



window.onload = async function () {
    if (typeof initFirebaseSync === 'function') {
        const synced = await initFirebaseSync();

        if (synced && typeof applyRegionLockUi === 'function') {
            applyRegionLockUi();
        }

        if (synced && typeof ensureAllRegionsInCloud === 'function') {
            await ensureAllRegionsInCloud({ reason: 'startup-init' });
        }

        if (synced && typeof loadAllRegionsFromCloud === 'function') {
            await loadAllRegionsFromCloud({ silent: true, skipRedraw: false });
        }
    }

    initModelerMap();

    if (typeof getRegionLockKey === 'function' && typeof recenterToSelectedRegion === 'function') {
        const lockedRegion = getRegionLockKey();
        if (lockedRegion) {
            recenterToSelectedRegion();
        }
    }

    redrawUiAndStats();

    if (typeof isFirebaseSyncEnabled === 'function' && isFirebaseSyncEnabled()) {
        showToast('Firebase sync je aktívny. Zmeny sa ukladajú automaticky.', 'success');
    }
};
