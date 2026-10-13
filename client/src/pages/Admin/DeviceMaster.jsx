import { useState, useEffect } from 'react';
import { deviceAPI, masterAPI } from '../../api';
import toast from 'react-hot-toast';
import { 
    FiVideo, 
    FiTablet, 
    FiPlus, 
    FiPlay, 
    FiSquare, 
    FiCheckCircle, 
    FiAlertCircle, 
    FiRefreshCw, 
    FiSliders, 
    FiCpu, 
    FiActivity, 
    FiLayers, 
    FiEye, 
    FiClock, 
    FiMapPin, 
    FiEdit2, 
    FiTrash2,
    FiShield,
    FiVolume2,
    FiFilm,
    FiDownload,
    FiCamera,
    FiMaximize2,
    FiX,
    FiAlertTriangle,
    FiFolder,
    FiSearch
} from 'react-icons/fi';

const RTSP_BRAND_PRESETS = [
    { label: 'Hikvision', makeUrl: (u, p, ip, port, ch, sub) => `rtsp://${u ? `${encodeURIComponent(u)}:${encodeURIComponent(p)}@` : ''}${ip}:${port || 554}/Streaming/Channels/${ch || 1}0${sub ? '2' : '1'}` },
    { label: 'Dahua', makeUrl: (u, p, ip, port, ch, sub) => `rtsp://${u ? `${encodeURIComponent(u)}:${encodeURIComponent(p)}@` : ''}${ip}:${port || 554}/cam/realmonitor?channel=${ch || 1}&subtype=${sub ? '1' : '0'}` },
    { label: 'CP Plus', makeUrl: (u, p, ip, port, ch, sub) => `rtsp://${u ? `${encodeURIComponent(u)}:${encodeURIComponent(p)}@` : ''}${ip}:${port || 554}/cam/realmonitor?channel=${ch || 1}&subtype=${sub ? '1' : '0'}` },
    { label: 'Uniview', makeUrl: (u, p, ip, port, ch, sub) => `rtsp://${u ? `${encodeURIComponent(u)}:${encodeURIComponent(p)}@` : ''}${ip}:${port || 554}/media/video${sub ? '2' : '1'}` },
    { label: 'Axis', makeUrl: (u, p, ip, port, ch, sub) => `rtsp://${u ? `${encodeURIComponent(u)}:${encodeURIComponent(p)}@` : ''}${ip}:${port || 554}/axis-media/media.amp` },
    { label: 'Local Webcam', makeUrl: () => '0' },
    { label: 'Generic RTSP', makeUrl: (u, p, ip, port, ch, sub) => `rtsp://${u ? `${encodeURIComponent(u)}:${encodeURIComponent(p)}@` : ''}${ip}:${port || 554}/h264/ch${ch || 1}/${sub ? 'sub' : 'main'}/av_stream` },
    { label: 'Custom URL / HTTP Stream', makeUrl: () => '' }
];

