const express = require('express');
const { protect } = require('../../middlewares/auth');
const { getVouchers, createVoucher, updateVouchers, deleteVouchers } = require('../../controllers/vouchers/vouchersController');
const router = express.Router()

router.get('/getAll', protect, getVouchers)
router.post('/save', protect, createVoucher)
router.put('/update', protect, updateVouchers)
router.delete('/delete', protect, deleteVouchers)

module.exports = router;