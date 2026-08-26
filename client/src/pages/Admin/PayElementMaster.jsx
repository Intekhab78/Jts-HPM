import { useState, useEffect } from 'react';
import { getPayElements, createPayElement, updatePayElement, deletePayElement } from '../../api/payElementApi';
import toast from 'react-hot-toast';

export default function PayElementMaster() {
    const [elements, setElements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // For add/edit mode
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'Earning',
        description: '',
        isActive: true
    });

    useEffect(() => {
        fetchElements();
    }, []);

    const fetchElements = async () => {
        try {
            setLoading(true);
            const res = await getPayElements();
            setElements(res.data.data);
        } catch (error) {
            toast.error('Failed to load Pay Elements');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const triggerEdit = (el) => {
        setEditMode(true);
        setCurrentId(el._id);
        setFormData({
            name: el.name,
            type: el.type,
            description: el.description || '',
            isActive: el.isActive
        });
    };

    const cancelEdit = () => {
        setEditMode(false);
        setCurrentId(null);
        setFormData({ name: '', type: 'Earning', description: '', isActive: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editMode) {
                await updatePayElement(currentId, formData);
                toast.success('Pay Element updated successfully');
            } else {
                await createPayElement(formData);
                toast.success('Pay Element created successfully');
            }
            cancelEdit();
            fetchElements();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Transaction failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to permanently delete this Pay Element?")) return;
        try {
            await deletePayElement(id);
            toast.success('Pay Element deleted');
            fetchElements();
        } catch (error) {
            toast.error('Failed to delete element');
        }
    };

    return (
        <div className="location-master-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Pay Element Master</h1>
                    <p className="page-subtitle">Configure dynamically linkable specific Earnings and Deductions</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', alignItems: 'start' }}>
                {/* Form Section */}
                <div className="card">
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>{editMode ? 'Edit Element' : 'Add New Element'}</h2>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Element Name *</label>
                            <input type="text" className="form-control" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. Mobile Allowance" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type *</label>
                            <select className="form-control" name="type" value={formData.type} onChange={handleChange} required>
                                <option value="Earning">Earning</option>
                                <option value="Deduction">Deduction</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description / Remarks</label>
                            <textarea className="form-control" name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="..." />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input type="checkbox" id="isActive" name="isActive" checked={formData.isActive} onChange={handleChange} />
                            <label htmlFor="isActive" style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Is Active Element</label>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            {editMode && <button type="button" className="btn btn-secondary" onClick={cancelEdit} style={{ flex: 1 }}>Cancel</button>}
                            <button type="submit" className="btn btn-primary" style={{ flex: editMode ? 1 : '1 1 100%' }} disabled={submitting}>
                                {submitting ? 'Saving...' : (editMode ? 'Update Element' : 'Add Element')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* List Section */}
                <div className="card">
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Configured Elements</h2>
                    {loading ? (
                        <p>Loading elements...</p>
                    ) : elements.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)' }}>No elements configured yet.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Element Name</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {elements.map(el => (
                                        <tr key={el._id}>
                                            <td style={{ fontWeight: 500 }}>{el.name}</td>
                                            <td>
                                                <span className={`badge badge-${el.type === 'Earning' ? 'success' : 'danger'}`}>
                                                    {el.type}
                                                </span>
                                            </td>
                                            <td>
                                                {el.isActive ?
                                                    <span style={{ color: '#10b981', fontSize: '0.85rem' }}>Active</span> :
                                                    <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>Inactive</span>
                                                }
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => triggerEdit(el)} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Edit</button>
                                                    <button onClick={() => handleDelete(el._id)} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
