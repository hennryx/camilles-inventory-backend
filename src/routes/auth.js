const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const { login, register, logout, provideToken } = require('../controllers/authControllers');
const { getAllStaff } = require('../controllers/users/usersController');
const { forgotPassword, resetPassword } = require('../controllers/auth/passwordResetController');

router.post('/login', login);
router.post('/signup', register);
router.post('/logout', protect, logout)
router.get('/validateToken', protect, provideToken)

router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

router.get('/users', protect, authorize('admin'), getAllStaff);

module.exports = router;