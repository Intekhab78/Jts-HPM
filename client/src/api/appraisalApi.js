import api from './index';

export const getAppraisals = () => api.get('/appraisals').then(res => res.data);
export const getAppraisal = (id) => api.get(`/appraisals/${id}`).then(res => res.data);
export const createAppraisal = (data) => api.post('/appraisals', data).then(res => res.data);
export const updateAppraisal = (id, data) => api.put(`/appraisals/${id}`, data).then(res => res.data);
