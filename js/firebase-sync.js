// Firebase region sync layer with graceful fallback when config is missing.

const firebaseSyncState = {
    enabled: false,
    db: null,
    options: {
        collectionName: 'okr_region_models',
        districtMetaCollectionName: 'district_meta',
        autoSaveMs: 1000,
        regionLock: null,
        clientId: `web-${Math.random().toString(36).slice(2, 8)}`
    },
    saveTimers: {},
    saveInFlight: {}
};

const FIREBASE_DATASET_SEED_VERSION = 1;

function getFirebaseConfigFromWindow() {
    return window.FIREBASE_CONFIG || null;
}

function hasUsableFirebaseConfig(cfg) {
    if (!cfg) return false;
    return Boolean(cfg.apiKey && cfg.projectId && cfg.appId);
}

function mergeFirebaseOptions(customOptions) {
    firebaseSyncState.options = {
        ...firebaseSyncState.options,
        ...(customOptions || {})
    };
}

function getRegionLockKey() {
    return firebaseSyncState.options.regionLock || null;
}

function getAllowedRegionKeys() {
    const lock = getRegionLockKey();
    if (lock) return [lock];
    return Object.keys(regionMeta || {});
}

function isFirebaseSyncEnabled() {
    return firebaseSyncState.enabled;
}

function getFirebaseDatasetSeedVersion() {
    return FIREBASE_DATASET_SEED_VERSION;
}

function getRegionDocRef(regionKey) {
    return firebaseSyncState.db
        .collection(firebaseSyncState.options.collectionName)
        .doc(regionKey);
}

function getDistrictMetaCollectionRef() {
    return firebaseSyncState.db.collection(firebaseSyncState.options.districtMetaCollectionName);
}

function encodeDistrictMetaDocId(norm) {
    return String(norm || '').replace(/\s+/g, '_');
}

function decodeDistrictMetaDocId(docId) {
    return String(docId || '').replace(/_/g, ' ');
}

function buildRegionPayload(regionKey) {
    const defaultDistricts = (getDefaultDistrictData()[regionKey] || {});
    const regionDistricts = districtData[regionKey] || defaultDistricts;

    const districts = {};
    Object.entries(regionDistricts).forEach(([districtName, value]) => {
        districts[districtName] = {
            fte: Number(value?.fte || 0),
            wpId: value?.wpId || null
        };
    });

    const workplaces = {};
    Object.values(customWorkplaces || {})
        .filter(wp => wp.regionKey === regionKey)
        .forEach(wp => {
            workplaces[wp.id] = {
                id: wp.id,
                name: wp.name,
                color: wp.color,
                regionKey: wp.regionKey
            };
        });

    return {
        regionKey,
        districts,
        workplaces,
        datasetSeedVersion: FIREBASE_DATASET_SEED_VERSION,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: firebaseSyncState.options.clientId
    };
}



function applyRegionPayload(regionKey, payload) {
    const defaultDistricts = getDefaultDistrictData()[regionKey] || {};
    const payloadDistricts = payload?.districts || {};

    districtData[regionKey] = {};

    // Keep missing districts from defaults and override by cloud data.
    Object.entries(defaultDistricts).forEach(([districtName, value]) => {
        districtData[regionKey][districtName] = {
            fte: Number(value?.fte || 0),
            wpId: value?.wpId || null
        };
    });

    Object.entries(payloadDistricts).forEach(([districtName, value]) => {
        districtData[regionKey][districtName] = {
            fte: Number(value?.fte || 0),
            wpId: value?.wpId || null
        };
    });

    // Remove existing workplaces for this region, then re-attach from cloud.
    Object.keys(customWorkplaces).forEach((wpId) => {
        if (customWorkplaces[wpId]?.regionKey === regionKey) {
            delete customWorkplaces[wpId];
        }
    });

    Object.values(payload?.workplaces || {}).forEach((wp) => {
        if (!wp?.id) return;
        customWorkplaces[wp.id] = {
            id: wp.id,
            name: wp.name || wp.id,
            color: wp.color || '#3b82f6',
            regionKey: regionKey
        };
    });

    if (activeWorkplaceId && !customWorkplaces[activeWorkplaceId]) {
        activeWorkplaceId = null;
    }
}

async function saveRegionToCloud(regionKey) {
    if (!isFirebaseSyncEnabled()) return;
    if (!regionKey || regionKey === 'slovakia') return;

    const lock = getRegionLockKey();
    if (lock && regionKey !== lock) return;

    if (firebaseSyncState.saveInFlight[regionKey]) return;

    try {
        firebaseSyncState.saveInFlight[regionKey] = true;
        const payload = buildRegionPayload(regionKey);
        await getRegionDocRef(regionKey).set(payload, { merge: true });
    } catch (err) {
        console.error('Firebase save failed for region', regionKey, err);
        if (typeof showToast === 'function') {
            showToast(`Firebase save zlyhal pre kraj ${regionMeta[regionKey]?.seat || regionKey}.`, 'warning');
        }
    } finally {
        firebaseSyncState.saveInFlight[regionKey] = false;
    }
}

