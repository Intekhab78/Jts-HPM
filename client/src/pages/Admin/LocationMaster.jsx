import { useState, useEffect } from 'react';
import { masterAPI } from '../../api';
import toast from 'react-hot-toast';

export default function LocationMaster() {
    const [locations, setLocations] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // For add/edit mode
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        company: '',
        address: '',
        email: '',
        contactNo: '',
        isActive: true
    });

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        try {
            setLoading(true);
            const [locRes, compRes] = await Promise.all([
                masterAPI.getLocations(),
                masterAPI.getCompanies()
            ]);
            setLocations(locRes.data.data);
            setCompanies(compRes.data.data);
        } catch (error) {
            toast.error('Failed to load branch locations');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const triggerEdit = (location) => {
        setEditMode(true);
        setCurrentId(location._id);
        setFormData({
            name: location.name,
            company: location.company?._id || location.company || '',
            address: location.address || '',
            email: location.email || '',
            contactNo: location.contactNo || '',
            isActive: location.isActive
        });
    };

    const cancelEdit = () => {
        setEditMode(false);
        setCurrentId(null);
        setFormData({ name: '', company: '', address: '', email: '', contactNo: '', isActive: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editMode) {
                await masterAPI.updateLocation(currentId, formData);
                toast.success('Branch Location updated successfully');
            } else {
                await masterAPI.createLocation(formData);
                toast.success('Branch Location created successfully');
            }
            cancelEdit();
            fetchLocations();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Transaction failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to permanently delete this branch location?")) return;
        try {
            await masterAPI.deleteLocation(id);
            toast.success('Branch Location deleted');
            fetchLocations();
        } catch (error) {
            toast.error('Failed to delete location');
        }
    };

    return (
        <div className="location-master-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Branch Locations</h1>
                    <p className="page-subtitle">Manage physical office sites, geographical boundaries, and remote operating bases.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
                <div className="card">
                    {loading ? (
                        <div className="loader"></div>
                    ) : locations.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>No branch locations registered yet.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Branch Name</th>
                                        <th>Parent Company</th>
                                        <th>Primary Email</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {locations.map(loc => (
                                        <tr key={loc._id}>
                                            <td style={{ fontWeight: '600' }}>{loc.name}</td>
                                            <td>{loc.company?.name || '-'}</td>
                                            <td>{loc.email || '-'}</td>
                                            <td>
                                                <span className={`status-badge ${loc.isActive ? 'status-approved' : 'status-rejected'}`}>
                                                    {loc.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => triggerEdit(loc)} className="btn btn-outline" style={{ padding: '0.2rem 0.5rem' }}>Edit</button>
                                                    <button onClick={() => handleDelete(loc._id)} className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', color: '#ef4444', borderColor: '#ef4444' }}>Delete</button>
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
                    <h3 style={{ marginBottom: '1rem' }}>{editMode ? 'Edit Branch Location' : 'Add New Branch'}</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Parent Company *</label>
                            <select name="company" value={formData.company} onChange={handleChange} className="form-control" required>
                                <option value="">Select Company</option>
                                {companies.map(c => (
                                    <option key={c._id} value={c._id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Branch/Location Name *</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} className="form-control" required />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Branch Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-control" />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Branch Contact Number</label>
                            <input type="text" name="contactNo" value={formData.contactNo} onChange={handleChange} className="form-control" />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Physical Address</label>
                            <textarea name="address" value={formData.address} onChange={handleChange} className="form-control" rows="3" />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} id="isActiveLoc" />
                            <label htmlFor="isActiveLoc" className="form-label" style={{ margin: 0 }}>Active Location</label>
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
