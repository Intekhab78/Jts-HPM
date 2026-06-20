import { useState, useEffect } from 'react';
import { downloadAttendanceReport, downloadPayrollReport } from '../../api/reportApi';
import { authAPI, masterAPI } from '../../api';
import { getFrozenMonths } from '../../api/payrollApi';
import toast from 'react-hot-toast';

export default function ReportsDashboard() {
    const [companies, setCompanies] = useState([]);
    const [locations, setLocations] = useState([]);

    const [attFilter, setAttFilter] = useState({
        fromDate: '', toDate: '', company: '', location: ''
    });

    const [payFilter, setPayFilter] = useState({
        month: new Date().getMonth() + 1, year: new Date().getFullYear(), company: '', location: ''
    });

    const [empFilter, setEmpFilter] = useState({
        company: '', location: '', department: '', isActive: ''
    });

    const [appRFilter, setAppRFilter] = useState({
        year: new Date().getFullYear(), cycle: '', company: ''
    });

    const [travelFilter, setTravelFilter] = useState({
        fromDate: '', toDate: '', company: ''
    });

    const [leaveFilter, setLeaveFilter] = useState({
        fromDate: '', toDate: '', company: '', leaveType: ''
    });

    const [regFilter, setRegFilter] = useState({
        month: '', year: '', company: '', location: ''
    });
    const [frozenMonths, setFrozenMonths] = useState([]);

    useEffect(() => {
        const fetchMasters = async () => {
            const [cRes, lRes] = await Promise.all([masterAPI.getCompanies(), masterAPI.getLocations()]);
            setCompanies(cRes.data?.data || []);
            setLocations(lRes.data?.data || []);
        };
        fetchMasters();

        // Fetch frozen months for Payroll Register
        const fetchFrozen = async () => {
            try {
                const res = await getFrozenMonths();
                setFrozenMonths(res.data || []);
                if (res.data && res.data.length > 0) {
                    setRegFilter(prev => ({ ...prev, month: res.data[0].month, year: res.data[0].year }));
                }
            } catch (e) {
                console.error('Could not load frozen months', e);
            }
        };
        fetchFrozen();
    }, []);

    const handleDownloadAttendance = async (e) => {
        e.preventDefault();
        try {
            await downloadAttendanceReport(attFilter);
            toast.success('Attendance report downloaded');
        } catch (error) {
            toast.error('Failed to download attendance report');
        }
    };

    const handleDownloadPayroll = async (e) => {
        e.preventDefault();
        try {
            await downloadPayrollReport(payFilter);
            toast.success('Payroll report downloaded');
        } catch (error) {
            toast.error('Failed to download payroll report');
        }
    };

    const handleDownloadEmployee = async (e) => {
        e.preventDefault();
        try {
            const { downloadEmployeeReport } = await import('../../api/reportApi');
            await downloadEmployeeReport(empFilter);
            toast.success('Employee report downloaded');
        } catch (error) {
            toast.error('Failed to download employee report');
        }
    };

    const handleDownloadAppraisal = async (e) => {
        e.preventDefault();
        try {
            const { downloadAppraisalReport } = await import('../../api/reportApi');
            await downloadAppraisalReport(appRFilter);
            toast.success('Appraisal report downloaded');
        } catch (error) {
            toast.error('Failed to download appraisal report');
        }
    };

    const handleDownloadTravel = async (e) => {
        e.preventDefault();
        try {
            const { downloadTravelReport } = await import('../../api/reportApi');
            await downloadTravelReport(travelFilter);
            toast.success('Travel report downloaded');
        } catch (error) {
            toast.error('Failed to download travel report');
        }
    };

    const handleDownloadLeave = async (e) => {
        e.preventDefault();
        try {
            const { downloadLeaveReport } = await import('../../api/reportApi');
            await downloadLeaveReport(leaveFilter);
            toast.success('Leave report downloaded');
        } catch (error) {
            toast.error('Failed to download leave report');
        }
    };

    const handleDownloadRegister = async (e) => {
        e.preventDefault();
        if (!regFilter.month || !regFilter.year) {
            toast.error('Please select a frozen payroll month');
            return;
        }
        try {
            const { downloadPayrollRegister } = await import('../../api/reportApi');
            await downloadPayrollRegister(regFilter);
            toast.success('Payroll Register downloaded');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to download payroll register');
        }
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
        <div className="reports-dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Generate Reports</h1>
                    <p className="page-subtitle">Download Attendance and Payroll data extracts</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
                <div className="card">
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Attendance Report</h3>
                    <form onSubmit={handleDownloadAttendance}>
                        <div className="form-group">
                            <label className="form-label">From Date</label>
                            <input type="date" className="form-control" value={attFilter.fromDate} onChange={e => setAttFilter({ ...attFilter, fromDate: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">To Date</label>
                            <input type="date" className="form-control" value={attFilter.toDate} onChange={e => setAttFilter({ ...attFilter, toDate: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Company</label>
                            <select className="form-control" value={attFilter.company} onChange={e => setAttFilter({ ...attFilter, company: e.target.value })}>
                                <option value="">All Companies</option>
                                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Location</label>
                            <select className="form-control" value={attFilter.location} onChange={e => setAttFilter({ ...attFilter, location: e.target.value })}>
                                <option value="">All Locations</option>
                                {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Download Excel</button>
                    </form>
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Payroll Report</h3>
                    <form onSubmit={handleDownloadPayroll}>
                        <div className="form-group">
                            <label className="form-label">Processing Month</label>
                            <select className="form-control" value={payFilter.month} onChange={e => setPayFilter({ ...payFilter, month: e.target.value })}>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Processing Year</label>
                            <input type="number" className="form-control" value={payFilter.year} onChange={e => setPayFilter({ ...payFilter, year: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Company</label>
                            <select className="form-control" value={payFilter.company} onChange={e => setPayFilter({ ...payFilter, company: e.target.value })}>
                                <option value="">All Companies</option>
                                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Location</label>
                            <select className="form-control" value={payFilter.location} onChange={e => setPayFilter({ ...payFilter, location: e.target.value })}>
                                <option value="">All Locations</option>
                                {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', backgroundColor: '#10b981', borderColor: '#10b981' }}>Download Excel</button>
                    </form>
                </div>

                {/* EMPLOYEE REPORT */}
                <div className="card">
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Employee Report</h3>
                    <form onSubmit={handleDownloadEmployee}>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-control" value={empFilter.isActive} onChange={e => setEmpFilter({ ...empFilter, isActive: e.target.value })}>
                                <option value="">All Statuses</option>
                                <option value="true">Active Only</option>
                                <option value="false">Inactive Only</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Company</label>
                            <select className="form-control" value={empFilter.company} onChange={e => setEmpFilter({ ...empFilter, company: e.target.value })}>
                                <option value="">All Companies</option>
                                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Location</label>
                            <select className="form-control" value={empFilter.location} onChange={e => setEmpFilter({ ...empFilter, location: e.target.value })}>
                                <option value="">All Locations</option>
                                {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Department</label>
                            <input type="text" className="form-control" placeholder="e.g. IT" value={empFilter.department} onChange={e => setEmpFilter({ ...empFilter, department: e.target.value })} />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}>Download Excel</button>
                    </form>
                </div>

                {/* APPRAISAL REPORT */}
                <div className="card">
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Appraisal Report</h3>
                    <form onSubmit={handleDownloadAppraisal}>
                        <div className="form-group">
                            <label className="form-label">Performance Year</label>
                            <input type="number" className="form-control" value={appRFilter.year} onChange={e => setAppRFilter({ ...appRFilter, year: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cycle</label>
                            <select className="form-control" value={appRFilter.cycle} onChange={e => setAppRFilter({ ...appRFilter, cycle: e.target.value })}>
                                <option value="">All Cycles</option>
                                <option value="H1">H1 (First Half)</option>
                                <option value="H2">H2 (Second Half)</option>
                                <option value="Annual">Annual</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Company</label>
                            <select className="form-control" value={appRFilter.company} onChange={e => setAppRFilter({ ...appRFilter, company: e.target.value })}>
                                <option value="">All Companies</option>
                                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}>Download Excel</button>
                    </form>
                </div>

                {/* TRAVEL & EXPENSE REPORT */}
                <div className="card">
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Travel & Expense Report</h3>
                    <form onSubmit={handleDownloadTravel}>
                        <div className="form-group">
                            <label className="form-label">From Date</label>
                            <input type="date" className="form-control" value={travelFilter.fromDate} onChange={e => setTravelFilter({ ...travelFilter, fromDate: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">To Date</label>
                            <input type="date" className="form-control" value={travelFilter.toDate} onChange={e => setTravelFilter({ ...travelFilter, toDate: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Company</label>
                            <select className="form-control" value={travelFilter.company} onChange={e => setTravelFilter({ ...travelFilter, company: e.target.value })}>
                                <option value="">All Companies</option>
                                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}>Download Excel</button>
                    </form>
                </div>

                {/* LEAVE REPORT */}
                <div className="card">
                    <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Leave Report</h3>
                    <form onSubmit={handleDownloadLeave}>
                        <div className="form-group">
                            <label className="form-label">From Date</label>
                            <input type="date" className="form-control" value={leaveFilter.fromDate} onChange={e => setLeaveFilter({ ...leaveFilter, fromDate: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">To Date</label>
                            <input type="date" className="form-control" value={leaveFilter.toDate} onChange={e => setLeaveFilter({ ...leaveFilter, toDate: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Leave Type</label>
                            <select className="form-control" value={leaveFilter.leaveType} onChange={e => setLeaveFilter({ ...leaveFilter, leaveType: e.target.value })}>
                                <option value="">All Types</option>
                                <option value="Annual">Annual</option>
                                <option value="Sick">Sick</option>
                                <option value="Unpaid">Unpaid</option>
                                <option value="Maternity">Maternity</option>
                                <option value="Paternity">Paternity</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Company</label>
                            <select className="form-control" value={leaveFilter.company} onChange={e => setLeaveFilter({ ...leaveFilter, company: e.target.value })}>
                                <option value="">All Companies</option>
                                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', backgroundColor: '#ec4899', borderColor: '#ec4899' }}>Download Excel</button>
                    </form>
                </div>

                {/* PAYROLL REGISTER */}
                <div className="card" style={{ gridColumn: '1 / -1', border: '2px solid #6366f1' }}>
                    <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #6366f1', paddingBottom: '0.5rem', color: '#6366f1' }}>📋 Payroll Register</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Comprehensive payroll export with employee details, attendance, leave, all pay elements, and salary breakdown. Only frozen months are available.</p>
                    <form onSubmit={handleDownloadRegister}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Payroll Month (Frozen Only)</label>
                                <select
                                    className="form-control"
                                    value={regFilter.month && regFilter.year ? `${regFilter.month}-${regFilter.year}` : ''}
                                    onChange={e => {
                                        const [mo, yr] = e.target.value.split('-');
                                        setRegFilter({ ...regFilter, month: parseInt(mo), year: parseInt(yr) });
                                    }}
                                >
                                    {frozenMonths.length === 0 ? (
                                        <option value="">No frozen months available</option>
                                    ) : (
                                        frozenMonths.map(fm => (
                                            <option key={`${fm.month}-${fm.year}`} value={`${fm.month}-${fm.year}`}>
                                                {monthNames[fm.month - 1]} {fm.year}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Company</label>
                                <select className="form-control" value={regFilter.company} onChange={e => setRegFilter({ ...regFilter, company: e.target.value })}>
                                    <option value="">All Companies</option>
                                    {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Location</label>
                                <select className="form-control" value={regFilter.location} onChange={e => setRegFilter({ ...regFilter, location: e.target.value })}>
                                    <option value="">All Locations</option>
                                    {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={frozenMonths.length === 0}
                                    style={{ width: '100%', backgroundColor: '#6366f1', borderColor: '#6366f1' }}
                                >
                                    Download Payroll Register
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
