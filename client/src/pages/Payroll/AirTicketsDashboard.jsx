import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getEmployees, updateAirTicketEligibility, consumeAirTicket } from '../../api/employeeApi';
import toast from 'react-hot-toast';

export default function AirTicketsDashboard() {
    const { user } = useAuth();
    const userRoleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const isHrOrAdmin = userRoleName === 'admin' || userRoleName === 'hr' || userRoleName === 'director';

    const [employees, setEmployees] = useState([]);
    const [myEmployeeData, setMyEmployeeData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Selection state for detail modals
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showEligibilityModal, setShowEligibilityModal] = useState(false);
    const [showConsumeModal, setShowConsumeModal] = useState(false);

    // Form states
    const [eligibilityForm, setEligibilityForm] = useState({
        applicable: false,
        frequency: 'Annual',
        class: 'Economy',
        destination: ''
    });

    const [consumeForm, setConsumeForm] = useState({
        bookingDate: new Date().toISOString().split('T')[0],
        flightDate: '',
        destination: '',
        bookingReference: '',
        ticketCost: '',
        remarks: ''
    });

    useEffect(() => {
        fetchData();
    }, [user]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await getEmployees();
            const list = res.data || res;
            setEmployees(list);

            // If employee, find their own record
            if (user?.employeeRef) {
                const selfId = user.employeeRef._id || user.employeeRef;
                const selfRecord = list.find(e => e._id === selfId);
                setMyEmployeeData(selfRecord);
            }
        } catch (error) {
            toast.error('Failed to load employee air ticket data');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEligibility = (emp) => {
        setSelectedEmployee(emp);
        setEligibilityForm({
            applicable: emp.airTicketEligibility?.applicable || false,
            frequency: emp.airTicketEligibility?.frequency || 'Annual',
            class: emp.airTicketEligibility?.class || 'Economy',
            destination: emp.airTicketEligibility?.destination || ''
        });
        setShowEligibilityModal(true);
    };

    const handleSaveEligibility = async (e) => {
        e.preventDefault();
        try {
            const res = await updateAirTicketEligibility(selectedEmployee._id, eligibilityForm);
            if (res.success) {
                toast.success('Air ticket eligibility updated');
                setShowEligibilityModal(false);
                fetchData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update eligibility');
        }
    };

    const handleOpenConsume = (emp) => {
        setSelectedEmployee(emp);
        setConsumeForm({
            bookingDate: new Date().toISOString().split('T')[0],
            flightDate: '',
            destination: emp.airTicketEligibility?.destination || '',
            bookingReference: '',
            ticketCost: '',
            remarks: ''
        });
        setShowConsumeModal(true);
    };

    const handleSaveConsume = async (e) => {
        e.preventDefault();
        try {
            const res = await consumeAirTicket(selectedEmployee._id, consumeForm);
            if (res.success) {
                toast.success('Air ticket consumption logged successfully');
                setShowConsumeModal(false);
                fetchData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to record flight log');
        }
    };

    if (loading) return <div className="page-loader"><div className="loader"></div></div>;

    const filteredEmployees = employees.filter(emp => {
        const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        const empId = (emp.employeeId || '').toLowerCase();
        const dept = (emp.department || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return fullName.includes(query) || empId.includes(query) || dept.includes(query);
    });

    const formatDate = (dateString) => {
        if (!dateString) return 'Never / Available';
        return new Date(dateString).toLocaleDateString('en-AE', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    // --- EMPLOYEE VIEW (SELF-SERVICE) ---
    if (!isHrOrAdmin) {
        if (!myEmployeeData) {
            return (
                <div>
                    <h1 className="page-title">✈️ Air Ticket Roster</h1>
                    <p className="page-subtitle">Your user profile is not linked to an employee account.</p>
                </div>
            );
        }

        const eligibility = myEmployeeData.airTicketEligibility || {};
        const history = myEmployeeData.airTicketsConsumed || [];

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                    <h1 className="page-title">✈️ My Annual Air Ticket Benefit</h1>
                    <p className="page-subtitle">View flights eligibility and tracking details</p>
                </div>

                <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    <div className="card">
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Allowance Summary</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <div><strong>Eligible for Air Ticket:</strong> {eligibility.applicable ? '✅ Yes (Included in contract)' : '❌ No'}</div>
                            {eligibility.applicable && (
                                <>
                                    <div><strong>Flight Frequency:</strong> {eligibility.frequency} ticket(s)</div>
                                    <div><strong>Class of Travel:</strong> {eligibility.class} Class</div>
                                    <div><strong>Home Country Airport:</strong> {eligibility.destination || 'Not Specified'}</div>
                                    <div><strong>Last Flight Taken Date:</strong> {formatDate(eligibility.lastTicketDate)}</div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="card" style={{ flex: 2 }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Travel & Booking History</h3>
                        {history.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No air tickets booked yet.</p>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Flight Date</th>
                                            <th>Destination</th>
                                            <th>Booking Ref</th>
                                            <th>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((ticket, i) => (
                                            <tr key={i}>
                                                <td>{formatDate(ticket.flightDate)}</td>
                                                <td>{ticket.destination}</td>
                                                <td><code>{ticket.bookingReference || '-'}</code></td>
                                                <td>{ticket.remarks || '-'}</td>
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

    // --- ADMIN / HR VIEW ---
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">✈️ Air Tickets Allocation & Logs</h1>
                    <p className="page-subtitle">Configure expat air ticket allowances and book flights for GCC payroll compliance.</p>
                </div>
            </div>

            {/* SEARCH */}
            <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.2rem' }}>🔍</span>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search employee by ID, Name, or Department..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ margin: 0 }}
                    />
                </div>
            </div>

            {/* DIRECTORY TABLE */}
            <div className="card" style={{ padding: 0, border: '1px solid var(--border-color)' }}>
                <div className="table-responsive">
                    <table className="table" style={{ margin: 0 }}>
                        <thead>
                            <tr>
                                <th>Emp ID</th>
                                <th>Employee</th>
                                <th>Applicable</th>
                                <th>Frequency & Class</th>
                                <th>Destination</th>
                                <th>Last Booking Date</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map(emp => {
                                const elig = emp.airTicketEligibility || {};
                                return (
                                    <tr key={emp._id}>
                                        <td><code>{emp.employeeId}</code></td>
                                        <td>
                                            <div style={{ fontWeight: '600' }}>{emp.firstName} {emp.lastName}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.department} • {emp.designation}</div>
                                        </td>
                                        <td>
                                            <span className={`badge ${elig.applicable ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                                                {elig.applicable ? 'Applicable' : 'Not Eligible'}
                                            </span>
                                        </td>
                                        <td>
                                            {elig.applicable ? `${elig.frequency} (${elig.class})` : '—'}
                                        </td>
                                        <td>{elig.destination || '—'}</td>
                                        <td>{formatDate(elig.lastTicketDate)}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button 
                                                    onClick={() => handleOpenEligibility(emp)} 
                                                    className="btn btn-secondary btn-outline" 
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                >
                                                    ⚙️ Configure
                                                </button>
                                                {elig.applicable && (
                                                    <button 
                                                        onClick={() => handleOpenConsume(emp)} 
                                                        className="btn btn-primary" 
                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                    >
                                                        ✈️ Consume Ticket
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL 1: CONFIGURE ELIGIBILITY */}
            {showEligibilityModal && selectedEmployee && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem', position: 'relative' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Configure Travel Eligibility: {selectedEmployee.firstName}
                        </h3>
                        <form onSubmit={handleSaveEligibility} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input 
                                    type="checkbox" 
                                    id="applicable" 
                                    checked={eligibilityForm.applicable} 
                                    onChange={(e) => setEligibilityForm({ ...eligibilityForm, applicable: e.target.checked })} 
                                />
                                <label htmlFor="applicable" className="form-label" style={{ margin: 0 }}>Expat Air Ticket Benefit Applicable</label>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Flight Frequency</label>
                                <select 
                                    className="form-control" 
                                    value={eligibilityForm.frequency} 
                                    onChange={(e) => setEligibilityForm({ ...eligibilityForm, frequency: e.target.value })}
                                >
                                    <option value="Annual">Annual Ticket (1 flight per year)</option>
                                    <option value="Bi-Annual">Bi-Annual Ticket (1 flight every 2 years)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Class of Travel</label>
                                <select 
                                    className="form-control" 
                                    value={eligibilityForm.class} 
                                    onChange={(e) => setEligibilityForm({ ...eligibilityForm, class: e.target.value })}
                                >
                                    <option value="Economy">Economy Class</option>
                                    <option value="Business">Business Class</option>
                                    <option value="First Class">First Class</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Home Country Destination Airport Code / City</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g. Cochin (COK) / Manila (MNL)" 
                                    value={eligibilityForm.destination} 
                                    onChange={(e) => setEligibilityForm({ ...eligibilityForm, destination: e.target.value })} 
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setShowEligibilityModal(false)} className="btn btn-secondary btn-outline">Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Settings</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: CONSUME / LOG TICKET */}
            {showConsumeModal && selectedEmployee && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem', position: 'relative' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Consume Air Ticket: {selectedEmployee.firstName}
                        </h3>
                        <form onSubmit={handleSaveConsume} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <div className="form-group">
                                <label className="form-label">Flight Date *</label>
                                <input 
                                    type="date" 
                                    className="form-control" 
                                    value={consumeForm.flightDate} 
                                    onChange={(e) => setConsumeForm({ ...consumeForm, flightDate: e.target.value })} 
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Booking Date</label>
                                <input 
                                    type="date" 
                                    className="form-control" 
                                    value={consumeForm.bookingDate} 
                                    onChange={(e) => setConsumeForm({ ...consumeForm, bookingDate: e.target.value })} 
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Flight Destination Airport *</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    value={consumeForm.destination} 
                                    onChange={(e) => setConsumeForm({ ...consumeForm, destination: e.target.value })} 
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Booking Reference / PNR</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g. EK5D2L" 
                                    value={consumeForm.bookingReference} 
                                    onChange={(e) => setConsumeForm({ ...consumeForm, bookingReference: e.target.value })} 
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ticket Cost (AED)</label>
                                <input 
                                    type="number" 
                                    className="form-control" 
                                    placeholder="e.g. 1500" 
                                    value={consumeForm.ticketCost} 
                                    onChange={(e) => setConsumeForm({ ...consumeForm, ticketCost: e.target.value })} 
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Remarks / Description</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g. Annual leave flight ticket Kochi" 
                                    value={consumeForm.remarks} 
                                    onChange={(e) => setConsumeForm({ ...consumeForm, remarks: e.target.value })} 
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setShowConsumeModal(false)} className="btn btn-secondary btn-outline">Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }}>Book Flight Log</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
