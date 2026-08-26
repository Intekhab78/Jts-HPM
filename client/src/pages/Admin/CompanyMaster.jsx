import { useState, useEffect } from 'react';
import { masterAPI } from '../../api';
import { getEmployees } from '../../api/employeeApi';
import toast from 'react-hot-toast';

export default function CompanyMaster() {
    const [companies, setCompanies] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // For add/edit mode
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [logoFile, setLogoFile] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        tagline: '',
        tradeLicenseNo: '',
        address: '',
        email: '',
        contactNo: '',
        website: '',
        isActive: true,
        allowPunchOutsideGeofence: false,
        allowOpenAttendance: false
    });

    // Overtime Rules Modal States
    const [showOtModal, setShowOtModal] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [otSettings, setOtSettings] = useState({
        enableOvertime: false,
        ruleType: 'Designation',
        designationRules: [],
        employeeRules: []
    });

    useEffect(() => {
        fetchCompanies();
        fetchEmployees();
    }, []);

    const fetchCompanies = async () => {
        try {
            setLoading(true);
            const { data } = await masterAPI.getCompanies();
            setCompanies(data.data);
        } catch (error) {
            toast.error('Failed to load companies');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await getEmployees();
            setEmployees(res.data || res);
        } catch (error) {
            console.error('Failed to load employees for rules mapping', error);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const triggerEdit = (company) => {
        setEditMode(true);
        setCurrentId(company._id);
        setLogoFile(null);
        setFormData({
            name: company.name,
            tagline: company.tagline || '',
            tradeLicenseNo: company.tradeLicenseNo || '',
            address: company.address || '',
            email: company.email || '',
            contactNo: company.contactNo || '',
            website: company.website || '',
            isActive: company.isActive,
            allowPunchOutsideGeofence: company.allowPunchOutsideGeofence || false,
            allowOpenAttendance: company.allowOpenAttendance || false
        });
    };

    const cancelEdit = () => {
        setEditMode(false);
        setCurrentId(null);
        setLogoFile(null);
        setFormData({ 
            name: '', 
            tagline: '',
            tradeLicenseNo: '', 
            address: '', 
            email: '', 
            contactNo: '', 
            website: '', 
            isActive: true, 
            allowPunchOutsideGeofence: false,
            allowOpenAttendance: false
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            let companyId = currentId;
            if (editMode) {
                await masterAPI.updateCompany(currentId, formData);
                toast.success('Company updated successfully');
            } else {
                const res = await masterAPI.createCompany(formData);
                companyId = res.data.data._id;
                toast.success('Company created successfully');
            }

            // Upload logo if selected
            if (logoFile && companyId) {
                const uploadData = new FormData();
                uploadData.append('logo', logoFile);
                await masterAPI.uploadCompanyLogo(companyId, uploadData);
                toast.success('Company logo uploaded successfully');
            }

            cancelEdit();
            fetchCompanies();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Transaction failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to permanently delete this company?")) return;
        try {
            await masterAPI.deleteCompany(id);
            toast.success('Company deleted');
            fetchCompanies();
        } catch (error) {
            toast.error('Failed to delete company');
        }
    };

    // --- OVERTIME RULES CONFIGURATION LOGIC ---
    const triggerOtRules = (company) => {
        setSelectedCompany(company);
        setOtSettings({
            enableOvertime: company.enableOvertime || false,
            ruleType: company.overtimeRules?.ruleType || 'Designation',
            designationRules: company.overtimeRules?.designationRules || [],
            employeeRules: company.overtimeRules?.employeeRules || []
        });
        setShowOtModal(true);
    };

    const handleAddDesignationRule = () => {
        setOtSettings(prev => ({
            ...prev,
            designationRules: [...prev.designationRules, { designation: '', normalRate: 1.25, holidayRate: 1.50 }]
        }));
    };

    const handleRemoveDesignationRule = (idx) => {
        setOtSettings(prev => ({
            ...prev,
            designationRules: prev.designationRules.filter((_, i) => i !== idx)
        }));
    };

    const handleAddEmployeeRule = () => {
        setOtSettings(prev => ({
            ...prev,
            employeeRules: [...prev.employeeRules, { employee: '', normalRate: 1.25, holidayRate: 1.50 }]
        }));
    };

    const handleRemoveEmployeeRule = (idx) => {
        setOtSettings(prev => ({
            ...prev,
            employeeRules: prev.employeeRules.filter((_, i) => i !== idx)
        }));
    };

    const handleOtRuleChange = (idx, field, value) => {
        setOtSettings(prev => {
            const ruleKey = prev.ruleType === 'Designation' ? 'designationRules' : 'employeeRules';
            const updated = [...prev[ruleKey]];
            updated[idx] = { ...updated[idx], [field]: value };
            return { ...prev, [ruleKey]: updated };
        });
    };

    const handleSaveOtSettings = async () => {
        try {
            const res = await masterAPI.updateCompany(selectedCompany._id, {
                enableOvertime: otSettings.enableOvertime,
                overtimeRules: {
                    ruleType: otSettings.ruleType,
                    designationRules: otSettings.designationRules,
                    employeeRules: otSettings.employeeRules
                }
            });
            if (res.data.success) {
                toast.success('Overtime configurations saved successfully');
                setShowOtModal(false);
                fetchCompanies();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update overtime settings');
        }
    };

    const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');

    return (
        <div className="company-master-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Company Configuration</h1>
                    <p className="page-subtitle">Manage structural business branches, subsidiaries, logos, taglines, and overtime rates.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
                <div className="card">
                    {loading ? (
                        <div className="loader"></div>
                    ) : companies.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>No companies registered yet.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Logo</th>
                                        <th>Company Name</th>
                                        <th>License No</th>
                                        <th>Email</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {companies.map(c => (
                                        <tr key={c._id}>
                                            <td>
                                                {c.logo ? (
                                                    <img src={`${API_URL}${c.logo}`} alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
                                                ) : (
                                                    <span style={{ fontSize: '1.2rem' }}>🏢</span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: '600' }}>{c.name}</div>
                                                {c.tagline && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>"{c.tagline}"</div>}
                                            </td>
                                            <td>{c.tradeLicenseNo || '-'}</td>
                                            <td>{c.email || '-'}</td>
                                            <td>
                                                <span className={`status-badge ${c.isActive ? 'status-approved' : 'status-rejected'}`}>
                                                    {c.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => triggerOtRules(c)} className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', color: 'var(--primary-400)', borderColor: 'var(--primary-400)' }}>OT Rules</button>
                                                    <button onClick={() => triggerEdit(c)} className="btn btn-outline" style={{ padding: '0.2rem 0.5rem' }}>Edit</button>
                                                    <button onClick={() => handleDelete(c._id)} className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', color: '#ef4444', borderColor: '#ef4444' }}>Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: '1rem' }}>{editMode ? 'Edit Company' : 'Add New Company'}</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Legal Company Name *</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} className="form-control" required />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Company Tagline</label>
                            <input type="text" name="tagline" value={formData.tagline} onChange={handleChange} className="form-control" placeholder="e.g. Innovating the Future" />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Company Logo (Image file)</label>
                            <input type="file" onChange={(e) => setLogoFile(e.target.files[0])} className="form-control" accept="image/*" />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Trade License Number</label>
                            <input type="text" name="tradeLicenseNo" value={formData.tradeLicenseNo} onChange={handleChange} className="form-control" />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Official Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-control" />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Contact Number</label>
                            <input type="text" name="contactNo" value={formData.contactNo} onChange={handleChange} className="form-control" />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Website</label>
                            <input type="text" name="website" value={formData.website} onChange={handleChange} className="form-control" placeholder="https://..." />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Registered Address</label>
                            <textarea name="address" value={formData.address} onChange={handleChange} className="form-control" rows="2" />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} id="isActiveCo" />
                            <label htmlFor="isActiveCo" className="form-label" style={{ margin: 0 }}>Active Entity</label>
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="checkbox" name="allowPunchOutsideGeofence" checked={formData.allowPunchOutsideGeofence} onChange={handleChange} id="allowPunchOutsideGeofence" />
                            <label htmlFor="allowPunchOutsideGeofence" className="form-label" style={{ margin: 0 }}>Capture Punch Outside Geo-fence</label>
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="checkbox" name="allowOpenAttendance" checked={formData.allowOpenAttendance} onChange={handleChange} id="allowOpenAttendance" />
                            <label htmlFor="allowOpenAttendance" className="form-label" style={{ margin: 0 }}>Allow Open Attendance Acceptance (Require approval if outside Geo-fence)</label>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>{editMode ? 'Update' : 'Save'}</button>
                            {editMode && <button type="button" onClick={cancelEdit} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>}
                        </div>
                    </form>
                </div>
            </div>

            {/* OVERTIME RULES SETTINGS MODAL */}
            {showOtModal && selectedCompany && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ maxWidth: '600px', width: '100%', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Overtime Rules - {selectedCompany.name}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    id="enableOt"
                                    checked={otSettings.enableOvertime}
                                    onChange={(e) => setOtSettings({ ...otSettings, enableOvertime: e.target.checked })}
                                />
                                <label htmlFor="enableOt" className="form-label" style={{ margin: 0, fontWeight: '600' }}>Enable Overtime Calculation</label>
                            </div>

                            {otSettings.enableOvertime && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">OT Scope Setting</label>
                                        <select
                                            className="form-control"
                                            value={otSettings.ruleType}
                                            onChange={(e) => setOtSettings({ ...otSettings, ruleType: e.target.value })}
                                        >
                                            <option value="Designation">Designation-Wise Multipliers</option>
                                            <option value="Employee">Employee-Wise Multipliers</option>
                                        </select>
                                    </div>

                                    {/* Designation-wise rules list */}
                                    {otSettings.ruleType === 'Designation' && (
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <label className="form-label" style={{ margin: 0 }}>Designation OT Multipliers</label>
                                                <button type="button" onClick={handleAddDesignationRule} className="btn btn-secondary btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>+ Add Row</button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {otSettings.designationRules.map((rule, idx) => (
                                                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            placeholder="Designation name, e.g. Developer"
                                                            value={rule.designation}
                                                            onChange={(e) => handleOtRuleChange(idx, 'designation', e.target.value)}
                                                            style={{ flex: 2, margin: 0 }}
                                                            required
                                                        />
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            placeholder="Normal OT rate"
                                                            step="0.01"
                                                            value={rule.normalRate}
                                                            onChange={(e) => handleOtRuleChange(idx, 'normalRate', parseFloat(e.target.value))}
                                                            style={{ flex: 1, margin: 0 }}
                                                            required
                                                        />
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            placeholder="Holiday OT rate"
                                                            step="0.01"
                                                            value={rule.holidayRate}
                                                            onChange={(e) => handleOtRuleChange(idx, 'holidayRate', parseFloat(e.target.value))}
                                                            style={{ flex: 1, margin: 0 }}
                                                            required
                                                        />
                                                        <button type="button" onClick={() => handleRemoveDesignationRule(idx)} className="btn btn-outline" style={{ padding: '0.4rem 0.6rem', color: '#ef4444', borderColor: '#ef4444' }}>X</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Employee-wise rules list */}
                                    {otSettings.ruleType === 'Employee' && (
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <label className="form-label" style={{ margin: 0 }}>Employee OT Multipliers</label>
                                                <button type="button" onClick={handleAddEmployeeRule} className="btn btn-secondary btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>+ Add Row</button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {otSettings.employeeRules.map((rule, idx) => (
                                                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                        <select
                                                            className="form-control"
                                                            value={rule.employee}
                                                            onChange={(e) => handleOtRuleChange(idx, 'employee', e.target.value)}
                                                            style={{ flex: 2, margin: 0 }}
                                                            required
                                                        >
                                                            <option value="">Select Employee</option>
                                                            {employees.map(emp => (
                                                                <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} ({emp.employeeId})</option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            placeholder="Normal OT"
                                                            step="0.01"
                                                            value={rule.normalRate}
                                                            onChange={(e) => handleOtRuleChange(idx, 'normalRate', parseFloat(e.target.value))}
                                                            style={{ flex: 1, margin: 0 }}
                                                            required
                                                        />
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            placeholder="Holiday OT"
                                                            step="0.01"
                                                            value={rule.holidayRate}
                                                            onChange={(e) => handleOtRuleChange(idx, 'holidayRate', parseFloat(e.target.value))}
                                                            style={{ flex: 1, margin: 0 }}
                                                            required
                                                        />
                                                        <button type="button" onClick={() => handleRemoveEmployeeRule(idx)} className="btn btn-outline" style={{ padding: '0.4rem 0.6rem', color: '#ef4444', borderColor: '#ef4444' }}>X</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <button type="button" onClick={() => setShowOtModal(false)} className="btn btn-secondary btn-outline">Cancel</button>
                                <button type="button" onClick={handleSaveOtSettings} className="btn btn-primary">Save Rules</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
