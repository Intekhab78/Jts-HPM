import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

export const getAdvances = () => api.get('/advances').then(res => res.data);
export const createAdvance = (data) => api.post('/advances', data).then(res => res.data);
export const updateAdvanceStatus = (id, status, repaymentStartDate) =>
    api.put(`/advances/${id}/status`, { status, repaymentStartDate }).then(res => res.data);
