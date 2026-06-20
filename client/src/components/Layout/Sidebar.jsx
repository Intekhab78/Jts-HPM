import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineHome,
    HiOutlineUserGroup,
    HiOutlineCalendar,
    HiOutlineClock,
    HiOutlineCurrencyDollar,
    HiOutlinePaperAirplane,
    HiOutlineBanknotes,
    HiOutlineStar,
    HiOutlineCog6Tooth,
    HiOutlineShieldCheck,
    HiOutlineCheckCircle,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineBuildingOffice,
    HiOutlineMapPin,
    HiOutlineQuestionMarkCircle
} from 'react-icons/hi2';
import { useState } from 'react';
import './Sidebar.css';

const menuItems = [
    { path: '/', label: 'Dashboard', icon: HiOutlineHome, roles: ['admin', 'hr', 'manager', 'finance', 'director', 'employee'] },

    // Core Modules
    { path: '/employees', label: 'Employees', icon: HiOutlineUserGroup, roles: ['admin', 'hr', 'manager', 'director'] },
    { path: '/leaves', label: 'Leaves', icon: HiOutlineCalendar, roles: ['admin', 'hr', 'manager', 'employee'] },
    { path: '/attendance', label: 'Attendance', icon: HiOutlineClock, roles: ['admin', 'hr', 'manager', 'employee'] },
    { path: '/payroll', label: 'Payroll', icon: HiOutlineCurrencyDollar, roles: ['admin', 'hr', 'finance', 'director'] },
    { path: '/gratuity', label: 'Gratuity Calculator', icon: HiOutlineBanknotes, roles: ['admin', 'hr', 'finance'] },
    { path: '/travel', label: 'Travel & Expense', icon: HiOutlinePaperAirplane, roles: ['admin', 'hr', 'manager', 'finance', 'employee'] },
    { path: '/appraisal', label: 'Appraisal', icon: HiOutlineStar, roles: ['admin', 'hr', 'manager', 'employee'] },

    // Setup & Configuration
    { path: '/companies', label: 'Company Structure', icon: HiOutlineBuildingOffice, roles: ['admin', 'hr'] },
    { path: '/locations', label: 'Branch Locations', icon: HiOutlineMapPin, roles: ['admin', 'hr'] },
    { path: '/pay-elements', label: 'Pay Elements Master', icon: HiOutlineCurrencyDollar, roles: ['admin', 'hr'] },
    { path: '/holidays', label: 'Company Holidays', icon: HiOutlineCalendar, roles: ['admin', 'hr'] },
    { path: '/leave-settings', label: 'Leave Policy Rules', icon: HiOutlineCog6Tooth, roles: ['admin', 'hr'] },
    { path: '/attendance-settings', label: 'Attendance Policy', icon: HiOutlineClock, roles: ['admin', 'hr'] },
    { path: '/settings/working-hours', label: 'Working Hour Overrides', icon: HiOutlineCog6Tooth, roles: ['admin', 'hr'] },

    // Administration & Reports
    { path: '/reports', label: 'Data Reports (Excel)', icon: HiOutlineCheckCircle, roles: ['admin', 'hr', 'finance', 'manager', 'director'] },
    { path: '/roles', label: 'Assign Roles', icon: HiOutlineUserGroup, roles: ['admin', 'hr'] },
    { path: '/permissions', label: 'Permissions Matrix', icon: HiOutlineShieldCheck, roles: ['admin'] },
    { path: '/help', label: 'Help & Manual', icon: HiOutlineQuestionMarkCircle, roles: ['admin', 'hr', 'manager', 'finance', 'director', 'employee'] },
];

export default function Sidebar() {
    const { user } = useAuth();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);

    // Safely check what roles can see this link. If `user.role` is a string (legacy) use it, else use `user.role.name`
    const userRoleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const filteredItems = menuItems.filter(item => item.roles.includes(userRoleName));

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
            <div className="sidebar-header">
                {!collapsed && (
                    <div className="sidebar-logo">
                        <div className="logo-icon">HR</div>
                        <div className="logo-text">
                            <span className="logo-title">HR Payroll</span>
                            <span className="logo-sub">UAE System</span>
                        </div>
                    </div>
                )}
                {collapsed && <div className="logo-icon logo-icon-small">HR</div>}
                <button
                    className="sidebar-toggle"
                    onClick={() => setCollapsed(!collapsed)}
                    aria-label="Toggle sidebar"
                >
                    {collapsed ? <HiOutlineChevronRight /> : <HiOutlineChevronLeft />}
                </button>
            </div>

            <nav className="sidebar-nav">
                {filteredItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) =>
                            `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                        }
                        title={collapsed ? item.label : undefined}
                    >
                        <item.icon className="sidebar-link-icon" />
                        {!collapsed && <span className="sidebar-link-text">{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                {!collapsed && (
                    <div className="sidebar-user">
                        {(() => {
                            const photo = user?.profilePhoto || user?.employeeRef?.profilePhoto; return (
                                <div className="sidebar-avatar" style={{ overflow: 'hidden', background: photo ? 'transparent' : 'linear-gradient(135deg, var(--accent-500), var(--accent-700))', padding: photo ? 0 : '', border: photo ? '2px solid var(--accent-500)' : 'none' }}>
                                    {photo ? (
                                        <img src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${photo}`} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <>{user?.name?.charAt(0) || 'U'}</>
                                    )}
                                </div>
                            );
                        })()}
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.name}</div>
                            <div className="sidebar-user-role" style={{ textTransform: 'capitalize' }}>{userRoleName}</div>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
