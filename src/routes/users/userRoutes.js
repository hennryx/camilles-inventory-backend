const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middlewares/auth');
const { getAllUsers, updateUser, deleteUser, updateProfile, updatePassword } = require('../../controllers/users/usersController');
const { uploadProfileMiddleware } = require('../../middlewares/uploadMiddleware');

router.get('/getAll', protect, authorize('ADMIN'), getAllUsers);
router.delete('/delete', protect, deleteUser);
router.put('/update', protect, updateUser);

router.put('/update-profile', protect, uploadProfileMiddleware, updateProfile);
router.put('/update-password', protect, updatePassword);

module.exports = router;