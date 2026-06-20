import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getEmployees, deleteEmployee } from '../../api/employeeApi';
import toast from 'react-hot-toast';

export default function EmployeeList() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { user } = useAuth();

    const userRole = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const canModify = userRole === 'admin' || userRole === 'hr';

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const data = await getEmployees();
            setEmployees(data.data || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to fetch employees');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this employee?')) {
            try {
                await deleteEmployee(id);
                toast.success('Employee deleted successfully');
                fetchEmployees();
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to delete employee');
            }
        }
    };

    const filteredEmployees = employees.filter(emp =>
        (emp.firstName + ' ' + emp.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="employee-list-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Employees</h1>
                    <p className="page-subtitle">Manage your company directory and employee profiles</p>
                </div>
                {canModify && (
                    <Link to="/employees/new" className="btn btn-primary">
                        <span className="btn-icon">+</span> Add Employee
                    </Link>
                )}
            </div>

            <div className="card">
                <div className="search-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <input
                        type="text"
                        placeholder="Search by name, ID, or department..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="form-control"
                        style={{ maxWidth: '400px' }}
                    />
                </div>

                {loading ? (
                    <div className="page-loader"><div className="loader"></div></div>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Emp ID</th>
                                    <th>Name</th>
                                    <th>Department</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No employees found.</td>
                                    </tr>
                                ) : (
                                    filteredEmployees.map(emp => (
                                        <tr key={emp._id}>
                                            <td><span className="badge" style={{ background: 'var(--bg-tertiary)' }}>{emp.employeeId}</span></td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: emp.profilePhoto ? 'transparent' : 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', overflow: 'hidden', flexShrink: 0, fontSize: '0.8rem' }}>
                                                        {emp.profilePhoto ? (
                                                            <img src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '')}${emp.profilePhoto}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <>{emp.firstName.charAt(0)}{emp.lastName.charAt(0)}</>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '500' }}>{emp.firstName} {emp.lastName}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.designation}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{emp.department}</td>
                                            <td>{emp.contractType}</td>
                                            <td>
                                                <span className={`badge ${emp.isActive ? 'badge-success' : 'badge-danger'}`}>
                                                    {emp.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <Link to={`/employees/${emp._id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>View</Link>
                                                    {canModify && (
                                                        <>
                                                            <Link to={`/employees/${emp._id}/edit`} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Edit</Link>
                                                            <button onClick={() => handleDelete(emp._id)} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Del</button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
