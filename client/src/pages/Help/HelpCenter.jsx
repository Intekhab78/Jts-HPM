import { useState } from 'react';
import { 
    FiSearch, 
    FiFileText, 
    FiHelpCircle, 
    FiServer, 
    FiUsers, 
    FiDollarSign, 
    FiCalendar, 
    FiClock, 
    FiPrinter, 
    FiBookOpen, 
    FiShield, 
    FiPlayCircle, 
    FiMapPin, 
    FiCpu 
} from 'react-icons/fi';
import { 
    HiOutlineSparkles, 
    HiOutlineArrowDownTray, 
    HiOutlinePrinter, 
    HiOutlineCheckCircle, 
    HiOutlinePlay,
    HiOutlineFilm
} from 'react-icons/hi2';
import BiometricMarketingFlyer from './BiometricMarketingFlyer';
import ProcessVideoPlayer, { VIDEO_TUTORIALS } from '../../components/Help/ProcessVideoPlayer';
import DynamicScreenMockup from '../../components/Help/ScreenMockups';
import VirtualTour from '../../components/Tour/VirtualTour';
import './HelpCenter.css';

const MANUAL_CHAPTERS = [
    {
        id: 'overview-rbac',
        title: 'System Overview & Role Security (RBAC)',
        icon: FiServer,
        badge: 'Module 1 • System Architecture',
        summary: 'Understand the multi-tier role permissions and centralized dashboard metrics.',
        content: `The HR & UAE Payroll platform unites employee lifecycles, real-time AI biometrics, and statutory UAE Wages Protection System (WPS) payroll calculations under an enterprise Role-Based Access Control (RBAC) architecture.`,
        steps: [
            {
                title: 'User Roles & Access Levels',
                desc: 'Admins have unrestricted control; HR handles onboarding, leave policies, and attendance locks; Managers review subordinate leave and punch requests; Finance manages WPS SIF files and salary payouts; Employees have self-service mobile portal access.'
            },
            {
                title: 'Permission Matrices',
                desc: 'Granular permissions can be customized via Admin -> Permissions Matrix to permit or revoke specific actions (e.g. Delete punch logs, View salary components, Approve gratuity payouts).'
            }
        ],
        lawNotice: 'Compliant with UAE Federal Decree-Law No. 33 of 2021 regarding digital employment records and statutory data retention.',
        faqs: [
            { q: 'How do I log into the system?', a: 'Sign in using your Corporate Email and password. Default accounts can be reset anytime by the Admin or via the User Security tab.' },
            { q: 'Can a Manager approve leaves from their phone?', a: 'Yes. The mobile app provides a dedicated Team Approval interface where Managers can view and approve requests in real time.' }
        ]
    },
    {
        id: 'employee-management',
        title: 'Employee Master & Emirates ID Reader',
        icon: FiUsers,
        badge: 'Module 2 • Onboarding & Compliance',
        summary: 'Digital employee profiles, Emirates ID reader integration, and WPS bank details.',
        content: `The Employee Master serves as the single source of truth for employment contracts, reporting lines, WPS bank routing (Agent Codes / IBAN), and dynamic salary allowances.`,
        steps: [
            {
                title: 'Adding a New Employee',
                desc: 'Navigate to "Employees" -> "New Employee". Fill in personal details, corporate email, designation, joining date, reporting manager, and assigned primary branch location.'
            },
            {
                title: 'Configuring WPS Salary Breakdown',
                desc: 'Under "Salary Components", define the Basic Salary and click "+ Add Element" to attach statutory and custom pay elements (HRA, Transport, Fuel, Fixed Bonus). The system automatically validates IBAN and WPS routing codes.'
            },
            {
                title: 'Document & Visa Expiry Tracking',
                desc: 'Upload Emirates ID, Passport, and Visa copies. Automated dashboard notifications trigger at 60, 30, and 15 days before expiry to avoid Ministry fines.'
            }
        ],
        lawNotice: 'MOHRE WPS guidelines require an employee’s Basic Salary and Allowances to be strictly declared in the WPS SIF file for monthly bank salary disbursements.',
        faqs: [
            { q: 'What happens if an employee joins mid-month?', a: 'The payroll calculation automatically calculates pro-rata days worked from their Date of Joining, adjusting Basic Pay and Allowances accordingly.' },
            { q: 'How do I link an employee to multiple work branches?', a: 'Under the employee profile "Geofencing" tab, add additional allowed branch locations with customizable geofence radiuses.' }
        ]
    },
    {
        id: 'biometric-attendance',
        title: 'AI Biometric Facial Recognition, IP Cameras & Kiosk',
        icon: FiClock,
        badge: 'Module 3 • Edge AI Biometrics & CCTV',
        summary: 'Touchless IP Camera CCTV turnstiles, Tablet Kiosk, 128D neural network, multi-camera zone grouping, and mobile GPS.',
        content: `Our Edge AI face recognition engine captures attendance in under 200ms using a calibrated 128-dimensional neural vector embedding model. Compatible with existing CCTV / IP Cameras (Hikvision, Dahua, CP Plus, Uniview, Axis) and dedicated Tablet/Phone Kiosks with multi-camera area clubbing and touchless attendance.`,
        steps: [
            {
                title: 'IP Camera / CCTV Stream Integration (RTSP / ONVIF)',
                desc: 'Navigate to Admin -> Devices -> "+ Add IP Camera / CCTV". Select your camera brand preset (Hikvision, Dahua, CP Plus, Axis) or enter custom RTSP URL. The background AI engine automatically samples video frames (~3 FPS), detects employee faces, extracts 128D embeddings, and logs punches with snapshot audits.'
            },
            {
                title: 'Multi-Camera Area / Zone Grouping & Anti-Duplicate Cooldown',
                desc: 'When multiple cameras cover the same entrance, turnstiles, or gate (e.g. Inward & Outward angles), assign them the same "Area / Zone Grouping" tag. The system clubs the cameras into a unified area and enforces a shared anti-duplicate cooldown (1–15 mins, default 5 mins) so walking past multiple cameras registers only 1 seamless punch.'
            },
            {
                title: 'Unlimited (N) Punches per Day & Real-Time Timesheets',
                desc: 'Employees passing by turnstiles or IP cameras multiple times throughout the day (morning arrival, lunch break, tea break, evening exit, overtime departure) have all punches recorded in their daily punch timeline. The system automatically recalculates first Check-In, latest Check-Out, Late minutes, and Overtime (working day & holiday OT).'
            },
            {
                title: 'Dedicated Unregistered Visitors & Strangers Tab',
                desc: 'When an unregistered person (visitor, courier driver, client guest, contractor, or stranger) passes in front of the camera, the AI crops their face snapshot, logs the detection timestamp with camera/location badges, and saves it in the "Unregistered Visitors / Strangers Log" tab under Attendance. Admin/HR can tag their name, assign purpose categories (Client, Delivery, Contractor, Flagged), or 1-click register them as new employees.'
            },
            {
                title: 'Setting up a Tablet / Phone Kiosk',
                desc: 'Open the Mobile App, select "Kiosk Mode", and choose the branch location. The camera continuously scans for employees and validates punches with voice speech synthesis feedback.'
            },
            {
                title: 'Multi-Modal Punches (PIN & QR)',
                desc: 'If an employee wears high-grade protective gear or requires manual bypass, they can punch via secure Kiosk PIN or scan their dynamic mobile QR pass.'
            },
            {
                title: 'Mobile Geofenced Punching',
                desc: 'Field and roving staff can punch from their mobile portal. The app checks device GPS against the assigned branch geofence polygon with anti-mock GPS detection.'
            }
        ],
        lawNotice: 'Attendance records track clock-in, clock-out, late arrival minutes, and overtime hours pursuant to UAE labor law standard 8-hour daily shifts.',
        faqs: [
            { q: 'How does the system record multiple punches during the day for employees?', a: 'Every time an employee passes an active CCTV or Kiosk, their punch is appended to their Daily Punches Timeline with high-res audit snapshot. First punch sets check-in, and subsequent punches automatically update latest check-out and work hours.' },
            { q: 'Where can I see unregistered visitors captured by IP cameras?', a: 'Go to Attendance -> Unregistered Visitors / Strangers Log tab. You can view all captured face snapshots with timestamps, camera name, and zoom previews, tag visitor names, or 1-click onboard them.' },
            { q: 'Can I connect cameras from different branch offices?', a: 'Yes. Each IP camera is mapped to its respective Branch Location and Company. Employees mapped to that branch are recognized instantly.' }
        ]
    },
    {
        id: 'leave-management',
        title: 'Leave Policy & Statutory Rules (UAE Law)',
        icon: FiCalendar,
        badge: 'Module 4 • Leave & Encashment',
        summary: 'Annual leaves, statutory sick leave tiers, maternity/paternity, and leave encashment.',
        content: `Automated leave entitlement balances with built-in UAE statutory sick leave calculations and seamless Line Manager approval routing.`,
        steps: [
            {
                title: 'Applying for Leave',
                desc: 'Employees apply via web or mobile, selecting the leave type, date range, and optional medical/travel attachment. Balance is validated in real time.'
            },
            {
                title: 'Statutory Sick Leave Tier Deductions',
                desc: 'Pursuant to Article 31 of UAE Labor Law: First 15 days = 100% Full Pay; Next 30 days = 50% Half Pay; Remaining days = Unpaid (automatically deducted in Payroll).'
            },
            {
                title: 'Leave Encashment Payouts',
                desc: 'Employees with excess accrued annual leave can submit an encashment request. Once approved, the payout is calculated based on Basic Salary and added to their next payroll.'
            }
        ],
        lawNotice: 'UAE Labor Law mandates 30 calendar days of paid annual leave after completing one year of service (2 days per month for 6 months to 1 year).',
        faqs: [
            { q: 'Can an employee take leave while on probation?', a: 'Yes, if authorized by HR. The system supports custom rules to mark probation leaves as unpaid or prorated.' },
            { q: 'Are public holidays counted during annual leave?', a: 'Statutory company holidays can be configured in the Holiday Master to exclude from leave balance consumption.' }
        ]
    },
    {
        id: 'wps-payroll',
        title: 'WPS Payroll Processing & SIF Generation',
        badge: 'Module 5 • Wages Protection System',
        icon: FiDollarSign,
        summary: 'Central Bank compliant SIF files, overtime calculation (1.25x / 1.50x), and pay slips.',
        content: `The Payroll engine mathematically aggregates Basic Salary, dynamic static allowances, late penalties, overtime yields, unpaid leave deductions, and loan installments into an official WPS SIF file.`,
        steps: [
            {
                title: 'Drafting Monthly Payroll',
                desc: 'Navigate to "Payroll" -> Select Target Month/Year -> Click "Calculate Payroll". The engine computes all employee records instantly.'
            },
            {
                title: 'Reviewing Overtime & Timesheets',
                desc: 'Timesheet punches auto-calculate standard overtime at 1.25x hourly basic rate and weekend/holiday overtime at 1.50x hourly rate.'
            },
            {
                title: '1-Click WPS SIF File Export',
                desc: 'Once approved, click "Generate SIF". The system exports the official Central Bank text file containing Employer EID, Routing Code, and formatted employee records ready for bank portal upload.'
            }
        ],
        lawNotice: 'WPS Compliance: Under Ministerial Resolution No. 43 of 2022, 100% of employees must receive salaries through the Wages Protection System within 15 days of the due date.',
        faqs: [
            { q: 'What bank format does the SIF generator follow?', a: 'The generator follows the official UAE Central Bank WPS Salary Information File (SIF) standard layout (.SIF / .CSV).' },
            { q: 'How are late arrival deductions calculated?', a: 'If an employee exceeds the configured monthly grace period (e.g. 15 mins), late minutes are automatically converted to an equivalent hourly basic salary deduction.' }
        ]
    },
    {
        id: 'gratuity-settlement',
        title: 'End of Service Gratuity Settlement',
        icon: FiDollarSign,
        badge: 'Module 6 • Final Settlements',
        summary: 'UAE Federal Decree-Law No. 33 compliant gratuity and final settlement engine.',
        content: `Calculate End of Service Benefits (EOSB) with zero manual formulas based on the employee’s Date of Joining, Last Working Day, Exit Type, and Basic Salary.`,
        steps: [
            {
                title: 'Calculation Rules (Unlimited Contracts)',
                desc: '• Less than 1 year of service: No gratuity entitlement.\n• 1 to 5 years of service: 21 days basic salary for each year of service.\n• Over 5 years of service: 30 days basic salary for each additional year, capped at 2 years total salary.'
            },
            {
                title: 'Final Settlement Compilation',
                desc: 'Aggregates Gratuity + Unpaid Salary for current month + Encashment of unused Leave balance - Pending Loan / Advance balance.'
            }
        ],
        lawNotice: 'Pursuant to Article 51 of the UAE Labor Law, gratuity is strictly calculated on the employee’s last drawn Basic Salary (excluding allowances).',
        faqs: [
            { q: 'Is gratuity reduced if an employee resigns?', a: 'Under the 2021 UAE Labor Law (Federal Decree-Law No. 33), gratuity calculation is uniform across resignation and termination under standard limited contracts.' }
        ]
    },
    {
        id: 'loans-advances-tickets',
        title: 'Loans, Salary Advances & Air Tickets',
        icon: FiDollarSign,
        badge: 'Module 7 • Employee Benefits',
        summary: 'Automated EMI deductions, emergency salary advances, and annual flight ticket allowances.',
        content: `Comprehensive employee financing and travel entitlement workflows with multi-tier approval chains and automated monthly payroll deductions.`,
        steps: [
            {
                title: 'Salary Advances & EMI Schedules',
                desc: 'Employees request an advance. Upon approval, the system generates monthly EMI installments that automatically deduct from upcoming payroll batches until fully settled.'
            },
            {
                title: 'Air Ticket Entitlements',
                desc: 'Tracks annual/biennial air ticket quotas by sector and family coverage. Supports ticket booking reimbursement or cash encashment through payroll.'
            }
        ],
        lawNotice: 'Total monthly loan and advance deductions are capped at 50% of the employee’s net monthly salary in compliance with UAE Labor Law protection limits.',
        faqs: [
            { q: 'Can an employee pay off a loan early?', a: 'Yes. Admins can record an early lump-sum settlement in the Loan Master which marks remaining installments as closed.' }
        ]
    },
    {
        id: 'admin-devices-roster',
        title: 'Branch Geofencing, Kiosks & Shift Rosters',
        icon: FiCpu,
        badge: 'Module 8 • Admin & Infrastructure',
        summary: 'Company entities, multi-branch geofencing, hardware device tokens, and shift rosters.',
        content: `Manage enterprise organizational structures, geofenced branch boundaries, physical kiosk terminal authorizations, and flexible multi-shift rosters.`,
        steps: [
            {
                title: 'Branch Locations & GPS Geofencing',
                desc: 'Define company branch offices with latitude/longitude coordinates and custom geofence radius (e.g. 150m) to enforce location-validated punches.'
            },
            {
                title: 'Kiosk Device Master',
                desc: 'Provision hardware tablets or kiosk phones, generate secure device tokens, and monitor live online/offline heartbeat status.'
            },
            {
                title: 'Shift Roster & Working Hours',
                desc: 'Assign general 8-hour shifts, night shifts, rotational rosters, or seasonal Ramadan working hour reductions.'
            }
        ],
        lawNotice: 'During Ramadan, standard statutory working hours are reduced by 2 hours daily across all private sector employees in the UAE.',
        faqs: [
            { q: 'How many kiosk devices can be connected?', a: 'There is no limit. You can register unlimited tablets across multiple branches, warehouses, and client sites.' }
        ]
    }
];

