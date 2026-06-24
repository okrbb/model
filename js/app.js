// js/app.js

let currentRegionKey = "slovakia";
let previousRegionKey = "banska-bystrica"; // Saved region when viewing all of Slovakia
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
        showToast(`DP ${lastAction.workplace.name} bolo odstránené (undo).`, 'danger');
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

    if (typeof addAuditEvent === 'function') {
        addAuditEvent('undo', {
            detail: `Vrátená akcia typu ${lastAction.type || 'unknown'}.`,
            districtName: lastAction.districtName || null,
            regionKey: lastAction.workplace?.regionKey || getRegionKeyForDistrict(lastAction.districtName) || currentRegionKey
        });
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
            if (typeof redrawUiAndStats === 'function') {
                redrawUiAndStats();
            } else {
                renderRightCapacityList();
            }
            return;
        }
    }

    const localCounts = await loadMunicipalityCountsFromLocalFiles();
    if (localCounts) {
        districtMunicipalityCounts = localCounts;
        if (typeof redrawUiAndStats === 'function') {
            redrawUiAndStats();
        } else {
            renderRightCapacityList();
        }
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

function buildExportLegendGroups(exportWhole) {
    const scopeRegionKeys = exportWhole ? Object.keys(districtData) : [currentRegionKey];
    const groups = [];

    scopeRegionKeys.forEach((rKey) => {
        const groupTitle = exportWhole
            ? `kraj ${regionMeta[rKey]?.seat || regionMeta[rKey]?.name || rKey}`
            : `kraj ${regionMeta[rKey]?.name || rKey}`;

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
                    regionKey: rKey
                };
            }

            legendByWpId[wpId].fte += Number(item?.fte || 0);
            const muniCount = getDistrictMunicipalityCount(dName);
            if (muniCount !== null) {
                legendByWpId[wpId].municipalities += muniCount;
                legendByWpId[wpId].municipalitiesKnown = true;
            }
        });

        const entries = Object.values(legendByWpId).sort((a, b) => a.name.localeCompare(b.name, 'sk'));
        groups.push({
            regionKey: rKey,
            title: groupTitle,
            entries
        });
    });

    return groups;
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

function flattenLegendGroupsToRows(groups) {
    const rows = [];

    groups.forEach((group, idx) => {
        rows.push({ kind: 'region-header', label: group.title });

        if (!group.entries.length) {
            rows.push({ kind: 'empty', label: 'bez DP' });
        } else {
            group.entries.forEach((entry) => rows.push({ kind: 'entry', entry }));
        }

        if (idx < groups.length - 1) rows.push({ kind: 'gap' });
    });

    return rows;
}

