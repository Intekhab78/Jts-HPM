import { useState, useEffect } from 'react';
import { getBaseUrl } from '../../api/config';
import { getAttendance, lockAttendance, approveAttendance, deleteAttendance } from '../../api/attendanceApi';
import { getEmployees } from '../../api/employeeApi';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import WebcamPunch from '../../components/Biometric/WebcamPunch';
import AttendanceRequestModal from '../../components/Biometric/AttendanceRequestModal';

export default function AttendanceDashboard() {
    const { user } = useAuth();
    const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const isManager = user?.isManager || userRole === 'manager';
    const [attendance, setAttendance] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);

    const [filters, setFilters] = useState({
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
        employeeId: ''
    });

    useEffect(() => {
        if (userRole === 'admin' || userRole === 'hr' || isManager) {
            fetchEmployees();
        }
    }, [userRole, isManager]);

    useEffect(() => {
        fetchAttendance();
    }, [filters]);

    const fetchEmployees = async () => {
        try {
            const res = await getEmployees();
            setEmployees(res.data);
        } catch (error) {
            console.error('Failed to load employees for filter');
        }
    };

    const fetchAttendance = async () => {
        try {
            setLoading(true);
            const year = filters.month.split('-')[0];
            const month = filters.month.split('-')[1];

            // Generate start and end of selected month
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

            const params = { startDate, endDate };
            if (filters.employeeId) params.employeeId = filters.employeeId;

            const res = await getAttendance(params);
            setAttendance(res.data);
        } catch (error) {
            toast.error('Failed to load attendance records');
        } finally {
            setLoading(false);
        }
    };

    const handleLock = async () => {
        if (window.confirm(`Are you sure you want to lock attendance for ${filters.month}? This is usually done before running payroll.`)) {
            try {
                const year = filters.month.split('-')[0];
                const month = filters.month.split('-')[1];
                const res = await lockAttendance(year, month);
                toast.success(res.message);
                fetchAttendance(); // Refresh to show locked status
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to lock attendance');
            }
        }
    };

    const handleApprove = async (id, status) => {
        try {
            await approveAttendance(id, status);
            toast.success(`Attendance ${status} successfully`);
            fetchAttendance();
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to ${status} attendance`);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this attendance record? This cannot be undone.')) return;
        try {
            await deleteAttendance(id);
            toast.success('Attendance record deleted');
            fetchAttendance();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete attendance record');
        }
    };

    // Calculate Summaries
    const summary = {
        present: attendance.filter(a => a.status === 'Present').length,
        late: attendance.filter(a => a.status === 'Late').length,
        absent: attendance.filter(a => a.status === 'Absent').length,
        halfDay: attendance.filter(a => a.status === 'Half Day').length,
        totalOT: attendance.reduce((acc, curr) => acc + (curr.overtimeHours || 0), 0).toFixed(1)
    };

    const isLocked = attendance.length > 0 && attendance.every(a => a.isLocked);

    return (
        <div className="attendance-dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Attendance Management</h1>
                    <p className="page-subtitle">Track daily timesheets, late arrivals, and overtime</p>
                </div>
                {(userRole === 'admin' || userRole === 'hr') && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <Link to="/attendance/upload" className="btn btn-secondary btn-outline">Bulk Upload</Link>
                        <Link to="/attendance/manual" className="btn btn-primary">
                            <span className="btn-icon">+</span> Manual Entry
                        </Link>
                    </div>
                )}
                {userRole === 'employee' && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => setShowRequestModal(true)} className="btn btn-secondary btn-outline">
                            Request Missed Punch / Manual Entry
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
                    <label className="form-label">Select Month</label>
                    <input
                        type="month"
                        className="form-control"
                        value={filters.month}
                        onChange={(e) => setFilters(prev => ({ ...prev, month: e.target.value }))}
                    />
                </div>
                {(userRole === 'admin' || userRole === 'hr' || isManager) && (
                    <div className="form-group" style={{ marginBottom: 0, minWidth: '250px', flex: 1 }}>
                        <label className="form-label">Filter by Employee</label>
                        <select
                            className="form-control"
                            value={filters.employeeId}
                            onChange={(e) => setFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                        >
                            <option value="">All Employees</option>
                            {employees.map(emp => (
                                <option key={emp._id} value={emp._id}>
                                    {emp.employeeId} - {emp.firstName} {emp.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {(userRole === 'admin' || userRole === 'hr' || userRole === 'finance') && attendance.length > 0 && (
                    <button
                        onClick={handleLock}
                        className={`btn ${isLocked ? 'btn-secondary' : 'btn-danger'}`}
                        disabled={isLocked}
                        style={{ height: '42px' }}
                    >
                        {isLocked ? '🔒 Month Locked' : 'Lock for Payroll'}
                    </button>
                )}
            </div>

            {/* Biometric Punch In (Employees only) */}
            {userRole === 'employee' && (
                <WebcamPunch onPunchSuccess={fetchAttendance} />
            )}

            {/* Summary Widget */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <SummaryCard title="Present" value={summary.present} color="#10b981" />
                <SummaryCard title="Late" value={summary.late} color="#f59e0b" />
                <SummaryCard title="Half Day" value={summary.halfDay} color="#8b5cf6" />
                <SummaryCard title="Absent" value={summary.absent} color="#ef4444" />
                <SummaryCard title="Total OT (Hrs)" value={summary.totalOT} color="#3b82f6" />
            </div>

            {/* Data Table */}
            <div className="card">
                {loading ? (
                    <div className="page-loader" style={{ minHeight: '300px' }}><div className="loader"></div></div>
                ) : attendance.length === 0 ? (
                    <div className="empty-state" style={{ padding: '3rem 0' }}>
                        <div className="empty-state-icon" style={{ fontSize: '3rem', opacity: '0.5' }}>📅</div>
                        <p className="empty-state-text">No attendance records found for this month.</p>
                        <p className="empty-state-sub">Use the Bulk Upload or Manual Entry tools to add records.</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Employee</th>
                                    <th>Check In</th>
                                    <th>Check Out</th>
                                    <th>Status</th>
                                    <th>Approval</th>
                                    <th>Late (Mins)</th>
                                    <th>OT (Hrs)</th>
                                    <th>Source</th>
                                    {(userRole === 'admin' || userRole === 'hr' || isManager) && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {attendance.map(record => {
                                    const dateObj = new Date(record.date);

                                    const formatTime = (d) => {
                                        if (!d) return '--:--';
                                        return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    };

                                    return (
                                        <tr key={record._id}>
                                            <td style={{ fontWeight: '500' }}>
                                                {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{record.employee?.firstName} {record.employee?.lastName}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{record.employee?.employeeId}</div>
                                            </td>
                                            <td style={{ color: record.lateMinutes > 0 ? '#ef4444' : 'inherit' }}>
                                                {record.checkIn ? formatTime(record.checkIn) : (record.isRequestPending && record.requestedCheckIn ? <span title="Requested Check In" style={{ color: '#d97706', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>{formatTime(record.requestedCheckIn)} <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }} className="badge badge-warning">req</span></span> : '--:--')}
                                            </td>
                                            <td>
                                                {record.checkOut ? formatTime(record.checkOut) : (record.isRequestPending && record.requestedCheckOut ? <span title="Requested Check Out" style={{ color: '#d97706', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>{formatTime(record.requestedCheckOut)} <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }} className="badge badge-warning">req</span></span> : '--:--')}
                                            </td>
                                            <td>
                                                <span className={`badge ${record.status === 'Present' ? 'badge-success' :
                                                    record.status === 'Absent' ? 'badge-danger' :
                                                        record.status === 'Late' || record.status === 'Half Day' ? 'badge-warning' : 'badge-secondary'
                                                    }`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${record.approvalStatus === 'Approved' ? 'badge-success' :
                                                    record.approvalStatus === 'Auto-Approved' ? 'badge-primary' :
                                                        record.approvalStatus === 'Rejected' ? 'badge-danger' : 'badge-warning'
                                                    }`} style={{ fontSize: '0.7rem' }}>
                                                    {record.approvalStatus || 'Auto-Approved'}
                                                </span>
                                            </td>
                                            <td style={{ color: record.lateMinutes > 0 ? '#ef4444' : 'inherit', fontWeight: record.lateMinutes > 0 ? '600' : 'normal' }}>
                                                {record.lateMinutes > 0 ? record.lateMinutes : '-'}
                                            </td>
                                            <td style={{ color: record.overtimeHours > 0 ? '#3b82f6' : 'inherit', fontWeight: record.overtimeHours > 0 ? '600' : 'normal' }}>
                                                {record.overtimeHours > 0 ? record.overtimeHours : '-'}
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                                    <span>{record.source} {record.isLocked && '🔒'}</span>
                                                    {record.isRequestPending && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{record.requestType} Pending</span>}
                                                    {record.punchInPhoto && <a href={`${getBaseUrl()}${record.punchInPhoto}`} target="_blank" rel="noreferrer" title="View Punch In Photo">📸</a>}
                                                    {record.punchInLocation?.lat && <a href={`https://maps.google.com/?q=${record.punchInLocation.lat},${record.punchInLocation.lng}`} target="_blank" rel="noreferrer" title={`Lat: ${record.punchInLocation.lat}, Lng: ${record.punchInLocation.lng}`}>📍</a>}
                                                </div>
                                                {record.isRequestPending && (userRole === 'admin' || userRole === 'hr' || isManager) && (
                                                    <div style={{ marginTop: '0.25rem', padding: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#d97706' }}>Requested Update:</div>
                                                        <div style={{ fontSize: '0.7rem' }}>In: {record.requestedCheckIn ? formatTime(record.requestedCheckIn) : 'N/A'}</div>
                                                        <div style={{ fontSize: '0.7rem' }}>Out: {record.requestedCheckOut ? formatTime(record.requestedCheckOut) : 'N/A'}</div>
                                                        {record.requestReason && <div style={{ fontSize: '0.7rem', fontStyle: 'italic', marginTop: '2px' }}>"{record.requestReason}"</div>}
                                                    </div>
                                                )}
                                                {record.faceMatchScore !== undefined && (userRole === 'admin' || userRole === 'hr' || isManager) && (
                                                    <div style={{ marginTop: '0.25rem' }}>
                                                        <span className={`badge ${record.faceMatchFailed ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', display: 'flex', alignItems: 'center', gap: '2px', width: 'fit-content' }}>
                                                            {record.faceMatchFailed ? '⚠️' : '✅'} {Math.max(0, Math.round((1 - record.faceMatchScore) * 100))}% Match
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            {(userRole === 'admin' || userRole === 'hr' || isManager) && (
                                                <td>
                                                    {!record.isLocked && (
                                                        <>
                                                            {((isManager && record.approvalStatus === 'Pending Manager') ||
                                                                ((userRole === 'hr' || userRole === 'admin') && record.approvalStatus.startsWith('Pending'))) &&
                                                                (record.employee?._id !== user?.employeeRef) && (
                                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                        <button onClick={() => handleApprove(record._id, 'Approved')} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#10b981', borderColor: '#10b981' }}>✔</button>
                                                                        <button onClick={() => handleApprove(record._id, 'Rejected')} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>✖</button>
                                                                    </div>
                                                                )}
                                                        </>
                                                    )}
                                                    {!record.isLocked && (userRole === 'admin' || userRole === 'hr') && (
                                                        <button onClick={() => handleDelete(record._id)} className="btn btn-secondary btn-outline" title="Delete Record" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444', marginTop: '4px' }}>🗑</button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {showRequestModal && (
                    <AttendanceRequestModal
                        onClose={() => setShowRequestModal(false)}
                        onSuccess={() => {
                            setShowRequestModal(false);
                            fetchAttendance();
                        }}
                    />
                )}
            </div>
        </div>
    );
}

function SummaryCard({ title, value, color }) {
    return (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>{title}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color }}>{value}</div>
        </div>
    );
}