export default function HelpCenter() {
    const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'videos' | 'flyer' | 'faq'
    const [searchQuery, setSearchQuery] = useState('');
    const [activeChapterId, setActiveChapterId] = useState('overview-rbac');
    const [expandedFaqId, setExpandedFaqId] = useState(null);
    const [showTourModal, setShowTourModal] = useState(false);
    const [selectedVideoId, setSelectedVideoId] = useState('master-walkthrough');

    // Chapter to Video Mapping
    const chapterVideoMap = {
        'overview-rbac': 'master-walkthrough',
        'employee-management': 'employee-onboarding',
        'biometric-attendance': 'biometric-kiosk',
        'leave-management': 'master-walkthrough',
        'wps-payroll': 'wps-payroll-sif',
        'gratuity-settlement': 'gratuity-calculator',
        'loans-advances-tickets': 'wps-payroll-sif',
        'admin-devices-roster': 'mobile-geofence'
    };

    // Chapter to Screen Photo Mockup Mapping
    const chapterScreenMap = {
        'overview-rbac': 'dashboard',
        'employee-management': 'employee',
        'biometric-attendance': 'kiosk',
        'leave-management': 'timesheet',
        'wps-payroll': 'payroll',
        'gratuity-settlement': 'gratuity',
        'loans-advances-tickets': 'payroll',
        'admin-devices-roster': 'geofence'
    };

    // Live search filtering across all chapters, steps, and FAQs
    const filteredChapters = MANUAL_CHAPTERS.map(ch => {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ch.title.toLowerCase().includes(q);
        const matchesSummary = ch.summary.toLowerCase().includes(q);
        const matchesContent = ch.content.toLowerCase().includes(q);
        const matchedSteps = ch.steps.filter(s => s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
        const matchedFaqs = ch.faqs.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));

        if (matchesTitle || matchesSummary || matchesContent || matchedSteps.length > 0 || matchedFaqs.length > 0) {
            return {
                ...ch,
                steps: searchQuery ? (matchedSteps.length > 0 ? matchedSteps : ch.steps) : ch.steps,
                faqs: searchQuery ? (matchedFaqs.length > 0 ? matchedFaqs : ch.faqs) : ch.faqs
            };
        }
        return null;
    }).filter(Boolean);

    const activeChapter = filteredChapters.find(ch => ch.id === activeChapterId) || filteredChapters[0];

    const handlePrintManual = () => {
        window.print();
    };

    const handleWatchVideoForChapter = (chapterId) => {
        const targetVidId = chapterVideoMap[chapterId] || 'master-walkthrough';
        setSelectedVideoId(targetVidId);
        setActiveTab('videos');
    };

    const handleDownloadChapterPackage = (chapter) => {
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${chapter.title} - HR & Biometric Process Guide</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; line-height: 1.6; }
        .card { max-width: 800px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 2rem; box-shadow: 0 20px 25px rgba(0,0,0,0.5); }
        .badge { background: #0284c7; color: #fff; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
        h1 { margin: 0.5rem 0; font-size: 1.8rem; color: #38bdf8; }
        .step { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem; }
        .step h3 { margin: 0 0 0.5rem 0; color: #60a5fa; }
        .law { background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 1rem; border-radius: 0 8px 8px 0; margin: 1.5rem 0; color: #cbd5e1; }
        .faq { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; }
        .faq h4 { margin: 0 0 0.25rem 0; color: #38bdf8; }
        .footer { text-align: center; margin-top: 2rem; font-size: 0.85rem; color: #94a3b8; border-top: 1px solid #334155; padding-top: 1.5rem; }
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">${chapter.badge}</span>
        <h1>${chapter.title}</h1>
        <p>${chapter.content}</p>
        
        <h2>Step-by-Step Workflow Guide</h2>
        ${chapter.steps.map((s, idx) => `
            <div class="step">
                <h3>Step ${idx + 1}: ${s.title}</h3>
                <p>${s.desc}</p>
            </div>
        `).join('')}

        ${chapter.lawNotice ? `
            <div class="law">
                <strong>⚖️ UAE Labor Law & Statutory Compliance:</strong>
                <div>${chapter.lawNotice}</div>
            </div>
        ` : ''}

        <h2>Frequently Asked Questions</h2>
        ${chapter.faqs.map(f => `
            <div class="faq">
                <h4>Q: ${f.q}</h4>
                <p><strong>A:</strong> ${f.a}</p>
            </div>
        `).join('')}

        <div class="footer">
            <strong>HR & Biometric Management System</strong> • Official Process Guide Export
        </div>
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${chapter.id}-process-guide.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="help-center-page">
            {/* Top Header */}
            <div className="page-header" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="page-title">Documentation & Video Tutorials Hub</h1>
                    <p className="page-subtitle">Interactive user manuals, process simulation videos, and downloadable guides</p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button 
                        onClick={() => setShowTourModal(true)}
                        className="btn btn-secondary btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', borderColor: '#38bdf8' }}
                    >
                        <HiOutlineSparkles /> Start Virtual Tour 🚀
                    </button>
                    <button 
                        onClick={handlePrintManual}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Download complete documentation as high-res PDF"
                    >
                        <HiOutlinePrinter size={18} /> Download Full Manual (PDF)
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="help-tabs-header print-hide">
                <button 
                    className={`help-tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                    onClick={() => setActiveTab('manual')}
                >
                    <FiBookOpen /> Full User Manual & Guides
                </button>
                <button 
                    className={`help-tab-btn ${activeTab === 'videos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('videos')}
                >
                    <HiOutlineFilm /> 🎬 Video Tutorials & Simulation Hub
                </button>
                <button 
                    className={`help-tab-btn ${activeTab === 'flyer' ? 'active' : ''}`}
                    onClick={() => setActiveTab('flyer')}
                >
                    <HiOutlineSparkles /> 1-Page Biometric Marketing Flyer
                </button>
                <button 
                    className={`help-tab-btn ${activeTab === 'faq' ? 'active' : ''}`}
                    onClick={() => setActiveTab('faq')}
                >
                    <FiHelpCircle /> Master FAQ Matrix
                </button>
            </div>

            {/* TAB 1: FULL USER MANUAL */}
            {activeTab === 'manual' && (
                <div>
                    {/* Search Bar */}
                    <div className="print-hide" style={{ marginBottom: '1.5rem', position: 'relative', maxWidth: '600px' }}>
                        <FiSearch style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input 
                            type="text"
                            className="form-control"
                            placeholder="Search any keyword (e.g. WPS, SIF, face recognition, overtime, gratuity, sick leave)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '2.8rem', borderRadius: '12px', height: '48px', fontSize: '0.95rem' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
                        {/* Chapters Sidebar */}
                        <div className="card print-hide" style={{ padding: '0.75rem 0' }}>
                            <div style={{ padding: '0 1.25rem 0.75rem 1.25rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>
                                Manual Modules ({filteredChapters.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '0.5rem' }}>
                                {filteredChapters.length === 0 ? (
                                    <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No matching modules</div>
                                ) : (
                                    filteredChapters.map(ch => {
                                        const Icon = ch.icon;
                                        const isActive = activeChapter?.id === ch.id;
                                        return (
                                            <button
                                                key={ch.id}
                                                onClick={() => { setActiveChapterId(ch.id); setExpandedFaqId(null); }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    padding: '0.75rem 1.25rem',
                                                    border: 'none',
                                                    background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                                                    color: isActive ? 'var(--primary-color)' : 'var(--text-primary)',
                                                    borderLeft: isActive ? '3px solid var(--primary-color)' : '3px solid transparent',
                                                    textAlign: 'left',
                                                    cursor: 'pointer',
                                                    fontSize: '0.88rem',
                                                    fontWeight: isActive ? 700 : 400,
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                <Icon style={{ fontSize: '1.15rem', flexShrink: 0 }} />
                                                <span>{ch.title}</span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Chapter Details Area */}
                        <div>
                            {activeChapter ? (
                                <div className="manual-chapter-card">
                                    <div className="manual-chapter-header">
                                        <div style={{ flex: 1 }}>
                                            <span className="manual-section-badge">
                                                {activeChapter.badge}
                                            </span>
                                            <h2 style={{ fontSize: '1.6rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                                                {activeChapter.title}
                                            </h2>
                                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                                                {activeChapter.content}
                                            </p>
                                        </div>

                                        {/* Action Buttons for this Chapter */}
                                        <div className="print-hide" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                            <button 
                                                onClick={() => handleWatchVideoForChapter(activeChapter.id)}
                                                className="btn btn-secondary btn-outline"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#38bdf8', borderColor: '#38bdf8' }}
                                                title="Watch video tutorial for this process"
                                            >
                                                <HiOutlinePlay /> Watch Video
                                            </button>
                                            <button 
                                                onClick={() => handleDownloadChapterPackage(activeChapter)}
                                                className="btn btn-secondary btn-outline"
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                                                title="Download this specific chapter process guide"
                                            >
                                                <HiOutlineArrowDownTray /> Download Chapter Guide
                                            </button>
                                        </div>
                                    </div>

                                    {/* Application UI Screen Preview / Screenshot */}
                                    <div style={{ margin: '1.5rem 0' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            🖥️ Application Screen Preview
                                        </div>
                                        <DynamicScreenMockup screenType={chapterScreenMap[activeChapter.id] || 'dashboard'} />
                                    </div>

                                    {/* Visual Process Steps */}
                                    <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: '1.5rem 0 1rem 0' }}>
                                        📋 Step-by-Step Workflow Guide
                                    </h4>
                                    <div className="manual-step-list">
                                        {activeChapter.steps.map((st, idx) => (
                                            <div key={idx} className="manual-step-card">
                                                <div className="manual-step-num">{idx + 1}</div>
                                                <div className="manual-step-content">
                                                    <h5>{st.title}</h5>
                                                    <p>{st.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* UAE Labor Law / Compliance Alert */}
                                    {activeChapter.lawNotice && (
                                        <div className="manual-law-alert">
                                            <strong>⚖️ UAE Labor Law & Compliance Note:</strong>
                                            <div>{activeChapter.lawNotice}</div>
                                        </div>
                                    )}

                                    {/* Module FAQ Accordion */}
                                    <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: '2rem 0 1rem 0' }}>
                                        💡 Frequently Asked Questions
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {activeChapter.faqs.map((faq, idx) => {
                                            const isExpanded = expandedFaqId === `${activeChapter.id}-${idx}`;
                                            return (
                                                <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                                                    <button
                                                        onClick={() => setExpandedFaqId(isExpanded ? null : `${activeChapter.id}-${idx}`)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '0.9rem 1.25rem',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            background: 'var(--bg-tertiary)',
                                                            border: 'none',
                                                            color: 'var(--text-primary)',
                                                            fontWeight: 600,
                                                            fontSize: '0.9rem',
                                                            cursor: 'pointer',
                                                            textAlign: 'left'
                                                        }}
                                                    >
                                                        <span>{faq.q}</span>
                                                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                                                            ▼
                                                        </span>
                                                    </button>
                                                    {isExpanded && (
                                                        <div style={{ padding: '1rem 1.25rem', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                                                            {faq.a}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                                    <p style={{ color: 'var(--text-secondary)' }}>Select a module from the left menu or adjust your search filter.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: VIDEO TUTORIALS & SIMULATION HUB */}
            {activeTab === 'videos' && (
                <div>
                    <ProcessVideoPlayer initialVideoId={selectedVideoId} />
                </div>
            )}

            {/* TAB 3: 1-PAGE BIOMETRIC PROCESS & MARKETING FLYER */}
            {activeTab === 'flyer' && (
                <div>
                    <BiometricMarketingFlyer />
                </div>
            )}

            {/* TAB 4: MASTER FAQ MATRIX */}
            {activeTab === 'faq' && (
                <div className="card">
                    <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                        Comprehensive System FAQ Matrix
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {MANUAL_CHAPTERS.flatMap(ch => ch.faqs.map(f => ({ ...f, chapter: ch.title }))).map((faq, idx) => (
                            <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.25rem', background: 'var(--bg-tertiary)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                    {faq.chapter}
                                </div>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1rem' }}>
                                    Q: {faq.q}
                                </h4>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                                    <strong>A:</strong> {faq.a}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Virtual Tour Modal */}
            <VirtualTour 
                isOpen={showTourModal} 
                onClose={() => setShowTourModal(false)} 
            />
        </div>
    );
}

