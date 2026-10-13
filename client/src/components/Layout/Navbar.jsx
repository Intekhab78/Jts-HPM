import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
    HiOutlineArrowRightOnRectangle, 
    HiOutlineBell, 
    HiBars3, 
    HiOutlineSparkles, 
    HiOutlineQuestionMarkCircle 
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import VirtualTour from '../Tour/VirtualTour';
import './Navbar.css';

export default function Navbar({ onMenuClick }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showTour, setShowTour] = useState(false);

    const handleLogout = async () => {
        await logout();
        toast.success('Logged out successfully');
        navigate('/login');
    };

    return (
        <header className="navbar">
            <div className="navbar-left">
                <button className="navbar-menu-btn" onClick={onMenuClick} title="Open Menu" aria-label="Open Menu">
                    <HiBars3 />
                </button>
                <h2 className="navbar-greeting">
                    Welcome, <span className="navbar-name">{user?.name}</span>
                </h2>
            </div>

            <div className="navbar-right">
                <button 
                    className="btn btn-secondary btn-outline"
                    onClick={() => setShowTour(true)}
                    title="Start Interactive Virtual Tour"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.82rem',
                        borderRadius: '20px',
                        color: '#38bdf8',
                        borderColor: 'rgba(56, 189, 248, 0.4)',
                        background: 'rgba(56, 189, 248, 0.08)'
                    }}
                >
                    <HiOutlineSparkles /> Quick Tour 🚀
                </button>

                <button 
                    className="navbar-icon-btn" 
                    onClick={() => navigate('/help')} 
                    title="Help Center & User Manual"
                >
                    <HiOutlineQuestionMarkCircle />
                </button>

                <button className="navbar-icon-btn" title="Notifications">
                    <HiOutlineBell />
                    <span className="notification-dot"></span>
                </button>

                <div className="navbar-divider"></div>

                <div className="navbar-profile">
                    <div className="navbar-avatar" style={{ overflow: 'hidden', background: user?.profilePhoto ? 'transparent' : 'linear-gradient(135deg, var(--primary-500), var(--primary-700))', padding: user?.profilePhoto ? 0 : '', border: user?.profilePhoto ? '2px solid var(--primary-500)' : 'none' }}>
                        {user?.profilePhoto ? (
                            <img src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${user.profilePhoto}`} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <>{user?.name?.charAt(0) || 'U'}</>
                        )}
                    </div>
                    <div className="navbar-user-info">
                        <span className="navbar-user-name">{user?.name}</span>
                        <span className="navbar-user-role" style={{ textTransform: 'capitalize' }}>{typeof user?.role === 'string' ? user.role : user?.role?.name}</span>
                    </div>
                </div>

                <button className="navbar-icon-btn logout-btn" onClick={handleLogout} title="Logout">
                    <HiOutlineArrowRightOnRectangle />
                </button>
            </div>

            <VirtualTour 
                isOpen={showTour} 
                onClose={() => setShowTour(false)} 
            />
        </header>
    );
}

