const express = require('express');
const { getPurchases, savePurchase, updatePurchase, deletePurchase } = require('../../controllers/purchase/purchaseController');
const { protect } = require('../../middlewares/auth');
const router = express.Router();

router.get('/getAll', protect, getPurchases)
router.post('/save', protect, savePurchase)
router.put('/update', protect, updatePurchase)
router.delete('/delete', protect, deletePurchase)

module.exports = router;