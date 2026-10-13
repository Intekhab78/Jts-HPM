import { useState, useEffect } from 'react';
import { getUnregisteredFaceLogs, updateUnregisteredFaceLog, deleteUnregisteredFaceLog } from '../../api/attendanceApi';
import { masterAPI, deviceAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
    FiUserX, 
    FiUserCheck, 
    FiUserPlus, 
    FiCamera, 
    FiMapPin, 
    FiClock, 
    FiTag, 
    FiEdit3, 
    FiTrash2, 
    FiRefreshCw, 
    FiSearch, 
    FiFilter, 
    FiGrid, 
    FiList, 
    FiEye,
    FiShield,
    FiAlertTriangle,
    FiCheckCircle
} from 'react-icons/fi';

const VISITOR_TAGS = [
    { label: 'Unregistered Visitor', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)' },
    { label: 'Client / Guest', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    { label: 'Courier / Delivery', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    { label: 'Contractor / Vendor', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
    { label: 'Maintenance / Tech', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    { label: 'Interview Candidate', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    { label: 'Flagged / Unauthorized', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
];

export default function UnregisteredVisitorsLog() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const canManage = userRole === 'admin' || userRole === 'hr';

    const [logs, setLogs] = useState([]);
    const [summary, setSummary] = useState({ totalLogs: 0, todayVisitors: 0, unaddressed: 0, tagged: 0 });
    const [loading, setLoading] = useState(true);
    const [devices, setDevices] = useState([]);
    const [locations, setLocations] = useState([]);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

    // Filters
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        location: '',
        device: '',
        status: 'ALL',
        tag: 'ALL',
        search: '',
        datePreset: 'today' // 'today' | 'yesterday' | 'week' | 'month' | 'custom'
    });

    // Modals
    const [selectedImage, setSelectedImage] = useState(null);
    const [tagModalData, setTagModalData] = useState(null);
    const [tagFormData, setTagFormData] = useState({ visitorName: '', tag: 'Client / Guest', notes: '', status: 'Tagged' });
    const [tagSubmitting, setTagSubmitting] = useState(false);

    // Delete Modal
    const [deleteId, setDeleteId] = useState(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);

    useEffect(() => {
        loadFilterOptions();
        applyDatePreset('today');
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [filters.startDate, filters.endDate, filters.location, filters.device, filters.status, filters.tag]);

    const loadFilterOptions = async () => {
        try {
            const [devRes, locRes] = await Promise.all([
                deviceAPI.getDevices(),
                masterAPI.getLocations()
            ]);
            setDevices(devRes.data.data || []);
            setLocations(locRes.data.data || []);
        } catch (e) {
            console.warn('Failed to load filter options:', e.message);
        }
    };

    const applyDatePreset = (preset) => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        if (preset === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (preset === 'yesterday') {
            start.setDate(today.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end.setDate(today.getDate() - 1);
            end.setHours(23, 59, 59, 999);
        } else if (preset === 'week') {
            start.setDate(today.getDate() - 7);
            start.setHours(0, 0, 0, 0);
        } else if (preset === 'month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
        } else if (preset === 'all') {
            setFilters(prev => ({
                ...prev,
                datePreset: 'all',
                startDate: '',
                endDate: ''
            }));
            return;
        }

        const formatForInput = (d) => d.toISOString().split('T')[0];

        setFilters(prev => ({
            ...prev,
            datePreset: preset,
            startDate: formatForInput(start),
            endDate: formatForInput(end)
        }));
    };

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const params = {
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined,
                location: filters.location || undefined,
                device: filters.device || undefined,
                status: filters.status !== 'ALL' ? filters.status : undefined,
                tag: filters.tag !== 'ALL' ? filters.tag : undefined,
                search: filters.search || undefined,
                limit: 100
            };

            const res = await getUnregisteredFaceLogs(params);
            if (res.success) {
                setLogs(res.data || []);
                if (res.summary) {
                    setSummary(res.summary);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load visitor logs');
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchLogs();
    };

    const openTagModal = (log) => {
        setTagModalData(log);
        setTagFormData({
            visitorName: log.visitorName || '',
            tag: log.tag || 'Client / Guest',
            notes: log.notes || '',
            status: log.status === 'Unregistered' ? 'Tagged' : log.status
        });
    };

    const handleSaveTag = async (e) => {
        e.preventDefault();
        if (!tagModalData) return;

        setTagSubmitting(true);
        try {
            await updateUnregisteredFaceLog(tagModalData._id, tagFormData);
            toast.success('Visitor details saved successfully');
            setTagModalData(null);
            fetchLogs();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update visitor details');
        } finally {
            setTagSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleteSubmitting(true);
        try {
            await deleteUnregisteredFaceLog(deleteId);
            toast.success('Visitor log deleted');
            setDeleteId(null);
            fetchLogs();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete visitor log');
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const handleQuickRegisterEmployee = (log) => {
        navigate('/employees', {
            state: {
                prefillPhoto: log.photoPath,
                prefillName: log.visitorName || '',
                fromVisitorLogId: log._id
            }
        });
    };

    const getTagStyle = (tagStr) => {
        const found = VISITOR_TAGS.find(t => t.label.toLowerCase() === (tagStr || '').toLowerCase());
        if (found) return found;
        return { label: tagStr || 'Visitor', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getRelativeTime = (dateStr) => {
        if (!dateStr) return '';
        const now = new Date();
        const diffSecs = Math.floor((now - new Date(dateStr)) / 1000);
        if (diffSecs < 60) return 'Just now';
        if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
        if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
        return `${Math.floor(diffSecs / 86400)}d ago`;
    };

    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');

    return (
        <div className="unregistered-visitors-container" style={{ marginTop: '0.5rem' }}>
            {/* KPI STATS ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.9rem', borderRadius: '10px', fontSize: '1.5rem' }}>
                        <FiUserX />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today's Visitors</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ef4444' }}>{summary.todayVisitors || 0}</div>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.9rem', borderRadius: '10px', fontSize: '1.5rem' }}>
                        <FiAlertTriangle />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unidentified Faces</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#f59e0b' }}>{summary.unaddressed || 0}</div>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.9rem', borderRadius: '10px', fontSize: '1.5rem' }}>
                        <FiUserCheck />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tagged / Identified</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{summary.tagged || 0}</div>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '0.9rem', borderRadius: '10px', fontSize: '1.5rem' }}>
                        <FiCamera />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active CCTV Feeds</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#3b82f6' }}>{devices.filter(d => d.deviceType === 'IPCamera' && d.isActive).length}</div>
                    </div>
                </div>
            </div>

            {/* FILTER TOOLBAR */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                    {/* Date Presets */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                            { id: 'today', label: 'Today' },
                            { id: 'yesterday', label: 'Yesterday' },
                            { id: 'week', label: 'Last 7 Days' },
                            { id: 'month', label: 'This Month' },
                            { id: 'all', label: 'All Time' }
                        ].map(preset => (
                            <button
                                key={preset.id}
                                type="button"
                                className={`btn btn-sm ${filters.datePreset === preset.id ? 'btn-primary' : 'btn-secondary btn-outline'}`}
                                onClick={() => applyDatePreset(preset.id)}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: '20px' }}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* View Switcher & Refresh */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            type="button"
                            className="btn btn-secondary btn-outline btn-sm"
                            onClick={fetchLogs}
                            title="Refresh Visitor Feeds"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <FiRefreshCw className={loading ? 'spin' : ''} /> Refresh
                        </button>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '2px', borderRadius: '6px', display: 'flex', border: '1px solid var(--border-color)' }}>
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                style={{
                                    background: viewMode === 'grid' ? 'var(--primary-color)' : 'transparent',
                                    color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)',
                                    border: 'none',
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                title="Gallery View"
                            >
                                <FiGrid />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('table')}
                                style={{
                                    background: viewMode === 'table' ? 'var(--primary-color)' : 'transparent',
                                    color: viewMode === 'table' ? '#fff' : 'var(--text-secondary)',
                                    border: 'none',
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                title="Table List View"
                            >
                                <FiList />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter Dropdowns */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Camera / Device</label>
                        <select
                            className="form-control"
                            value={filters.device}
                            onChange={(e) => setFilters(prev => ({ ...prev, device: e.target.value }))}
                            style={{ fontSize: '0.85rem' }}
                        >
                            <option value="">All Cameras</option>
                            {devices.filter(d => d.deviceType === 'IPCamera').map(d => (
                                <option key={d._id} value={d._id}>
                                    {d.description} ({d.zoneGroup || 'Main Area'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Branch Location</label>
                        <select
                            className="form-control"
                            value={filters.location}
                            onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                            style={{ fontSize: '0.85rem' }}
                        >
                            <option value="">All Locations</option>
                            {locations.map(loc => (
                                <option key={loc._id} value={loc._id}>{loc.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Category Tag</label>
                        <select
                            className="form-control"
                            value={filters.tag}
                            onChange={(e) => setFilters(prev => ({ ...prev, tag: e.target.value }))}
                            style={{ fontSize: '0.85rem' }}
                        >
                            <option value="ALL">All Categories</option>
                            {VISITOR_TAGS.map(t => (
                                <option key={t.label} value={t.label}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Review Status</label>
                        <select
                            className="form-control"
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            style={{ fontSize: '0.85rem' }}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="Unregistered">Unregistered / Pending</option>
                            <option value="Tagged">Tagged</option>
                            <option value="Converted to Employee">Converted to Employee</option>
                            <option value="Ignored">Ignored</option>
                        </select>
                    </div>

                    {/* Search Input */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Search Keywords</label>
                        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '4px' }}>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Name, tag, notes..."
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                style={{ fontSize: '0.85rem' }}
                            />
                            <button type="submit" className="btn btn-secondary btn-outline btn-sm">
                                <FiSearch />
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* VISITOR LOGS LIST / GRID */}
            {loading ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <FiRefreshCw className="spin" style={{ fontSize: '2rem', color: 'var(--primary-color)', marginBottom: '1rem' }} />
                    <div style={{ color: 'var(--text-secondary)' }}>Loading unregistered visitor captures...</div>
                </div>
            ) : logs.length === 0 ? (
                <div className="card empty-state" style={{ padding: '3.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📹</div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No Visitor Captures Found</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
                        Whenever an unregistered person or guest passes in front of an active IP Camera CCTV view, their face snapshot and timestamp will be automatically logged here.
                    </p>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => applyDatePreset('all')}>
                        Clear Date Filter
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                /* GRID CARD GALLERY VIEW */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {logs.map((log) => {
                        const tagStyle = getTagStyle(log.tag);
                        const photoSrc = log.photoPath ? `${apiUrl}${log.photoPath}` : '';

                        return (
                            <div
                                key={log._id}
                                className="card visitor-card"
                                style={{
                                    padding: '1.1rem',
                                    borderRadius: '12px',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    border: log.tag === 'Flagged / Unauthorized' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)'
                                }}
                            >
                                <div>
                                    {/* Top Photo & Snapshot Header */}
                                    <div style={{ position: 'relative', marginBottom: '0.85rem', borderRadius: '8px', overflow: 'hidden', background: '#0a0f1d', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {photoSrc ? (
                                            <img
                                                src={photoSrc}
                                                alt="Visitor Snapshot"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                                                onClick={() => setSelectedImage(photoSrc)}
                                            />
                                        ) : (
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '2rem' }}>👤</div>
                                        )}

                                        {/* Zoom Preview Badge */}
                                        <button
                                            type="button"
                                            onClick={() => setSelectedImage(photoSrc)}
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                background: 'rgba(0, 0, 0, 0.65)',
                                                border: 'none',
                                                color: '#fff',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <FiEye /> Zoom
                                        </button>

                                        {/* Relative time pill */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '8px',
                                            left: '8px',
                                            background: 'rgba(0, 0, 0, 0.75)',
                                            color: '#10b981',
                                            fontSize: '0.7rem',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontWeight: '600'
                                        }}>
                                            ⏱️ {getRelativeTime(log.timestamp)}
                                        </div>
                                    </div>

                                    {/* Visitor Name & Tag */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '0.5rem' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: log.visitorName ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                {log.visitorName || 'Unknown Person'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {formatDateTime(log.timestamp)}
                                            </div>
                                        </div>
                                        <span
                                            style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '600',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                background: tagStyle.bg,
                                                color: tagStyle.color,
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {log.tag || 'Visitor'}
                                        </span>
                                    </div>

                                    {/* Location & Camera Info */}
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '0.6rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <FiCamera style={{ color: 'var(--primary-color)' }} />
                                            <span style={{ fontWeight: '500' }}>{log.cameraName || log.device?.description || 'IP Camera'}</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>[{log.zoneGroup || 'Main Area'}]</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                                            <FiMapPin />
                                            <span>{log.locationName || log.location?.name || 'Branch'}</span>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    {log.notes && (
                                        <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>
                                            "{log.notes}"
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                {canManage && (
                                    <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => openTagModal(log)}
                                            className="btn btn-secondary btn-outline btn-sm"
                                            style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                            title="Tag Visitor Name & Category"
                                        >
                                            <FiEdit3 /> Tag
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleQuickRegisterEmployee(log)}
                                            className="btn btn-primary btn-sm"
                                            style={{ flex: 1.2, fontSize: '0.75rem', padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                            title="Quick Register as Employee"
                                        >
                                            <FiUserPlus /> + Register
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeleteId(log._id)}
                                            className="btn btn-secondary btn-outline btn-sm"
                                            style={{ padding: '0.35rem 0.5rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                            title="Delete Log"
                                        >
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* TABLE LIST VIEW */
                <div className="card">
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Snapshot</th>
                                    <th>Detected Time</th>
                                    <th>Visitor Name</th>
                                    <th>Category Tag</th>
                                    <th>Camera & Area Zone</th>
                                    <th>Branch Location</th>
                                    <th>Status</th>
                                    {canManage && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => {
                                    const tagStyle = getTagStyle(log.tag);
                                    const photoSrc = log.photoPath ? `${apiUrl}${log.photoPath}` : '';

                                    return (
                                        <tr key={log._id}>
                                            <td>
                                                {photoSrc ? (
                                                    <img
                                                        src={photoSrc}
                                                        alt="Snapshot"
                                                        style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', cursor: 'zoom-in', border: '1px solid var(--border-color)' }}
                                                        onClick={() => setSelectedImage(photoSrc)}
                                                    />
                                                ) : (
                                                    <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{formatDateTime(log.timestamp)}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '600' }}>{getRelativeTime(log.timestamp)}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 'bold' }}>{log.visitorName || 'Unknown Person'}</div>
                                                {log.notes && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{log.notes}</div>}
                                            </td>
                                            <td>
                                                <span
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        fontWeight: '600',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        background: tagStyle.bg,
                                                        color: tagStyle.color
                                                    }}
                                                >
                                                    {log.tag || 'Visitor'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{log.cameraName || log.device?.description || 'IP Camera'}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Zone: {log.zoneGroup || 'Main Area'}</div>
                                            </td>
                                            <td>{log.locationName || log.location?.name || 'Main Office'}</td>
                                            <td>
                                                <span className={`badge ${log.status === 'Tagged' ? 'badge-success' : log.status === 'Converted to Employee' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                                                    {log.status || 'Unregistered'}
                                                </span>
                                            </td>
                                            {canManage && (
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => openTagModal(log)}
                                                            className="btn btn-secondary btn-outline btn-sm"
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                            title="Tag / Name"
                                                        >
                                                            <FiEdit3 />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQuickRegisterEmployee(log)}
                                                            className="btn btn-primary btn-sm"
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                            title="Convert / Register as Employee"
                                                        >
                                                            <FiUserPlus />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteId(log._id)}
                                                            className="btn btn-secondary btn-outline btn-sm"
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                                            title="Delete"
                                                        >
                                                            <FiTrash2 />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ZOOM MODAL */}
            {selectedImage && (
                <div
                    onClick={() => setSelectedImage(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.85)',
                        zIndex: 9999,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: 'zoom-out',
                        padding: '2rem'
                    }}
                >
                    <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                        <img
                            src={selectedImage}
                            alt="Visitor Snapshot Zoom"
                            style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '8px', border: '3px solid #fff', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                        />
                        <div style={{ position: 'absolute', top: '-40px', right: 0, color: '#fff', fontSize: '1rem', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                            Click anywhere to close
                        </div>
                    </div>
                </div>
            )}

            {/* TAG & CLASSIFICATION MODAL */}
            {tagModalData && (
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
                            maxWidth: '500px',
                            width: '100%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color, #374151)', paddingBottom: '0.75rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>🏷️</span>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary, #fff)' }}>
                                    Tag & Identify Visitor
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)' }}>
                                    Assign name, category, and remarks to this camera detection.
                                </p>
                            </div>
                        </div>

                        {/* Snapshot thumbnail preview */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--bg-tertiary, #111827)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
                            {tagModalData.photoPath && (
                                <img
                                    src={`${apiUrl}${tagModalData.photoPath}`}
                                    alt="Face Preview"
                                    style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                                />
                            )}
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <div><strong>Camera:</strong> {tagModalData.cameraName || 'IP Camera'} [{tagModalData.zoneGroup || 'Main Area'}]</div>
                                <div><strong>Location:</strong> {tagModalData.locationName || 'Branch'}</div>
                                <div><strong>Captured:</strong> {formatDateTime(tagModalData.timestamp)}</div>
                            </div>
                        </div>

                        <form onSubmit={handleSaveTag}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" style={{ fontSize: '0.85rem' }}>Visitor Full Name / Company</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Tariq Mansoor (Client) or DHL Delivery Driver"
                                    value={tagFormData.visitorName}
                                    onChange={(e) => setTagFormData(prev => ({ ...prev, visitorName: e.target.value }))}
                                    autoFocus
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" style={{ fontSize: '0.85rem' }}>Category Tag</label>
                                <select
                                    className="form-control"
                                    value={tagFormData.tag}
                                    onChange={(e) => setTagFormData(prev => ({ ...prev, tag: e.target.value }))}
                                >
                                    {VISITOR_TAGS.map(t => (
                                        <option key={t.label} value={t.label}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label" style={{ fontSize: '0.85rem' }}>Notes & Purpose of Visit</label>
                                <textarea
                                    className="form-control"
                                    rows="2"
                                    placeholder="e.g. Visiting Sales Dept for contract signing..."
                                    value={tagFormData.notes}
                                    onChange={(e) => setTagFormData(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setTagModalData(null)}
                                    disabled={tagSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={tagSubmitting}
                                >
                                    {tagSubmitting ? 'Saving...' : 'Save Tag & Details'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteId && (
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
                            maxWidth: '420px',
                            width: '100%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                        }}
                    >
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#ef4444', fontSize: '1.15rem' }}>🗑️ Delete Visitor Log</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                            Are you sure you want to delete this unregistered visitor capture record and its saved snapshot image?
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setDeleteId(null)}
                                disabled={deleteSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleDelete}
                                disabled={deleteSubmitting}
                                style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                            >
                                {deleteSubmitting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
