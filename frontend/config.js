// frontend/config.js
window.APP_CONFIG = {
    // Configuration de l'API
    api: {
        baseUrl: 'https://map-program-v3.onrender.com/api', // ← METTEZ VOTRE URL RENDER ICI !
        timeout: 30000,
        retryAttempts: 3
    },

    // Map Settings
    map: {
        defaultCenter: [48.8566, 2.3522], // Paris coordinates
        defaultZoom: 13,
        minZoom: 10,
        maxZoom: 18,
        tileProvider: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '© OpenStreetMap contributors'
    },

    // UI Settings
    ui: {
        animationDuration: 300, // milliseconds
        popupMaxWidth: 420,
        cardMinWidth: 280,
        searchDebounceDelay: 300,
        importStatusDuration: 5000, // how long to show import messages
        autoSaveInterval: 30000 // auto-save drafts every 30 seconds
    },

    // Filter Defaults
    filters: {
        defaultPriceRange: {
            min: 0,
            max: 200
        },
        distanceOptions: [1, 2, 5, 10], // kilometers
        categories: [
            { id: 'all', label: 'All', icon: null },
            { id: 'restaurant', label: 'Food', icon: '🍽️' },
            { id: 'museum', label: 'Culture', icon: '🏛️' },
            { id: 'park', label: 'Nature', icon: '🌳' },
            { id: 'shopping', label: 'Shopping', icon: '🛍️' }
        ]
    },

    // Business Hours Format
    businessHours: {
        format24h: true, // false for 12h format
        timezone: 'Europe/Paris' // for future timezone support
    },

    // Data Validation Rules
    validation: {
        requiredFields: ['name', 'lat', 'lng'],
        maxNameLength: 100,
        maxDescriptionLength: 500,
        minRating: 0,
        maxRating: 5,
        validCategories: ['restaurant', 'museum', 'park', 'shopping'],
        maxImageSize: 5 * 1024 * 1024, // 5MB
        allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp']
    },

    // Social Media Patterns
    social: {
        instagramPattern: /^https?:\/\/(www\.)?instagram\.com\/.+/,
        websitePattern: /^https?:\/\/.+/
    },

    // Export Settings
    export: {
        jsonIndentation: 2,
        csvDelimiter: ',',
        csvQuoteChar: '"'
    },

    // Feature Flags
    features: {
        enableGeolocation: true,
        enableSharing: true,
        enableVideoContent: true,
        enableEditorPicks: true,
        enableImportExport: true,
        enableAdvancedFilters: true,
        enableOfflineMode: false,
        enablePushNotifications: false,
        enableSocialLogin: false,
        enableImageUpload: true
    },

    // Security Settings
    security: {
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        passwordMinLength: 6,
        passwordRequireSpecial: false,
        passwordRequireNumber: false
    },

    // Cache Settings
    cache: {
        enableCache: true,
        spotsExpiry: 5 * 60 * 1000, // 5 minutes
        categoriesExpiry: 60 * 60 * 1000, // 1 hour
        userExpiry: 10 * 60 * 1000 // 10 minutes
    },

    // API Keys (for future use)
    apiKeys: {
        mapboxToken: '', // Add if switching to Mapbox
        googleMapsKey: '', // Add if integrating Google services
        cloudinaryUrl: '', // Add for image uploads
        sentryDsn: '' // Add for error tracking
    }
};

// Make config globally available
window.APP_CONFIG = CONFIG;