const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Advance = require('../models/Advance');
const AdvanceSettlement = require('../models/AdvanceSettlement');
const Holiday = require('../models/Holiday');
const WorkingDayOverride = require('../models/WorkingDayOverride');
const { initiateApproval } = require('./approvalService');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// 1. Process Payroll for a specific month/year
exports.generatePayroll = async (month, year, userId, companyId = null) => {
    // a. Get all active employees, optionally filtered by company
    let empQuery = { isActive: true };
    if (companyId && companyId !== 'all') {
        empQuery.company = companyId;
    }
    const employees = await Employee.find(empQuery).populate('payElements.element');
    const processedRecords = [];

    // b. For each employee, calculate earnings and deductions
    for (const emp of employees) {

        // Skip if already processed
        const existing = await Payroll.findOne({ employee: emp._id, month, year });
        if (existing) {
            processedRecords.push(existing);
            continue;
        }

        // Gather Attendance Data 
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59);

        // Fetch Paid UAE Holidays for the month
        const paidHolidays = await Holiday.find({
            date: { $gte: monthStart, $lte: monthEnd },
            isPaid: true
        });

        // Convert holiday dates to simple strings for quick lookup comparisons
        const paidHolidayDateStrings = paidHolidays.map(h => {
            const d = new Date(h.date);
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        });

        // Calculate Unpaid Leaves (from Leave module) - Mocked for brevity or query Leave model
        // Assume leave logic reduces basic balance here.

        // Get Attendance Penalties and OT
        const attendanceRecords = await Attendance.find({
            employee: emp._id,
            date: { $gte: monthStart, $lte: monthEnd }
        });

        let totalLateMinutes = 0;
        let totalOvertimeHours = 0;
        let totalHolidayOvertimeHours = 0;
        let absentDays = 0;

        attendanceRecords.forEach(record => {
            totalLateMinutes += (record.lateMinutes || 0);
            totalOvertimeHours += (record.overtimeHours || 0);
            totalHolidayOvertimeHours += (record.holidayOvertimeHours || 0);

            if (record.status === 'Absent' || record.status === 'Half Day') {
                const rDate = new Date(record.date);
                const rDateStr = `${rDate.getFullYear()}-${rDate.getMonth()}-${rDate.getDate()}`;

                // Check if there's a WorkingDayOverride for this exact date & employee's company/loc
                // Note: We'll retrieve overrides efficiently above or just query here.
                // For performance, let's query the DB for this specific day.

                // If the employee was 'Absent' but it's a paid UAE/Company holiday, we VOID the deduction
                if (!paidHolidayDateStrings.includes(rDateStr)) {
                    // It's not a standard holiday, but maybe it's a WorkingDayOverride (Full Day Off)?
                    // We can check if `record.status` was converted to 'Public Holiday' by Attendance Service earlier.
                    // If the attendance service marked them 'Absent', it implies they weren't off.
                    // However, manual 'Absent' entries might bypass the calculation logic. So we double check:
                    if (record.status === 'Absent') absentDays += 1;
                    if (record.status === 'Half Day') absentDays += 0.5;
                }
            }
        });

        // Proration Logic (for mid-month joiners)
        const daysInMonth = new Date(year, month, 0).getDate();
        let payableDays = daysInMonth;
        const doj = new Date(emp.dateOfJoining);

        if (doj > monthStart && doj <= monthEnd) {
            // Joined mid-month
            const diffTime = Math.abs(monthEnd - doj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive of join day
            payableDays = diffDays;
        }
        const prorationRatio = payableDays / daysInMonth;

        // Extract dynamic basic salary if present in Pay Elements
        let actualBasicSalary = emp.basicSalary || 0;
        if (actualBasicSalary === 0 && emp.payElements) {
            const basicElement = emp.payElements.find(pe => pe.element?.name?.toLowerCase().includes('basic'));
            if (basicElement) {
                actualBasicSalary = basicElement.amount || 0;
            }
        }

        // Calculations Base
        const dailyBasic = actualBasicSalary / 30; // standard UAE 30-day division
        const hourlyRate = dailyBasic / 8; // 8 hour workday

        // Earnings (Prorated)
        const basic = parseFloat((actualBasicSalary * prorationRatio).toFixed(2));

        let totalAllowances = 0;
        let fullBaseAllowances = 0;
        const allowancesArray = [];

        if (emp.payElements && emp.payElements.length > 0) {
            emp.payElements.forEach(pe => {
                const elementName = pe.element?.name || 'Allowance';
                const elementAmount = pe.amount || 0;

                // Skip the element if we already flagged it as the core Basic Salary
                if (actualBasicSalary === elementAmount && elementName.toLowerCase().includes('basic')) {
                    return;
                }

                fullBaseAllowances += elementAmount;
                const proratedAmount = parseFloat((elementAmount * prorationRatio).toFixed(2));
                totalAllowances += proratedAmount;

                allowancesArray.push({
                    name: elementName,
                    amount: proratedAmount
                });
            });
        }

        // Overtime Pay (General rule UAE: 1.25x for normal OT, 1.50x for holiday/weekend)
        const normalOtPay = totalOvertimeHours * hourlyRate * 1.25;
        const holidayOtPay = totalHolidayOvertimeHours * hourlyRate * 1.50;
        const overtimePay = parseFloat((normalOtPay + holidayOtPay).toFixed(2));

        // Deductions
        // Late penalty: Assume every 60 mins late = 1 hour deduction
        const lateDeduction = parseFloat(((totalLateMinutes / 60) * hourlyRate).toFixed(2));

        // Absent deduction incorporates FULL Basic + Allowances
        const dailyGross = (actualBasicSalary + fullBaseAllowances) / 30;
        const absentDeduction = parseFloat((absentDays * dailyGross).toFixed(2));

        // 3. Advances EMI Calculation
        const activeAdvances = await Advance.find({
            employee: emp._id,
            status: 'Disbursed',
            repaymentStartDate: { $lte: monthEnd }, // Started before or during this month
            // Ensure we only process if amountRepaid < amount (handle floating point safely)
        });

        let loanEMI = 0;
        const advancesToUpdate = [];

        for (const adv of activeAdvances) {
            if (adv.amountRepaid < adv.amount) {
                // Determine monthly deduction, don't overcharge the last payment
                let deduction = adv.emiAmount;
                if (adv.amountRepaid + deduction > adv.amount) {
                    deduction = adv.amount - adv.amountRepaid;
                }

                loanEMI += deduction;

                // Prepare update for the advance record
                advancesToUpdate.push({
                    id: adv._id,
                    deducted: deduction,
                    newTotal: adv.amountRepaid + deduction,
                    isComplete: (adv.amountRepaid + deduction) >= adv.amount
                });
            }
        }

        // 4. Overdue Advance Settlements (Flagged by Finance)
        const pendingSettlements = await AdvanceSettlement.find({
            employee: emp._id,
            status: 'Approved',
            deductFromSalary: true,
            balance: { $gt: 0 } // Extra safety check: only positive balances
        });

        let settlementDeduction = 0;
        const settlementsToUpdate = [];

        for (const st of pendingSettlements) {
            settlementDeduction += st.balance;
            settlementsToUpdate.push(st._id);
        }

        const grossPay = basic + totalAllowances + overtimePay;
        const totalDeductions = lateDeduction + absentDeduction + loanEMI + settlementDeduction;
        const netPay = grossPay - totalDeductions;

        // Create Draft Record
        const payrollRecord = await Payroll.create({
            employee: emp._id,
            month,
            year,
            earnings: {
                basic, allowances: allowancesArray, overtime: overtimePay, bonus: 0
            },
            deductions: {
                leaveDeduction: absentDeduction,
                lateDeduction,
                loanEMI,
                otherDeductions: 0,
                advanceRecoveryDeduction: settlementDeduction // Track settlement balance here
            },
            grossPay,
            totalDeductions,
            netPay,
            status: 'Draft'
        });

        // ONLY mark the advance as repaid if the payroll reaches a finalized/paid state.
        // However, for simplicity in this draft structure, we could update the DB instantly, 
        // or trigger it in a separate Finalize hook. We'll update here conditionally.
        // For a true enterprise app, this goes inside a /finalize endpoint.

        // Note: For settlement deductions, we should technically wait until the draft is approved
        // before marking the settlement flag. For now, the next run will just re-query them if still true.
        if (settlementsToUpdate.length > 0) {
            await AdvanceSettlement.updateMany(
                { _id: { $in: settlementsToUpdate } },
                { $set: { deductFromSalary: false, notes: `Deducted AED ${settlementDeduction} in ${month}/${year} payroll.` } }
            );
        }

        processedRecords.push(payrollRecord);
    }

    return processedRecords;
};

