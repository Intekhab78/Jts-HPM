import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAdvances, createAdvance, updateAdvanceStatus } from '../../api/advanceApi';
import toast from 'react-hot-toast';

export default function AdvanceDashboard() {
    const { user } = useAuth();
    const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const [advances, setAdvances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const [form, setForm] = useState({ amount: '', reason: '', emiMonths: 1 });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await getAdvances();
            setAdvances(res.data);
        } catch (error) {
            toast.error('Failed to load advances');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createAdvance(form);
            toast.success('Salary advance requested');
            setShowForm(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to request advance');
        }
    };

    const handleDisburse = async (id) => {
        try {
            // Hardcode start deduction to next month for simplicity in UI, or prompt in real app
            const d = new Date();
            d.setMonth(d.getMonth() + 1);

            await updateAdvanceStatus(id, 'Disbursed', d.toISOString());
            toast.success('Funds marked as disbursed. Payroll deductions started.');
            fetchData();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    return (
        <div className="advance-dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Salary Advances</h1>
                    <p className="page-subtitle">Request emergency funds and track EMI payroll deductions</p>
                </div>
                {userRole === 'employee' && (
                    <button onClick={() => setShowForm(!showForm)} className="btn btn-primary" style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#111827' }}>
                        + Request Advance
                    </button>
                )}
            </div>

            <div className="card">
                {showForm && (
                    <form onSubmit={handleSubmit} style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px' }}>
                        <h3 style={{ marginBottom: '1rem', color: '#f59e0b' }}>New Salary Advance Request</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Approved amounts will be automatically deducted from your monthly payroll over the selected EMI duration.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Requested Amount (AED)</label>
                                <input type="number" className="form-control" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Repayment Duration (Months)</label>
                                <select className="form-control" required value={form.emiMonths} onChange={e => setForm({ ...form, emiMonths: parseInt(e.target.value) })}>
                                    <option value={1}>1 Month</option>
                                    <option value={2}>2 Months</option>
                                    <option value={3}>3 Months</option>
                                    <option value={6}>6 Months</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label className="form-label">Reason for Request</label>
                                <input type="text" className="form-control" placeholder="E.g., Medical Emergency, Rent" required value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
                            </div>

                            {form.amount && form.emiMonths && (
                                <div style={{ gridColumn: 'span 2', background: 'var(--bg-primary)', padding: '1rem', borderRadius: '4px', borderLeft: '4px solid #f59e0b' }}>
                                    Estimated Monthly Deduction: <strong>AED {(form.amount / form.emiMonths).toFixed(2)}</strong> / month
                                </div>
                            )}

                            <div className="form-group" style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                                <button type="submit" className="btn btn-primary" style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#111827' }}>Submit Request</button>
                                <button type="button" className="btn btn-secondary" style={{ marginLeft: '1rem' }} onClick={() => setShowForm(false)}>Cancel</button>
                            </div>
                        </div>
                    </form>
                )}

                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                {userRole !== 'employee' && <th>Employee</th>}
                                <th>Reason</th>
                                <th>Total Amount</th>
                                <th>EMI Plan</th>
                                <th>Repaid</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {advances.map(a => (
                                <tr key={a._id}>
                                    {userRole !== 'employee' && <td>{a.employee?.firstName} {a.employee?.lastName}</td>}
                                    <td>
                                        <div style={{ fontWeight: '500' }}>{a.reason}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(a.requestDate).toLocaleDateString()}</div>
                                    </td>
                                    <td style={{ fontWeight: 'bold' }}>AED {a.amount}</td>
                                    <td>
                                        AED {a.emiAmount} x {a.emiMonths}
                                        <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)' }}>
                                            {a.repaymentStartDate ? `Started: ${new Date(a.repaymentStartDate).toLocaleString('default', { month: 'short', year: 'numeric' })}` : 'Not Started'}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ width: '100%', background: 'var(--bg-tertiary)', height: '6px', borderRadius: '3px', position: 'relative' }}>
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, height: '100%',
                                                background: '#10b981', borderRadius: '3px',
                                                width: `${(a.amountRepaid / a.amount) * 100}%`
                                            }}></div>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', marginTop: '4px', textAlign: 'right' }}>
                                            {(a.amountRepaid || 0).toFixed(0)} / {a.amount}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${a.status === 'Disbursed' ? 'success' :
                                                a.status === 'Completed' ? 'primary' :
                                                    a.status === 'Rejected' ? 'warning' : 'secondary'
                                            }`}>
                                            {a.status}
                                        </span>
                                    </td>
                                    <td>
                                        {a.status === 'Pending' && ['hr', 'admin', 'finance'].includes(userRole) && (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => handleDisburse(a._id)} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: '#f59e0b', borderColor: '#f59e0b', color: '#111827' }} title="Approve and transfer funds">
                                                    Disburse Funds
                                                </button>
                                                <button onClick={() => updateAdvanceStatus(a._id, 'Rejected')} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>Reject</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {advances.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No salary advances found.</p>}
                </div>
            </div>
        </div>
    );
}
