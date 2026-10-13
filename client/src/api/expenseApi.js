import api from './index';

export const getExpenses = () => api.get('/expenses').then(res => res.data);
export const createExpense = (data) => api.post('/expenses', data).then(res => res.data);
export const updateExpenseStatus = (id, status) => api.put(`/expenses/${id}/status`, { status }).then(res => res.data);

export const uploadExpenseReceipt = (id, file) => {
    const formData = new FormData();
    formData.append('receipt', file);
    return api.post(`/expenses/${id}/receipt`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(res => res.data);
};

export const getSettlements = () => api.get('/expenses/settlements').then(res => res.data);
export const createSettlement = (data) => api.post('/expenses/settlements', data).then(res => res.data);
export const updateSettlementDraft = (id, data) => api.put(`/expenses/settlements/${id}`, data).then(res => res.data);
export const updateSettlementStatus = (id, payload) => api.put(`/expenses/settlements/${id}/status`, payload).then(res => res.data);

export const uploadSettlementReceipt = (id, expenseIndex, file) => {
    const formData = new FormData();
    formData.append('receipt', file);
    return api.post(`/expenses/settlements/${id}/receipt/${expenseIndex}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(res => res.data);
};
