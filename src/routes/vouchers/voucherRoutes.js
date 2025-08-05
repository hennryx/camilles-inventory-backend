const express = require('express');
const { protect } = require('../../middlewares/auth');
const { getVouchers, createVoucher } = require('../../controllers/vouchers/vouchersController');
const router = express.Router()

router.get('/get', protect, getVouchers)
router.get('/save', protect, createVoucher)

module.exports = router;