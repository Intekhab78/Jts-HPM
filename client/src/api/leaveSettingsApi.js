import axios from 'axios';

const API_URL = '/api/leave-settings';

export const getLeaveSettings = async () => {
    return await axios.get(API_URL);
};

export const updateLeaveSettings = async (settingsData) => {
    return await axios.put(API_URL, settingsData);
};
