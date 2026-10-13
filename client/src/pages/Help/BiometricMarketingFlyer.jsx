import { useState } from 'react';
import { 
    HiOutlinePrinter, 
    HiOutlineArrowDownTray, 
    HiOutlineShieldCheck, 
    HiOutlineCpuChip, 
    HiOutlineSparkles,
    HiOutlineCheckBadge,
    HiOutlineMapPin,
    HiOutlineClock,
    HiOutlineDevicePhoneMobile
} from 'react-icons/hi2';
import './BiometricFlyer.css';

export default function BiometricMarketingFlyer() {
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="biometric-flyer-wrapper">
            <div className="flyer-action-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="flyer-badge-highlight">
                        <HiOutlineSparkles /> Official Executive Marketing Flyer
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Optimized for 1-Page A4 Client Handout / PDF Print
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                        onClick={handlePrint}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', padding: '0.5rem 1.25rem' }}
                    >
                        <HiOutlinePrinter size={18} /> Print / Save as PDF Flyer
                    </button>
                </div>
            </div>

            <div className="flyer-content-a4">
                {/* Header */}
                <div className="flyer-header">
                    <div>
                        <h1 className="flyer-brand-title">JTS HR & Biometric AI Suite</h1>
                        <p className="flyer-brand-subtitle">
                            Next-Generation Edge Facial Recognition, Multi-Branch Geofencing & Automated WPS Payroll
                        </p>
                    </div>
                    <div className="flyer-brand-badge">
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#38bdf8' }}>Enterprise Edition</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>UAE MOHRE & WPS Compliant</div>
                    </div>
                </div>

                {/* Hero Banner */}
                <div className="flyer-hero-banner">
                    <div className="flyer-hero-text">
                        <h2>Zero-Hardware-Hassle Biometric Attendance</h2>
                        <p>
                            Transform any standard Android or iOS tablet / phone into an intelligent, high-security biometric attendance kiosk powered by ResNet-34 128D neural network computer vision.
                        </p>
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0, background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1.25rem', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#10b981' }}>&lt; 200ms</div>
                        <div style={{ fontSize: '0.75rem', color: '#cbd5e1', textTransform: 'uppercase' }}>Recognition Speed</div>
                    </div>
                </div>

                {/* 4 Metric Highlights */}
                <div className="flyer-metrics-row">
                    <div className="flyer-metric-box">
                        <div className="flyer-metric-val">99.8%</div>
                        <div className="flyer-metric-lbl">Recognition Accuracy</div>
                    </div>
                    <div className="flyer-metric-box">
                        <div className="flyer-metric-val">10,000+</div>
                        <div className="flyer-metric-lbl">Employee Capacity</div>
                    </div>
                    <div className="flyer-metric-box">
                        <div className="flyer-metric-val">100%</div>
                        <div className="flyer-metric-lbl">Offline Punch Buffer</div>
                    </div>
                    <div className="flyer-metric-box">
                        <div className="flyer-metric-val">0 min</div>
                        <div className="flyer-metric-lbl">Timesheet Reconciliation</div>
                    </div>
                </div>

                {/* 4-Step Biometric Process Architecture */}
                <h3 style={{ fontSize: '1.15rem', color: '#f8fafc', marginBottom: '1rem', fontWeight: 800 }}>
                    ⚡ The Complete Biometric Attendance Process
                </h3>

                <div className="flyer-process-grid">
                    <div className="flyer-process-card">
                        <div className="flyer-step-number">1</div>
                        <div className="flyer-process-icon">📸</div>
                        <h4>Instant Touchless Face Capture</h4>
                        <p>
                            Employee steps in front of the kiosk. Dual-angle camera captures the face in real time with liveness verification, preventing photo or video spoofing attempts.
                        </p>
                    </div>

                    <div className="flyer-process-card">
                        <div className="flyer-step-number">2</div>
                        <div className="flyer-process-icon">🧠</div>
                        <h4>128D Neural Vector Matching</h4>
                        <p>
                            Calculates 128-dimensional facial embeddings and applies a strict calibrated Euclidean threshold (≤ 0.48), reliably rejecting lookalikes and family members with voice guidance.
                        </p>
                    </div>

                    <div className="flyer-process-card">
                        <div className="flyer-step-number">3</div>
                        <div className="flyer-process-icon">📍</div>
                        <h4>Branch & Geofence Verification</h4>
                        <p>
                            Automatically checks employee location mapping. Unmapped staff attempting off-site punches are redirected or granted supervisor PIN bypass with audit logs.
                        </p>
                    </div>

                    <div className="flyer-process-card">
                        <div className="flyer-step-number">4</div>
                        <div className="flyer-process-icon">📊</div>
                        <h4>Direct-to-Payroll Synchronization</h4>
                        <p>
                            Punches immediately feed the Timesheet Engine: computing late arrival penalties, 1.25x general overtime, and 1.50x weekend/holiday OT ready for 1-click WPS SIF export.
                        </p>
                    </div>
                </div>

                {/* 3 Value Proposition Pillars */}
                <div className="flyer-features-summary">
                    <div className="flyer-feature-block">
                        <h5>🛡️ Anti-Spoof & Lookalike Safe</h5>
                        <p>
                            Enterprise calibration curve guarantees that unregistered personnel or siblings cannot falsely punch on another employee’s record.
                        </p>
                    </div>

                    <div className="flyer-feature-block">
                        <h5>📱 Multi-Modal Fallbacks</h5>
                        <p>
                            Supports Face Recognition, Dynamic QR Codes, Kiosk PIN codes, and GPS-Geofenced Mobile App self-punches for roving staff.
                        </p>
                    </div>

                    <div className="flyer-feature-block">
                        <h5>💼 Full UAE WPS Integration</h5>
                        <p>
                            Zero manual data entry. Timesheets directly flow into Monthly Payroll drafts, SIF Bank files, and End of Service Gratuity settlements.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flyer-footer">
                    <div>
                        <strong>HR & Biometric Management System</strong> • JTS Technology Group
                    </div>
                    <div>
                        📧 support@jtsgroup.com • 🌐 www.jtsgroup.ae • 📍 Dubai, UAE
                    </div>
                </div>
            </div>
        </div>
    );
}
