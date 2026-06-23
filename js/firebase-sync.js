// Firebase region sync layer with graceful fallback when config is missing.

const firebaseSyncState = {
    enabled: false,
    db: null,
    auth: null,
    options: {
        collectionName: 'okr_region_models',
        districtMetaCollectionName: 'district_meta',
        autoSaveMs: 1000,
        regionLock: null,
        clientId: `web-${Math.random().toString(36).slice(2, 8)}`
    },
    authOptions: {
        enabled: true,
        requireSignIn: false,
        provider: 'google',
        defaultRole: 'viewer',
        claimRoleKey: 'role',
        claimRegionKey: 'regionKey'
    },
    access: {
        initialized: false,
        user: null,
        role: 'viewer',
        regionKey: null,
        isAuthenticated: false,
        canEditAny: false
    },
    accessListeners: [],
    saveTimers: {},
    saveInFlight: {},
    saveQueued: {}
};

const FIREBASE_DATASET_SEED_VERSION = 1;
const ACCESS_ROLES = {
    ADMIN: 'admin',
    REGION_EDITOR: 'region_editor',
    VIEWER: 'viewer'
};

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

function mergeFirebaseAuthOptions(customOptions) {
    firebaseSyncState.authOptions = {
        ...firebaseSyncState.authOptions,
        ...(customOptions || {})
    };
}

function normalizeAccessRole(rawRole) {
    const role = String(rawRole || '').trim().toLowerCase();
    if (role === ACCESS_ROLES.ADMIN) return ACCESS_ROLES.ADMIN;
    if (role === ACCESS_ROLES.REGION_EDITOR) return ACCESS_ROLES.REGION_EDITOR;
    return ACCESS_ROLES.VIEWER;
}

function computeAccessContext(user, claims = {}) {
    const roleKey = firebaseSyncState.authOptions.claimRoleKey || 'role';
    const regionKeyField = firebaseSyncState.authOptions.claimRegionKey || 'regionKey';
    const fallbackRole = firebaseSyncState.authOptions.defaultRole || ACCESS_ROLES.VIEWER;

    const role = normalizeAccessRole(claims[roleKey] || fallbackRole);
    const regionKey = claims[regionKeyField] ? String(claims[regionKeyField]) : null;

    return {
        initialized: true,
        user: user || null,
        uid: user?.uid || null,
        email: user?.email || null,
        role,
        regionKey,
        isAuthenticated: Boolean(user),
        canEditAny: role === ACCESS_ROLES.ADMIN
    };
}

function notifyAccessListeners() {
    firebaseSyncState.accessListeners.forEach((cb) => {
        try {
            cb({ ...firebaseSyncState.access });
        } catch (err) {
            console.warn('Access listener failed', err);
        }
    });
}

function setAccessContext(user, claims = {}) {
    firebaseSyncState.access = computeAccessContext(user, claims);
    notifyAccessListeners();
}

function getCurrentAccessContext() {
    return { ...firebaseSyncState.access };
}

function canCurrentUserEditAny() {
    return firebaseSyncState.access.role === ACCESS_ROLES.ADMIN;
}

function canCurrentUserEditRegion(regionKey) {
    const role = firebaseSyncState.access.role;
    if (role === ACCESS_ROLES.ADMIN) return true;
    if (role !== ACCESS_ROLES.REGION_EDITOR) return false;
    if (!regionKey || regionKey === 'slovakia') return false;
    return firebaseSyncState.access.regionKey === regionKey;
}

function getAccessRegionLockKey() {
    if (firebaseSyncState.access.role === ACCESS_ROLES.REGION_EDITOR && firebaseSyncState.access.regionKey) {
        return firebaseSyncState.access.regionKey;
    }
    return null;
}

function getRegionLockKey() {
    return getAccessRegionLockKey() || firebaseSyncState.options.regionLock || null;
}

function getAllowedRegionKeys() {
    const lock = getRegionLockKey();
    if (lock) return [lock];
    return Object.keys(regionMeta || {});
}

function isFirebaseSyncEnabled() {
    return firebaseSyncState.enabled;
}

function isFirebaseAuthEnabled() {
    return Boolean(firebaseSyncState.authOptions.enabled);
}

