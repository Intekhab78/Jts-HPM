import { useState, useEffect, useRef } from 'react';
import { 
    HiOutlinePlay, 
    HiOutlinePause, 
    HiOutlineArrowDownTray, 
    HiOutlinePrinter, 
    HiOutlineSparkles,
    HiOutlineArrowPath,
    HiOutlineDocumentText,
    HiOutlinePhoto
} from 'react-icons/hi2';
import DynamicScreenMockup from './ScreenMockups';
import './ProcessVideoPlayer.css';

export const VIDEO_TUTORIALS = [
    {
        id: 'master-walkthrough',
        title: 'Complete End-to-End HR & Biometric System Walkthrough',
        badge: 'Master Walkthrough • 10 Mins',
        icon: '🚀',
        duration: '03:45',
        totalSeconds: 225,
        summary: 'Comprehensive overview of the complete platform lifecycle: from employee onboarding and facial recognition kiosk to WPS payroll and gratuity settlements.',
        scenes: [
            {
                time: '00:00 - 00:30',
                startSec: 0,
                endSec: 30,
                stepBadge: 'Phase 1 • Executive Overview',
                icon: '📊',
                screenType: 'dashboard',
                heading: 'Real-Time KPI Dashboard & Role Security',
                description: 'The dashboard aggregates real-time headcount, live present/absent counts, late arrivals, and visa expiry alerts protected by enterprise Role-Based Access Control (RBAC).',
                narration: '“Welcome to the HR & Biometric Payroll System. The centralized dashboard tracks daily timesheets, pending approvals, and statutory compliance at a glance.”'
            },
            {
                time: '00:30 - 01:15',
                startSec: 30,
                endSec: 75,
                stepBadge: 'Phase 2 • Smart Onboarding',
                icon: '👥',
                screenType: 'employee',
                heading: 'Employee Master & Emirates ID Reader',
                description: 'Auto-extracts Emirates ID data, configures multi-allowance pay elements, maps branch geofences, and sets up approval routing hierarchies.',
                narration: '“New hires are onboarded in minutes with digital Emirates ID attachment and multi-allowance WPS salary breakdowns.”'
            },
            {
                time: '01:15 - 02:00',
                startSec: 75,
                endSec: 120,
                stepBadge: 'Phase 3 • Edge AI Biometrics',
                icon: '🤖',
                screenType: 'kiosk',
                heading: 'Touchless AI Facial Recognition Kiosk',
                description: 'ResNet-34 128D neural network processes face captures in < 200ms with a calibrated ≤ 0.48 threshold, rejecting lookalikes and family members with voice guidance.',
                narration: '“Our AI face recognition kiosk verifies employees touchlessly with instant voice feedback and offline caching for over 10,000 staff.”'
            },
            {
                time: '02:00 - 02:45',
                startSec: 120,
                endSec: 165,
                stepBadge: 'Phase 4 • Leaves & Timesheets',
                icon: '🏖️',
                screenType: 'timesheet',
                heading: 'Timesheet Grid & Overtime Analysis',
                description: 'Compiles punches from kiosks and mobile app, calculating late arrival penalties, 1.25x general overtime, and 1.50x weekend overtime.',
                narration: '“Attendance records show exact in/out times, late minutes, and overtime rates mapped directly from kiosk devices.”'
            },
            {
                time: '02:45 - 03:45',
                startSec: 165,
                endSec: 225,
                stepBadge: 'Phase 5 • WPS SIF & Gratuity',
                icon: '💰',
                screenType: 'payroll',
                heading: 'WPS Payroll SIF Export & Gratuity Calculator',
                description: 'Aggregates timesheets, 1.25x OT, late penalties, and loans into an official Central Bank WPS SIF file with 1-click End of Service settlement calculation.',
                narration: '“With one click, compile monthly timesheets and generate the official Central Bank WPS SIF file for error-free bank salary transfers.”'
            }
        ]
    },
    {
        id: 'biometric-kiosk',
        title: 'AI Biometric Facial Recognition Kiosk Setup & Matching',
        badge: 'Module 1 • Biometrics',
        icon: '🤖',
        duration: '02:15',
        totalSeconds: 135,
        summary: 'How the tablet kiosk operates, Euclidean face calibration (≤ 0.48), anti-spoofing, lookalike rejection, and voice synthesis.',
        scenes: [
            {
                time: '00:00 - 00:45',
                startSec: 0,
                endSec: 45,
                stepBadge: 'Step 1 • Kiosk Launch',
                icon: '📱',
                screenType: 'kiosk',
                heading: 'Provisioning Kiosk Tablet & Branch Select',
                description: 'Launch the mobile app in Kiosk Mode, select the designated branch location, and place the tablet at the entrance or reception.',
                narration: '“Set up any Android or iOS tablet as an intelligent kiosk. The app downloads the local branch employee cache for instant offline operation.”'
            },
            {
                time: '00:45 - 01:30',
                startSec: 45,
                endSec: 90,
                stepBadge: 'Step 2 • 128D Face Analysis',
                icon: '🧠',
                screenType: 'kiosk',
                heading: 'Calibrated Face Vector Comparison',
                description: 'Compares real-time face embeddings against registered candidate photos. Lookalikes with distance > 0.48 are cleanly rejected as Unregistered.',
                narration: '“ResNet-34 neural embeddings guarantee that family members or non-employees cannot punch on another colleague’s record.”'
            },
            {
                time: '01:30 - 02:15',
                startSec: 90,
                endSec: 135,
                stepBadge: 'Step 3 • Live Voice Feedback',
                icon: '🔊',
                screenType: 'timesheet',
                heading: 'Voice Guidance & Multi-Modal Bypass',
                description: 'Speaks audio confirmations, warns unregistered individuals, and provides PIN and dynamic QR code options.',
                narration: '“The device speaks confirmations aloud: Welcome, punch recorded successfully, keeping shift entries transparent and touchless.”'
            }
        ]
    },
    {
        id: 'employee-onboarding',
        title: 'Employee Master Onboarding & Emirates ID Reader',
        badge: 'Module 2 • Onboarding',
        icon: '👥',
        duration: '02:00',
        totalSeconds: 120,
        summary: 'Step-by-step guide to adding employees, WPS bank account details, Emirates ID documents, and salary components.',
        scenes: [
            {
                time: '00:00 - 00:40',
                startSec: 0,
                endSec: 40,
                stepBadge: 'Step 1 • Profile Details',
                icon: '📝',
                screenType: 'employee',
                heading: 'Personal & Employment Information',
                description: 'Enter employee designation, corporate email, date of joining, and assign their reporting approval manager.',
                narration: '“Create digital employee profiles with custom designations and reporting manager routing.”'
            },
            {
                time: '00:40 - 01:20',
                startSec: 40,
                endSec: 80,
                stepBadge: 'Step 2 • WPS Salary Setup',
                icon: '💵',
                screenType: 'employee',
                heading: 'Configuring Basic & Dynamic Allowances',
                description: 'Set Basic Salary and attach allowances (HRA, Transport, Custom Bonuses). Validate IBAN and WPS Routing Agent codes.',
                narration: '“Attach multiple pay elements to ensure accurate WPS SIF bank file export at month-end.”'
            },
            {
                time: '01:20 - 02:00',
                startSec: 80,
                endSec: 120,
                stepBadge: 'Step 3 • Document Expiry Alarms',
                icon: '🪪',
                screenType: 'dashboard',
                heading: 'Emirates ID & Visa Expiry Alerts',
                description: 'Upload identification copies. Automated alerts notify HR before documents expire to maintain MOHRE compliance.',
                narration: '“Track document expiry dates with automated alerts at 60, 30, and 15 days before expiration.”'
            }
        ]
    },
    {
        id: 'wps-payroll-sif',
        title: 'WPS Payroll Processing & 1-Click SIF Bank Export',
        badge: 'Module 3 • Payroll & WPS',
        icon: '💰',
        duration: '02:30',
        totalSeconds: 150,
        summary: 'How to calculate monthly timesheets, 1.25x / 1.50x overtime, unpaid leaves, and generate the UAE Central Bank SIF file.',
        scenes: [
            {
                time: '00:00 - 00:50',
                startSec: 0,
                endSec: 50,
                stepBadge: 'Step 1 • Payroll Batch Draft',
                icon: '⚙️',
                screenType: 'payroll',
                heading: 'Calculating Monthly Timesheet & Overtime',
                description: 'Select month and click Calculate. The engine calculates standard 1.25x OT, 1.50x weekend OT, and late arrival penalties.',
                narration: '“The calculation engine automatically compiles timesheet punches, computing exact overtime and late arrival adjustments.”'
            },
            {
                time: '00:50 - 01:40',
                startSec: 50,
                endSec: 100,
                stepBadge: 'Step 2 • Deductions & Loans',
                icon: '📉',
                screenType: 'payroll',
                heading: 'Applying Loan EMIs & Unpaid Leaves',
                description: 'Automatically deducts active loan installments and unpaid sick/annual leaves pursuant to UAE Labor Law rules.',
                narration: '“Active loan EMIs and unpaid leave days are deducted seamlessly before final approval.”'
            },
            {
                time: '01:40 - 02:30',
                startSec: 100,
                endSec: 150,
                stepBadge: 'Step 3 • Generating SIF File',
                icon: '🏦',
                screenType: 'payroll',
                heading: '1-Click WPS SIF Central Bank File Export',
                description: 'Click Generate SIF to export the official text file formatted with Employer EID, Routing codes, and employee records.',
                narration: '“Download the official Central Bank SIF file ready for direct upload to your corporate bank portal.”'
            }
        ]
    },
    {
        id: 'gratuity-calculator',
        title: 'End of Service Gratuity & Final Settlement Calculation',
        badge: 'Module 4 • Gratuity & EOSB',
        icon: '⚖️',
        duration: '01:45',
        totalSeconds: 105,
        summary: 'UAE Federal Decree-Law No. 33 compliant gratuity calculation, leave encashment, and final settlement vouchers.',
        scenes: [
            {
                time: '00:00 - 00:35',
                startSec: 0,
                endSec: 35,
                stepBadge: 'Step 1 • Service Period',
                icon: '📅',
                screenType: 'gratuity',
                heading: 'Service Length & Basic Salary Pull',
                description: 'Automatically calculates total tenure from Date of Joining to Last Working Day, pulling the last Basic Salary.',
                narration: '“The Gratuity Calculator computes total years and days of service based on the employee’s joining and exit dates.”'
            },
            {
                time: '00:35 - 01:10',
                startSec: 35,
                endSec: 70,
                stepBadge: 'Step 2 • Statutory Formula',
                icon: '🧮',
                screenType: 'gratuity',
                heading: '21 Days (1-5 Yrs) & 30 Days (>5 Yrs)',
                description: 'Applies statutory 21 days basic pay per year for first 5 years and 30 days per year thereafter, capped at 2 years salary.',
                narration: '“Calculates 21 days of basic pay per year for the first 5 years and 30 days thereafter, ensuring 100% legal compliance.”'
            },
            {
                time: '01:10 - 01:45',
                startSec: 70,
                endSec: 105,
                stepBadge: 'Step 3 • Full Settlement Voucher',
                icon: '📄',
                screenType: 'gratuity',
                heading: 'Encashment & Loan Offset Settlement',
                description: 'Consolidates Gratuity + Unused Leave Encashment + Current Month Pay - Pending Loans into a printable final settlement.',
                narration: '“Generates the complete End of Service settlement voucher ready for employee signature and clearance.”'
            }
        ]
    },
    {
        id: 'mobile-geofence',
        title: 'Mobile App GPS Geofenced Punching & Anti-Mocking',
        badge: 'Module 5 • Mobile & GPS',
        icon: '📍',
        duration: '01:50',
        totalSeconds: 110,
        summary: 'Self-service mobile attendance for remote staff with high-accuracy GPS polygon boundaries and spoof detection.',
        scenes: [
            {
                time: '00:00 - 00:35',
                startSec: 0,
                endSec: 35,
                stepBadge: 'Step 1 • Branch Coordinates',
                icon: '🗺️',
                screenType: 'geofence',
                heading: 'Setting Geofence Radius in Admin',
                description: 'Admin creates branch locations with latitude/longitude coordinates and custom geofence polygons (e.g. 150m radius).',
                narration: '“Define exact branch GPS coordinates and perimeter radiuses in the Branch Locations master.”'
            },
            {
                time: '00:35 - 01:15',
                startSec: 35,
                endSec: 75,
                stepBadge: 'Step 2 • Mobile Clock-In',
                icon: '🤳',
                screenType: 'geofence',
                heading: 'Touchless Selfie & GPS Validation',
                description: 'Employee opens mobile app and captures verification photo. App validates GPS coordinates against mapped branch zones.',
                narration: '“Employees punch directly from their smartphone with instant photo audit and live GPS coordinate validation.”'
            },
            {
                time: '01:15 - 01:50',
                startSec: 75,
                endSec: 110,
                stepBadge: 'Step 3 • Anti-Mock Detection',
                icon: '🛡️',
                screenType: 'geofence',
                heading: 'Detecting Spoofed / Fake GPS Apps',
                description: 'System detects mock location apps and flags unauthorized off-site attempts for manager review.',
                narration: '“Built-in anti-mock GPS algorithms block fake location apps, guaranteeing punch integrity.”'
            }
        ]
    }
];

