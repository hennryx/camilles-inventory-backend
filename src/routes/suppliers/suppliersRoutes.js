const express = require('express');
const { getAllSuppliers, addSupplier, deleteSupplier, updateSupplier } = require('../../controllers/suppliers/suppliersControllers');
const { protect } = require('../../middlewares/auth');
const router = express.Router()

router.get('/getAll', protect, getAllSuppliers)
router.post('/save', protect, addSupplier)
router.delete('/delete', protect, deleteSupplier)
router.put('/update', protect, updateSupplier)

module.exports = router;