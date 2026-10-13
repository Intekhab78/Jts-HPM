import { useState, useEffect, useRef } from 'react';
import { nvrAPI, deviceAPI, masterAPI } from '../../api';
import toast from 'react-hot-toast';
import {
    FiVideo,
    FiGrid,
    FiMaximize2,
    FiMinimize2,
    FiPlay,
    FiSquare,
    FiRadio,
    FiMic,
    FiMicOff,
    FiVolume2,
    FiBell,
    FiShield,
    FiAlertTriangle,
    FiCheckCircle,
    FiClock,
    FiRefreshCw,
    FiDownload,
    FiTrash2,
    FiSliders,
    FiEye,
    FiUserCheck,
    FiUserX,
    FiX,
    FiFilter,
    FiSearch,
    FiCamera,
    FiActivity,
    FiLayers,
    FiAlertOctagon,
    FiInfo
} from 'react-icons/fi';

const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');

// Browser audio playback helpers for instant operator feedback
const speakBrowserVoice = (text) => {
    try {
        if ('speechSynthesis' in window && text) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    } catch (e) {
        console.warn('Browser SpeechSynthesis error:', e);
    }
};

const playBrowserSiren = (durationSeconds = 3.5) => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.25, ctx.currentTime);

        const now = ctx.currentTime;
        const steps = Math.floor(durationSeconds / 0.3);
        for (let i = 0; i < steps; i++) {
            osc.frequency.setValueAtTime(1300, now + i * 0.3);
            osc.frequency.setValueAtTime(800, now + i * 0.3 + 0.15);
        }

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + durationSeconds);
    } catch (e) {
        console.warn('Browser Web Audio siren error:', e);
    }
};