export default function ProcessVideoPlayer({ initialVideoId = 'master-walkthrough' }) {
    const [selectedVideoId, setSelectedVideoId] = useState(initialVideoId);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);

    const activeVideo = VIDEO_TUTORIALS.find(v => v.id === selectedVideoId) || VIDEO_TUTORIALS[0];

    // Find current scene based on playback seconds
    const currentScene = activeVideo.scenes.find(
        s => currentTime >= s.startSec && currentTime < s.endSec
    ) || activeVideo.scenes[activeVideo.scenes.length - 1];

    useEffect(() => {
        let timer = null;
        if (isPlaying) {
            timer = setInterval(() => {
                setCurrentTime(prev => {
                    if (prev >= activeVideo.totalSeconds) {
                        setIsPlaying(false);
                        return 0;
                    }
                    return prev + 1;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isPlaying, activeVideo]);

    const handleSelectVideo = (id) => {
        setSelectedVideoId(id);
        setCurrentTime(0);
        setIsPlaying(true);
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    const handleScrub = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, clickX / rect.width));
        const newSec = Math.floor(percent * activeVideo.totalSeconds);
        setCurrentTime(newSec);
    };

    const formatSeconds = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const handleDownloadProcessPackage = (video) => {
        // Generate a standalone, self-contained offline HTML5 Interactive Video Simulator Package
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${video.title} - HR & Biometric Process Guide</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; line-height: 1.6; }
        .card { max-width: 800px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 2rem; box-shadow: 0 20px 25px rgba(0,0,0,0.5); }
        .header { border-bottom: 2px solid #334155; padding-bottom: 1.5rem; margin-bottom: 2rem; }
        .badge { background: #0284c7; color: #fff; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
        h1 { margin: 0.5rem 0; font-size: 1.8rem; color: #38bdf8; }
        .step { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem; }
        .step h3 { margin: 0 0 0.5rem 0; color: #60a5fa; }
        .narration { background: rgba(56, 189, 248, 0.1); border-left: 3px solid #38bdf8; padding: 0.75rem 1rem; border-radius: 0 8px 8px 0; font-style: italic; color: #cbd5e1; margin-top: 0.75rem; }
        .footer { text-align: center; margin-top: 2rem; font-size: 0.85rem; color: #94a3b8; border-top: 1px solid #334155; padding-top: 1.5rem; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <span class="badge">${video.badge}</span>
            <h1>${video.title}</h1>
            <p>${video.summary}</p>
        </div>
        <h2>Process Walkthrough & Workflow Guide</h2>
        ${video.scenes.map((s, idx) => `
            <div class="step">
                <span class="badge">${s.stepBadge} (${s.time})</span>
                <h3>${s.icon} ${s.heading}</h3>
                <p>${s.description}</p>
                <div class="narration">${s.narration}</div>
            </div>
        `).join('')}
        <div class="footer">
            <strong>HR & Biometric Management System</strong> • Official Process Documentation
        </div>
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${video.id}-process-guide.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const progressPercent = (currentTime / activeVideo.totalSeconds) * 100;

    return (
        <div className="process-video-player-wrapper">
            {/* Top Interactive Player with Actual Screen Photo / Mockup */}
            <div className="video-player-container">
                <div className="video-player-screen" style={{ height: 'auto', minHeight: '440px' }}>
                    <div className="sim-grid-overlay"></div>
                    {isPlaying && <div className="sim-scanner-beam"></div>}

                    {/* Top Status Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, marginBottom: '0.75rem' }}>
                        <span className="sim-step-badge">
                            ✨ {currentScene.stepBadge}
                        </span>
                        <span className="sim-duration-badge">
                            {formatSeconds(currentTime)} / {activeVideo.duration}
                        </span>
                    </div>

                    {/* Realistic Application Screen Photo / Mockup */}
                    <div style={{ zIndex: 10, marginBottom: '0.75rem' }}>
                        <DynamicScreenMockup screenType={currentScene.screenType || 'dashboard'} />
                    </div>

                    {/* Narrator Voice Caption */}
                    <div className="video-captions-bar">
                        🎙️ {currentScene.narration}
                    </div>
                </div>

                {/* Scrubber & Video Controls */}
                <div className="video-controls-bar">
                    <div className="video-scrubber-track" onClick={handleScrub} title="Click to seek timeline">
                        <div className="video-scrubber-fill" style={{ width: `${progressPercent}%` }}></div>
                    </div>

                    <div className="video-controls-row">
                        <div className="video-playback-buttons">
                            <button className="btn-video-play" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                                {isPlaying ? <HiOutlinePause /> : <HiOutlinePlay />}
                            </button>
                            <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setCurrentTime(0); setIsPlaying(true); }}
                                title="Replay from start"
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <HiOutlineArrowPath /> Replay
                            </button>
                            <span className="video-time-display">
                                {formatSeconds(currentTime)} / {activeVideo.duration}
                            </span>
                        </div>

                        <div className="video-action-downloads">
                            <button 
                                onClick={() => handleDownloadProcessPackage(activeVideo)}
                                className="btn btn-primary btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                                title="Download offline process package"
                            >
                                <HiOutlineArrowDownTray /> Download Process Guide (.HTML / PDF)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Video Tutorial Library Grid */}
            <div style={{ marginTop: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary)' }}>
                            🎬 Video Tutorials & Process Walkthrough Library
                        </h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Select any process video below to watch the live application screen demonstration and download its standalone guide.
                        </p>
                    </div>
                </div>

                <div className="video-library-grid">
                    {VIDEO_TUTORIALS.map((vid) => {
                        const isSelected = vid.id === selectedVideoId;
                        return (
                            <div 
                                key={vid.id}
                                className={`video-thumbnail-card ${isSelected ? 'active' : ''}`}
                                onClick={() => handleSelectVideo(vid.id)}
                            >
                                <div className="thumbnail-preview-box">
                                    <div style={{ fontSize: '2.5rem', opacity: 0.6, position: 'absolute' }}>
                                        {vid.icon}
                                    </div>
                                    <div className="thumbnail-play-overlay">
                                        <HiOutlinePlay />
                                    </div>
                                    <span className="thumbnail-duration">{vid.duration}</span>
                                </div>
                                <div className="thumbnail-card-body">
                                    <div>
                                        <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                            {vid.badge}
                                        </span>
                                        <h4>{vid.title}</h4>
                                        <p>{vid.summary}</p>
                                    </div>
                                    <button 
                                        className="thumbnail-download-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownloadProcessPackage(vid);
                                        }}
                                        title="Download this process guide"
                                    >
                                        <HiOutlineArrowDownTray size={14} /> Download Guide
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
