import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    HiOutlineHome, 
    HiOutlineUserGroup, 
    HiOutlineClock, 
    HiOutlineCalendar, 
    HiOutlineCurrencyDollar, 
    HiOutlinePaperAirplane, 
    HiOutlineCpuChip, 
    HiOutlineQuestionMarkCircle,
    HiOutlineCheckCircle,
    HiOutlineXMark
} from 'react-icons/hi2';
import './VirtualTour.css';

const TOUR_STEPS = [
    {
        id: 'welcome',
        title: 'Welcome to HR & Biometric Payroll System',
        badge: 'Platform Overview',
        icon: '🚀',
        route: '/',
        description: 'Your complete enterprise platform for automated HR management, high-accuracy AI facial recognition attendance, and UAE Labor Law / WPS compliant payroll processing.',
        features: [
            'Real-Time KPI & Operations Dashboard',
            'ResNet-34 128D AI Biometric Face Recognition Kiosk',
            'WPS SIF Bank Export & Central Bank Compliance',
            'Full Multi-Location & Geofenced Mobile Attendance'
        ]
    },
    {
        id: 'dashboard',
        title: 'Operations Dashboard & Real-Time KPIs',
        badge: 'Step 1 of 8',
        icon: '📊',
        route: '/',
        description: 'Track overall company headcount, today’s live attendance, late arrivals, pending approval requests, and upcoming document expiries at a glance.',
        features: [
            'Live Present, Absent, Late & Half-Day Counters',
            'Multi-Company and Branch Summary Cards',
            'Emirates ID, Visa & Passport Expiry Alerts',
            'Quick Action Shortcuts for Daily Management'
        ]
    },
    {
        id: 'employees',
        title: 'Employee Master & Smart Onboarding',
        badge: 'Step 2 of 8',
        icon: '👥',
        route: '/employees',
        description: 'Manage comprehensive digital employee profiles with automated Emirates ID reading, WPS bank details, and multi-allowance pay structures.',
        features: [
            'Instant Emirates ID & Passport Document Upload',
            'Multi-Element Salary Setup (Basic, HRA, Transport, Custom Allowances)',
            'Branch & Geofence Polygon Mapping',
            'Approval Hierarchy & Reporting Managers'
        ]
    },
    {
        id: 'biometrics',
        title: 'AI Facial Recognition & Biometric Kiosk',
        badge: 'Step 3 of 8',
        icon: '🤖',
        route: '/attendance',
        description: 'Our proprietary Edge AI Facial Recognition engine processes punches in under 200ms with strict anti-lookalike and family spoof protection.',
        features: [
            'ResNet-34 128-dimensional Neural Network Face Recognition',
            'Dual-Mode Kiosk (Tablet/Phone) with Live Voice Feedback',
            'Automatic Offline Caching & Background Multi-Branch Sync',
            'GPS Geofenced Mobile Self-Punch with Anti-Mock Detection'
        ]
    },
    {
        id: 'leaves',
        title: 'Leave Management & UAE Labor Policies',
        badge: 'Step 4 of 8',
        icon: '🏖️',
        route: '/leaves',
        description: 'Streamlined leave applications with automated accruals, tiered sick leave deductions, and Line Manager approval routing.',
        features: [
            'Annual, Sick, Maternity, Paternity & Unpaid Leaves',
            'UAE Statutory Sick Leave Tier Calculation (15 full / 30 half / unpaid)',
            'Leave Encashment & Salary Settlement Workflows',
            'Company Holiday Calendar Integration'
        ]
    },
    {
        id: 'payroll',
        title: 'WPS Payroll Processing & SIF Generation',
        badge: 'Step 5 of 8',
        icon: '💰',
        route: '/payroll',
        description: 'Generate monthly payroll with 100% mathematical accuracy, automatically calculating overtime, late penalties, unpaid leaves, and loans.',
        features: [
            '1-Click Central Bank WPS SIF File Export',
            'Automated 1.25x Overtime & 1.50x Weekend/Holiday OT',
            'Mid-month Pro-rata Joining & Exit Calculations',
            'Full End of Service Gratuity Settlement Calculator'
        ]
    },
    {
        id: 'advances',
        title: 'Loans, Salary Advances & Air Tickets',
        badge: 'Step 6 of 8',
        icon: '✈️',
        route: '/payroll/air-tickets',
        description: 'Manage employee air ticket entitlements, travel expense reimbursement claims, and automated monthly salary advance deductions.',
        features: [
            'Annual Air Ticket Frequency & Cash Encashment Tracking',
            'Multi-Level Expense Claims with Receipt Uploads',
            'EMI Loan Schedules with Automatic Monthly Payroll Deductions',
            'Finance & Line Manager Approval Workflows'
        ]
    },
    {
        id: 'admin',
        title: 'Multi-Location, Devices & Role Security',
        badge: 'Step 7 of 8',
        icon: '⚙️',
        route: '/locations',
        description: 'Complete administrative control over company entities, branch geofences, physical kiosk devices, and granular permission matrices.',
        features: [
            'Branch Master with Interactive GPS Geofence Mapping',
            'Kiosk Device Provisioning & Remote Token Management',
            'Shift Rosters & Custom Working Hours Configuration',
            'Granular Role-Based Access Control (RBAC) Matrix'
        ]
    },
    {
        id: 'help',
        title: 'Interactive User Manual & PDF Handbook',
        badge: 'Step 8 of 8',
        icon: '📖',
        route: '/help',
        description: 'Access complete documentation, searchable FAQs, a 1-page executive marketing brochure, and download full PDF manuals anytime.',
        features: [
            'Full-Text Keyword Search across all User Guides',
            '1-Page Printable Biometric Marketing Flyer',
            'Download Complete Platform Manual as PDF',
            'Interactive FAQ Accordions with Step-by-Step Guides'
        ]
    }
];

