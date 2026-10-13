import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HiOutlineShieldCheck, HiOutlineSparkles, HiOutlineDocumentText } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import './Login.css';

export default function Login() {
    const [isRegister, setIsRegister] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'employee',
    });
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isRegister) {
                await register(formData);
                toast.success('Account created successfully!');
            } else {
                await login(formData.email, formData.password);
                toast.success('Welcome back!');
            }
            navigate('/');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-bg">
                <div className="login-orb login-orb-1"></div>
                <div className="login-orb login-orb-2"></div>
                <div className="login-orb login-orb-3"></div>
            </div>

            <div className="login-wrapper">
                {/* Visual Branding Section - hidden on mobile */}
                <div className="login-brand animate-fade-up">
                    <div className="login-logo-large">
                        <div className="login-icon-large">HR</div>
                        <h2>Smart HR & UAE Payroll</h2>
                    </div>

                    <p className="brand-tagline">
                        A robust, compliant, and beautifully designed workspace to manage your workforce, process WPS payrolls, and handle end-to-end employee lifecycles.
                    </p>

                    <div className="feature-list">
                        <div className="feature-item">
                            <div className="feature-icon"><HiOutlineShieldCheck /></div>
                            <div>
                                <h4>UAE Labor Law Compliant</h4>
                                <p>Built-in rules for gratuity, EOSB, and leave accruals.</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon"><HiOutlineDocumentText /></div>
                            <div>
                                <h4>WPS SIF Automation</h4>
                                <p>Generate precise bank files in one click.</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon"><HiOutlineSparkles /></div>
                            <div>
                                <h4>Modern Self-Service</h4>
                                <p>Empower employees with an intuitive portal.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Authentication Form */}
                <div className="login-container animate-fade-up" style={{ animationDelay: '0.1s' }}>
                    <div className="login-card glass">
                        <div className="login-header-mobile">
                            <div className="login-logo-icon">HR</div>
                            <h1 className="login-title">HR Payroll</h1>
                            <p className="login-subtitle">UAE Compliant System</p>
                        </div>

                        <form onSubmit={handleSubmit} className="login-form">
                            <h2 className="form-heading">
                                {isRegister ? 'Create Account' : 'Sign In'}
                            </h2>
                            <p className="form-description">
                                {isRegister
                                    ? 'Fill in details to secure your account'
                                    : 'Enter your credentials to access the workspace'}
                            </p>

                            {isRegister && (
                                <div className="form-group">
                                    <label className="form-label" htmlFor="name">Full Name</label>
                                    <input
                                        id="name"
                                        type="text"
                                        name="name"
                                        className="form-input"
                                        placeholder="Enter your full name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label" htmlFor="email">Email or Employee ID</label>
                                <input
                                    id="email"
                                    type="text"
                                    name="email"
                                    className="form-input"
                                    placeholder="name@company.com or EMP-001"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                />
                            </div>

                            {isRegister && (
                                <div className="form-group">
                                    <label className="form-label" htmlFor="role">Role Authorization</label>
                                    <select
                                        id="role"
                                        name="role"
                                        className="form-select"
                                        value={formData.role}
                                        onChange={handleChange}
                                    >
                                        <option value="employee">Employee</option>
                                        <option value="hr">HR Manager</option>
                                        <option value="manager">Line Manager</option>
                                        <option value="finance">Finance Controller</option>
                                        <option value="director">Company Director</option>
                                        <option value="admin">System Admin</option>
                                    </select>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary btn-lg login-btn"
                                disabled={loading}
                                style={{ marginTop: '1rem', width: '100%', padding: '0.8rem' }}
                            >
                                {loading ? (
                                    <span className="loader" style={{ width: 20, height: 20, borderWidth: 2, borderColor: 'white', borderBottomColor: 'transparent' }}></span>
                                ) : isRegister ? 'Register Account' : 'Secure Login'}
                            </button>

                            <p className="login-toggle">
                                {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
                                <button
                                    type="button"
                                    className="login-toggle-btn"
                                    onClick={() => setIsRegister(!isRegister)}
                                >
                                    {isRegister ? 'Sign In' : 'Create Account'}
                                </button>
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
