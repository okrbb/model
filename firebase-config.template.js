// Firebase Configuration Template
// Copy this file to firebase-config.js and fill in your Firebase project values
// from Firebase Console > Project Settings > Your apps > Web

window.FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "1:YOUR_MESSAGING_SENDER_ID:web:YOUR_APP_ID",
    measurementId: "G-YOUR_MEASUREMENT_ID"
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

// Optional auth and authorization behavior.
window.FIREBASE_AUTH_OPTIONS = {
    // Set false to keep legacy open editing mode without signed-in users.
    enabled: true,

    // If true, the app asks users to sign in. If false, anonymous read-only fallback is allowed.
    requireSignIn: false,

    // Google Sign-In client ID (if needed for Google OAuth).
    googleClientId: null
};
