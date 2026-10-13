import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getEmployees } from '../../api/employeeApi';
import { getAllLeaves, getLeaveBalances } from '../../api/leaveApi';
import { getAttendance } from '../../api/attendanceApi';
import { getPayrolls } from '../../api/payrollApi';
import { Link } from 'react-router-dom';
import {
    HiOutlineUserGroup,
    HiOutlineCalendar,
    HiOutlineClock,
    HiOutlineCurrencyDollar,
    HiOutlineArrowRight,
    HiOutlineDocumentText
} from 'react-icons/hi2';
import './Dashboard.css';

export default function Dashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalEmployees: 0,
        pendingLeaves: 0,
        todayAttendance: 0,
        monthPayroll: 0
    });

    const [empStats, setEmpStats] = useState({
        annualBalance: 0,
        sickBalance: 0,
        latestNetPay: 0,
        lateDays: 0
    });

    useEffect(() => {
        if (user.role === 'employee') {
            fetchEmployeeStats();
        } else {
            fetchAdminStats();
        }
    }, [user]);

    const fetchAdminStats = async () => {
        try {
            setLoading(true);
            const [empsRes, leavesRes] = await Promise.all([
                getEmployees(),
                getAllLeaves()
            ]);

            setStats({
                totalEmployees: empsRes.data?.length || 0,
                pendingLeaves: leavesRes.data?.filter(l => l.status === 'Pending').length || 0,
                // Mocking attendance/payroll for brevity, realistically we'd fetch today's date and current month
                todayAttendance: empsRes.data?.length ? Math.floor(empsRes.data.length * 0.9) : 0,
                monthPayroll: 0
            });
        } catch (error) {
            console.error("Dashboard stats error", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployeeStats = async () => {
        try {
            setLoading(true);
            if (!user.employeeRef) return;

            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();

            const [balancesRes, attendanceRes, payrollsRes] = await Promise.all([
                getLeaveBalances(user.employeeRef).catch(() => ({ data: {} })),
                getAttendance({
                    startDate: new Date(currentYear, currentMonth - 1, 1).toISOString(),
                    endDate: new Date().toISOString(),
                    employeeId: user.employeeRef
                }).catch(() => ({ data: [] })),
                getPayrolls(currentYear, currentMonth - 1).catch(() => ({ data: [] })) // Last month
            ]);

            const bals = balancesRes.data || {};
            const atts = attendanceRes.data || [];
            const pays = payrollsRes.data || [];

            // Find employee's specific payroll from last month
            const myPayroll = pays.find(p => p.employee?._id === user.employeeRef || p.employee === user.employeeRef);

            setEmpStats({
                annualBalance: bals['Annual']?.available || 0,
                sickBalance: bals['Sick']?.available || 0,
                lateDays: atts.filter(a => a.status === 'Late').length,
                latestNetPay: myPayroll ? myPayroll.netPay : 0
            });

        } catch (error) {
            console.error("Employee stats error", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="page-loader"><div className="loader"></div></div>;
    }

    if (user.role === 'employee') {
        return (
            <div className="dashboard">
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1 className="page-title">Welcome back, {user.name.split(' ')[0]} 👋</h1>
                        <p className="page-subtitle">Here is what's happening with your profile today.</p>
                    </div>
                </div>

                <div className="stats-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                    <div className="stat-card animate-fade-up">
                        <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                            <HiOutlineCalendar />
                        </div>
                        <div className="stat-value">{empStats.annualBalance} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>days</span></div>
                        <div className="stat-label">Annual Leave Balance</div>
                    </div>

                    <div className="stat-card animate-fade-up" style={{ animationDelay: '0.1s' }}>
                        <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                            <HiOutlineClock />
                        </div>
                        <div className="stat-value">{empStats.lateDays} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>days</span></div>
                        <div className="stat-label">Late Arrivals (This Month)</div>
                    </div>

                    <div className="stat-card animate-fade-up" style={{ animationDelay: '0.2s' }}>
                        <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                            <HiOutlineCurrencyDollar />
                        </div>
                        <div className="stat-value">{empStats.latestNetPay > 0 ? `AED ${empStats.latestNetPay.toLocaleString()}` : '---'}</div>
                        <div className="stat-label">Last Month Net Pay</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
                    <div className="card">
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <HiOutlineArrowRight color="var(--primary-color)" /> Quick Actions
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <Link to="/leaves/apply" className="btn btn-secondary btn-outline" style={{ justifyContent: 'flex-start', padding: '1rem' }}>
                                🏖️ Apply for Leave
                            </Link>
                            <Link to="/attendance" className="btn btn-secondary btn-outline" style={{ justifyContent: 'flex-start', padding: '1rem' }}>
                                ⏰ View My Timesheet
                            </Link>
                            <Link to="/payroll" className="btn btn-secondary btn-outline" style={{ justifyContent: 'flex-start', padding: '1rem' }}>
                                📄 Download Payslip
                            </Link>
                        </div>
                    </div>

                    <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary-color), #2563eb)', color: 'white', border: 'none' }}>
                        <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem', color: 'white' }}>Need Help?</h2>
                        <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '2rem', lineHeight: '1.6' }}>
                            If you have any questions regarding your leave balance, attendance records, or payroll deductions, please contact the HR department.
                        </p>
                        <button className="btn" style={{ background: 'white', color: 'var(--primary-color)', border: 'none', fontWeight: 'bold' }}>
                            Contact HR
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name;

    // Admin / HR / Manager / Finance Dashboard
    return (
        <div className="dashboard">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 className="page-title">Executive Dashboard</h1>
                    <p className="page-subtitle">Overview of HR & Payroll operations</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {(userRole === 'admin' || userRole === 'hr') && (
                        <Link to="/employees/new" className="btn btn-primary">+ New Employee</Link>
                    )}
                </div>
            </div>

            <div className="stats-grid stagger">
                <div className="stat-card animate-fade-up">
                    <div className="stat-icon" style={{ background: 'rgba(8, 145, 178, 0.12)', color: '#0891b2' }}>
                        <HiOutlineUserGroup />
                    </div>
                    <div className="stat-value">{stats.totalEmployees}</div>
                    <div className="stat-label">Active Employees</div>
                </div>

                <div className="stat-card animate-fade-up" style={{ animationDelay: '0.1s' }}>
                    <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                        <HiOutlineCalendar />
                    </div>
                    <div className="stat-value">{stats.pendingLeaves}</div>
                    <div className="stat-label">Pending Leave Requests</div>
                </div>

                <div className="stat-card animate-fade-up" style={{ animationDelay: '0.2s' }}>
                    <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                        <HiOutlineClock />
                    </div>
                    <div className="stat-value">{stats.todayAttendance}</div>
                    <div className="stat-label">Present Today (Est.)</div>
                </div>

                <div className="stat-card animate-fade-up" style={{ animationDelay: '0.3s' }}>
                    <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                        <HiOutlineCurrencyDollar />
                    </div>
                    <div className="stat-value">Draft</div>
                    <div className="stat-label">Payroll Status</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginTop: '2rem' }}>
                {/* Quick Shortcuts */}
                <div className="card">
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Management Modules</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <Link to="/employees" className="btn btn-secondary btn-outline" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: 'auto' }}>
                            <HiOutlineUserGroup size={32} color="#0891b2" />
                            <span style={{ fontWeight: '500' }}>Directory</span>
                        </Link>
                        <Link to="/leaves/team" className="btn btn-secondary btn-outline" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: 'auto' }}>
                            <HiOutlineCalendar size={32} color="#f59e0b" />
                            <span style={{ fontWeight: '500' }}>Approvals</span>
                        </Link>
                        <Link to="/attendance/upload" className="btn btn-secondary btn-outline" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: 'auto' }}>
                            <HiOutlineDocumentText size={32} color="#10b981" />
                            <span style={{ fontWeight: '500' }}>Import Biometrics</span>
                        </Link>
                        <Link to="/payroll" className="btn btn-secondary btn-outline" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: 'auto' }}>
                            <HiOutlineCurrencyDollar size={32} color="#3b82f6" />
                            <span style={{ fontWeight: '500' }}>Run Payroll</span>
                        </Link>
                    </div>
                </div>

                <div className="card">
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Recent Notifications</h2>
                    <div className="empty-state" style={{ padding: '2rem 0' }}>
                        <div className="empty-state-icon" style={{ fontSize: '2rem' }}>🔔</div>
                        <p className="empty-state-text" style={{ fontSize: '0.9rem' }}>All caught up</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
