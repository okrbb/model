// js/map.js

function ensureRegionBorderPanes() {
    if (!map) return;

    if (!map.getPane('regionOutlinePane')) {
        map.createPane('regionOutlinePane');
        map.getPane('regionOutlinePane').style.zIndex = 420;
        map.getPane('regionOutlinePane').style.pointerEvents = 'none';
    }

    if (!map.getPane('regionBorderPane')) {
        map.createPane('regionBorderPane');
        map.getPane('regionBorderPane').style.zIndex = 430;
        map.getPane('regionBorderPane').style.pointerEvents = 'none';
    }
}

function ensureCityLabelPane() {
    if (!map) return;
    if (!map.getPane('cityLabelPane')) {
        map.createPane('cityLabelPane');
        map.getPane('cityLabelPane').style.zIndex = 610;
    }
    map.getPane('cityLabelPane').style.pointerEvents = 'none';
}

function renderCityLabels() {
    if (!map) return;
    ensureCityLabelPane();

    if (!cityLabelLayerGroup) {
        cityLabelLayerGroup = L.layerGroup().addTo(map);
    }

    cityLabelLayerGroup.clearLayers();

    const labelsByName = new Map();
    const regionalSeats = new Set(Object.values(regionMeta).map(meta => meta.seat));
    const hiddenDistrictNames = new Set([
        'Bratislava I', 'Bratislava II', 'Bratislava III', 'Bratislava IV', 'Bratislava V',
        'Košice - okolie', 'Košice I', 'Košice II', 'Košice III', 'Košice IV'
    ]);

    Object.entries(regionMeta).forEach(([key, meta]) => {
        labelsByName.set(meta.seat, { coords: meta.center, name: meta.seat });
    });

    Object.entries(districtCoordinates).forEach(([name, coords]) => {
        if (hiddenDistrictNames.has(name)) return;
        labelsByName.set(name, { coords, name });
    });

    labelsByName.forEach(({ coords, name }) => {
        const isRegionalSeat = regionalSeats.has(name);
        const icon = L.divIcon({
            className: 'map-city-dot-icon',
            html: `<div class="map-city-dot ${isRegionalSeat ? 'regional' : 'district'}"></div>`,
            iconSize: isRegionalSeat ? [8, 8] : [5, 5],
            iconAnchor: isRegionalSeat ? [4, 4] : [2.5, 2.5]
        });

        L.marker(coords, {
            icon,
            interactive: false,
            keyboard: false,
            pane: 'cityLabelPane'
        }).addTo(cityLabelLayerGroup);
    });
}