export default function DeviceMaster() {
    const [devices, setDevices] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [locations, setLocations] = useState([]);
    const [filteredLocations, setFilteredLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Tab selection state: 'register' | 'monitor' | 'recordings' | 'schedules'
    const [activeTab, setActiveTab] = useState('register');
    const [typeFilter, setTypeFilter] = useState('ALL');

    // Monitoring & Live AI states
    const [streamTime, setStreamTime] = useState(new Date().toLocaleTimeString());
    const [scheduleConfig, setScheduleConfig] = useState({});
    const [cameraStatuses, setCameraStatuses] = useState({});
    const [togglingStreamId, setTogglingStreamId] = useState(null);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    // Live Stream Diagnostics Modal
    const [diagnosticModalCamera, setDiagnosticModalCamera] = useState(null);

    // Video Recordings Archive states
    const [recordings, setRecordings] = useState([]);
    const [recordingsLoading, setRecordingsLoading] = useState(false);
    const [recordingsSummary, setRecordingsSummary] = useState({ totalRecordings: 0, totalSizeBytes: 0, totalDurationSecs: 0 });
    const [recordingsFilter, setRecordingsFilter] = useState({
        deviceId: '',
        recordingType: 'ALL',
        startDate: '',
        endDate: '',
        search: ''
    });
    const [recordingsPage, setRecordingsPage] = useState(1);
    const [recordingsTotalPages, setRecordingsTotalPages] = useState(1);
    const [selectedVideoToPlay, setSelectedVideoToPlay] = useState(null);

    // Stream test states
    const [testingStream, setTestingStream] = useState(false);
    const [testStreamResult, setTestStreamResult] = useState(null);

    // Modal / form states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);

    const [formData, setFormData] = useState({
        deviceType: 'Kiosk',
        company: '',
        location: '',
        zoneGroup: 'Main Entrance Area',
        description: '',
        brand: 'Hikvision',
        model: 'DS-2CD2043G2-I',
        imeiNo: '',
        email: '',
        password: '',
        streamUrl: '',
        cameraIp: '',
        cameraPort: 554,
        cameraUsername: 'admin',
        cameraPassword: '',
        channelNo: 1,
        streamProfile: 'sub',
        direction: 'auto',
        cooldownMinutes: 5,
        isActive: true
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    // Live Stream ticking clock & periodic camera status polling
    useEffect(() => {
        let interval;
        if (activeTab === 'monitor' || diagnosticModalCamera) {
            interval = setInterval(() => {
                setStreamTime(new Date().toLocaleTimeString());
                pollCameraStatuses();
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [activeTab, diagnosticModalCamera, devices]);

    // Fetch recordings when recordings tab becomes active
    useEffect(() => {
        if (activeTab === 'recordings') {
            fetchRecordings();
        }
    }, [activeTab, recordingsPage, recordingsFilter]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [devRes, compRes, locRes] = await Promise.all([
                deviceAPI.getDevices(),
                masterAPI.getCompanies(),
                masterAPI.getLocations()
            ]);
            const devList = devRes.data.data || [];
            setDevices(devList);
            setCompanies(compRes.data.data || []);
            setLocations(locRes.data.data || []);

            // Initialize schedules config locally
            const configs = {};
            devList.forEach(dev => {
                configs[dev._id] = {
                    enabled: dev.recordingSchedule?.enabled || false,
                    startHour: dev.recordingSchedule?.startHour || '09:00',
                    durationHours: dev.recordingSchedule?.durationHours || 8
                };
            });
            setScheduleConfig(configs);
        } catch (error) {
            toast.error('Failed to load devices and masters configuration');
        } finally {
            setLoading(false);
        }
    };

    const pollCameraStatuses = async () => {
        const ipCams = devices.filter(d => d.deviceType === 'IPCamera');
        for (const cam of ipCams) {
            try {
                const res = await deviceAPI.getCameraStatus(cam._id);
                if (res.data?.success) {
                    setCameraStatuses(prev => ({ ...prev, [cam._id]: res.data }));
                }
            } catch (e) {
                // Ignore silent poll error
            }
        }
    };

    const fetchRecordings = async () => {
        try {
            setRecordingsLoading(true);
            const params = {
                page: recordingsPage,
                limit: 15,
                ...recordingsFilter
            };
            const res = await deviceAPI.getRecordings(params);
            if (res.data.success) {
                setRecordings(res.data.data || []);
                setRecordingsTotalPages(res.data.pages || 1);
                setRecordingsSummary(res.data.summary || { totalRecordings: 0, totalSizeBytes: 0, totalDurationSecs: 0 });
            }
        } catch (err) {
            toast.error('Failed to load surveillance recordings');
        } finally {
            setRecordingsLoading(false);
        }
    };

    const handleCompanyChange = (e) => {
        const companyId = e.target.value;
        setFormData(prev => ({ ...prev, company: companyId, location: '' }));
        if (companyId) {
            const filtered = locations.filter(loc => {
                const cId = loc.company?._id || loc.company;
                return cId && cId.toString() === companyId.toString();
            });
            setFilteredLocations(filtered);
        } else {
            setFilteredLocations([]);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: type === 'checkbox' ? checked : value };
            
            // Auto update RTSP URL if camera network parameters changed
            if (updated.deviceType === 'IPCamera' && ['brand', 'cameraIp', 'cameraPort', 'cameraUsername', 'cameraPassword', 'channelNo', 'streamProfile'].includes(name)) {
                const preset = RTSP_BRAND_PRESETS.find(p => p.label.toLowerCase() === (updated.brand || '').toLowerCase()) || RTSP_BRAND_PRESETS[0];
                if (preset && preset.label !== 'Custom URL / HTTP Stream' && preset.label !== 'Local Webcam' && updated.cameraIp) {
                    updated.streamUrl = preset.makeUrl(
                        updated.cameraUsername,
                        updated.cameraPassword,
                        updated.cameraIp,
                        updated.cameraPort,
                        updated.channelNo,
                        updated.streamProfile === 'sub'
                    );
                }
            }
            return updated;
        });
    };

    const handleBrandPresetSelect = (brandName) => {
        const preset = RTSP_BRAND_PRESETS.find(p => p.label === brandName);
        setFormData(prev => {
            const updated = { ...prev, brand: brandName };
            if (preset) {
                if (brandName === 'Local Webcam') {
                    updated.streamUrl = '0';
                    updated.cameraIp = '127.0.0.1';
                } else if (preset.label !== 'Custom URL / HTTP Stream' && updated.cameraIp) {
                    updated.streamUrl = preset.makeUrl(
                        updated.cameraUsername,
                        updated.cameraPassword,
                        updated.cameraIp,
                        updated.cameraPort,
                        updated.channelNo,
                        updated.streamProfile === 'sub'
                    );
                }
            }
            return updated;
        });
    };

    const openCreateModal = (presetType = 'Kiosk') => {
        setEditMode(false);
        setCurrentId(null);
        setTestStreamResult(null);

        const defaultCompany = companies[0]?._id || '';
        const defaultFilteredLocs = locations.filter(loc => {
            const cId = loc.company?._id || loc.company;
            return !defaultCompany || (cId && cId.toString() === defaultCompany.toString());
        });
        const defaultLocation = defaultFilteredLocs[0]?._id || (locations[0]?._id || '');

        setFormData({
            deviceType: presetType,
            company: defaultCompany,
            location: defaultLocation,
            zoneGroup: 'Main Entrance Area',
            description: presetType === 'IPCamera' ? 'Main Entrance Turnstile Camera' : 'Lobby Tablet Kiosk',
            brand: presetType === 'IPCamera' ? 'Hikvision' : 'Samsung',
            model: presetType === 'IPCamera' ? 'DS-2CD2043G2-I' : 'Galaxy Tab A9',
            imeiNo: '',
            email: '',
            password: '',
            streamUrl: presetType === 'IPCamera' ? 'rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/102' : '',
            cameraIp: '192.168.1.100',
            cameraPort: 554,
            cameraUsername: 'admin',
            cameraPassword: '',
            channelNo: 1,
            streamProfile: 'sub',
            direction: 'auto',
            cooldownMinutes: 5,
            isActive: true
        });
        setFilteredLocations(defaultFilteredLocs.length > 0 ? defaultFilteredLocs : locations);
        setIsModalOpen(true);
    };

    const openEditModal = (device) => {
        setEditMode(true);
        setCurrentId(device._id);
        setTestStreamResult(null);
        
        const companyId = device.company?._id || device.company || companies[0]?._id || '';
        const locationId = device.location?._id || device.location || locations[0]?._id || '';
        
        const filtered = locations.filter(loc => {
            const cId = loc.company?._id || loc.company;
            return !companyId || (cId && cId.toString() === companyId.toString());
        });
        setFilteredLocations(filtered.length > 0 ? filtered : locations);

        setFormData({
            deviceType: device.deviceType || 'Kiosk',
            company: companyId,
            location: locationId,
            zoneGroup: device.zoneGroup || 'Main Area',
            description: device.description || '',
            brand: device.brand || '',
            model: device.model || '',
            imeiNo: device.imeiNo || '',
            email: device.loginCredentials?.email || '',
            password: '••••••••',
            streamUrl: device.streamUrl || '',
            cameraIp: device.cameraIp || '',
            cameraPort: device.cameraPort || 554,
            cameraUsername: device.cameraUsername || '',
            cameraPassword: device.cameraPassword || '',
            channelNo: device.channelNo || 1,
            streamProfile: device.streamProfile || 'sub',
            direction: device.direction || 'auto',
            cooldownMinutes: device.cooldownMinutes || 5,
            isActive: device.isActive !== false
        });
        setIsModalOpen(true);
    };

    const handleTestStream = async () => {
        try {
            setTestingStream(true);
            setTestStreamResult(null);
            
            const payload = {
                streamUrl: formData.streamUrl,
                cameraIp: formData.cameraIp,
                cameraPort: formData.cameraPort,
                cameraUsername: formData.cameraUsername,
                cameraPassword: formData.cameraPassword,
                channelNo: formData.channelNo,
                streamProfile: formData.streamProfile
            };

            const res = await deviceAPI.testStream(payload);
            if (res.data.success) {
                setTestStreamResult(res.data);
                toast.success('Camera stream connected successfully!');
            } else {
                toast.error(res.data.message || 'Stream connection failed');
                setTestStreamResult({ success: false, message: res.data.message });
            }
        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Stream test failed';
            toast.error(msg);
            setTestStreamResult({ success: false, message: msg });
        } finally {
            setTestingStream(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editMode && currentId) {
                const payload = { ...formData };
                if (payload.password === '••••••••') {
                    delete payload.password;
                }
                try {
                    await deviceAPI.updateDevice(currentId, payload);
                    toast.success('Device configuration saved successfully');
                } catch (updateErr) {
                    if (updateErr.response?.status === 404) {
                        // If device was not found, fallback to registering it as new
                        await deviceAPI.createDevice(formData);
                        toast.success(`${formData.deviceType === 'IPCamera' ? 'IP Camera' : 'Kiosk Terminal'} registered and saved successfully`);
                    } else {
                        throw updateErr;
                    }
                }
            } else {
                await deviceAPI.createDevice(formData);
                toast.success(`${formData.deviceType === 'IPCamera' ? 'IP Camera' : 'Kiosk Terminal'} registered successfully`);
            }
            setIsModalOpen(false);
            fetchInitialData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Transaction failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to permanently delete this device?")) return;
        try {
            await deviceAPI.deleteDevice(id);
            toast.success('Device deleted successfully');
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to delete device');
        }
    };

    const handleToggleStream = async (deviceId) => {
        try {
            setTogglingStreamId(deviceId);
            const res = await deviceAPI.toggleStream(deviceId);
            if (res.data.success) {
                toast.success(res.data.message || 'Camera stream recognition toggled');
                await fetchInitialData();
                await pollCameraStatuses();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to toggle stream worker');
        } finally {
            setTogglingStreamId(null);
        }
    };

    // Switch to local webcam (Camera 0)
    const handleSwitchToWebcam = async (deviceId) => {
        try {
            setActionLoadingId(deviceId);
            toast('Switching camera feed to Local Webcam (Camera 0)...', { icon: '🎥' });
            const res = await deviceAPI.useWebcam(deviceId);
            if (res.data?.success) {
                toast.success('Camera stream switched to Local Webcam (Camera 0)! Frames connecting...');
                await fetchInitialData();
                await pollCameraStatuses();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to switch to webcam');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Start Video Recording for a camera
    const handleStartRecording = async (deviceId) => {
        try {
            setActionLoadingId(deviceId);
            toast('Starting video surveillance recording...', { icon: '⏺️' });
            const res = await deviceAPI.startRecording(deviceId, { recordingType: 'Manual' });
            if (res.data?.success) {
                toast.success('Surveillance video recording started!');
                await pollCameraStatuses();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to start video recording');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Stop Video Recording for a camera
    const handleStopRecording = async (deviceId) => {
        try {
            setActionLoadingId(deviceId);
            toast('Finalizing video file and saving to archive...', { icon: '⏹️' });
            const res = await deviceAPI.stopRecording(deviceId);
            if (res.data?.success) {
                toast.success(`Video recording saved! (${res.data.durationSeconds}s, ${(res.data.fileSize / 1024 / 1024).toFixed(2)} MB)`);
                await pollCameraStatuses();
                if (activeTab === 'recordings') fetchRecordings();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to stop video recording');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDeleteRecording = async (recordingId) => {
        if (!window.confirm("Are you sure you want to permanently delete this video recording?")) return;
        try {
            await deviceAPI.deleteRecording(recordingId);
            toast.success('Video recording deleted successfully');
            fetchRecordings();
        } catch (err) {
            toast.error('Failed to delete recording');
        }
    };

    const handleTestVoice = async () => {
        try {
            toast('Triggering voice announcement test on camera/server...', { icon: '🔊' });
            const res = await deviceAPI.testVoice({ text: 'Thank you, voice response system is active and operational.' });
            if (res.data?.success) {
                toast.success('Voice announcement dispatched to camera / server speakers');
            } else {
                toast.error(res.data?.message || 'Voice test failed');
            }
        } catch (e) {
            toast.error('Voice test failed: ' + (e.response?.data?.message || e.message));
        }
    };

    // Schedule managers
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
            await deviceAPI.updateDevice(deviceId, { recordingSchedule: config });
            toast.success('Video recording schedule saved successfully!');
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to save video recording schedule settings');
        }
    };

    // Formatters
    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDuration = (secs) => {
        if (!secs) return '00:00';
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Filter devices
    const filteredDevices = devices.filter(d => {
        if (typeFilter === 'KIOSK') return d.deviceType === 'Kiosk';
        if (typeFilter === 'IPCAMERA') return d.deviceType === 'IPCamera';
        return true;
    });

    // Group IP cameras by Location & ZoneGroup for multi-camera clubbing
    const groupedCameras = {};
    devices.filter(d => d.deviceType === 'IPCamera').forEach(cam => {
        const locName = cam.location?.name || 'Global HQ';
        const zone = cam.zoneGroup || 'Main Area';
        const groupKey = `${locName} • ${zone}`;
        if (!groupedCameras[groupKey]) {
            groupedCameras[groupKey] = {
                locationName: locName,
                zoneGroup: zone,
                cameras: []
            };
        }
        groupedCameras[groupKey].cameras.push(cam);
    });

    const activeKiosksCount = devices.filter(d => d.deviceType === 'Kiosk' && d.isActive).length;
    const activeCamerasCount = devices.filter(d => d.deviceType === 'IPCamera' && d.isActive).length;
    const runningStreamCount = devices.filter(d => d.deviceType === 'IPCamera' && d.isStreamingActive).length;

    return (
        <div style={{ padding: '1rem 1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header & Quick Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.35rem', fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <FiShield style={{ color: '#0ea5e9' }} /> Attendance Device & IP Camera Hub
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '0.15rem 0 0 0' }}>
                        Manage tablet kiosks, multi-camera CCTV turnstiles, video surveillance recording, and touchless Edge AI biometric recognition.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button 
                        onClick={() => openCreateModal('Kiosk')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #3b82f6', background: 'rgba(59, 130, 246, 0.1)', color: '#38bdf8', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                        <FiTablet /> + Add Tablet Kiosk
                    </button>
                    <button 
                        onClick={() => openCreateModal('IPCamera')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#ffffff', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                        <FiVideo /> + Add IP Camera / CCTV
                    </button>
                </div>
            </div>

            {/* Quick Status KPI Cards - 4 Compact Cards in 1 Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', marginBottom: '0.85rem' }}>
                <div style={{ background: '#111827', border: '1px solid #1f2937', borderLeft: '3px solid #3b82f6', borderRadius: '8px', padding: '0.55rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', fontWeight: '600' }}>Tablet Kiosks</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#38bdf8' }}>{activeKiosksCount} / {devices.filter(d => d.deviceType === 'Kiosk').length} Active</div>
                    </div>
                    <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiTablet size={15} />
                    </div>
                </div>

                <div style={{ background: '#111827', border: '1px solid #1f2937', borderLeft: '3px solid #10b981', borderRadius: '8px', padding: '0.55rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', fontWeight: '600' }}>IP Cameras (CCTV)</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#34d399' }}>{activeCamerasCount} Configured</div>
                    </div>
                    <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiVideo size={15} />
                    </div>
                </div>

                <div style={{ background: '#111827', border: '1px solid #1f2937', borderLeft: '3px solid #8b5cf6', borderRadius: '8px', padding: '0.55rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', fontWeight: '600' }}>AI Streams Live</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#a78bfa' }}>{runningStreamCount} Running</div>
                    </div>
                    <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiCpu size={15} />
                    </div>
                </div>

                <div style={{ background: '#111827', border: '1px solid #1f2937', borderLeft: '3px solid #f59e0b', borderRadius: '8px', padding: '0.55rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', fontWeight: '600' }}>Saved Surveillance</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#fbbf24' }}>{recordingsSummary.totalRecordings || 0} Clips</div>
                    </div>
                    <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiFilm size={15} />
                    </div>
                </div>
            </div>

            {/* Navigation Tabs Bar in Single Line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.85rem', paddingBottom: '0.5rem', borderBottom: '1px solid #1e293b' }}>
                <button 
                    onClick={() => setActiveTab('register')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        background: activeTab === 'register' ? '#0ea5e9' : 'rgba(30, 41, 59, 0.6)',
                        color: activeTab === 'register' ? '#fff' : '#94a3b8',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <FiLayers /> Device & Camera Register ({devices.length})
                </button>

                <button 
                    onClick={() => setActiveTab('monitor')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        background: activeTab === 'monitor' ? '#0ea5e9' : 'rgba(30, 41, 59, 0.6)',
                        color: activeTab === 'monitor' ? '#fff' : '#94a3b8',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <FiEye /> Multi-Camera Live AI Monitoring & Diagnostics
                </button>

                <button 
                    onClick={() => setActiveTab('recordings')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        background: activeTab === 'recordings' ? '#0ea5e9' : 'rgba(30, 41, 59, 0.6)',
                        color: activeTab === 'recordings' ? '#fff' : '#94a3b8',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <FiFilm /> Surveillance Video Recordings ({recordingsSummary.totalRecordings || 0})
                </button>

                <button 
                    onClick={() => setActiveTab('schedules')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.82rem',
                        background: activeTab === 'schedules' ? '#0ea5e9' : 'rgba(30, 41, 59, 0.6)',
                        color: activeTab === 'schedules' ? '#fff' : '#94a3b8',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <FiClock /> Recording Schedules
                </button>
            </div>

            {/* Main Content Area */}
            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '1rem' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                        <div className="spinner-border text-primary" role="status" />
                        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Loading hardware terminals & camera feeds...</p>
                    </div>
                ) : (
                    <div>
                        {/* TAB 1: DEVICE REGISTER */}
                        {activeTab === 'register' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', gap: '0.35rem', background: '#0f172a', padding: '0.2rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
                                        <button 
                                            onClick={() => setTypeFilter('ALL')}
                                            style={{
                                                padding: '0.3rem 0.75rem',
                                                borderRadius: '6px',
                                                border: 'none',
                                                fontSize: '0.78rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                background: typeFilter === 'ALL' ? '#0ea5e9' : 'transparent',
                                                color: typeFilter === 'ALL' ? '#fff' : '#94a3b8'
                                            }}
                                        >
                                            All Devices ({devices.length})
                                        </button>
                                        <button 
                                            onClick={() => setTypeFilter('KIOSK')}
                                            style={{
                                                padding: '0.3rem 0.75rem',
                                                borderRadius: '6px',
                                                border: 'none',
                                                fontSize: '0.78rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                background: typeFilter === 'KIOSK' ? '#0ea5e9' : 'transparent',
                                                color: typeFilter === 'KIOSK' ? '#fff' : '#94a3b8'
                                            }}
                                        >
                                            Tablet Kiosks ({devices.filter(d => d.deviceType === 'Kiosk').length})
                                        </button>
                                        <button 
                                            onClick={() => setTypeFilter('IPCAMERA')}
                                            style={{
                                                padding: '0.3rem 0.75rem',
                                                borderRadius: '6px',
                                                border: 'none',
                                                fontSize: '0.78rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                background: typeFilter === 'IPCAMERA' ? '#0ea5e9' : 'transparent',
                                                color: typeFilter === 'IPCAMERA' ? '#fff' : '#94a3b8'
                                            }}
                                        >
                                            IP Cameras / CCTV ({devices.filter(d => d.deviceType === 'IPCamera').length})
                                        </button>
                                    </div>
                                </div>

                                    <div className="table-responsive" style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                                        <table className="table mb-0" style={{ color: '#f1f5f9' }}>
                                            <thead style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
                                                <tr>
                                                    <th style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.65rem 0.85rem' }}>Type & Name</th>
                                                    <th style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.65rem 0.85rem' }}>Company & Branch</th>
                                                    <th style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.65rem 0.85rem' }}>Area / Zone Clubbing</th>
                                                    <th style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.65rem 0.85rem' }}>Hardware & Stream Specs</th>
                                                    <th style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.65rem 0.85rem' }}>Direction / Mode</th>
                                                    <th style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.65rem 0.85rem' }}>AI Recognition</th>
                                                    <th style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.65rem 0.85rem' }}>Status</th>
                                                    <th style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.65rem 0.85rem', textAlign: 'center' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody style={{ background: '#111827' }}>
                                                {filteredDevices.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                                                            No devices registered under this filter. Click "+ Add Tablet Kiosk" or "+ Add IP Camera" above to get started.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredDevices.map(device => {
                                                        const isIpCam = device.deviceType === 'IPCamera';
                                                        return (
                                                            <tr key={device._id} style={{ borderBottom: '1px solid #1f2937' }}>
                                                                <td style={{ padding: '0.65rem 0.85rem' }}>
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <div className="p-2 rounded" style={{ background: isIpCam ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: isIpCam ? '#34d399' : '#38bdf8' }}>
                                                                            {isIpCam ? <FiVideo size={16} /> : <FiTablet size={16} />}
                                                                        </div>
                                                                        <div>
                                                                            <span style={{ fontWeight: '600', color: '#f8fafc', display: 'block', fontSize: '0.85rem' }}>{device.description}</span>
                                                                            <small style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{isIpCam ? 'CCTV / RTSP' : 'Mobile Kiosk'}</small>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '0.65rem 0.85rem' }}>
                                                                    <div style={{ fontSize: '0.84rem', color: '#f1f5f9' }}>{device.company?.name || '—'}</div>
                                                                    <small style={{ color: '#94a3b8', fontSize: '0.72rem' }}><FiMapPin size={10} className="mr-1" />{device.location?.name || 'Global'}</small>
                                                                </td>
                                                                <td style={{ padding: '0.65rem 0.85rem' }}>
                                                                    <span style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                                                                        {device.zoneGroup || 'Main Area'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '0.65rem 0.85rem' }}>
                                                                    <div style={{ fontSize: '0.84rem' }}><strong>{device.brand}</strong> {device.model}</div>
                                                                    {isIpCam ? (
                                                                        <small style={{ color: '#94a3b8', fontFamily: 'monospace', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', fontSize: '0.72rem' }} title={device.streamUrl}>
                                                                            {device.streamUrl === '0' ? '🎥 Local Webcam (0)' : (device.cameraIp ? `${device.cameraIp}:${device.cameraPort || 554}` : (device.streamUrl || 'RTSP Stream'))}
                                                                        </small>
                                                                    ) : (
                                                                        <small style={{ color: '#94a3b8', fontSize: '0.72rem' }}><code>{device.loginCredentials?.email}</code></small>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '0.65rem 0.85rem' }}>
                                                                    <span style={{
                                                                        padding: '0.2rem 0.45rem',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: '700',
                                                                        textTransform: 'uppercase',
                                                                        background: device.direction === 'in' ? 'rgba(16, 185, 129, 0.15)' : device.direction === 'out' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                                        color: device.direction === 'in' ? '#34d399' : device.direction === 'out' ? '#fbbf24' : '#60a5fa'
                                                                    }}>
                                                                        {device.direction || 'auto'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '0.65rem 0.85rem' }}>
                                                                    {isIpCam ? (
                                                                        <div className="d-flex align-items-center gap-2">
                                                                            <button 
                                                                                className={`btn btn-xs btn-${device.isStreamingActive ? 'danger' : 'success'} d-flex align-items-center gap-1`}
                                                                                onClick={() => handleToggleStream(device._id)}
                                                                                disabled={togglingStreamId === device._id || !device.isActive}
                                                                                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                                                                            >
                                                                                {device.isStreamingActive ? <><FiSquare size={10} /> Stop AI</> : <><FiPlay size={10} /> Start AI</>}
                                                                            </button>
                                                                            <span style={{
                                                                                fontSize: '0.7rem',
                                                                                fontWeight: '700',
                                                                                padding: '0.15rem 0.4rem',
                                                                                borderRadius: '4px',
                                                                                background: device.isStreamingActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                                                                                color: device.isStreamingActive ? '#34d399' : '#94a3b8'
                                                                            }}>
                                                                                {device.isStreamingActive ? 'RUNNING' : 'STANDBY'}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Face + PIN/QR</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '0.65rem 0.85rem' }}>
                                                                    <span style={{
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: '600',
                                                                        padding: '0.2rem 0.45rem',
                                                                        borderRadius: '4px',
                                                                        background: device.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                                        color: device.isActive ? '#34d399' : '#f87171'
                                                                    }}>
                                                                        {device.isActive ? 'Active' : 'Inactive'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                                                                    <div className="d-flex justify-content-center gap-1">
                                                                        <button 
                                                                            onClick={() => openEditModal(device)} 
                                                                            title="Edit settings"
                                                                            style={{ background: 'rgba(59, 130, 246, 0.15)', border: 'none', color: '#38bdf8', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                                                                        >
                                                                            <FiEdit2 size={13} />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleDelete(device._id)} 
                                                                            title="Delete device"
                                                                            style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', color: '#f87171', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                                                                        >
                                                                            <FiTrash2 size={13} />
                                                                        </button>
                                                                    </div>
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

                            {/* TAB 2: MULTI-CAMERA LIVE AI MONITORING & DIAGNOSTICS */}
                            {activeTab === 'monitor' && (
                                <div>
                                    <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                                        <div>
                                            <div className="d-flex align-items-center gap-2 mb-1">
                                                <h4 className="h5 mb-0 font-weight-bold">Touchless AI Video Recognition Feeds & Diagnostics</h4>
                                                <span className="badge badge-success d-flex align-items-center gap-1" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                                                    <FiVolume2 size={12} /> Voice Response Active
                                                </span>
                                            </div>
                                            <p className="text-muted small mb-0">
                                                Speaks employee name upon punch & alerts unidentified strangers. Cameras in the same zone share cooldowns.
                                            </p>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <button className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1" onClick={handleTestVoice}>
                                                <FiVolume2 size={13} /> Test Voice Response
                                            </button>
                                            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={pollCameraStatuses}>
                                                <FiRefreshCw size={12} /> Refresh Camera Status
                                            </button>
                                        </div>
                                    </div>

                                    {Object.keys(groupedCameras).length === 0 ? (
                                        <div className="text-center py-5 card shadow-sm p-4 text-muted">
                                            <FiVideo size={42} className="mx-auto mb-3 text-secondary" />
                                            <h5>No IP Cameras Registered Yet</h5>
                                            <p className="small">Click "+ Add IP Camera / CCTV" to connect your entrance/turnstile cameras and start AI attendance.</p>
                                            <button className="btn btn-primary mx-auto mt-2" onClick={() => openCreateModal('IPCamera')}>
                                                + Register IP Camera
                                            </button>
                                        </div>
                                    ) : (
                                        Object.entries(groupedCameras).map(([groupKey, group]) => (
                                            <div key={groupKey} className="card shadow-sm border mb-4">
                                                <div className="card-header bg-light py-2 px-3 d-flex justify-content-between align-items-center">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <FiLayers className="text-primary" />
                                                        <span className="font-weight-bold" style={{ color: 'var(--text-primary)' }}>
                                                            {group.locationName} • Area Zone: <span className="text-primary font-weight-bold">{group.zoneGroup}</span>
                                                        </span>
                                                        <span className="badge badge-primary ml-2">{group.cameras.length} {group.cameras.length > 1 ? 'Cameras Clubbed' : 'Camera'}</span>
                                                    </div>
                                                    <small className="text-muted font-italic">Shared anti-duplicate cooldown active for this zone</small>
                                                </div>

                                                <div className="card-body p-3">
                                                    <div className="row">
                                                        {group.cameras.map(camera => {
                                                            const status = cameraStatuses[camera._id] || {};
                                                            const isRunning = camera.isStreamingActive && camera.isActive;
                                                            const isOnlineAndReceiving = isRunning && status.status === 'running';
                                                            const isRec = status.isRecording;
                                                            const hasError = status.status === 'error' || status.status === 'offline' || !!status.error;
                                                            const pyApiUrl = 'http://127.0.0.1:5001';

                                                            return (
                                                                <div key={camera._id} className="col-lg-6 col-xl-6 mb-4">
                                                                    <div className="card h-100 shadow-sm border" style={{ background: '#0f172a', color: '#f8fafc', borderRadius: '8px', overflow: 'hidden' }}>
                                                                        {/* Camera Card Header */}
                                                                        <div className="p-3 d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid #1e293b' }}>
                                                                            <div>
                                                                                <div className="font-weight-bold d-flex align-items-center gap-2" style={{ color: '#fff', fontSize: '0.95rem' }}>
                                                                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: isOnlineAndReceiving ? '#10b981' : hasError ? '#ef4444' : '#64748b' }}></span>
                                                                                    {camera.description}
                                                                                    {isRec && (
                                                                                        <span className="badge badge-danger text-uppercase d-flex align-items-center gap-1" style={{ animation: 'pulse 1.5s infinite', fontSize: '0.65rem' }}>
                                                                                            ● REC {formatDuration(status.recordingElapsedSecs)}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <small style={{ color: '#94a3b8' }}>
                                                                                    {camera.brand} {camera.model} • {camera.streamUrl === '0' ? 'Local Webcam (0)' : (camera.cameraIp || 'RTSP')}
                                                                                </small>
                                                                            </div>
                                                                            <div className="d-flex align-items-center gap-2">
                                                                                <button
                                                                                    className="btn btn-xs btn-outline-light d-flex align-items-center gap-1"
                                                                                    onClick={() => setDiagnosticModalCamera(camera)}
                                                                                    style={{ fontSize: '0.75rem', borderColor: '#475569' }}
                                                                                    title="Open Live Diagnostic View"
                                                                                >
                                                                                    <FiMaximize2 size={12} /> Diagnostics
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => handleToggleStream(camera._id)}
                                                                                    disabled={togglingStreamId === camera._id || !camera.isActive}
                                                                                    className={`btn btn-xs btn-${isRunning ? 'danger' : 'success'}`}
                                                                                    style={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                                                                                >
                                                                                    {isRunning ? '⏹ Stop AI' : '▶ Start AI'}
                                                                                </button>
                                                                            </div>
                                                                        </div>

                                                                        {/* Stream Diagnostics Alert Banner if stream fails */}
                                                                        {isRunning && hasError && (
                                                                            <div className="px-3 py-2" style={{ background: '#450a0a', borderBottom: '1px solid #7f1d1d', color: '#fecaca', fontSize: '0.78rem' }}>
                                                                                <div className="d-flex justify-content-between align-items-center">
                                                                                    <div className="d-flex align-items-center gap-2">
                                                                                        <FiAlertTriangle className="text-warning" size={16} />
                                                                                        <span>
                                                                                            <strong>Stream Unreachable:</strong> {status.error || 'Cannot connect to RTSP stream'}
                                                                                        </span>
                                                                                    </div>
                                                                                    <button 
                                                                                        className="btn btn-xs btn-warning font-weight-bold ml-2 text-dark"
                                                                                        style={{ fontSize: '0.7rem' }}
                                                                                        onClick={() => handleSwitchToWebcam(camera._id)}
                                                                                        disabled={actionLoadingId === camera._id}
                                                                                    >
                                                                                        🎥 Switch to Webcam (0)
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Video Stream / Feed Window */}
                                                                        <div 
                                                                            style={{ position: 'relative', width: '100%', height: '260px', background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', cursor: 'pointer' }}
                                                                            onClick={() => setDiagnosticModalCamera(camera)}
                                                                        >
                                                                            {isRunning ? (
                                                                                <img 
                                                                                    src={`${pyApiUrl}/ip-camera/snapshot/${camera._id}?t=${streamTime}`}
                                                                                    alt="Live AI Stream"
                                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                                    onError={(e) => {
                                                                                        e.target.onerror = null;
                                                                                        e.target.style.display = 'none';
                                                                                    }}
                                                                                />
                                                                            ) : null}

                                                                            {/* Overlay CRT Grid & OSD */}
                                                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)', backgroundSize: '100% 4px', pointerEvents: 'none', zIndex: 2 }}></div>

                                                                            <div style={{ position: 'absolute', top: '10px', left: '10px', color: isOnlineAndReceiving ? '#10b981' : '#f59e0b', fontFamily: 'monospace', fontSize: '0.75rem', textShadow: '0 0 3px #000', zIndex: 3 }}>
                                                                                FEED: {isOnlineAndReceiving ? `AI ACTIVE (${status.width || 640}x${status.height || 480}px)` : isRunning ? 'RECONNECTING RTSP...' : 'STANDBY (CLICK START)'}<br />
                                                                                ZONE: {camera.zoneGroup}
                                                                            </div>

                                                                            <div style={{ position: 'absolute', bottom: '10px', right: '10px', color: '#10b981', fontFamily: 'monospace', fontSize: '0.8rem', textShadow: '0 0 3px #000', zIndex: 3 }}>
                                                                                {streamTime}
                                                                            </div>

                                                                            {!isRunning && (
                                                                                <div className="text-center" style={{ zIndex: 1, color: '#64748b' }}>
                                                                                    <FiVideo size={36} className="mb-2" /><br />
                                                                                    <span className="small">AI Face Recognition is paused for this camera</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Card Action Controls & Recording Buttons */}
                                                                        <div className="px-3 py-2 d-flex justify-content-between align-items-center" style={{ background: '#111827', borderTop: '1px solid #1f2937', fontSize: '0.8rem' }}>
                                                                            <div className="d-flex align-items-center gap-2">
                                                                                {isRec ? (
                                                                                    <button 
                                                                                        className="btn btn-xs btn-outline-danger d-flex align-items-center gap-1 font-weight-bold"
                                                                                        onClick={() => handleStopRecording(camera._id)}
                                                                                        disabled={actionLoadingId === camera._id}
                                                                                    >
                                                                                        <FiSquare size={10} /> Stop Recording ({formatDuration(status.recordingElapsedSecs)})
                                                                                    </button>
                                                                                ) : (
                                                                                    <button 
                                                                                        className="btn btn-xs btn-outline-warning d-flex align-items-center gap-1"
                                                                                        onClick={() => handleStartRecording(camera._id)}
                                                                                        disabled={actionLoadingId === camera._id || !camera.isActive}
                                                                                        title="Record live video stream to MP4 file"
                                                                                    >
                                                                                        <FiCamera size={11} /> Start Recording
                                                                                    </button>
                                                                                )}

                                                                                {camera.streamUrl !== '0' && (
                                                                                    <button 
                                                                                        className="btn btn-xs btn-outline-info d-flex align-items-center gap-1"
                                                                                        onClick={() => handleSwitchToWebcam(camera._id)}
                                                                                        disabled={actionLoadingId === camera._id}
                                                                                        title="Switch input to laptop/PC local webcam (Camera 0)"
                                                                                    >
                                                                                        <FiVideo size={10} /> Webcam (0)
                                                                                    </button>
                                                                                )}
                                                                            </div>

                                                                            <button 
                                                                                className="btn btn-xs btn-outline-secondary text-white"
                                                                                onClick={() => setDiagnosticModalCamera(camera)}
                                                                                style={{ fontSize: '0.72rem' }}
                                                                            >
                                                                                🔍 Full Screen View
                                                                            </button>
                                                                        </div>

                                                                        {/* Live AI Statistics Footer */}
                                                                        <div className="p-3 d-flex justify-content-between align-items-center" style={{ background: '#1e293b', borderTop: '1px solid #334155', fontSize: '0.8rem' }}>
                                                                            <div className="d-flex gap-3">
                                                                                <div>
                                                                                    <span style={{ color: '#94a3b8' }}>Punches Today:</span>{' '}
                                                                                    <strong style={{ color: '#10b981' }}>{status.totalPunches || 0}</strong>
                                                                                </div>
                                                                                <div>
                                                                                    <span style={{ color: '#94a3b8' }}>Visitors Logged:</span>{' '}
                                                                                    <strong style={{ color: '#f59e0b' }}>{status.visitorCount || 0}</strong>
                                                                                </div>
                                                                            </div>

                                                                            {status.lastPunch ? (
                                                                                <div className="badge badge-success" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                                                                                    Last: {status.lastPunch.employeeId} ({status.lastPunch.score}%) @ {status.lastPunch.time}
                                                                                </div>
                                                                            ) : (
                                                                                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No punches yet today</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* TAB 3: SURVEILLANCE VIDEO RECORDINGS ARCHIVE */}
                            {activeTab === 'recordings' && (
                                <div>
                                    {/* Filter Toolbar */}
                                    <div className="card shadow-sm border-0 mb-4 bg-light p-3">
                                        <div className="row g-2 align-items-center">
                                            <div className="col-md-3">
                                                <div className="input-group input-group-sm">
                                                    <span className="input-group-text bg-white"><FiSearch /></span>
                                                    <input 
                                                        type="text" 
                                                        className="form-control" 
                                                        placeholder="Search camera, area..." 
                                                        value={recordingsFilter.search} 
                                                        onChange={(e) => setRecordingsFilter(prev => ({ ...prev, search: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-md-2">
                                                <select 
                                                    className="form-select form-select-sm"
                                                    value={recordingsFilter.deviceId}
                                                    onChange={(e) => setRecordingsFilter(prev => ({ ...prev, deviceId: e.target.value }))}
                                                >
                                                    <option value="">All Cameras</option>
                                                    {devices.filter(d => d.deviceType === 'IPCamera').map(cam => (
                                                        <option key={cam._id} value={cam._id}>{cam.description}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-2">
                                                <select 
                                                    className="form-select form-select-sm"
                                                    value={recordingsFilter.recordingType}
                                                    onChange={(e) => setRecordingsFilter(prev => ({ ...prev, recordingType: e.target.value }))}
                                                >
                                                    <option value="ALL">All Types (Manual & Sched)</option>
                                                    <option value="Manual">Manual Recordings</option>
                                                    <option value="Scheduled">Scheduled Recordings</option>
                                                </select>
                                            </div>
                                            <div className="col-md-2">
                                                <input 
                                                    type="date" 
                                                    className="form-control form-control-sm"
                                                    value={recordingsFilter.startDate}
                                                    onChange={(e) => setRecordingsFilter(prev => ({ ...prev, startDate: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-2">
                                                <input 
                                                    type="date" 
                                                    className="form-control form-control-sm"
                                                    value={recordingsFilter.endDate}
                                                    onChange={(e) => setRecordingsFilter(prev => ({ ...prev, endDate: e.target.value }))}
                                                />
                                            </div>
                                            <div className="col-md-1 d-flex gap-1">
                                                <button className="btn btn-sm btn-outline-secondary w-100" onClick={fetchRecordings} title="Refresh archive">
                                                    <FiRefreshCw />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recordings Archive Table */}
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle mb-0">
                                            <thead className="bg-light">
                                                <tr>
                                                    <th>Preview</th>
                                                    <th>Camera & Location</th>
                                                    <th>Area Zone</th>
                                                    <th>Recording Type</th>
                                                    <th>Recorded At</th>
                                                    <th>Duration</th>
                                                    <th>File Size</th>
                                                    <th>Status</th>
                                                    <th className="text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recordingsLoading ? (
                                                    <tr>
                                                        <td colSpan="9" className="text-center py-5">
                                                            <div className="spinner-border text-primary spinner-border-sm mr-2" /> Loading surveillance clips...
                                                        </td>
                                                    </tr>
                                                ) : recordings.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="9" className="text-center py-5 text-muted">
                                                            <FiFilm size={36} className="mb-2 text-secondary" /><br />
                                                            No video recordings saved yet. Click <strong>"Start Recording"</strong> on any live camera card or set a schedule to capture audit footage.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    recordings.map(rec => (
                                                        <tr key={rec._id}>
                                                            <td style={{ width: '80px' }}>
                                                                <div 
                                                                    className="rounded overflow-hidden position-relative cursor-pointer" 
                                                                    style={{ width: '70px', height: '44px', background: '#000' }}
                                                                    onClick={() => setSelectedVideoToPlay(rec)}
                                                                >
                                                                    {rec.thumbnailPath ? (
                                                                        <img src={rec.thumbnailPath} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    ) : (
                                                                        <div className="h-100 d-flex align-items-center justify-content-center text-muted"><FiFilm /></div>
                                                                    )}
                                                                    <div className="position-absolute top-50 start-50 translate-middle text-white" style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '2px 5px' }}>
                                                                        <FiPlay size={10} />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="font-weight-bold">{rec.cameraName}</div>
                                                                <small className="text-muted">{rec.locationName}</small>
                                                            </td>
                                                            <td>
                                                                <span className="badge badge-info">{rec.zoneGroup || 'Main Area'}</span>
                                                            </td>
                                                            <td>
                                                                <span className={`badge badge-${rec.recordingType === 'Scheduled' ? 'purple' : 'primary'}`} style={{ background: rec.recordingType === 'Scheduled' ? '#8b5cf6' : undefined }}>
                                                                    {rec.recordingType}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div>{new Date(rec.startTime).toLocaleDateString()}</div>
                                                                <small className="text-muted">{new Date(rec.startTime).toLocaleTimeString()}</small>
                                                            </td>
                                                            <td>
                                                                <strong>{formatDuration(rec.durationSeconds)}</strong>
                                                            </td>
                                                            <td>
                                                                {formatBytes(rec.fileSize)}
                                                            </td>
                                                            <td>
                                                                <span className={`badge badge-${rec.status === 'Completed' ? 'success' : rec.status === 'Recording' ? 'danger' : 'warning'}`}>
                                                                    {rec.status}
                                                                </span>
                                                            </td>
                                                            <td className="text-center">
                                                                <div className="d-flex justify-content-center gap-1">
                                                                    <button 
                                                                        className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                                                                        onClick={() => setSelectedVideoToPlay(rec)}
                                                                        title="Play Surveillance Clip"
                                                                    >
                                                                        <FiPlay size={12} /> Play
                                                                    </button>
                                                                    {rec.filePath && (
                                                                        <a 
                                                                            href={rec.filePath} 
                                                                            download 
                                                                            className="btn btn-sm btn-outline-secondary" 
                                                                            title="Download MP4 Video"
                                                                        >
                                                                            <FiDownload size={12} />
                                                                        </a>
                                                                    )}
                                                                    <button 
                                                                        className="btn btn-sm btn-outline-danger"
                                                                        onClick={() => handleDeleteRecording(rec._id)}
                                                                        title="Delete Recording"
                                                                    >
                                                                        <FiTrash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    {recordingsTotalPages > 1 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            <small className="text-muted">Showing page {recordingsPage} of {recordingsTotalPages}</small>
                                            <div className="btn-group btn-group-sm">
                                                <button className="btn btn-outline-secondary" disabled={recordingsPage <= 1} onClick={() => setRecordingsPage(p => p - 1)}>Previous</button>
                                                <button className="btn btn-outline-secondary" disabled={recordingsPage >= recordingsTotalPages} onClick={() => setRecordingsPage(p => p + 1)}>Next</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 4: RECORDING SCHEDULES */}
                            {activeTab === 'schedules' && (
                                <div className="row">
                                    {devices.length === 0 ? (
                                        <div className="col-12 text-center py-5 text-muted card shadow-sm">
                                            No devices registered.
                                        </div>
                                    ) : (
                                        devices.map(device => {
                                            const schedule = scheduleConfig[device._id] || { enabled: false, startHour: '09:00', durationHours: 8 };
                                            return (
                                                <div key={device._id} className="col-md-6 col-lg-4 mb-4">
                                                    <div className="card shadow-sm h-100 p-3 border">
                                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                                            <h5 className="h6 mb-0 font-weight-bold">{device.description}</h5>
                                                            <span className={`badge badge-${device.isActive ? 'success' : 'secondary'}`}>
                                                                {device.isActive ? 'ONLINE' : 'OFFLINE'}
                                                            </span>
                                                        </div>

                                                        <div className="small text-muted mb-3">
                                                            <strong>Type:</strong> {device.deviceType === 'IPCamera' ? 'IP Camera' : 'Tablet Kiosk'}<br />
                                                            <strong>Branch:</strong> {device.location?.name || 'Global'}<br />
                                                            <strong>Zone:</strong> {device.zoneGroup || 'Main Area'}
                                                        </div>

                                                        <div className="border-top pt-3">
                                                            <div className="form-group form-check mb-2">
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input"
                                                                    id={`schedule-enable-${device._id}`}
                                                                    checked={schedule.enabled}
                                                                    onChange={(e) => handleUpdateScheduleLocal(device._id, 'enabled', e.target.checked)}
                                                                />
                                                                <label htmlFor={`schedule-enable-${device._id}`} className="form-check-label font-weight-bold small" style={{ cursor: 'pointer' }}>
                                                                    Enable Video Schedule
                                                                </label>
                                                            </div>

                                                            <div className="row">
                                                                <div className="col-6 form-group mb-2">
                                                                    <label className="small font-weight-bold">Start Time</label>
                                                                    <input
                                                                        type="time"
                                                                        className="form-control form-control-sm"
                                                                        value={schedule.startHour}
                                                                        disabled={!schedule.enabled}
                                                                        onChange={(e) => handleUpdateScheduleLocal(device._id, 'startHour', e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="col-6 form-group mb-2">
                                                                    <label className="small font-weight-bold">Duration (Hrs)</label>
                                                                    <input
                                                                        type="number"
                                                                        className="form-control form-control-sm"
                                                                        value={schedule.durationHours}
                                                                        disabled={!schedule.enabled}
                                                                        min={1}
                                                                        max={24}
                                                                        onChange={(e) => handleUpdateScheduleLocal(device._id, 'durationHours', e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={() => handleSaveSchedule(device._id)}
                                                                className="btn btn-sm btn-primary btn-block mt-2"
                                                            >
                                                                Save Schedule
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* LIVE STREAM DIAGNOSTIC & RECORDING MODAL */}
            {diagnosticModalCamera && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered modal-xl">
                        <div className="modal-content shadow-lg border-0" style={{ background: '#0f172a', color: '#fff' }}>
                            <div className="modal-header border-secondary py-3 d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center gap-2">
                                    <FiVideo className="text-primary" size={20} />
                                    <div>
                                        <h5 className="modal-title font-weight-bold mb-0 text-white">
                                            {diagnosticModalCamera.description} — Live AI Camera Stream & Diagnostics
                                        </h5>
                                        <small className="text-muted">
                                            {diagnosticModalCamera.brand} {diagnosticModalCamera.model} • Area: {diagnosticModalCamera.zoneGroup} • Direction: {diagnosticModalCamera.direction?.toUpperCase()}
                                        </small>
                                    </div>
                                </div>
                                <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setDiagnosticModalCamera(null)}>
                                    <FiX size={18} />
                                </button>
                            </div>

                            <div className="modal-body p-3">
                                {(() => {
                                    const status = cameraStatuses[diagnosticModalCamera._id] || {};
                                    const isRunning = diagnosticModalCamera.isStreamingActive && diagnosticModalCamera.isActive;
                                    const isRec = status.isRecording;
                                    const hasError = status.status === 'error' || status.status === 'offline' || !!status.error;
                                    const pyApiUrl = 'http://127.0.0.1:5001';

                                    return (
                                        <div>
                                            {/* Status Banner */}
                                            {hasError ? (
                                                <div className="alert alert-danger mb-3 p-3 d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <strong className="d-block"><FiAlertTriangle className="mr-1" /> Stream Connectivity Issue Detected:</strong>
                                                        <small>{status.error || 'OpenCV cannot establish RTSP TCP handshake. Check LAN IP / credentials.'}</small>
                                                    </div>
                                                    <button 
                                                        className="btn btn-warning font-weight-bold btn-sm text-dark d-flex align-items-center gap-1"
                                                        onClick={() => handleSwitchToWebcam(diagnosticModalCamera._id)}
                                                        disabled={actionLoadingId === diagnosticModalCamera._id}
                                                    >
                                                        🎥 Switch to Local Webcam (0)
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="alert alert-success mb-3 p-2 d-flex justify-content-between align-items-center" style={{ background: '#064e3b', borderColor: '#047857', color: '#a7f3d0' }}>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                                                        <span><strong>Stream Operational:</strong> Receiving frames ({status.width || 640}x{status.height || 480}px @ 3 FPS AI Scan)</span>
                                                    </div>
                                                    <span className="badge badge-dark">{streamTime}</span>
                                                </div>
                                            )}

                                            {/* Live Stream Frame Container */}
                                            <div style={{ position: 'relative', width: '100%', height: '480px', background: '#000', borderRadius: '8px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                {isRunning ? (
                                                    <img 
                                                        src={`${pyApiUrl}/ip-camera/snapshot/${diagnosticModalCamera._id}?t=${streamTime}`}
                                                        alt="Live Diagnostic Feed"
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    />
                                                ) : (
                                                    <div className="text-center text-muted">
                                                        <FiVideo size={48} className="mb-2" /><br />
                                                        <h5>Camera AI Recognition is Stopped</h5>
                                                        <p className="small">Click "Start AI Stream" below to launch frame recognition.</p>
                                                    </div>
                                                )}

                                                {/* Live Overlay Indicators */}
                                                <div style={{ position: 'absolute', top: '15px', left: '15px', color: '#10b981', fontFamily: 'monospace', fontSize: '0.85rem', textShadow: '0 0 4px #000', zIndex: 4 }}>
                                                    STATUS: {isRunning ? (status.status || 'RUNNING').toUpperCase() : 'STOPPED'}<br />
                                                    RES: {status.width ? `${status.width} x ${status.height} px` : 'N/A'}<br />
                                                    LAST FRAME: {status.lastFrameAgo !== null && status.lastFrameAgo !== undefined ? `${status.lastFrameAgo}s ago` : 'N/A'}
                                                </div>

                                                {isRec && (
                                                    <div style={{ position: 'absolute', top: '15px', right: '15px', background: '#ef4444', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85rem', animation: 'pulse 1.5s infinite', zIndex: 4 }}>
                                                        ● REC {formatDuration(status.recordingElapsedSecs)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Diagnostic Control Bar */}
                                            <div className="mt-3 p-3 rounded d-flex flex-wrap justify-content-between align-items-center gap-2" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                                                <div className="d-flex align-items-center gap-2">
                                                    <button 
                                                        className={`btn btn-sm btn-${isRunning ? 'danger' : 'success'} font-weight-bold d-flex align-items-center gap-1`}
                                                        onClick={() => handleToggleStream(diagnosticModalCamera._id)}
                                                        disabled={togglingStreamId === diagnosticModalCamera._id}
                                                    >
                                                        {isRunning ? <><FiSquare size={13} /> Stop AI Stream</> : <><FiPlay size={13} /> Start AI Stream</>}
                                                    </button>

                                                    {isRec ? (
                                                        <button 
                                                            className="btn btn-sm btn-danger font-weight-bold d-flex align-items-center gap-1"
                                                            onClick={() => handleStopRecording(diagnosticModalCamera._id)}
                                                            disabled={actionLoadingId === diagnosticModalCamera._id}
                                                        >
                                                            <FiSquare size={13} /> Stop Video Recording
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            className="btn btn-sm btn-warning text-dark font-weight-bold d-flex align-items-center gap-1"
                                                            onClick={() => handleStartRecording(diagnosticModalCamera._id)}
                                                            disabled={actionLoadingId === diagnosticModalCamera._id || !diagnosticModalCamera.isActive}
                                                        >
                                                            <FiCamera size={13} /> ⏺️ Record Live Surveillance
                                                        </button>
                                                    )}

                                                    <button 
                                                        className="btn btn-sm btn-outline-info d-flex align-items-center gap-1"
                                                        onClick={() => handleSwitchToWebcam(diagnosticModalCamera._id)}
                                                        disabled={actionLoadingId === diagnosticModalCamera._id}
                                                    >
                                                        <FiVideo size={13} /> Switch to Local Webcam (0)
                                                    </button>
                                                </div>

                                                <div className="d-flex align-items-center gap-2">
                                                    <button className="btn btn-sm btn-outline-light d-flex align-items-center gap-1" onClick={handleTestVoice}>
                                                        <FiVolume2 size={13} /> Test Speaker
                                                    </button>
                                                    <button className="btn btn-sm btn-outline-secondary text-white d-flex align-items-center gap-1" onClick={pollCameraStatuses}>
                                                        <FiRefreshCw size={13} /> Refresh
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SURVEILLANCE VIDEO PLAYER MODAL */}
            {selectedVideoToPlay && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1070 }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content shadow-lg border-0" style={{ background: '#0f172a', color: '#fff' }}>
                            <div className="modal-header border-secondary py-3 d-flex justify-content-between align-items-center">
                                <div>
                                    <h5 className="modal-title font-weight-bold mb-0 text-white">
                                        Surveillance Playback — {selectedVideoToPlay.cameraName}
                                    </h5>
                                    <small className="text-muted">
                                        {new Date(selectedVideoToPlay.startTime).toLocaleString()} • Duration: {formatDuration(selectedVideoToPlay.durationSeconds)} • Size: {formatBytes(selectedVideoToPlay.fileSize)}
                                    </small>
                                </div>
                                <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setSelectedVideoToPlay(null)}>
                                    <FiX size={18} />
                                </button>
                            </div>

                            <div className="modal-body p-0" style={{ background: '#000' }}>
                                <video 
                                    src={selectedVideoToPlay.filePath} 
                                    controls 
                                    autoPlay 
                                    style={{ width: '100%', maxHeight: '520px', display: 'block' }}
                                />
                            </div>

                            <div className="modal-footer border-secondary py-2 d-flex justify-content-between align-items-center">
                                <span className="badge badge-info">{selectedVideoToPlay.zoneGroup || 'Main Area'} ({selectedVideoToPlay.recordingType})</span>
                                <div className="d-flex gap-2">
                                    <a href={selectedVideoToPlay.filePath} download className="btn btn-sm btn-primary d-flex align-items-center gap-1">
                                        <FiDownload size={13} /> Download MP4 Video
                                    </a>
                                    <button className="btn btn-sm btn-secondary" onClick={() => setSelectedVideoToPlay(null)}>
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE / EDIT MODAL */}
            {isModalOpen && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content shadow-lg border-0">
                            <div className="modal-header bg-light">
                                <h5 className="modal-title font-weight-bold d-flex align-items-center gap-2">
                                    {formData.deviceType === 'IPCamera' ? <FiVideo className="text-primary" /> : <FiTablet className="text-primary" />}
                                    {editMode ? `Edit ${formData.deviceType === 'IPCamera' ? 'IP Camera' : 'Kiosk Terminal'}` : `Register New ${formData.deviceType === 'IPCamera' ? 'IP Camera (CCTV)' : 'Kiosk Terminal'}`}
                                </h5>
                                <button type="button" className="close" onClick={() => setIsModalOpen(false)}>
                                    <span>&times;</span>
                                </button>
                            </div>
                            
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body p-4">
                                    {/* Device Type Switcher */}
                                    {!editMode && (
                                        <div className="form-group mb-4">
                                            <label className="form-label font-weight-bold">Hardware Category *</label>
                                            <div className="row">
                                                <div className="col-md-6">
                                                    <div 
                                                        className={`card p-3 text-center cursor-pointer border ${formData.deviceType === 'Kiosk' ? 'border-primary bg-light' : ''}`}
                                                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                                        onClick={() => setFormData(prev => ({ ...prev, deviceType: 'Kiosk', description: 'Front Desk Tablet Kiosk', brand: 'Samsung', model: 'Galaxy Tab A9' }))}
                                                    >
                                                        <FiTablet size={24} className="mx-auto mb-2 text-primary" />
                                                        <div className="font-weight-bold">Tablet / Mobile Kiosk</div>
                                                        <small className="text-muted">Interactive screen check-in with face, PIN, or QR</small>
                                                    </div>
                                                </div>
                                                <div className="col-md-6">
                                                    <div 
                                                        className={`card p-3 text-center cursor-pointer border ${formData.deviceType === 'IPCamera' ? 'border-primary bg-light' : ''}`}
                                                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                                        onClick={() => setFormData(prev => ({ ...prev, deviceType: 'IPCamera', description: 'Main Turnstile Camera', brand: 'Hikvision', model: 'DS-2CD2043G2-I' }))}
                                                    >
                                                        <FiVideo size={24} className="mx-auto mb-2 text-success" />
                                                        <div className="font-weight-bold">IP Camera (CCTV / RTSP)</div>
                                                        <small className="text-muted">Touchless background AI recognition on video stream</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Location & Organization Mapping */}
                                    <h6 className="text-primary font-weight-bold mb-3 d-flex align-items-center gap-2">
                                        <FiMapPin /> Location & Area Zone Mapping
                                    </h6>

                                    <div className="row">
                                        <div className="col-md-4 form-group">
                                            <label className="form-label font-weight-bold">Company *</label>
                                            <select name="company" value={formData.company} onChange={handleCompanyChange} className="form-control" required>
                                                <option value="">Select Company</option>
                                                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="col-md-4 form-group">
                                            <label className="form-label font-weight-bold">Branch Location *</label>
                                            <select name="location" value={formData.location} onChange={handleChange} className="form-control" required>
                                                <option value="">Select Branch Location</option>
                                                {filteredLocations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="col-md-4 form-group">
                                            <label className="form-label font-weight-bold">Area / Zone Grouping *</label>
                                            <input 
                                                type="text" 
                                                name="zoneGroup" 
                                                value={formData.zoneGroup} 
                                                onChange={handleChange} 
                                                placeholder="e.g. Main Entrance Lobby, Gate A" 
                                                className="form-control" 
                                                required 
                                            />
                                            <small className="text-muted">Cameras with the same Area tag share anti-duplicate cooldowns.</small>
                                        </div>
                                    </div>

                                    {/* Device Identification */}
                                    <div className="row">
                                        <div className="col-md-6 form-group">
                                            <label className="form-label font-weight-bold">Device Description / Name *</label>
                                            <input type="text" name="description" value={formData.description} onChange={handleChange} placeholder="e.g. Turnstile 1 Inward Camera" className="form-control" required />
                                        </div>
                                        <div className="col-md-3 form-group">
                                            <label className="form-label font-weight-bold">Brand *</label>
                                            <input type="text" name="brand" value={formData.brand} onChange={handleChange} placeholder="e.g. Hikvision" className="form-control" required />
                                        </div>
                                        <div className="col-md-3 form-group">
                                            <label className="form-label font-weight-bold">Model *</label>
                                            <input type="text" name="model" value={formData.model} onChange={handleChange} placeholder="e.g. 4MP Bullet" className="form-control" required />
                                        </div>
                                    </div>

                                    {/* IP CAMERA SPECIFIC CONFIGURATION */}
                                    {formData.deviceType === 'IPCamera' ? (
                                        <div className="p-3 mb-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                            <h6 className="text-success font-weight-bold mb-3 d-flex align-items-center gap-2">
                                                <FiVideo /> RTSP Camera Stream Settings
                                            </h6>

                                            {/* Brand Presets */}
                                            <div className="mb-3">
                                                <label className="small font-weight-bold text-muted d-block mb-1">Quick Brand RTSP Preset:</label>
                                                <div className="d-flex flex-wrap gap-2">
                                                    {RTSP_BRAND_PRESETS.map(preset => (
                                                        <button 
                                                            key={preset.label} 
                                                            type="button" 
                                                            className={`btn btn-xs ${formData.brand.toLowerCase() === preset.label.toLowerCase() ? 'btn-success' : 'btn-outline-secondary'}`}
                                                            onClick={() => handleBrandPresetSelect(preset.label)}
                                                            style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                                                        >
                                                            {preset.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="row">
                                                <div className="col-md-4 form-group">
                                                    <label className="form-label font-weight-bold small">Camera IP Address *</label>
                                                    <input type="text" name="cameraIp" value={formData.cameraIp} onChange={handleChange} placeholder="192.168.1.100" className="form-control form-control-sm" />
                                                </div>
                                                <div className="col-md-2 form-group">
                                                    <label className="form-label font-weight-bold small">Port</label>
                                                    <input type="number" name="cameraPort" value={formData.cameraPort} onChange={handleChange} placeholder="554" className="form-control form-control-sm" />
                                                </div>
                                                <div className="col-md-3 form-group">
                                                    <label className="form-label font-weight-bold small">Camera Username</label>
                                                    <input type="text" name="cameraUsername" value={formData.cameraUsername} onChange={handleChange} placeholder="admin" className="form-control form-control-sm" />
                                                </div>
                                                <div className="col-md-3 form-group">
                                                    <label className="form-label font-weight-bold small">Camera Password</label>
                                                    <input type="password" name="cameraPassword" value={formData.cameraPassword} onChange={handleChange} placeholder="Camera password" className="form-control form-control-sm" />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label font-weight-bold small">Full RTSP / HTTP Stream URL *</label>
                                                <input type="text" name="streamUrl" value={formData.streamUrl} onChange={handleChange} placeholder="rtsp://admin:password@192.168.1.100:554/Streaming/Channels/102" className="form-control form-control-sm font-monospace" required />
                                            </div>

                                            <div className="row">
                                                <div className="col-md-4 form-group">
                                                    <label className="form-label font-weight-bold small">Punch Direction *</label>
                                                    <select name="direction" value={formData.direction} onChange={handleChange} className="form-control form-control-sm">
                                                        <option value="auto">Auto-Detect (Smart IN / OUT)</option>
                                                        <option value="in">Check-IN Only (Entrance Camera)</option>
                                                        <option value="out">Check-OUT Only (Exit Camera)</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-4 form-group">
                                                    <label className="form-label font-weight-bold small">Anti-Duplicate Cooldown</label>
                                                    <select name="cooldownMinutes" value={formData.cooldownMinutes} onChange={handleChange} className="form-control form-control-sm">
                                                        <option value="1">1 Minute</option>
                                                        <option value="3">3 Minutes</option>
                                                        <option value="5">5 Minutes (Recommended)</option>
                                                        <option value="10">10 Minutes</option>
                                                        <option value="15">15 Minutes</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-4 d-flex align-items-end form-group">
                                                    <button 
                                                        type="button" 
                                                        className="btn btn-sm btn-outline-success btn-block d-flex align-items-center justify-content-center gap-1"
                                                        onClick={handleTestStream}
                                                        disabled={testingStream || !formData.streamUrl}
                                                    >
                                                        {testingStream ? <div className="spinner-border spinner-border-sm" /> : <FiActivity />}
                                                        {testingStream ? 'Testing Stream...' : 'Test Connection'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Test Stream Preview Result */}
                                            {testStreamResult && (
                                                <div className={`alert ${testStreamResult.success ? 'alert-success' : 'alert-danger'} p-2 mb-0 mt-2`}>
                                                    {testStreamResult.success ? (
                                                        <div className="d-flex align-items-center gap-3">
                                                            {testStreamResult.frameBase64 && (
                                                                <img src={testStreamResult.frameBase64} alt="Snapshot Preview" style={{ width: '80px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                                                            )}
                                                            <div>
                                                                <strong className="d-block small"><FiCheckCircle className="mr-1" /> Stream Connected Successfully!</strong>
                                                                <small className="text-muted">Resolution: {testStreamResult.width}x{testStreamResult.height}px</small>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <small><FiAlertCircle className="mr-1" /> {testStreamResult.message || 'Stream test failed'}</small>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* KIOSK CREDENTIALS */
                                        <div className="p-3 mb-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                            <h6 className="text-primary font-weight-bold mb-3 d-flex align-items-center gap-2">
                                                <FiShield /> Kiosk Device Login Credentials
                                            </h6>
                                            <div className="row">
                                                <div className="col-md-6 form-group">
                                                    <label className="form-label font-weight-bold small">Login Email *</label>
                                                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="e.g. gate_kiosk@company.com" className="form-control form-control-sm" required disabled={editMode} />
                                                </div>
                                                {!editMode && (
                                                    <div className="col-md-6 form-group">
                                                        <label className="form-label font-weight-bold small">Login Password *</label>
                                                        <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Min 6 characters" className="form-control form-control-sm" required minLength="6" />
                                                    </div>
                                                )}
                                                <div className="col-md-12 form-group mb-0">
                                                    <label className="form-label font-weight-bold small">Hardware Serial / IMEI No.</label>
                                                    <input type="text" name="imeiNo" value={formData.imeiNo} onChange={handleChange} placeholder="Optional Tablet IMEI or Asset Tag" className="form-control form-control-sm" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="form-group form-check mt-3 mb-0">
                                        <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} className="form-check-input" id="isActiveCheck" />
                                        <label className="form-check-label font-weight-bold small" htmlFor="isActiveCheck">Device is Active & Enabled for Attendance</label>
                                    </div>
                                </div>

                                <div className="modal-footer bg-light">
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? 'Saving...' : editMode ? 'Save Changes' : 'Register Hardware'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
