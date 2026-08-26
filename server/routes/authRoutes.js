const express = require('express');
const router = express.Router();
const { register, login, getMe, refreshToken, logout, getUsers, updateUserRole, changePassword, resetUserPassword } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.get('/users', protect, authorize('admin', 'hr'), getUsers);
router.put('/users/:id/role', protect, authorize('admin', 'hr'), updateUserRole);
router.put('/change-password', protect, changePassword);
router.put('/users/:id/reset-password', protect, authorize('admin', 'hr'), resetUserPassword);

module.exports = router;
