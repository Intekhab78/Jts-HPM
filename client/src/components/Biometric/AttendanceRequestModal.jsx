import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { requestAttendanceUpdate } from '../../api/attendanceApi';

export default function AttendanceRequestModal({ onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        requestType: 'Missed Punch',
        requestedCheckIn: '',
        requestedCheckOut: '',
        reason: ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.requestedCheckIn && !formData.requestedCheckOut) {
            return toast.error('Please provide at least a Check In or Check Out time.');
        }

        try {
            setLoading(true);

            // Format times to correspond with the selected date
            let finalCheckIn = null;
            let finalCheckOut = null;

            if (formData.requestedCheckIn) {
                finalCheckIn = new Date(`${formData.date}T${formData.requestedCheckIn}`);
            }
            if (formData.requestedCheckOut) {
                finalCheckOut = new Date(`${formData.date}T${formData.requestedCheckOut}`);

                if (finalCheckIn && finalCheckOut <= finalCheckIn) {
                    setLoading(false);
                    return toast.error('Check Out time must be after Check In time.');
                }
            }

            const payload = {
                date: formData.date,
                requestType: formData.requestType,
                requestedCheckIn: finalCheckIn,
                requestedCheckOut: finalCheckOut,
                reason: formData.reason
            };

            await requestAttendanceUpdate(payload);
            toast.success('Attendance request submitted successfully');
            onSuccess();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h2>Submit Attendance Request</h2>
                    <button className="btn-close" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                    <div className="form-group">
                        <label className="form-label">Request Type <span style={{ color: 'red' }}>*</span></label>
                        <select
                            className="form-control"
                            name="requestType"
                            value={formData.requestType}
                            onChange={handleChange}
                            required
                        >
                            <option value="Missed Punch">Missed Punch (Forgot to Punch In/Out)</option>
                            <option value="Manual Entry">Manual Entry (Missing Entire Day)</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Date <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="date"
                            className="form-control"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            max={new Date().toISOString().split('T')[0]} // Can't request future dates
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label className="form-label">Check In Time</label>
                            <input
                                type="time"
                                className="form-control"
                                name="requestedCheckIn"
                                value={formData.requestedCheckIn}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label className="form-label">Check Out Time</label>
                            <input
                                type="time"
                                className="form-control"
                                name="requestedCheckOut"
                                value={formData.requestedCheckOut}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                    <small style={{ display: 'block', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                        * Leave blank if a certain punch was not missed.
                    </small>

                    <div className="form-group">
                        <label className="form-label">Reason <span style={{ color: 'red' }}>*</span></label>
                        <textarea
                            className="form-control"
                            name="reason"
                            value={formData.reason}
                            onChange={handleChange}
                            rows="3"
                            placeholder="e.g. Forgot to punch in upon arrival, working off-site."
                            required
                        ></textarea>
                    </div>

                    <div className="modal-footer" style={{ marginTop: '2rem', padding: 0 }}>
                        <button type="button" className="btn btn-secondary btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
