import { useState, useEffect } from 'react';
import { 
    downloadAttendanceReport, 
    downloadPayrollReport, 
    downloadEmployeeReport, 
    downloadAppraisalReport, 
    downloadTravelReport, 
    downloadLeaveReport,
    getReportPreview
} from '../../api/reportApi';
import { masterAPI } from '../../api';
import toast from 'react-hot-toast';

export default function ReportsDashboard() {
    const [companies, setCompanies] = useState([]);
    const [locations, setLocations] = useState([]);
    const [activeTab, setActiveTab] = useState('masters'); // 'masters', 'attendance', 'leave', 'payroll', 'appraisal'
    const [masterType, setMasterType] = useState('company'); // 'company', 'location', 'holiday', 'payelement', 'leave', 'employee'
    
    // Unified filter state
    const [filters, setFilters] = useState({
        fromDate: '',
        toDate: '',
        company: '',
        location: '',
        department: '',
        isActive: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        cycle: '',
        leaveType: '',
        search: ''
    });

    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);

    useEffect(() => {
        const fetchFiltersData = async () => {
            try {
                const [cRes, lRes] = await Promise.all([masterAPI.getCompanies(), masterAPI.getLocations()]);
                setCompanies(cRes.data?.data || []);
                setLocations(lRes.data?.data || []);
            } catch (err) {
                toast.error('Failed to load filter options');
            }
        };
        fetchFiltersData();
    }, []);

    // Automatically load data when switching tabs or master types
    useEffect(() => {
        fetchPreviewData();
    }, [activeTab, masterType]);

    const fetchPreviewData = async () => {
        setLoading(true);
        try {
            const queryParams = {
                type: activeTab,
                masterType,
                ...filters
            };
            const response = await getReportPreview(queryParams);
            if (response.data?.success) {
                setReportData(response.data.data || []);
            } else {
                setReportData([]);
            }
        } catch (error) {
            console.error('Failed to fetch report preview:', error);
            const errMsg = error.response?.data?.message || error.response?.statusText || error.message || 'Failed to fetch report preview data';
            toast.error(`Reporting Error: ${errMsg}`);
            setReportData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyFilters = (e) => {
        if (e) e.preventDefault();
        fetchPreviewData();
    };

    const handleDownloadReport = async () => {
        try {
            toast.loading('Preparing download...', { id: 'report-download' });
            if (activeTab === 'attendance') {
                await downloadAttendanceReport(filters);
            } else if (activeTab === 'payroll') {
                await downloadPayrollReport(filters);
            } else if (activeTab === 'leave') {
                await downloadLeaveReport(filters);
            } else if (activeTab === 'appraisal') {
                await downloadAppraisalReport(filters);
            } else if (activeTab === 'masters') {
                if (masterType === 'employee') {
                    await downloadEmployeeReport(filters);
                } else {
                    toast.error('Direct download is only supported for Employee Master. Please copy master details from the table grid below.', { id: 'report-download' });
                    return;
                }
            }
            toast.success('Report downloaded successfully!', { id: 'report-download' });
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download report', { id: 'report-download' });
        }
    };

    const handleResetFilters = () => {
        setFilters({
            fromDate: '',
            toDate: '',
            company: '',
            location: '',
            department: '',
            isActive: '',
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            cycle: '',
            leaveType: '',
            search: ''
        });
    };

    // Columns configuration based on selected active tab and masterType
    const renderTableHeaders = () => {
        if (activeTab === 'attendance') {
            return (
                <tr>
                    <th>Emp ID</th>
                    <th>Name</th>
                    <th>Dept</th>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours</th>
                    <th>Late (m)</th>
                    <th>OT (h)</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Exceptions / Warnings</th>
                </tr>
            );
        }
        if (activeTab === 'payroll') {
            return (
                <tr>
                    <th>Emp ID</th>
                    <th>Name</th>
                    <th>Dept</th>
                    <th>Gross Pay (AED)</th>
                    <th>Deductions (AED)</th>
                    <th>Net Pay (AED)</th>
                    <th>Bank Name</th>
                    <th>IBAN / Account Number</th>
                    <th>Status</th>
                </tr>
            );
        }
        if (activeTab === 'leave') {
            return (
                <tr>
                    <th>Emp ID</th>
                    <th>Name</th>
                    <th>Dept</th>
                    <th>Leave Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Duration (Days)</th>
                    <th>Reason</th>
                    <th>Status</th>
                </tr>
            );
        }
        if (activeTab === 'appraisal') {
            return (
                <tr>
                    <th>Emp ID</th>
                    <th>Name</th>
                    <th>Reviewer</th>
                    <th>Year</th>
                    <th>Cycle</th>
                    <th>Self Rating</th>
                    <th>Manager Rating</th>
                    <th>Final Rating</th>
                    <th>Status</th>
                </tr>
            );
        }
        if (activeTab === 'masters') {
            if (masterType === 'company') {
                return (
                    <tr>
                        <th>Company Name</th>
                        <th>Trade License No</th>
                        <th>WPS Sponsor ID</th>
                        <th>Open Attendance Mode</th>
                    </tr>
                );
            }
            if (masterType === 'location') {
                return (
                    <tr>
                        <th>Location Name</th>
                        <th>Map Coordinates (Lat, Lng)</th>
                        <th>Geofence Circle Radius</th>
                    </tr>
                );
            }
            if (masterType === 'holiday') {
                return (
                    <tr>
                        <th>Holiday Name</th>
                        <th>Date</th>
                        <th>Holiday Type</th>
                    </tr>
                );
            }
            if (masterType === 'payelement') {
                return (
                    <tr>
                        <th>Element Name</th>
                        <th>Element Type</th>
                        <th>Description</th>
                    </tr>
                );
            }
            if (masterType === 'leave') {
                return (
                    <tr>
                        <th>Leave Type Name</th>
                        <th>Quota Limit</th>
                        <th>Pay Structure</th>
                    </tr>
                );
            }
            if (masterType === 'employee') {
                return (
                    <tr>
                        <th>Emp ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Dept</th>
                        <th>Designation</th>
                        <th>Company</th>
                        <th>Location</th>
                        <th>Basic Salary (AED)</th>
                        <th>Status</th>
                    </tr>
                );
            }
        }
        return null;
    };

    const renderTableRows = () => {
        if (reportData.length === 0) {
            return (
                <tr>
                    <td colSpan={15} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        No records found matching filters.
                    </td>
                </tr>
            );
        }

        return reportData.map((row, index) => {
            if (activeTab === 'attendance') {
                const dateStr = row.date ? new Date(row.date).toLocaleDateString() : '-';
                const checkInStr = row.checkIn ? new Date(row.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                const checkOutStr = row.checkOut ? new Date(row.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
                const isOutOfFence = row.warning && row.warning !== '-';

                return (
                    <tr key={index}>
                        <td><code>{row.employeeId}</code></td>
                        <td style={{ fontWeight: '600' }}>{row.name}</td>
                        <td>{row.department}</td>
                        <td>{dateStr}</td>
                        <td>{checkInStr}</td>
                        <td>{checkOutStr}</td>
                        <td>{row.totalHours} hrs</td>
                        <td>{row.late}</td>
                        <td>{row.overtime}</td>
                        <td>
                            <span className={`badge ${row.status === 'Present' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                                {row.status}
                            </span>
                        </td>
                        <td>{row.source}</td>
                        <td>
                            {isOutOfFence ? (
                                <span style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.8rem' }}>
                                    ⚠️ {row.warning}
                                </span>
                            ) : (
                                <span style={{ color: '#10b981', fontSize: '0.8rem' }}>Verified ✓</span>
                            )}
                        </td>
                    </tr>
                );
            }
            if (activeTab === 'payroll') {
                return (
                    <tr key={index}>
                        <td><code>{row.employeeId}</code></td>
                        <td style={{ fontWeight: '600' }}>{row.name}</td>
                        <td>{row.department}</td>
                        <td>{row.grossPay.toLocaleString()}</td>
                        <td>{row.totalDeductions.toLocaleString()}</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary-400)' }}>{row.netPay.toLocaleString()}</td>
                        <td>{row.bankName}</td>
                        <td><code>{row.iban}</code></td>
                        <td>
                            <span className={`badge ${row.status === 'Paid' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem' }}>
                                {row.status}
                            </span>
                        </td>
                    </tr>
                );
            }
            if (activeTab === 'leave') {
                return (
                    <tr key={index}>
                        <td><code>{row.employeeId}</code></td>
                        <td style={{ fontWeight: '600' }}>{row.name}</td>
                        <td>{row.department}</td>
                        <td>{row.leaveType}</td>
                        <td>{new Date(row.startDate).toLocaleDateString()}</td>
                        <td>{new Date(row.endDate).toLocaleDateString()}</td>
                        <td>{row.duration} Days</td>
                        <td style={{ fontStyle: 'italic', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.reason}>"{row.reason || '-'}"</td>
                        <td>
                            <span className={`badge ${row.status === 'Approved' ? 'badge-success' : row.status === 'Pending' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                                {row.status}
                            </span>
                        </td>
                    </tr>
                );
            }
            if (activeTab === 'appraisal') {
                return (
                    <tr key={index}>
                        <td><code>{row.employeeId}</code></td>
                        <td style={{ fontWeight: '600' }}>{row.name}</td>
                        <td>{row.reviewer}</td>
                        <td>{row.year}</td>
                        <td>{row.cycle}</td>
                        <td>{row.selfRating}</td>
                        <td>{row.managerRating}</td>
                        <td style={{ fontWeight: 'bold' }}>{row.finalRating}</td>
                        <td>
                            <span className={`badge ${row.status === 'Completed' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem' }}>
                                {row.status}
                            </span>
                        </td>
                    </tr>
                );
            }
            if (activeTab === 'masters') {
                if (masterType === 'company') {
                    return (
                        <tr key={index}>
                            <td style={{ fontWeight: '600' }}>{row.name}</td>
                            <td>{row.tradeLicense}</td>
                            <td>{row.wpsSponsorId}</td>
                            <td>{row.allowOpenAttendance}</td>
                        </tr>
                    );
                }
                if (masterType === 'location') {
                    return (
                        <tr key={index}>
                            <td style={{ fontWeight: '600' }}>{row.name}</td>
                            <td><code>{row.coordinates}</code></td>
                            <td>{row.radius}</td>
                        </tr>
                    );
                }
                if (masterType === 'holiday') {
                    return (
                        <tr key={index}>
                            <td style={{ fontWeight: '600' }}>{row.name}</td>
                            <td>{new Date(row.date).toLocaleDateString()}</td>
                            <td>{row.type}</td>
                        </tr>
                    );
                }
                if (masterType === 'payelement') {
                    return (
                        <tr key={index}>
                            <td style={{ fontWeight: '600' }}>{row.name}</td>
                            <td>
                                <span className={`badge ${row.type === 'Earning' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                                    {row.type}
                                </span>
                            </td>
                            <td>{row.description}</td>
                        </tr>
                    );
                }
                if (masterType === 'leave') {
                    return (
                        <tr key={index}>
                            <td style={{ fontWeight: '600' }}>{row.name}</td>
                            <td>{row.quota}</td>
                            <td>{row.payType}</td>
                        </tr>
                    );
                }
                if (masterType === 'employee') {
                    return (
                        <tr key={index}>
                            <td><code>{row.employeeId}</code></td>
                            <td style={{ fontWeight: '600' }}>{row.name}</td>
                            <td>{row.email}</td>
                            <td>{row.phone}</td>
                            <td>{row.department}</td>
                            <td>{row.designation}</td>
                            <td>{row.company}</td>
                            <td>{row.location}</td>
                            <td>AED {row.basicSalary?.toLocaleString()}</td>
                            <td>
                                <span className={`badge ${row.status === 'Active' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                                    {row.status}
                                </span>
                            </td>
                        </tr>
                    );
                }
            }
            return null;
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">HR & Operations Reporting Dashboard</h1>
                    <p className="page-subtitle">Interact, filter, and extract operational analytics and master data reports on screen.</p>
                </div>
                <button 
                    onClick={handleDownloadReport} 
                    className="btn btn-primary" 
                    style={{ background: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}
                    disabled={loading || (activeTab === 'masters' && masterType !== 'employee' && masterType !== 'company' && masterType !== 'location')}
                >
                    📥 Export Filtered Excel
                </button>
            </div>

            {/* TAB SELECTOR */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', gap: '1rem', overflowX: 'auto' }}>
                {[
                    { id: 'masters', label: '🗂️ Master Configurations' },
                    { id: 'attendance', label: '📅 Attendance Registers' },
                    { id: 'leave', label: '✈️ Leave Applications' },
                    { id: 'payroll', label: '💰 Payroll Sheets' },
                    { id: 'appraisal', label: '📈 Performance Appraisals' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '0.8rem 1.2rem',
                            border: 'none',
                            background: 'none',
                            color: activeTab === tab.id ? 'var(--primary-400)' : 'var(--text-secondary)',
                            fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                            borderBottom: activeTab === tab.id ? '3px solid var(--primary-500)' : '3px solid transparent',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease-in-out'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* FILTER CONTROLS GRID */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <form onSubmit={handleApplyFilters} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        {activeTab === 'masters' && (
                            <div className="form-group">
                                <label className="form-label">Select Master Category</label>
                                <select 
                                    className="form-control" 
                                    value={masterType} 
                                    onChange={e => setMasterType(e.target.value)}
                                >
                                    <option value="company">Company Master</option>
                                    <option value="location">Location Master</option>
                                    <option value="leave">Leave Types Configuration</option>
                                    <option value="holiday">Holidays List</option>
                                    <option value="payelement">Pay Elements List</option>
                                    <option value="employee">Employees Directory</option>
                                </select>
                            </div>
                        )}

                        {/* Company Filter (supported in almost all categories) */}
                        {masterType !== 'leave' && masterType !== 'holiday' && masterType !== 'payelement' && (
                            <div className="form-group">
                                <label className="form-label">Company Structure</label>
                                <select 
                                    className="form-control" 
                                    value={filters.company} 
                                    onChange={e => setFilters({ ...filters, company: e.target.value })}
                                >
                                    <option value="">All Companies</option>
                                    {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Location Filter */}
                        {(activeTab === 'attendance' || activeTab === 'payroll' || masterType === 'employee') && (
                            <div className="form-group">
                                <label className="form-label">Branch Location</label>
                                <select 
                                    className="form-control" 
                                    value={filters.location} 
                                    onChange={e => setFilters({ ...filters, location: e.target.value })}
                                >
                                    <option value="">All Locations</option>
                                    {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Date Range Inputs */}
                        {(activeTab === 'attendance' || activeTab === 'leave') && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">From Date</label>
                                    <input 
                                        type="date" 
                                        className="form-control" 
                                        value={filters.fromDate} 
                                        onChange={e => setFilters({ ...filters, fromDate: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">To Date</label>
                                    <input 
                                        type="date" 
                                        className="form-control" 
                                        value={filters.toDate} 
                                        onChange={e => setFilters({ ...filters, toDate: e.target.value })} 
                                    />
                                </div>
                            </>
                        )}

                        {/* Payroll processing month and year */}
                        {activeTab === 'payroll' && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Processing Month</label>
                                    <select 
                                        className="form-control" 
                                        value={filters.month} 
                                        onChange={e => setFilters({ ...filters, month: e.target.value })}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Processing Year</label>
                                    <input 
                                        type="number" 
                                        className="form-control" 
                                        value={filters.year} 
                                        onChange={e => setFilters({ ...filters, year: e.target.value })} 
                                    />
                                </div>
                            </>
                        )}

                        {/* Appraisal cycles */}
                        {activeTab === 'appraisal' && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Performance Year</label>
                                    <input 
                                        type="number" 
                                        className="form-control" 
                                        value={filters.year} 
                                        onChange={e => setFilters({ ...filters, year: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cycle</label>
                                    <select 
                                        className="form-control" 
                                        value={filters.cycle} 
                                        onChange={e => setFilters({ ...filters, cycle: e.target.value })}
                                    >
                                        <option value="">All Cycles</option>
                                        <option value="H1">H1 (First Half)</option>
                                        <option value="H2">H2 (Second Half)</option>
                                        <option value="Annual">Annual</option>
                                    </select>
                                </div>
                            </>
                        )}

                        {/* Leave Type Filter */}
                        {activeTab === 'leave' && (
                            <div className="form-group">
                                <label className="form-label">Leave Type</label>
                                <select 
                                    className="form-control" 
                                    value={filters.leaveType} 
                                    onChange={e => setFilters({ ...filters, leaveType: e.target.value })}
                                >
                                    <option value="">All Types</option>
                                    <option value="Annual">Annual</option>
                                    <option value="Sick">Sick</option>
                                    <option value="Unpaid">Unpaid</option>
                                    <option value="Maternity">Maternity</option>
                                    <option value="Paternity">Paternity</option>
                                </select>
                            </div>
                        )}

                        {/* Text search filter */}
                        {activeTab !== 'masters' && (
                            <div className="form-group">
                                <label className="form-label">Department</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g. IT, Operations" 
                                    value={filters.department} 
                                    onChange={e => setFilters({ ...filters, department: e.target.value })} 
                                />
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                        <button 
                            type="button" 
                            onClick={handleResetFilters} 
                            className="btn btn-secondary btn-outline"
                        >
                            Reset Filters
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Querying Data...' : 'Apply Filters & Preview'}
                        </button>
                    </div>
                </form>
            </div>

            {/* DATA GRID TABLE PREVIEW */}
            <div className="card" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--border-color)' }}>
                <table className="table" style={{ width: '100%', margin: 0, borderCollapse: 'collapse' }}>
                    <thead>
                        {renderTableHeaders()}
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={15} style={{ textAlign: 'center', padding: '3rem' }}>
                                    <div style={{ color: 'var(--primary-400)', fontWeight: 'bold' }}>Loading report database records...</div>
                                </td>
                            </tr>
                        ) : (
                            renderTableRows()
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
