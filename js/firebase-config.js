// Fill these values from Firebase project settings.
// If left empty, the app runs in local-only mode.
window.FIREBASE_CONFIG = {
    apiKey: "AIzaSyBsVuBvHK3AoOTGOMJ-IO58mIS10x59TLw",
    authDomain: "moddp-1d5fd.firebaseapp.com",
    projectId: "moddp-1d5fd",
    storageBucket: "moddp-1d5fd.firebasestorage.app",
    messagingSenderId: "411324140305",
    appId: "1:411324140305:web:b566803c101f2d129b5ab0",
    measurementId: "G-TZTVZD41CV"
};

// Optional sync behavior.
window.FIREBASE_SYNC_OPTIONS = {
    collectionName: 'okr_region_models',
    districtMetaCollectionName: 'district_meta',
    autoSaveMs: 1000,

    // Set region lock for dedicated regional deployments, e.g. 'trnava'.
    // Keep null to allow all regions.
    regionLock: null
};
