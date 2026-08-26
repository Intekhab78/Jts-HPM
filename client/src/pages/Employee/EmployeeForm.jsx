import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getEmployeeById, createEmployee, updateEmployee, generateEmployeeId, uploadDocuments, getEmployees } from '../../api/employeeApi';
import { getPayElements } from '../../api/payElementApi';
import toast from 'react-hot-toast';

export default function EmployeeForm() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const { user } = useAuth();

    // Check permission
    const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const canModify = userRole === 'admin' || userRole === 'hr';

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [newCredentials, setNewCredentials] = useState(null);
    const [employeesList, setEmployeesList] = useState([]);
    const [companiesList, setCompaniesList] = useState([]);
    const [locationsList, setLocationsList] = useState([]);
    const [payElementsList, setPayElementsList] = useState([]);

    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '', dob: '', gender: 'Male',
        nationality: '', maritalStatus: 'Single', phone: '',
        emergencyContact: { name: '', relation: '', phone: '' },
        employeeId: '', department: '', designation: '', manager: '', reportingManager: '', dateOfJoining: '',
        probationEndDate: '', contractType: 'Permanent', molContractType: 'Unlimited',
        company: '', location: '',
        visaType: 'Employment', visaExpiry: '', emiratesId: '', passportNo: '', passportExpiry: '',
        basicSalary: 0, payElements: [],
        bankName: '', accountNo: '', iban: '', wpsAgentCode: '' || '',
        biometricMappings: [],
        geoFencing: { enabled: false, allowedFences: [] },
        certificates: [],
        emiratesIdDetails: {
            cardNumber: '',
            cardExpiry: '',
            fullNameEnglish: '',
            fullNameArabic: '',
            motherName: '',
            occupation: '',
            sponsorName: '',
            issueDate: '',
            passportNumber: '',
            passportExpiry: '',
            photoBase64: ''
        }
    });

    const [files, setFiles] = useState({
        passport: null, visa: null, emiratesIdDoc: null, contract: null
    });

    useEffect(() => {
        if (!canModify) {
            toast.error('You do not have permission to access the generic assignment form. You can only view your own profile.');
            navigate('/employees');
            return;
        }

        // Load dropdown masters in parallel
        Promise.all([
            getEmployees(),
            import('../../api').then(module => module.masterAPI.getCompanies()),
            import('../../api').then(module => module.masterAPI.getLocations()),
            getPayElements()
        ]).then(([empsRes, compsRes, locsRes, payElementsRes]) => {
            setEmployeesList(empsRes.data);
            setCompaniesList(compsRes.data.data);
            setLocationsList(locsRes.data.data);
            setPayElementsList(payElementsRes.data.data);
        }).catch(console.error);

        if (isEdit) {
            fetchEmployee();
        } else {
            fetchNewId();
        }
    }, [id, canModify, navigate]);

    const fetchNewId = async () => {
        try {
            const res = await generateEmployeeId();
            setFormData(prev => ({ ...prev, employeeId: res.data }));
        } catch (error) {
            console.error('Failed to generate ID', error);
        }
    };

    const fetchEmployee = async () => {
        try {
            const res = await getEmployeeById(id);
            const emp = res.data;
            // Format dates for input fields (YYYY-MM-DD)
            const formatForInput = (dateStr) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';

            setFormData({
                ...emp,
                dob: formatForInput(emp.dob),
                dateOfJoining: formatForInput(emp.dateOfJoining),
                probationEndDate: formatForInput(emp.probationEndDate),
                visaExpiry: formatForInput(emp.visaExpiry),
                passportExpiry: formatForInput(emp.passportExpiry),
                emergencyContact: emp.emergencyContact || { name: '', relation: '', phone: '' },
                manager: emp.manager ? emp.manager._id || emp.manager : '',
                reportingManager: emp.reportingManager ? emp.reportingManager._id || emp.reportingManager : '',
                certificates: emp.certificates || [],
                company: emp.company ? emp.company._id || emp.company : '',
                location: emp.location ? emp.location._id || emp.location : '',
                payElements: emp.payElements ? emp.payElements.map(pe => ({
                    element: pe.element?._id || pe.element,
                    amount: pe.amount
                })) : [],
                biometricMappings: emp.biometricMappings || [],
                geoFencing: emp.geoFencing ? {
                    enabled: emp.geoFencing.enabled || false,
                    allowedFences: emp.geoFencing.allowedFences ? emp.geoFencing.allowedFences.map(f => ({
                        fenceType: f.fenceType || 'LocationMaster',
                        location: f.location?._id || f.location || '',
                        name: f.name || '',
                        lat: f.lat || '',
                        lng: f.lng || '',
                        radius: f.radius || 100
                    })) : []
                } : { enabled: false, allowedFences: [] },
                emiratesIdDetails: emp.emiratesIdDetails ? {
                    cardNumber: emp.emiratesIdDetails.cardNumber || '',
                    cardExpiry: formatForInput(emp.emiratesIdDetails.cardExpiry),
                    fullNameEnglish: emp.emiratesIdDetails.fullNameEnglish || '',
                    fullNameArabic: emp.emiratesIdDetails.fullNameArabic || '',
                    motherName: emp.emiratesIdDetails.motherName || '',
                    occupation: emp.emiratesIdDetails.occupation || '',
                    sponsorName: emp.emiratesIdDetails.sponsorName || '',
                    issueDate: formatForInput(emp.emiratesIdDetails.issueDate),
                    passportNumber: emp.emiratesIdDetails.passportNumber || '',
                    passportExpiry: formatForInput(emp.emiratesIdDetails.passportExpiry),
                    photoBase64: emp.emiratesIdDetails.photoBase64 || ''
                } : { cardNumber: '', cardExpiry: '', fullNameEnglish: '', fullNameArabic: '', motherName: '', occupation: '', sponsorName: '', issueDate: '', passportNumber: '', passportExpiry: '', photoBase64: '' }
            });
        } catch (error) {
            toast.error('Failed to load employee details');
            navigate('/employees');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: { ...prev[parent], [child]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleGeoFencingChange = (e) => {
        const { checked } = e.target;
        setFormData(prev => ({
            ...prev,
            geoFencing: {
                ...prev.geoFencing,
                enabled: checked
            }
        }));
    };

    const handleAddAllowedFence = () => {
        setFormData(prev => ({
            ...prev,
            geoFencing: {
                ...prev.geoFencing,
                allowedFences: [...prev.geoFencing.allowedFences, { fenceType: 'LocationMaster', location: '', name: '', lat: '', lng: '', radius: 100 }]
            }
        }));
    };

    const handleRemoveAllowedFence = (index) => {
        const list = [...formData.geoFencing.allowedFences];
        list.splice(index, 1);
        setFormData(prev => ({
            ...prev,
            geoFencing: {
                ...prev.geoFencing,
                allowedFences: list
            }
        }));
    };

    const handleAllowedFenceChange = (index, field, value) => {
        const list = [...formData.geoFencing.allowedFences];
        list[index][field] = value;
        setFormData(prev => ({
            ...prev,
            geoFencing: {
                ...prev.geoFencing,
                allowedFences: list
            }
        }));
    };

    const handleReadEmiratesID = async () => {
        try {
            toast.loading('Reading Emirates ID card from OMNIKEY reader...', { id: 'eid-reading' });
            
            // Connect to local bridge utility
            const response = await fetch('http://localhost:8989/api/read-eid');
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || 'Local EID Reader service returned an error.');
            }

            const cardData = await response.json();
            
            if (!cardData || !cardData.emiratesId) {
                throw new Error('No smart card data detected. Please ensure the card is inserted properly.');
            }

            // Populate form fields dynamically
            setFormData(prev => ({
                ...prev,
                emiratesId: cardData.emiratesId || prev.emiratesId,
                firstName: cardData.firstName || prev.firstName,
                lastName: cardData.lastName || prev.lastName,
                dob: cardData.dob ? new Date(cardData.dob).toISOString().split('T')[0] : prev.dob,
                gender: cardData.gender || prev.gender,
                nationality: cardData.nationality || prev.nationality,
                passportNo: cardData.passportNo || prev.passportNo,
                passportExpiry: cardData.passportExpiry ? new Date(cardData.passportExpiry).toISOString().split('T')[0] : prev.passportExpiry,
                emiratesIdDetails: {
                    cardNumber: cardData.cardNumber || '',
                    cardExpiry: cardData.cardExpiry ? new Date(cardData.cardExpiry).toISOString().split('T')[0] : '',
                    fullNameEnglish: cardData.fullNameEnglish || '',
                    fullNameArabic: cardData.fullNameArabic || '',
                    motherName: cardData.motherName || '',
                    occupation: cardData.occupation || '',
                    sponsorName: cardData.sponsorName || '',
                    issueDate: cardData.issueDate ? new Date(cardData.issueDate).toISOString().split('T')[0] : '',
                    passportNumber: cardData.passportNo || '',
                    passportExpiry: cardData.passportExpiry ? new Date(cardData.passportExpiry).toISOString().split('T')[0] : '',
                    photoBase64: cardData.photoBase64 || ''
                }
            }));

            toast.success(`Emirates ID read successfully for ${cardData.firstName} ${cardData.lastName}!`, { id: 'eid-reading' });
        } catch (error) {
            console.error('EID Reader Error:', error);
            const isOffline = error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError');
            toast.error(
                isOffline
                    ? 'EID Reader Offline: Make sure EID Bridge Utility is running on this PC (port 8989).'
                    : `Card Reader Error: ${error.message}`,
                { id: 'eid-reading', duration: 8000 }
            );
        }
    };

    const handleAddBiometricMapping = () => {
        setFormData(prev => ({
            ...prev,
            biometricMappings: [...prev.biometricMappings, { deviceName: '', biometricId: '' }]
        }));
    };

    const handleRemoveBiometricMapping = (index) => {
        const list = [...formData.biometricMappings];
        list.splice(index, 1);
        setFormData(prev => ({ ...prev, biometricMappings: list }));
    };

    const handleBiometricMappingChange = (index, field, value) => {
        const list = [...formData.biometricMappings];
        list[index][field] = value;
        setFormData(prev => ({ ...prev, biometricMappings: list }));
    };

    const handlePayElementChange = (index, field, value) => {
        const newPayElements = [...formData.payElements];
        newPayElements[index][field] = value;
        setFormData(prev => ({ ...prev, payElements: newPayElements }));
    };

    const handleAddPayElement = () => {
        setFormData(prev => ({ ...prev, payElements: [...prev.payElements, { element: '', amount: '' }] }));
    };

    const handleRemovePayElement = (index) => {
        const newPayElements = [...formData.payElements];
        newPayElements.splice(index, 1);
        setFormData(prev => ({ ...prev, payElements: newPayElements }));
    };

    const handleAddCertificate = () => {
        setFormData(prev => ({
            ...prev,
            certificates: [...(prev.certificates || []), { title: '', issuer: '', year: '', grade: '', fileUrl: '' }]
        }));
    };

    const handleRemoveCertificate = (index) => {
        setFormData(prev => ({
            ...prev,
            certificates: (prev.certificates || []).filter((_, i) => i !== index)
        }));
    };

    const handleCertificateChange = (index, field, value) => {
        setFormData(prev => {
            const list = [...(prev.certificates || [])];
            list[index] = { ...list[index], [field]: value };
            return { ...prev, certificates: list };
        });
    };

    const handleFileChange = (e) => {
        const { name, files: fileList } = e.target;
        if (fileList.length > 0) {
            setFiles(prev => ({ ...prev, [name]: fileList[0] }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);

            // 1. Save Data
            let savedEmp;
            const submitData = { ...formData };
            if (!submitData.manager) delete submitData.manager; // prevent Mongoose CastError
            if (!submitData.reportingManager) delete submitData.reportingManager;
            if (!submitData.company) delete submitData.company;
            if (!submitData.location) delete submitData.location;
            if (submitData.geoFencing && submitData.geoFencing.allowedFences) {
                submitData.geoFencing.allowedFences = submitData.geoFencing.allowedFences.map(f => {
                    const fence = { ...f };
                    if (fence.fenceType === 'Custom') {
                        delete fence.location;
                    } else if (fence.fenceType === 'LocationMaster' && !fence.location) {
                        delete fence.location;
                    }
                    return fence;
                });
            }

            if (isEdit) {
                const res = await updateEmployee(id, submitData);
                savedEmp = res.data;
                toast.success('Employee updated successfully');
            } else {
                const res = await createEmployee(submitData);
                savedEmp = res.data;
                if (res.credentials) {
                    setNewCredentials(res.credentials);
                }
                toast.success('Employee created successfully');
            }

            // 2. Upload Files if any
            const uploadData = new FormData();
            let hasFiles = false;
            Object.keys(files).forEach(key => {
                if (files[key]) {
                    uploadData.append(key, files[key]);
                    hasFiles = true;
                }
            });

            if (hasFiles) {
                await uploadDocuments(savedEmp._id, uploadData);
                toast.success('Documents uploaded');
            }

            // Only navigate away immediately if not showing new credentials
            if (isEdit || !savedEmp) {
                navigate('/employees');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save employee');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-loader"><div className="loader"></div></div>;

    return (
        <div className="employee-form-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{isEdit ? 'Edit Employee' : 'Add Employee'}</h1>
                    <p className="page-subtitle">Fill in the complete details for the HR records</p>
                </div>
                <button onClick={() => navigate('/employees')} className="btn btn-secondary">Back to List</button>
            </div>

            {newCredentials && (
                <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid #10b981', background: '#ecfdf5' }}>
                    <h2 style={{ fontSize: '1.2rem', color: '#047857', marginBottom: '0.5rem' }}>✅ Employee & Portal Account Created</h2>
                    <p style={{ color: '#065f46', marginBottom: '1rem' }}>
                        A new Employee Self-Service portal account was automatically generated. Please share these credentials securely with the employee so they can log in to apply for leaves and view payslips.
                    </p>
                    <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                        <p><strong>Portal URL:</strong> <code>{window.location.origin}/login</code></p>
                        <p><strong>Email:</strong> <code>{newCredentials.email}</code></p>
                        <p><strong>Password:</strong> <code>{newCredentials.password}</code></p>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                        <button onClick={() => navigate('/employees')} className="btn btn-primary">Acknowledge & Continue</button>
                    </div>
                </div>
            )}

            {!newCredentials && (
                <form onSubmit={handleSubmit} className="form-wizard" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* Personal Information */}
                    <div className="card">
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Personal Information</h2>

                        {/* Profile Photo Upload */}
                        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid var(--primary-500)', color: 'var(--text-primary)', fontSize: '2rem', fontWeight: 'bold' }}>
                                {files.profilePhoto ? (
                                    <img src={URL.createObjectURL(files.profilePhoto)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : formData.profilePhoto ? (
                                    <img src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${formData.profilePhoto}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <span>{formData.firstName ? formData.firstName.charAt(0) : 'U'}</span>
                                )}
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ marginBottom: '0.2rem' }}>Profile Photo (HR/Admin Only)</label>
                                <input type="file" className="form-control" name="profilePhoto" onChange={handleFileChange} accept=".jpg,.png,.jpeg" style={{ padding: '0.4rem', maxWidth: '300px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">First Name *</label>
                                <input type="text" className="form-control" name="firstName" value={formData.firstName} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name *</label>
                                <input type="text" className="form-control" name="lastName" value={formData.lastName} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email (Creates Login) *</label>
                                <input type="email" className="form-control" name="email" value={formData.email} onChange={handleChange} required readOnly={isEdit} style={isEdit ? { background: 'var(--bg-tertiary)' } : {}} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input type="text" className="form-control" name="phone" value={formData.phone} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date of Birth *</label>
                                <input type="date" className="form-control" name="dob" value={formData.dob} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Gender</label>
                                <select className="form-control" name="gender" value={formData.gender} onChange={handleChange}>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nationality *</label>
                                <input type="text" className="form-control" name="nationality" value={formData.nationality} onChange={handleChange} required />
                            </div>
                        </div>
                    </div>

                    {/* Employment Information */}
                    <div className="card">
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Employment Details</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Employee ID</label>
                                <input type="text" className="form-control" name="employeeId" value={formData.employeeId} readOnly style={{ background: 'var(--bg-tertiary)' }} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Department *</label>
                                <input type="text" className="form-control" name="department" value={formData.department} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Designation *</label>
                                <input type="text" className="form-control" name="designation" value={formData.designation} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Multi-level Approval Manager</label>
                                <select className="form-control" name="manager" value={formData.manager || ''} onChange={handleChange}>
                                    <option value="">None</option>
                                    {employeesList.map(emp => (
                                        <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} ({emp.employeeId})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Reporting Manager</label>
                                <select className="form-control" name="reportingManager" value={formData.reportingManager || ''} onChange={handleChange}>
                                    <option value="">None</option>
                                    {employeesList.map(emp => (
                                        <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} ({emp.employeeId})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date of Joining *</label>
                                <input type="date" className="form-control" name="dateOfJoining" value={formData.dateOfJoining} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contract Type</label>
                                <select className="form-control" name="contractType" value={formData.contractType} onChange={handleChange}>
                                    <option value="Permanent">Permanent</option>
                                    <option value="Contract">Contract</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Company Structure</label>
                                <select className="form-control" name="company" value={formData.company || ''} onChange={handleChange}>
                                    <option value="">Select Company</option>
                                    {companiesList.map(comp => (
                                        <option key={comp._id} value={comp._id}>{comp.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Branch Location</label>
                                <select className="form-control" name="location" value={formData.location || ''} onChange={handleChange}>
                                    <option value="">Select Location</option>
                                    {locationsList.map(loc => (
                                        <option key={loc._id} value={loc._id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Biometric Mappings */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Biometric Device Mappings</h2>
                            <button type="button" onClick={handleAddBiometricMapping} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>+ Add Mapping</button>
                        </div>
                        {formData.biometricMappings.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '1rem 0' }}>No biometric device mappings configured for this employee. Punches from physical devices won't be mapped.</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr)', gap: '1rem' }}>
                                {formData.biometricMappings.map((mapping, index) => (
                                    <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', background: 'var(--bg-tertiary)', padding: '0.8rem', borderRadius: '4px' }}>
                                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                            <label className="form-label">Device Name / Serial</label>
                                            <input type="text" className="form-control" placeholder="e.g. ZK Office Gate / * (for any)" value={mapping.deviceName || ''} onChange={(e) => handleBiometricMappingChange(index, 'deviceName', e.target.value)} />
                                        </div>
                                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                            <label className="form-label">Biometric User ID *</label>
                                            <input type="text" className="form-control" placeholder="e.g. 1001" value={mapping.biometricId || ''} onChange={(e) => handleBiometricMappingChange(index, 'biometricId', e.target.value)} required />
                                        </div>
                                        <button type="button" onClick={() => handleRemoveBiometricMapping(index)} className="btn btn-secondary btn-outline" style={{ color: '#ef4444', borderColor: '#ef4444', padding: '0.4rem 0.8rem' }}>X</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Geo-Fencing Configuration */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Geo-Fencing Setup (Allowed Zones)</h2>
                            <button type="button" onClick={handleAddAllowedFence} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>+ Add Allowed Zone</button>
                        </div>
                        
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                            <input type="checkbox" name="enabled" checked={formData.geoFencing.enabled} onChange={handleGeoFencingChange} id="geoFencingEnabled" />
                            <label htmlFor="geoFencingEnabled" className="form-label" style={{ margin: 0 }}>Enable Geo-Fencing for this Employee (Web/App Punches)</label>
                        </div>

                        {formData.geoFencing.enabled && (
                            <div>
                                {formData.geoFencing.allowedFences.length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '1rem 0' }}>No geo-fence zones configured. Add at least one allowed zone to enforce boundaries.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {formData.geoFencing.allowedFences.map((fence, index) => (
                                            <div key={index} style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Zone #{index + 1}</h4>
                                                    <button type="button" onClick={() => handleRemoveAllowedFence(index)} className="btn btn-secondary btn-outline" style={{ color: '#ef4444', borderColor: '#ef4444', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Remove Zone</button>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                                    <div className="form-group">
                                                        <label className="form-label">Fence Type</label>
                                                        <select className="form-control" value={fence.fenceType} onChange={(e) => handleAllowedFenceChange(index, 'fenceType', e.target.value)}>
                                                            <option value="LocationMaster">Location Master (Branch Location)</option>
                                                            <option value="Custom">Custom Maps / GPS Coordinates</option>
                                                        </select>
                                                    </div>

                                                    {fence.fenceType === 'LocationMaster' ? (
                                                        <div className="form-group">
                                                            <label className="form-label">Linked Branch Location *</label>
                                                            <select className="form-control" value={fence.location} onChange={(e) => handleAllowedFenceChange(index, 'location', e.target.value)} required>
                                                                <option value="">Select Location</option>
                                                                {locationsList.map(loc => (
                                                                    <option key={loc._id} value={loc._id}>{loc.name} {loc.lat ? `(${loc.lat}, ${loc.lng})` : '(No coords set)'}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <div className="form-group">
                                                            <label className="form-label">Zone Description / Name *</label>
                                                            <input type="text" className="form-control" placeholder="e.g. Dubai Mall Client Site" value={fence.name || ''} onChange={(e) => handleAllowedFenceChange(index, 'name', e.target.value)} required />
                                                        </div>
                                                    )}

                                                    {fence.fenceType === 'Custom' && (
                                                        <>
                                                            <div className="form-group">
                                                                <label className="form-label">Latitude *</label>
                                                                <input type="number" step="any" className="form-control" placeholder="e.g. 25.2048" value={fence.lat || ''} onChange={(e) => handleAllowedFenceChange(index, 'lat', e.target.value)} required />
                                                            </div>
                                                            <div className="form-group">
                                                                <label className="form-label">Longitude *</label>
                                                                <input type="number" step="any" className="form-control" placeholder="e.g. 55.2708" value={fence.lng || ''} onChange={(e) => handleAllowedFenceChange(index, 'lng', e.target.value)} required />
                                                            </div>
                                                        </>
                                                    )}

                                                    <div className="form-group">
                                                        <label className="form-label">Circle Radius (Meters) *</label>
                                                        <input type="number" className="form-control" placeholder="e.g. 100" value={fence.radius || 100} onChange={(e) => handleAllowedFenceChange(index, 'radius', e.target.value)} required />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Educational & Professional Certificates */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Educational & Professional Certificates</h2>
                            <button type="button" onClick={handleAddCertificate} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>+ Add Certificate / Degree</button>
                        </div>
                        {(formData.certificates || []).length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '1rem 0' }}>No educational or professional certificates added yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {(formData.certificates || []).map((cert, index) => (
                                    <div key={index} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) 45px', gap: '1rem', alignItems: 'flex-end', background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Degree / Certificate Title *</label>
                                            <input type="text" className="form-control" placeholder="e.g. Bachelor of Computer Science" value={cert.title || ''} onChange={(e) => handleCertificateChange(index, 'title', e.target.value)} required />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Awarding Institution / Issuer *</label>
                                            <input type="text" className="form-control" placeholder="e.g. University of Dubai" value={cert.issuer || ''} onChange={(e) => handleCertificateChange(index, 'issuer', e.target.value)} required />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Year of Passing / Award *</label>
                                            <input type="text" className="form-control" placeholder="e.g. 2020" value={cert.year || ''} onChange={(e) => handleCertificateChange(index, 'year', e.target.value)} required />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Grade / Score / GPA</label>
                                            <input type="text" className="form-control" placeholder="e.g. Grade A / 3.8 GPA" value={cert.grade || ''} onChange={(e) => handleCertificateChange(index, 'grade', e.target.value)} />
                                        </div>
                                        <button type="button" onClick={() => handleRemoveCertificate(index)} className="btn btn-secondary btn-outline" style={{ color: '#ef4444', borderColor: '#ef4444', height: '38px', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Salary Components */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Salary Components</h2>
                            <button type="button" onClick={handleAddPayElement} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>+ Add Element</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr)', gap: '1rem' }}>

                            {formData.payElements.map((pe, index) => (
                                <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', background: 'var(--bg-tertiary)', padding: '0.8rem', borderRadius: '4px' }}>
                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label className="form-label">Pay Element</label>
                                        <select className="form-control" value={pe.element} onChange={(e) => handlePayElementChange(index, 'element', e.target.value)} required>
                                            <option value="">Select Element</option>
                                            {payElementsList.map(item => (
                                                <option key={item._id} value={item._id}>{item.name} {item.type === 'Deduction' ? '(Deduction)' : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label className="form-label">Amount (AED)</label>
                                        <input type="number" className="form-control" value={pe.amount} onChange={(e) => handlePayElementChange(index, 'amount', e.target.value)} required />
                                    </div>
                                    <button type="button" onClick={() => handleRemovePayElement(index)} className="btn btn-secondary btn-outline" style={{ color: '#ef4444', borderColor: '#ef4444', padding: '0.4rem 0.8rem' }}>X</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Documents */}
                    <div className="card">
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Documents & Compliance</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Emirates ID No</span>
                                    <button 
                                        type="button" 
                                        onClick={handleReadEmiratesID} 
                                        className="btn btn-secondary btn-outline" 
                                        style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem', height: 'auto', border: '1px solid var(--primary-500)', color: 'var(--primary-400)' }}
                                    >
                                        💳 Read EID Card
                                    </button>
                                </label>
                                <input type="text" className="form-control" name="emiratesId" value={formData.emiratesId} onChange={handleChange} placeholder="784-XXXX-XXXXXXX-X" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Upload EID Copy</label>
                                <input type="file" className="form-control" name="emiratesIdDoc" onChange={handleFileChange} accept=".jpg,.png,.pdf" style={{ padding: '0.4rem' }} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Passport No</label>
                                <input type="text" className="form-control" name="passportNo" value={formData.passportNo} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Upload Passport</label>
                                <input type="file" className="form-control" name="passport" onChange={handleFileChange} accept=".jpg,.png,.pdf" style={{ padding: '0.4rem' }} />
                            </div>
                        </div>

                        {formData.emiratesIdDetails?.cardNumber && (
                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary-400)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>Verified Emirates ID Smart Card Data (EID Chip)</span>
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '1.5rem', alignItems: 'start' }}>
                                    {formData.emiratesIdDetails.photoBase64 && (
                                        <div style={{ width: '80px', height: '100px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#fff' }}>
                                            <img src={formData.emiratesIdDetails.photoBase64} alt="EID Chip" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    )}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem', fontSize: '0.85rem' }}>
                                        <div><strong>Card Number:</strong> {formData.emiratesIdDetails.cardNumber}</div>
                                        <div><strong>Card Expiry:</strong> {formData.emiratesIdDetails.cardExpiry}</div>
                                        <div><strong>Full Name (EN):</strong> {formData.emiratesIdDetails.fullNameEnglish}</div>
                                        <div><strong>Full Name (AR):</strong> {formData.emiratesIdDetails.fullNameArabic}</div>
                                        <div><strong>Mother's Name:</strong> {formData.emiratesIdDetails.motherName}</div>
                                        <div><strong>Occupation:</strong> {formData.emiratesIdDetails.occupation}</div>
                                        <div><strong>Sponsor:</strong> {formData.emiratesIdDetails.sponsorName}</div>
                                        <div><strong>Issue Date:</strong> {formData.emiratesIdDetails.issueDate}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button type="button" onClick={() => navigate('/employees')} className="btn btn-secondary">Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Employee')}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
