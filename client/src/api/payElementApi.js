import api from './index';

const API_URL = '/pay-elements';

export const getPayElements = () => api.get(API_URL);
export const getPayElementById = (id) => api.get(`${API_URL}/${id}`);
export const createPayElement = (data) => api.post(API_URL, data);
export const updatePayElement = (id, data) => api.put(`${API_URL}/${id}`, data);
export const deletePayElement = (id) => api.delete(`${API_URL}/${id}`);
