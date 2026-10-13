const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getChannels,
    updateChannelRole,
    broadcastAudio,
    getSecurityAlerts,
    resolveSecurityAlert,
    triggerManualAlert,
    recordSecurityAlertWebhook
} = require('../controllers/nvrController');
const {
    getLiveCameraStream,
    getLiveCameraSnapshot
} = require('../controllers/deviceController');

// Internal webhook endpoint from Python microservice (unprotected)
router.post('/alerts/webhook', recordSecurityAlertWebhook);

// Live camera video stream & snapshot endpoints (public for standard <img> tags)
router.get('/channels/:id/live-stream', getLiveCameraStream);
router.get('/channels/:id/snapshot', getLiveCameraSnapshot);

// Protected routes for Security / Admin / HR operators
router.use(protect);

router.get('/channels', getChannels);
router.put('/channels/:id/role', updateChannelRole);
router.post('/channels/:id/broadcast', broadcastAudio);

router.get('/alerts', getSecurityAlerts);
router.put('/alerts/:id/resolve', resolveSecurityAlert);
router.post('/alerts/manual', triggerManualAlert);

module.exports = router;
