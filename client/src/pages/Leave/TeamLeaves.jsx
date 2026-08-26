import { useState, useEffect } from 'react';
import { getAllLeaves, updateLeaveAction, getAllEmployeeLeaveBalances, getLeaveEncashments, updateLeaveEncashmentStatus } from '../../api/leaveApi';
import toast from 'react-hot-toast';

export default function TeamLeaves() {
    const [leaves, setLeaves] = useState([]);
    const [balances, setBalances] = useState([]);
    const [encashments, setEncashments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'directory', 'encashments', 'history'
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [leavesRes, balancesRes, encashRes] = await Promise.all([
                getAllLeaves(),
                getAllEmployeeLeaveBalances().catch(() => ({ success: true, data: [] })),
                getLeaveEncashments().catch(() => ({ success: true, data: [] }))
            ]);
            setLeaves(leavesRes.data || leavesRes); // Handles API wrapper wrapping styles
            setBalances(balancesRes.data || balancesRes);
            setEncashments(encashRes.data || encashRes);
        } catch (error) {
            toast.error('Failed to fetch team leaves or balances directory');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await updateLeaveAction(id, { status });
            toast.success(`Leave ${status.toLowerCase()} successfully`);
            fetchData();
        } catch (error) {
            toast.error('Failed to update leave status');
        }
    };

    const handleEncashmentStatusUpdate = async (id, status) => {
        try {
            await updateLeaveEncashmentStatus(id, status);
            toast.success(`Encashment request ${status.toLowerCase()} successfully`);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update encashment request');
        }
    };

    if (loading) return <div className="page-loader"><div className="loader"></div></div>;

    const pendingLeaves = Array.isArray(leaves) ? leaves.filter(l => l.status === 'Pending') : [];
    const pastLeaves = Array.isArray(leaves) ? leaves.filter(l => l.status !== 'Pending') : [];

    // Filter balances directory by search query
    const filteredBalances = balances.filter(b => {
        const fullName = `${b.firstName} ${b.lastName}`.toLowerCase();
        const empId = (b.employeeId || '').toLowerCase();
        const dept = (b.department || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return fullName.includes(query) || empId.includes(query) || dept.includes(query);
    });

    return (
        <div className="team-leaves-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Team Leaves Manager</h1>
                    <p className="page-subtitle">Review applications, process leave encashments, and track employee balances directory</p>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', gap: '1rem', marginBottom: '0.5rem' }}>
                {[
                    { id: 'queue', label: `📥 Pending Leaves (${pendingLeaves.length})` },
                    { id: 'encashments', label: `💰 Leave Encashments (${encashments.filter(e=>e.status==='Pending').length})` },
                    { id: 'directory', label: '📊 Employee Balances Directory' },
                    { id: 'history', label: '📜 Processed History' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '0.8rem 1.2rem',
                            border: 'none',
                            background: 'none',
                            color: activeTab === tab.id ? 'var(--primary-400)' : 'var(--text-secondary)',
                            fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                            borderBottom: activeTab === tab.id ? '3px solid var(--primary-500)' : '3px solid transparent',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease-in-out'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* SEARCH BAR (Only for Directory tab) */}
            {activeTab === 'directory' && (
                <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.2rem' }}>🔍</span>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search by Employee ID, Name, or Department..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ margin: 0 }}
                        />
                    </div>
                </div>
            )}

            {/* QUEUE TAB CONTENT */}
            {activeTab === 'queue' && (
                <div className="card">
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Pending Action Queue</span>
                        <span className="badge badge-warning" style={{ fontSize: '0.9rem' }}>{pendingLeaves.length} Requests</span>
                    </h2>

                    {pendingLeaves.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✨</div>
                            All caught up! No pending leave requests.
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Type</th>
                                        <th>Dates</th>
                                        <th>Days</th>
                                        <th>Reason</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingLeaves.map(leave => (
                                        <tr key={leave._id}>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{leave.employee?.firstName} {leave.employee?.lastName}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {leave.employee?.employeeId} | {leave.employee?.department}</div>
                                            </td>
                                            <td>{leave.leaveType}</td>
                                            <td>
                                                <div style={{ fontSize: '0.9rem' }}>{new Date(leave.fromDate).toLocaleDateString()} to</div>
                                                <div style={{ fontSize: '0.9rem' }}>{new Date(leave.toDate).toLocaleDateString()}</div>
                                            </td>
                                            <td>{leave.totalDays}</td>
                                            <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={leave.reason}>
                                                {leave.reason}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => handleStatusUpdate(leave._id, 'Approved')} className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', background: '#10b981', borderColor: '#10b981' }}>Approve</button>
                                                    <button onClick={() => handleStatusUpdate(leave._id, 'Rejected')} className="btn btn-danger" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>Reject</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ENCASHMENTS QUEUE TAB */}
            {activeTab === 'encashments' && (
                <div className="card">
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Leave Encashment Claims</span>
                        <span className="badge badge-warning" style={{ fontSize: '0.9rem' }}>{encashments.length} Claims Total</span>
                    </h2>

                    {encashments.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No leave encashment requests submitted.
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Days Encashed</th>
                                        <th>Basic Salary</th>
                                        <th>Payout Amount</th>
                                        <th>Remarks</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {encashments.map(enc => (
                                        <tr key={enc._id}>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{enc.employee?.firstName} {enc.employee?.lastName}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {enc.employee?.employeeId} | {enc.employee?.department}</div>
                                            </td>
                                            <td><strong>{enc.daysEncashed} days</strong></td>
                                            <td>AED {enc.basicSalary?.toLocaleString()}</td>
                                            <td style={{ fontWeight: 'bold', color: 'var(--primary-400)' }}>AED {enc.amount?.toLocaleString()}</td>
                                            <td>{enc.remarks || '—'}</td>
                                            <td>
                                                <span className={`badge ${
                                                    enc.status === 'Processed' ? 'badge-success' :
                                                    enc.status === 'Approved' ? 'badge-success' :
                                                    enc.status === 'Rejected' ? 'badge-danger' : 'badge-warning'
                                                }`}>
                                                    {enc.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {enc.status === 'Pending' && (
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                        <button onClick={() => handleEncashmentStatusUpdate(enc._id, 'Approved')} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#10b981', borderColor: '#10b981' }}>Approve</button>
                                                        <button onClick={() => handleEncashmentStatusUpdate(enc._id, 'Rejected')} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Reject</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* DIRECTORY TAB CONTENT */}
            {activeTab === 'directory' && (
                <div className="card" style={{ padding: 0, border: '1px solid var(--border-color)' }}>
                    <div className="table-responsive">
                        <table className="table" style={{ margin: 0 }}>
                            <thead>
                                <tr>
                                    <th>Emp ID</th>
                                    <th>Employee Name</th>
                                    <th>Dept & Title</th>
                                    <th style={{ textAlign: 'center' }}>Annual (Accrued / Taken / Bal)</th>
                                    <th style={{ textAlign: 'center' }}>Sick (Limit / Taken / Bal)</th>
                                    <th style={{ textAlign: 'center' }}>Maternity / Paternity Bal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBalances.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                            No employee records found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredBalances.map(emp => {
                                        const annual = emp.balances?.Annual || { accrued: 0, taken: 0, available: 0 };
                                        const sick = emp.balances?.Sick || { accrued: 0, taken: 0, available: 0 };
                                        const genderSpecificLabel = emp.balances?.Maternity ? 'Maternity' : 'Paternity';
                                        const genderSpecific = emp.balances?.[genderSpecificLabel] || { accrued: 0, taken: 0, available: 0 };

                                        return (
                                            <tr key={emp._id}>
                                                <td><code>{emp.employeeId}</code></td>
                                                <td style={{ fontWeight: '600' }}>{emp.firstName} {emp.lastName}</td>
                                                <td>
                                                    <div style={{ fontSize: '0.9rem' }}>{emp.department}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.designation}</div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span style={{ fontWeight: '500' }}>
                                                        {annual.accrued.toFixed(1)} / {annual.taken} / <strong style={{ color: 'var(--primary-400)' }}>{annual.available.toFixed(1)}</strong>
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span>
                                                        {sick.accrued} / {sick.taken} / <strong style={{ color: sick.available < 5 ? '#f59e0b' : 'inherit' }}>{sick.available}</strong>
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span style={{ fontSize: '0.85rem' }}>
                                                        {genderSpecificLabel}: <strong>{genderSpecific.available}</strong>
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* HISTORY TAB CONTENT */}
            {activeTab === 'history' && (
                <div className="card">
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Processed Requests Log</h2>
                    {pastLeaves.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No past processed request records found.
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Type</th>
                                        <th>Dates</th>
                                        <th>Days</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pastLeaves.map(leave => (
                                        <tr key={leave._id}>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{leave.employee?.firstName} {leave.employee?.lastName}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {leave.employee?.employeeId}</div>
                                            </td>
                                            <td>{leave.leaveType}</td>
                                            <td>{new Date(leave.fromDate).toLocaleDateString()} - {new Date(leave.toDate).toLocaleDateString()}</td>
                                            <td>{leave.totalDays}</td>
                                            <td>
                                                <span className={`badge ${leave.status === 'Approved' ? 'badge-success' :
                                                        leave.status === 'Rejected' ? 'badge-danger' : 'badge-warning'
                                                    }`}>
                                                    {leave.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
