import api from './index';

export const getAdvances = () => api.get('/advances').then(res => res.data);
export const createAdvance = (data) => api.post('/advances', data).then(res => res.data);
export const updateAdvanceStatus = (id, status, repaymentStartDate) =>
    api.put(`/advances/${id}/status`, { status, repaymentStartDate }).then(res => res.data);