function composeExportCanvasWithLegend(mapCanvas, exportWhole) {
    const groups = buildExportLegendGroups(exportWhole);
    if (!groups.length) return mapCanvas;

    if (!exportWhole) {
        // Region export: keep legend on the right, but with a wider stripe.
        const regionGroup = groups[0] || { entries: [] };
        const rows = regionGroup.entries.length
            ? regionGroup.entries.map((entry) => ({ kind: 'entry', entry }))
            : [{ kind: 'empty', label: 'bez DP' }];
        const titleHeight = 44;
        const headerHeight = 22;
        const verticalPadding = 18;
        const rowHeight = 30;
        const columnGap = 20;
        const columnWidth = 420;
        const baseInset = 24;
        const obceRightInset = 38;
        const fteObceGap = 64;

        const availableRowsHeight = mapCanvas.height - (verticalPadding * 2) - titleHeight - headerHeight - 10;
        const maxRowsPerColumn = Math.max(1, Math.floor(availableRowsHeight / rowHeight));
        const columnCount = Math.max(1, Math.ceil(rows.length / maxRowsPerColumn));
        const legendWidth = (baseInset * 2) + (columnCount * columnWidth) + ((columnCount - 1) * columnGap);

        const outCanvas = document.createElement('canvas');
        outCanvas.width = mapCanvas.width + legendWidth;
        outCanvas.height = mapCanvas.height;

        const ctx = outCanvas.getContext('2d');
        ctx.drawImage(mapCanvas, 0, 0);

        const legendX = mapCanvas.width;
        const legendY = 0;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(legendX, legendY, legendWidth, outCanvas.height);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(legendX + 0.5, 0);
        ctx.lineTo(legendX + 0.5, outCanvas.height);
        ctx.stroke();

        const scopeLabel = (regionMeta[currentRegionKey]?.name || 'AKTUALNY KRAJ').toUpperCase();
        const baseX = legendX + baseInset;
        let y = legendY + verticalPadding + 6;

        ctx.fillStyle = '#475569';
        ctx.font = '800 20px Inter, sans-serif';
        ctx.fillText(`LEGENDA DP - ${scopeLabel}`, baseX, y);
        y += titleHeight;

        ctx.fillStyle = '#64748b';
        ctx.font = '700 15px Inter, sans-serif';
        for (let col = 0; col < columnCount; col++) {
            const colX = baseX + (col * (columnWidth + columnGap));
            const obceX = colX + columnWidth - obceRightInset;
            const fteX = obceX - fteObceGap;
            ctx.fillText('DP', colX, y);
            ctx.fillText('FTE', fteX, y);
            ctx.fillText('OBCE', obceX, y);
        }

        y += 10;
        ctx.strokeStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(baseX, y);
        ctx.lineTo(baseX + (columnCount * (columnWidth + columnGap)) - columnGap, y);
        ctx.stroke();

        const firstRowY = y + 18;
        let virtualRow = 0;

        rows.forEach((rowData) => {
            const col = Math.floor(virtualRow / maxRowsPerColumn);
            const row = virtualRow % maxRowsPerColumn;
            const colX = baseX + (col * (columnWidth + columnGap));
            const rowY = firstRowY + (row * rowHeight);

            if (rowData.kind === 'region-header') {
                ctx.fillStyle = '#0f172a';
                ctx.font = '800 15px Inter, sans-serif';
                ctx.fillText(rowData.label, colX, rowY);

                ctx.strokeStyle = '#cbd5e1';
                ctx.beginPath();
                ctx.moveTo(colX, rowY + 4);
                ctx.lineTo(colX + columnWidth, rowY + 4);
                ctx.stroke();

                virtualRow += 1;
                return;
            }

            if (rowData.kind === 'gap') {
                virtualRow += 1;
                return;
            }

            if (rowData.kind === 'empty') {
                ctx.fillStyle = '#64748b';
                ctx.font = '600 17px Inter, sans-serif';
                ctx.fillText('bez DP', colX, rowY);
                virtualRow += 1;
                return;
            }

            const entry = rowData.entry;
            ctx.beginPath();
            ctx.fillStyle = entry.color;
            ctx.arc(colX + 6, rowY - 5, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#0f172a';
            ctx.font = '600 17px Inter, sans-serif';
            const obceX = colX + columnWidth - obceRightInset;
            const fteX = obceX - fteObceGap;
            const fittedName = fitLegendName(ctx, entry.name, columnWidth - (obceRightInset + 110));
            ctx.fillText(fittedName, colX + 20, rowY);
            ctx.fillText(String(entry.fte), fteX, rowY);
            ctx.fillText(entry.municipalitiesKnown ? String(entry.municipalities) : '-', obceX, rowY);

            virtualRow += 1;
        });

        ctx.textAlign = 'left';
        return outCanvas;
    }

    // Slovakia export: fixed side legends (left/right) with map in the center.
    const groupByKey = new Map(groups.map((group) => [group.regionKey, group]));
    const orderedLeft = ['bratislavsky', 'trnava', 'nitra', 'trencin'];
    const orderedRight = ['banska-bystrica', 'zilina', 'kosice', 'presov'];

    const ensureGroup = (regionKey) => {
        if (groupByKey.has(regionKey)) return groupByKey.get(regionKey);
        const fallbackTitle = `kraj ${regionMeta[regionKey]?.seat || regionMeta[regionKey]?.name || regionKey}`;
        return { regionKey, title: fallbackTitle, entries: [] };
    };

    const leftGroups = orderedLeft.map(ensureGroup);
    const rightGroups = orderedRight.map(ensureGroup);

    const panelPadding = 16;
    const sideTitleHeight = 24;
    const sideTitleGap = 12;
    const panelColumnGap = 14;
    const panelRowGap = 14;
    const cardInnerPaddingX = 10;
    const cardInnerPaddingY = 10;
    const cardHeaderHeight = 20;
    const cardColumnsHeaderHeight = 17;
    const cardRowHeight = 20;

    const panelWidth = Math.max(520, Math.floor(mapCanvas.width * 0.48));
    const cardWidth = Math.floor((panelWidth - (panelPadding * 2) - panelColumnGap) / 2);
    const cardAreaTop = panelPadding + sideTitleHeight + sideTitleGap;
    const cardHeight = Math.floor((mapCanvas.height - cardAreaTop - panelPadding - panelRowGap) / 2);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = mapCanvas.width + (panelWidth * 2);
    outCanvas.height = mapCanvas.height;

    const ctx = outCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);

    const leftPanelX = 0;
    const mapX = panelWidth;
    const rightPanelX = panelWidth + mapCanvas.width;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(leftPanelX, 0, panelWidth, outCanvas.height);
    ctx.fillRect(rightPanelX, 0, panelWidth, outCanvas.height);
    ctx.drawImage(mapCanvas, mapX, 0);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mapX + 0.5, 0);
    ctx.lineTo(mapX + 0.5, outCanvas.height);
    ctx.moveTo(rightPanelX + 0.5, 0);
    ctx.lineTo(rightPanelX + 0.5, outCanvas.height);
    ctx.stroke();

    const drawPanel = (panelX, panelTitle, panelGroups) => {
        ctx.fillStyle = '#475569';
        ctx.font = '800 17px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(panelTitle, panelX + panelPadding, panelPadding + 16);

        panelGroups.forEach((group, idx) => {
            const gridCol = idx % 2;
            const gridRow = Math.floor(idx / 2);
            const cardX = panelX + panelPadding + (gridCol * (cardWidth + panelColumnGap));
            const cardY = cardAreaTop + (gridRow * (cardHeight + panelRowGap));

            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

            const titleY = cardY + cardInnerPaddingY + 12;
            const lineY = titleY + 5;
            const headerY = titleY + cardHeaderHeight;
            const bodyStartY = headerY + 6;

            ctx.fillStyle = '#0f172a';
            ctx.font = '800 14px Inter, sans-serif';
            ctx.fillText(group.title, cardX + cardInnerPaddingX, titleY);

            ctx.strokeStyle = '#cbd5e1';
            ctx.beginPath();
            ctx.moveTo(cardX + cardInnerPaddingX, lineY);
            ctx.lineTo(cardX + cardWidth - cardInnerPaddingX, lineY);
            ctx.stroke();

            const availableEntriesHeight = Math.max(1, cardHeight - (bodyStartY - cardY) - cardInnerPaddingY);
            const rowsInsideDefault = Math.max(1, Math.floor(availableEntriesHeight / cardRowHeight));
            const entryCount = Math.max(1, group.entries.length);
            const innerColumnGap = 12;
            const compactSingleColumn = entryCount > rowsInsideDefault;
            const effectiveRowHeight = compactSingleColumn
                ? Math.max(13, Math.floor(availableEntriesHeight / entryCount))
                : cardRowHeight;
            const rowsInside = compactSingleColumn ? entryCount : rowsInsideDefault;
            const columnsInside = compactSingleColumn ? 1 : Math.max(1, Math.ceil(entryCount / rowsInside));
            const innerColWidth = Math.floor((cardWidth - (cardInnerPaddingX * 2) - ((columnsInside - 1) * innerColumnGap)) / columnsInside);

            ctx.fillStyle = '#64748b';
            ctx.font = '700 12px Inter, sans-serif';
            for (let c = 0; c < columnsInside; c++) {
                const colX = cardX + cardInnerPaddingX + (c * (innerColWidth + innerColumnGap));
                const obceX = colX + innerColWidth - 52;
                const fteX = obceX - 46;
                ctx.fillText('DP', colX, headerY);
                ctx.fillText('FTE', fteX, headerY);
                ctx.fillText('OBCE', obceX, headerY);
            }

            const bodyFontPx = compactSingleColumn ? (effectiveRowHeight <= 14 ? 11 : 12) : 13;
            ctx.font = `600 ${bodyFontPx}px Inter, sans-serif`;
            if (!group.entries.length) {
                ctx.fillStyle = '#64748b';
                ctx.fillText('bez DP', cardX + cardInnerPaddingX, bodyStartY + effectiveRowHeight);
                return;
            }

            group.entries.forEach((entry, entryIndex) => {
                const col = Math.floor(entryIndex / rowsInside);
                const row = entryIndex % rowsInside;
                const colX = cardX + cardInnerPaddingX + (col * (innerColWidth + innerColumnGap));
                const rowY = bodyStartY + ((row + 1) * effectiveRowHeight);
                const obceX = colX + innerColWidth - 52;
                const fteX = obceX - 46;

                ctx.beginPath();
                ctx.fillStyle = entry.color;
                const dotRadius = compactSingleColumn ? 4 : 5;
                ctx.arc(colX + 5, rowY - 4, dotRadius, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#0f172a';
                const nameMaxWidth = Math.max(60, fteX - (colX + 34));
                const fittedName = fitLegendName(ctx, entry.name, nameMaxWidth);
                ctx.fillText(fittedName, colX + 16, rowY);
                ctx.fillText(String(entry.fte), fteX, rowY);
                ctx.fillText(entry.municipalitiesKnown ? String(entry.municipalities) : '-', obceX, rowY);
            });
        });
    };

    drawPanel(leftPanelX, 'LEGENDA DP - ZÁPAD/STRED', leftGroups);
    drawPanel(rightPanelX, 'LEGENDA DP - STRED/VÝCHOD', rightGroups);

    ctx.textAlign = 'left';
    return outCanvas;
}

