import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { HiOutlineArrowRightOnRectangle, HiOutlineBell } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import './Navbar.css';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        toast.success('Logged out successfully');
        navigate('/login');
    };

    return (
        <header className="navbar">
            <div className="navbar-left">
                <h2 className="navbar-greeting">
                    Welcome, <span className="navbar-name">{user?.name}</span>
                </h2>
            </div>

            <div className="navbar-right">
                <button className="navbar-icon-btn" title="Notifications">
                    <HiOutlineBell />
                    <span className="notification-dot"></span>
                </button>

                <div className="navbar-divider"></div>

                <div className="navbar-profile">
                    {(() => {
                        const photo = user?.profilePhoto || user?.employeeRef?.profilePhoto; return (
                            <div className="navbar-avatar" style={{ overflow: 'hidden', background: photo ? 'transparent' : 'linear-gradient(135deg, var(--primary-500), var(--primary-700))', padding: photo ? 0 : '', border: photo ? '2px solid var(--primary-500)' : 'none' }}>
                                {photo ? (
                                    <img src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${photo}`} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <>{user?.name?.charAt(0) || 'U'}</>
                                )}
                            </div>
                        );
                    })()}
                    <div className="navbar-user-info">
                        <span className="navbar-user-name">{user?.name}</span>
                        <span className="navbar-user-role" style={{ textTransform: 'capitalize' }}>{typeof user?.role === 'string' ? user.role : user?.role?.name}</span>
                    </div>
                </div>

                <button className="navbar-icon-btn logout-btn" onClick={handleLogout} title="Logout">
                    <HiOutlineArrowRightOnRectangle />
                </button>
            </div>
        </header>
    );
}
