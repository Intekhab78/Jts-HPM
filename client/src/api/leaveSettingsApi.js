import api from './index';

export const getLeaveSettings = async () => {
    return await api.get('/leave-settings');
};

export const updateLeaveSettings = async (settingsData) => {
    return await api.put('/leave-settings', settingsData);
};

