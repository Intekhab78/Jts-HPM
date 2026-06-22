let apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
let baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');

let isInitialized = false;

export function getApiUrl() {
    return apiBaseUrl;
}

export function getBaseUrl() {
    return baseUrl;
}

export async function initBackendUrl() {
    if (isInitialized) return;

    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

    const envApiUrl = import.meta.env.VITE_API_URL;

    // If we are in production (not loading from localhost), use remote API directly without health-checks
    if (!isLocalhost) {
        if (envApiUrl && !envApiUrl.includes('localhost') && !envApiUrl.includes('127.0.0.1')) {
            apiBaseUrl = envApiUrl;
            baseUrl = envApiUrl.replace('/api', '');
        } else {
            apiBaseUrl = 'https://hcm.jtsonline.shop/api';
            baseUrl = 'https://hcm.jtsonline.shop';
        }
        isInitialized = true;
        return;
    }

    // If VITE_API_URL is configured and is not pointing to localhost, respect it directly without checks
    if (envApiUrl && !envApiUrl.includes('localhost') && !envApiUrl.includes('127.0.0.1')) {
        apiBaseUrl = envApiUrl;
        baseUrl = envApiUrl.replace('/api', '');
        isInitialized = true;
        return;
    }

    const localHealthUrl = 'http://localhost:5000/api/health';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 800);

        const response = await fetch(localHealthUrl, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            console.log('Local backend is running. Using localhost.');
            apiBaseUrl = 'http://localhost:5000/api';
            baseUrl = 'http://localhost:5000';
            isInitialized = true;
            return;
        }
    } catch (e) {
        // Fetch failed (connection refused, timeout, etc.)
    }

    console.log('Local backend is NOT running or unreachable. Falling back to remote: https://hcm.jtsonline.shop');
    apiBaseUrl = 'https://hcm.jtsonline.shop/api';
    baseUrl = 'https://hcm.jtsonline.shop';
    isInitialized = true;
}
