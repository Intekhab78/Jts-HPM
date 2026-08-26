const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function createPromoPdf() {
    const outputPath = path.join(__dirname, 'JTS_HR_Payroll_System_Overview.pdf');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.pipe(fs.createWriteStream(outputPath));

    // Header Structure
    doc.fillColor('#0f172a')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('JTS Middle East HR & UAE Payroll System', { align: 'center' })
        .moveDown(0.5);

    doc.fillColor('#3b82f6')
        .fontSize(14)
        .font('Helvetica')
        .text('A Next-Generation, Fully UAE-Compliant Enterprise HR Solution', { align: 'center' })
        .moveDown(2);

    // Body text setup
    doc.fillColor('#334155').fontSize(11).font('Helvetica');

    // Section 1
    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('Core Modules & Features').moveDown(0.5);
    doc.fillColor('#334155').fontSize(11).font('Helvetica');

    const features = [
        "Dynamic Employee Management: Store structural data, visas, emirates IDs, & dynamic pay elements.",
        "Facial Biometric Attendance: Webcam facial capture & GPS locator clock-ins directly from browsers.",
        "WPS Payroll Engine: 100% compliant SIF generation, proration logic, & dynamic basic salary mapping.",
        "Overtime & Penalties: Auto-calculates 1.25x/1.50x Overtime rates & auto-deducts Late/Absent shifts.",
        "Advanced Leave Engine: Deep UAE policies governing Probation locks, dual-gender logic, & Encashment.",
        "End of Service (EOSB): Mathematical Gratuity Calculator for exact legal separation payouts.",
        "Travel & Expense: Submit financial claims through Dual-Tier Line Manager + Finance workflow.",
        "Loans & Advances: Automatically calculates monthly EMI and deducts evenly during Payroll batching.",
        "Role-Based Access: Dedicated portals for Admin, HR, Manager, Finance, and generic Employees."
    ];

    features.forEach(feat => {
        doc.circle(60, doc.y + 4, 3).fill('#3b82f6');
        doc.fillColor('#334155').text(feat, 75, doc.y, { align: 'left' }).moveDown(0.5);
    });

    doc.moveDown(1);

    // Section 2
    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('Why Choose Our System?').moveDown(0.5);
    doc.fillColor('#334155').fontSize(11).font('Helvetica');

    const benefits = [
        "100% Centralized: Eliminate fragmented Excel sheets. Everything from timesheets to payslips is central.",
        "Automated Math: We surgically eliminated manual math. Let the algorithms calculate the variables.",
        "Paperless Approvals: Line Managers review requests via Mobile/Desktop directly in their dashboards.",
        "Instant PDF Generation: Generates beautifully branded digital Payslips directly to your downloads.",
        "Infinite Scalability: The 'Pay Elements' Master allows creating unlimited custom earnings/deductions."
    ];

    benefits.forEach(feat => {
        doc.circle(60, doc.y + 4, 3).fill('#10b981');
        doc.fillColor('#334155').text(feat, 75, doc.y, { align: 'left' }).moveDown(0.5);
    });

    // Draw Footer Separator line
    doc.moveDown(4);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cbd5e1').stroke();
    doc.moveDown(1);

    // Footer contact info
    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('Call Us For Demo', { align: 'center' }).moveDown(0.2);

    doc.fillColor('#3b82f6').fontSize(13).font('Helvetica-Bold').text('Intekhab | Project Head', { align: 'center' }).moveDown(0.5);

    doc.fillColor('#475569').fontSize(11).font('Helvetica')
        .text('+971-522542550  /  +971-528406304', { align: 'center' })
        .text('intekhab@jtsmiddleeast.com', { align: 'center' })
        .fillColor('#2563eb').text('https://www.jtsmiddleeast.com', { align: 'center', link: 'https://www.jtsmiddleeast.com', underline: true });

    doc.end();
    console.log(`PDF successfully generated at: ${outputPath}`);
}

createPromoPdf();
