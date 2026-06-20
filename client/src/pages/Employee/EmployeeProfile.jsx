import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEmployeeById, confirmEmployeeProbation } from '../../api/employeeApi';
import { authAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function EmployeeProfile() {
    const { id } = useParams();
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('personal');

    const { user } = useAuth();
    const userRoleName = typeof user?.role === 'string' ? user.role : user?.role?.name;

    // Check if the current user is looking at their own profile
    const isOwnProfile = user?.employeeRef && (user.employeeRef._id === id || user.employeeRef === id);

    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [changingPassword, setChangingPassword] = useState(false);

    const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');

    useEffect(() => {
        fetchEmployee();
    }, [id]);

    const fetchEmployee = async () => {
        try {
            const res = await getEmployeeById(id);
            setEmployee(res.data);
        } catch (error) {
            toast.error('Failed to load employee profile');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-loader"><div className="loader"></div></div>;
    if (!employee) return <div>Employee not found</div>;

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-AE', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            return toast.error("New passwords don't match");
        }

        try {
            setChangingPassword(true);
            await authAPI.changePassword({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            toast.success('Password changed successfully');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to change password');
        } finally {
            setChangingPassword(false);
        }
    };

    const handleConfirmProbation = async () => {
        if (!window.confirm(`Are you sure you want to officially confirm ${employee.firstName}'s probation? This cannot be easily undone.`)) return;

        try {
            await confirmEmployeeProbation(employee._id);
            toast.success(`${employee.firstName}'s probation has been confirmed!`);
            fetchEmployee(); // Refresh data
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to confirm probation');
        }
    };

    return (
        <div className="employee-profile-page">
            {/* Header Card */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem' }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: employee.profilePhoto ? 'transparent' : 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold', overflow: 'hidden', border: employee.profilePhoto ? '3px solid var(--primary-400)' : 'none', flexShrink: 0 }}>
                    {employee.profilePhoto ? (
                        <img src={`${API_URL}${employee.profilePhoto}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <>{employee.firstName.charAt(0)}{employee.lastName.charAt(0)}</>
                    )}
                </div>
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{employee.firstName} {employee.lastName}</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 1rem 0' }}>{employee.designation} • {employee.department} • {employee.email}</p>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span className="badge" style={{ background: 'var(--bg-tertiary)' }}>ID: {employee.employeeId}</span>
                        <span className={`badge ${employee.isActive ? 'badge-success' : 'badge-danger'}`}>
                            {employee.isActive ? 'Active Employee' : 'Inactive'}
                        </span>
                        {employee.onboardingStatus === 'Pending' && (
                            <span className="badge badge-warning">Onboarding: Pending</span>
                        )}
                        {employee.isProbationActive ? (
                            <span className="badge badge-danger" title={`Probation ends: ${formatDate(employee.probationEndDate)}`}>Probation Active</span>
                        ) : (
                            <span className="badge badge-success">Permanent / Confirmed</span>
                        )}
                    </div>
                </div>
                {(userRoleName === 'admin' || userRoleName === 'hr') && (
                    <div>
                        <Link to={`/employees/${employee._id}/edit`} className="btn btn-primary btn-outline">Edit Profile / Photo</Link>
                    </div>
                )}
            </div>

            {/* Tabs Navigation */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                {['personal', 'employment', 'salary', 'documents', ...(isOwnProfile ? ['security'] : [])].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: '1rem 2rem',
                            color: activeTab === tab ? 'var(--primary-color)' : 'var(--text-secondary)',
                            borderBottom: activeTab === tab ? '3px solid var(--primary-color)' : '3px solid transparent',
                            fontWeight: activeTab === tab ? '600' : 'normal',
                            cursor: 'pointer',
                            textTransform: 'capitalize'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="card">
                {activeTab === 'personal' && (
                    <div className="profile-grid">
                        <ProfileItem label="Email" value={employee.email} />
                        <ProfileItem label="Phone" value={employee.phone} />
                        <ProfileItem label="Date of Birth" value={formatDate(employee.dob)} />
                        <ProfileItem label="Gender" value={employee.gender} />
                        <ProfileItem label="Nationality" value={employee.nationality} />
                        <ProfileItem label="Marital Status" value={employee.maritalStatus} />
                    </div>
                )}

                {activeTab === 'employment' && (
                    <div className="profile-grid">
                        <ProfileItem label="Date of Joining" value={formatDate(employee.dateOfJoining)} />
                        <ProfileItem label="Contract Type" value={employee.contractType} />
                        <ProfileItem label="MOHRE Contract" value={employee.molContractType} />
                        <ProfileItem label="Probation End" value={formatDate(employee.probationEndDate)} />
                        <ProfileItem label="Leave Policy" value={employee.leavePolicy} />

                        <div style={{ gridColumn: '1 / -1', margin: '1.5rem 0 0 0', padding: '1.5rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>Probation Status</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {employee.isProbationActive ? 'This employee is currently under probation. Leave applications may deduct from their monthly salary.' : 'This employee has completed probation and is confirmed as permanent staff.'}
                                </p>
                            </div>
                            {employee.isProbationActive && (userRoleName === 'admin' || userRoleName === 'hr') && (
                                <button
                                    onClick={handleConfirmProbation}
                                    className="btn btn-primary"
                                    style={{ background: '#10b981', borderColor: '#10b981' }}
                                >
                                    Confirm Probation
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'salary' && (
                    <div className="profile-grid">
                        <ProfileItem label="Basic Salary" value={`AED ${employee.basicSalary?.toLocaleString()}`} />
                        {employee.payElements && employee.payElements.map((pe, index) => (
                            <ProfileItem key={index} label={pe.element?.name || 'Allowance'} value={`AED ${pe.amount?.toLocaleString()}`} />
                        ))}

                        <div style={{ gridColumn: '1 / -1', margin: '1rem 0', borderTop: '1px solid var(--border-color)' }}></div>

                        <ProfileItem label="Bank Name" value={employee.bankName} />
                        <ProfileItem label="IBAN" value={employee.iban} />
                        <ProfileItem label="WPS Agent Code" value={employee.wpsAgentCode} />
                    </div>
                )}

                {activeTab === 'documents' && (
                    <div>
                        <div className="profile-grid" style={{ marginBottom: '2rem' }}>
                            <ProfileItem label="Visa Type" value={employee.visaType} />
                            <ProfileItem label="Visa Expiry" value={formatDate(employee.visaExpiry)} />
                            <ProfileItem label="Emirates ID No." value={employee.emiratesId} />
                            <ProfileItem label="Passport No." value={employee.passportNo} />
                            <ProfileItem label="Passport Expiry" value={formatDate(employee.passportExpiry)} />
                        </div>

                        <h3 style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>Uploaded Files</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                            {['passport', 'visa', 'emiratesIdDoc', 'contract'].map(doc => {
                                const url = employee.documents?.[doc];
                                if (!url) return null;
                                return (
                                    <a key={doc} href={`${API_URL}${url}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-outline" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', textDecoration: 'none' }}>
                                        <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</span>
                                        <span style={{ textTransform: 'capitalize' }}>{doc.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'security' && isOwnProfile && (
                    <div style={{ maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Change Account Password</h3>
                        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <div className="form-group">
                                <label className="form-label">Current Password</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">New Password</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    required
                                    minLength="6"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Confirm New Password</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    required
                                />
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                                <button type="submit" className="btn btn-primary" disabled={changingPassword}>
                                    {changingPassword ? 'Updating...' : 'Change Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper component
function ProfileItem({ label, value }) {
    return (
        <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: 'var(--text-primary)' }}>{value || '—'}</div>
        </div>
    );
}
