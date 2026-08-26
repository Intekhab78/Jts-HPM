import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getLeaveBalances, getEmployeeLeaves, deleteLeave, applyLeaveEncashment, getLeaveEncashments } from '../../api/leaveApi';
import { getEmployeeById } from '../../api/employeeApi';
import { leaveSettingsAPI } from '../../api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function LeaveDashboard() {
    const { user } = useAuth();
    const [balances, setBalances] = useState(null);
    const [history, setHistory] = useState([]);
    const [encashments, setEncashments] = useState([]);
    const [employeeRecord, setEmployeeRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [policySettings, setPolicySettings] = useState(null);

    // Modal State
    const [showEncashModal, setShowEncashModal] = useState(false);
    const [encashDays, setEncashDays] = useState(1);
    const [encashRemarks, setEncashRemarks] = useState('');
    const [submittingEncash, setSubmittingEncash] = useState(false);

    useEffect(() => {
        if (user && user.employeeRef) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const employeeId = user.employeeRef._id || user.employeeRef;
            const [balanceRes, historyRes, encashRes, empRes, settingsRes] = await Promise.all([
                getLeaveBalances(employeeId),
                getEmployeeLeaves(employeeId),
                getLeaveEncashments().catch(() => ({ data: [] })),
                getEmployeeById(employeeId).catch(() => null),
                leaveSettingsAPI.getSettings().catch(() => ({ data: { data: null } }))
            ]);
            
            setBalances(balanceRes.data);
            setHistory(historyRes.data);
            setEncashments(encashRes.data || encashRes);
            if (empRes?.data) setEmployeeRecord(empRes.data);
            if (settingsRes.data?.data) {
                setPolicySettings(settingsRes.data.data);
            }
        } catch (error) {
            toast.error('Failed to load leave data');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelLeave = async (id) => {
        if (!window.confirm('Are you sure you want to cancel this leave request?')) return;

        try {
            await deleteLeave(id);
            toast.success('Leave request cancelled successfully');
            fetchData(); // Refresh list and balances
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel leave request');
        }
    };

    const handleOpenEncash = () => {
        setEncashDays(1);
        setEncashRemarks('');
        setShowEncashModal(true);
    };

    const handleSubmitEncash = async (e) => {
        e.preventDefault();
        const available = balances?.Annual?.available || 0;
        if (encashDays <= 0 || encashDays > available) {
            return toast.error(`Invalid days. You can encash up to ${available.toFixed(1)} days.`);
        }

        setSubmittingEncash(true);
        try {
            const employeeId = user.employeeRef._id || user.employeeRef;
            const res = await applyLeaveEncashment({
                employee: employeeId,
                daysEncashed: encashDays,
                remarks: encashRemarks
            });
            if (res.success) {
                toast.success('Leave encashment request submitted!');
                setShowEncashModal(false);
                fetchData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit encashment request');
        } finally {
            setSubmittingEncash(false);
        }
    };

    if (loading) return <div className="page-loader"><div className="loader"></div></div>;

    if (!user.employeeRef) {
        return (
            <div className="page-header">
                <div>
                    <h1 className="page-title">Leaves</h1>
                    <p className="page-subtitle">Your profile is not linked to an employee record yet.</p>
                </div>
            </div>
        );
    }

    const availableAnnual = balances?.Annual?.available || 0;
    
    // Calculate basic salary preview
    let basicSalary = employeeRecord?.basicSalary || 0;
    if (basicSalary === 0 && employeeRecord?.payElements) {
        const basicElement = employeeRecord.payElements.find(pe => pe.element?.name?.toLowerCase().includes('basic'));
        if (basicElement) {
            basicSalary = basicElement.amount || 0;
        }
    }
    const previewAmount = basicSalary > 0 ? ((basicSalary / 30) * encashDays) : 0;

    return (
        <div className="leave-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Leaves</h1>
                    <p className="page-subtitle">View your balances and apply for time off or leave encashments</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {availableAnnual > 0 && (
                        <button className="btn btn-secondary btn-outline" onClick={handleOpenEncash}>
                            <span className="btn-icon">💰</span> Encash Leave
                        </button>
                    )}
                    {(user.role === 'manager' || user.role === 'hr' || user.role === 'admin' || user.role === 'director') && (
                        <Link to="/leaves/team" className="btn btn-secondary btn-outline">Team Leaves</Link>
                    )}
                    <Link to="/leaves/apply" className="btn btn-primary">
                        <span className="btn-icon">+</span> Apply Leave
                    </Link>
                </div>
            </div>

            {/* Balances Card Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                {balances && Object.entries(balances).map(([type, stats]) => {
                    const formatDay = (val) => typeof val === 'number' ? parseFloat(val.toFixed(2)) : val;
                    return (
                        <div key={type} className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>{type} Leave</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '0.5rem' }}>
                                {formatDay(stats.available)} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>days</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Max: {formatDay(stats.accrued)} | Taken: {formatDay(stats.taken)}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* History List */}
            <div className="card">
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Leave History</h2>

                {history.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div className="empty-state-icon" style={{ fontSize: '2.5rem', opacity: '0.5', marginBottom: '0.5rem' }}>🏖️</div>
                        <p className="empty-state-text">No leaves taken yet</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Duration</th>
                                    <th>Days</th>
                                    <th>Reason</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(leave => (
                                    <tr key={leave._id}>
                                        <td style={{ fontWeight: '500' }}>{leave.leaveType}</td>
                                        <td>
                                            <div style={{ fontSize: '0.9rem' }}>{new Date(leave.fromDate).toLocaleDateString()} to</div>
                                            <div style={{ fontSize: '0.9rem' }}>{new Date(leave.toDate).toLocaleDateString()}</div>
                                        </td>
                                        <td>{leave.totalDays}</td>
                                        <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {leave.reason}
                                        </td>
                                        <td>
                                            <span className={`badge ${leave.status === 'Approved' ? 'badge-success' :
                                                leave.status === 'Rejected' ? 'badge-danger' : 'badge-warning'
                                                }`}>
                                                {leave.status}
                                            </span>
                                        </td>
                                        <td>
                                            {leave.status === 'Pending' && (
                                                <button
                                                    className="btn btn-danger btn-outline"
                                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                                    onClick={() => handleCancelLeave(leave._id)}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Leave Encashment History */}
            <div className="card">
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Leave Encashment Claims</h2>
                {encashments.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem 0' }}>No leave encashments requested yet.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Request Date</th>
                                    <th>Days Encashed</th>
                                    <th>Basic Salary (Rate)</th>
                                    <th>Amount (AED)</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {encashments.map(enc => (
                                    <tr key={enc._id}>
                                        <td>{new Date(enc.requestDate || enc.createdAt).toLocaleDateString()}</td>
                                        <td><strong>{enc.daysEncashed} days</strong></td>
                                        <td>AED {enc.basicSalary?.toLocaleString()}</td>
                                        <td style={{ fontWeight: '600', color: 'var(--primary-400)' }}>AED {enc.amount?.toLocaleString()}</td>
                                        <td>
                                            <span className={`badge ${
                                                enc.status === 'Processed' ? 'badge-success' :
                                                enc.status === 'Approved' ? 'badge-success' :
                                                enc.status === 'Rejected' ? 'badge-danger' : 'badge-warning'
                                            }`}>
                                                {enc.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ENCASHMENT REQUEST MODAL */}
            {showEncashModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Request Leave Encashment
                        </h3>
                        <form onSubmit={handleSubmitEncash} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <div className="form-group">
                                <label className="form-label">Available Annual Leave (Days)</label>
                                <input type="text" className="form-control" value={availableAnnual.toFixed(1)} disabled />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Days to Encash *</label>
                                <input 
                                    type="number" 
                                    className="form-control" 
                                    min="1" 
                                    max={Math.floor(availableAnnual)} 
                                    value={encashDays} 
                                    onChange={(e) => setEncashDays(parseInt(e.target.value) || 0)} 
                                    required 
                                />
                            </div>

                            {basicSalary > 0 ? (
                                <div style={{ background: 'var(--bg-tertiary)', padding: '0.8rem', borderRadius: '4px', border: '1px dashed var(--border-color)' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Estimated Encashment Payout:</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary-400)', marginTop: '0.2rem' }}>
                                        AED {previewAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                                        Calculated as: (AED {basicSalary.toLocaleString()} / 30) × {encashDays} days
                                    </div>
                                </div>
                            ) : (
                                <p style={{ color: '#f59e0b', fontSize: '0.85rem' }}>⚠️ Your basic salary is not set in our records. Calculation will occur at approval time.</p>
                            )}

                            <div className="form-group">
                                <label className="form-label">Remarks / Reason</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g. Vacation encashment request" 
                                    value={encashRemarks} 
                                    onChange={(e) => setEncashRemarks(e.target.value)} 
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setShowEncashModal(false)} className="btn btn-secondary btn-outline">Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submittingEncash || encashDays <= 0 || encashDays > availableAnnual}>
                                    {submittingEncash ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