function cropCanvasBottom(sourceCanvas, pixelsToCrop) {
    const cropPx = Math.max(0, Math.floor(Number(pixelsToCrop) || 0));
    if (!cropPx) return sourceCanvas;

    const targetHeight = Math.max(1, sourceCanvas.height - cropPx);
    if (targetHeight === sourceCanvas.height) return sourceCanvas;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = sourceCanvas.width;
    croppedCanvas.height = targetHeight;

    const croppedCtx = croppedCanvas.getContext('2d');
    croppedCtx.drawImage(
        sourceCanvas,
        0,
        0,
        sourceCanvas.width,
        targetHeight,
        0,
        0,
        sourceCanvas.width,
        targetHeight
    );

    return croppedCanvas;
}

function cropCanvasRect(sourceCanvas, sourceX, sourceY, sourceWidth, sourceHeight) {
    const sx = Math.max(0, Math.floor(Number(sourceX) || 0));
    const sy = Math.max(0, Math.floor(Number(sourceY) || 0));
    const requestedW = Math.max(1, Math.floor(Number(sourceWidth) || 1));
    const requestedH = Math.max(1, Math.floor(Number(sourceHeight) || 1));

    const maxW = Math.max(1, sourceCanvas.width - sx);
    const maxH = Math.max(1, sourceCanvas.height - sy);
    const sw = Math.max(1, Math.min(requestedW, maxW));
    const sh = Math.max(1, Math.min(requestedH, maxH));

    if (sx === 0 && sy === 0 && sw === sourceCanvas.width && sh === sourceCanvas.height) {
        return sourceCanvas;
    }

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = sw;
    croppedCanvas.height = sh;

    const croppedCtx = croppedCanvas.getContext('2d');
    croppedCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

    return croppedCanvas;
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
        
        const exportScale = 2;
        const mapEl = document.getElementById('real-tactical-map'); 
        const mapCanvas = await html2canvas(mapEl, { 
            useCORS: true, 
            logging: false, 
            scale: exportScale 
        });

        let cropBottomPx = 0;
        const attributionEl = mapEl?.querySelector('.leaflet-control-attribution');
        if (mapEl && attributionEl) {
            const mapRect = mapEl.getBoundingClientRect();
            const attributionRect = attributionEl.getBoundingClientRect();
            const attributionOverlap = Math.max(0, (mapRect.bottom - attributionRect.top) + 2);
            cropBottomPx = Math.ceil(attributionOverlap * exportScale);
        }

        let croppedMapCanvas = cropCanvasBottom(mapCanvas, cropBottomPx);

        if (exportWhole && geojsonLayer && mapEl) {
            const skBounds = L.latLngBounds([]);
            geojsonLayer.eachLayer((layer) => skBounds.extend(layer.getBounds()));

            if (skBounds.isValid()) {
                const nw = map.latLngToContainerPoint(skBounds.getNorthWest());
                const se = map.latLngToContainerPoint(skBounds.getSouthEast());
                const padPx = 18;

                const left = Math.max(0, Math.floor(Math.min(nw.x, se.x) - padPx));
                const top = Math.max(0, Math.floor(Math.min(nw.y, se.y) - padPx));
                const right = Math.min(mapEl.clientWidth, Math.ceil(Math.max(nw.x, se.x) + padPx));
                const bottom = Math.min(mapEl.clientHeight, Math.ceil(Math.max(nw.y, se.y) + padPx));

                const cropW = Math.max(1, right - left);
                const cropH = Math.max(1, bottom - top);

                croppedMapCanvas = cropCanvasRect(
                    croppedMapCanvas,
                    Math.round(left * exportScale),
                    Math.round(top * exportScale),
                    Math.round(cropW * exportScale),
                    Math.round(cropH * exportScale)
                );
            }
        }
        
        const canvas = composeExportCanvasWithLegend(croppedMapCanvas, exportWhole);
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

                    if (typeof addAuditEvent === 'function') {
                        addAuditEvent('reset-model', {
                            detail: 'Kompletný reset modelu potvrdený a vykonaný.',
                            regionKey: 'slovakia'
                        });
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
    const colorRepairStorageKey = 'workplace-color-repair-v1-complete';

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

        if (synced && typeof repairDuplicateWorkplaceColors === 'function') {
            let shouldRunColorRepair = true;
            try {
                shouldRunColorRepair = localStorage.getItem(colorRepairStorageKey) !== '1';
            } catch (err) {
                // If storage is unavailable, run repair once for this page load.
                shouldRunColorRepair = true;
            }

            if (shouldRunColorRepair) {
                const repair = repairDuplicateWorkplaceColors();
                if (repair.changedCount > 0) {
                    if (typeof saveRegionImmediately === 'function') {
                        await Promise.all(repair.touchedRegions.map((regionKey) => saveRegionImmediately(regionKey)));
                    } else if (typeof scheduleRegionSave === 'function') {
                        repair.touchedRegions.forEach((regionKey) => scheduleRegionSave(regionKey));
                    }
                    showToast(`Jednorazový repair farieb dokončený (${repair.changedCount} DP).`, 'info');
                }

                try {
                    localStorage.setItem(colorRepairStorageKey, '1');
                } catch (err) {
                    // Non-fatal: repair will run again on next load if storage is blocked.
                }
            }
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
