import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getLeaveBalances, getEmployeeLeaves, deleteLeave } from '../../api/leaveApi';
import { leaveSettingsAPI } from '../../api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function LeaveDashboard() {
    const { user } = useAuth();
    const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const [balances, setBalances] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [policySettings, setPolicySettings] = useState(null);

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
            const [balanceRes, historyRes, settingsRes] = await Promise.all([
                getLeaveBalances(employeeId),
                getEmployeeLeaves(employeeId),
                leaveSettingsAPI.getSettings().catch(() => ({ data: { data: null } }))
            ]);
            setBalances(balanceRes.data);
            setHistory(historyRes.data);
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

    return (
        <div className="leave-dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Leaves</h1>
                    <p className="page-subtitle">View your balances and apply for time off</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {policySettings?.enableLeaveEncashment && balances?.Annual?.available > 0 && (
                        <button className="btn btn-secondary btn-outline" onClick={() => toast('Encashment workflow coming soon!')}>
                            <span className="btn-icon">💰</span> Encash Leave
                        </button>
                    )}
                    {['manager', 'hr', 'admin', 'director'].includes(userRole) && (
                        <Link to="/leaves/team" className="btn btn-secondary btn-outline">Team Leaves</Link>
                    )}
                    <Link to="/leaves/apply" className="btn btn-primary">
                        <span className="btn-icon">+</span> Apply Leave
                    </Link>
                </div>
            </div>

            {/* Balances Card Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
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
                    <div className="empty-state" style={{ padding: '3rem 0' }}>
                        <div className="empty-state-icon" style={{ fontSize: '3rem', opacity: '0.5' }}>🏖️</div>
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
        </div>
    );
}
