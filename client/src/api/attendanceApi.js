import api from './index';

export const getAttendance = async (params) => {
    // params can include startDate, endDate, employeeId
    const response = await api.get('/attendance', { params });
    return response.data;
};

export const addAttendance = async (data) => {
    const response = await api.post('/attendance', data);
    return response.data;
};

export const bulkUploadAttendance = async (formData) => {
    const response = await api.post('/attendance/bulk', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const punchInOut = async (formData) => {
    const response = await api.post('/attendance/punch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const approveAttendance = async (id, status) => {
    const response = await api.put(`/attendance/${id}/approve`, { status });
    return response.data;
};

export const lockAttendance = async (year, month) => {
    const response = await api.post('/attendance/lock', { year, month });
    return response.data;
};

export const requestAttendanceUpdate = async (data) => {
    const response = await api.post('/attendance/request', data);
    return response.data;
};

export const deleteAttendance = async (id) => {
    const response = await api.delete(`/attendance/${id}`);
    return response.data;
};
