import { useState, useEffect } from 'react';
import { getBiometricLogs, reprocessBiometricLog } from '../../api/biometricApi';
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

    useEffect(() => {
        if (activeTab === 'monitor') {
            fetchLogs();
        }
    }, [filters, activeTab]);

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
                    <h1 className="page-title">Biometric Integration</h1>
                    <p className="page-subtitle">Configure, map, and monitor physical biometric device log ingestion.</p>
                </div>
            </div>

            {/* Tab Links */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                <button
                    onClick={() => setActiveTab('monitor')}
                    style={{
                        background: 'none', border: 'none', padding: '1rem 2rem',
                        color: activeTab === 'monitor' ? 'var(--primary-color)' : 'var(--text-secondary)',
                        borderBottom: activeTab === 'monitor' ? '3px solid var(--primary-color)' : '3px solid transparent',
                        fontWeight: activeTab === 'monitor' ? '600' : 'normal',
                        cursor: 'pointer'
                    }}
                >
                    Log Monitor
                </button>
                <button
                    onClick={() => setActiveTab('instructions')}
                    style={{
                        background: 'none', border: 'none', padding: '1rem 2rem',
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
        </div>
    );
}
