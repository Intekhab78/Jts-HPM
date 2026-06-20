import api from './index';

export const downloadAttendanceReport = (params) => {
    return api.get('/reports/attendance', {
        params,
        responseType: 'blob'
    }).then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Attendance_Report_${Date.now()}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
};

export const downloadPayrollReport = (params) => {
    return api.get('/reports/payroll', {
        params,
        responseType: 'blob'
    }).then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Payroll_Report_${params.month}_${params.year}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
};

export const downloadEmployeeReport = (params) => {
    return api.get('/reports/employees', {
        params,
        responseType: 'blob'
    }).then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Employee_Report_${Date.now()}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
};

export const downloadAppraisalReport = (params) => {
    return api.get('/reports/appraisals', {
        params,
        responseType: 'blob'
    }).then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Appraisal_Report_${Date.now()}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
};

export const downloadTravelReport = (params) => {
    return api.get('/reports/travels', {
        params,
        responseType: 'blob'
    }).then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Travel_Report_${Date.now()}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
};

export const downloadLeaveReport = (params) => {
    return api.get('/reports/leaves', {
        params,
        responseType: 'blob'
    }).then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Leave_Report_${Date.now()}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
};

export const downloadPayrollRegister = (params) => {
    return api.get('/reports/payroll-register', {
        params,
        responseType: 'blob'
    }).then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Payroll_Register_${params.month}_${params.year}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
};