function scheduleRegionSave(regionKey) {
    if (!isFirebaseSyncEnabled()) return;
    if (!regionKey || regionKey === 'slovakia') return;

    const lock = getRegionLockKey();
    if (lock && regionKey !== lock) return;

    if (firebaseSyncState.saveTimers[regionKey]) {
        clearTimeout(firebaseSyncState.saveTimers[regionKey]);
    }

    firebaseSyncState.saveTimers[regionKey] = setTimeout(() => {
        delete firebaseSyncState.saveTimers[regionKey];
        saveRegionToCloud(regionKey);
    }, Number(firebaseSyncState.options.autoSaveMs || 1000));
}

function scheduleSaveForAllRegions() {
    if (!isFirebaseSyncEnabled()) return;
    getAllowedRegionKeys().forEach((regionKey) => scheduleRegionSave(regionKey));
}

async function flushPendingRegionSaves() {
    const pendingKeys = Object.keys(firebaseSyncState.saveTimers);
    pendingKeys.forEach((regionKey) => {
        clearTimeout(firebaseSyncState.saveTimers[regionKey]);
        delete firebaseSyncState.saveTimers[regionKey];
    });

    await Promise.all(getAllowedRegionKeys().map((regionKey) => saveRegionToCloud(regionKey)));
}

async function loadRegionFromCloud(regionKey, options = {}) {
    if (!isFirebaseSyncEnabled()) return false;
    if (!regionKey || regionKey === 'slovakia') return false;

    const lock = getRegionLockKey();
    if (lock && regionKey !== lock) return false;

    try {
        const doc = await getRegionDocRef(regionKey).get();
        if (!doc.exists) return false;

        applyRegionPayload(regionKey, doc.data());

        if (!options.skipRedraw && typeof redrawUiAndStats === 'function') {
            redrawUiAndStats();
        }

        if (!options.silent && typeof showToast === 'function') {
            showToast(`Kraj ${regionMeta[regionKey]?.seat || regionKey} načítaný z Firebase.`, 'info');
        }

        return true;
    } catch (err) {
        console.error('Firebase load failed for region', regionKey, err);
        if (!options.silent && typeof showToast === 'function') {
            showToast(`Firebase load zlyhal pre kraj ${regionMeta[regionKey]?.seat || regionKey}.`, 'warning');
        }
        return false;
    }
}

async function loadAllRegionsFromCloud(options = {}) {
    if (!isFirebaseSyncEnabled()) return false;

    const keys = getAllowedRegionKeys();
    for (const regionKey of keys) {
        await loadRegionFromCloud(regionKey, { ...options, skipRedraw: true, silent: true });
    }

    if (!options.skipRedraw && typeof redrawUiAndStats === 'function') {
        redrawUiAndStats();
    }

    return true;
}

