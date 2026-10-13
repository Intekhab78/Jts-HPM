import { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';

export default function ShiftRoster() {
    const [shifts, setShifts] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal & form states
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentShiftId, setCurrentShiftId] = useState(null);
    const [shiftFormData, setShiftFormData] = useState({
        name: '',
        startTime: '09:00',
        endTime: '18:00',
        lunchDuration: 30,
        lateGracePeriod: 15,
        earlyGracePeriod: 30,
        workingType: 'Standard',
        flexiHoursLimit: 8
    });

    // Employee mapping states
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [selectedShiftForMap, setSelectedShiftForMap] = useState('');
    const [mappingSubmitting, setMappingSubmitting] = useState(false);
    const [autoMappingSubmitting, setAutoMappingSubmitting] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [shiftsRes, empsRes] = await Promise.all([
                api.get('/shifts'),
                api.get('/employees')
            ]);
            setShifts(shiftsRes.data.data || []);
            setEmployees(empsRes.data.data || empsRes.data || []);
        } catch (error) {
            toast.error('Failed to load roster configuration data');
        } finally {
            setLoading(false);
        }
    };

    const handleShiftFormChange = (e) => {
        const { name, value } = e.target;
        setShiftFormData(prev => ({ ...prev, [name]: value }));
    };

    const openCreateShiftModal = () => {
        setEditMode(false);
        setCurrentShiftId(null);
        setShiftFormData({
            name: '',
            startTime: '09:00',
            endTime: '18:00',
            lunchDuration: 30,
            lateGracePeriod: 15,
            earlyGracePeriod: 30,
            workingType: 'Standard',
            flexiHoursLimit: 8
        });
        setIsShiftModalOpen(true);
    };

    const openEditShiftModal = (shift) => {
        setEditMode(true);
        setCurrentShiftId(shift._id);
        setShiftFormData({
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            lunchDuration: shift.lunchDuration || 30,
            lateGracePeriod: shift.lateGracePeriod || 15,
            earlyGracePeriod: shift.earlyGracePeriod || 30,
            workingType: shift.workingType || 'Standard',
            flexiHoursLimit: shift.flexiHoursLimit || 8
        });
        setIsShiftModalOpen(true);
    };

    const handleShiftSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editMode) {
                await api.put(`/shifts/${currentShiftId}`, shiftFormData);
                toast.success('Shift schedule updated successfully!');
            } else {
                await api.post('/shifts', shiftFormData);
                toast.success('New shift schedule created successfully!');
            }
            setIsShiftModalOpen(false);
            fetchInitialData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to process shift schedule action');
        }
    };

    const handleShiftDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this shift schedule? Linked employees will have their shift assignments cleared.")) return;
        try {
            await api.delete(`/shifts/${id}`);
            toast.success('Shift schedule deleted successfully!');
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to delete shift schedule');
        }
    };

    const handleSelectEmployee = (empId) => {
        setSelectedEmployees(prev => 
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    };

    const handleSelectAllEmployees = (e) => {
        if (e.target.checked) {
            setSelectedEmployees(employees.map(emp => emp._id));
        } else {
            setSelectedEmployees([]);
        }
    };

    const handleRosterGroupChange = async (employeeId, groupValue) => {
        try {
            await api.put(`/employees/${employeeId}`, { rosterGroup: groupValue });
            toast.success('Employee Roster category updated successfully!');
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to update Employee Roster category');
        }
    };

    const handleManualMap = async () => {
        if (selectedEmployees.length === 0) {
            toast.error('Please select at least one employee to map.');
            return;
        }
        if (!selectedShiftForMap) {
            toast.error('Please select a shift schedule to map.');
            return;
        }

        try {
            setMappingSubmitting(true);
            await api.post(`/shifts/${selectedShiftForMap}/map`, { employeeIds: selectedEmployees });
            toast.success(`Successfully mapped shift for ${selectedEmployees.length} employees.`);
            setSelectedEmployees([]);
            setSelectedShiftForMap('');
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to map shift schedule for selected employees');
        } finally {
            setMappingSubmitting(false);
        }
    };

    const handleAutoAssignRoster = async () => {
        if (!window.confirm("Auto-Roster mapping will analyze the Roster Groups (Office, Retail, Warehouse) of all employees and automatically match them to corresponding shifts. Do you want to proceed?")) return;
        try {
            setAutoMappingSubmitting(true);
            const res = await api.post('/shifts/auto-map');
            toast.success(`Auto Shift assignment completed! Mapped: Office (${res.data.summary.officeAssigned}), Retail (${res.data.summary.retailAssigned}), Warehouse (${res.data.summary.warehouseAssigned}).`);
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to execute auto shift mapping');
        } finally {
            setAutoMappingSubmitting(false);
        }
    };

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-0 text-gray-800">Shift & Roster Scheduling</h1>
                    <p className="text-muted small mb-0">Create standard/flexi shift templates and map employees to rosters.</p>
                </div>
                <div className="d-flex" style={{ gap: '10px' }}>
                    <button className="btn btn-outline-primary" onClick={handleAutoAssignRoster} disabled={autoMappingSubmitting}>
                        {autoMappingSubmitting ? 'Auto Mapping...' : '⚡ Auto-Assign Shift Roster'}
                    </button>
                    <button className="btn btn-primary" onClick={openCreateShiftModal}>
                        + Create Shift Template
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status" />
                </div>
            ) : (
                <div className="row">
                    {/* Shift Templates List */}
                    <div className="col-lg-4 mb-4">
                        <div className="card shadow h-100">
                            <div className="card-header bg-light">
                                <h5 className="mb-0 font-weight-bold" style={{ fontSize: '1rem' }}>Shift Templates</h5>
                            </div>
                            <div className="card-body p-0">
                                {shifts.length === 0 ? (
                                    <div className="text-center py-4 text-muted small">No shift templates created yet.</div>
                                ) : (
                                    <div className="list-group list-group-flush">
                                        {shifts.map(shift => (
                                            <div key={shift._id} className="list-group-item p-3">
                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <span className="font-weight-bold text-primary" style={{ fontSize: '0.95rem' }}>{shift.name}</span>
                                                    <span className="badge badge-secondary">{shift.workingType}</span>
                                                </div>
                                                <div className="text-muted small mb-3">
                                                    <strong>Timings:</strong> {shift.startTime} – {shift.endTime}<br />
                                                    <strong>Lunch Break:</strong> {shift.lunchDuration} min<br />
                                                    <strong>Late Grace:</strong> {shift.lateGracePeriod} min
                                                </div>
                                                <div className="d-flex" style={{ gap: '8px' }}>
                                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => openEditShiftModal(shift)}>Edit</button>
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleShiftDelete(shift._id)}>Delete</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Employee Roster Mappings */}
                    <div className="col-lg-8 mb-4">
                        <div className="card shadow h-100">
                            <div className="card-header bg-light d-flex justify-content-between align-items-center">
                                <h5 className="mb-0 font-weight-bold" style={{ fontSize: '1rem' }}>Employee Roster Mappings</h5>
                                {selectedEmployees.length > 0 && (
                                    <div className="d-flex align-items-center" style={{ gap: '8px' }}>
                                        <select 
                                            className="form-control form-control-sm" 
                                            style={{ width: '180px' }} 
                                            value={selectedShiftForMap}
                                            onChange={(e) => setSelectedShiftForMap(e.target.value)}
                                        >
                                            <option value="">Map Selected To...</option>
                                            {shifts.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                        </select>
                                        <button className="btn btn-sm btn-primary" onClick={handleManualMap} disabled={mappingSubmitting}>
                                            Apply Map
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-hover mb-0">
                                        <thead className="bg-light">
                                            <tr>
                                                <th style={{ width: '40px' }} className="text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        onChange={handleSelectAllEmployees} 
                                                        checked={selectedEmployees.length === employees.length && employees.length > 0} 
                                                    />
                                                </th>
                                                <th>Employee Name</th>
                                                <th>Roster Group</th>
                                                <th>Assigned Shift Timings</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employees.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-5 text-muted">No employees registered in system.</td>
                                                </tr>
                                            ) : (
                                                employees.map(emp => (
                                                    <tr key={emp._id}>
                                                        <td className="text-center">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedEmployees.includes(emp._id)} 
                                                                onChange={() => handleSelectEmployee(emp._id)} 
                                                            />
                                                        </td>
                                                        <td>
                                                            <div className="font-weight-bold">{emp.firstName} {emp.lastName}</div>
                                                            <small className="text-muted">{emp.employeeId} • {emp.department}</small>
                                                        </td>
                                                        <td>
                                                            <select 
                                                                className="form-control form-control-sm font-weight-bold" 
                                                                style={{ width: '130px', color: emp.rosterGroup === 'None' ? 'var(--text-secondary)' : 'var(--primary-color)' }}
                                                                value={emp.rosterGroup || 'None'}
                                                                onChange={(e) => handleRosterGroupChange(emp._id, e.target.value)}
                                                            >
                                                                <option value="None">None</option>
                                                                <option value="Office">Office</option>
                                                                <option value="Retail">Retail</option>
                                                                <option value="Warehouse">Warehouse</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            {emp.assignedShift ? (
                                                                <span className="badge badge-success p-2">
                                                                    {emp.assignedShift.name || 'Mapped'} ({emp.assignedShift.startTime} - {emp.assignedShift.endTime})
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted small">No shift assigned</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SHIFT CREATE / EDIT MODAL */}
            {isShiftModalOpen && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{editMode ? 'Edit Shift Template' : 'Create New Shift Template'}</h5>
                                <button type="button" className="close" onClick={() => setIsShiftModalOpen(false)}>
                                    <span>&times;</span>
                                </button>
                            </div>
                            <form onSubmit={handleShiftSubmit}>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label className="form-label font-weight-bold">Shift Name *</label>
                                        <input 
                                            type="text" 
                                            name="name" 
                                            value={shiftFormData.name} 
                                            onChange={handleShiftFormChange} 
                                            placeholder="e.g. Office Standard Shift, Retail Evening Shift" 
                                            className="form-control" 
                                            required 
                                        />
                                    </div>

                                    <div className="row">
                                        <div className="col-md-6 form-group">
                                            <label className="form-label font-weight-bold">Start Time *</label>
                                            <input 
                                                type="time" 
                                                name="startTime" 
                                                value={shiftFormData.startTime} 
                                                onChange={handleShiftFormChange} 
                                                className="form-control" 
                                                required 
                                            />
                                        </div>
                                        <div className="col-md-6 form-group">
                                            <label className="form-label font-weight-bold">End Time *</label>
                                            <input 
                                                type="time" 
                                                name="endTime" 
                                                value={shiftFormData.endTime} 
                                                onChange={handleShiftFormChange} 
                                                className="form-control" 
                                                required 
                                            />
                                        </div>
                                    </div>

                                    <div className="row">
                                        <div className="col-md-4 form-group">
                                            <label className="form-label font-weight-bold">Lunch (Min)</label>
                                            <input 
                                                type="number" 
                                                name="lunchDuration" 
                                                value={shiftFormData.lunchDuration} 
                                                onChange={handleShiftFormChange} 
                                                className="form-control" 
                                                min={0} 
                                            />
                                        </div>
                                        <div className="col-md-4 form-group">
                                            <label className="form-label font-weight-bold">Late Grace (Min)</label>
                                            <input 
                                                type="number" 
                                                name="lateGracePeriod" 
                                                value={shiftFormData.lateGracePeriod} 
                                                onChange={handleShiftFormChange} 
                                                className="form-control" 
                                                min={0} 
                                            />
                                        </div>
                                        <div className="col-md-4 form-group">
                                            <label className="form-label font-weight-bold">Early Out Grace (Min)</label>
                                            <input 
                                                type="number" 
                                                name="earlyGracePeriod" 
                                                value={shiftFormData.earlyGracePeriod} 
                                                onChange={handleShiftFormChange} 
                                                className="form-control" 
                                                min={0} 
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label font-weight-bold">Working Type *</label>
                                        <select 
                                            name="workingType" 
                                            value={shiftFormData.workingType} 
                                            onChange={handleShiftFormChange} 
                                            className="form-control" 
                                            required
                                        >
                                            <option value="Standard">Standard Schedule (Fixed Hours)</option>
                                            <option value="Flexi">Flexi Hour (Target Working Hours)</option>
                                        </select>
                                    </div>

                                    {shiftFormData.workingType === 'Flexi' && (
                                        <div className="form-group">
                                            <label className="form-label font-weight-bold">Flexi Hours Target (Limit) *</label>
                                            <input 
                                                type="number" 
                                                name="flexiHoursLimit" 
                                                value={shiftFormData.flexiHoursLimit} 
                                                onChange={handleShiftFormChange} 
                                                className="form-control" 
                                                min={1} 
                                                max={24} 
                                                required 
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsShiftModalOpen(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        {editMode ? 'Save Shift Settings' : 'Create Shift'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
