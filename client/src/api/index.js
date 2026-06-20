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

export default api;
