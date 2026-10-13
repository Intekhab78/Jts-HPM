import React from 'react';
import './ScreenMockups.css';

export function DashboardScreenMockup() {
    return (
        <div className="screen-mockup-frame">
            <div className="mockup-window-bar">
                <div className="mockup-window-controls">
                    <span className="mockup-window-dot close"></span>
                    <span className="mockup-window-dot min"></span>
                    <span className="mockup-window-dot max"></span>
                </div>
                <span className="mockup-window-url">https://portal.jtsgroup.ae/dashboard</span>
                <span style={{ fontSize: '0.65rem', color: '#10b981' }}>● Live Connected</span>
            </div>
            <div className="mockup-window-content">
                <div className="mockup-kpi-grid">
                    <div className="mockup-kpi-card">
                        <div className="mockup-kpi-val" style={{ color: '#38bdf8' }}>142</div>
                        <div className="mockup-kpi-lbl">Total Staff</div>
                    </div>
                    <div className="mockup-kpi-card">
                        <div className="mockup-kpi-val" style={{ color: '#10b981' }}>138</div>
                        <div className="mockup-kpi-lbl">Present Today</div>
                    </div>
                    <div className="mockup-kpi-card">
                        <div className="mockup-kpi-val" style={{ color: '#f59e0b' }}>3</div>
                        <div className="mockup-kpi-lbl">Late Arrivals</div>
                    </div>
                    <div className="mockup-kpi-card">
                        <div className="mockup-kpi-val" style={{ color: '#ef4444' }}>1</div>
                        <div className="mockup-kpi-lbl">On Leave</div>
                    </div>
                </div>

                <div style={{ background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '0.75rem' }}>⚡ Live Punch Stream</span>
                        <span className="mockup-badge primary">Kiosk: Head Office</span>
                    </div>
                    <table className="mockup-table">
                        <thead>
                            <tr>
                                <th>Emp ID</th>
                                <th>Name</th>
                                <th>Time</th>
                                <th>Score</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>EMP-001</td>
                                <td>INTEKHAB TAWAB</td>
                                <td>08:58 AM</td>
                                <td><span className="mockup-badge success">100% Match</span></td>
                                <td><span className="mockup-badge success">On Time</span></td>
                            </tr>
                            <tr>
                                <td>EMP-002</td>
                                <td>Mohit Mourya</td>
                                <td>09:04 AM</td>
                                <td><span className="mockup-badge success">96% Match</span></td>
                                <td><span className="mockup-badge warning">Late 4m</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export function EmployeeMasterScreenMockup() {
    return (
        <div className="screen-mockup-frame">
            <div className="mockup-window-bar">
                <div className="mockup-window-controls">
                    <span className="mockup-window-dot close"></span>
                    <span className="mockup-window-dot min"></span>
                    <span className="mockup-window-dot max"></span>
                </div>
                <span className="mockup-window-url">https://portal.jtsgroup.ae/employees/new</span>
                <span className="mockup-badge primary">Onboarding Form</span>
            </div>
            <div className="mockup-window-content">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#38bdf8', marginBottom: '0.25rem' }}>🪪 Emirates ID & Passport</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.65rem' }}>EID: 784-1988-1234567-1</div>
                        <div style={{ color: '#10b981', fontSize: '0.65rem' }}>✓ Document Verified & Attached</div>
                        <div style={{ color: '#f59e0b', fontSize: '0.65rem', marginTop: '2px' }}>Visa Expiry: Nov 15, 2027 (Active)</div>
                    </div>
                    <div style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.25rem' }}>🏦 WPS Banking Details</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.65rem' }}>IBAN: AE250331234567890123456</div>
                        <div style={{ color: '#cbd5e1', fontSize: '0.65rem' }}>WPS Agent: 033 (Emirates NBD)</div>
                        <div style={{ color: '#38bdf8', fontSize: '0.65rem' }}>Basic: AED 12,000 | Allowances: AED 6,000</div>
                    </div>
                </div>

                <div style={{ background: '#1e293b', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #334155' }}>
                    <span style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '0.7rem' }}>Salary Components</span>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                        <span className="mockup-badge primary">Basic Pay: 12,000</span>
                        <span className="mockup-badge primary">HRA: 4,000</span>
                        <span className="mockup-badge primary">Transport: 2,000</span>
                        <span className="mockup-badge success">WPS Gross: AED 18,000</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function BiometricKioskScreenMockup() {
    return (
        <div className="screen-mockup-frame">
            <div className="mockup-window-bar">
                <div className="mockup-window-controls">
                    <span className="mockup-window-dot close"></span>
                    <span className="mockup-window-dot min"></span>
                    <span className="mockup-window-dot max"></span>
                </div>
                <span className="mockup-window-url">Tablet Kiosk View • Head Office Terminal</span>
                <span className="mockup-badge success">Live Scanning</span>
            </div>
            <div className="mockup-window-content">
                <div className="mockup-scanner-frame">
                    <div className="mockup-camera-view">
                        <div className="mockup-face-target">
                            👤
                        </div>
                        <div style={{ position: 'absolute', bottom: '4px', left: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', borderRadius: '4px', textAlign: 'center', fontSize: '0.55rem', color: '#10b981' }}>
                            ✓ 128D Embed Match: 99.4%
                        </div>
                    </div>

                    <div className="mockup-scanner-info">
                        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '0.5rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 'bold' }}>✓ PUNCH RECORDED SUCCESSFULLY</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#f8fafc' }}>INTEKHAB TAWAB</div>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>EMP-001 • Check In at 08:58:12 AM</div>
                        </div>

                        <div style={{ background: '#1e293b', padding: '0.4rem', borderRadius: '6px', border: '1px solid #334155' }}>
                            <div style={{ fontSize: '0.65rem', color: '#38bdf8' }}>🔊 Audio Voice Speech:</div>
                            <div style={{ fontSize: '0.68rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                                "Welcome, Intekhab. Your punch is recorded on time."
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AttendanceTimesheetScreenMockup() {
    return (
        <div className="screen-mockup-frame">
            <div className="mockup-window-bar">
                <div className="mockup-window-controls">
                    <span className="mockup-window-dot close"></span>
                    <span className="mockup-window-dot min"></span>
                    <span className="mockup-window-dot max"></span>
                </div>
                <span className="mockup-window-url">https://portal.jtsgroup.ae/attendance</span>
                <span className="mockup-badge primary">Timesheets Grid</span>
            </div>
            <div className="mockup-window-content">
                <table className="mockup-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Employee</th>
                            <th>In / Out</th>
                            <th>Status</th>
                            <th>Late</th>
                            <th>OT (1.25x/1.5x)</th>
                            <th>Machine</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Sep 05, 2026</td>
                            <td>INTEKHAB TAWAB</td>
                            <td>08:58 / 06:30</td>
                            <td><span className="mockup-badge success">Present</span></td>
                            <td>-</td>
                            <td><span className="mockup-badge primary">1.5 hrs</span></td>
                            <td>Head Office</td>
                        </tr>
                        <tr>
                            <td>Sep 05, 2026</td>
                            <td>Mohit Mourya</td>
                            <td>09:18 / 06:00</td>
                            <td><span className="mockup-badge warning">Late</span></td>
                            <td><span className="mockup-badge danger">18 mins</span></td>
                            <td>-</td>
                            <td>Head Office</td>
                        </tr>
                        <tr>
                            <td>Sep 05, 2026</td>
                            <td>Adal Rizvi</td>
                            <td>08:55 / 07:00</td>
                            <td><span className="mockup-badge success">Present</span></td>
                            <td>-</td>
                            <td><span className="mockup-badge success">2.0 hrs (Weekend)</span></td>
                            <td>Branch 2</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function WpsPayrollScreenMockup() {
    return (
        <div className="screen-mockup-frame">
            <div className="mockup-window-bar">
                <div className="mockup-window-controls">
                    <span className="mockup-window-dot close"></span>
                    <span className="mockup-window-dot min"></span>
                    <span className="mockup-window-dot max"></span>
                </div>
                <span className="mockup-window-url">https://portal.jtsgroup.ae/payroll</span>
                <span className="mockup-badge success">SIF Ready</span>
            </div>
            <div className="mockup-window-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', background: '#1e293b', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #334155' }}>
                    <div>
                        <span style={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#f8fafc' }}>Batch: September 2026 Payroll</span>
                        <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Total Payout: AED 245,680.00 • 142 Staff</div>
                    </div>
                    <button style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}>
                        📥 Export WPS SIF File
                    </button>
                </div>

                <div style={{ background: '#0f172a', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #334155', fontFamily: 'monospace', fontSize: '0.62rem', color: '#38bdf8' }}>
                    <div># Central Bank SIF Layout Preview:</div>
                    <div style={{ color: '#cbd5e1' }}>SCR,033,JTS202609,2026-09-30,142,245680.00,AED</div>
                    <div style={{ color: '#94a3b8' }}>EDR,EMP001,033,AE250331234567890123456,2026-09-01,2026-09-30,30,18375.00,0.00</div>
                </div>
            </div>
        </div>
    );
}

export function GratuitySettlementScreenMockup() {
    return (
        <div className="screen-mockup-frame">
            <div className="mockup-window-bar">
                <div className="mockup-window-controls">
                    <span className="mockup-window-dot close"></span>
                    <span className="mockup-window-dot min"></span>
                    <span className="mockup-window-dot max"></span>
                </div>
                <span className="mockup-window-url">https://portal.jtsgroup.ae/gratuity</span>
                <span className="mockup-badge primary">UAE Law No. 33 EOSB</span>
            </div>
            <div className="mockup-window-content">
                <div style={{ background: '#1e293b', padding: '0.6rem', borderRadius: '6px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '0.75rem' }}>Tenure: 3 Years, 8 Months (1,340 Days)</span>
                        <span className="mockup-badge success">Statutory 21 Days/Yr</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', textAlign: 'center', marginTop: '0.5rem' }}>
                        <div style={{ background: '#0f172a', padding: '0.3rem', borderRadius: '4px' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.58rem' }}>Basic Salary</div>
                            <div style={{ color: '#f8fafc', fontWeight: 'bold' }}>AED 12,000</div>
                        </div>
                        <div style={{ background: '#0f172a', padding: '0.3rem', borderRadius: '4px' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.58rem' }}>Accrued Days</div>
                            <div style={{ color: '#38bdf8', fontWeight: 'bold' }}>77.0 Days</div>
                        </div>
                        <div style={{ background: '#0f172a', padding: '0.3rem', borderRadius: '4px' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.58rem' }}>Gratuity Due</div>
                            <div style={{ color: '#10b981', fontWeight: 'bold' }}>AED 30,800.00</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function MobileGeofenceScreenMockup() {
    return (
        <div className="screen-mockup-frame">
            <div className="mockup-window-bar">
                <div className="mockup-window-controls">
                    <span className="mockup-window-dot close"></span>
                    <span className="mockup-window-dot min"></span>
                    <span className="mockup-window-dot max"></span>
                </div>
                <span className="mockup-window-url">Mobile App Self-Punch View</span>
                <span className="mockup-badge success">GPS Verified</span>
            </div>
            <div className="mockup-window-content" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div className="mockup-phone-frame" style={{ width: '110px' }}>
                    <div style={{ background: '#1e293b', height: '100px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <span style={{ fontSize: '2rem' }}>🤳</span>
                        <div style={{ position: 'absolute', bottom: '4px', fontSize: '0.5rem', color: '#10b981', background: 'rgba(0,0,0,0.7)', padding: '1px 3px', borderRadius: '3px' }}>
                            ✓ In Geofence
                        </div>
                    </div>
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155' }}>
                        <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '0.7rem' }}>📍 Verified Coordinates</div>
                        <div style={{ color: '#cbd5e1', fontSize: '0.65rem' }}>Lat: 25.2048° N • Lng: 55.2708° E</div>
                        <div style={{ color: '#10b981', fontSize: '0.65rem', marginTop: '2px' }}>✓ Within Head Office Geofence (150m)</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.62rem', marginTop: '2px' }}>🛡️ Anti-Mocking GPS Checked: No spoof detected</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function DynamicScreenMockup({ screenType }) {
    switch (screenType) {
        case 'dashboard':
            return <DashboardScreenMockup />;
        case 'employee':
            return <EmployeeMasterScreenMockup />;
        case 'kiosk':
            return <BiometricKioskScreenMockup />;
        case 'timesheet':
            return <AttendanceTimesheetScreenMockup />;
        case 'payroll':
            return <WpsPayrollScreenMockup />;
        case 'gratuity':
            return <GratuitySettlementScreenMockup />;
        case 'geofence':
            return <MobileGeofenceScreenMockup />;
        default:
            return <DashboardScreenMockup />;
    }
}
