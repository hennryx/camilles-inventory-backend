const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middlewares/auth');
const { getAllStaff, updateUser, deleteUser, updateProfile, updatePassword } = require('../../controllers/users/usersController');
const { uploadProfileMiddleware } = require('../../middlewares/uploadMiddleware');

router.get('/getAll', protect, authorize('ADMIN'), getAllStaff);
router.delete('/delete', protect, deleteUser);
router.put('/update', protect, updateUser);

router.put('/update-profile', protect, uploadProfileMiddleware, updateProfile);
router.put('/update-password', protect, updatePassword);

module.exports = router;