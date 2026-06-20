import api from './index';

export const getOverrides = () => api.get('/settings/overrides').then(res => res.data);
export const createOverride = (data) => api.post('/settings/overrides', data).then(res => res.data);
export const updateOverride = (id, data) => api.put(`/settings/overrides/${id}`, data).then(res => res.data);
export const deleteOverride = (id) => api.delete(`/settings/overrides/${id}`).then(res => res.data);

export const getAttendanceSettings = () => api.get('/settings/attendance').then(res => res.data);
export const updateAttendanceSettings = (data) => api.put('/settings/attendance', data).then(res => res.data);
