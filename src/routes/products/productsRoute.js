const express = require('express');
const router = express.Router()

const { getCustomProducts, getAllProducts, getProducts, getIndividualProduct, addProduct, deleteProduct, updateProduct } = require('../../controllers/products/productsController');
const { deductStock } = require('../../controllers/transactions/transactionControllers')
const { protect } = require('../../middlewares/auth');
const { uploadMiddleware } = require('../../middlewares/uploadMiddleware');

/* high roles access e.g admin staff*/
router.get('/getAll', protect, getProducts);
router.put('/update', protect, uploadMiddleware, updateProduct);
router.delete('/delete', protect, deleteProduct);
router.post('/save', protect, uploadMiddleware, addProduct);

/* low roles e.g customer*/
router.get('/get', protect, getIndividualProduct);
router.get('/getAllProducts', protect, getAllProducts);
router.get('/getCustomProducts', protect, getCustomProducts);

router.post('/deduct', protect, deductStock)

module.exports = router;