export default function SecurityNVR() {
    // -------------------------------------------------------------
    // Core States
    // -------------------------------------------------------------
    const [channels, setChannels] = useState([]);
    const [summary, setSummary] = useState({
        totalCameras: 0,
        onlineCameras: 0,
        recordingCameras: 0,
        activeAlerts: 0,
        totalSurveillanceClips: 0
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [streamTicker, setStreamTicker] = useState(Date.now());

    // Matrix View Layout: 1 (1x1 focus), 2 (2x2 Quad), 3 (3x3 Matrix), 4 (4x4 Matrix)
    const [gridLayout, setGridLayout] = useState(2);
    const [focusedChannelId, setFocusedChannelId] = useState(null);

    // Filter by Zone or Location
    const [selectedLocation, setSelectedLocation] = useState('ALL');
    const [selectedRole, setSelectedRole] = useState('ALL');
    const [locations, setLocations] = useState([]);

    // Tabs: 'matrix' | 'alerts' | 'recordings' | 'roles'
    const [activeTab, setActiveTab] = useState('matrix');

    // Live clock ticker
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

    // -------------------------------------------------------------
    // Security Alerts State
    // -------------------------------------------------------------
    const [alerts, setAlerts] = useState([]);
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [alertSeverityFilter, setAlertSeverityFilter] = useState('ALL');
    const [alertStatusFilter, setAlertStatusFilter] = useState('ALL');
    const [alertSearch, setAlertSearch] = useState('');
    const [selectedAlertForResolve, setSelectedAlertForResolve] = useState(null);
    const [resolutionStatus, setResolutionStatus] = useState('Resolved');
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [resolving, setResolving] = useState(false);

    // -------------------------------------------------------------
    // Video Recordings Archive State
    // -------------------------------------------------------------
    const [recordings, setRecordings] = useState([]);
    const [recordingsLoading, setRecordingsLoading] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState(null);

    // -------------------------------------------------------------
    // Two-Way Audio / Intercom & Siren State
    // -------------------------------------------------------------
    const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
    const [targetBroadcastChannel, setTargetBroadcastChannel] = useState('ALL');
    const [broadcastMode, setBroadcastMode] = useState('tts'); // 'tts' | 'ptt' | 'siren'
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastCue, setBroadcastCue] = useState('warning');
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    // Push-To-Talk (PTT) Mic Recording
    const [isRecordingMic, setIsRecordingMic] = useState(false);
    const [micAudioBlob, setMicAudioBlob] = useState(null);
    const [micRecordingSeconds, setMicRecordingSeconds] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const micTimerRef = useRef(null);

    // -------------------------------------------------------------
    // Role Configuration Modal State
    // -------------------------------------------------------------
    const [roleModalChannel, setRoleModalChannel] = useState(null);
    const [roleForm, setRoleForm] = useState({
        cameraRole: 'FaceRecognition',
        enableTwoWayAudio: true,
        zoneGroup: 'Main Area',
        direction: 'auto',
        cooldownMinutes: 5,
        alertUnrecognizedFaces: true,
        alertAfterHours: false,
        afterHoursStart: '20:00',
        afterHoursEnd: '06:00',
        alertBlacklist: true,
        alertCameraOffline: true
    });
    const [savingRole, setSavingRole] = useState(false);

    // -------------------------------------------------------------
    // Initial Load & Background Polling
    // -------------------------------------------------------------
    useEffect(() => {
        loadChannels();
        loadLocations();
        loadAlerts();

        const clockInterval = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString());
        }, 1000);

        // Auto-refresh channel statuses every 5 seconds
        const pollInterval = setInterval(() => {
            fetchChannelsSilent();
        }, 5000);

        return () => {
            clearInterval(clockInterval);
            clearInterval(pollInterval);
        };
    }, []);

    const loadLocations = async () => {
        try {
            const res = await masterAPI.getLocations();
            if (res.data?.success) setLocations(res.data.data || []);
        } catch (e) {
            console.error('Error loading locations:', e);
        }
    };

    const loadChannels = async () => {
        try {
            setLoading(true);
            const res = await nvrAPI.getChannels();
            if (res.data?.success) {
                setChannels(res.data.data || []);
                if (res.data.summary) setSummary(res.data.summary);
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to load NVR camera channels');
        } finally {
            setLoading(false);
        }
    };

    const fetchChannelsSilent = async () => {
        try {
            const res = await nvrAPI.getChannels();
            if (res.data?.success) {
                setChannels(res.data.data || []);
                if (res.data.summary) setSummary(res.data.summary);
            }
        } catch (e) {
            // Ignore silent error
        }
    };

    const handleManualRefresh = async () => {
        setRefreshing(true);
        setStreamTicker(Date.now());
        await Promise.all([loadChannels(), loadAlerts(), loadRecordings()]);
        setRefreshing(false);
        toast.success('Surveillance streams refreshed');
    };

    // -------------------------------------------------------------
    // Security Alerts Loader
    // -------------------------------------------------------------
    const loadAlerts = async () => {
        try {
            setAlertsLoading(true);
            const res = await nvrAPI.getSecurityAlerts({
                severity: alertSeverityFilter !== 'ALL' ? alertSeverityFilter : undefined,
                status: alertStatusFilter !== 'ALL' ? alertStatusFilter : undefined,
                search: alertSearch || undefined,
                limit: 50
            });
            if (res.data?.success) {
                setAlerts(res.data.data || []);
            }
        } catch (e) {
            console.error('Error loading security alerts:', e);
        } finally {
            setAlertsLoading(false);
        }
    };

    const handleResolveAlert = async () => {
        if (!selectedAlertForResolve) return;
        try {
            setResolving(true);
            const res = await nvrAPI.resolveSecurityAlert(selectedAlertForResolve._id, {
                status: resolutionStatus,
                resolutionNotes
            });
            if (res.data?.success) {
                toast.success(`Alert marked as ${resolutionStatus}`);
                setSelectedAlertForResolve(null);
                setResolutionNotes('');
                loadAlerts();
                fetchChannelsSilent();
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to update alert');
        } finally {
            setResolving(false);
        }
    };

    // -------------------------------------------------------------
    // Video Recordings Loader
    // -------------------------------------------------------------
    const loadRecordings = async () => {
        try {
            setRecordingsLoading(true);
            const res = await deviceAPI.getRecordings({ limit: 40 });
            if (res.data?.success) {
                setRecordings(res.data.data || []);
            }
        } catch (e) {
            console.error('Error loading recordings:', e);
        } finally {
            setRecordingsLoading(false);
        }
    };

    // -------------------------------------------------------------
    // Quick Actions per Camera Channel
    // -------------------------------------------------------------
    const handleToggleStream = async (channel) => {
        try {
            toast.loading(channel.liveStatus?.isRunning ? 'Stopping stream...' : 'Connecting to camera stream...', { id: 'stream-toggle' });
            const res = await deviceAPI.toggleStream(channel._id);
            if (res.data?.success) {
                toast.success(res.data.message, { id: 'stream-toggle' });
                setStreamTicker(Date.now());
                fetchChannelsSilent();
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to toggle stream', { id: 'stream-toggle' });
        }
    };

    const handleToggleRecording = async (channel) => {
        const isRec = channel.liveStatus?.isRecording;
        try {
            if (isRec) {
                toast.loading('Finalizing video recording...', { id: 'rec-toggle' });
                const res = await deviceAPI.stopRecording(channel._id);
                if (res.data?.success) {
                    toast.success('Video clip finalized and saved to NVR archive', { id: 'rec-toggle' });
                    fetchChannelsSilent();
                    loadRecordings();
                }
            } else {
                toast.loading('Starting continuous recording...', { id: 'rec-toggle' });
                const res = await deviceAPI.startRecording(channel._id, { recordingType: 'Manual' });
                if (res.data?.success) {
                    toast.success('Surveillance recording active', { id: 'rec-toggle' });
                    fetchChannelsSilent();
                }
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to toggle recording', { id: 'rec-toggle' });
        }
    };

    const handleSwitchToWebcam = async (channel) => {
        try {
            toast.loading('Switching camera feed to Local Webcam...', { id: 'webcam-switch' });
            const res = await deviceAPI.useWebcam(channel._id);
            if (res.data?.success) {
                toast.success('Stream switched to Local Webcam (Index 0)', { id: 'webcam-switch' });
                setStreamTicker(Date.now());
                fetchChannelsSilent();
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to switch to webcam', { id: 'webcam-switch' });
        }
    };

    // -------------------------------------------------------------
    // Push-To-Talk Microphone Recording Logic
    // -------------------------------------------------------------
    const startMicRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                setMicAudioBlob(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start(100);
            setIsRecordingMic(true);
            setMicRecordingSeconds(0);
            micTimerRef.current = setInterval(() => {
                setMicRecordingSeconds(prev => prev + 1);
            }, 1000);
        } catch (err) {
            toast.error('Microphone access denied or unavailable: ' + err.message);
        }
    };

    const stopMicRecording = () => {
        if (mediaRecorderRef.current && isRecordingMic) {
            mediaRecorderRef.current.stop();
            setIsRecordingMic(false);
            if (micTimerRef.current) clearInterval(micTimerRef.current);
        }
    };

    // -------------------------------------------------------------
    // Broadcast Audio / Siren Dispatch
    // -------------------------------------------------------------
    const handleSendBroadcast = async () => {
        try {
            setIsBroadcasting(true);
            let audioBase64 = null;

            if (broadcastMode === 'ptt' && micAudioBlob) {
                audioBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(micAudioBlob);
                });
            }

            const targetDevices = targetBroadcastChannel === 'ALL'
                ? channels
                : channels.filter(c => c._id === targetBroadcastChannel);

            if (targetDevices.length === 0) {
                toast.error('No camera channels available for broadcast');
                setIsBroadcasting(false);
                return;
            }

            // Play in operator browser for immediate audio feedback
            if (broadcastMode === 'siren') {
                playBrowserSiren(3.5);
                if (broadcastMessage) speakBrowserVoice(broadcastMessage);
            } else if (broadcastMode === 'tts' && broadcastMessage) {
                speakBrowserVoice(broadcastMessage);
            } else if (broadcastMode === 'ptt' && micAudioBlob) {
                try {
                    const localAudio = new Audio(URL.createObjectURL(micAudioBlob));
                    localAudio.play();
                } catch (e) {}
            }

            for (const dev of targetDevices) {
                await nvrAPI.broadcastAudio(dev._id, {
                    message: broadcastMessage,
                    cue: broadcastMode === 'siren' ? 'siren' : broadcastCue,
                    audioBase64
                });
            }

            toast.success(`Broadcast dispatched to ${targetDevices.length} camera channel(s)`);
            setBroadcastModalOpen(false);
            setBroadcastMessage('');
            setMicAudioBlob(null);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to dispatch audio broadcast');
        } finally {
            setIsBroadcasting(false);
        }
    };

    const handleInstantSirenAlarm = async (channelId) => {
        try {
            toast.loading('Activating security siren alert...', { id: 'siren' });
            // Immediate operator browser feedback
            playBrowserSiren(3.5);

            const targetDevices = channelId ? channels.filter(c => c._id === channelId) : channels;
            for (const dev of targetDevices) {
                await nvrAPI.broadcastAudio(dev._id, { cue: 'siren', message: 'Security Siren Alert Activated' });
            }
            toast.success('Emergency siren activated on camera speakers', { id: 'siren' });
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to activate siren', { id: 'siren' });
        }
    };

    // -------------------------------------------------------------
    // Camera Role & Security Rules Configuration
    // -------------------------------------------------------------
    const openRoleConfigModal = (channel) => {
        setRoleModalChannel(channel);
        setRoleForm({
            cameraRole: channel.cameraRole || 'FaceRecognition',
            enableTwoWayAudio: channel.enableTwoWayAudio !== false,
            zoneGroup: channel.zoneGroup || 'Main Area',
            direction: channel.direction || 'auto',
            cooldownMinutes: channel.cooldownMinutes || 5,
            alertUnrecognizedFaces: channel.securityMonitoring?.alertUnrecognizedFaces !== false,
            alertAfterHours: channel.securityMonitoring?.alertAfterHours || false,
            afterHoursStart: channel.securityMonitoring?.afterHoursStart || '20:00',
            afterHoursEnd: channel.securityMonitoring?.afterHoursEnd || '06:00',
            alertBlacklist: channel.securityMonitoring?.alertBlacklist !== false,
            alertCameraOffline: channel.securityMonitoring?.alertCameraOffline !== false
        });
    };

    const handleSaveRoleConfig = async () => {
        if (!roleModalChannel) return;
        try {
            setSavingRole(true);
            const res = await nvrAPI.updateChannelRole(roleModalChannel._id, {
                cameraRole: roleForm.cameraRole,
                enableTwoWayAudio: roleForm.enableTwoWayAudio,
                zoneGroup: roleForm.zoneGroup,
                direction: roleForm.direction,
                cooldownMinutes: roleForm.cooldownMinutes,
                securityMonitoring: {
                    alertUnrecognizedFaces: roleForm.alertUnrecognizedFaces,
                    alertAfterHours: roleForm.alertAfterHours,
                    afterHoursStart: roleForm.afterHoursStart,
                    afterHoursEnd: roleForm.afterHoursEnd,
                    alertBlacklist: roleForm.alertBlacklist,
                    alertCameraOffline: roleForm.alertCameraOffline
                }
            });
            if (res.data?.success) {
                toast.success('Camera security rules & operational role updated');
                setRoleModalChannel(null);
                fetchChannelsSilent();
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to update camera rules');
        } finally {
            setSavingRole(false);
        }
    };

    // -------------------------------------------------------------
    // Filtered Channels for Matrix Grid
    // -------------------------------------------------------------
    const filteredChannels = channels.filter(c => {
        if (selectedLocation !== 'ALL') {
            const locId = c.location?._id || c.location;
            if (locId !== selectedLocation) return false;
        }
        if (selectedRole !== 'ALL' && (c.cameraRole || 'FaceRecognition') !== selectedRole) {
            return false;
        }
        return true;
    });

    const displayChannels = focusedChannelId
        ? filteredChannels.filter(c => c._id === focusedChannelId)
        : filteredChannels;

    return (
        <div className="nvr-surveillance-container" style={{ minHeight: '100vh', background: '#0a0f1d', color: '#e2e8f0', padding: '1.25rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
            
            {/* Top Navigation & Status Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', background: 'rgba(15, 23, 42, 0.75)', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(12px)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'linear-gradient(135deg, #0284c7, #3b82f6)', padding: '0.6rem', borderRadius: '10px', color: '#fff', display: 'flex' }}>
                            <FiVideo size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                Security NVR & CCTV Station
                                <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.2rem 0.5rem', borderRadius: '20px', fontWeight: '600' }}>
                                    ● AI MONITORING ACTIVE
                                </span>
                            </h1>
                            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                                Multi-Channel IP Surveillance, Biometric Recognition & Security Alert Matrix
                            </p>
                        </div>
                    </div>
                </div>

                {/* KPI Status Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.45rem 0.8rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Total Channels</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#38bdf8' }}>{summary.totalCameras}</div>
                    </div>

                    <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.45rem 0.8rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Online Feeds</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#10b981' }}>{summary.onlineCameras}</div>
                    </div>

                    <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.45rem 0.8rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Recording</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: summary.recordingCameras > 0 ? '#f43f5e' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                            {summary.recordingCameras > 0 && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e', animation: 'pulse 1.5s infinite' }}></span>}
                            {summary.recordingCameras}
                        </div>
                    </div>

                    <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.45rem 0.8rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Active Alerts</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: summary.activeAlerts > 0 ? '#fbbf24' : '#10b981' }}>{summary.activeAlerts}</div>
                    </div>

                    <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.45rem 0.8rem', textAlign: 'center', color: '#cbd5e1', fontWeight: '600', fontSize: '0.85rem' }}>
                        <FiClock style={{ marginRight: '0.3rem', color: '#38bdf8' }} />
                        {currentTime}
                    </div>
                </div>

                {/* Primary Station Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setBroadcastModalOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#0284c7', color: '#fff', border: 'none', padding: '0.55rem 0.9rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        <FiRadio size={16} /> Intercom & Broadcast
                    </button>

                    <button
                        onClick={() => handleInstantSirenAlarm(null)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#e11d48', color: '#fff', border: 'none', padding: '0.55rem 0.9rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        <FiBell size={16} /> Siren Alarm
                    </button>

                    <button
                        onClick={handleManualRefresh}
                        disabled={refreshing}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.12)', padding: '0.55rem 0.8rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}
                    >
                        <FiRefreshCw className={refreshing ? 'spin-icon' : ''} size={15} />
                    </button>
                </div>
            </div>

            {/* View Tabs & Matrix Layout Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                        onClick={() => setActiveTab('matrix')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.84rem', background: activeTab === 'matrix' ? '#0ea5e9' : 'rgba(30, 41, 59, 0.6)', color: activeTab === 'matrix' ? '#fff' : '#94a3b8' }}
                    >
                        <FiGrid /> Live Matrix Wall
                    </button>

                    <button
                        onClick={() => { setActiveTab('alerts'); loadAlerts(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.84rem', background: activeTab === 'alerts' ? '#0ea5e9' : 'rgba(30, 41, 59, 0.6)', color: activeTab === 'alerts' ? '#fff' : '#94a3b8' }}
                    >
                        <FiAlertTriangle /> Security Alerts Feed {summary.activeAlerts > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>{summary.activeAlerts}</span>}
                    </button>

                    <button
                        onClick={() => { setActiveTab('recordings'); loadRecordings(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.84rem', background: activeTab === 'recordings' ? '#0ea5e9' : 'rgba(30, 41, 59, 0.6)', color: activeTab === 'recordings' ? '#fff' : '#94a3b8' }}
                    >
                        <FiPlay /> Surveillance Archive
                    </button>

                    <button
                        onClick={() => setActiveTab('roles')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.84rem', background: activeTab === 'roles' ? '#0ea5e9' : 'rgba(30, 41, 59, 0.6)', color: activeTab === 'roles' ? '#fff' : '#94a3b8' }}
                    >
                        <FiSliders /> Camera Roles & Rules
                    </button>
                </div>

                {/* Matrix Controls & Filters (Only visible on Matrix Tab) */}
                {activeTab === 'matrix' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        {/* Location Filter */}
                        <select
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                            style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
                        >
                            <option value="ALL">All Branch Locations</option>
                            {locations.map(loc => (
                                <option key={loc._id} value={loc._id}>{loc.name}</option>
                            ))}
                        </select>

                        {/* Role Filter */}
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
                        >
                            <option value="ALL">All Camera Roles</option>
                            <option value="FaceRecognition">Face Recognition</option>
                            <option value="SecuritySurveillance">Security Surveillance</option>
                            <option value="Hybrid">Hybrid (Attendance + CCTV)</option>
                            <option value="RestrictedArea">Restricted Area (High Alert)</option>
                        </select>

                        {/* Layout Selector: 1x1, 2x2, 3x3, 4x4 */}
                        <div style={{ display: 'flex', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.15rem' }}>
                            {[
                                { layout: 1, label: '1x1' },
                                { layout: 2, label: '2x2' },
                                { layout: 3, label: '3x3' },
                                { layout: 4, label: '4x4' }
                            ].map(item => (
                                <button
                                    key={item.layout}
                                    onClick={() => { setGridLayout(item.layout); setFocusedChannelId(null); }}
                                    style={{
                                        background: gridLayout === item.layout && !focusedChannelId ? '#0284c7' : 'transparent',
                                        color: gridLayout === item.layout && !focusedChannelId ? '#fff' : '#94a3b8',
                                        border: 'none',
                                        padding: '0.35rem 0.6rem',
                                        borderRadius: '6px',
                                        fontSize: '0.76rem',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {focusedChannelId && (
                            <button
                                onClick={() => setFocusedChannelId(null)}
                                style={{ background: '#475569', color: '#fff', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                                <FiMinimize2 /> Exit Focus
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* TAB 1: LIVE MULTI-GRID MATRIX WALL */}
            {activeTab === 'matrix' && (
                <div>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '5rem 0', color: '#94a3b8' }}>
                            <FiRefreshCw className="spin-icon" size={32} style={{ color: '#0ea5e9', marginBottom: '1rem' }} />
                            <p style={{ margin: 0, fontWeight: '500' }}>Initializing CCTV Video Matrix...</p>
                        </div>
                    ) : displayChannels.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            <FiVideo size={42} style={{ color: '#475569', marginBottom: '1rem' }} />
                            <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>No Camera Channels Registered</h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                                Register your RTSP or HTTP CCTV cameras in Kiosk & Device Setup to stream them live on this NVR wall.
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: focusedChannelId
                                ? '1fr'
                                : `repeat(${gridLayout}, minmax(0, 1fr))`,
                            gap: '1rem'
                        }}>
                            {displayChannels.map((channel) => {
                                const isOnline = channel.liveStatus?.isRunning;
                                const isRec = channel.liveStatus?.isRecording;
                                const role = channel.cameraRole || 'FaceRecognition';

                                let roleBadgeBg = 'rgba(59, 130, 246, 0.2)';
                                let roleBadgeColor = '#60a5fa';
                                let roleBadgeBorder = 'rgba(59, 130, 246, 0.4)';

                                if (role === 'FaceRecognition') {
                                    roleBadgeBg = 'rgba(16, 185, 129, 0.2)';
                                    roleBadgeColor = '#34d399';
                                    roleBadgeBorder = 'rgba(16, 185, 129, 0.4)';
                                } else if (role === 'RestrictedArea') {
                                    roleBadgeBg = 'rgba(239, 68, 68, 0.25)';
                                    roleBadgeColor = '#f87171';
                                    roleBadgeBorder = 'rgba(239, 68, 68, 0.5)';
                                } else if (role === 'Hybrid') {
                                    roleBadgeBg = 'rgba(168, 85, 247, 0.2)';
                                    roleBadgeColor = '#c084fc';
                                    roleBadgeBorder = 'rgba(168, 85, 247, 0.4)';
                                }

                                return (
                                    <div
                                        key={channel._id}
                                        style={{
                                            background: '#0f172a',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            border: isRec
                                                ? '2px solid rgba(244, 63, 94, 0.8)'
                                                : channel.activeAlertsCount > 0
                                                    ? '2px solid rgba(251, 191, 36, 0.8)'
                                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                            boxShadow: isRec ? '0 0 15px rgba(244, 63, 94, 0.3)' : '0 4px 12px rgba(0,0,0,0.5)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            position: 'relative'
                                        }}
                                    >
                                        {/* Camera Tile Top Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'rgba(30, 41, 59, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                                <span style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: isOnline ? '#10b981' : '#ef4444',
                                                    display: 'inline-block'
                                                }} />
                                                <span style={{ fontWeight: '600', fontSize: '0.85rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {channel.description || `${channel.brand} ${channel.model}`}
                                                </span>
                                                <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: '12px', background: roleBadgeBg, color: roleBadgeColor, border: `1px solid ${roleBadgeBorder}`, fontWeight: '600' }}>
                                                    {role === 'FaceRecognition' ? 'Face Attendance' : role === 'RestrictedArea' ? 'Restricted Zone' : role === 'SecuritySurveillance' ? 'Surveillance CCTV' : 'Hybrid AI'}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                {isRec && (
                                                    <span style={{ fontSize: '0.68rem', background: '#e11d48', color: '#fff', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.2rem', animation: 'pulse 1.5s infinite' }}>
                                                        ● REC {channel.liveStatus?.recordingElapsedSecs ? `${channel.liveStatus.recordingElapsedSecs}s` : ''}
                                                    </span>
                                                )}

                                                {channel.activeAlertsCount > 0 && (
                                                    <span style={{ fontSize: '0.68rem', background: '#d97706', color: '#fff', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: '700' }}>
                                                        {channel.activeAlertsCount} ALERT{channel.activeAlertsCount > 1 ? 'S' : ''}
                                                    </span>
                                                )}

                                                <button
                                                    onClick={() => openRoleConfigModal(channel)}
                                                    title="Configure Camera Role & Rules"
                                                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
                                                >
                                                    <FiSliders size={14} />
                                                </button>

                                                <button
                                                    onClick={() => setFocusedChannelId(focusedChannelId === channel._id ? null : channel._id)}
                                                    title={focusedChannelId === channel._id ? 'Restore Grid' : 'Maximize to 1x1'}
                                                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
                                                >
                                                    {focusedChannelId === channel._id ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Video Stream Screen */}
                                        <div style={{ position: 'relative', width: '100%', paddingTop: focusedChannelId ? '56.25%' : '60%', background: '#000', overflow: 'hidden' }}>
                                            {isOnline ? (
                                                <img
                                                    key={`${channel._id}-${streamTicker}`}
                                                    src={`${API_ROOT}/api/devices/${channel._id}/live-stream?t=${streamTicker}`}
                                                    alt={channel.description || 'Live Feed'}
                                                    onError={(e) => {
                                                        const target = e.currentTarget;
                                                        if (!target.dataset.fallbackTried) {
                                                            target.dataset.fallbackTried = 'true';
                                                            target.src = `${API_ROOT}/api/devices/${channel._id}/snapshot?t=${Date.now()}`;
                                                        }
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover'
                                                    }}
                                                />
                                            ) : (
                                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                    <FiVideo size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                                    <span style={{ fontSize: '0.82rem', fontWeight: '500' }}>Camera Stream Inactive</span>
                                                    <button
                                                        onClick={() => handleToggleStream(channel)}
                                                        style={{ marginTop: '0.75rem', background: '#0284c7', color: '#fff', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                                                    >
                                                        Start Stream Feed
                                                    </button>
                                                </div>
                                            )}

                                            {/* On-Screen Display (OSD) Overlay Badges */}
                                            {isOnline && (
                                                <div style={{ position: 'absolute', bottom: '8px', left: '8px', right: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
                                                    <div style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', color: '#e2e8f0', display: 'flex', gap: '0.5rem' }}>
                                                        <span><strong>Zone:</strong> {channel.zoneGroup || 'Main'}</span>
                                                        <span><strong>Dir:</strong> {(channel.direction || 'auto').toUpperCase()}</span>
                                                        {channel.liveStatus?.width > 0 && (
                                                            <span><strong>Res:</strong> {channel.liveStatus.width}x{channel.liveStatus.height}</span>
                                                        )}
                                                    </div>

                                                    <div style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', color: '#38bdf8', display: 'flex', gap: '0.4rem' }}>
                                                        <span><strong>Punches:</strong> {channel.liveStatus?.totalPunches || 0}</span>
                                                        <span><strong>Visitors:</strong> {channel.liveStatus?.visitorCount || 0}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Bottom Action Toolstrip */}
                                        <div style={{ padding: '0.5rem 0.8rem', background: 'rgba(15, 23, 42, 0.95)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                {/* Toggle Stream */}
                                                <button
                                                    onClick={() => handleToggleStream(channel)}
                                                    title={isOnline ? 'Stop Stream Worker' : 'Start Stream Worker'}
                                                    style={{
                                                        background: isOnline ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                        color: isOnline ? '#f87171' : '#34d399',
                                                        border: isOnline ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                                                        padding: '0.35rem 0.6rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem'
                                                    }}
                                                >
                                                    {isOnline ? <><FiSquare size={12} /> Stop</> : <><FiPlay size={12} /> Start</>}
                                                </button>

                                                {/* Toggle Recording */}
                                                {isOnline && (
                                                    <button
                                                        onClick={() => handleToggleRecording(channel)}
                                                        title={isRec ? 'Stop & Save Recording' : 'Start Continuous Surveillance Recording'}
                                                        style={{
                                                            background: isRec ? '#e11d48' : 'rgba(244, 63, 94, 0.15)',
                                                            color: isRec ? '#fff' : '#fb7185',
                                                            border: '1px solid rgba(244, 63, 94, 0.4)',
                                                            padding: '0.35rem 0.6rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.25rem'
                                                        }}
                                                    >
                                                        <FiVideo size={12} /> {isRec ? 'Stop Rec' : 'Record'}
                                                    </button>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                {/* Intercom to single camera */}
                                                {isOnline && (
                                                    <button
                                                        onClick={() => { setTargetBroadcastChannel(channel._id); setBroadcastModalOpen(true); }}
                                                        title="Broadcast voice announcement to this camera"
                                                        style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '0.35rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                                    >
                                                        <FiMic size={12} /> Speak
                                                    </button>
                                                )}

                                                {/* Siren for single camera */}
                                                {isOnline && (
                                                    <button
                                                        onClick={() => handleInstantSirenAlarm(channel._id)}
                                                        title="Trigger local siren alarm"
                                                        style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.35rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                                    >
                                                        <FiBell size={12} /> Alarm
                                                    </button>
                                                )}

                                                {/* Local Webcam Switch */}
                                                <button
                                                    onClick={() => handleSwitchToWebcam(channel)}
                                                    title="Switch to Laptop / PC Webcam (Index 0)"
                                                    style={{ background: 'rgba(255, 255, 255, 0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '0.35rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer' }}
                                                >
                                                    <FiCamera size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: LIVE SECURITY THREAT & ALERTS FEED */}
            {activeTab === 'alerts' && (
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem' }}>
                    {/* Alerts Filter Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                                Security Incidents & Threat Activity
                            </h2>
                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                                Stranger intrusions, after-hours breaches, and high-risk surveillance events
                            </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative' }}>
                                <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    type="text"
                                    placeholder="Search alerts..."
                                    value={alertSearch}
                                    onChange={(e) => setAlertSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && loadAlerts()}
                                    style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem 0.45rem 2rem', fontSize: '0.8rem', outline: 'none' }}
                                />
                            </div>

                            <select
                                value={alertSeverityFilter}
                                onChange={(e) => { setAlertSeverityFilter(e.target.value); }}
                                style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
                            >
                                <option value="ALL">All Severities</option>
                                <option value="Critical">Critical</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>

                            <select
                                value={alertStatusFilter}
                                onChange={(e) => { setAlertStatusFilter(e.target.value); }}
                                style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.8rem', outline: 'none' }}
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="Active">Active (Unresolved)</option>
                                <option value="Acknowledged">Acknowledged</option>
                                <option value="Escalated">Escalated</option>
                                <option value="Resolved">Resolved</option>
                                <option value="FalseAlarm">False Alarm</option>
                            </select>

                            <button
                                onClick={loadAlerts}
                                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                            >
                                Filter
                            </button>
                        </div>
                    </div>

                    {/* Alerts Table */}
                    {alertsLoading ? (
                        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
                            <FiRefreshCw className="spin-icon" size={28} style={{ color: '#0ea5e9', marginBottom: '0.5rem' }} />
                            <p>Loading security incidents...</p>
                        </div>
                    ) : alerts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#64748b' }}>
                            <FiCheckCircle size={40} style={{ color: '#10b981', marginBottom: '0.75rem' }} />
                            <h4 style={{ color: '#f8fafc', margin: '0 0 0.25rem 0' }}>All Clear — No Active Security Alerts</h4>
                            <p style={{ fontSize: '0.85rem' }}>Your camera surveillance zones are currently secure.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                                        <th style={{ padding: '0.75rem 0.5rem' }}>Snapshot</th>
                                        <th style={{ padding: '0.75rem 0.5rem' }}>Event & Title</th>
                                        <th style={{ padding: '0.75rem 0.5rem' }}>Camera / Zone</th>
                                        <th style={{ padding: '0.75rem 0.5rem' }}>Severity</th>
                                        <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                                        <th style={{ padding: '0.75rem 0.5rem' }}>Time</th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alerts.map((al) => {
                                        const sevColors = {
                                            Critical: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', border: 'rgba(239, 68, 68, 0.4)' },
                                            High: { bg: 'rgba(249, 115, 22, 0.2)', text: '#fb923c', border: 'rgba(249, 115, 22, 0.4)' },
                                            Medium: { bg: 'rgba(234, 179, 8, 0.2)', text: '#facc15', border: 'rgba(234, 179, 8, 0.4)' },
                                            Low: { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.4)' }
                                        };
                                        const sev = sevColors[al.severity] || sevColors.Medium;

                                        return (
                                            <tr key={al._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                                                {/* Snapshot */}
                                                <td style={{ padding: '0.6rem 0.5rem' }}>
                                                    {al.snapshotPath ? (
                                                        <img
                                                            src={`${API_ROOT}${al.snapshotPath}`}
                                                            alt="Alert Snapshot"
                                                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}
                                                        />
                                                    ) : (
                                                        <div style={{ width: '48px', height: '48px', background: '#1e293b', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                            <FiCamera size={18} />
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Event & Title */}
                                                <td style={{ padding: '0.6rem 0.5rem' }}>
                                                    <div style={{ fontWeight: '600', color: '#f8fafc' }}>{al.title}</div>
                                                    <div style={{ color: '#94a3b8', fontSize: '0.74rem' }}>{al.description}</div>
                                                </td>

                                                {/* Camera / Zone */}
                                                <td style={{ padding: '0.6rem 0.5rem' }}>
                                                    <div style={{ color: '#cbd5e1' }}>{al.cameraName}</div>
                                                    <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Zone: {al.zoneGroup} | {al.locationName}</div>
                                                </td>

                                                {/* Severity */}
                                                <td style={{ padding: '0.6rem 0.5rem' }}>
                                                    <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: sev.bg, color: sev.text, border: `1px solid ${sev.border}`, fontWeight: '600' }}>
                                                        {al.severity}
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td style={{ padding: '0.6rem 0.5rem' }}>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '12px',
                                                        background: al.status === 'Active' ? 'rgba(239, 68, 68, 0.2)' : al.status === 'Resolved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                                                        color: al.status === 'Active' ? '#f87171' : al.status === 'Resolved' ? '#34d399' : '#cbd5e1',
                                                        fontWeight: '600'
                                                    }}>
                                                        {al.status}
                                                    </span>
                                                </td>

                                                {/* Time */}
                                                <td style={{ padding: '0.6rem 0.5rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                                    {new Date(al.timestamp).toLocaleString()}
                                                </td>

                                                {/* Actions */}
                                                <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                                                    <button
                                                        onClick={() => { setSelectedAlertForResolve(al); setResolutionStatus(al.status === 'Active' ? 'Resolved' : al.status); setResolutionNotes(al.resolutionNotes || ''); }}
                                                        style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '600', cursor: 'pointer' }}
                                                    >
                                                        Review & Resolve
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: VIDEO ARCHIVE & TIMELINE PLAYBACK */}
            {activeTab === 'recordings' && (
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                                NVR Surveillance Video Archive
                            </h2>
                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                                Continuous recordings and scheduled security clips with native in-browser HTML5 playback
                            </p>
                        </div>

                        <button
                            onClick={loadRecordings}
                            style={{ background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.12)', padding: '0.45rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                            <FiRefreshCw /> Refresh Archive
                        </button>
                    </div>

                    {recordingsLoading ? (
                        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
                            <FiRefreshCw className="spin-icon" size={28} style={{ color: '#0ea5e9', marginBottom: '0.5rem' }} />
                            <p>Loading video archive...</p>
                        </div>
                    ) : recordings.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#64748b' }}>
                            <FiVideo size={40} style={{ color: '#475569', marginBottom: '0.75rem' }} />
                            <h4 style={{ color: '#f8fafc', margin: '0 0 0.25rem 0' }}>No Video Recordings Found</h4>
                            <p style={{ fontSize: '0.85rem' }}>Trigger a manual recording from the live matrix wall or enable a recording schedule.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                            {recordings.map((rec) => (
                                <div
                                    key={rec._id}
                                    style={{
                                        background: '#0f172a',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    {/* Thumbnail with Play Hover */}
                                    <div
                                        onClick={() => setSelectedVideo(rec)}
                                        style={{ position: 'relative', width: '100%', height: '150px', background: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        {rec.thumbnailPath ? (
                                            <img
                                                src={`${API_ROOT}${rec.thumbnailPath}`}
                                                alt="Video Thumbnail"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div style={{ color: '#475569' }}><FiVideo size={36} /></div>
                                        )}

                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(2, 132, 199, 0.85)', color: '#fff', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(0,0,0,0.5)' }}>
                                            <FiPlay size={20} style={{ marginLeft: '3px' }} />
                                        </div>

                                        <span style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.68rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: '600' }}>
                                            {rec.durationSeconds ? `${rec.durationSeconds}s` : 'Recording'}
                                        </span>

                                        <span style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(15, 23, 42, 0.8)', color: '#38bdf8', fontSize: '0.68rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: '600', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            {rec.recordingType || 'Manual'}
                                        </span>
                                    </div>

                                    {/* Recording Info */}
                                    <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#f8fafc', marginBottom: '0.2rem' }}>
                                                {rec.device?.description || 'Surveillance Channel'}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                {new Date(rec.startTime).toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>
                                                Size: {(rec.fileSize / (1024 * 1024)).toFixed(2)} MB
                                            </div>
                                        </div>

                                        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <button
                                                onClick={() => setSelectedVideo(rec)}
                                                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.35rem 0.7rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                            >
                                                <FiPlay size={12} /> Play in Browser
                                            </button>

                                            <a
                                                href={`${API_ROOT}${rec.filePath}`}
                                                download
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ color: '#94a3b8', padding: '0.35rem', cursor: 'pointer' }}
                                                title="Download video file"
                                            >
                                                <FiDownload size={15} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: CAMERA ROLES & RULES MATRIX */}
            {activeTab === 'roles' && (
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                            Camera Roles & Security Surveillance Matrix
                        </h2>
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                            Mark cameras for Face Recognition Attendance, Security Surveillance, After-Hours Patrol, or High-Alert Restricted Areas
                        </p>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                                    <th style={{ padding: '0.75rem 0.5rem' }}>Camera Channel</th>
                                    <th style={{ padding: '0.75rem 0.5rem' }}>Assigned Role</th>
                                    <th style={{ padding: '0.75rem 0.5rem' }}>Zone & Direction</th>
                                    <th style={{ padding: '0.75rem 0.5rem' }}>Stranger Intrusion Alert</th>
                                    <th style={{ padding: '0.75rem 0.5rem' }}>After-Hours Patrol</th>
                                    <th style={{ padding: '0.75rem 0.5rem' }}>2-Way Voice Intercom</th>
                                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Configure</th>
                                </tr>
                            </thead>
                            <tbody>
                                {channels.map((channel) => {
                                    const role = channel.cameraRole || 'FaceRecognition';
                                    return (
                                        <tr key={channel._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ padding: '0.75rem 0.5rem' }}>
                                                <div style={{ fontWeight: '600', color: '#f8fafc' }}>{channel.description}</div>
                                                <div style={{ color: '#64748b', fontSize: '0.72rem' }}>{channel.brand} {channel.model} | {channel.location?.name || 'Main Office'}</div>
                                            </td>

                                            <td style={{ padding: '0.75rem 0.5rem' }}>
                                                <span style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem', borderRadius: '12px', background: role === 'RestrictedArea' ? 'rgba(239, 68, 68, 0.2)' : role === 'FaceRecognition' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: role === 'RestrictedArea' ? '#f87171' : role === 'FaceRecognition' ? '#34d399' : '#60a5fa', fontWeight: '600' }}>
                                                    {role === 'FaceRecognition' ? 'Face Attendance' : role === 'RestrictedArea' ? 'Restricted Area' : role === 'SecuritySurveillance' ? 'Security Surveillance' : 'Hybrid AI'}
                                                </span>
                                            </td>

                                            <td style={{ padding: '0.75rem 0.5rem', color: '#cbd5e1' }}>
                                                Zone: {channel.zoneGroup || 'Main Area'} ({(channel.direction || 'auto').toUpperCase()})
                                            </td>

                                            <td style={{ padding: '0.75rem 0.5rem' }}>
                                                {channel.securityMonitoring?.alertUnrecognizedFaces !== false ? (
                                                    <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><FiCheckCircle /> Enabled</span>
                                                ) : (
                                                    <span style={{ color: '#64748b' }}>Disabled</span>
                                                )}
                                            </td>

                                            <td style={{ padding: '0.75rem 0.5rem' }}>
                                                {channel.securityMonitoring?.alertAfterHours ? (
                                                    <span style={{ color: '#38bdf8' }}>Active ({channel.securityMonitoring.afterHoursStart} - {channel.securityMonitoring.afterHoursEnd})</span>
                                                ) : (
                                                    <span style={{ color: '#64748b' }}>Disabled</span>
                                                )}
                                            </td>

                                            <td style={{ padding: '0.75rem 0.5rem' }}>
                                                {channel.enableTwoWayAudio !== false ? (
                                                    <span style={{ color: '#34d399' }}>Ready</span>
                                                ) : (
                                                    <span style={{ color: '#64748b' }}>Muted</span>
                                                )}
                                            </td>

                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => openRoleConfigModal(channel)}
                                                    style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                                                >
                                                    Edit Rules
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL 1: TWO-WAY AUDIO INTERCOM & VOICE BROADCAST */}
            {broadcastModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', maxWidth: '540px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ background: '#0284c7', padding: '0.5rem', borderRadius: '8px', color: '#fff' }}>
                                    <FiRadio size={18} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Two-Way Audio & Camera Intercom</h3>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Broadcast voice announcements or siren warnings directly through camera speakers</p>
                                </div>
                            </div>
                            <button onClick={() => setBroadcastModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><FiX size={20} /></button>
                        </div>

                        {/* Target Channel Selector */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600', marginBottom: '0.35rem' }}>
                                Broadcast Destination:
                            </label>
                            <select
                                value={targetBroadcastChannel}
                                onChange={(e) => setTargetBroadcastChannel(e.target.value)}
                                style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.55rem', fontSize: '0.85rem', outline: 'none' }}
                            >
                                <option value="ALL">📢 All Online Cameras (System-Wide PA Broadcast)</option>
                                {channels.map(c => (
                                    <option key={c._id} value={c._id}>
                                        🎥 {c.description} ({c.zoneGroup} - {c.liveStatus?.isRunning ? 'ONLINE' : 'OFFLINE'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Mode Selector: TTS Text vs PTT Mic vs Siren */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                            {[
                                { id: 'tts', label: 'AI Voice (TTS)', icon: FiVolume2 },
                                { id: 'ptt', label: 'Push-To-Talk (Mic)', icon: FiMic },
                                { id: 'siren', label: 'Siren Alarm', icon: FiBell }
                            ].map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setBroadcastMode(m.id)}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.4rem',
                                        padding: '0.55rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '0.8rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        background: broadcastMode === m.id ? '#0284c7' : 'rgba(30, 41, 59, 0.7)',
                                        color: broadcastMode === m.id ? '#fff' : '#94a3b8'
                                    }}
                                >
                                    <m.icon /> {m.label}
                                </button>
                            ))}
                        </div>

                        {/* MODE 1: Text-To-Speech Intercom */}
                        {broadcastMode === 'tts' && (
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600', marginBottom: '0.35rem' }}>
                                    Voice Announcement Message:
                                </label>
                                <textarea
                                    rows={3}
                                    value={broadcastMessage}
                                    onChange={(e) => setBroadcastMessage(e.target.value)}
                                    placeholder="Enter verbal warning or announcement to speak through camera..."
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.6rem', color: '#fff', fontSize: '0.85rem', outline: 'none', marginBottom: '0.75rem', boxSizing: 'border-box' }}
                                />

                                {/* Quick Preset Buttons */}
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '600', marginBottom: '0.35rem' }}>Quick Warning Presets:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                        {[
                                            { text: 'Attention! This is a restricted area. Please vacate immediately.', label: 'Restricted Warning', cue: 'restricted' },
                                            { text: 'Security alert in progress. Please remain where you are.', label: 'Security Alert', cue: 'warning' },
                                            { text: 'Welcome to facility. Please proceed to visitor reception for check in.', label: 'Visitor Guide', cue: 'welcome' }
                                        ].map((p, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => { setBroadcastMessage(p.text); setBroadcastCue(p.cue); }}
                                                style={{ background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer' }}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MODE 2: Push-To-Talk Microphone */}
                        {broadcastMode === 'ptt' && (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    {isRecordingMic ? (
                                        <button
                                            onClick={stopMicRecording}
                                            style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e11d48', color: '#fff', border: 'none', fontSize: '1.5rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 25px rgba(225, 29, 72, 0.6)', animation: 'pulse 1s infinite' }}
                                        >
                                            <FiMicOff />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={startMicRecording}
                                            style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#0284c7', color: '#fff', border: 'none', fontSize: '1.5rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(2, 132, 199, 0.4)' }}
                                        >
                                            <FiMic />
                                        </button>
                                    )}
                                </div>

                                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: isRecordingMic ? '#f43f5e' : '#f8fafc' }}>
                                    {isRecordingMic ? `🔴 Recording Live Audio (${micRecordingSeconds}s) — Click to Stop` : micAudioBlob ? '✅ Live Voice Sample Ready for Transmission' : 'Click Microphone to Record Voice Broadcast'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                    Streams your microphone audio directly to the camera loudspeaker
                                </div>
                            </div>
                        )}

                        {/* MODE 3: Siren Alert */}
                        {broadcastMode === 'siren' && (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0', background: 'rgba(225, 29, 72, 0.1)', borderRadius: '10px', border: '1px solid rgba(225, 29, 72, 0.3)', marginBottom: '1rem' }}>
                                <FiAlertOctagon size={44} style={{ color: '#f43f5e', marginBottom: '0.5rem' }} />
                                <h4 style={{ color: '#f8fafc', margin: '0 0 0.25rem 0' }}>Security Emergency Siren Alarm</h4>
                                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', maxWidth: '350px', margin: '0 auto' }}>
                                    Triggers a loud 3-second security alarm tone across targeted camera speakers to deter intruders.
                                </p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setBroadcastModalOpen(false)}
                                style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '0.55rem 1rem', borderRadius: '8px', fontSize: '0.82rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleSendBroadcast}
                                disabled={isBroadcasting || (broadcastMode === 'tts' && !broadcastMessage.trim()) || (broadcastMode === 'ptt' && !micAudioBlob)}
                                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: (broadcastMode === 'tts' && !broadcastMessage.trim()) || (broadcastMode === 'ptt' && !micAudioBlob) ? 0.6 : 1 }}
                            >
                                <FiRadio /> {isBroadcasting ? 'Transmitting...' : 'Dispatch Broadcast'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: BROWSER VIDEO PLAYBACK MODAL */}
            {selectedVideo && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', maxWidth: '800px', width: '100%', padding: '1.25rem', boxShadow: '0 25px 50px rgba(0,0,0,0.9)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                                    Surveillance Clip: {selectedVideo.device?.description || 'Camera Recording'}
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                                    Recorded on {new Date(selectedVideo.startTime).toLocaleString()} ({selectedVideo.durationSeconds} seconds)
                                </p>
                            </div>
                            <button onClick={() => setSelectedVideo(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><FiX size={22} /></button>
                        </div>

                        {/* Native HTML5 Video Player */}
                        <div style={{ width: '100%', background: '#000', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
                            <video
                                key={selectedVideo.filePath}
                                controls
                                autoPlay
                                playsInline
                                style={{ width: '100%', maxHeight: '450px', display: 'block' }}
                            >
                                <source src={`${API_ROOT}${selectedVideo.filePath}`} type="video/webm" />
                                <source src={`${API_ROOT}${selectedVideo.filePath}`} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                Mode: <strong>{selectedVideo.recordingType || 'Manual'}</strong> | File: {selectedVideo.filePath?.split('/').pop()}
                            </div>

                            <a
                                href={`${API_ROOT}${selectedVideo.filePath}`}
                                download
                                target="_blank"
                                rel="noreferrer"
                                style={{ background: '#0284c7', color: '#fff', padding: '0.45rem 0.9rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                                <FiDownload size={14} /> Download MP4 / WebM
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: SECURITY ALERT RESOLUTION & ESCALATION */}
            {selectedAlertForResolve && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', maxWidth: '560px', width: '100%', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ background: '#e11d48', padding: '0.5rem', borderRadius: '8px', color: '#fff' }}>
                                    <FiAlertTriangle size={18} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Review Security Incident</h3>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Acknowledge, escalate, or resolve security surveillance alert</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedAlertForResolve(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><FiX size={20} /></button>
                        </div>

                        {/* Incident Snapshot & Overview */}
                        <div style={{ display: 'flex', gap: '1rem', background: '#1e293b', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
                            {selectedAlertForResolve.snapshotPath && (
                                <img
                                    src={`${API_ROOT}${selectedAlertForResolve.snapshotPath}`}
                                    alt="Incident Face"
                                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)' }}
                                />
                            )}
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#f8fafc' }}>{selectedAlertForResolve.title}</div>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>{selectedAlertForResolve.description}</div>
                                <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '0.4rem' }}>
                                    Camera: {selectedAlertForResolve.cameraName} ({selectedAlertForResolve.zoneGroup})
                                </div>
                            </div>
                        </div>

                        {/* Resolution Decision */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600', marginBottom: '0.35rem' }}>
                                Action / Resolution Status:
                            </label>
                            <select
                                value={resolutionStatus}
                                onChange={(e) => setResolutionStatus(e.target.value)}
                                style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.55rem', fontSize: '0.85rem', outline: 'none' }}
                            >
                                <option value="Resolved">✅ Resolved (Incident investigated and closed)</option>
                                <option value="Acknowledged">👁️ Acknowledged (Security monitoring)</option>
                                <option value="Escalated">⚠️ Escalated (Notify HR & Safety Manager)</option>
                                <option value="FalseAlarm">❌ False Alarm / Authorized Visitor</option>
                            </select>
                        </div>

                        {/* Resolution Incident Notes */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600', marginBottom: '0.35rem' }}>
                                Resolution Notes & Audit Remarks:
                            </label>
                            <textarea
                                rows={3}
                                value={resolutionNotes}
                                onChange={(e) => setResolutionNotes(e.target.value)}
                                placeholder="Enter guard action, visitor identification details, or resolution remarks..."
                                style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.6rem', color: '#fff', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                            <button
                                onClick={() => setSelectedAlertForResolve(null)}
                                style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '0.55rem 1rem', borderRadius: '8px', fontSize: '0.82rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResolveAlert}
                                disabled={resolving}
                                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer' }}
                            >
                                {resolving ? 'Updating...' : 'Save Resolution'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 4: CAMERA ROLE & SECURITY RULES CONFIG */}
            {roleModalChannel && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', maxWidth: '580px', width: '100%', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ background: '#0284c7', padding: '0.5rem', borderRadius: '8px', color: '#fff' }}>
                                    <FiSliders size={18} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                                        Configure Camera Role & Security Rules
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {roleModalChannel.description} ({roleModalChannel.brand} {roleModalChannel.model})
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setRoleModalChannel(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><FiX size={20} /></button>
                        </div>

                        {/* Camera Primary Role */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600', marginBottom: '0.35rem' }}>
                                Primary Operational Role:
                            </label>
                            <select
                                value={roleForm.cameraRole}
                                onChange={(e) => setRoleForm({ ...roleForm, cameraRole: e.target.value })}
                                style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.55rem', fontSize: '0.85rem', outline: 'none' }}
                            >
                                <option value="FaceRecognition">👤 Face Recognition Attendance (Check-in/Out & Kiosk Logs)</option>
                                <option value="SecuritySurveillance">🛡️ Security Surveillance (CCTV Monitoring & Intruder Logging)</option>
                                <option value="Hybrid">⚡ Hybrid AI (Both Face Attendance & Security Threat Detection)</option>
                                <option value="RestrictedArea">🚨 Restricted Area (High Alert Intrusion Alarm & Siren Warnings)</option>
                            </select>
                        </div>

                        {/* Zone & Direction */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: '600', marginBottom: '0.35rem' }}>
                                    Surveillance Zone Group:
                                </label>
                                <input
                                    type="text"
                                    value={roleForm.zoneGroup}
                                    onChange={(e) => setRoleForm({ ...roleForm, zoneGroup: e.target.value })}
                                    style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.55rem', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: '600', marginBottom: '0.35rem' }}>
                                    Traffic Direction:
                                </label>
                                <select
                                    value={roleForm.direction}
                                    onChange={(e) => setRoleForm({ ...roleForm, direction: e.target.value })}
                                    style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '0.55rem', fontSize: '0.82rem', outline: 'none' }}
                                >
                                    <option value="auto">Auto (Smart Flow)</option>
                                    <option value="in">In (Entry Only)</option>
                                    <option value="out">Out (Exit Only)</option>
                                </select>
                            </div>
                        </div>

                        {/* Security Toggles */}
                        <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '10px', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#f8fafc', marginBottom: '0.75rem' }}>
                                Automated AI Threat Rules:
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={roleForm.alertUnrecognizedFaces}
                                    onChange={(e) => setRoleForm({ ...roleForm, alertUnrecognizedFaces: e.target.checked })}
                                />
                                Alert on Unrecognized Faces / Strangers in this zone
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={roleForm.alertAfterHours}
                                    onChange={(e) => setRoleForm({ ...roleForm, alertAfterHours: e.target.checked })}
                                />
                                Monitor After-Hours Movement & Unauthorized Entry
                            </label>

                            {roleForm.alertAfterHours && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1.5rem', marginTop: '0.4rem', marginBottom: '0.6rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Window:</span>
                                    <input
                                        type="time"
                                        value={roleForm.afterHoursStart}
                                        onChange={(e) => setRoleForm({ ...roleForm, afterHoursStart: e.target.value })}
                                        style={{ background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>to</span>
                                    <input
                                        type="time"
                                        value={roleForm.afterHoursEnd}
                                        onChange={(e) => setRoleForm({ ...roleForm, afterHoursEnd: e.target.value })}
                                        style={{ background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                    />
                                </div>
                            )}

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={roleForm.enableTwoWayAudio}
                                    onChange={(e) => setRoleForm({ ...roleForm, enableTwoWayAudio: e.target.checked })}
                                />
                                Enable Two-Way Intercom & Speaker Broadcast on this Camera
                            </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                            <button
                                onClick={() => setRoleModalChannel(null)}
                                style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '0.55rem 1rem', borderRadius: '8px', fontSize: '0.82rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveRoleConfig}
                                disabled={savingRole}
                                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer' }}
                            >
                                {savingRole ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
