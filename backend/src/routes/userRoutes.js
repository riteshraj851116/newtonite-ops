const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUserRole,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/roleAuth');

// All user routes require authentication
router.use(protect);

router.get('/', authorizeRoles('Admin', 'Manager'), getAllUsers);
router.get('/:id', getUserById);
router.put('/:id/role', authorizeRoles('Admin'), updateUserRole);

module.exports = router;
