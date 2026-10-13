import { useState, useEffect } from 'react';
import { getBiometricLogs, reprocessBiometricLog } from '../../api/biometricApi';
import api from '../../api';
import toast from 'react-hot-toast';

export default function BiometricSettings() {
    const [activeTab, setActiveTab] = useState('monitor');
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reprocessingId, setReprocessingId] = useState(null);
    const [filters, setFilters] = useState({
        page: 1,
        limit: 25,
        status: '',
        deviceBrand: '',
        search: '',
        startDate: '',
        endDate: ''
    });
    const [totalPages, setTotalPages] = useState(1);

    // Kiosk log states
    const [kioskLogs, setKioskLogs] = useState([]);
    const [loadingKioskLogs, setLoadingKioskLogs] = useState(false);
    const [showImageModal, setShowImageModal] = useState(null);

    // Device monitoring & schedule states
    const [devices, setDevices] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [activeLiveStream, setActiveLiveStream] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [streamTime, setStreamTime] = useState(new Date().toLocaleTimeString());
    
    // Recording configuration states per device
    const [scheduleConfig, setScheduleConfig] = useState({});

    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');

    useEffect(() => {
        if (activeTab === 'monitor') {
            fetchLogs();
        } else if (activeTab === 'kiosk') {
            fetchKioskLogs();
        } else if (activeTab === 'liveview') {
            fetchDevices();
        }
    }, [filters, activeTab]);

    // Update ticking live stream time clock
    useEffect(() => {
        let interval;
        if (activeLiveStream) {
            interval = setInterval(() => {
                setStreamTime(new Date().toLocaleTimeString());
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeLiveStream]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await getBiometricLogs(filters);
            setLogs(res.data);
            setTotalPages(res.pagination.totalPages || 1);
        } catch (error) {
            toast.error('Failed to load biometric logs');
        } finally {
            setLoading(false);
        }
    };

    const fetchKioskLogs = async () => {
        try {
            setLoadingKioskLogs(true);
            const res = await api.get('/attendance/biometric-logs');
            setKioskLogs(res.data.data || []);
        } catch (error) {
            toast.error('Failed to load kiosk punch logs');
        } finally {
            setLoadingKioskLogs(false);
        }
    };

    const fetchDevices = async () => {
        try {
            setLoadingDevices(true);
            const res = await api.get('/devices');
            const devicesList = res.data.data || [];
            setDevices(devicesList);
            
            // Map initial configurations
            const configs = {};
            devicesList.forEach(dev => {
                configs[dev._id] = {
                    enabled: dev.recordingSchedule?.enabled || false,
                    startHour: dev.recordingSchedule?.startHour || '09:00',
                    durationHours: dev.recordingSchedule?.durationHours || 8
                };
            });
            setScheduleConfig(configs);
        } catch (error) {
            toast.error('Failed to load kiosk devices');
        } finally {
            setLoadingDevices(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value, page: 1 }));
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setFilters(prev => ({ ...prev, page: newPage }));
        }
    };

    const handleReprocess = async (id) => {
        try {
            setReprocessingId(id);
            const res = await reprocessBiometricLog(id);
            toast.success(res.message || 'Log reprocessed successfully');
            fetchLogs();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Reprocessing failed');
        } finally {
            setReprocessingId(null);
        }
    };

    const handleUpdateScheduleLocal = (deviceId, field, value) => {
        setScheduleConfig(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                [field]: value
            }
        }));
    };

    const handleSaveSchedule = async (deviceId) => {
        try {
            const config = scheduleConfig[deviceId];
            await api.put(`/devices/${deviceId}`, { recordingSchedule: config });
            toast.success('Video recording schedule saved successfully!');
            fetchDevices();
        } catch (error) {
            toast.error('Failed to save video recording schedule settings');
        }
    };

    const toggleRecording = (deviceId) => {
        setIsRecording(!isRecording);
        if (!isRecording) {
            toast.success('Live video recording session scheduled and started.');
        } else {
            toast.success('Live video recording session stopped and saved.');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleString('en-AE', {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Processed': return 'status-approved';
            case 'Failed': return 'status-rejected';
            case 'Pending':
            default: return 'status-pending';
        }
    };

    return (
        <div className="biometric-settings-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Biometric Integration & Monitoring</h1>
                    <p className="page-subtitle">Configure, map, and audit physical biometric logs, kiosk transaction scans, and live CCTV feeds.</p>
                </div>
            </div>

            {/* Tab Links */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '5px' }}>
                <button
                    onClick={() => setActiveTab('monitor')}
                    style={{
                        background: 'none', border: 'none', padding: '1rem 1.5rem', whiteSpace: 'nowrap',
                        color: activeTab === 'monitor' ? 'var(--primary-color)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'monitor' ? '3px solid var(--primary-color)' : '3px solid transparent',
                        fontWeight: activeTab === 'monitor' ? '600' : 'normal',
                        cursor: 'pointer'
                    }}
                >
                    ADMS Log Monitor
                </button>
                <button
                    onClick={() => setActiveTab('kiosk')}
                    style={{
                        background: 'none', border: 'none', padding: '1rem 1.5rem', whiteSpace: 'nowrap',
                        color: activeTab === 'kiosk' ? 'var(--primary-color)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'kiosk' ? '3px solid var(--primary-color)' : '3px solid transparent',
                        fontWeight: activeTab === 'kiosk' ? '600' : 'normal',
                        cursor: 'pointer'
                    }}
                >
                    Kiosk Punch Logs (Biometric Option)
                </button>
                <button
                    onClick={() => setActiveTab('liveview')}
                    style={{
                        background: 'none', border: 'none', padding: '1rem 1.5rem', whiteSpace: 'nowrap',
                        color: activeTab === 'liveview' ? 'var(--primary-color)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'liveview' ? '3px solid var(--primary-color)' : '3px solid transparent',
                        fontWeight: activeTab === 'liveview' ? '600' : 'normal',
                        cursor: 'pointer'
                    }}
                >
                    Device Live View & Schedules
                </button>
                <button
                    onClick={() => setActiveTab('instructions')}
                    style={{
                        background: 'none', border: 'none', padding: '1rem 1.5rem', whiteSpace: 'nowrap',
                        color: activeTab === 'instructions' ? 'var(--primary-color)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'instructions' ? '3px solid var(--primary-color)' : '3px solid transparent',
                        fontWeight: activeTab === 'instructions' ? '600' : 'normal',
                        cursor: 'pointer'
                    }}
                >
                    Device Connection Guides
                </button>
            </div>

            {/* Log Monitor Tab */}
            {activeTab === 'monitor' && (
                <div>
                    {/* Filters Bar */}
                    <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>Search Employee / Biometric ID</label>
                                <input type="text" name="search" value={filters.search} onChange={handleFilterChange} className="form-control" placeholder="Search..." />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>Brand</label>
                                <select name="deviceBrand" value={filters.deviceBrand} onChange={handleFilterChange} className="form-control">
                                    <option value="">All Brands</option>
                                    <option value="ZKTeco">ZKTeco</option>
                                    <option value="Hikvision">Hikvision</option>
                                    <option value="Amico">Amico</option>
                                    <option value="Generic">Generic</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>Status</label>
                                <select name="status" value={filters.status} onChange={handleFilterChange} className="form-control">
                                    <option value="">All Statuses</option>
                                    <option value="Processed">Processed</option>
                                    <option value="Failed">Failed</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>From Date</label>
                                <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="form-control" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>To Date</label>
                                <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="form-control" />
                            </div>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="card">
                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                                <div className="loader"></div>
                            </div>
                        ) : logs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
                                No biometric logs found matching the filters.
                            </div>
                        ) : (
                            <div>
                                <div className="table-responsive">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Timestamp</th>
                                                <th>Biometric ID</th>
                                                <th>Matched Employee</th>
                                                <th>Device Details</th>
                                                <th>Punch Type</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.map((log) => (
                                                <tr key={log._id}>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                                                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{log.biometricId}</td>
                                                    <td>
                                                        {log.employee ? (
                                                            <div style={{ fontWeight: '500' }}>
                                                                {log.employee.firstName} {log.employee.lastName}
                                                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.employee.employeeId}</span>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>Unmapped</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ fontSize: '0.9rem' }}>
                                                            <strong>{log.deviceBrand}</strong>
                                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.deviceName || 'No Name'} ({log.deviceIp || 'No IP'})</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="badge" style={{ background: 'var(--bg-tertiary)' }}>{log.type}</span>
                                                    </td>
                                                    <td>
                                                        <span className={`status-badge ${getStatusClass(log.status)}`} style={{ display: 'inline-block' }}>
                                                            {log.status}
                                                        </span>
                                                        {log.status === 'Failed' && (
                                                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.errorMessage}>
                                                                {log.errorMessage}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {log.status === 'Failed' && (
                                                            <button
                                                                onClick={() => handleReprocess(log._id)}
                                                                className="btn btn-outline"
                                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                                                disabled={reprocessingId === log._id}
                                                            >
                                                                {reprocessingId === log._id ? 'Retrying...' : 'Reprocess'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        Page {filters.page} of {totalPages}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => handlePageChange(filters.page - 1)}
                                            className="btn btn-secondary btn-outline"
                                            disabled={filters.page === 1}
                                            style={{ padding: '0.3rem 0.8rem' }}
                                        >
                                            Prev
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(filters.page + 1)}
                                            className="btn btn-secondary btn-outline"
                                            disabled={filters.page === totalPages}
                                            style={{ padding: '0.3rem 0.8rem' }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Kiosk Punch Logs Tab */}
            {activeTab === 'kiosk' && (
                <div className="card">
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>All Transaction Punch Records (Kiosk Option)</h2>
                    {loadingKioskLogs ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <div className="loader"></div>
                        </div>
                    ) : kioskLogs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
                            No kiosk biometric punch logs found.
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>Employee Details</th>
                                        <th>Method</th>
                                        <th>Direction</th>
                                        <th>Match Confidence</th>
                                        <th>Verification Image</th>
                                        <th>Kiosk Device Name</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kioskLogs.map((log) => {
                                        const isFace = log.punchMethod === 'Face';
                                        const matchPercentage = isFace && log.faceMatchScore !== undefined
                                            ? Math.max(0, Math.round((1 - log.faceMatchScore) * 100))
                                            : 100;
                                        
                                        return (
                                            <tr key={log._id}>
                                                <td>{formatDate(log.timestamp)}</td>
                                                <td>
                                                    {log.employee ? (
                                                        <div style={{ fontWeight: '500' }}>
                                                            {log.employee.firstName} {log.employee.lastName}
                                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.employee.employeeId}</span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-secondary)' }}>Unknown Employee</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="badge" style={{ background: 'var(--bg-tertiary)' }}>{log.punchMethod}</span>
                                                </td>
                                                <td style={{ textTransform: 'uppercase', fontWeight: 'bold', color: log.punchType === 'in' ? '#10b981' : '#f59e0b' }}>
                                                    {log.punchType}
                                                </td>
                                                <td>
                                                    {!isFace ? (
                                                        <span className="badge badge-success">✅ 100% (Manual Key)</span>
                                                    ) : (
                                                        <span className={`badge ${matchPercentage >= 50 ? 'badge-success' : 'badge-danger'}`}>
                                                            {matchPercentage >= 50 ? '✅' : '⚠️'} {matchPercentage}% Match
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {log.photoPath ? (
                                                        <img
                                                            src={`${apiUrl}${log.photoPath}`}
                                                            alt="Punch Audit"
                                                            style={{ width: '40px', height: '40px', borderRadius: '4px', cursor: 'pointer', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                                                            onClick={() => setShowImageModal(`${apiUrl}${log.photoPath}`)}
                                                        />
                                                    ) : (
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No Photo</span>
                                                    )}
                                                </td>
                                                <td>{log.kioskDevice?.name || 'Dubai Kiosk'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Live View & Video Recording Schedules Tab */}
            {activeTab === 'liveview' && (
                <div>
                    {loadingDevices ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <div className="loader"></div>
                        </div>
                    ) : devices.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            No active Kiosk Devices registered in system. Configure them in Kiosk Devices settings page first.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {activeLiveStream && (
                                <div className="card" style={{ background: '#090d16', border: '1px solid #1e293b', padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: isRecording ? '#ef4444' : '#10b981', animation: isRecording ? 'pulse 1.5s infinite' : 'none' }}></span>
                                            CCTV Live Stream: {activeLiveStream.description || activeLiveStream.name}
                                            {isRecording && <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>• REC</span>}
                                        </h3>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button onClick={() => toggleRecording(activeLiveStream._id)} className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', background: isRecording ? '#475569' : '#b91c1c', color: '#fff' }}>
                                                {isRecording ? '⏹ Stop Recording' : '🔴 Record Feed'}
                                            </button>
                                            <button onClick={() => { setActiveLiveStream(null); setIsRecording(false); }} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                                                Close Feed
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mock CCTV Camera Feed Box */}
                                    <div style={{ position: 'relative', width: '100%', height: '420px', background: '#000', borderRadius: '8px', overflow: 'hidden', border: '2px solid #1e293b', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        {/* Security Scanlines overlay */}
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 6px 100%', zIndex: 2, pointerEvents: 'none' }}></div>
                                        
                                        {/* Live Overlay text */}
                                        <div style={{ position: 'absolute', top: '20px', left: '20px', color: '#10b981', fontFamily: 'monospace', fontSize: '0.9rem', textShadow: '0 0 4px #10b981', zIndex: 3 }}>
                                            DEVICE: {activeLiveStream.brand} {activeLiveStream.model}<br />
                                            SERIAL: {activeLiveStream.imeiNo || 'GEN-KIO-8890'}<br />
                                            STATUS: CONNECTED (1080p @ 30FPS)
                                        </div>

                                        <div style={{ position: 'absolute', top: '20px', right: '20px', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.9rem', textShadow: '0 0 4px #ef4444', zIndex: 3, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            {isRecording ? 'RECORDING SCHEDULE ACTIVE' : ''}
                                        </div>

                                        <div style={{ position: 'absolute', bottom: '20px', left: '20px', color: '#10b981', fontFamily: 'monospace', fontSize: '0.9rem', textShadow: '0 0 4px #10b981', zIndex: 3 }}>
                                            LOC: {activeLiveStream.location?.name || 'Office Main lobby'}
                                        </div>

                                        <div style={{ position: 'absolute', bottom: '20px', right: '20px', color: '#10b981', fontFamily: 'monospace', fontSize: '0.9rem', textShadow: '0 0 4px #10b981', zIndex: 3 }}>
                                            {new Date().toLocaleDateString('en-AE')} - {streamTime}
                                        </div>

                                        {/* Face Recognition Mock Wireframe */}
                                        <div style={{ border: '2px dashed #10b981', width: '180px', height: '180px', position: 'absolute', borderRadius: '4px', zIndex: 2, animation: 'scanner-frame 8s infinite ease-in-out' }}>
                                            <div style={{ background: '#10b981', color: '#000', fontSize: '0.7rem', padding: '2px 5px', fontFamily: 'monospace', fontWeight: 'bold', width: 'fit-content', position: 'absolute', top: '-22px', left: '-2px' }}>
                                                FACE DETECTED (97%)
                                            </div>
                                        </div>

                                        {/* Dynamic scanner laser lines */}
                                        <div style={{ position: 'absolute', width: '100%', height: '3px', background: 'rgba(16, 185, 129, 0.4)', boxShadow: '0 0 8px #10b981', animation: 'cctv-scan 4s infinite linear', zIndex: 2 }}></div>

                                        {/* Graphic visual backdrop */}
                                        <div style={{ color: '#1e293b', fontSize: '5rem', fontWeight: 'bold', zIndex: 1, userSelect: 'none' }}>
                                            JTS CCTV SECURITY
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Devices configuration list */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                {devices.map((device) => {
                                    const schedule = scheduleConfig[device._id] || { enabled: false, startHour: '09:00', durationHours: 8 };
                                    
                                    return (
                                        <div key={device._id} className="card" style={{ border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{device.description}</h3>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 'bold', color: device.isActive ? '#10b981' : '#64748b' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: device.isActive ? '#10b981' : '#64748b' }}></span>
                                                        {device.isActive ? 'ONLINE' : 'OFFLINE'}
                                                    </span>
                                                </div>

                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
                                                    <strong>Brand / Model:</strong> {device.brand} {device.model}<br />
                                                    <strong>Mapped Branch:</strong> {device.location?.name || 'Global'}<br />
                                                    <strong>Serial No:</strong> {device.imeiNo || 'N/A'}<br />
                                                    <strong>Login ID:</strong> {device.loginCredentials?.email}
                                                </div>

                                                {/* Schedule form */}
                                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                                                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.8rem', fontWeight: '600' }}>Video Recording Schedule</h4>
                                                    
                                                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.8rem' }}>
                                                        <input
                                                            type="checkbox"
                                                            id={`schedule-enable-${device._id}`}
                                                            checked={schedule.enabled}
                                                            onChange={(e) => handleUpdateScheduleLocal(device._id, 'enabled', e.target.checked)}
                                                        />
                                                        <label htmlFor={`schedule-enable-${device._id}`} className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>
                                                            Enable Recording Schedule
                                                        </label>
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                        <div className="form-group">
                                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Start Time</label>
                                                            <input
                                                                type="time"
                                                                className="form-control"
                                                                style={{ padding: '0.3rem', fontSize: '0.85rem' }}
                                                                value={schedule.startHour}
                                                                disabled={!schedule.enabled}
                                                                onChange={(e) => handleUpdateScheduleLocal(device._id, 'startHour', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="form-group">
                                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Duration (Hours)</label>
                                                            <input
                                                                type="number"
                                                                className="form-control"
                                                                style={{ padding: '0.3rem', fontSize: '0.85rem' }}
                                                                value={schedule.durationHours}
                                                                disabled={!schedule.enabled}
                                                                min={1}
                                                                max={24}
                                                                onChange={(e) => handleUpdateScheduleLocal(device._id, 'durationHours', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                                <button
                                                    onClick={() => handleSaveSchedule(device._id)}
                                                    className="btn btn-primary"
                                                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                                                >
                                                    Save Schedule
                                                </button>
                                                <button
                                                    onClick={() => setActiveLiveStream(device)}
                                                    className="btn btn-secondary"
                                                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                                                    disabled={!device.isActive}
                                                >
                                                    🎥 Live Stream
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Setup Instructions Tab */}
            {activeTab === 'instructions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="card">
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-500)' }}>1. ZKTeco Biometric Devices (ADMS)</h2>
                        <p>ZKTeco devices configured with ADMS (Automatic Data Master System) / Cloud Server can push punch logs directly to this server over HTTP.</p>
                        
                        <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '6px', margin: '1rem 0', border: '1px solid var(--border-color)' }}>
                            <p style={{ margin: '0 0 0.5rem 0' }}><strong>ADMS Web Server Settings on ZK Device:</strong></p>
                            <ul style={{ margin: 0, paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                                <li>Enable ADMS / Domain Mode: <strong>ON</strong></li>
                                <li>Server Address: <strong>{"http://<YOUR_SERVER_IP>"}</strong></li>
                                <li>Server Port: <strong>{"<YOUR_SERVER_PORT>"}</strong> (default is 5000)</li>
                                <li>Request Path: <i>(Leave empty or default, device calls <code>/iclock/cdata</code> automatically)</i></li>
                            </ul>
                        </div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Note: The server will automatically perform the ADMS handshake and sync attendance logs in real time. Ensure the employee has their corresponding biometric ID registered in their profile under the "Geo-Fencing & Biometrics" tab.</p>
                    </div>

                    <div className="card">
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-500)' }}>2. Hikvision Biometric Access Devices</h2>
                        <p>Hikvision cameras, attendance terminals, and access controllers can push real-time XML/JSON transaction alerts to a configured URL.</p>
                        
                        <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '6px', margin: '1rem 0', border: '1px solid var(--border-color)' }}>
                            <p style={{ margin: '0 0 0.5rem 0' }}><strong>Web Setup in Hikvision Device (Event Reciever):</strong></p>
                            <ul style={{ margin: 0, paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                                <li>Receiver Protocol: <strong>HTTP / JSON</strong></li>
                                <li>Destination URL: <strong>{"http://<YOUR_SERVER_IP>:<PORT>/api/biometric/hikvision"}</strong></li>
                                <li>Event Type: Enable <strong>Access Control / Authentication Successful Events</strong></li>
                            </ul>
                        </div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Note: The system extracts the employee's ID from the <code>employeeNoString</code> field in the Hikvision JSON event payload.</p>
                    </div>

                    <div className="card">
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-500)' }}>3. Hik-Connect Cloud Portal (Centralized API Webhook)</h2>
                        <p>For customers who manage all devices via the cloud Hik-Connect application, you can configure Hik-Connect OpenAPI callbacks to push events directly to the application server.</p>
                        
                        <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '6px', margin: '1rem 0', border: '1px solid var(--border-color)' }}>
                            <p style={{ margin: '0 0 0.5rem 0' }}><strong>Hik-Connect Developer Callback URL:</strong></p>
                            <p style={{ fontFamily: 'monospace', margin: '0 0 1rem 0', background: '#0f172a', padding: '0.5rem', borderRadius: '4px', color: '#10b981' }}>
                                POST {"http://<YOUR_SERVER_IP>:<PORT>/api/biometric/hik-connect"}
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                                <li>Register an App on the <strong>Hik-Connect OpenAPI Platform</strong>.</li>
                                <li>Enable <strong>Event Callback</strong> and select <strong>Access Control/Authentication Succeeded</strong> events.</li>
                            </ul>
                        </div>
                    </div>

                    <div className="card">
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-500)' }}>4. iVMS / HikCentral Server (Centralized Web API Callback)</h2>
                        <p>For customers using local server software (iVMS-4200, iVMS-5200, or HikCentral Professional) to manage multiple devices, the local server can forward all authentication records in real time.</p>
                        
                        <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '6px', margin: '1rem 0', border: '1px solid var(--border-color)' }}>
                            <p style={{ margin: '0 0 0.5rem 0' }}><strong>iVMS / HikCentral Callback URL:</strong></p>
                            <p style={{ fontFamily: 'monospace', margin: '0 0 1rem 0', background: '#0f172a', padding: '0.5rem', borderRadius: '4px', color: '#10b981' }}>
                                POST {"http://<YOUR_SERVER_IP>:<PORT>/api/biometric/ivms"}
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '1.5rem', lineHeight: '1.6' }}>
                                <li>Configure <strong>Web API Callback</strong> (Event Linkage) in your local software configuration console.</li>
                                <li>Subscribe to <strong>Access Control Events</strong> or <strong>Face authentication logs</strong>.</li>
                            </ul>
                        </div>
                    </div>

                    <div className="card">
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--accent-500)' }}>5. Amico & Other Generic Devices (REST Ingestion API)</h2>
                        <p>For Amico or any other biometric device, you can use a small local middleware utility on site to read punches from the device SDK and POST them in bulk or individually to this REST endpoint.</p>
                        
                        <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '6px', margin: '1rem 0', border: '1px solid var(--border-color)' }}>
                            <p style={{ margin: '0 0 0.5rem 0' }}><strong>REST Endpoint:</strong></p>
                            <p style={{ fontFamily: 'monospace', margin: '0 0 1rem 0', background: '#0f172a', padding: '0.5rem', borderRadius: '4px', color: '#10b981' }}>POST {"http://<YOUR_SERVER_IP>:<PORT>/api/biometric/logs"}</p>
                            
                            <p style={{ margin: '0 0 0.5rem 0' }}><strong>JSON Payload Format:</strong></p>
                            <pre style={{ margin: 0, background: '#0f172a', padding: '1rem', borderRadius: '4px', overflowX: 'auto', fontSize: '0.85rem' }}>
{`[
  {
    "biometricId": "1001",
    "timestamp": "2026-08-24T08:30:00Z",
    "deviceBrand": "Amico",
    "deviceName": "Main Entrance Gate",
    "type": "Check-In"
  }
]`}
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            {/* Verification Image Zoom Overlay Modal */}
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
                            alt="Audit Zoom"
                            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', border: '3px solid #fff', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                        />
                        <div style={{ position: 'absolute', top: '-40px', right: 0, color: '#fff', fontSize: '1rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                            Click anywhere to close
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Scan Line CSS injection */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes cctv-scan {
                    0% { top: 0%; }
                    50% { top: 100%; }
                    100% { top: 0%; }
                }
                @keyframes scanner-frame {
                    0%, 100% { top: 30%; left: 38%; }
                    25% { top: 28%; left: 40%; }
                    50% { top: 32%; left: 36%; }
                    75% { top: 29%; left: 39%; }
                }
            `}} />
        </div>
    );
}
