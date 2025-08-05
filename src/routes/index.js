const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const userRoutes = require('./users/userRoutes');
const suppliersRoutes = require('./suppliers/suppliersRoutes');
const productsRoutes = require("./products/productsRoute");
const purchasesRoutes = require("./purchase/purchaseRoute");
const transactionRoutes = require("./transactions/transactionsRoutes")
const returnsRoutes = require("./returns/returnsRoutes");
const voucherRoutes = require("./vouchers/voucherRoutes");

router.use('/auth', authRoutes);

router.use('/users', userRoutes); 

router.use("/suppliers", suppliersRoutes);

router.use("/products", productsRoutes);

router.use("/purchases", purchasesRoutes);

router.use("/transactions", transactionRoutes);

router.use("/returns", returnsRoutes);

router.use("/vouchers", voucherRoutes)

module.exports = router;