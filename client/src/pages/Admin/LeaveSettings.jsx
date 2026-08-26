import { useState, useEffect } from 'react';
import { leaveSettingsAPI } from '../../api';
import toast from 'react-hot-toast';
import { HiOutlineCog6Tooth, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi2';

export default function LeaveSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [settings, setSettings] = useState({
        annualLeaveDays: 30,
        sickLeaveDays: 90,
        maternityLeaveDays: 60,
        paternityLeaveDays: 5,
        allowAnnualLeaveDuringProbation: false,
        enableCarryForward: false,
        defaultMaxCarryForwardDays: 15,
        designationCarryForwardLimits: [],
        enableLeaveEncashment: false
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await leaveSettingsAPI.getSettings();
            if (res.data?.data) {
                setSettings(res.data.data);
            }
        } catch (error) {
            toast.error('Failed to load leave settings');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, type, checked, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleDesignationLimitChange = (index, field, value) => {
        const newLimits = [...settings.designationCarryForwardLimits];
        newLimits[index][field] = value;
        setSettings(prev => ({ ...prev, designationCarryForwardLimits: newLimits }));
    };

    const addDesignationLimit = () => {
        setSettings(prev => ({
            ...prev,
            designationCarryForwardLimits: [...prev.designationCarryForwardLimits, { designation: '', maxDays: 0 }]
        }));
    };

    const removeDesignationLimit = (index) => {
        const newLimits = settings.designationCarryForwardLimits.filter((_, i) => i !== index);
        setSettings(prev => ({ ...prev, designationCarryForwardLimits: newLimits }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await leaveSettingsAPI.updateSettings(settings);
            toast.success('Leave settings updated successfully');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-loader"><div className="loader"></div></div>;

    return (
        <div className="leave-settings-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><HiOutlineCog6Tooth style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Leave Policy Settings</h1>
                    <p className="page-subtitle">Configure UAE leave rules, accruals, probation locks, and carry-forward limits.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                {/* Standard Quotas */}
                <div className="card">
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        Base Annual Allowances (Days)
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label className="form-label">Annual Leave *</label>
                            <input type="number" className="form-control" name="annualLeaveDays" value={settings.annualLeaveDays} onChange={handleChange} required min="0" />
                            <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>Standard is 30 days/year (2.5/month)</small>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Sick Leave *</label>
                            <input type="number" className="form-control" name="sickLeaveDays" value={settings.sickLeaveDays} onChange={handleChange} required min="0" />
                            <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>Standard is 90 days/year</small>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Maternity Leave *</label>
                            <input type="number" className="form-control" name="maternityLeaveDays" value={settings.maternityLeaveDays} onChange={handleChange} required min="0" />
                            <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>Applied to female employees</small>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Paternity Leave *</label>
                            <input type="number" className="form-control" name="paternityLeaveDays" value={settings.paternityLeaveDays} onChange={handleChange} required min="0" />
                            <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>Applied to male employees</small>
                        </div>
                    </div>
                </div>

                {/* Probation Rules */}
                <div className="card">
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        Probation & Joining Rules
                    </h2>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                        <input
                            type="checkbox"
                            id="allowAnnualProbation"
                            name="allowAnnualLeaveDuringProbation"
                            checked={settings.allowAnnualLeaveDuringProbation}
                            onChange={handleChange}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <label htmlFor="allowAnnualProbation" style={{ cursor: 'pointer', fontWeight: '500' }}>
                            Allow taking Annual Leave during Probation Period
                        </label>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginLeft: '2.5rem' }}>
                        If disabled (standard practice), employees will continue to <strong>accrue</strong> 2.5 days per month safely in the background, but their dashboard will lock application forms and show "0 Available" until their designated Probation End Date has passed.
                    </p>
                </div>

                {/* Carry Forward Settings */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Carry-Forward (Rollover) Rules</h2>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <label htmlFor="enableCarryForward" style={{ fontWeight: '500' }}>Active</label>
                            <div className="toggle-switch">
                                <input
                                    type="checkbox"
                                    id="enableCarryForward"
                                    name="enableCarryForward"
                                    checked={settings.enableCarryForward}
                                    onChange={handleChange}
                                    style={{ width: '20px', height: '20px' }}
                                />
                            </div>
                        </div>
                    </div>

                    {settings.enableCarryForward && (
                        <div className="animate-fade-up">
                            <div className="form-group" style={{ maxWidth: '300px', marginBottom: '2rem' }}>
                                <label className="form-label">Global Default Limit (Days) *</label>
                                <input type="number" className="form-control" name="defaultMaxCarryForwardDays" value={settings.defaultMaxCarryForwardDays} onChange={handleChange} min="0" required />
                                <small style={{ color: 'var(--text-secondary)' }}>Maximum un-taken days a standard employee can roll into the next year.</small>
                            </div>

                            <div style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Designation-Based Exceptions</h3>
                                    <button type="button" onClick={addDesignationLimit} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}>
                                        <HiOutlinePlus /> Add Exception
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                    Override the global limit for specific job titles (e.g. "Director" can carry 30 days instead of 15).
                                </p>

                                {settings.designationCarryForwardLimits.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'rgba(255,255,255,0.5)', borderRadius: '4px' }}>
                                        No designation exceptions added.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {settings.designationCarryForwardLimits.map((limit, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-color)', padding: '0.5rem', borderRadius: '6px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        placeholder="Exact Title (e.g., Manager)"
                                                        value={limit.designation}
                                                        onChange={(e) => handleDesignationLimitChange(idx, 'designation', e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div style={{ width: '150px' }}>
                                                    <input
                                                        type="number"
                                                        className="form-control"
                                                        placeholder="Max Days"
                                                        value={limit.maxDays}
                                                        onChange={(e) => handleDesignationLimitChange(idx, 'maxDays', e.target.value)}
                                                        required min="0"
                                                    />
                                                </div>
                                                <button type="button" onClick={() => removeDesignationLimit(idx)} className="btn btn-danger" style={{ padding: '0.5rem' }} title="Remove Exception">
                                                    <HiOutlineTrash />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Encashment */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Leave Encashment (Reimbursement)</h2>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Allow employees to request monetary compensation for accrued annual leave days.</p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <label htmlFor="enableLeaveEncashment" style={{ fontWeight: '500' }}>Active</label>
                            <input
                                type="checkbox"
                                id="enableLeaveEncashment"
                                name="enableLeaveEncashment"
                                checked={settings.enableLeaveEncashment}
                                onChange={handleChange}
                                style={{ width: '20px', height: '20px' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 2.5rem', fontSize: '1.1rem' }}>
                        {saving ? 'Applying Policies...' : 'Save Configuration'}
                    </button>
                </div>

            </form>
        </div>
    );
}
