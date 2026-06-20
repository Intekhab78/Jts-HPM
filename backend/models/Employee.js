const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
    {
        // Personal Information
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        dob: { type: Date, required: true },
        gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
        nationality: { type: String, required: true },
        maritalStatus: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed'], default: 'Single' },
        phone: { type: String },
        emergencyContact: {
            name: { type: String },
            relation: { type: String },
            phone: { type: String }
        },

        // Employment Information
        employeeId: { type: String, required: true, unique: true }, // Auto-generated
        email: { type: String, required: true, unique: true }, // Corporate Email / Login ID
        department: { type: String, required: true },
        designation: { type: String, required: true },
        manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // Direct Reporting Manager
        dateOfJoining: { type: Date, required: true },
        profilePhoto: { type: String },
        probationEndDate: { type: Date },
        isProbationActive: { type: Boolean, default: true },
        contractType: { type: String, enum: ['Permanent', 'Contract', 'Temporary'], default: 'Permanent' },
        molContractType: { type: String, enum: ['Limited', 'Unlimited'], default: 'Unlimited' }, // UAE MOHRE specific
        company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
        location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },

        // Visa & Passport Information (UAE specific)
        visaType: { type: String, enum: ['Employment', 'Golden', 'Partner', 'Dependent'], default: 'Employment' },
        visaExpiry: { type: Date },
        emiratesId: { type: String },
        passportNo: { type: String },
        passportExpiry: { type: Date },

        // Salary Information (WPS related)
        basicSalary: { type: Number, default: 0 },
        payElements: [{
            element: { type: mongoose.Schema.Types.ObjectId, ref: 'PayElement' },
            amount: { type: Number, required: true }
        }],

        // Bank Details (For WPS)
        bankName: { type: String },
        accountNo: { type: String },
        iban: { type: String },
        wpsAgentCode: { type: String },

        // Documents (References or URLs to uploaded files)
        documents: {
            passport: { type: String },
            visa: { type: String },
            emiratesIdDoc: { type: String },
            contract: { type: String },
            others: [{ name: String, fileUrl: String }]
        },

        // Status & Policies
        onboardingStatus: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
        isActive: { type: Boolean, default: true },
        leavePolicy: { type: String, default: 'Standard UAE' }, // e.g., references another policy table later
    },
    { timestamps: true }
);

module.exports = mongoose.model('Employee', employeeSchema);
