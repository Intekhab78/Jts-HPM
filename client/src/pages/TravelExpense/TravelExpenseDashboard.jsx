import { useState, useEffect } from 'react';
import { getBaseUrl } from '../../api/config';
import { useAuth } from '../../context/AuthContext';
import { getTravels, createTravel, updateTravelStatus, uploadAdvanceDocument, deleteTravel } from '../../api/travelApi';
import { getExpenses, createExpense, updateExpenseStatus, uploadExpenseReceipt, getSettlements, createSettlement, updateSettlementDraft, updateSettlementStatus, uploadSettlementReceipt } from '../../api/expenseApi';
import toast from 'react-hot-toast';

export default function TravelExpenseDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('travels'); // 'travels' | 'expenses' | 'settlements'
    const [travels, setTravels] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [settlements, setSettlements] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showTravelForm, setShowTravelForm] = useState(false);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [showSettlementForm, setShowSettlementForm] = useState(false);

    // Form states
    const [travelForm, setTravelForm] = useState({ purpose: '', destination: '', fromDate: '', toDate: '', estimatedBudget: '', requestedAdvance: '', notes: '' });
    const [advanceFile, setAdvanceFile] = useState(null);
    const [expenseForm, setExpenseForm] = useState({ travelRequest: '', category: 'Meal', amount: '', description: '' });
    const [receiptFile, setReceiptFile] = useState(null);

    // Settlement Form Array State
    const [settlementForm, setSettlementForm] = useState({
        draftId: null,
        travelRequest: '',
        additionalAmountRequested: '',
        expenses: [{ date: '', category: 'Airfare', amount: '', description: '', receipt: null }]
    });

    const [approvalModalData, setApprovalModalData] = useState(null);

    const userRole = typeof user?.role === 'object' ? user?.role?.name : user?.role;
    const isManager = user?.isManager || userRole === 'manager';

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (activeTab === 'travels') {
                const res = await getTravels();
                setTravels(res.data);
            } else if (activeTab === 'expenses') {
                const res = await getExpenses();
                setExpenses(res.data);
                // Pre-fetch travels to populate dropdown for linking expenses
                if (userRole === 'employee' && travels.length === 0) {
                    const tRes = await getTravels();
                    setTravels(tRes.data);
                }
            } else if (activeTab === 'settlements') {
                const res = await getSettlements();
                setSettlements(res.data);
                if (userRole === 'employee' && travels.length === 0) {
                    const tRes = await getTravels();
                    setTravels(tRes.data);
                }
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleTravelSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...travelForm, employee: user.employeeRef?._id || user.employeeRef };
            const res = await createTravel(payload);

            if (advanceFile && res.data?._id) {
                await uploadAdvanceDocument(res.data._id, advanceFile);
            }

            toast.success('Travel request submitted successfully');
            setShowTravelForm(false);
            setAdvanceFile(null);
            fetchData();
        } catch (error) {
            toast.error('Failed to submit request');
        }
    };

    const handleExpenseSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...expenseForm, employee: user.employeeRef?._id || user.employeeRef };
            const res = await createExpense(payload);
            if (receiptFile) {
                await uploadExpenseReceipt(res.data._id, receiptFile);
            }
            toast.success('Expense claim submitted');
            setShowExpenseForm(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to submit claim');
        }
    };

    const handleSettlementSubmit = async (e, actionType) => {
        if (e) e.preventDefault();
        try {
            const isDraft = actionType === 'draft';
            const payload = {
                employee: user.employeeRef?._id || user.employeeRef,
                travelRequest: settlementForm.travelRequest,
                additionalAmountRequested: Number(settlementForm.additionalAmountRequested) || 0,
                status: isDraft ? 'Draft' : 'Pending Manager',
                expenses: settlementForm.expenses.map(exp => ({
                    _id: exp._id,
                    date: exp.date,
                    category: exp.category,
                    amount: exp.amount,
                    description: exp.description
                }))
            };

            let res;
            if (settlementForm.draftId) {
                // Update existing draft
                res = await updateSettlementDraft(settlementForm.draftId, payload);
            } else {
                // Create new draft or new completed settlement
                res = await createSettlement(payload);
            }

            // Upload receipts for each row that has a newly selected file (not already uploaded strings)
            for (let i = 0; i < settlementForm.expenses.length; i++) {
                if (settlementForm.expenses[i].receipt && typeof settlementForm.expenses[i].receipt !== 'string') {
                    await uploadSettlementReceipt(res.data._id, i, settlementForm.expenses[i].receipt);
                }
            }

            if (isDraft) {
                toast.success('Draft saved successfully');
                fetchData();
                setShowSettlementForm(false);
            } else {
                toast.success('Advance Settlement submitted successfully');
                setShowSettlementForm(false);
                setSettlementForm({ draftId: null, travelRequest: '', additionalAmountRequested: '', expenses: [{ date: '', category: 'Airfare', amount: '', description: '', receipt: null }] });
                fetchData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to process settlement');
        }
    };

    const handleTravelRequestSelection = (travelId) => {
        // Automatically look for an existing draft for this trip
        const existingDraft = settlements.find(s => s.status === 'Draft' && s.travelRequest?._id === travelId);

        if (existingDraft) {
            const populatedExpenses = existingDraft.expenses && existingDraft.expenses.length > 0
                ? existingDraft.expenses.map(e => ({
                    _id: e._id,
                    date: e.date ? new Date(e.date).toISOString().split('T')[0] : '',
                    category: e.category,
                    amount: e.amount || '',
                    description: e.description || '',
                    receipt: e.receiptUrl || null
                }))
                : [{ date: '', category: 'Airfare', amount: '', description: '', receipt: null }];

            setSettlementForm({
                draftId: existingDraft._id,
                travelRequest: travelId,
                additionalAmountRequested: existingDraft.additionalAmountRequested || '',
                expenses: populatedExpenses
            });
            toast.success('Loaded existing draft');
        } else {
            setSettlementForm({
                draftId: null,
                travelRequest: travelId,
                additionalAmountRequested: '',
                expenses: [{ date: '', category: 'Airfare', amount: '', description: '', receipt: null }]
            });
        }
    };

    const handleAddSettlementRow = () => {
        setSettlementForm({
            ...settlementForm,
            expenses: [...settlementForm.expenses, { date: '', category: 'Airfare', amount: '', description: '', receipt: null }]
        });
    };

    const handleRemoveSettlementRow = (index) => {
        const newExpenses = [...settlementForm.expenses];
        newExpenses.splice(index, 1);
        setSettlementForm({ ...settlementForm, expenses: newExpenses });
    };

    const handleSettlementChange = (index, field, value) => {
        const newExpenses = [...settlementForm.expenses];
        newExpenses[index][field] = value;
        setSettlementForm({ ...settlementForm, expenses: newExpenses });
    };

    const handleAction = async (id, status, type, extraData = null) => {
        try {
            if (type === 'travel') {
                const payload = { status };
                if (status === 'Approved') {
                    // Ask finance to confirm the approved advance amount if they are the ones approving
                    const approvedAmt = window.prompt(`Enter Approved Advance Amount (Requested: ${extraData} AED)`, extraData);
                    if (approvedAmt !== null) {
                        payload.approvedAdvance = Number(approvedAmt);
                    } else {
                        return; // user cancelled the prompt
                    }
                }
                await updateTravelStatus(id, payload);
            } else if (type === 'expense') {
                await updateExpenseStatus(id, status);
            } else if (type === 'settlement') {
                const payload = { status };
                // Extra metadata from the modal handler (lineItems array, deduct)
                if (extraData && typeof extraData === 'object') {
                    payload.lineItems = extraData.lineItems;
                    payload.deductFromSalary = extraData.deductFromSalary;
                } else if (status === 'Approved' && extraData && extraData > 0 && ['finance', 'admin'].includes(userRole)) {
                    // Fallback simpler prompt if called directly without modal
                    const shouldDeduct = window.confirm(`Employee owes AED ${extraData}. Do you want to flag this for salary deduction?`);
                    payload.deductFromSalary = shouldDeduct;
                }
                await updateSettlementStatus(id, payload);
            }
            toast.success(`Marked as ${status}`);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        }
    };

    const handleDeleteTravel = async (id) => {
        if (!window.confirm('Are you sure you want to delete this travel request? This action cannot be undone.')) return;
        try {
            await deleteTravel(id);
            toast.success('Travel request deleted');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete travel request');
        }
    };

    const handleOpenApprovalModal = (settlement, mode) => {
        // Create editable local copy of line items for the modal
        const editableLines = settlement.expenses.map(exp => ({
            ...exp,
            _id: exp._id,
            status: exp.status === 'Pending' ? 'Approved' : exp.status, // Default to approve
            comments: exp.comments || ''
        }));

        setApprovalModalData({
            settlement,
            mode, // 'Pending Finance' for Manager, 'Approved' for Finance
            lines: editableLines
        });
    };

    const handleLineItemChange = (index, field, value) => {
        setApprovalModalData(prev => {
            const newLines = [...prev.lines];
            newLines[index][field] = value;
            return { ...prev, lines: newLines };
        });
    };

    const handleSubmitModalApproval = async () => {
        if (!approvalModalData) return;
        const { settlement, mode, lines } = approvalModalData;

        try {
            // Recalculate new theoretical balance based only on approved lines
            let newlyApprovedTotal = 0;
            lines.forEach(line => {
                if (line.status === 'Approved') newlyApprovedTotal += Number(line.amount);
            });
            const newBalance = (settlement.travelRequest?.approvedAdvance || 0) - newlyApprovedTotal;

            let deduct = false;
            if (mode === 'Approved' && newBalance > 0 && ['finance', 'admin'].includes(userRole)) {
                deduct = window.confirm(`Calculated Balance is AED ${newBalance} (Employee Owes). Do you want to flag this for salary deduction?`);
            }

            await handleAction(settlement._id, mode, 'settlement', { lineItems: lines, deductFromSalary: deduct });
            setApprovalModalData(null);
        } catch (error) {
            console.error(error);
        }
    };


    return (
        <div className="travel-expense-dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Travel & Expenses</h1>
                    <p className="page-subtitle">Manage corporate trips and reimbursement claims</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {activeTab === 'travels' && (
                        <button onClick={() => setShowTravelForm(!showTravelForm)} className="btn btn-primary">
                            + New Route Planner
                        </button>
                    )}
                    {activeTab === 'expenses' && (
                        <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="btn btn-primary">
                            + File New Claim
                        </button>
                    )}
                    {activeTab === 'settlements' && (
                        <button onClick={() => setShowSettlementForm(!showSettlementForm)} className="btn btn-primary" style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}>
                            + Settle Advance
                        </button>
                    )}
                </div>
            </div>

            <div className="tab-navigation">
                <button className={`tab-btn ${activeTab === 'travels' ? 'active' : ''}`} onClick={() => setActiveTab('travels')}>
                    Travel Requests
                </button>
                <button className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
                    Expense Claims
                </button>
                <button className={`tab-btn ${activeTab === 'settlements' ? 'active' : ''}`} onClick={() => setActiveTab('settlements')}>
                    Advance Settlements
                </button>
            </div>

            <div className="card">
                {/* TRAVELS TAB */}
                {activeTab === 'travels' && (
                    <>
                        {showTravelForm && (
                            <form onSubmit={handleTravelSubmit} style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                <h3 style={{ marginBottom: '1rem' }}>New Travel Request</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group"><label className="form-label">Destination</label><input type="text" className="form-control" required value={travelForm.destination} onChange={e => setTravelForm({ ...travelForm, destination: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Purpose</label><input type="text" className="form-control" required value={travelForm.purpose} onChange={e => setTravelForm({ ...travelForm, purpose: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">From Date</label><input type="date" className="form-control" required value={travelForm.fromDate} onChange={e => setTravelForm({ ...travelForm, fromDate: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">To Date</label><input type="date" className="form-control" required value={travelForm.toDate} onChange={e => setTravelForm({ ...travelForm, toDate: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Est. Budget (AED)</label><input type="number" className="form-control" required value={travelForm.estimatedBudget} onChange={e => setTravelForm({ ...travelForm, estimatedBudget: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Requested Advance (AED)</label><input type="number" className="form-control" value={travelForm.requestedAdvance} onChange={e => setTravelForm({ ...travelForm, requestedAdvance: e.target.value })} /></div>
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="form-label">Advance Request Details / Quotation (PDF/Image)</label>
                                        <input type="file" className="form-control" onChange={e => setAdvanceFile(e.target.files[0])} />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <button type="submit" className="btn btn-primary">Submit for Approval</button>
                                        <button type="button" className="btn btn-secondary" style={{ marginLeft: '1rem' }} onClick={() => setShowTravelForm(false)}>Cancel</button>
                                    </div>
                                </div>
                            </form>
                        )}

                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        {(userRole !== 'employee' || isManager) && <th>Employee</th>}
                                        <th>Destination</th>
                                        <th>Dates</th>
                                        <th>Budget</th>
                                        <th>Advance</th>
                                        <th>Doc</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {travels.map(t => (
                                        <tr key={t._id}>
                                            {(userRole !== 'employee' || isManager) && <td>{t.employee?.firstName} {t.employee?.lastName}</td>}
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{t.destination}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.purpose}</div>
                                            </td>
                                            <td>{new Date(t.fromDate).toLocaleDateString()} - {new Date(t.toDate).toLocaleDateString()}</td>
                                            <td>AED {t.estimatedBudget}</td>
                                            <td>
                                                <div style={{ fontSize: '0.8rem' }}>Req: AED {t.requestedAdvance || 0}</div>
                                                {t.status === 'Approved' && <div style={{ fontSize: '0.8rem', color: 'var(--success-color)' }}>App: AED {t.approvedAdvance || 0}</div>}
                                            </td>
                                            <td>
                                                {t.advanceDocumentUrl ? (
                                                    <a href={`${getBaseUrl()}${t.advanceDocumentUrl}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>View</a>
                                                ) : '-'}
                                            </td>
                                            <td>
                                                <span className={`badge badge-${t.status === 'Approved' ? 'success' : t.status === 'Rejected' ? 'warning' : t.status === 'Pending Finance' ? 'info' : 'secondary'}`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td>
                                                {t.status === 'Pending' && (['hr', 'admin', 'director', 'finance'].includes(userRole) || (isManager && t.employee?._id !== user.employeeRef?._id && t.employee !== user.employeeRef)) && (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button onClick={() => handleAction(t._id, 'Pending Finance', 'travel')} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Approve</button>
                                                        <button onClick={() => handleAction(t._id, 'Rejected', 'travel')} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>Reject</button>
                                                    </div>
                                                )}
                                                {t.status === 'Pending Finance' && ['finance', 'admin'].includes(userRole) && (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button onClick={() => handleAction(t._id, 'Approved', 'travel', t.requestedAdvance)} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}>Finance Approve</button>
                                                        <button onClick={() => handleAction(t._id, 'Rejected', 'travel')} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>Reject</button>
                                                    </div>
                                                )}
                                                {/* Delete button for own non-approved/non-completed requests (not for hr/admin) */}
                                                {!['hr', 'admin'].includes(userRole) && t.status !== 'Approved' && t.status !== 'Completed' && (t.employee?._id || t.employee) === (user.employeeRef?._id || user.employeeRef) && (
                                                    <button onClick={() => handleDeleteTravel(t._id)} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444', marginTop: '4px' }}>🗑 Delete</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {travels.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No travel requests found.</p>}
                        </div>
                    </>
                )}

                {/* EXPENSES TAB */}
                {activeTab === 'expenses' && (
                    <>
                        {showExpenseForm && (
                            <form onSubmit={handleExpenseSubmit} style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                <h3 style={{ marginBottom: '1rem' }}>New Expense Claim</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="form-label">Link to Travel Request (Optional)</label>
                                        <select className="form-control" value={expenseForm.travelRequest} onChange={e => setExpenseForm({ ...expenseForm, travelRequest: e.target.value })}>
                                            <option value="">-- None --</option>
                                            {travels.filter(t => t.status === 'Approved').map(t => (
                                                <option key={t._id} value={t._id}>{t.destination} ({new Date(t.fromDate).toLocaleDateString()})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group"><label className="form-label">Category</label>
                                        <select className="form-control" required value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                                            <option value="Airfare">Airfare</option><option value="Hotel">Hotel</option>
                                            <option value="Meals">Meals</option><option value="Local Transport">Local Transport</option>
                                            <option value="Visa">Visa</option><option value="Client Entertainment">Client Entertainment</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group"><label className="form-label">Amount (AED)</label><input type="number" className="form-control" required value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></div>

                                    <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">Description</label><input type="text" className="form-control" required value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} /></div>

                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="form-label">Upload Receipt (PDF/Image)</label>
                                        <input type="file" className="form-control" accept="image/*,.pdf" onChange={e => setReceiptFile(e.target.files[0])} />
                                    </div>

                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <button type="submit" className="btn btn-primary">Submit Claim</button>
                                        <button type="button" className="btn btn-secondary" style={{ marginLeft: '1rem' }} onClick={() => setShowExpenseForm(false)}>Cancel</button>
                                    </div>
                                </div>
                            </form>
                        )}

                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        {(userRole !== 'employee' || isManager) && <th>Employee</th>}
                                        <th>Date</th>
                                        <th>Details</th>
                                        <th>Amount</th>
                                        <th>Receipt</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map(e => (
                                        <tr key={e._id}>
                                            {(userRole !== 'employee' || isManager) && <td>{e.employee?.firstName} {e.employee?.lastName}</td>}
                                            <td>{new Date(e.date).toLocaleDateString()}</td>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{e.category}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{e.description}</div>
                                            </td>
                                            <td style={{ fontWeight: 'bold' }}>AED {e.amount}</td>
                                            <td>
                                                {e.receiptUrl ? (
                                                    <a href={`${getBaseUrl()}${e.receiptUrl}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)' }}>View</a>
                                                ) : <span style={{ color: 'var(--text-muted)' }}>None</span>}
                                            </td>
                                            <td>
                                                <span className={`badge badge-${e.status === 'Approved' || e.status === 'Reimbursed' ? 'success' : e.status === 'Rejected' ? 'warning' : e.status === 'Pending Finance' ? 'info' : 'secondary'}`}>
                                                    {e.status}
                                                </span>
                                            </td>
                                            <td>
                                                {e.status === 'Pending' && (['hr', 'admin', 'director', 'finance'].includes(userRole) || (isManager && e.employee?._id !== user.employeeRef?._id && e.employee !== user.employeeRef)) && (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button onClick={() => handleAction(e._id, 'Pending Finance', 'expense')} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Approve</button>
                                                        <button onClick={() => handleAction(e._id, 'Rejected', 'expense')} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>Reject</button>
                                                    </div>
                                                )}
                                                {e.status === 'Pending Finance' && ['finance', 'admin'].includes(userRole) && (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button onClick={() => handleAction(e._id, 'Approved', 'expense')} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}>Finance Approve</button>
                                                        <button onClick={() => handleAction(e._id, 'Rejected', 'expense')} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>Reject</button>
                                                    </div>
                                                )}
                                                {e.status === 'Approved' && ['admin', 'finance'].includes(userRole) && (
                                                    <button onClick={() => handleAction(e._id, 'Reimbursed', 'expense')} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderColor: '#10b981', color: '#10b981', marginTop: '4px' }}>Mark Reimbursed</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {expenses.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No expense claims found.</p>}
                        </div>
                    </>
                )}

                {/* SETTLEMENTS TAB */}
                {activeTab === 'settlements' && (
                    <>
                        {showSettlementForm && (
                            <form onSubmit={handleSettlementSubmit} style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                <h3 style={{ marginBottom: '1rem' }}>Settle Travel Advance</h3>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">Select Approved Travel Request *</label>
                                    <select className="form-control" required value={settlementForm.travelRequest} onChange={e => handleTravelRequestSelection(e.target.value)}>
                                        <option value="">-- Select Trip --</option>
                                        {travels.filter(t => t.status === 'Approved' && t.approvedAdvance > 0).map(t => (
                                            <option key={t._id} value={t._id}>{t.destination} ({new Date(t.fromDate).toLocaleDateString()}) - Advance: AED {t.approvedAdvance}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginTop: '1rem', background: 'var(--bg-secondary)' }}>
                                    <h4 style={{ marginBottom: '1rem' }}>Expense Items</h4>
                                    {settlementForm.expenses.map((exp, index) => (
                                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 2fr 2fr auto', gap: '0.5rem', alignItems: 'end', paddingBottom: '1rem', borderBottom: index < settlementForm.expenses.length - 1 ? '1px dashed var(--border-color)' : 'none', marginBottom: index < settlementForm.expenses.length - 1 ? '1rem' : '0' }}>
                                            <div>
                                                <label className="form-label">Date</label>
                                                <input type="date" required className="form-control" value={exp.date} onChange={e => handleSettlementChange(index, 'date', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="form-label">Category</label>
                                                <select required className="form-control" value={exp.category} onChange={e => handleSettlementChange(index, 'category', e.target.value)}>
                                                    <option value="Airfare">Airfare</option>
                                                    <option value="Hotel">Hotel</option>
                                                    <option value="Meals">Meals</option>
                                                    <option value="Local Transport">Local Transport</option>
                                                    <option value="Visa">Visa</option>
                                                    <option value="Client Entertainment">Client</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="form-label">Amount</label>
                                                <input type="number" required className="form-control" value={exp.amount} onChange={e => handleSettlementChange(index, 'amount', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="form-label">Remarks</label>
                                                <input type="text" required className="form-control" value={exp.description} onChange={e => handleSettlementChange(index, 'description', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="form-label">Receipt</label>
                                                <input type="file" className="form-control" accept="image/*,.pdf" onChange={e => handleSettlementChange(index, 'receipt', e.target.files[0])} />
                                                {typeof exp.receipt === 'string' && <a href={`${getBaseUrl()}${exp.receipt}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', display: 'block', marginTop: '0.2rem' }}>View Saved</a>}
                                            </div>
                                            <div>
                                                {settlementForm.expenses.length > 1 && (
                                                    <button type="button" onClick={() => handleRemoveSettlementRow(index)} className="btn btn-secondary" style={{ color: '#ef4444', borderColor: '#ef4444', padding: '0.4rem 0.6rem' }}>X</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <button type="button" onClick={handleAddSettlementRow} className="btn btn-secondary" style={{ backgroundColor: 'var(--bg-tertiary)' }}>+ Add Row</button>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                            Total Expenses: AED {settlementForm.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                                    <label className="form-label">Additional Amount Requested (AED) - Optional</label>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>If your total expenses exceed the approved advance provided, enter the additional amount you are claiming here.</p>
                                    <input type="number" className="form-control" value={settlementForm.additionalAmountRequested} onChange={e => setSettlementForm({ ...settlementForm, additionalAmountRequested: e.target.value })} style={{ width: '200px' }} />
                                </div>

                                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <button type="button" className="btn btn-secondary" disabled={!settlementForm.travelRequest} onClick={(e) => handleSettlementSubmit(e, 'draft')} style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>💾 Save as Draft</button>
                                    <button type="submit" className="btn btn-primary" disabled={!settlementForm.travelRequest} onClick={(e) => handleSettlementSubmit(e, 'submit')}>✅ Complete & Submit for Approval</button>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowSettlementForm(false)}>Cancel</button>
                                </div>
                            </form>
                        )}

                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        {(userRole !== 'employee' || isManager) && <th>Employee</th>}
                                        <th>Trip</th>
                                        <th>Total Claimed</th>
                                        <th>Approved Adv.</th>
                                        <th>Balance</th>
                                        <th>Docs</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {settlements.map(s => (
                                        <tr key={s._id}>
                                            {(userRole !== 'employee' || isManager) && <td>{s.employee?.firstName} {s.employee?.lastName}</td>}
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{s.travelRequest?.destination || 'Unknown Trip'}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.travelRequest ? `${new Date(s.travelRequest.fromDate).toLocaleDateString()} - ${new Date(s.travelRequest.toDate).toLocaleDateString()}` : ''}</div>
                                            </td>
                                            <td style={{ fontWeight: 'bold' }}>AED {s.totalAmount}</td>
                                            <td>AED {s.travelRequest?.approvedAdvance || 0}</td>
                                            <td>
                                                {s.balance > 0 ? (
                                                    <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>Owes Co: AED {s.balance}</span>
                                                ) : (
                                                    <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>Owes Emp: AED {Math.abs(s.balance)}</span>
                                                )}
                                                {s.deductFromSalary && <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>(Deduct from Salary)</div>}
                                            </td>
                                            <td>
                                                {s.expenses.filter(e => e.receiptUrl).length} receipt(s)
                                            </td>
                                            <td>
                                                <span className={`badge badge-${s.status === 'Approved' ? 'success' : s.status === 'Rejected' ? 'warning' : s.status.includes('Pending') ? 'info' : 'secondary'}`}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td>
                                                {s.status === 'Pending Manager' && (['hr', 'admin', 'director', 'finance'].includes(userRole) || (isManager && s.employee?._id !== user.employeeRef?._id && s.employee !== user.employeeRef)) && (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button onClick={() => handleOpenApprovalModal(s, 'Pending Finance')} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Review / Approve</button>
                                                        <button onClick={() => handleAction(s._id, 'Rejected', 'settlement')} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>Reject All</button>
                                                    </div>
                                                )}
                                                {s.status === 'Pending Finance' && ['finance', 'admin'].includes(userRole) && (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button onClick={() => handleOpenApprovalModal(s, 'Approved')} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}>Finance Review</button>
                                                        <button onClick={() => handleAction(s._id, 'Rejected', 'settlement')} className="btn btn-secondary btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}>Reject All</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {settlements.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No settlements found.</p>}
                        </div>
                    </>
                )}
            </div>

            {/* LINE ITEM APPROVAL MODAL */}
            {approvalModalData && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                        <h2 style={{ marginBottom: '0.5rem' }}>Review Settlement Line Items</h2>
                        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontWeight: 'normal' }}>Trip: {approvalModalData.settlement.travelRequest?.destination}</h4>

                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                            <table className="table" style={{ margin: 0 }}>
                                <thead style={{ background: 'var(--bg-secondary)' }}>
                                    <tr>
                                        <th>Date</th>
                                        <th>Category</th>
                                        <th>Amount</th>
                                        <th>Receipt</th>
                                        <th>Status Action</th>
                                        <th>Approver Comments</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {approvalModalData.lines.map((line, idx) => (
                                        <tr key={line._id || idx}>
                                            <td>{new Date(line.date).toLocaleDateString()}</td>
                                            <td>
                                                <div style={{ fontWeight: '500' }}>{line.category}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{line.description}</div>
                                            </td>
                                            <td style={{ fontWeight: 'bold' }}>AED {line.amount}</td>
                                            <td>
                                                {line.receiptUrl ? <a href={`${getBaseUrl()}${line.receiptUrl}`} target="_blank" rel="noreferrer">View</a> : 'None'}
                                            </td>
                                            <td>
                                                <select className="form-control" style={{ padding: '0.3rem', fontSize: '0.9rem' }} value={line.status} onChange={(e) => handleLineItemChange(idx, 'status', e.target.value)}>
                                                    <option value="Approved">Approve</option>
                                                    <option value="Rejected">Reject</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input type="text" className="form-control" style={{ padding: '0.3rem', fontSize: '0.9rem' }} placeholder="Optional notes..." value={line.comments} onChange={(e) => handleLineItemChange(idx, 'comments', e.target.value)} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.9rem' }}>Original Advance</span>
                                <span style={{ fontWeight: 'bold' }}>AED {approvalModalData.settlement.travelRequest?.approvedAdvance || 0}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.9rem' }}>Approved Expenses (calc.)</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>
                                    AED {approvalModalData.lines.reduce((sum, l) => sum + (l.status === 'Approved' ? Number(l.amount) : 0), 0)}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.9rem' }}>New Balance</span>
                                <span style={{ fontWeight: 'bold' }}>
                                    AED {(approvalModalData.settlement.travelRequest?.approvedAdvance || 0) - approvalModalData.lines.reduce((sum, l) => sum + (l.status === 'Approved' ? Number(l.amount) : 0), 0)}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button onClick={() => setApprovalModalData(null)} className="btn btn-secondary">Cancel</button>
                            <button onClick={handleSubmitModalApproval} className="btn btn-primary" style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}>Confirm & Save Approval</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
