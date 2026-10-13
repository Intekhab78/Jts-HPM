const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://hcm.jtsmiddleeast.com',
    'http://hcm.jtsmiddleeast.com',
    'https://hcmapi.jtsmiddleeast.com',
    'http://hcmapi.jtsmiddleeast.com',
    'https://hcm.jtsonline.shop',
    'http://hcm.jtsonline.shop',
    process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Mobile apps and non-browser clients send no origin
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || origin.endsWith('jtsmiddleeast.com') || origin.endsWith('jtsonline.shop')) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/approvals', require('./routes/approvalRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/leaves', require('./routes/leaveRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/travels', require('./routes/travelRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/advances', require('./routes/advanceRoutes'));
app.use('/api/appraisals', require('./routes/appraisalRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/holidays', require('./routes/holidayRoutes'));
app.use('/api/masters', require('./routes/masterRoutes'));
app.use('/api/pay-elements', require('./routes/payElementRoutes'));
app.use('/api/leave-settings', require('./routes/leaveSettingsRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/kiosk', require('./routes/kioskRoutes'));
app.use('/api/devices', require('./routes/deviceRoutes'));
app.use('/api/nvr', require('./routes/nvrRoutes'));
app.use('/api/shifts', require('./routes/shiftRoutes'));

// Biometric & ADMS Integration Routes
const { apiRouter, admsRouter } = require('./routes/biometricRoutes');
app.use('/iclock', admsRouter);
app.use('/api/biometric', apiRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'HR Payroll API is running', timestamp: new Date() });
});

// Error handler
app.use(errorHandler);

// Background Jobs
const cron = require('node-cron');
const attendanceService = require('./services/attendanceService');

cron.schedule('55 23 * * *', async () => {
    try {
        console.log('Running end-of-day missing punch-out check...');
        const today = new Date();
        const count = await attendanceService.flagMissingPunchOuts(today);
        console.log(`Flagged ${count} missing punch-outs for ${today.toISOString().split('T')[0]}`);
    } catch (err) {
        console.error('Cron Error - Missing Punch Outs:', err.message);
    }
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    
    // Initialize Self-Healing Biometric Face Recognition Supervisor
    const faceServiceManager = require('./services/faceServiceManager');
    faceServiceManager.startSupervisor();
});

// Process Level Safety Handlers: Prevent crashes on socket drops or stream aborts
process.on('uncaughtException', (err) => {
    console.error('[Process Uncaught Exception]:', err.message || err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.warn('[Process Unhandled Rejection]:', reason);
});

module.exports = app;
