import { useState, useEffect } from 'react';
import { getEmployees } from '../../api/employeeApi';
import { calculateGratuity } from '../../api/payrollApi';
import toast from 'react-hot-toast';

export default function GratuityCalculator() {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [calculating, setCalculating] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await getEmployees();
            setEmployees(res.data);
        } catch (error) {
            toast.error('Failed to load employees');
        }
    };

    const handleCalculate = async () => {
        if (!selectedEmployee) {
            toast.error('Select an employee first');
            return;
        }

        try {
            setCalculating(true);
            const res = await calculateGratuity(selectedEmployee);
            setResult(res.data);
            toast.success('Calculation complete');
        } catch (error) {
            toast.error('Failed to calculate gratuity');
        } finally {
            setCalculating(false);
        }
    };

    return (
        <div className="gratuity-calculator-page" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">UAE Gratuity Calculator</h1>
                    <p className="page-subtitle">Calculate End of Service Benefits based on UAE Labor Law</p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                        <label className="form-label">Select Employee</label>
                        <select
                            className="form-control"
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                        >
                            <option value="">-- Select an employee --</option>
                            {employees.map(emp => (
                                <option key={emp._id} value={emp._id}>
                                    {emp.employeeId} - {emp.firstName} {emp.lastName}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleCalculate}
                        className="btn btn-primary"
                        disabled={!selectedEmployee || calculating}
                        style={{ height: '42px' }}
                    >
                        {calculating ? 'Calculating...' : 'Calculate End of Service'}
                    </button>
                </div>
            </div>

            {result && (
                <div className="card" style={{ borderTop: '4px solid var(--primary-color)' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', textAlign: 'center' }}>End of Service Benefit Details</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

                        <div>
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Tenure Summary</h3>
                            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Total Days Worked:</span>
                                    <span style={{ fontWeight: '600' }}>{result.daysWorked} days</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Years of Service:</span>
                                    <span style={{ fontWeight: '600' }}>{result.yearsWorked} years</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Salary Basis</h3>
                            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Daily Basic Wage:</span>
                                    <span style={{ fontWeight: '600' }}>AED {result.dailyBasic}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div style={{
                        marginTop: '2rem',
                        padding: '2rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px dashed var(--primary-color)',
                        borderRadius: '12px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.1rem', color: 'var(--primary-color)', marginBottom: '0.5rem', fontWeight: '500' }}>
                            Calculated Gratuity Amount (AED)
                        </div>
                        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {result.gratuityAmount.toLocaleString()}
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
                            * Based on 21 days basic wage for the first 5 years, and 30 days for each subsequent year. Fully compliant with UAE Labor Law.
                        </p>
                    </div>

                </div>
            )}
        </div>
    );
}
