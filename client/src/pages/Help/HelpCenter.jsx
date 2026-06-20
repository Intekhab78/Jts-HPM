import { useState } from 'react';
import { FiSearch, FiFileText, FiHelpCircle, FiServer, FiUsers, FiDollarSign, FiCalendar, FiClock } from 'react-icons/fi';

const helpTopics = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        icon: FiServer,
        content: `Welcome to the HR & UAE Payroll System. This platform unifies all employee records, attendance biometrics, and local WPS compliant payroll processing into one centralized dashboard. Check your role permissions to understand what menus you can access.`,
        faqs: [
            { q: 'How do I log in?', a: 'Sign in using your assigned Corporate Email and password. The default password is "password123". Please change it via your Profile Security tab upon first login.' },
            { q: 'What is my Role?', a: 'Roles (Admin, HR, Manager, Finance, Employee) dictate what sidebar menus you can see. If you believe you are missing a menu, contact your system Administrator.' }
        ]
    },
    {
        id: 'employees',
        title: 'Employee Management',
        icon: FiUsers,
        content: `The Employees module allows HR and Admins to onboard new staff. You must map them to a Company and Location structural node.`,
        faqs: [
            { q: 'How do I add a new employee?', a: 'Navigate to "Employees" -> "New Employee". Fill in the multi-tab form. A basic salary, join date, and manager are required for system routing.' },
            { q: 'How do I assign Allowances?', a: 'Go to the "Add/Edit Employee" form, locate the "Salary Components" section, and click "+ Add Element". You can link dynamic Pay Elements (like HRA or Transport) directly from the Master list.' },
            { q: 'What happens during Probation?', a: 'If an employee is marked as "Probation Active", any leave they take can be mathematically deducted from their monthly salary depending on your configured Leave Rules.' }
        ]
    },
    {
        id: 'attendance',
        title: 'Biometric Attendance',
        icon: FiClock,
        content: `Attendance holds all clock-in events. It powers the analytical engine that detects Latenss penalties and calculated Overtime rates.`,
        faqs: [
            { q: 'How do I upload an Excel Biometric sheet?', a: 'Go to Attendance -> Upload. Ensure your Excel columns are strictly named "EmployeeId", "Date" (YYYY-MM-DD), "PunchIn" (HH:mm), and "PunchOut" (HH:mm).' },
            { q: 'How is Overtime calculated?', a: 'The engine compares daily punches to an 8-hour threshold. General Overtime bills at 1.25x your basic hourly rate. Overtime worked on weekends/holidays bills at 1.50x.' },
            { q: 'What if someone forgets to Punch out?', a: 'The shift will be marked "Invalid" spanning 0 hours. Managers or HR must manually resolve the boundary in the Attendance grid.' }
        ]
    },
    {
        id: 'leaves',
        title: 'Leave Policy & Encashment',
        icon: FiCalendar,
        content: `Employees can apply for leaves which route to their Line Manager for approval. HR can globally configure total annual quotas per Designation via the Master setup.`,
        faqs: [
            { q: 'What is Leave Encashment?', a: 'Employees with excess accrued Annual Leave can initiate a payout request for those days instead of taking physical time off. It requires dual-approval.' },
            { q: 'Do sick leaves deduct from pay?', a: 'In the UAE, the first 15 sick days are fully paid, the next 30 are half-paid, and subsequent days are unpaid. The Payroll engine tracks this automatically based on Approved Leave requests.' }
        ]
    },
    {
        id: 'payroll',
        title: 'WPS Payroll & Gratuity',
        icon: FiDollarSign,
        content: `Payroll serves as the final compilation engine. It aggregates Basic Salary, dynamic static Pay Elements, Overtime yields, and Deductions (Late, Loan/EMI, Unpaid Leaves) into a single batch.`,
        faqs: [
            { q: 'How do I generate the monthly payroll?', a: 'Navigate to "Payroll". Select the target Month and Year. The system will mathematically assess every active employee and draft their financial output. You can drill into their draft to review the math.' },
            { q: 'How do I generate a Bank SIF file?', a: 'Once you change Draft records to "Approved", you can click the green "Generate SIF" button on the Payroll grid. It will export the required Central Bank WPS layout file to your local computer.' },
            { q: 'How does the Gratuity Calculator work?', a: 'It calculates End of Service benefits pursuant strictly to UAE labor law (21 days for the first 5 years, 30 days onwards) mathematically pulling your Basic Salary component from the Master lists.' },
            { q: 'Why is an employee\'s salary prorated?', a: 'If an employee joins mid-month, the generation engine automatically detects their Date of Joining and applies a strict mathematical ratio to their Basic Pay and Allowances so they only get paid for active days.' }
        ]
    },
    {
        id: 'masters',
        title: 'Master Data Configuration',
        icon: FiFileText,
        content: `Admins have absolute control over the structural logic deployed across the entire platform via Master Setup grids.`,
        faqs: [
            { q: 'What is the Pay Element Master?', a: 'It acts as the core central repository tracking active earnings and deductions. If you need a custom "Safety Bonus" component, simply add it to the Master list, and it immediately becomes bindable on all Employee onboarding sheets.' },
            { q: 'How do I configure Holidays?', a: 'Go to Company Holidays on the sidebar. Add the statutory dates (e.g. Eid, National Day) and mark them "Paid". Attendance algorithms will automatically void absence penalties for these explicit dates.' },
            { q: 'How do I build the Approval Workflow?', a: 'Approval Routing leverages the "Multi-level Manager" mapping you apply to an employee\'s profile. For Financial items like Travel Expenses, a secondary tier dynamically kicks in requiring the Finance team.' }
        ]
    }
];

