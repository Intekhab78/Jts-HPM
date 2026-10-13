const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    verifyPinPunch,
    verifyQrPunch,
    verifyFacePunch,
    syncEmployees,
    syncOfflinePunch
} = require('../controllers/kioskController');

// All kiosk endpoints are protected by user auth credentials
router.use(protect);

router.post('/verify-pin', verifyPinPunch);
router.post('/verify-qr', verifyQrPunch);
router.post('/verify-face', verifyFacePunch);
router.get('/sync-employees', syncEmployees);
router.post('/sync-offline-punch', syncOfflinePunch);

module.exports = router;