export default function VirtualTour({ isOpen, onClose }) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) {
            setCurrentStepIndex(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const currentStep = TOUR_STEPS[currentStepIndex];
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;
    const progressPercent = ((currentStepIndex + 1) / TOUR_STEPS.length) * 100;

    const handleNext = () => {
        if (isLastStep) {
            handleFinish();
        } else {
            const nextIdx = currentStepIndex + 1;
            setCurrentStepIndex(nextIdx);
            if (TOUR_STEPS[nextIdx].route) {
                navigate(TOUR_STEPS[nextIdx].route);
            }
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            const prevIdx = currentStepIndex - 1;
            setCurrentStepIndex(prevIdx);
            if (TOUR_STEPS[prevIdx].route) {
                navigate(TOUR_STEPS[prevIdx].route);
            }
        }
    };

    const handleDotClick = (idx) => {
        setCurrentStepIndex(idx);
        if (TOUR_STEPS[idx].route) {
            navigate(TOUR_STEPS[idx].route);
        }
    };

    const handleFinish = () => {
        localStorage.setItem('hasSeenVirtualTour', 'true');
        onClose();
    };

    return (
        <div className="virtual-tour-overlay" onClick={onClose}>
            <div className="virtual-tour-card" onClick={(e) => e.stopPropagation()}>
                <div className="tour-header">
                    <span className="tour-badge">
                        ✨ {currentStep.badge}
                    </span>
                    <button className="tour-close-btn" onClick={onClose} title="Exit Tour">
                        <HiOutlineXMark />
                    </button>
                </div>

                <div className="tour-body">
                    <div className="tour-step-icon">
                        <span>{currentStep.icon}</span>
                    </div>

                    <h3 className="tour-title">{currentStep.title}</h3>
                    <p className="tour-description">{currentStep.description}</p>

                    <div className="tour-features-list">
                        {currentStep.features.map((feat, idx) => (
                            <div key={idx} className="tour-feature-item">
                                <span className="tour-feature-bullet">✓</span>
                                <span>{feat}</span>
                            </div>
                        ))}
                    </div>

                    <div className="tour-progress-bar">
                        <div className="tour-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>

                <div className="tour-footer">
                    <div className="tour-dots">
                        {TOUR_STEPS.map((_, idx) => (
                            <div
                                key={idx}
                                className={`tour-dot ${idx === currentStepIndex ? 'active' : ''}`}
                                onClick={() => handleDotClick(idx)}
                                title={`Go to step ${idx + 1}`}
                            />
                        ))}
                    </div>

                    <div className="tour-actions">
                        <button className="btn-tour-nav btn-tour-skip" onClick={handleFinish}>
                            Skip Tour
                        </button>
                        {!isFirstStep && (
                            <button className="btn-tour-nav btn-tour-prev" onClick={handlePrev}>
                                Previous
                            </button>
                        )}
                        <button className="btn-tour-nav btn-tour-next" onClick={handleNext}>
                            {isLastStep ? 'Finish Tour 🚀' : 'Next Step →'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