export default function HelpCenter() {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFaq, setExpandedFaq] = useState(null);
    const [activeTopic, setActiveTopic] = useState('getting-started');

    // Simple search across titles, content, and FAQ Q&As
    const filteredTopics = helpTopics.map(topic => {
        const query = searchQuery.toLowerCase();
        const matchesTopic = topic.title.toLowerCase().includes(query) || topic.content.toLowerCase().includes(query);
        const matchedFaqs = topic.faqs.filter(faq =>
            faq.q.toLowerCase().includes(query) || faq.a.toLowerCase().includes(query)
        );

        if (matchesTopic || matchedFaqs.length > 0) {
            return {
                ...topic,
                faqs: searchQuery ? matchedFaqs : topic.faqs // Show only matching FAQs if searching, else all
            };
        }
        return null;
    }).filter(Boolean);

    const TopicIcon = helpTopics.find(t => t.id === activeTopic)?.icon || FiHelpCircle;
    const currentTopicData = filteredTopics.find(t => t.id === activeTopic) || filteredTopics[0];

    return (
        <div className="help-center-page">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 className="page-title">Help Center & User Manual</h1>
                    <p className="page-subtitle">Search for guides, policies, and process documentation</p>
                </div>

                <div style={{ position: 'relative', width: '300px' }}>
                    <FiSearch style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search for answers..."
                        style={{ paddingLeft: '2.5rem', borderRadius: '20px' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem', alignItems: 'start' }}>
                {/* Lateral Navigation */}
                <div className="card" style={{ padding: '1rem 0' }}>
                    <div style={{ padding: '0 1.5rem', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Documentation Topics
                    </div>
                    <nav style={{ display: 'flex', flexDirection: 'column' }}>
                        {filteredTopics.length === 0 ? (
                            <div style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>No results found</div>
                        ) : (
                            filteredTopics.map((topic) => (
                                <button
                                    key={topic.id}
                                    onClick={() => { setActiveTopic(topic.id); setExpandedFaq(null); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.75rem 1.5rem',
                                        border: 'none',
                                        background: activeTopic === topic.id ? 'var(--bg-tertiary)' : 'transparent',
                                        color: activeTopic === topic.id ? 'var(--primary-color)' : 'var(--text-primary)',
                                        borderLeft: activeTopic === topic.id ? '3px solid var(--primary-color)' : '3px solid transparent',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontWeight: activeTopic === topic.id ? 600 : 400,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <topic.icon style={{ fontSize: '1.25rem' }} />
                                    <span>{topic.title}</span>
                                </button>
                            ))
                        )}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="card" style={{ minHeight: '500px' }}>
                    {currentTopicData ? (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', color: 'var(--primary-color)' }}>
                                    <TopicIcon size={32} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0' }}>{currentTopicData.title}</h2>
                                    <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{currentTopicData.content}</p>
                                </div>
                            </div>

                            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Frequently Asked Questions</h3>

                            {currentTopicData.faqs.length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)' }}>No FAQs match your search query in this section.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {currentTopicData.faqs.map((faq, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '8px',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <button
                                                onClick={() => setExpandedFaq(expandedFaq === `${currentTopicData.id}-${idx}` ? null : `${currentTopicData.id}-${idx}`)}
                                                style={{
                                                    width: '100%',
                                                    padding: '1rem 1.25rem',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    background: 'var(--bg-secondary)',
                                                    border: 'none',
                                                    color: 'var(--text-primary)',
                                                    fontWeight: 500,
                                                    cursor: 'pointer',
                                                    textAlign: 'left'
                                                }}
                                            >
                                                <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                                    <FiHelpCircle style={{ color: 'var(--primary-color)', flexShrink: 0, marginTop: '2px' }} size={20} />
                                                    {faq.q}
                                                </span>
                                                <span style={{ fontSize: '1.2rem', transition: 'transform 0.2s', transform: expandedFaq === `${currentTopicData.id}-${idx}` ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                                    ▾
                                                </span>
                                            </button>

                                            {expandedFaq === `${currentTopicData.id}-${idx}` && (
                                                <div style={{ padding: '1.25rem', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                                                    {faq.a}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            <FiSearch size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>No results found</h3>
                            <p style={{ margin: 0, maxWidth: '400px' }}>Try adjusting your search query or selecting a different topic from the sidebar.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
