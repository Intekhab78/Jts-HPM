import { useState, useEffect } from 'react';
import { roleAPI } from '../../api';
import toast from 'react-hot-toast';

const MODULES = [
    { id: 'employees', label: 'Employees' },
    { id: 'leaves', label: 'Leaves' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'travel', label: 'Travel & Expense' },
    { id: 'appraisal', label: 'Appraisal' },
    { id: 'roles', label: 'Roles & Access' }
];

const ACTIONS = [
    { id: 'view', label: 'View' },
    { id: 'modify', label: 'Modify' },
    { id: 'delete', label: 'Delete' },
    { id: 'approve', label: 'Approve' }
];

export default function RolesPermissionMatrix() {
    const [roles, setRoles] = useState([]);
    const [selectedRoleId, setSelectedRoleId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // permissions state matching the selected role
    const [permissions, setPermissions] = useState([]);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            const res = await roleAPI.getRoles();
            setRoles(res.data.data);
            if (res.data.data.length > 0 && !selectedRoleId) {
                const firstRole = res.data.data[0];
                setSelectedRoleId(firstRole._id);
                setPermissions(firstRole.permissions || []);
            }
        } catch (error) {
            toast.error('Failed to load roles');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleSelect = (roleId) => {
        if (roleId === selectedRoleId) return;
        const role = roles.find(r => r._id === roleId);
        setSelectedRoleId(roleId);
        setPermissions(role ? [...(role.permissions || [])] : []);
    };

    const handleCheckboxChange = (module, action, isChecked) => {
        setPermissions(currentPerms => {
            const newPerms = [...currentPerms];
            const modIndex = newPerms.findIndex(p => p.module === module);

            if (modIndex >= 0) {
                // Update existing module
                newPerms[modIndex] = {
                    ...newPerms[modIndex],
                    actions: {
                        ...newPerms[modIndex].actions,
                        [action]: isChecked
                    }
                };
            } else {
                // Add new module if it wasn't there
                const newActions = ACTIONS.reduce((acc, a) => ({ ...acc, [a.id]: false }), {});
                newActions[action] = isChecked;

                newPerms.push({
                    module,
                    actions: newActions
                });
            }
            return newPerms;
        });
    };

    const getActionValue = (module, action) => {
        const modPerm = permissions.find(p => p.module === module);
        return modPerm ? !!modPerm.actions[action] : false;
    };

    const handleSave = async () => {
        if (!selectedRoleId) return;
        try {
            setSaving(true);
            await roleAPI.updatePermissions(selectedRoleId, { permissions });

            // Sync local cache
            setRoles(roles.map(r => r._id === selectedRoleId ? { ...r, permissions } : r));
            toast.success('Permissions saved successfully');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update permissions');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-loader"><div className="loader"></div></div>;

    const selectedRoleData = roles.find(r => r._id === selectedRoleId);

    return (
        <div className="permission-matrix-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Roles & Permissions Matrix</h1>
                    <p className="page-subtitle">Configure granular access rights (View, Modify, Delete, Approve) for each module.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
                {/* Left side: Roles List */}
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', fontWeight: '600' }}>
                        System Roles
                    </div>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {roles.map(role => (
                            <li
                                key={role._id}
                                onClick={() => handleRoleSelect(role._id)}
                                style={{
                                    padding: '1rem',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--border-color)',
                                    background: selectedRoleId === role._id ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                                    borderLeft: selectedRoleId === role._id ? '4px solid var(--primary-color)' : '4px solid transparent',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <span style={{ textTransform: 'capitalize', fontWeight: selectedRoleId === role._id ? '600' : '400' }}>
                                    {role.name}
                                </span>
                                {role.isSystem && <span style={{ fontSize: '0.75rem', background: '#ef4444', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>System</span>}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Right Side: Matrix Editor */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                        <h2 style={{ fontSize: '1.2rem', margin: 0, textTransform: 'capitalize' }}>
                            {selectedRoleData?.name} Permissions
                        </h2>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                    <div className="table-responsive">
                        <table className="table" style={{ minWidth: '600px' }}>
                            <thead>
                                <tr>
                                    <th>Module</th>
                                    {ACTIONS.map(a => (
                                        <th key={a.id} style={{ textAlign: 'center' }}>{a.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {MODULES.map(module => (
                                    <tr key={module.id}>
                                        <td style={{ fontWeight: '500' }}>{module.label}</td>
                                        {ACTIONS.map(action => (
                                            <td key={`${module.id}-${action.id}`} style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={getActionValue(module.id, action.id)}
                                                    onChange={(e) => handleCheckboxChange(module.id, action.id, e.target.checked)}
                                                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                                    disabled={selectedRoleData?.isSystem && selectedRoleData?.name === 'admin'}
                                                    title={selectedRoleData?.isSystem && selectedRoleData?.name === 'admin' ? "Admin role rights cannot be removed" : null}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {selectedRoleData?.isSystem && selectedRoleData?.name === 'admin' && (
                            <p style={{ marginTop: '1rem', color: '#ef4444', fontSize: '0.9rem' }}>
                                * The core 'admin' role automatically requires full control over the system to prevent accidental lockouts. You may create separate custom roles for lower-level administration.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
