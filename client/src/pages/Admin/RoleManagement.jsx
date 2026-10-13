import { useState, useEffect } from 'react';
import { authAPI, roleAPI } from '../../api';
import toast from 'react-hot-toast';

export default function RoleManagement() {
    const [users, setUsers] = useState([]);
    const [rolesList, setRolesList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [newAdminPassword, setNewAdminPassword] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [usersRes, rolesRes] = await Promise.all([
                authAPI.getUsers(),
                roleAPI.getRoles()
            ]);
            setUsers(usersRes.data.data);
            setRolesList(rolesRes.data.data);
        } catch (error) {
            toast.error('Failed to load user list');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            setUpdating(userId);
            await authAPI.updateUserRole(userId, { role: newRole });
            toast.success('Role updated successfully');

            // Find the updated role object to merge
            const updatedRoleObj = rolesList.find(r => r._id === newRole);
            // Update local state
            setUsers(users.map(u => u._id === userId ? { ...u, role: updatedRoleObj } : u));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update user role');
        } finally {
            setUpdating(null);
        }
    };

    const openPasswordModal = (user) => {
        setSelectedUser(user);
        setNewAdminPassword('');
        setPasswordModalOpen(true);
    };

    const handleSavePassword = async () => {
        if (!newAdminPassword || newAdminPassword.length < 6) {
            return toast.error('Password must be at least 6 characters');
        }

        try {
            await authAPI.resetUserPassword(selectedUser._id, { newPassword: newAdminPassword });
            toast.success(`Password for ${selectedUser.name} has been updated`);
            setPasswordModalOpen(false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to change password');
        }
    };

    if (loading) return <div className="page-loader"><div className="loader"></div></div>;



    return (
        <div className="role-management-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Roles & Access Management</h1>
                    <p className="page-subtitle">Assign system privileges and portal access roles to registered users.</p>
                </div>
            </div>

            <div className="card">
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Current Role</th>
                                <th>Status</th>
                                <th>Change Role</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user._id}>
                                    <td style={{ fontWeight: '500' }}>{user.name}</td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={`badge`} style={{
                                            background: user.role?.name === 'admin' ? '#ef4444' :
                                                user.role?.name === 'hr' ? '#8b5cf6' :
                                                    user.role?.name === 'finance' ? '#f59e0b' :
                                                        user.role?.name === 'manager' ? '#3b82f6' : '#10b981',
                                            color: '#fff',
                                            textTransform: 'capitalize'
                                        }}>
                                            {user.role?.name || 'Unknown'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="status-badge status-approved">{user.isActive ? 'Active' : 'Inactive'}</span>
                                    </td>
                                    <td>
                                        <select
                                            className="form-control"
                                            style={{ width: 'auto', display: 'inline-block', padding: '0.3rem 0.5rem', fontSize: '0.9rem' }}
                                            value={user.role?._id || ''}
                                            onChange={(e) => handleRoleChange(user._id, e.target.value)}
                                            disabled={updating === user._id}
                                        >
                                            {rolesList.map(r => (
                                                <option key={r._id} value={r._id}>
                                                    {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                        {updating === user._id && <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saving...</span>}
                                    </td>
                                    <td>
                                        {user.role?.name !== 'admin' ? (
                                            <button
                                                className="btn btn-secondary btn-outline"
                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                                onClick={() => openPasswordModal(user)}
                                            >
                                                Change Password
                                            </button>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Protected</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Password Change Modal */}
            {passwordModalOpen && selectedUser && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card glass" style={{ width: '400px', padding: '2rem', animation: 'fadeUp 0.3s ease' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Change User Password</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Set a new password for <strong style={{ color: 'var(--text-primary)' }}>{selectedUser.name}</strong>
                        </p>
                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <input
                                type="text" /* Using text type so Admin can see what they are typing */
                                className="form-control"
                                value={newAdminPassword}
                                onChange={(e) => setNewAdminPassword(e.target.value)}
                                placeholder="Enter password (min 6 chars)"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-outline" onClick={() => setPasswordModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSavePassword}>Save Password</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
