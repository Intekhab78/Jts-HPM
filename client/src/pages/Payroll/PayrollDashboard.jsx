import { useState, useEffect } from 'react';
import { getBaseUrl } from '../../api/config';
import { useAuth } from '../../context/AuthContext';
import { getPayrolls, generatePayroll, updatePayrollStatus, downloadSIF, getPayslipUrl, freezePayroll as freezePayrollApi, unfreezePayroll as unfreezePayrollApi } from '../../api/payrollApi';
import toast from 'react-hot-toast';

export default function PayrollDashboard() {
    const { user } = useAuth();
    const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const [payrolls, setPayrolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [freezing, setFreezing] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('all');

    // Default to current month/year
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const [filters, setFilters] = useState({
        month: currentMonth,
        year: currentYear
    });

    useEffect(() => {
        // Fetch masters
        import('../../api').then(module => module.masterAPI.getCompanies())
            .then(res => setCompanies(res.data.data))
            .catch(console.error);

        fetchPayrolls();
    }, [filters]);

    const fetchPayrolls = async () => {
        try {
            setLoading(true);
            const res = await getPayrolls(filters.year, filters.month);
            setPayrolls(res.data);
        } catch (error) {
            toast.error('Failed to load payrolls');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        const companyName = selectedCompanyId === 'all' ? 'All Companies' : companies.find(c => c._id === selectedCompanyId)?.name;
        if (window.confirm(`Generate payrolls for [${companyName}] - Month ${filters.month}, Year ${filters.year}?`)) {
            try {
                setGenerating(true);
                const res = await generatePayroll(filters.year, filters.month, selectedCompanyId);
                toast.success(`Generated ${res.count} payroll records successfully.`);
                fetchPayrolls();
            } catch (error) {
                toast.error(error.response?.data?.message || 'Generation failed');
            } finally {
                setGenerating(false);
            }
        }
    };

    const handleStatusChange = async (id, status) => {
        try {
            await updatePayrollStatus(id, status);
            toast.success(`Payroll marked as ${status}`);
            fetchPayrolls();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handleDownloadSif = async () => {
        try {
            const toastId = toast.loading('Generating SIF format...');
            const res = await downloadSIF(filters.year, filters.month);
            toast.success('SIF generated', { id: toastId });

            // In a real app we'd construct a full URL, but Vite proxies it
            // or we use window.location.origin + ...
            const url = `${getBaseUrl()}${res.data.downloadUrl}`;
            window.open(url, '_blank');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to generate SIF');
        }
    };

    const handleDownloadPayslip = async (id) => {
        try {
            const toastId = toast.loading('Generating Payslip PDF...');
            const res = await getPayslipUrl(id);
            toast.success('Payslip ready', { id: toastId });

            const url = `${getBaseUrl()}${res.data.downloadUrl}`;
            window.open(url, '_blank');
        } catch (error) {
            toast.error('Failed to generate payslip');
        }
    };

    const isFrozen = payrolls.length > 0 && payrolls.some(p => p.isFrozen);

    const handleFreezeToggle = async () => {
        const action = isFrozen ? 'unfreeze' : 'freeze';
        if (window.confirm(`Are you sure you want to ${action} payroll for ${filters.month}/${filters.year}?`)) {
            try {
                setFreezing(true);
                if (isFrozen) {
                    await unfreezePayrollApi(filters.year, filters.month);
                    toast.success('Payroll unfrozen successfully');
                } else {
                    await freezePayrollApi(filters.year, filters.month);
                    toast.success('Payroll frozen successfully');
                }
                fetchPayrolls();
            } catch (error) {
                toast.error(error.response?.data?.message || `Failed to ${action} payroll`);
            } finally {
                setFreezing(false);
            }
        }
    };


    const summary = {
        totalGross: payrolls.reduce((a, b) => a + b.grossPay, 0),
        totalNet: payrolls.reduce((a, b) => a + b.netPay, 0),
        approvedCount: payrolls.filter(p => p.status === 'Approved' || p.status === 'Paid').length
    };

    const allApproved = payrolls.length > 0 && summary.approvedCount === payrolls.length;

    return (
        <div className="payroll-dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">UAE Payroll Module</h1>
                    <p className="page-subtitle">Salary processing, WPS payload generation, and PDF Payslips</p>
                </div>
                {(userRole === 'admin' || userRole === 'finance' || userRole === 'hr') && (
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {/* Freeze/Unfreeze toggle - admin & hr only */}
                        {(userRole === 'admin' || userRole === 'hr') && payrolls.length > 0 && (
                            <button
                                onClick={handleFreezeToggle}
                                className={`btn ${isFrozen ? 'btn-secondary' : 'btn-primary'}`}
                                disabled={freezing}
                                style={isFrozen
                                    ? { background: '#f59e0b', color: 'white', borderColor: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }
                                    : { background: '#6366f1', color: 'white', borderColor: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.4rem' }
                                }
                            >
                                {freezing ? 'Processing...' : isFrozen ? '🔓 Unfreeze Payroll' : '🔒 Freeze Payroll'}
                            </button>
                        )}
                        {allApproved && (
                            <button onClick={handleDownloadSif} className="btn btn-secondary" style={{ background: '#10b981', color: 'white', borderColor: '#10b981' }}>
                                Download WPS SIF
                            </button>
                        )}
                        {(userRole === 'admin' || userRole === 'hr') && (
                            <button onClick={handleGenerate} className="btn btn-primary" disabled={generating || isFrozen}>
                                {generating ? 'Processing...' : `Run Payroll (${filters.month}/${filters.year})`}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Filters Bar */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
                    <label className="form-label">Month</label>
                    <select
                        className="form-control"
                        value={filters.month}
                        onChange={(e) => setFilters(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
                    <label className="form-label">Year</label>
                    <input
                        type="number"
                        className="form-control"
                        value={filters.year}
                        onChange={(e) => setFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    />
                </div>
                <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
                    <label className="form-label">Company Filter</label>
                    <select
                        className="form-control"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                    >
                        <option value="all">All Companies</option>
                        {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Top Level Metrics */}
            {payrolls.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <SummaryMetric title="Total Payees" value={payrolls.length} />
                    <SummaryMetric title="Total Gross Pay" value={`AED ${summary.totalGross.toLocaleString()}`} />
                    <SummaryMetric title="Total Net Transfer" value={`AED ${summary.totalNet.toLocaleString()}`} color="#10b981" />
                    <SummaryMetric title="Approval Status" value={`${summary.approvedCount} / ${payrolls.length} Approved`} color={allApproved ? '#10b981' : '#f59e0b'} />
                </div>
            )}

            {/* Frozen Banner */}
            {isFrozen && (
                <div style={{
                    background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '1rem 1.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: '#92400e'
                }}>
                    <span style={{ fontSize: '1.5rem' }}>🔒</span>
                    <div>
                        <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>Payroll Frozen</div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>This payroll period is locked. No changes can be made until it is unfrozen by an Admin or HR.</div>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="card">
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Salary Matrix - {filters.month}/{filters.year}</h2>
                {loading ? (
                    <div className="page-loader" style={{ minHeight: '300px' }}><div className="loader"></div></div>
                ) : payrolls.length === 0 ? (
                    <div className="empty-state" style={{ padding: '3rem 0' }}>
                        <div className="empty-state-icon" style={{ fontSize: '3rem', opacity: '0.5' }}>💸</div>
                        <p className="empty-state-text">No payrolls generated for this period.</p>
                        {(userRole === 'admin' || userRole === 'hr') && (
                            <button onClick={handleGenerate} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                                Run Payroll Now
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Basic</th>
                                    <th>Allowances</th>
                                    <th>Overtime</th>
                                    <th>Deductions</th>
                                    <th>Net Pay</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payrolls.map(p => {
                                    const totalAllowances = p.earnings.hra + p.earnings.transport + p.earnings.otherAllowances;
                                    const empCompany = p.employee?.company ? p.employee.company.name : 'Unassigned';

                                    return (
                                        <tr key={p._id}>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{p.employee?.firstName} {p.employee?.lastName}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.employee?.employeeId} • {empCompany}</div>
                                            </td>
                                            <td>{p.earnings.basic?.toFixed(2)}</td>
                                            <td>{totalAllowances.toFixed(2)}</td>
                                            <td style={{ color: p.earnings.overtime > 0 ? '#10b981' : 'inherit' }}>{p.earnings.overtime?.toFixed(2)}</td>
                                            <td style={{ color: p.totalDeductions > 0 ? '#ef4444' : 'inherit' }}>{p.totalDeductions?.toFixed(2)}</td>
                                            <td style={{ fontWeight: 'bold' }}>{p.netPay?.toFixed(2)}</td>
                                            <td>
                                                <span className={`badge ${(p.status === 'Approved' || p.status === 'Paid') ? 'badge-success' :
                                                    p.status === 'Draft' ? 'badge-warning' : 'badge-secondary'
                                                    }`}>
                                                    {p.isFrozen && '🔒 '}{p.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => handleDownloadPayslip(p._id)} className="btn btn-secondary btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} title="Download Payslip PDF">
                                                        📄 PDF
                                                    </button>

                                                    {/* Approval Workflow Buttons */}
                                                    {(userRole === 'admin' || userRole === 'finance') && p.status === 'Draft' && !p.isFrozen && (
                                                        <button onClick={() => handleStatusChange(p._id, 'Approved')} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#10b981', borderColor: '#10b981' }}>
                                                            Approve
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function SummaryMetric({ title, value, color }) {
    return (
        <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>{title}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: color || 'var(--text-primary)' }}>{value}</div>
        </div>
    );
}
