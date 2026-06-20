import { useState, useEffect } from 'react';
import { getAttendanceSettings, updateAttendanceSettings } from '../../api/settingsApi';
import toast from 'react-hot-toast';

export default function AttendanceSettings() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await getAttendanceSettings();
            setSettings(res.data);
        } catch (error) {
            toast.error('Failed to load attendance settings');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await updateAttendanceSettings(settings);
            setSettings(res.data);
            toast.success('Attendance settings saved successfully');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="page-loader" style={{ minHeight: '400px' }}>
                <div className="loader"></div>
            </div>
        );
    }

    if (!settings) {
        return <div className="card">Failed to load settings.</div>;
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Attendance Policy Settings</h1>
                    <p className="page-subtitle">Configure office hours, overtime, and late deduction rules</p>
                </div>
            </div>

            {/* Office Hours */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🕐 Office Hours
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Office Start Time</label>
                        <input
                            type="time"
                            className="form-control"
                            value={settings.officeStartTime || '09:00'}
                            onChange={(e) => handleChange('officeStartTime', e.target.value)}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Office End Time</label>
                        <input
                            type="time"
                            className="form-control"
                            value={settings.officeEndTime || '18:00'}
                            onChange={(e) => handleChange('officeEndTime', e.target.value)}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Expected Working Hours</label>
                        <input
                            type="number"
                            className="form-control"
                            value={settings.expectedWorkingHours || 9}
                            min="1"
                            max="24"
                            onChange={(e) => handleChange('expectedWorkingHours', Number(e.target.value))}
                        />
                    </div>
                </div>
            </div>

            {/* Late Marking */}
            <div className="card" style={{ marginBottom: '1.5rem', border: settings.lateMarkingEnabled ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ⏰ Late Deduction
                    </h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ fontSize: '0.9rem', color: settings.lateMarkingEnabled ? '#f59e0b' : 'var(--text-secondary)', fontWeight: '500' }}>
                            {settings.lateMarkingEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <div
                            onClick={() => handleChange('lateMarkingEnabled', !settings.lateMarkingEnabled)}
                            style={{
                                width: '48px', height: '26px', borderRadius: '13px',
                                background: settings.lateMarkingEnabled ? '#f59e0b' : '#64748b',
                                position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                            }}
                        >
                            <div style={{
                                width: '22px', height: '22px', borderRadius: '50%', background: 'white',
                                position: 'absolute', top: '2px',
                                left: settings.lateMarkingEnabled ? '24px' : '2px',
                                transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                    </label>
                </div>

                {settings.lateMarkingEnabled ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Grace Period (Minutes)</label>
                            <input
                                type="number"
                                className="form-control"
                                value={settings.lateGraceMinutes ?? 15}
                                min="0"
                                max="120"
                                onChange={(e) => handleChange('lateGraceMinutes', Number(e.target.value))}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                Employees arriving within this many minutes after start time are not marked late
                            </p>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Half Day Threshold (Minutes Late)</label>
                            <input
                                type="number"
                                className="form-control"
                                value={settings.halfDayThresholdMinutes || Math.round((settings.expectedWorkingHours || 9) * 60 / 2)}
                                min="30"
                                max="480"
                                onChange={(e) => handleChange('halfDayThresholdMinutes', Number(e.target.value))}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                If late by more than this, attendance is marked as Half Day
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Late marking is disabled — no employees will be marked as "Late" or penalized for late arrival.
                    </div>
                )}
            </div>

            {/* Overtime */}
            <div className="card" style={{ marginBottom: '1.5rem', border: settings.overtimeEnabled ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🕛 Overtime (OT)
                    </h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ fontSize: '0.9rem', color: settings.overtimeEnabled ? '#3b82f6' : 'var(--text-secondary)', fontWeight: '500' }}>
                            {settings.overtimeEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <div
                            onClick={() => handleChange('overtimeEnabled', !settings.overtimeEnabled)}
                            style={{
                                width: '48px', height: '26px', borderRadius: '13px',
                                background: settings.overtimeEnabled ? '#3b82f6' : '#64748b',
                                position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                            }}
                        >
                            <div style={{
                                width: '22px', height: '22px', borderRadius: '50%', background: 'white',
                                position: 'absolute', top: '2px',
                                left: settings.overtimeEnabled ? '24px' : '2px',
                                transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                    </label>
                </div>

                {settings.overtimeEnabled ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Minimum OT Minutes</label>
                            <input
                                type="number"
                                className="form-control"
                                value={settings.otMinimumMinutes ?? 60}
                                min="0"
                                max="240"
                                onChange={(e) => handleChange('otMinimumMinutes', Number(e.target.value))}
                                style={{ maxWidth: '300px' }}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                Employee must work at least this many minutes beyond shift end to qualify for OT
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Overtime calculation is disabled — system will not auto-calculate OT hours for any attendance records.
                    </div>
                )}
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleSave} className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
                    {saving ? 'Saving...' : '💾 Save Settings'}
                </button>
            </div>
        </div>
    );
}
