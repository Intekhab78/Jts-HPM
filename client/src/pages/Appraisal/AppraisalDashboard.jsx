import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAppraisals, createAppraisal, updateAppraisal } from '../../api/appraisalApi';
import { getEmployees } from '../../api/employeeApi';
import toast from 'react-hot-toast';

export default function AppraisalDashboard() {
    const { user } = useAuth();
    const [appraisals, setAppraisals] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createForm, setCreateForm] = useState({ employee: '', period: '2026 Annual', type: 'Annual' });

    // For handling the active appraisal being reviewed
    const [activeAppraisal, setActiveAppraisal] = useState(null);

    const userRole = typeof user?.role === 'object' ? user?.role?.name : user?.role;

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const aRes = await getAppraisals();
            setAppraisals(aRes.data);

            if (userRole !== 'employee') {
                const eRes = await getEmployees();
                setEmployees(eRes.data);
            }
        } catch (error) {
            toast.error('Failed to load appraisals');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            // Default setup with an empty KPI slot to get started
            const payload = { ...createForm, kpis: [{ metric: 'Overall Performance', weight: 100 }], manager: user._id };
            await createAppraisal(payload);
            toast.success('Appraisal cycle initiated');
            setShowCreateForm(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to create appraisal');
        }
    };

    // --- Active Review Handlers ---

    const handleKpiChange = (idx, field, value) => {
        const updatedKpis = [...activeAppraisal.kpis];
        updatedKpis[idx][field] = value;
        setActiveAppraisal({ ...activeAppraisal, kpis: updatedKpis });
    };

    const addKpiRow = () => {
        setActiveAppraisal({
            ...activeAppraisal,
            kpis: [...activeAppraisal.kpis, { metric: '', weight: 0 }]
        });
    };

    const removeKpiRow = (idx) => {
        const updatedKpis = [...activeAppraisal.kpis];
        updatedKpis.splice(idx, 1);
        setActiveAppraisal({ ...activeAppraisal, kpis: updatedKpis });
    };

    const saveAppraisal = async (newStatus) => {
        try {
            // Validate weights equal 100
            const totalWeight = activeAppraisal.kpis.reduce((acc, curr) => acc + Number(curr.weight), 0);
            if (activeAppraisal.status === 'Draft' && totalWeight !== 100) {
                return toast.error(`Total KPI weight must be 100%. Current: ${totalWeight}%`);
            }

            const payload = {
                kpis: activeAppraisal.kpis,
                selfComments: activeAppraisal.selfComments,
                managerComments: activeAppraisal.managerComments,
                status: newStatus || activeAppraisal.status
            };

            await updateAppraisal(activeAppraisal._id, payload);
            toast.success(newStatus ? `Moved to ${newStatus}` : 'Saved successfully');
            setActiveAppraisal(null);
            fetchData();
        } catch (error) {
            toast.error('Failed to save assessment');
        }
    };

    // Render logic for the different list views vs detail views
    if (activeAppraisal) {
        const isManager = userRole !== 'employee';
        const isSelfAssess = activeAppraisal.status === 'Self-Assessment' && !isManager;
        const isManagerReview = activeAppraisal.status === 'Manager Review' && isManager;
        const isDraft = activeAppraisal.status === 'Draft' && isManager;

        return (
            <div className="appraisal-detail animate-fade-in">
                <button className="btn btn-secondary btn-outline" onClick={() => setActiveAppraisal(null)} style={{ marginBottom: '1rem' }}>
                    ← Back to List
                </button>

                <div className="card">
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Performance Review: {activeAppraisal.period}</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                        Employee: <strong>{activeAppraisal.employee.firstName} {activeAppraisal.employee.lastName}</strong> |
                        Type: {activeAppraisal.type} | Status: <span className="badge badge-primary">{activeAppraisal.status}</span>
                    </p>

                    <h3 style={{ marginBottom: '1rem' }}>Key Performance Indicators (KPIs)</h3>
                    <div className="table-responsive" style={{ marginBottom: '2rem' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Metric / Goal</th>
                                    <th>Weight (%)</th>
                                    <th>Self Score (1-5)</th>
                                    <th>Manager Score (1-5)</th>
                                    {isDraft && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {activeAppraisal.kpis.map((kpi, index) => (
                                    <tr key={index}>
                                        <td>
                                            <input
                                                type="text" className="form-control"
                                                value={kpi.metric}
                                                onChange={(e) => handleKpiChange(index, 'metric', e.target.value)}
                                                disabled={!isDraft}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number" className="form-control"
                                                value={kpi.weight}
                                                onChange={(e) => handleKpiChange(index, 'weight', parseInt(e.target.value))}
                                                disabled={!isDraft}
                                                style={{ width: '80px' }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number" className="form-control" min={1} max={5}
                                                value={kpi.selfScore || ''}
                                                onChange={(e) => handleKpiChange(index, 'selfScore', parseInt(e.target.value))}
                                                disabled={!isSelfAssess}
                                                placeholder={isSelfAssess ? "1-5" : "-"}
                                                style={{ width: '80px' }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number" className="form-control" min={1} max={5}
                                                value={kpi.managerScore || ''}
                                                onChange={(e) => handleKpiChange(index, 'managerScore', parseInt(e.target.value))}
                                                disabled={!isManagerReview}
                                                placeholder={isManagerReview ? "1-5" : "-"}
                                                style={{ width: '80px' }}
                                            />
                                        </td>
                                        {isDraft && (
                                            <td>
                                                <button className="btn btn-secondary btn-outline" style={{ color: '#ef4444', borderColor: '#ef4444', padding: '0.2rem 0.6rem' }} onClick={() => removeKpiRow(index)}>X</button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {isDraft && (
                            <button className="btn btn-secondary btn-outline" style={{ marginTop: '1rem' }} onClick={addKpiRow}>+ Add KPI</button>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                        <div>
                            <label className="form-label">Employee Comments</label>
                            <textarea
                                className="form-control" rows={4}
                                value={activeAppraisal.selfComments || ''}
                                onChange={(e) => setActiveAppraisal({ ...activeAppraisal, selfComments: e.target.value })}
                                disabled={!isSelfAssess}
                                placeholder="Employee self-reflection..."
                            />
                        </div>
                        <div>
                            <label className="form-label">Manager Comments</label>
                            <textarea
                                className="form-control" rows={4}
                                value={activeAppraisal.managerComments || ''}
                                onChange={(e) => setActiveAppraisal({ ...activeAppraisal, managerComments: e.target.value })}
                                disabled={!isManagerReview}
                                placeholder="Manager evaluation notes..."
                            />
                        </div>
                    </div>

                    {/* Action Buttons based on state */}
                    <div style={{ padding: '1.5rem', background: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', gap: '1rem', alignItems: 'center' }}>

                        {isDraft && <>
                            <button className="btn btn-primary" onClick={() => saveAppraisal()}>Save Draft</button>
                            <button className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }} onClick={() => saveAppraisal('Self-Assessment')}>Send to Employee for Self-Assessment</button>
                        </>}

                        {isSelfAssess && <>
                            <button className="btn btn-primary" onClick={() => saveAppraisal()}>Save Progress</button>
                            <button className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }} onClick={() => saveAppraisal('Manager Review')}>Submit to Manager</button>
                        </>}

                        {isManagerReview && <>
                            <button className="btn btn-primary" onClick={() => saveAppraisal()}>Save Progress</button>
                            <button className="btn btn-primary" style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }} onClick={() => saveAppraisal('Finalized')}>Finalize Rating</button>
                        </>}

                        {activeAppraisal.status === 'Finalized' && (
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                Overall Rating: <span style={{ color: activeAppraisal.overallRating > 3 ? '#10b981' : '#f59e0b' }}>{activeAppraisal.overallRating} / 5</span>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="appraisal-dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Performance Appraisals</h1>
                    <p className="page-subtitle">Track KPIs, self-assessments, and review cycles</p>
                </div>
                {['admin', 'hr', 'manager'].includes(userRole) && (
                    <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn btn-primary">
                        + Initiate Review Cycle
                    </button>
                )}
            </div>

            {showCreateForm && (
                <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--primary-color)' }}>
                    <form onSubmit={handleCreate}>
                        <h3 style={{ marginBottom: '1.5rem' }}>Create New Appraisal Cycle</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Select Employee</label>
                                <select className="form-control" required value={createForm.employee} onChange={e => setCreateForm({ ...createForm, employee: e.target.value })}>
                                    <option value="">-- Choose --</option>
                                    {employees.map(e => <option key={e._id} value={e._id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Review Period</label>
                                <input type="text" className="form-control" required placeholder="e.g. Q1 2026" value={createForm.period} onChange={e => setCreateForm({ ...createForm, period: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Evaluation Type</label>
                                <select className="form-control" required value={createForm.type} onChange={e => setCreateForm({ ...createForm, type: e.target.value })}>
                                    <option value="Annual">Annual</option>
                                    <option value="Probation">Probationary</option>
                                    <option value="Project">Project-based</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                            <button type="submit" className="btn btn-primary">Create Draft</button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                {userRole !== 'employee' && <th>Employee</th>}
                                <th>Period</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Overall Rating / 5</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appraisals.map(a => (
                                <tr key={a._id}>
                                    {userRole !== 'employee' && <td>
                                        <div style={{ fontWeight: '500' }}>{a.employee?.firstName} {a.employee?.lastName}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.employee?.designation}</div>
                                    </td>}
                                    <td>{a.period}</td>
                                    <td>{a.type}</td>
                                    <td>
                                        <span className={`badge badge-${a.status === 'Finalized' ? 'success' :
                                            a.status === 'Draft' ? 'secondary' : 'warning'
                                            }`}>
                                            {a.status}
                                        </span>
                                    </td>
                                    <td>
                                        {a.overallRating ? (
                                            <span style={{ fontWeight: 'bold', color: a.overallRating >= 3.5 ? '#10b981' : a.overallRating < 2.5 ? '#ef4444' : '#f59e0b' }}>
                                                {a.overallRating}
                                            </span>
                                        ) : <span style={{ color: 'var(--text-muted)' }}>Pending</span>}
                                    </td>
                                    <td>
                                        <button className="btn btn-secondary btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setActiveAppraisal(a)}>
                                            {
                                                (a.status === 'Draft' && userRole !== 'employee') ? 'Setup KPIs' :
                                                    (a.status === 'Self-Assessment' && userRole === 'employee') ? 'Score Self' :
                                                        (a.status === 'Manager Review' && userRole !== 'employee') ? 'Review' : 'View'
                                            }
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {appraisals.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No appraisals found.</p>}
                </div>
            </div>
        </div>
    );
}
