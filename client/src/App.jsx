import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/Layout/AppLayout';
import ProtectedRoute from './components/Common/ProtectedRoute';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import EmployeeList from './pages/Employee/EmployeeList';
import EmployeeForm from './pages/Employee/EmployeeForm';
import EmployeeProfile from './pages/Employee/EmployeeProfile';
import LeaveDashboard from './pages/Leave/LeaveDashboard';
import LeaveApply from './pages/Leave/LeaveApply';
import TeamLeaves from './pages/Leave/TeamLeaves';
import AttendanceDashboard from './pages/Attendance/AttendanceDashboard';
import AttendanceUpload from './pages/Attendance/AttendanceUpload';
import PayrollDashboard from './pages/Payroll/PayrollDashboard';
import GratuityCalculator from './pages/Payroll/GratuityCalculator';
import TravelExpenseDashboard from './pages/TravelExpense/TravelExpenseDashboard';
import AdvanceDashboard from './pages/Advance/AdvanceDashboard';
import AppraisalDashboard from './pages/Appraisal/AppraisalDashboard';
import RoleManagement from './pages/Admin/RoleManagement';
import RolesPermissionMatrix from './pages/Admin/RolesPermissionMatrix';
import HolidayCalendar from './pages/Admin/HolidayCalendar';
import CompanyMaster from './pages/Admin/CompanyMaster';
import LocationMaster from './pages/Admin/LocationMaster';
import PayElementMaster from './pages/Admin/PayElementMaster';
import LeaveSettings from './pages/Admin/LeaveSettings';
import AttendanceSettings from './pages/Admin/AttendanceSettings';
import WorkingHourSettings from './pages/Admin/WorkingHourSettings';
import ReportsDashboard from './pages/Reports/ReportsDashboard';
import HelpCenter from './pages/Help/HelpCenter';
import './index.css';

// Placeholder pages for future modules
function PlaceholderPage({ title }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">This module is coming soon in the next phase</p>
        </div>
      </div>
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">🚧</div>
          <p className="empty-state-text">Under Construction</p>
          <p className="empty-state-sub">This module will be built in an upcoming phase</p>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-loader" style={{ minHeight: '100vh' }}>
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />

      {/* Protected - App Layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<EmployeeList />} />
        <Route path="employees/new" element={<EmployeeForm />} />
        <Route path="employees/:id" element={<EmployeeProfile />} />
        <Route path="employees/:id/edit" element={<EmployeeForm />} />
        <Route path="leaves" element={<LeaveDashboard />} />
        <Route path="leaves/apply" element={<LeaveApply />} />
        <Route path="leaves/team" element={<TeamLeaves />} />
        <Route path="attendance" element={<AttendanceDashboard />} />
        <Route path="attendance/upload" element={<AttendanceUpload />} />
        <Route path="attendance/manual" element={<PlaceholderPage title="Manual Attendance Entry" />} />
        <Route path="payroll" element={<PayrollDashboard />} />
        <Route path="gratuity" element={<GratuityCalculator />} />
        <Route path="travel" element={<TravelExpenseDashboard />} />
        <Route path="advance" element={<AdvanceDashboard />} />
        <Route path="appraisal" element={<AppraisalDashboard />} />
        <Route path="holidays" element={<HolidayCalendar />} />
        <Route path="companies" element={<CompanyMaster />} />
        <Route path="locations" element={<LocationMaster />} />
        <Route path="pay-elements" element={<PayElementMaster />} />
        <Route path="leave-settings" element={<LeaveSettings />} />
        <Route path="attendance-settings" element={<AttendanceSettings />} />
        <Route path="approvals" element={<PlaceholderPage title="Approvals" />} />
        <Route path="roles" element={<RoleManagement />} />
        <Route path="permissions" element={<RolesPermissionMatrix />} />
        <Route path="settings/working-hours" element={<WorkingHourSettings />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="reports" element={<ReportsDashboard />} />
        <Route path="help" element={<HelpCenter />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid rgba(148, 163, 184, 0.12)',
              borderRadius: '10px',
              fontSize: '0.875rem',
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
