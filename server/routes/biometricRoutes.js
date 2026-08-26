const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
    getLogs,
    pushLogs,
    hikvisionWebhook,
    zkHandshake,
    zkGetRequest,
    zkPostData,
    reprocessLog,
    hikConnectWebhook,
    ivmsWebhook
} = require('../controllers/biometricController');

const apiRouter = express.Router();
const admsRouter = express.Router();

const textParser = express.text({ type: '*/*', limit: '10mb' });

// ZK ADMS Routes (Mounted at /iclock)
admsRouter.route('/cdata')
    .get(zkHandshake)
    .post(textParser, zkPostData);

admsRouter.get('/getrequest', zkGetRequest);

// Management & Webhook Routes (Mounted at /api/biometric)
apiRouter.route('/logs')
    .get(protect, authorize('admin', 'hr'), getLogs)
    .post(protect, authorize('admin', 'hr'), pushLogs);

apiRouter.post('/logs/:id/reprocess', protect, authorize('admin', 'hr'), reprocessLog);
apiRouter.post('/hikvision', hikvisionWebhook);
apiRouter.post('/hik-connect', hikConnectWebhook);
apiRouter.post('/ivms', ivmsWebhook);

module.exports = { apiRouter, admsRouter };
