const express = require('express');
const router = express.Router();
const { getRoles, updateRolePermissions, createRole, deleteRole } = require('../controllers/roleController');
const { protect, authorizeAdmin } = require('../middleware/auth');

router.get('/', protect, authorizeAdmin, getRoles);
router.post('/', protect, authorizeAdmin, createRole);
router.put('/:id/permissions', protect, authorizeAdmin, updateRolePermissions);
router.delete('/:id', protect, authorizeAdmin, deleteRole);

module.exports = router;
