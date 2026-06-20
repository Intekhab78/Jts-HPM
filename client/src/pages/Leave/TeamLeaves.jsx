import { useState, useEffect } from 'react';
import { getAllLeaves, updateLeaveAction } from '../../api/leaveApi';
import toast from 'react-hot-toast';

export default function TeamLeaves() {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaves();
    }, []);

    const fetchLeaves = async () => {
        try {
            setLoading(true);
            const res = await getAllLeaves();
            setLeaves(res.data);
        } catch (error) {
            toast.error('Failed to fetch team leaves');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await updateLeaveAction(id, { status });
            toast.success(`Leave ${status.toLowerCase()} successfully`);
            fetchLeaves();
        } catch (error) {
            toast.error('Failed to update leave status');
        }
    };

    if (loading) return <div className="page-loader"><div className="loader"></div></div>;

    const pendingLeaves = leaves.filter(l => l.status === 'Pending');
    const pastLeaves = leaves.filter(l => l.status !== 'Pending');

    return (
        <div className="team-leaves-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Team Leaves Queue</h1>
                    <p className="page-subtitle">Review and manage employee leave requests</p>
                </div>
            </div>

            {/* Approvals Action Queue */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Pending Action</span>
                    <span className="badge badge-warning" style={{ fontSize: '0.9rem' }}>{pendingLeaves.length} Requests</span>
                </h2>

                {pendingLeaves.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
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
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{leave.employee?.department}</div>
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

            {/* History */}
            <div className="card">
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Processed Requests</h2>
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
                                    <td>{leave.employee?.firstName} {leave.employee?.lastName}</td>
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
            </div>
        </div>
    );
}
