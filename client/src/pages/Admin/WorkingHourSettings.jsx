import { useState, useEffect } from 'react';
import { getOverrides, createOverride, deleteOverride } from '../../api/settingsApi';
import { masterAPI } from '../../api';
import toast from 'react-hot-toast';

export default function WorkingHourSettings() {
    const [overrides, setOverrides] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        fromDate: '',
        toDate: '',
        company: '',
        location: '',
        type: 'Shortened Hours',
        workingHours: 6
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [oRes, cRes, lRes] = await Promise.all([
                getOverrides(),
                masterAPI.getCompanies(),
                masterAPI.getLocations()
            ]);
            setOverrides(oRes.data || []);
            setCompanies(cRes.data?.data || []);
            setLocations(lRes.data?.data || []);
        } catch (error) {
            toast.error('Failed to load settings data');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData };
            if (!payload.company) delete payload.company;
            if (!payload.location) delete payload.location;

            await createOverride(payload);
            toast.success('Override rule added successfully');
            setShowForm(false);
            setFormData({
                title: '', fromDate: '', toDate: '', company: '', location: '', type: 'Shortened Hours', workingHours: 6
            });
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this rule?')) return;
        try {
            await deleteOverride(id);
            toast.success('Rule deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete rule');
        }
    };

    return (
        <div className="working-hour-settings">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Working Hour Settings</h1>
                    <p className="page-subtitle">Configure special working hour overrides like Ramadan or Rain Days</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    + New Override Rule
                </button>
            </div>

            {showForm && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h3>Add Override Rule</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Title (e.g. Ramadan 2026)</label>
                            <input type="text" className="form-control" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select className="form-control" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option value="Shortened Hours">Shortened Hours</option>
                                <option value="Half Day Off">Half Day Off</option>
                                <option value="Full Day Off">Full Day Off</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">From Date</label>
                            <input type="date" className="form-control" required value={formData.fromDate} onChange={e => setFormData({ ...formData, fromDate: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">To Date</label>
                            <input type="date" className="form-control" required value={formData.toDate} onChange={e => setFormData({ ...formData, toDate: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Company (Optional - leave blank for all)</label>
                            <select className="form-control" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })}>
                                <option value="">-- All Companies --</option>
                                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Location (Optional - leave blank for all)</label>
                            <select className="form-control" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}>
                                <option value="">-- All Locations --</option>
                                {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                            </select>
                        </div>
                        {formData.type === 'Shortened Hours' && (
                            <div className="form-group">
                                <label className="form-label">Required Working Hours (e.g. 6)</label>
                                <input type="number" className="form-control" min="1" max="24" required value={formData.workingHours} onChange={e => setFormData({ ...formData, workingHours: e.target.value })} />
                            </div>
                        )}
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <button type="submit" className="btn btn-primary">Save Rule</button>
                            <button type="button" className="btn btn-secondary" style={{ marginLeft: '1rem' }} onClick={() => setShowForm(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Dates</th>
                                <th>Type</th>
                                <th>Hours</th>
                                <th>Applies To</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overrides.map(o => (
                                <tr key={o._id}>
                                    <td style={{ fontWeight: '500' }}>{o.title}</td>
                                    <td>{new Date(o.fromDate).toLocaleDateString()} - {new Date(o.toDate).toLocaleDateString()}</td>
                                    <td><span className={`badge badge-${o.type === 'Full Day Off' ? 'success' : 'warning'}`}>{o.type}</span></td>
                                    <td>{o.type === 'Full Day Off' ? '0 hrs' : `${o.workingHours} hrs`}</td>
                                    <td>
                                        <div style={{ fontSize: '0.8rem' }}>Company: {o.company ? o.company.name : 'All'}</div>
                                        <div style={{ fontSize: '0.8rem' }}>Location: {o.location ? o.location.name : 'All'}</div>
                                    </td>
                                    <td>
                                        <button onClick={() => handleDelete(o._id)} className="btn btn-secondary btn-outline" style={{ color: '#ef4444', borderColor: '#ef4444', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {overrides.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No active override rules found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
