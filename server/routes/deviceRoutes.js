const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getDevices,
    createDevice,
    updateDevice,
    deleteDevice,
    testCameraStream,
    toggleCameraStream,
    getCameraStatus,
    recordIpCameraPunch,
    recordUnregisteredFaceLog,
    getUnregisteredFaceLogs,
    updateUnregisteredFaceLog,
    deleteUnregisteredFaceLog,
    testVoiceResponse,
    startCameraRecording,
    stopCameraRecording,
    finalizeVideoRecording,
    getVideoRecordings,
    deleteVideoRecording,
    switchToWebcam,
    getLiveCameraStream,
    getLiveCameraSnapshot
} = require('../controllers/deviceController');

// Webhook endpoints called by Python face microservice (unprotected/internal)
router.post('/ip-camera-punch', recordIpCameraPunch);
router.post('/unregistered-face-log', recordUnregisteredFaceLog);
router.post('/recordings/complete', finalizeVideoRecording);

// Live camera video stream & snapshot endpoints (public for standard <img> tags)
router.get('/:id/live-stream', getLiveCameraStream);
router.get('/:id/snapshot', getLiveCameraSnapshot);

// All other device and visitor routes are protected
router.use(protect);

// Voice announcement test
router.post('/test-voice', testVoiceResponse);

// Surveillance Video Recordings routes
router.get('/recordings', getVideoRecordings);
router.delete('/recordings/:id', deleteVideoRecording);

// Unregistered Face Logs routes
router.route('/unregistered-face-logs')
    .get(getUnregisteredFaceLogs);

router.route('/unregistered-face-logs/:id')
    .put(updateUnregisteredFaceLog)
    .delete(deleteUnregisteredFaceLog);

// Device CRUD & Camera control routes
router.route('/')
    .get(getDevices)
    .post(createDevice);

router.post('/test-stream', testCameraStream);

router.route('/:id')
    .put(updateDevice)
    .delete(deleteDevice);

router.post('/:id/toggle-stream', toggleCameraStream);
router.get('/:id/camera-status', getCameraStatus);
router.post('/:id/start-recording', startCameraRecording);
router.post('/:id/stop-recording', stopCameraRecording);
router.post('/:id/use-webcam', switchToWebcam);

module.exports = router;
