import { useState, useEffect } from 'react';
import { masterAPI } from '../../api';
import toast from 'react-hot-toast';

export default function CompanyMaster() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // For add/edit mode
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        tradeLicenseNo: '',
        address: '',
        email: '',
        contactNo: '',
        website: '',
        isActive: true
    });

    useEffect(() => {
        fetchCompanies();
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

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const triggerEdit = (company) => {
        setEditMode(true);
        setCurrentId(company._id);
        setFormData({
            name: company.name,
            tradeLicenseNo: company.tradeLicenseNo || '',
            address: company.address || '',
            email: company.email || '',
            contactNo: company.contactNo || '',
            website: company.website || '',
            isActive: company.isActive
        });
    };

    const cancelEdit = () => {
        setEditMode(false);
        setCurrentId(null);
        setFormData({ name: '', tradeLicenseNo: '', address: '', email: '', contactNo: '', website: '', isActive: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editMode) {
                await masterAPI.updateCompany(currentId, formData);
                toast.success('Company updated successfully');
            } else {
                await masterAPI.createCompany(formData);
                toast.success('Company created successfully');
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

    return (
        <div className="company-master-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Company Configuration</h1>
                    <p className="page-subtitle">Manage structural business branches and subsidiaries.</p>
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
                                        <th>Company Name</th>
                                        <th>License No</th>
                                        <th>Email</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {companies.map(c => (
                                        <tr key={c._id}>
                                            <td style={{ fontWeight: '600' }}>{c.name}</td>
                                            <td>{c.tradeLicenseNo || '-'}</td>
                                            <td>{c.email || '-'}</td>
                                            <td>
                                                <span className={`status-badge ${c.isActive ? 'status-approved' : 'status-rejected'}`}>
                                                    {c.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
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

                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>{editMode ? 'Update' : 'Save'}</button>
                            {editMode && <button type="button" onClick={cancelEdit} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
