import api from './index';

export const getAllLeaves = async () => {
    const response = await api.get('/leaves');
    return response.data;
};

export const getEmployeeLeaves = async (employeeId) => {
    const response = await api.get(`/leaves/employee/${employeeId}`);
    return response.data;
};

export const getLeaveBalances = async (employeeId) => {
    const response = await api.get(`/leaves/balance/${employeeId}`);
    return response.data;
};

export const applyForLeave = async (leaveData) => {
    const response = await api.post('/leaves', leaveData);
    return response.data;
};

export const updateLeaveAction = async (id, data) => {
    const response = await api.put(`/leaves/${id}`, data);
    return response.data;
};

export const uploadLeaveAttachment = async (id, formData) => {
    const response = await api.post(`/leaves/${id}/attachment`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const deleteLeave = async (id) => {
    const response = await api.delete(`/leaves/${id}`);
    return response.data;
};
