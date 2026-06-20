import api from './index';

export const getTravels = () => api.get('/travels').then(res => res.data);
export const createTravel = (data) => api.post('/travels', data).then(res => res.data);
export const updateTravelStatus = (id, payload) => api.put(`/travels/${id}/status`, payload).then(res => res.data);
export const deleteTravel = (id) => api.delete(`/travels/${id}`).then(res => res.data);
export const uploadAdvanceDocument = (id, file) => {
    const formData = new FormData();
    formData.append('advanceDocument', file);
    return api.post(`/travels/${id}/document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};
