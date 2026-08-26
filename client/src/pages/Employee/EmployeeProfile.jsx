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

    // ID Card Print Configuration states
    const [showPrintConfigModal, setShowPrintConfigModal] = useState(false);
    const [cardConfig, setCardConfig] = useState({
        emergencyContactName: '',
        emergencyContactPhone: '',
        bloodGroup: '',
        issueDate: new Date().toISOString().split('T')[0],
        customTerms: ''
    });

    const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');

    useEffect(() => {
        fetchEmployee();
    }, [id]);

    const fetchEmployee = async () => {
        try {
            const res = await getEmployeeById(id);
            const emp = res.data;
            setEmployee(emp);

            setCardConfig({
                emergencyContactName: emp.emergencyContact?.name || '',
                emergencyContactPhone: emp.emergencyContact?.phone || emp.phone || '',
                bloodGroup: emp.bloodGroup || '—',
                issueDate: new Date().toISOString().split('T')[0],
                customTerms: `This card is the property of ${emp.company?.name || 'JTS Group'} and is non-transferable. It must be worn at all times while on duty and presented upon request. If found, please return to HR.`
            });
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

    const handlePrintCard = () => {
        const printWindow = window.open('', '_blank', 'width=700,height=900');
        const bioId = employee.biometricMappings?.[0]?.biometricId || employee.employeeId;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${employee.employeeId}`;
        const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${bioId}&scale=2&rotate=N&includetext`;
        
        const companyName = employee.company?.name || 'JTS Group';
        const companyTagline = employee.company?.tagline || 'EMPLOYEE IDENTITY CARD';
        const companyLogo = employee.company?.logo ? `${API_URL}${employee.company.logo}` : '';
        const photoUrl = employee.profilePhoto ? `${API_URL}${employee.profilePhoto}` : '';

        printWindow.document.write(`
            <html>
            <head>
                <title>Print ID Card - ${employee.firstName} ${employee.lastName}</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 25px;
                        margin: 40px 0;
                        background: #f3f4f6;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .card-container {
                        display: flex;
                        gap: 40px;
                        flex-wrap: wrap;
                        justify-content: center;
                    }
                    .id-card {
                        width: 53.98mm;
                        height: 85.6mm;
                        border: 1px solid #d1d5db;
                        border-radius: 12px;
                        background: #ffffff;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        position: relative;
                        box-sizing: border-box;
                    }
                    .header {
                        background: linear-gradient(135deg, #1e3a8a, #3b82f6);
                        color: #ffffff;
                        padding: 8px 10px;
                        text-align: center;
                        height: 60px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                    }
                    .header .company-logo {
                        max-height: 22px;
                        max-width: 85%;
                        object-fit: contain;
                        margin-bottom: 2px;
                    }
                    .header .company-name {
                        font-size: 11px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin: 0;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 90%;
                    }
                    .header .tagline {
                        font-size: 6.5px;
                        opacity: 0.85;
                        margin: 2px 0 0 0;
                        letter-spacing: 0.3px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 95%;
                    }
                    .badge-holder {
                        width: 100%;
                        height: 4px;
                        background: #f59e0b;
                    }
                    .photo-container {
                        margin: 12px auto 6px auto;
                        width: 68px;
                        height: 68px;
                        border-radius: 50%;
                        border: 2px solid #3b82f6;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #f3f4f6;
                    }
                    .photo-container img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    .photo-placeholder {
                        font-size: 24px;
                        font-weight: bold;
                        color: #3b82f6;
                        background: #eff6ff;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .details {
                        text-align: center;
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        padding: 0 10px;
                    }
                    .name {
                        font-size: 13px;
                        font-weight: 700;
                        color: #111827;
                        margin: 0 0 3px 0;
                        text-transform: capitalize;
                    }
                    .designation {
                        font-size: 8.5px;
                        font-weight: 600;
                        color: #4b5563;
                        margin: 0;
                    }
                    .department {
                        font-size: 7.5px;
                        color: #9ca3af;
                        margin: 1px 0 0 0;
                        text-transform: uppercase;
                    }
                    .emp-id-badge {
                        background: #eff6ff;
                        border: 1px solid #bfdbfe;
                        color: #1d4ed8;
                        font-size: 8px;
                        font-family: monospace;
                        font-weight: bold;
                        padding: 1px 6px;
                        border-radius: 9999px;
                        width: fit-content;
                        margin: 6px auto 0 auto;
                    }
                    .barcode-container {
                        margin-top: auto;
                        padding-bottom: 10px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .barcode-container img {
                        max-width: 85%;
                        height: 25px;
                    }
                    .back-side {
                        padding: 15px 12px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        height: 100%;
                        box-sizing: border-box;
                    }
                    .back-header {
                        font-size: 9px;
                        font-weight: bold;
                        color: #1e3a8a;
                        text-transform: uppercase;
                        border-bottom: 1px solid #e5e7eb;
                        padding-bottom: 4px;
                        margin-bottom: 8px;
                    }
                    .terms {
                        font-size: 7.5px;
                        color: #4b5563;
                        line-height: 1.35;
                        text-align: justify;
                        margin: 0;
                    }
                    .qr-container {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        margin: 8px 0;
                    }
                    .qr-container img {
                        width: 55px;
                        height: 55px;
                    }
                    .contact-info {
                        font-size: 7.5px;
                        color: #374151;
                        border-top: 1px solid #e5e7eb;
                        padding-top: 6px;
                    }
                    .contact-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 3px;
                    }
                    .emergency {
                        font-weight: bold;
                        color: #dc2626;
                    }
                    .print-btn {
                        background: #2563eb;
                        color: #ffffff;
                        border: none;
                        padding: 10px 24px;
                        font-size: 14px;
                        font-weight: bold;
                        border-radius: 6px;
                        cursor: pointer;
                        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
                    }
                    @media print {
                        body {
                            background: none;
                            margin: 0;
                            padding: 0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .print-btn {
                            display: none;
                        }
                        .card-container {
                            display: block;
                        }
                        .id-card {
                            box-shadow: none;
                            border: 1px solid #9ca3af;
                            margin: 0 auto;
                        }
                        .id-card-page {
                            page-break-after: always;
                            break-after: page;
                        }
                    }
                </style>
            </head>
            <body>
                <button class="print-btn" onclick="window.print()">🪪 Print ID Cards</button>
                <div class="card-container">
                    <!-- FRONT SIDE -->
                    <div class="id-card id-card-page">
                        <div class="header">
                            ${companyLogo ? `<img class="company-logo" src="${companyLogo}" alt="Logo" />` : ''}
                            <h1 class="company-name">${companyName}</h1>
                            <div class="tagline">${companyTagline}</div>
                        </div>
                        <div class="badge-holder"></div>
                        <div class="photo-container">
                            ${photoUrl ? `<img src="${photoUrl}" alt="Photo" />` : `<span class="photo-placeholder">${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}</span>`}
                        </div>
                        <div class="details">
                            <h2 class="name">${employee.firstName} ${employee.lastName}</h2>
                            <p class="designation">${employee.designation}</p>
                            <p class="department">${employee.department}</p>
                            <div class="emp-id-badge">ID: ${employee.employeeId}</div>
                        </div>
                        <div class="barcode-container">
                            <img src="${barcodeUrl}" alt="Barcode" />
                        </div>
                    </div>

                    <!-- BACK SIDE -->
                    <div class="id-card">
                        <div class="back-side">
                            <div>
                                <div class="back-header">Terms & Conditions</div>
                                <p class="terms">${cardConfig.customTerms}</p>
                            </div>
                            <div class="qr-container">
                                <img src="${qrUrl}" alt="QR Profile Link" />
                            </div>
                            <div class="contact-info">
                                <div class="contact-row">
                                    <span><strong>Emergency Name:</strong></span>
                                    <span>${cardConfig.emergencyContactName || '—'}</span>
                                </div>
                                <div class="contact-row">
                                    <span><strong>Emergency Phone:</strong></span>
                                    <span>${cardConfig.emergencyContactPhone || '—'}</span>
                                </div>
                                <div class="contact-row">
                                    <span><strong>Blood Group:</strong></span>
                                    <span>${cardConfig.bloodGroup || '—'}</span>
                                </div>
                                <div class="contact-row">
                                    <span><strong>Card Issue Date:</strong></span>
                                    <span>${cardConfig.issueDate}</span>
                                </div>
                                <div class="contact-row emergency">
                                    <span><strong>Biometric ID:</strong></span>
                                    <span>${bioId}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
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
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setShowPrintConfigModal(true)} className="btn btn-secondary btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🪪 Print ID Card</button>
                    {(userRoleName === 'admin' || userRoleName === 'hr') && (
                        <Link to={`/employees/${employee._id}/edit`} className="btn btn-primary btn-outline">Edit Profile / Photo</Link>
                    )}
                </div>
            </div>

            {/* Tabs Navigation */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                {['personal', 'employment', 'qualifications', 'geofencing', 'salary', 'documents', ...(isOwnProfile ? ['security'] : [])].map(tab => (
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
                        {tab === 'geofencing' ? 'Geo-Fencing & Biometrics' : tab}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="card">
                {activeTab === 'geofencing' && (
                    <div>
                        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Biometric & Geo-Fencing Configuration</h3>
                        
                        <div style={{ marginBottom: '2rem' }}>
                            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent-500)' }}>Biometric Device Mappings</h4>
                            {(!employee.biometricMappings || employee.biometricMappings.length === 0) ? (
                                <p style={{ color: 'var(--text-secondary)' }}>No biometric device mappings configured.</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                    {employee.biometricMappings.map((m, i) => (
                                        <div key={i} style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Device Name / Serial</p>
                                            <p style={{ margin: '0 0 1rem 0', fontWeight: '600' }}>{m.deviceName || 'Any Device (*)'}</p>
                                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Biometric User ID</p>
                                            <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary-400)' }}>{m.biometricId}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent-500)' }}>Geo-Fencing Settings</h4>
                            <div style={{ marginBottom: '1rem' }}>
                                <ProfileItem label="Geo-Fencing Status" value={employee.geoFencing?.enabled ? '✅ Enabled (Restricted to allowed zones)' : '❌ Disabled (No punch area restrictions)'} />
                            </div>
                            {employee.geoFencing?.enabled && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                                    <h5 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0, borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem' }}>Allowed Punch Zones</h5>
                                    {(!employee.geoFencing.allowedFences || employee.geoFencing.allowedFences.length === 0) ? (
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No allowed zones configured.</p>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                            {employee.geoFencing.allowedFences.map((f, i) => (
                                                <div key={i} style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                        <span className="badge" style={{ background: 'var(--primary-900)', color: 'var(--primary-200)', fontSize: '0.75rem' }}>
                                                            {f.fenceType === 'LocationMaster' ? 'Branch Location' : 'Custom GPS'}
                                                        </span>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--primary-400)', fontWeight: 'bold' }}>Radius: {f.radius || 100}m</span>
                                                    </div>
                                                    <h5 style={{ margin: '0.5rem 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>
                                                        {f.fenceType === 'LocationMaster' ? (f.location?.name || 'Branch Master') : (f.name || 'Custom Zone')}
                                                    </h5>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                        <div>
                                                            <strong>Lat:</strong> {f.fenceType === 'LocationMaster' ? (f.location?.lat || 'N/A') : (f.lat || 'N/A')}
                                                        </div>
                                                        <div>
                                                            <strong>Lng:</strong> {f.fenceType === 'LocationMaster' ? (f.location?.lng || 'N/A') : (f.lng || 'N/A')}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

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
                        <ProfileItem label="Workflow Approval Manager" value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName} (${employee.manager.employeeId})` : 'None / Admin'} />
                        <ProfileItem label="Direct Reporting Manager" value={employee.reportingManager ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName} (${employee.reportingManager.employeeId})` : 'None'} />

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

                {activeTab === 'qualifications' && (
                    <div>
                        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Educational & Professional Qualifications</h3>
                        {(!employee.certificates || employee.certificates.length === 0) ? (
                            <p style={{ color: 'var(--text-secondary)' }}>No qualifications or certificates recorded.</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {employee.certificates.map((cert, index) => (
                                    <div key={index} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--primary-400)', marginBottom: '0.5rem' }}>{cert.title}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.95rem' }}>
                                            <div><strong>Awarded by:</strong> {cert.issuer}</div>
                                            <div><strong>Passing/Award Year:</strong> {cert.year}</div>
                                            {cert.grade && <div><strong>Grade / GPA:</strong> {cert.grade}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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

                        {employee.emiratesIdDetails?.cardNumber && (
                            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', color: 'var(--accent-500)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>Verified Emirates ID Smart Card Details (Chip Read)</span>
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '2rem', alignItems: 'start' }}>
                                    {employee.emiratesIdDetails.photoBase64 && (
                                        <div style={{ width: '100px', height: '120px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#fff' }}>
                                            <img src={employee.emiratesIdDetails.photoBase64} alt="EID Chip Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    )}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
                                        <ProfileItem label="Card Number" value={employee.emiratesIdDetails.cardNumber} />
                                        <ProfileItem label="Card Expiry" value={formatDate(employee.emiratesIdDetails.cardExpiry)} />
                                        <ProfileItem label="Full Name (English)" value={employee.emiratesIdDetails.fullNameEnglish} />
                                        <ProfileItem label="Full Name (Arabic)" value={employee.emiratesIdDetails.fullNameArabic} />
                                        <ProfileItem label="Mother's Name" value={employee.emiratesIdDetails.motherName} />
                                        <ProfileItem label="Occupation" value={employee.emiratesIdDetails.occupation} />
                                        <ProfileItem label="Sponsor" value={employee.emiratesIdDetails.sponsorName} />
                                        <ProfileItem label="Card Issue Date" value={formatDate(employee.emiratesIdDetails.issueDate)} />
                                    </div>
                                </div>
                            </div>
                        )}
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

                {/* PRINT CONFIG MODAL */}
                {showPrintConfigModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                        <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                                Configure Back of ID Card
                            </h3>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                setShowPrintConfigModal(false);
                                handlePrintCard();
                            }} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Emergency Contact Name</label>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        value={cardConfig.emergencyContactName} 
                                        onChange={(e) => setCardConfig({ ...cardConfig, emergencyContactName: e.target.value })} 
                                        placeholder="e.g. Spouse/Father Name"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Emergency Phone Number</label>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        value={cardConfig.emergencyContactPhone} 
                                        onChange={(e) => setCardConfig({ ...cardConfig, emergencyContactPhone: e.target.value })} 
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Blood Group</label>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        value={cardConfig.bloodGroup} 
                                        placeholder="e.g. O+, A-"
                                        onChange={(e) => setCardConfig({ ...cardConfig, bloodGroup: e.target.value })} 
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Card Issue Date</label>
                                    <input 
                                        type="date" 
                                        className="form-control" 
                                        value={cardConfig.issueDate} 
                                        onChange={(e) => setCardConfig({ ...cardConfig, issueDate: e.target.value })} 
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Custom Terms & Policies</label>
                                    <textarea 
                                        className="form-control" 
                                        rows="3"
                                        value={cardConfig.customTerms} 
                                        onChange={(e) => setCardConfig({ ...cardConfig, customTerms: e.target.value })} 
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1rem' }}>
                                    <button type="button" onClick={() => setShowPrintConfigModal(false)} className="btn btn-secondary btn-outline">Cancel</button>
                                    <button type="submit" className="btn btn-primary">Generate Print Layout</button>
                                </div>
                            </form>
                        </div>
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
