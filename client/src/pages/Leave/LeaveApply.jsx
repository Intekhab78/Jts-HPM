import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { applyForLeave, uploadLeaveAttachment } from '../../api/leaveApi';
import { getEmployees } from '../../api/employeeApi';
import { leaveSettingsAPI } from '../../api';
import toast from 'react-hot-toast';

export default function LeaveApply() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        leaveType: 'Annual',
        fromDate: '',
        toDate: '',
        reason: '',
        employee: user?.employeeRef || '',
        encashmentDays: '' // Used when type is Encashment
    });

    const [policySettings, setPolicySettings] = useState(null);

    useEffect(() => {
        if (user && user.employeeRef) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData(prev => ({ ...prev, employee: user.employeeRef }));
        }

        // Fetch settings for encashment toggle
        leaveSettingsAPI.getSettings().then(res => {
            if (res.data?.data) setPolicySettings(res.data.data);
        }).catch(err => console.error(err));
    }, [user]);

    const [employees, setEmployees] = useState([]);
    const canApplyForOthers = ['admin', 'hr', 'manager'].includes(user?.role);



    useEffect(() => {
        if (canApplyForOthers) {
            getEmployees()
                .then(res => setEmployees(res.data))
                .catch(err => console.error("Failed to load employees for leave dropdown"));
        }
    }, [canApplyForOthers]);

    const [attachment, setAttachment] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            setAttachment(e.target.files[0]);
        }
    };

    // Simple days calculation (inclusive)
    const calculateDays = () => {
        if (!formData.fromDate || !formData.toDate) return 0;
        const start = new Date(formData.fromDate);
        const end = new Date(formData.toDate);
        if (end < start) return 0;

        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.employee) {
            toast.error('Please select an employee for this leave request');
            return;
        }

        try {
            setSubmitting(true);

            let days = 0;
            let submitData = { ...formData };

            if (formData.leaveType === 'Encashment') {
                days = parseFloat(formData.encashmentDays);
                if (isNaN(days) || days <= 0) {
                    toast.error('Please enter a valid number of days to encash');
                    setSubmitting(false);
                    return;
                }
                submitData.totalDays = days;
                // Encashment technically doesn't have dates, so pass today
                submitData.fromDate = new Date().toISOString();
                submitData.toDate = new Date().toISOString();
            } else {
                days = calculateDays();
                if (days <= 0) {
                    toast.error('Invalid date range');
                    setSubmitting(false);
                    return;
                }
                submitData.totalDays = days;
            }

            // 1. Submit leave request
            const res = await applyForLeave(submitData);

            // 2. Upload attachment if exists (e.g. sick leave cert)
            if (attachment && res.data._id) {
                const uploadData = new FormData();
                uploadData.append('attachment', attachment);
                await uploadLeaveAttachment(res.data._id, uploadData);
            }

            toast.success('Leave applied successfully. Awaiting approval.');
            // Only unlock submission if we aren't unmounting, but navigation usually handles this
            setTimeout(() => {
                navigate('/leaves');
            }, 1000);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to apply for leave');
            setSubmitting(false); // Only re-enable if there's an error
        }
    };

    return (
        <div className="leave-apply-page" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Apply for Leave</h1>
                    <p className="page-subtitle">Submit a time off request to your manager</p>
                </div>
                <button onClick={() => navigate('/leaves')} className="btn btn-secondary">Back</button>
            </div>

            <div className="card">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {canApplyForOthers && (
                        <div className="form-group">
                            <label className="form-label">Employee *</label>
                            <select className="form-control" name="employee" value={formData.employee} onChange={handleChange} required>
                                <option value="" disabled>Select Employee</option>
                                {employees.map(emp => (
                                    <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} ({emp.employeeId})</option>
                                ))}
                            </select>
                            <small style={{ color: 'var(--text-secondary)' }}>As an Admin/HR, you can apply leave on behalf of any employee.</small>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Leave Type *</label>
                        <select className="form-control" name="leaveType" value={formData.leaveType} onChange={handleChange} required>
                            <option value="Annual">Annual Leave</option>
                            <option value="Sick">Sick Leave</option>

                            {/* Gender-based Filtering */}
                            {(() => {
                                let gender = null;
                                if (canApplyForOthers && employees.length > 0) {
                                    const emp = employees.find(e => e._id === formData.employee);
                                    if (emp) gender = emp.gender?.toLowerCase();
                                } else if (user?.employeeRef) {
                                    gender = user.employeeRef.gender?.toLowerCase();
                                }

                                return (
                                    <>
                                        {(gender !== 'male') && <option value="Maternity">Maternity Leave</option>}
                                        {(gender !== 'female') && <option value="Paternity">Paternity Leave</option>}
                                    </>
                                );
                            })()}

                            <option value="Hajj">Hajj Leave</option>
                            <option value="Compassionate">Compassionate Leave</option>
                            <option value="Unpaid">Unpaid Leave</option>
                            {policySettings?.enableLeaveEncashment && (
                                <option value="Encashment">Leave Encashment (Payout)</option>
                            )}
                        </select>
                    </div>

                    {formData.leaveType !== 'Encashment' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label className="form-label">From Date *</label>
                                <input type="date" className="form-control" name="fromDate" value={formData.fromDate} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">To Date *</label>
                                <input type="date" className="form-control" name="toDate" value={formData.toDate} onChange={handleChange} required min={formData.fromDate} />
                            </div>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">Number of Annual Leave Days to Encash *</label>
                            <input type="number" className="form-control" name="encashmentDays" value={formData.encashmentDays} onChange={handleChange} required min="1" step="1" />
                            <small style={{ color: 'var(--text-secondary)' }}>You are requesting to be paid out for these accrued days instead of taking time off. This will deduct from your Annual Leave balance.</small>
                        </div>
                    )}

                    {formData.leaveType !== 'Encashment' && formData.fromDate && formData.toDate && calculateDays() > 0 && (
                        <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '500' }}>Total Duration:</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{calculateDays()} Days</span>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Reason / Comments *</label>
                        <textarea
                            className="form-control"
                            name="reason"
                            value={formData.reason}
                            onChange={handleChange}
                            required
                            rows="4"
                            placeholder="Please provide details for this leave request..."
                        ></textarea>
                    </div>

                    {formData.leaveType === 'Sick' && (
                        <div className="form-group" style={{ padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                            <label className="form-label">Medical Certificate (Required for Sick Leave)</label>
                            <input type="file" className="form-control" onChange={handleFileChange} accept=".pdf,.jpg,.png" required={formData.leaveType === 'Sick'} style={{ padding: '0.4rem' }} />
                            <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.5rem' }}>Upload DHA/MOH stamp authorized medical certificate.</small>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
