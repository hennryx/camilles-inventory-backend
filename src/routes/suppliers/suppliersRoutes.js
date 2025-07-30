const express = require('express');
const { getAllActiveSuppliers, getAllSuppliers, addSupplier, deleteSupplier, updateSupplier } = require('../../controllers/suppliers/suppliersControllers');
const { protect } = require('../../middlewares/auth');
const router = express.Router()

router.get('/getAll', protect, getAllSuppliers)
router.get('/getActive', protect, getAllActiveSuppliers)
router.post('/save', protect, addSupplier)
router.delete('/delete', protect, deleteSupplier)
router.put('/update', protect, updateSupplier)

module.exports = router;