function shouldBlockWritesForAuth() {
    if (!isFirebaseAuthEnabled()) return false;
    if (firebaseSyncState.authOptions.requireSignIn && !firebaseSyncState.access.isAuthenticated) return true;
    return false;
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

function getUsersCollectionRef() {
    return firebaseSyncState.db.collection('users');
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

    // Process payload districts with normalization and merging for merged cities (Bratislava, Košice)
    Object.entries(payloadDistricts).forEach(([districtName, value]) => {
        const canonicalName = getCanonicalDistrictName(districtName);
        const targetName = canonicalName;
        
        // Keep existing wpId if it's already set (from defaults), otherwise use payload's wpId
        const existingEntry = districtData[regionKey][targetName];
        let wpIdToUse = existingEntry?.wpId || value?.wpId || null;
        
        // FIX: For bratislavsky region, reset all wpId to null to fix corruption
        if (regionKey === 'bratislavsky') {
            wpIdToUse = null;
        }
        
        districtData[regionKey][targetName] = {
            fte: Number(value?.fte || 0),
            wpId: wpIdToUse
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
    if (shouldBlockWritesForAuth()) return;
    if (!canCurrentUserEditRegion(regionKey)) return;

    const lock = getRegionLockKey();
    if (lock && regionKey !== lock) return;

    if (firebaseSyncState.saveInFlight[regionKey]) {
        firebaseSyncState.saveQueued[regionKey] = true;
        return;
    }

    try {
        firebaseSyncState.saveInFlight[regionKey] = true;
        const payload = buildRegionPayload(regionKey);
        const docRef = getRegionDocRef(regionKey);

        // Use update to replace map fields (districts/workplaces) as a whole.
        // merge:true recursively merges nested maps and can keep deleted workplace keys alive.
        try {
            await docRef.update(payload);
        } catch (updateErr) {
            if (updateErr?.code === 'not-found') {
                await docRef.set(payload, { merge: false });
            } else {
                throw updateErr;
            }
        }
    } catch (err) {
        console.error('Firebase save failed for region', regionKey, err);
        if (typeof showToast === 'function') {
            showToast(`Firebase save zlyhal pre kraj ${regionMeta[regionKey]?.seat || regionKey}.`, 'warning');
        }
    } finally {
        firebaseSyncState.saveInFlight[regionKey] = false;
        if (firebaseSyncState.saveQueued[regionKey]) {
            delete firebaseSyncState.saveQueued[regionKey];
            setTimeout(() => {
                saveRegionToCloud(regionKey);
            }, 0);
        }
    }
}

function scheduleRegionSave(regionKey) {
    if (!isFirebaseSyncEnabled()) return;
    if (!regionKey || regionKey === 'slovakia') return;
    if (shouldBlockWritesForAuth()) return;
    if (!canCurrentUserEditRegion(regionKey)) return;

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

function saveRegionImmediately(regionKey) {
    if (!isFirebaseSyncEnabled()) return Promise.resolve();
    if (!regionKey || regionKey === 'slovakia') return Promise.resolve();

    if (firebaseSyncState.saveTimers[regionKey]) {
        clearTimeout(firebaseSyncState.saveTimers[regionKey]);
        delete firebaseSyncState.saveTimers[regionKey];
    }

    return saveRegionToCloud(regionKey);
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

    // Sync colorIndex after all regions are loaded
    if (typeof colorPalette !== 'undefined' && colorPalette.length > 0) {
        let maxUsedIndex = -1;
        Object.values(customWorkplaces).forEach((wp) => {
            if (wp?.color) {
                const idx = colorPalette.indexOf(wp.color);
                if (idx > maxUsedIndex) {
                    maxUsedIndex = idx;
                }
            }
        });
        if (typeof window !== 'undefined' && 'colorIndex' in window) {
            window.colorIndex = maxUsedIndex + 1;
        }
    }

    if (!options.skipRedraw && typeof redrawUiAndStats === 'function') {
        redrawUiAndStats();
    }

    return true;
}

async function ensureRegionInCloud(regionKey, options = {}) {
    if (!isFirebaseSyncEnabled()) return false;
    if (!regionKey || regionKey === 'slovakia') return false;
    if (shouldBlockWritesForAuth()) return false;
    if (!canCurrentUserEditRegion(regionKey)) return false;

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

    if (!canCurrentUserEditAny()) {
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
    const selector = document.getElementById('active-region-selector');
    if (selector && lock) {
        const needsRegionSwitch = currentRegionKey !== lock;
        selector.value = lock;
        selector.disabled = true;
        selector.classList.add('opacity-70', 'cursor-not-allowed');
        currentRegionKey = lock;

        if (needsRegionSwitch && typeof changeRegion === 'function') {
            Promise.resolve(changeRegion()).catch((err) => {
                console.warn('Auto region switch after lock failed', err);
            });
        } else if (needsRegionSwitch && typeof recenterToSelectedRegion === 'function') {
            recenterToSelectedRegion();
        }

        if (needsRegionSwitch && typeof showToast === 'function') {
            showToast(`Automaticky prepnuté na kraj ${regionMeta[lock]?.seat || lock}.`, 'info');
        }

        return;
    }

    if (selector && !lock) {
        selector.disabled = false;
        selector.classList.remove('opacity-70', 'cursor-not-allowed');
    }
}

async function refreshAccessFromUser(user) {
    if (!user) {
        setAccessContext(null, {});
        return;
    }

    try {
        // Read user role from Firestore instead of auth token
        if (firebaseSyncState.db) {
            const userDocRef = firebaseSyncState.db.collection('users').doc(user.uid);
            const userDoc = await userDocRef.get();
            const userRoleData = userDoc.data() || {};
            
            // Pass Firestore data as claims for compatibility with existing code
            setAccessContext(user, {
                role: userRoleData.role || 'viewer',
                regionKey: userRoleData.regionKey || null
            });
        } else {
            // Fallback if DB not initialized
            setAccessContext(user, { role: 'viewer' });
        }
    } catch (err) {
        console.error('Failed to read user role from Firestore', err);
        // Fallback to viewer role if read fails
        setAccessContext(user, { role: 'viewer' });
    }
}

async function requestFirebaseSignIn(email, password) {
    if (!firebaseSyncState.auth) return false;
    
    if (!email || !password) {
        if (typeof showToast === 'function') {
            showToast('Email a heslo sú povinné.', 'warning');
        }
        return false;
    }

    try {
        await firebaseSyncState.auth.signInWithEmailAndPassword(email, password);
        return true;
    } catch (err) {
        console.error('Firebase sign in failed', err);
        let msg = 'Prihlásenie zlyhalo.';
        if (err.code === 'auth/user-not-found') {
            msg = 'Používateľ nenájdený.';
        } else if (err.code === 'auth/wrong-password') {
            msg = 'Nesprávne heslo.';
        } else if (err.code === 'auth/invalid-email') {
            msg = 'Neplatný email.';
        }
        if (typeof showToast === 'function') {
            showToast(msg, 'warning');
        }
        return false;
    }
}

async function requestFirebaseSignOut() {
    if (!firebaseSyncState.auth) return false;
    try {
        await firebaseSyncState.auth.signOut();
        
        // Reset selection states but KEEP data for map to show colored districts
        activeWorkplaceId = null;
        districtFilterMode = 'all';
        districtFilterWorkplace = 'all';
        currentRegionKey = 'slovakia';
        
        // Zoom map to show full Slovakia first
        if (!offlineModeActive && geojsonLayer && map) {
            let bounds = L.latLngBounds([]);
            geojsonLayer.eachLayer(layer => bounds.extend(layer.getBounds()));
            if (bounds.isValid()) {
                selectedRegionBounds = bounds;
                map.fitBounds(bounds, { padding: [35, 35], animate: true, duration: 1.0 });
            }
            
            // Reset all layers styling
            geojsonLayer.eachLayer(layer => geojsonLayer.resetStyle(layer));
            
            // Apply Slovakia view styling to kraje layer
            if (krajeLayer) {
                krajeLayer.setStyle(function (feature) {
                    return { color: "#ef4444", weight: 1.2, fillColor: "#0f172a", fillOpacity: 0, opacity: 1 };
                });
            }
        }
        
        // Now refresh UI panels after map zoom
        const regionSelector = document.getElementById('active-region-selector');
        if (regionSelector) regionSelector.value = 'slovakia';
        
        const searchInput = document.getElementById('district-search-input');
        if (searchInput) searchInput.value = '';
        const searchResult = document.getElementById('district-search-result');
        if (searchResult) {
            searchResult.classList.add('hidden');
            searchResult.innerHTML = '';
        }
        
        renderLeftWorkplaceList();
        renderRightCapacityList();
        updateSaveIndicator();
        
        showToast('Boli ste úspešne odhlásení.', 'info');
        return true;
    } catch (err) {
        console.error('Firebase sign out failed', err);
        return false;
    }
}

async function requestFirebasePasswordChange(currentPassword, newPassword) {
    if (!firebaseSyncState.auth || !firebase.auth?.EmailAuthProvider) return { ok: false, code: 'auth/not-available' };

    const user = firebaseSyncState.auth.currentUser;
    if (!user || !user.email) return { ok: false, code: 'auth/no-current-user' };

    const current = String(currentPassword || '').trim();
    const next = String(newPassword || '');

    if (!current || !next) return { ok: false, code: 'auth/missing-password' };
    if (next.length < 8) return { ok: false, code: 'auth/weak-password' };

    try {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, current);
        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(next);
        return { ok: true };
    } catch (err) {
        console.error('Firebase password change failed', err);
        return { ok: false, code: err?.code || 'auth/unknown' };
    }
}

async function listFirebaseUsers() {
    if (!isFirebaseSyncEnabled() || !firebaseSyncState.db) return [];
    if (!canCurrentUserEditAny()) return [];

    try {
        const snapshot = await getUsersCollectionRef().orderBy('email').get();
        const users = [];
        snapshot.forEach((doc) => {
            const data = doc.data() || {};
            users.push({
                uid: doc.id,
                email: data.email || '',
                role: normalizeAccessRole(data.role || ACCESS_ROLES.VIEWER),
                regionKey: data.regionKey ? String(data.regionKey) : null,
                updatedBy: data.updatedBy || null,
                updatedAt: data.updatedAt || null
            });
        });
        return users;
    } catch (err) {
        console.error('Firebase users load failed', err);
        return [];
    }
}

async function updateFirebaseUserAccess(uid, payload = {}) {
    if (!isFirebaseSyncEnabled() || !firebaseSyncState.db) return false;
    if (!canCurrentUserEditAny()) return false;
    if (!uid) return false;

    if (firebaseSyncState.access.uid && uid === firebaseSyncState.access.uid) {
        console.warn('Self role change blocked for current admin user');
        return false;
    }

    const role = normalizeAccessRole(payload.role || ACCESS_ROLES.VIEWER);
    const regionKey = role === ACCESS_ROLES.REGION_EDITOR
        ? (payload.regionKey ? String(payload.regionKey) : null)
        : null;

    try {
        await getUsersCollectionRef().doc(uid).set({
            role,
            regionKey,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: firebaseSyncState.access.uid || firebaseSyncState.options.clientId
        }, { merge: true });

        if (firebaseSyncState.access.uid === uid && firebaseSyncState.auth?.currentUser) {
            await refreshAccessFromUser(firebaseSyncState.auth.currentUser);
        }

        return true;
    } catch (err) {
        console.error('Firebase user update failed', err);
        return false;
    }
}

function subscribeAccessContext(listener) {
    if (typeof listener !== 'function') return function () {};
    firebaseSyncState.accessListeners.push(listener);
    listener(getCurrentAccessContext());

    return function unsubscribe() {
        firebaseSyncState.accessListeners = firebaseSyncState.accessListeners.filter(cb => cb !== listener);
    }
}

async function initFirebaseSync() {
    mergeFirebaseOptions(window.FIREBASE_SYNC_OPTIONS || {});
    mergeFirebaseAuthOptions(window.FIREBASE_AUTH_OPTIONS || {});

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

        if (firebase.auth && isFirebaseAuthEnabled()) {
            firebaseSyncState.auth = firebase.auth();
            firebaseSyncState.auth.onAuthStateChanged(async (user) => {
                await refreshAccessFromUser(user);
                applyRegionLockUi();
                if (typeof redrawUiAndStats === 'function') {
                    redrawUiAndStats();
                }
            });
        } else {
            setAccessContext(null, { role: ACCESS_ROLES.ADMIN });
        }

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
window.saveRegionImmediately = saveRegionImmediately;
window.scheduleSaveForAllRegions = scheduleSaveForAllRegions;
window.flushPendingRegionSaves = flushPendingRegionSaves;
window.applyRegionLockUi = applyRegionLockUi;
window.getRegionLockKey = getRegionLockKey;
window.ensureRegionInCloud = ensureRegionInCloud;
window.ensureAllRegionsInCloud = ensureAllRegionsInCloud;
window.getFirebaseDatasetSeedVersion = getFirebaseDatasetSeedVersion;
window.loadDistrictMetaFromCloud = loadDistrictMetaFromCloud;
window.getCurrentAccessContext = getCurrentAccessContext;
window.canCurrentUserEditAny = canCurrentUserEditAny;
window.canCurrentUserEditRegion = canCurrentUserEditRegion;
window.requestFirebaseSignIn = requestFirebaseSignIn;
window.requestFirebaseSignOut = requestFirebaseSignOut;
window.requestFirebasePasswordChange = requestFirebasePasswordChange;
window.subscribeAccessContext = subscribeAccessContext;
window.listFirebaseUsers = listFirebaseUsers;
window.updateFirebaseUserAccess = updateFirebaseUserAccess;
