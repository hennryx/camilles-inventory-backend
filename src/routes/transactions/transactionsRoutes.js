const express = require('express');
const { protect } = require('../../middlewares/auth');
const { getTransactions, getTransactionsToday } = require('../../controllers/transactions/transactionControllers');
const router = express.Router()

router.get('/getAll', protect, getTransactions);

module.exports = router;