async function ensureRegionInCloud(regionKey, options = {}) {
    if (!isFirebaseSyncEnabled()) return false;
    if (!regionKey || regionKey === 'slovakia') return false;

    const lock = getRegionLockKey();
    if (lock && regionKey !== lock) return false;

    const force = Boolean(options.force);
    const reason = options.reason || (force ? 'manual-reseed' : 'auto-init');

    try {
        const doc = await getRegionDocRef(regionKey).get();

        if (!doc.exists) {
            const payload = buildRegionPayload(regionKey);
            payload.datasetInitializedAt = firebase.firestore.FieldValue.serverTimestamp();
            payload.datasetInitReason = reason;
            await getRegionDocRef(regionKey).set(payload, { merge: true });
            return true;
        }

        const docData = doc.data() || {};
        if (force) {
            applyRegionPayload(regionKey, docData);

            const payload = buildRegionPayload(regionKey);
            if (!docData.datasetInitializedAt) {
                payload.datasetInitializedAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            payload.datasetInitReason = reason;
            await getRegionDocRef(regionKey).set(payload, { merge: true });
            return true;
        }

        return false;
    } catch (err) {
        console.error('Firebase ensure region failed', regionKey, err);
        return false;
    }
}

async function ensureAllRegionsInCloud(options = {}) {
    if (!isFirebaseSyncEnabled()) {
        return {
            changedCount: 0,
            totalRegions: 0,
            seedVersion: FIREBASE_DATASET_SEED_VERSION,
            forced: Boolean(options.force)
        };
    }

    let changedCount = 0;
    const keys = getAllowedRegionKeys();
    for (const regionKey of keys) {
        const changed = await ensureRegionInCloud(regionKey, options);
        if (changed) changedCount += 1;
    }

    return {
        changedCount,
        totalRegions: keys.length,
        seedVersion: FIREBASE_DATASET_SEED_VERSION,
        forced: Boolean(options.force)
    };
}

async function loadDistrictMetaFromCloud(options = {}) {
    if (!isFirebaseSyncEnabled()) {
        return { loaded: false, counts: {}, source: 'local' };
    }

    try {
        const snapshot = await getDistrictMetaCollectionRef().get();
        const counts = {};

        snapshot.forEach((doc) => {
            const data = doc.data() || {};
            const norm = data.norm || decodeDistrictMetaDocId(doc.id);
            const value = Number(data.municipalityCount);
            if (!norm || Number.isNaN(value)) return;
            counts[norm] = value;
        });

        if (!options.silent && typeof showToast === 'function' && Object.keys(counts).length > 0) {
            showToast(`Počty obcí načítané z Firebase (${Object.keys(counts).length} okresov).`, 'info');
        }

        return {
            loaded: Object.keys(counts).length > 0,
            counts,
            source: 'cloud'
        };
    } catch (err) {
        console.error('Firebase district_meta load failed', err);
        return { loaded: false, counts: {}, source: 'cloud-error' };
    }
}

async function backfillDistrictMetaToCloud(counts, options = {}) {
    if (!isFirebaseSyncEnabled()) {
        return { updated: 0, total: 0, skipped: true };
    }

    if (!firebaseSyncState.options.autoBackfillDistrictMeta && !options.force) {
        return { updated: 0, total: 0, skipped: true };
    }

    const entries = Object.entries(counts || {});
    if (!entries.length) {
        return { updated: 0, total: 0, skipped: true };
    }

    const force = Boolean(options.force);
    let updated = 0;

    try {
        if (!force) {
            const existing = await getDistrictMetaCollectionRef().get();
            const existingByNorm = new Set();
            existing.forEach((doc) => {
                const data = doc.data() || {};
                const norm = data.norm || decodeDistrictMetaDocId(doc.id);
                if (norm) existingByNorm.add(norm);
            });

            const missingOnly = entries.filter(([norm]) => !existingByNorm.has(norm));
            if (!missingOnly.length) {
                return { updated: 0, total: entries.length, skipped: true };
            }

            for (let i = 0; i < missingOnly.length; i += 400) {
                const chunk = missingOnly.slice(i, i + 400);
                const batch = firebaseSyncState.db.batch();
                chunk.forEach(([norm, municipalityCount]) => {
                    const docRef = getDistrictMetaCollectionRef().doc(encodeDistrictMetaDocId(norm));
                    batch.set(docRef, {
                        norm,
                        municipalityCount: Number(municipalityCount || 0),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedBy: firebaseSyncState.options.clientId,
                        source: options.source || 'local-file-backfill'
                    }, { merge: true });
                    updated += 1;
                });
                await batch.commit();
            }

            return { updated, total: entries.length, skipped: false };
        }

        for (let i = 0; i < entries.length; i += 400) {
            const chunk = entries.slice(i, i + 400);
            const batch = firebaseSyncState.db.batch();
            chunk.forEach(([norm, municipalityCount]) => {
                const docRef = getDistrictMetaCollectionRef().doc(encodeDistrictMetaDocId(norm));
                batch.set(docRef, {
                    norm,
                    municipalityCount: Number(municipalityCount || 0),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: firebaseSyncState.options.clientId,
                    source: options.source || 'local-file-backfill'
                }, { merge: true });
                updated += 1;
            });
            await batch.commit();
        }

        return { updated, total: entries.length, skipped: false };
    } catch (err) {
        console.error('Firebase district_meta backfill failed', err);
        return { updated: 0, total: entries.length, skipped: true, error: true };
    }
}

function applyRegionLockUi() {
    const lock = getRegionLockKey();
    if (!lock) return;

    currentRegionKey = lock;

    const selector = document.getElementById('active-region-selector');
    if (selector) {
        selector.value = lock;
        selector.disabled = true;
        selector.classList.add('opacity-70', 'cursor-not-allowed');
    }
}

async function initFirebaseSync() {
    mergeFirebaseOptions(window.FIREBASE_SYNC_OPTIONS || {});

    const cfg = getFirebaseConfigFromWindow();
    if (!hasUsableFirebaseConfig(cfg)) {
        firebaseSyncState.enabled = false;
        return false;
    }

    try {
        if (!window.firebase || !firebase.initializeApp || !firebase.firestore) {
            firebaseSyncState.enabled = false;
            return false;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(cfg);
        }

        firebaseSyncState.db = firebase.firestore();
        firebaseSyncState.enabled = true;

        window.addEventListener('beforeunload', function () {
            flushPendingRegionSaves();
        });

        return true;
    } catch (err) {
        console.error('Firebase init failed', err);
        firebaseSyncState.enabled = false;
        return false;
    }
}

window.initFirebaseSync = initFirebaseSync;
window.isFirebaseSyncEnabled = isFirebaseSyncEnabled;
window.loadRegionFromCloud = loadRegionFromCloud;
window.loadAllRegionsFromCloud = loadAllRegionsFromCloud;
window.scheduleRegionSave = scheduleRegionSave;
window.scheduleSaveForAllRegions = scheduleSaveForAllRegions;
window.flushPendingRegionSaves = flushPendingRegionSaves;
window.applyRegionLockUi = applyRegionLockUi;
window.getRegionLockKey = getRegionLockKey;
window.ensureRegionInCloud = ensureRegionInCloud;
window.ensureAllRegionsInCloud = ensureAllRegionsInCloud;
window.getFirebaseDatasetSeedVersion = getFirebaseDatasetSeedVersion;
window.loadDistrictMetaFromCloud = loadDistrictMetaFromCloud;
