const express = require('express');
const { getReturns, saveReturn, updateReturn, deleteReturn } = require('../../controllers/returns/returnsController');
const { protect } = require('../../middlewares/auth');
const router = express.Router();

router.get('/getAll', protect, getReturns);
router.post('/save', protect, saveReturn);
router.put('/update', protect, updateReturn);
router.delete('/delete', protect, deleteReturn);

module.exports = router;