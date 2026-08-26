import { useState, useEffect } from 'react';
import { holidayAPI } from '../../api';
import toast from 'react-hot-toast';

export default function HolidayCalendar() {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        date: '',
        type: 'Public',
        isPaid: true
    });
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

    useEffect(() => {
        fetchHolidays(yearFilter);
    }, [yearFilter]);

    const fetchHolidays = async (yr) => {
        try {
            setLoading(true);
            const { data } = await holidayAPI.getHolidays(yr);
            setHolidays(data.data);
        } catch (error) {
            toast.error('Failed to load holidays');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await holidayAPI.createHoliday(formData);
            toast.success('Holiday added successfully!');
            setFormData({ name: '', date: '', type: 'Public', isPaid: true });
            fetchHolidays(yearFilter);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error creating holiday');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this holiday?')) return;
        try {
            await holidayAPI.deleteHoliday(id);
            toast.success('Holiday removed');
            fetchHolidays(yearFilter);
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-AE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="holiday-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">UAE Holiday Calendar</h1>
                    <p className="page-subtitle">Configure Government and Company paid holidays to sync with automated Payroll.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label>View Year:</label>
                    <input
                        type="number"
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="form-control"
                        style={{ width: '100px' }}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
                <div className="card">
                    {loading ? (
                        <div className="loader"></div>
                    ) : holidays.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>No holidays registered for {yearFilter}.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Occasion</th>
                                        <th>Type</th>
                                        <th>Paid Day</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holidays.map(h => (
                                        <tr key={h._id}>
                                            <td style={{ fontWeight: '500' }}>{formatDate(h.date)}</td>
                                            <td>{h.name}</td>
                                            <td>
                                                <span className={`badge`} style={{ background: h.type === 'Public' ? '#3b82f6' : '#8b5cf6', color: '#fff' }}>
                                                    {h.type}
                                                </span>
                                            </td>
                                            <td>
                                                {h.isPaid ?
                                                    <span style={{ color: '#10b981', fontWeight: '600' }}>✔ Yes</span> :
                                                    <span style={{ color: '#ef4444' }}>No</span>
                                                }
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleDelete(h._id)}
                                                    className="btn btn-outline"
                                                    style={{ color: '#ef4444', borderColor: '#ef4444', padding: '0.2rem 0.6rem' }}
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="card">
                    <h3>Add New Holiday</h3>
                    <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Occasion Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="form-control"
                                placeholder="e.g. Eid Al Fitr"
                                required
                            />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Date</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                className="form-control"
                                required
                            />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Type</label>
                            <select name="type" className="form-control" value={formData.type} onChange={handleChange}>
                                <option value="Public">Public (Govt)</option>
                                <option value="Company">Company Exclusive</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                                type="checkbox"
                                name="isPaid"
                                checked={formData.isPaid}
                                onChange={handleChange}
                                id="isPaidHol"
                            />
                            <label htmlFor="isPaidHol" className="form-label" style={{ margin: 0 }}>Exempt from 'Absent' salary deductions?</label>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
                            Save Holiday
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
