import api from './index';

export const getBiometricLogs = async (params) => {
    const response = await api.get('/biometric/logs', { params });
    return response.data;
};

export const reprocessBiometricLog = async (id) => {
    const response = await api.post(`/biometric/logs/${id}/reprocess`);
    return response.data;
};

export const pushBiometricLogs = async (data) => {
    const response = await api.post('/biometric/logs', data);
    return response.data;
};
