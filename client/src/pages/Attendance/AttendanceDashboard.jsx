import { useState, useEffect } from 'react';
import { getAttendance, lockAttendance, approveAttendance, deleteAttendance, deletePunchLog, getUnregisteredFaceLogs } from '../../api/attendanceApi';
import { getEmployees } from '../../api/employeeApi';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import WebcamPunch from '../../components/Biometric/WebcamPunch';
import AttendanceRequestModal from '../../components/Biometric/AttendanceRequestModal';
import UnregisteredVisitorsLog from '../../components/Biometric/UnregisteredVisitorsLog';

export default function AttendanceDashboard() {
    const { user } = useAuth();
    const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const isManager = user?.isManager || userRole === 'manager';
    const [attendance, setAttendance] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [expandedRecordPunches, setExpandedRecordPunches] = useState({});
    const [showImageModal, setShowImageModal] = useState(null);
    const [activeTab, setActiveTab] = useState('employee-attendance'); // 'employee-attendance' | 'unregistered-visitors'
    const [unregisteredCount, setUnregisteredCount] = useState(0);

    // Delete Modal State
    const [deleteModalData, setDeleteModalData] = useState(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);

    const [filters, setFilters] = useState({
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
        employeeId: ''
    });

    useEffect(() => {
        fetchEmployees();
        fetchUnregisteredSummary();
        const interval = setInterval(fetchUnregisteredSummary, 20000);
        return () => clearInterval(interval);
    }, []);

    const fetchUnregisteredSummary = async () => {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const res = await getUnregisteredFaceLogs({ startDate: todayStr, endDate: todayStr, limit: 1 });
            if (res?.summary) {
                setUnregisteredCount(res.summary.todayVisitors || 0);
            }
        } catch (e) {
            // Ignore silent error
        }
    };

    useEffect(() => {
        if (activeTab === 'employee-attendance') {
            fetchAttendance();
        }
    }, [filters, activeTab]);

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

    const openDeleteRecordModal = (record) => {
        const dateObj = new Date(record.date);
        const formatTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
        setDeleteModalData({
            type: 'record',
            id: record._id,
            employeeName: `${record.employee?.firstName} ${record.employee?.lastName} (${record.employee?.employeeId || 'N/A'})`,
            dateStr: dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
            details: `Status: ${record.status} | In: ${formatTime(record.checkIn)} | Out: ${formatTime(record.checkOut)}`
        });
        setDeleteReason('');
    };

    const openDeletePunchModal = (record, punch) => {
        const dateObj = new Date(record.date);
        const pTime = new Date(punch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setDeleteModalData({
            type: 'punch',
            id: punch._id,
            employeeName: `${record.employee?.firstName} ${record.employee?.lastName} (${record.employee?.employeeId || 'N/A'})`,
            dateStr: dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
            details: `Punch Time: ${pTime} | Method: ${punch.punchMethod || 'Face'} | Direction: ${punch.punchType || 'auto'}`
        });
        setDeleteReason('');
    };

    const handleConfirmDelete = async () => {
        if (!deleteReason.trim()) {
            toast.error('Deletion reason / message is mandatory');
            return;
        }

        setDeleteSubmitting(true);
        try {
            if (deleteModalData.type === 'record') {
                const res = await deleteAttendance(deleteModalData.id, deleteReason.trim());
                toast.success(res.message || 'Attendance record deleted successfully');
            } else if (deleteModalData.type === 'punch') {
                const res = await deletePunchLog(deleteModalData.id, deleteReason.trim());
                toast.success(res.message || 'Punch log deleted successfully');
            }
            setDeleteModalData(null);
            setDeleteReason('');
            fetchAttendance();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete');
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const toggleExpandedPunches = (id) => {
        setExpandedRecordPunches(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const summary = {
        present: attendance.filter(a => a.status === 'Present').length,
        late: attendance.filter(a => a.status === 'Late' || Number(a.lateMinutes) > 0).length,
        absent: attendance.filter(a => a.status === 'Absent').length,
        halfDay: attendance.filter(a => a.status === 'Half Day').length,
        totalOT: attendance.reduce((acc, curr) => acc + (Number(curr.overtimeHours) || 0) + (Number(curr.holidayOvertimeHours) || 0), 0).toFixed(1)
    };

    const isLocked = attendance.length > 0 && attendance.every(a => a.isLocked);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Present': return 'badge-success';
            case 'Absent': return 'badge-danger';
            case 'Late': return 'badge-warning';
            case 'Half Day': return 'badge-warning';
            default: return 'badge-secondary';
        }
    };

    const formatTime = (d) => {
        if (!d) return '--:--';
        return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

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
            {/* TOP NAVIGATION TABS */}
            {(userRole === 'admin' || userRole === 'hr' || isManager) && (
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('employee-attendance')}
                        className={`btn ${activeTab === 'employee-attendance' ? 'btn-primary' : 'btn-secondary btn-outline'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600' }}
                    >
                        <span>👤</span> Employee Attendance Records
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('unregistered-visitors')}
                        className={`btn ${activeTab === 'unregistered-visitors' ? 'btn-primary' : 'btn-secondary btn-outline'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600' }}
                    >
                        <span>📹</span> Unregistered Visitors / Strangers Log
                        {unregisteredCount > 0 && (
                            <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', marginLeft: '4px' }}>
                                {unregisteredCount} Today
                            </span>
                        )}
                    </button>
                </div>
            )}

            {activeTab === 'unregistered-visitors' ? (
                <UnregisteredVisitorsLog />
            ) : (
                <>
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
                                    {emp.firstName} {emp.lastName} ({emp.employeeId})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
                    {(userRole === 'admin' || userRole === 'hr') && (
                        <button
                            onClick={handleLock}
                            className={`btn ${isLocked ? 'btn-secondary' : 'btn-danger'}`}
                            disabled={isLocked || attendance.length === 0}
                        >
                            {isLocked ? 'Month Locked 🔒' : 'Lock for Payroll'}
                        </button>
                    )}
                </div>
            </div>

            {userRole === 'employee' && (
                <WebcamPunch onPunchSuccess={fetchAttendance} />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <SummaryCard title="Present" value={summary.present} color="#10b981" />
                <SummaryCard title="Late" value={summary.late} color="#f59e0b" />
                <SummaryCard title="Half Day" value={summary.halfDay} color="#8b5cf6" />
                <SummaryCard title="Absent" value={summary.absent} color="#ef4444" />
                <SummaryCard title="Total OT (Hrs)" value={summary.totalOT} color="#3b82f6" />
            </div>

            <div className="card">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>Loading attendance records...</div>
                ) : attendance.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📅</div>
                        <p className="empty-state-text">No attendance records found for this period</p>
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
                                    <th>Late</th>
                                    <th>OT</th>
                                    <th>Source</th>
                                    {(userRole === 'admin' || userRole === 'hr' || isManager) && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {attendance.map((record) => {
                                    const dateObj = new Date(record.date);
                                    const dateFormatted = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                    const yearFormatted = dateObj.getFullYear();

                                    const regOT = Number(record.overtimeHours) || 0;
                                    const holOT = Number(record.holidayOvertimeHours) || 0;
                                    const totOT = parseFloat((regOT + holOT).toFixed(2));
                                    const lateMins = Number(record.lateMinutes) || 0;

                                    const kioskName = record.kioskDevice?.description?.trim() 
                                        || record.kioskDevice?.name 
                                        || (record.kioskDevice?.brand ? `${record.kioskDevice.brand} ${record.kioskDevice.model || ''}`.trim() : 'Active');

                                    return (
                                        <tr key={record._id}>
                                            <td style={{ fontWeight: '500' }}>
                                                {dateFormatted}
                                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {yearFormatted}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>
                                                    {record.employee?.firstName} {record.employee?.lastName}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {record.employee?.employeeId}
                                                </div>
                                            </td>
                                            <td>{formatTime(record.checkIn)}</td>
                                            <td>{formatTime(record.checkOut)}</td>
                                            <td>
                                                <span className={`badge ${getStatusBadge(record.status)}`}>
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
                                            <td style={{ color: lateMins > 0 ? '#ef4444' : 'inherit', fontWeight: lateMins > 0 ? '600' : 'normal' }}>
                                                {lateMins > 0 ? `${lateMins} mins` : '-'}
                                            </td>
                                            <td>
                                                {totOT > 0 ? (
                                                    <div>
                                                        <span style={{ color: holOT > 0 ? '#10b981' : '#3b82f6', fontWeight: '600' }}>
                                                            {totOT} hrs
                                                        </span>
                                                        {holOT > 0 && (
                                                            <span style={{ display: 'block', fontSize: '0.65rem', color: '#10b981', marginTop: '1px' }}>
                                                                (Weekend/Holiday)
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                                    <span>
                                                         {record.source} 
                                                         {record.punchMethod ? ` - ${record.punchMethod}` : ''}
                                                         {record.kioskDevice ? ` (Kiosk: ${kioskName})` : ''}
                                                         {record.isLocked && ' 🔒'}
                                                     </span>
                                                    {record.isRequestPending && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>{record.requestType} Pending</span>}
                                                    {record.punchInPhoto && <a href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${record.punchInPhoto}`} target="_blank" rel="noreferrer" title="View Punch In Photo">📸</a>}
                                                    {record.punchInLocation?.lat && <a href={`https://maps.google.com/?q=${record.punchInLocation.lat},${record.punchInLocation.lng}`} target="_blank" rel="noreferrer" title={`Lat: ${record.punchInLocation.lat}, Lng: ${record.punchInLocation.lng}`}>📍</a>}
                                                </div>
                                                {record.geoFenceWarning && (
                                                    <div style={{ marginTop: '0.25rem', padding: '0.3rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.7rem', color: '#ef4444', fontWeight: '600' }}>
                                                        ⚠️ {record.geoFenceWarning}
                                                    </div>
                                                )}
                                                {record.isRequestPending && (userRole === 'admin' || userRole === 'hr' || isManager) && (
                                                    <div style={{ marginTop: '0.25rem', padding: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#d97706' }}>Requested Update:</div>
                                                        <div style={{ fontSize: '0.7rem' }}>In: {record.requestedCheckIn ? formatTime(record.requestedCheckIn) : 'N/A'}</div>
                                                        <div style={{ fontSize: '0.7rem' }}>Out: {record.requestedCheckOut ? formatTime(record.requestedCheckOut) : 'N/A'}</div>
                                                        {record.requestReason && <div style={{ fontSize: '0.7rem', fontStyle: 'italic', marginTop: '2px' }}>"{record.requestReason}"</div>}
                                                    </div>
                                                )}
                                                {record.faceMatchScore !== undefined && (userRole === 'admin' || userRole === 'hr' || isManager) && (() => {
                                                    const rawVal = Number(record.faceMatchScore);
                                                    const finalScore = rawVal <= 1.0 ? Math.max(0, Math.min(100, Math.round((1.0 - rawVal) * 100))) : Math.max(0, Math.min(100, Math.round(rawVal)));
                                                    const isSuccess = !record.faceMatchFailed && finalScore >= 50;
                                                    return (
                                                        <div style={{ marginTop: '0.25rem' }}>
                                                            <span className={`badge ${isSuccess ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', display: 'flex', alignItems: 'center', gap: '2px', width: 'fit-content' }}>
                                                                {isSuccess ? '✅' : '⚠️'} {finalScore}% Match
                                                            </span>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Daily Punch Logs Timeline (Unified Multi-Source View) */}
                                                {record.punches && record.punches.length > 0 && (
                                                    <div style={{ marginTop: '0.5rem' }}>
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-link btn-sm p-0 font-weight-bold" 
                                                            style={{ fontSize: '0.75rem', textDecoration: 'underline', color: 'var(--primary-color)' }}
                                                            onClick={() => toggleExpandedPunches(record._id)}
                                                        >
                                                            {expandedRecordPunches[record._id] ? 'Hide Punch Timeline ▲' : `View Daily Punches (${record.punches.length}) ▼`}
                                                        </button>

                                                        {expandedRecordPunches[record._id] && (
                                                            <div style={{ marginTop: '0.5rem', background: 'var(--bg-tertiary)', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', minWidth: '280px' }}>
                                                                <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                    Chronological Punch Log ({record.punches.length} records)
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    {record.punches.map((p, idx) => {
                                                                        const pTime = new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                                                        const isFace = p.punchMethod === 'Face' || p.punchMethod === 'IP-Camera';
                                                                        const rawPScore = p.faceMatchScore !== undefined ? Number(p.faceMatchScore) : 100;
                                                                        const pScore = isFace
                                                                            ? (rawPScore <= 1.0 ? Math.max(0, Math.min(100, Math.round((1.0 - rawPScore) * 100))) : Math.max(0, Math.min(100, Math.round(rawPScore))))
                                                                            : 100;
                                                                        
                                                                        const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');
                                                                        const photoUrl = p.photoPath ? `${baseUrl}${p.photoPath.startsWith('/') ? p.photoPath : '/' + p.photoPath}` : null;
                                                                        
                                                                        // Punch Method icon badge mapping
                                                                        const getMethodIcon = (m) => {
                                                                            switch(m) {
                                                                                case 'GPS-Selfie': return '📱 Mobile GPS';
                                                                                case 'IP-Camera': return '🎥 IP Camera';
                                                                                case 'Face': return '👤 Kiosk Face';
                                                                                case 'PIN': return '🔢 PIN';
                                                                                case 'QR': return '🏷️ QR';
                                                                                default: return m || 'Biometric';
                                                                            }
                                                                        };

                                                                        const deviceLabel = p.kioskDevice?.description?.trim() || (p.kioskDevice?.brand ? `${p.kioskDevice.brand} ${p.kioskDevice.model || ''}`.trim() : null);

                                                                        return (
                                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: idx < record.punches.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingBottom: '6px', gap: '8px', flexWrap: 'wrap' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{pTime}</span>
                                                                                    <span style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', color: '#f3f4f6' }}>
                                                                                        {getMethodIcon(p.punchMethod)}
                                                                                    </span>
                                                                                    {deviceLabel && (
                                                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem' }}>
                                                                                            • {deviceLabel}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                                                                                    {p.location?.lat && (
                                                                                        <a 
                                                                                            href={`https://maps.google.com/?q=${p.location.lat},${p.location.lng}`} 
                                                                                            target="_blank" 
                                                                                            rel="noreferrer" 
                                                                                            title={`View GPS Map (${p.location.lat.toFixed(5)}, ${p.location.lng.toFixed(5)})`}
                                                                                            style={{ textDecoration: 'none', fontSize: '0.85rem' }}
                                                                                        >
                                                                                            📍
                                                                                        </a>
                                                                                    )}
                                                                                    {photoUrl && (
                                                                                        <img 
                                                                                            src={photoUrl} 
                                                                                            alt="Punch Audit" 
                                                                                            title="Click to view photo"
                                                                                            style={{ width: '24px', height: '24px', borderRadius: '4px', cursor: 'pointer', objectFit: 'cover', border: '1px solid var(--border-color)' }} 
                                                                                            onClick={() => setShowImageModal(photoUrl)}
                                                                                        />
                                                                                    )}
                                                                                    <span className={`badge ${pScore >= 50 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                                                                                        {pScore}%
                                                                                    </span>
                                                                                    {(userRole === 'admin' || userRole === 'hr') && !record.isLocked && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => openDeletePunchModal(record, p)}
                                                                                            title="Delete this punch log"
                                                                                            style={{
                                                                                                background: 'transparent',
                                                                                                border: 'none',
                                                                                                color: '#ef4444',
                                                                                                cursor: 'pointer',
                                                                                                padding: '0 2px',
                                                                                                fontSize: '0.75rem',
                                                                                                lineHeight: 1
                                                                                            }}
                                                                                        >
                                                                                            🗑️
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                             </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            {(userRole === 'admin' || userRole === 'hr' || isManager) && (
                                                <td>
                                                    {!record.isLocked && (
                                                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                                            {((isManager && record.approvalStatus === 'Pending Manager') ||
                                                                ((userRole === 'hr' || userRole === 'admin') && record.approvalStatus.startsWith('Pending'))) && (
                                                                    <>
                                                                        <button onClick={() => handleApprove(record._id, 'Approved')} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#10b981', borderColor: '#10b981' }}>✔</button>
                                                                        <button onClick={() => handleApprove(record._id, 'Rejected')} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>✖</button>
                                                                    </>
                                                                )}
                                                            {(userRole === 'admin' || userRole === 'hr') && (
                                                                <button
                                                                    onClick={() => openDeleteRecordModal(record)}
                                                                    className="btn btn-secondary btn-outline"
                                                                    title="Delete attendance row"
                                                                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.8rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                                                >
                                                                    🗑️
                                                                </button>
                                                            )}
                                                        </div>
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
                {showImageModal && (
                    <div
                        onClick={() => setShowImageModal(null)}
                        style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.85)', zIndex: 9999,
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            cursor: 'zoom-out', padding: '2rem'
                        }}
                    >
                        <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                            <img
                                src={showImageModal}
                                alt="Zoom Preview"
                                style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', border: '3px solid #fff', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                            />
                            <div style={{ position: 'absolute', top: '-40px', right: 0, color: '#fff', fontSize: '1rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                                Click anywhere to close
                            </div>
                        </div>
                    </div>
                )}

                {/* MANDATORY REASON DELETION CONFIRMATION MODAL */}
                {deleteModalData && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.75)',
                            zIndex: 9999,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: '1.5rem'
                        }}
                    >
                        <div
                            style={{
                                background: 'var(--bg-secondary, #1f2937)',
                                border: '1px solid var(--border-color, #374151)',
                                borderRadius: '12px',
                                padding: '1.75rem',
                                maxWidth: '520px',
                                width: '100%',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', borderBottom: '1px solid var(--border-color, #374151)', paddingBottom: '0.75rem' }}>
                                <span style={{ fontSize: '1.5rem' }}>🗑️</span>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ef4444' }}>
                                        {deleteModalData.type === 'record' ? 'Delete Daily Attendance Record' : 'Delete Single Punch Line'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)' }}>
                                        Administrative action is tracked in the audit trail.
                                    </p>
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-tertiary, #111827)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid var(--border-color, #374151)' }}>
                                <div style={{ fontSize: '0.85rem', marginBottom: '4px', color: '#f3f4f6' }}>
                                    <strong>Employee:</strong> {deleteModalData.employeeName}
                                </div>
                                <div style={{ fontSize: '0.85rem', marginBottom: '4px', color: '#f3f4f6' }}>
                                    <strong>Date:</strong> {deleteModalData.dateStr}
                                </div>
                                {deleteModalData.details && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)' }}>
                                        <strong>Details:</strong> {deleteModalData.details}
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label" style={{ fontWeight: '600', color: '#f59e0b', display: 'block', marginBottom: '6px' }}>
                                    Reason / Remarks for Deletion <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <textarea
                                    className="form-control"
                                    rows="3"
                                    required
                                    placeholder="Please provide a mandatory reason for deleting this entry (e.g. accidental double punch, camera testing, mistaken manual punch)..."
                                    value={deleteReason}
                                    onChange={(e) => setDeleteReason(e.target.value)}
                                    style={{ width: '100%', resize: 'vertical', background: 'var(--bg-tertiary, #111827)', color: '#fff', border: '1px solid var(--border-color, #374151)', padding: '0.5rem', borderRadius: '6px' }}
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #9ca3af)', marginTop: '4px' }}>
                                    * A clear justification is mandatory and will be permanently stored.
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setDeleteModalData(null)}
                                    disabled={deleteSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={handleConfirmDelete}
                                    disabled={deleteSubmitting || !deleteReason.trim()}
                                    style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                                >
                                    {deleteSubmitting ? 'Deleting...' : 'Confirm & Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
                </>
            )}
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