// 2. Gratuity Calculator (UAE Labor Law)
// 1-5 years: 21 days basic salary per year
// 5+ years: 30 days basic salary per year
exports.calculateGratuity = async (employeeId, endDate = new Date()) => {
    const emp = await Employee.findById(employeeId).populate('payElements.element');
    if (!emp) throw new Error('Employee not found');

    const doj = new Date(emp.dateOfJoining);
    const end = new Date(endDate);

    const timeDiff = Math.abs(end.getTime() - doj.getTime());
    const daysWorked = Math.ceil(timeDiff / (1000 * 3600 * 24));
    const yearsWorked = daysWorked / 365;

    let actualBasicSalary = emp.basicSalary || 0;
    if (actualBasicSalary === 0 && emp.payElements) {
        const basicElement = emp.payElements.find(pe => pe.element?.name?.toLowerCase().includes('basic'));
        if (basicElement) {
            actualBasicSalary = basicElement.amount || 0;
        }
    }

    const dailyBasic = actualBasicSalary / 30;

    let gratuityAmount = 0;

    if (yearsWorked >= 1 && yearsWorked <= 5) {
        gratuityAmount = yearsWorked * 21 * dailyBasic;
    } else if (yearsWorked > 5) {
        // First 5 years at 21 days
        const firstFiveAmount = 5 * 21 * dailyBasic;
        // Remaining years at 30 days
        const remainingAmount = (yearsWorked - 5) * 30 * dailyBasic;
        gratuityAmount = firstFiveAmount + remainingAmount;
    }

    // Maximum cap: 2 years total salary (gross)
    let totalAllowances = 0;
    if (emp.payElements) {
        emp.payElements.forEach(pe => {
            if (pe.amount !== actualBasicSalary || !pe.element?.name?.toLowerCase().includes('basic')) {
                totalAllowances += (pe.amount || 0);
            }
        });
    }

    const grossSalary = actualBasicSalary + totalAllowances;
    const maximumCap = 24 * grossSalary;

    if (gratuityAmount > maximumCap) {
        gratuityAmount = maximumCap;
    }

    return {
        yearsWorked: parseFloat(yearsWorked.toFixed(2)),
        daysWorked,
        dailyBasic: parseFloat(dailyBasic.toFixed(2)),
        gratuityAmount: parseFloat(gratuityAmount.toFixed(2))
    };
};

