import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const STORAGE_KEY = '@hrpayroll_server_url';

// Primary official HCM API subdomain
export const DEFAULT_SERVER_URL = 'https://hcmapi.jtsmiddleeast.com/api';
export const SECONDARY_SERVER_URL = 'https://hcm.jtsonline.shop/api';

/**
 * Normalizes input URL so it always ends with /api
 */
export const normalizeApiUrl = (url) => {
    let clean = (url || '').trim().replace(/\/+$/, '');
    if (!clean) return DEFAULT_SERVER_URL;
    if (!clean.toLowerCase().endsWith('/api')) {
        clean = `${clean}/api`;
    }
    return clean;
};

let activeApiUrl = DEFAULT_SERVER_URL;
let isInitialized = false;

/**
 * Initializes and retrieves the saved API URL.
 */
export const initApiConfig = async () => {
    try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && saved.trim()) {
            activeApiUrl = normalizeApiUrl(saved);
        } else {
            activeApiUrl = DEFAULT_SERVER_URL;
        }
    } catch (e) {
        console.warn('Could not read saved server URL, using default:', e);
        activeApiUrl = DEFAULT_SERVER_URL;
    }
    isInitialized = true;
    return activeApiUrl;
};

/**
 * Synchronous getter for current API URL.
 */
export const getApiUrl = () => {
    return activeApiUrl;
};

/**
 * Returns root server address for images and uploads (removes trailing /api)
 */
export const getBaseServerUrl = () => {
    return activeApiUrl.replace(/\/api\/?$/i, '');
};

/**
 * Formats full URL for a static asset / upload path
 */
export const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${getBaseServerUrl()}${cleanPath}`;
};

/**
 * Persists a new server API URL in AsyncStorage.
 */
export const setApiUrl = async (newUrl) => {
    activeApiUrl = normalizeApiUrl(newUrl);
    await AsyncStorage.setItem(STORAGE_KEY, activeApiUrl);
    return activeApiUrl;
};

/**
 * Resets the server API URL to the default cloud endpoint.
 */
export const resetApiUrl = async () => {
    activeApiUrl = DEFAULT_SERVER_URL;
    await AsyncStorage.removeItem(STORAGE_KEY);
    return activeApiUrl;
};
