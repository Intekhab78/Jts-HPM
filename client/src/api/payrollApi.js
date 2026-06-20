import api from './index';

export const getPayrolls = async (year, month) => {
    const response = await api.get('/payroll', {
        params: { year, month }
    });
    return response.data;
};

export const generatePayroll = async (year, month, companyId = 'all') => {
    const response = await api.post('/payroll/generate', { year, month, companyId });
    return response.data;
};

export const updatePayrollStatus = async (id, status) => {
    const response = await api.put(`/payroll/${id}/status`, { status });
    return response.data;
};

export const downloadSIF = async (year, month) => {
    const response = await api.post('/payroll/sif', { year, month });
    return response.data; // Expected { data: { downloadUrl: '/uploads/...' } }
};

export const getPayslipUrl = async (id) => {
    const response = await api.get(`/payroll/${id}/payslip`);
    return response.data; // Expected { data: { downloadUrl: '/uploads/...' } }
};

export const calculateGratuity = async (employeeId) => {
    const response = await api.get(`/payroll/gratuity/${employeeId}`);
    return response.data;
};

export const freezePayroll = async (year, month) => {
    const response = await api.put('/payroll/freeze', { year, month });
    return response.data;
};

export const unfreezePayroll = async (year, month) => {
    const response = await api.put('/payroll/unfreeze', { year, month });
    return response.data;
};

export const getFrozenMonths = async () => {
    const response = await api.get('/payroll/frozen-months');
    return response.data;
};
