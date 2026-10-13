import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
});

// Request interceptor — attach JWT
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor — handle 401, refresh token
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) throw new Error('No refresh token');

                const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
                localStorage.setItem('accessToken', data.data.accessToken);
                localStorage.setItem('refreshToken', data.data.refreshToken);
                originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;

                return api(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    getMe: () => api.get('/auth/me'),
    logout: () => api.post('/auth/logout'),
    getUsers: () => api.get('/auth/users'),
    updateUserRole: (id, data) => api.put(`/auth/users/${id}/role`, data),
    changePassword: (data) => api.put('/auth/change-password', data),
    resetUserPassword: (id, data) => api.put(`/auth/users/${id}/reset-password`, data),
};

// Approvals API
export const approvalsAPI = {
    getPending: (module) => api.get('/approvals/pending', { params: { module } }),
    getStatus: (module, documentId) => api.get(`/approvals/status/${module}/${documentId}`),
    process: (flowId, data) => api.post(`/approvals/process/${flowId}`, data),
};

// Roles & Permissions API
export const roleAPI = {
    getRoles: () => api.get('/roles'),
    createRole: (data) => api.post('/roles', data),
    updatePermissions: (id, data) => api.put(`/roles/${id}/permissions`, data),
    deleteRole: (id) => api.delete(`/roles/${id}`)
};

// Holidays API
export const holidayAPI = {
    getHolidays: (year) => api.get('/holidays', { params: { year } }),
    createHoliday: (data) => api.post('/holidays', data),
    deleteHoliday: (id) => api.delete(`/holidays/${id}`)
};

// Masters API
export const masterAPI = {
    getCompanies: () => api.get('/masters/companies'),
    createCompany: (data) => api.post('/masters/companies', data),
    updateCompany: (id, data) => api.put(`/masters/companies/${id}`, data),
    deleteCompany: (id) => api.delete(`/masters/companies/${id}`),
    uploadCompanyLogo: (id, formData) => api.post(`/masters/companies/${id}/logo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

    getLocations: () => api.get('/masters/locations'),
    createLocation: (data) => api.post('/masters/locations', data),
    updateLocation: (id, data) => api.put(`/masters/locations/${id}`, data),
    deleteLocation: (id) => api.delete(`/masters/locations/${id}`)
};

// Leave Settings API
export const leaveSettingsAPI = {
    getSettings: () => api.get('/leave-settings'),
    updateSettings: (data) => api.put('/leave-settings', data)
};

// Devices & IP Camera Visitors API
export const deviceAPI = {
    getDevices: () => api.get('/devices'),
    createDevice: (data) => api.post('/devices', data),
    updateDevice: (id, data) => api.put(`/devices/${id}`, data),
    deleteDevice: (id) => api.delete(`/devices/${id}`),
    testStream: (data) => api.post('/devices/test-stream', data),
    toggleStream: (id) => api.post(`/devices/${id}/toggle-stream`),
    getCameraStatus: (id) => api.get(`/devices/${id}/camera-status`),

    // Unregistered Visitors & Strangers Face Logs
    getUnregisteredFaceLogs: (params) => api.get('/devices/unregistered-face-logs', { params }),
    updateUnregisteredFaceLog: (id, data) => api.put(`/devices/unregistered-face-logs/${id}`, data),
    deleteUnregisteredFaceLog: (id) => api.delete(`/devices/unregistered-face-logs/${id}`),

    // Voice response test
    testVoice: (data) => api.post('/devices/test-voice', data),

    // Video Surveillance Recordings & Webcam Switch
    startRecording: (id, data) => api.post(`/devices/${id}/start-recording`, data),
    stopRecording: (id) => api.post(`/devices/${id}/stop-recording`),
    getRecordings: (params) => api.get('/devices/recordings', { params }),
    deleteRecording: (id) => api.delete(`/devices/recordings/${id}`),
    useWebcam: (id) => api.post(`/devices/${id}/use-webcam`)
};

// Security NVR & CCTV Surveillance API
export const nvrAPI = {
    getChannels: () => api.get('/nvr/channels'),
    updateChannelRole: (id, data) => api.put(`/nvr/channels/${id}/role`, data),
    broadcastAudio: (id, data) => api.post(`/nvr/channels/${id}/broadcast`, data),
    getSecurityAlerts: (params) => api.get('/nvr/alerts', { params }),
    resolveSecurityAlert: (id, data) => api.put(`/nvr/alerts/${id}/resolve`, data),
    triggerManualAlert: (data) => api.post('/nvr/alerts/manual', data),
};

export default api;

