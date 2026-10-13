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

export const getBiometricLogs = async () => {
    const response = await api.get('/attendance/biometric-logs');
    return response.data;
};

export const deleteAttendance = async (id, reason) => {
    const response = await api.delete(`/attendance/${id}`, { data: { reason } });
    return response.data;
};

export const deletePunchLog = async (punchLogId, reason) => {
    const response = await api.delete(`/attendance/punch-log/${punchLogId}`, { data: { reason } });
    return response.data;
};

export const getUnregisteredFaceLogs = async (params) => {
    const response = await api.get('/devices/unregistered-face-logs', { params });
    return response.data;
};

export const updateUnregisteredFaceLog = async (id, data) => {
    const response = await api.put(`/devices/unregistered-face-logs/${id}`, data);
    return response.data;
};

export const deleteUnregisteredFaceLog = async (id) => {
    const response = await api.delete(`/devices/unregistered-face-logs/${id}`);
    return response.data;
};


