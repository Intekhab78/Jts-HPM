import api from './index';

export const getEmployees = async () => {
    const response = await api.get('/employees');
    return response.data;
};

export const getEmployeeById = async (id) => {
    const response = await api.get(`/employees/${id}`);
    return response.data;
};

export const generateEmployeeId = async () => {
    const response = await api.get('/employees/generate-id');
    return response.data;
};

export const createEmployee = async (employeeData) => {
    const response = await api.post('/employees', employeeData);
    return response.data;
};

export const updateEmployee = async (id, employeeData) => {
    const response = await api.put(`/employees/${id}`, employeeData);
    return response.data;
};

export const deleteEmployee = async (id) => {
    const response = await api.delete(`/employees/${id}`);
    return response.data;
};

export const uploadDocuments = async (id, formData) => {
    const response = await api.post(`/employees/${id}/documents`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const confirmEmployeeProbation = async (id) => {
    const response = await api.put(`/employees/${id}/confirm-probation`);
    return response.data;
};