async function initModelerMap() {
    map = L.map('real-tactical-map', {
        center: [48.6690, 19.6990],
        zoom: 7.5,
        minZoom: 6.8,
        maxZoom: 11,
        scrollWheelZoom: true,
        zoomControl: false,
        preferCanvas: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    fallbackMarkerLayerGroup = L.layerGroup().addTo(map);
    renderCityLabels();

    fetchMunicipalityCounts();

    if (window.__regionsGeojson && window.__districtsGeojson) {
        drawMapLayers(window.__regionsGeojson, window.__districtsGeojson);
        return;
    }

    try {
        const [krajeRes, okresyRes] = await Promise.all([
            fetch('./data/regions_epsg_4326.geojson'),
            fetch('./data/districts_epsg_4326.geojson')
        ]);
        
        if (!krajeRes.ok || !okresyRes.ok) throw new Error("Local Fetch Failed");

        const krajeData = await krajeRes.json();
        const okresyData = await okresyRes.json();

        drawMapLayers(krajeData, okresyData);
    } catch (err) {
        console.warn("Local fetch direct retry without dot slash...");
        try {
            const [krajeFallback, okresyFallback] = await Promise.all([
                fetch('data/regions_epsg_4326.geojson'),
                fetch('data/districts_epsg_4326.geojson')
            ]);

            const krajeData = await krajeFallback.json();
            const okresyData = await okresyFallback.json();

            drawMapLayers(krajeData, okresyData);
        } catch (err2) {
            console.error("All local files blocked. Activating Node fallback...");
            activateOfflineFallbackMode();
        }
    }
}

function drawMapLayers(krajeData, okresyData) {
    offlineModeActive = false;
    document.getElementById('connection-fallback-banner').classList.add('hidden');
    if (fallbackMarkerLayerGroup) fallbackMarkerLayerGroup.clearLayers();

    if (geojsonLayer) map.removeLayer(geojsonLayer);
    if (krajeLayer) map.removeLayer(krajeLayer);
    if (krajeOutlineLayer) {
        map.removeLayer(krajeOutlineLayer);
        krajeOutlineLayer = null;
    }

    ensureRegionBorderPanes();

    geojsonLayer = L.geoJSON(okresyData, {
        style: function (feature) {
            const dName = getFeatureDistrictName(feature);
            const rawDistrictName = getRawFeatureDistrictName(feature);
            const rKey = getRegionKeyForDistrict(dName);
            const isSlovakiaMode = (currentRegionKey === 'slovakia');
            const isSelectedRegion = isSlovakiaMode ? false : (rKey === currentRegionKey);
            const hidesInnerBorder = isMergedCityDistrict(rawDistrictName);

            const buildDistrictStyle = (fillColor, fillOpacity, color, weight, opacity) => ({
                fillColor, fillOpacity,
                color: hidesInnerBorder ? fillColor : color,
                weight: hidesInnerBorder ? 0 : weight,
                opacity: hidesInnerBorder ? 0 : opacity
            });

            if (isSlovakiaMode) {
                const assignedWpId = getDistrictWorkplaceId(dName);
                if (assignedWpId && customWorkplaces[assignedWpId]) {
                    return buildDistrictStyle(customWorkplaces[assignedWpId].color, 0.45, "#000000", 0.3, 1);
                }
                return buildDistrictStyle("#e2e8f0", 0.5, "#cbd5e1", 0.3, 0.5);
            }

            if (isSelectedRegion) {
                const assignedWpId = getDistrictWorkplaceId(dName);
                if (assignedWpId && customWorkplaces[assignedWpId]) {
                    return buildDistrictStyle(customWorkplaces[assignedWpId].color, 0.45, "#000000", 0.3, 1);
                } else {
                    return buildDistrictStyle("#ffffff", 0.7, "#000000", 0.3, 1);
                }
            } else {
                return buildDistrictStyle("#e2e8f0", 0.5, "#cbd5e1", 0.3, 0.5);
            }
        },
        onEachFeature: function (feature, layer) {
            const dName = getFeatureDistrictName(feature);
            const tooltipDistrictName = getTooltipDistrictName(dName);
            const rKey = getRegionKeyForDistrict(dName);

            if (!rKey) return;

            let assignedLabel = "Nepriradené";
            const assignedWpId = getDistrictWorkplaceId(dName);
            if (assignedWpId && customWorkplaces[assignedWpId]) {
                assignedLabel = customWorkplaces[assignedWpId].name;
            }
            const fteCount = getDistrictFteValue(dName);
            const muniCountTooltip = getDistrictMunicipalityCount(dName);

            layer.bindTooltip(`
                <div class="font-sans text-xs text-left">
                    <span class="block font-extrabold text-brand-500 uppercase tracking-tight">Okres ${tooltipDistrictName}</span>
                    <span class="block text-[10px] text-slate-300 mt-0.5">Kraj: <strong class="text-white">${regionMeta[rKey]?.name || "Neznámy"}</strong></span>
                    <span class="block text-[10px] text-slate-300">Detašované prac. (DP): <strong class="text-emerald-400">${assignedLabel}</strong></span>
                    <span class="block text-[10px] text-slate-300">Sila úradu: <strong class="text-white">${fteCount} FTE</strong></span>
                    ${muniCountTooltip !== null ? `<span class="block text-[10px] text-slate-300">Mestá a obce: <strong class="text-white">${muniCountTooltip}</strong></span>` : ''}
                </div>
            `, { sticky: true, className: 'custom-map-tooltip' });

            layer.on({
                click: function (e) {
                    handleDistrictClick(dName);
                },
                mouseover: function (e) {
                    updateDistrictTooltip(layer);
                    if (currentRegionKey !== 'slovakia' && rKey === currentRegionKey) {
                        layer.setStyle({
                            color: "#f97316", weight: 0.3, fillOpacity: 0.8
                        });
                    }
                },
                mouseout: function (e) {
                    geojsonLayer.resetStyle(layer);
                }
            });
        }
    }).addTo(map);

    krajeLayer = L.geoJSON(krajeData, {
        interactive: false,
        pane: 'regionBorderPane',
        style: function (feature) {
            const rKey = getRegionKeyFromFeature(feature);
            const isSlovakiaMode = (currentRegionKey === 'slovakia');
            if (isSlovakiaMode) {
                return { color: "#ef4444", weight: 1.2, fillColor: "#0f172a", fillOpacity: 0, opacity: 1 };
            }
            const isSelected = (rKey === currentRegionKey);
            return {
                color: isSelected ? "#f97316" : "#cbd5e1",
                weight: 0.6,
                fillColor: "#0f172a",
                fillOpacity: isSelected ? 0 : 0.24,
                opacity: 1
            };
        }
    }).addTo(map);

    recenterToSlovakia();
}

function activateOfflineFallbackMode() {
    offlineModeActive = true;
    document.getElementById('connection-fallback-banner').classList.remove('hidden');
    recenterToSelectedRegion();
    redrawUiAndStats();
}

function drawOfflineNodeMap() {
    if (!offlineModeActive || !fallbackMarkerLayerGroup) return;

    fallbackMarkerLayerGroup.clearLayers();

    const districtsInRegion = districtData[currentRegionKey];
    if (!districtsInRegion) return;

    for (const dName in districtsInRegion) {
        const coords = districtCoordinates[dName] || regionMeta[currentRegionKey].center;
        const distItem = districtsInRegion[dName];
        const wpId = distItem.wpId;
        const isAssigned = wpId && customWorkplaces[wpId];
        
        const color = isAssigned ? customWorkplaces[wpId].color : "#94a3b8";
        const label = isAssigned ? customWorkplaces[wpId].name : "Nepriradené";
        const initials = isAssigned ? customWorkplaces[wpId].name.substring(0, 3).toUpperCase() : "—";

        const nodeHtml = `
            <div class="relative flex flex-col items-center justify-center pointer-events-auto cursor-pointer group">
                <span class="absolute w-14 h-14 rounded-full node-pulse-ring opacity-60" style="background-color: ${color}50; animation: pulse-node 1.8s infinite ease-out;"></span>
                
                <span class="relative flex items-center justify-center w-11 h-11 rounded-full border-2 border-white shadow-xl transition-all group-hover:scale-110" style="background-color: ${color}cc;">
                    <span class="text-white text-[11px] font-black tracking-tight">${initials}</span>
                </span>
                
                <div class="mt-1.5 whitespace-nowrap bg-white text-slate-800 border-l-4 px-2.5 py-1 rounded-lg shadow-md border-r border-t border-b border-slate-200 text-[10px] font-sans" style="border-left-color: ${color}">
                    <strong class="text-slate-800 font-bold">${dName}</strong> 
                    <span class="font-mono font-bold text-slate-500 ml-1">(${distItem.fte} FTE)</span>
                </div>
            </div>
        `;

        const markerIcon = L.divIcon({
            html: nodeHtml,
            className: 'custom-node-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        const marker = L.marker(coords, { icon: markerIcon }).addTo(fallbackMarkerLayerGroup);

        marker.bindTooltip(`
            <div class="font-sans text-xs text-left">
                <span class="block font-extrabold text-brand-500 uppercase tracking-tight">Okres ${dName}</span>
                <span class="block text-[10px] text-slate-300">Detašované prac. (DP): <strong class="text-emerald-400">${label}</strong></span>
                <span class="block text-[10px] text-slate-300">Kapacita: <strong class="text-white">${distItem.fte} FTE</strong></span>
            </div>
        `, { sticky: true, className: 'custom-map-tooltip' });

        marker.on('click', () => {
            handleDistrictClick(dName);
        });
    }
}

function recenterToSelectedRegion() {
    // If currently viewing all of Slovakia, restore the previous region
    if (currentRegionKey === 'slovakia' && previousRegionKey && previousRegionKey !== 'slovakia') {
        // Use changeRegion() to properly reload data and update UI
        const selector = document.getElementById('active-region-selector');
        if (selector) {
            selector.value = previousRegionKey;
            changeRegion(); // This will handle data loading and UI refresh
            return;
        }
    }

    if (offlineModeActive) {
        const meta = regionMeta[currentRegionKey];
        if (meta && map) {
            map.setView(meta.center, 8.5, { animate: true, duration: 1.0 });
        }
        return;
    }

    if (!geojsonLayer) return;

    let bounds = L.latLngBounds([]);
    geojsonLayer.eachLayer(layer => {
        const dName = getFeatureDistrictName(layer.feature);
        const rKey = getRegionKeyForDistrict(dName);
        if (rKey === currentRegionKey) {
            bounds.extend(layer.getBounds());
        }
    });

    if (bounds.isValid()) {
        selectedRegionBounds = bounds;
        map.fitBounds(bounds, { padding: [35, 35], animate: true, duration: 1.0 });

        geojsonLayer.eachLayer(layer => geojsonLayer.resetStyle(layer));

        if (krajeLayer) {
            krajeLayer.setStyle(function (feature) {
                const rKey = getRegionKeyFromFeature(feature);
                const isSlovakiaMode = (currentRegionKey === 'slovakia');
                if (isSlovakiaMode) {
                    return { color: "#ef4444", weight: 1.2, fillColor: "#0f172a", fillOpacity: 0, opacity: 1 };
                }
                const isSelected = (rKey === currentRegionKey);
                return {
                    color: isSelected ? "#f97316" : "#cbd5e1",
                    weight: 0.6,
                    fillColor: "#0f172a",
                    fillOpacity: isSelected ? 0 : 0.24,
                    opacity: 1
                };
            });
        }

        if (krajeOutlineLayer) {
            map.removeLayer(krajeOutlineLayer);
            krajeOutlineLayer = null;
        }
    }
}

function recenterToSlovakia() {
    if (!geojsonLayer || !map) return;

    // Save current region before switching to Slovakia view
    if (currentRegionKey !== 'slovakia') {
        previousRegionKey = currentRegionKey;
    }

    currentRegionKey = 'slovakia';
    syncRegionSelector('slovakia');

    let bounds = L.latLngBounds([]);
    geojsonLayer.eachLayer(layer => bounds.extend(layer.getBounds()));

    if (bounds.isValid()) {
        selectedRegionBounds = bounds;
        map.fitBounds(bounds, { padding: [35, 35], animate: true, duration: 1.0 });
    }

    ensureRegionBorderPanes();

    geojsonLayer.eachLayer(layer => geojsonLayer.resetStyle(layer));
    if (krajeLayer) {
        krajeLayer.setStyle(function (feature) {
            return { color: "#ef4444", weight: 1.2, fillColor: "#0f172a", fillOpacity: 0, opacity: 1 };
        });
    }

    if (!krajeOutlineLayer && krajeLayer) {
        krajeOutlineLayer = L.geoJSON(krajeLayer.toGeoJSON(), {
            interactive: false,
            pane: 'regionOutlinePane',
            style: function () {
                return { color: "#1e293b", weight: 3.2, fillColor: "#0f172a", fillOpacity: 0, opacity: 0.9 };
            }
        }).addTo(map);
    } else if (krajeOutlineLayer && !map.hasLayer(krajeOutlineLayer)) {
        krajeOutlineLayer.addTo(map);
    }

    redrawUiAndStats();
}

function updateDistrictTooltip(layer) {
    if (!layer || !layer.feature) return;
    const dName = getFeatureDistrictName(layer.feature);
    const tooltipDistrictName = getTooltipDistrictName(dName);
    const rKey = getRegionKeyForDistrict(dName);
    if (!rKey) return;

    let assignedLabel = "Nepriradené";
    const assignedWpId = getDistrictWorkplaceId(dName);
    if (assignedWpId && customWorkplaces[assignedWpId]) {
        assignedLabel = customWorkplaces[assignedWpId].name;
    }
    const fteCount = getDistrictFteValue(dName);
    const muniCountTooltip = getDistrictMunicipalityCount(dName);

    const tooltipHtml = `
        <div class="font-sans text-xs text-left">
            <span class="block font-extrabold text-brand-500 uppercase tracking-tight">Okres ${tooltipDistrictName}</span>
            <span class="block text-[10px] text-slate-300 mt-0.5">Kraj: <strong class="text-white">${regionMeta[rKey]?.name || "Neznámy"}</strong></span>
            <span class="block text-[10px] text-slate-300">Detašované prac. (DP): <strong class="text-emerald-400">${assignedLabel}</strong></span>
            <span class="block text-[10px] text-slate-300">Sila úradu: <strong class="text-white">${fteCount} FTE</strong></span>
            ${muniCountTooltip !== null ? `<span class="block text-[10px] text-slate-300">Mestá a obce: <strong class="text-white">${muniCountTooltip}</strong></span>` : ''}
        </div>
    `;

    if (layer.getTooltip && layer.getTooltip()) {
        layer.setTooltipContent(tooltipHtml);
    } else {
        layer.bindTooltip(tooltipHtml, { sticky: true, className: 'custom-map-tooltip' });
    }
}

function refreshMapLayerState() {
    if (!geojsonLayer) return;
    geojsonLayer.eachLayer(layer => {
        geojsonLayer.resetStyle(layer);
        updateDistrictTooltip(layer);
    });
}

function handleDistrictClick(districtName) {
    const rKey = getRegionKeyForDistrict(districtName);
    if (typeof canCurrentUserEditRegion === 'function' && !canCurrentUserEditRegion(rKey)) {
        showToast('Nemáte oprávnenie upravovať tento kraj.', 'warning');
        return;
    }

    if (editModeLocked) {
        showToast('Režim úprav je vypnutý.', 'warning');
        return;
    }

    if (rKey !== currentRegionKey) {
        openPromptModal(
            "Nepovolená akcia", 
            `Okres ${districtName} patrí pod ${regionMeta[rKey]?.name || "iný kraj"}. Práve modelujete ${(currentRegionKey === 'slovakia') ? 'Slovensko' : (regionMeta[currentRegionKey]?.name || 'Vybraný')}.`, 
            'info'
        );
        return;
    }

    if (!activeWorkplaceId) {
        openPromptModal(
            "Zvolte štetec DP", 
            "Najskôr kliknite na vytvorené Detašované pracovisko v ľavom paneli, čím aktivujete štetec. Potom kliknite do mapy.", 
            'info'
        );
        return;
    }

    const currentWp = getDistrictWorkplaceId(districtName);
    if (currentWp === activeWorkplaceId) {
        setDistrictWorkplaceId(districtName, null);
        addHistoryAction({
            type: 'district-assignment',
            districtName,
            previousWpId: currentWp,
            nextWpId: null
        });
        showToast(`Okres ${districtName} bol odpojený od DP.`, 'info');
    } else {
        setDistrictWorkplaceId(districtName, activeWorkplaceId);
        addHistoryAction({
            type: 'district-assignment',
            districtName,
            previousWpId: currentWp,
            nextWpId: activeWorkplaceId
        });
        const assignedName = customWorkplaces[activeWorkplaceId]?.name || 'DP';
        showToast(`Okres ${districtName} priradený do ${assignedName}.`, 'success');
    }

    if (offlineModeActive) {
        drawOfflineNodeMap();
    } else if (geojsonLayer) {
        geojsonLayer.eachLayer(layer => {
            const dName = getFeatureDistrictName(layer.feature);
            if (dName.toLowerCase().trim() === districtName.toLowerCase().trim()) {
                geojsonLayer.resetStyle(layer);
                updateDistrictTooltip(layer);
            }
        });
    }

    if (typeof scheduleRegionSave === 'function' && rKey) {
        scheduleRegionSave(rKey);
    }

    redrawUiAndStats();
}

function closeAllMapTooltips() {
    if (geojsonLayer) {
        geojsonLayer.eachLayer(layer => {
            if (layer && layer.closeTooltip) layer.closeTooltip();
        });
    }

    if (fallbackMarkerLayerGroup) {
        fallbackMarkerLayerGroup.eachLayer(layer => {
            if (layer && layer.closeTooltip) layer.closeTooltip();
        });
    }
}
