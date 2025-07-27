const express = require('express');
const router = express.Router()

const { getAllProducts, getProducts, getIndividualProduct, addProduct, deleteProduct, updateProduct, deductProductStock } = require('../../controllers/products/productsController');
const { protect } = require('../../middlewares/auth');
const { uploadMiddleware } = require('../../middlewares/uploadMiddleware');

router.get('/getAll', protect, getProducts);
router.get('/get', protect, getIndividualProduct);
router.get('/getAllProducts', protect, getAllProducts);
router.post('/save', protect, uploadMiddleware, addProduct);
router.put('/update', protect, uploadMiddleware, updateProduct);
router.delete('/delete', protect, deleteProduct);

router.post('/deduct', protect, deductProductStock)

module.exports = router;