// 3. Generate WPS SIF File Format (Basic Structure)
exports.generateWpsSif = async (month, year) => {
    const payrolls = await Payroll.find({ month, year, status: { $in: ['Approved', 'Paid'] } }).populate('employee');

    if (payrolls.length === 0) {
        throw new Error('No approved payroll records found for this period. Please approve payroll first.');
    }

    /* 
    SIF Format typically consists of a Header record followed by Employee records.
    Fields often include: 
    Employee Routing Code, Employee ID, Agent ID, Account Number, Period, Amount, Fixed Income, Variable Income, Days on leave.
    This is a mocked SIF generator based on standard comma-separated rules.
    */

    let sifContent = '';
    const creationDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const employerAgent = 'YOUR_BANK_WPS_ROUTING_CODE';

    // Header Format: SCR, Employer EDB, Employer Agent, Creation Date, Time, Payroll Month, No of Records, Total Amount
    let totalSalaries = 0;
    payrolls.forEach(p => totalSalaries += p.netPay);

    // Add Header (mocked values for routing codes)
    sifContent += `SCR,MOHRE_ESTABLISHMENT_ID,${employerAgent},${creationDate},1200,${month.toString().padStart(2, '0')}${year},${payrolls.length},${totalSalaries}\n`;

    payrolls.forEach(p => {
        const emp = p.employee;
        const net = p.netPay;
        const basic = p.earnings.basic;

        let totalAllowances = 0;
        if (p.earnings.allowances && p.earnings.allowances.length > 0) {
            p.earnings.allowances.forEach(a => totalAllowances += a.amount);
        }

        // EDR, Employee ID, Agent (Bank Routing), Account/IBAN, Start Date, End Date, Days on Leave, Fixed, Variable
        const bankCode = emp.wpsAgentCode || '000000000'; // Target bank code
        const acc = emp.iban || emp.accountNo || 'NO_ACCOUNT';

        sifContent += `EDR,${emp.employeeId},${bankCode},${acc},...,...,0,${basic},${totalAllowances}\n`;
    });

    const fileName = `SIF_${month}_${year}_${Date.now()}.csv`;
    const filePath = path.join(__dirname, '../uploads/payroll', fileName);

    // Save locally
    const uploadDir = path.join(__dirname, '../uploads/payroll');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    fs.writeFileSync(filePath, sifContent);

    return `/uploads/payroll/${fileName}`;
};

// 4. Generate Employee Payslip PDF
exports.generatePayslipPdf = async (payrollId) => {
    const payroll = await Payroll.findById(payrollId).populate({
        path: 'employee',
        populate: {
            path: 'company'
        }
    });

    if (!payroll) throw new Error('Payroll record not found');

    const doc = new PDFDocument({ margin: 50 });

    const fileName = `Payslip_${payroll.employee.employeeId}_${payroll.month}_${payroll.year}.pdf`;
    const uploadDir = path.join(__dirname, '../uploads/payroll');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    // Dynamic Company Header
    const companyName = payroll.employee.company ? payroll.employee.company.name : 'JTS Group';
    const companyPhone = payroll.employee.company && payroll.employee.company.contactNo ? ` | Tel: ${payroll.employee.company.contactNo}` : '';
    const companyEmail = payroll.employee.company && payroll.employee.company.email ? ` | Email: ${payroll.employee.company.email}` : '';

    doc.fontSize(20).text(companyName, { align: 'center' });
    doc.fontSize(10).text(`Salary Slip${companyPhone}${companyEmail}`, { align: 'center', color: '#666' });
    doc.moveDown();

    // Month/Year
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    doc.fontSize(12).text(`For the month of: ${monthNames[payroll.month - 1]} ${payroll.year}`, { align: 'center' });
    doc.moveDown(2);

    // Employee Details
    doc.fontSize(12).font('Helvetica-Bold').text('Employee Details:');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Name: ${payroll.employee.firstName} ${payroll.employee.lastName}`);
    doc.text(`ID: ${payroll.employee.employeeId}`);
    doc.text(`Designation: ${payroll.employee.designation}`);
    doc.text(`Department: ${payroll.employee.department}`);
    doc.moveDown(2);

    // Salary Table
    const tableTop = 250;

    doc.font('Helvetica-Bold');
    doc.text('Earnings', 50, tableTop);
    doc.text('Amount (AED)', 200, tableTop, { width: 100, align: 'right' });
    doc.text('Deductions', 350, tableTop);
    doc.text('Amount (AED)', 480, tableTop, { width: 70, align: 'right' });

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    doc.font('Helvetica');
    let eY = tableTop + 25;

    const drawRow = (leftText, leftVal, rightText, rightVal, y) => {
        if (leftText) {
            doc.text(leftText, 50, y);
            doc.text(leftVal.toFixed(2), 200, y, { width: 100, align: 'right' });
        }
        if (rightText) {
            doc.text(rightText, 350, y);
            doc.text(rightVal.toFixed(2), 480, y, { width: 70, align: 'right' });
        }
    };

    drawRow('Basic Salary', payroll.earnings.basic, 'Late Deductions', payroll.deductions.lateDeduction, eY); eY += 20;

    // Fixed deductions array to interleave with allowances table right side
    const fixedDeductions = [
        { name: 'Leave Deductions', amount: payroll.deductions.leaveDeduction },
        { name: 'Loans/EMI', amount: payroll.deductions.loanEMI },
        { name: 'Other Deductions', amount: payroll.deductions.otherDeductions }
    ];
    let deducIndex = 0;

    // Draw dynamic allowances
    if (payroll.earnings.allowances && payroll.earnings.allowances.length > 0) {
        payroll.earnings.allowances.forEach((allowance) => {
            let rightText = '';
            let rightVal = 0;
            if (deducIndex < fixedDeductions.length) {
                rightText = fixedDeductions[deducIndex].name;
                rightVal = fixedDeductions[deducIndex].amount;
                deducIndex++;
            }
            drawRow(allowance.name, allowance.amount, rightText, rightVal, eY); eY += 20;
        });
    }

    // Draw any remaining fixed deductions
    while (deducIndex < fixedDeductions.length) {
        drawRow('', 0, fixedDeductions[deducIndex].name, fixedDeductions[deducIndex].amount, eY); eY += 20;
        deducIndex++;
    }

    drawRow('Overtime', payroll.earnings.overtime, '', 0, eY); eY += 20;
    if (payroll.earnings.bonus > 0) {
        drawRow('Bonus/Commission', payroll.earnings.bonus, '', 0, eY); eY += 20;
    }

    doc.moveTo(50, eY).lineTo(550, eY).stroke();
    eY += 10;

    doc.font('Helvetica-Bold');
    drawRow('Gross Earnings', payroll.grossPay, 'Total Deductions', payroll.totalDeductions, eY);

    eY += 30;
    doc.fontSize(14);
    doc.text('Net Transfer Amount:', 50, eY);
    doc.text(`AED ${payroll.netPay.toFixed(2)}`, 200, eY, { width: 100, align: 'right' });

    doc.end();

    // Wrap in promise to wait for stream to finish
    await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });

    return `/uploads/payroll/${fileName}`;
};
