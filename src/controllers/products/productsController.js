const mongoose = require("mongoose");
const Product = require('../../models/Products/ProductSchema');
const ProductBatch = require("../../models/Products/batchSchema");
const Transaction = require("../../models/Transaction/TransactionSchema");
const path = require('path');
const fs = require('fs');

exports.getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const category = req.query.category || '';
        const showInactive = req.query.showInactive === 'true';

        let query = {};

        if (!showInactive) {
            query.status = 'active';
        }

        if (search && search.trim().toLowerCase() !== 'all') {
            query.$or = [
                { productName: { $regex: search, $options: 'i' } },
                { unit: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        if (category && category.trim().toLowerCase() !== 'all') {
            query.category = { $regex: category, $options: 'i' };
        }

        const totalItems = await Product.countDocuments(query);

        const products = await Product.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .lean();

        const stockData = await ProductBatch.aggregate([
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.product',
                    totalStock: { $sum: '$products.remainingStock' }
                }
            }
        ]);

        const soldData = await Transaction.aggregate([
            {
                $match: {
                    transactionType: 'SALE'
                }
            },
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.product',
                    totalSold: { $sum: '$products.quantity' }
                }
            }
        ]);

        const stockMap = {};
        stockData.forEach(item => {
            if (item._id) {
                stockMap[item._id.toString()] = item.totalStock;
            }
        });

        const soldMap = {};
        soldData.forEach(item => {
            if (item._id) {
                soldMap[item._id.toString()] = item.totalSold;
            }
        });

        const productsWithStock = products.map(prod => ({
            ...prod,
            inStock: stockMap[prod._id.toString()] || 0,
            totalSold: soldMap[prod._id.toString()] || 0
        }));

        const activeProducts = productsWithStock.filter(p => p.status === 'active');

        const minimumStock = activeProducts.filter(p => p.inStock <= 10 && p.inStock !== 0).length;
        const outStock = activeProducts.filter(p => p.inStock === 0).length;

        const topProducts = await getTopSellingProductsThisMonth();

        const allActiveProducts = await Product.find({ status: 'active' }).lean();
        const allActiveProductsWithStock = allActiveProducts.map(prod => ({
            ...prod,
            inStock: stockMap[prod._id.toString()] || 0,
            totalSold: soldMap[prod._id.toString()] || 0
        }));

        /* const productsWithStockOnly = allActiveProductsWithStock.filter(p => p.inStock > 0); */

        const allCategories = ["all", ...new Set(allActiveProductsWithStock.map(product => product.category))];

        res.status(200).json({
            success: true,
            totalItems,
            minimumStock,
            outStock,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            data: productsWithStock,
            topProducts,
            allCategories: allCategories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.getIndividualProduct = async (req, res) => {
    try {
        const id = req.query.id;

        if (!id) {
            res.status(400).json({
                success: false,
                message: "Missing Id"
            });
        }

        const product = await Product.findById(id);

        const stockData = await ProductBatch.aggregate([
            { $unwind: '$products' },
            {
                $group: {
                    _id: id,
                    totalStock: { $sum: '$products.remainingStock' }
                }
            }
        ]);

        const totalStock = stockData.length > 0 ? stockData[0].totalStock : 0;

        console.log(stockData)
        const productWithStock = {
            ...product.toObject(),
            inStock: totalStock
        };


        res.status(200).json({
            success: true,
            data: productWithStock,
            message: "Product fetch Successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.getAllProducts = async (req, res) => {
    try {
        const totalItems = await Product.countDocuments();

        const products = await Product.find()
            .sort({ createdAt: -1 })
            .lean();

        const stockData = await ProductBatch.aggregate([
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.product',
                    totalStock: { $sum: '$products.remainingStock' }
                }
            }
        ]);

        const stockMap = {};
        stockData.forEach(item => {
            if (item._id) {
                stockMap[item._id?.toString()] = item.totalStock;
            }
        });

        const productsWithStock = products.map(prod => ({
            ...prod,
            inStock: stockMap[prod._id.toString()] || 0
        }));

        const activeProducts = productsWithStock.filter(p => p.status === 'active');

        const minimumStock = activeProducts.filter(p => p.inStock <= 10 && p.inStock !== 0).length;
        const outStock = activeProducts.filter(p => p.inStock === 0).length;

        let topProducts = [];
        try {
            topProducts = await getTopSellingProductsThisMonth();
        } catch (error) {
            console.error('Error getting top products:', error);
        }

        res.status(200).json({
            success: true,
            totalItems,
            minimumStock,
            outStock,
            data: productsWithStock,
            topProducts
        });
    } catch (error) {
        console.error('Error in getAllProducts:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

const getTopSellingProductsThisMonth = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Get top selling products for this month
    const topProductsThisMonth = await Transaction.aggregate([
        {
            $match: {
                transactionType: 'SALE',
                createdAt: {
                    $gte: startOfMonth,
                    $lt: endOfMonth
                }
            }
        },
        { $unwind: '$products' },
        {
            $group: {
                _id: '$products.product',
                monthlySold: { $sum: '$products.quantity' }
            }
        },
        { $sort: { monthlySold: -1 } },
        { $limit: 10 }
    ]);

    // Get all-time total sales for these products
    const productIds = topProductsThisMonth.map(item => item._id);

    const allTimeSales = await Transaction.aggregate([
        {
            $match: {
                transactionType: 'SALE'
            }
        },
        { $unwind: '$products' },
        {
            $match: {
                'products.product': { $in: productIds }
            }
        },
        {
            $group: {
                _id: '$products.product',
                totalSold: { $sum: '$products.quantity' }
            }
        }
    ]);

    // Create a map for all-time sales lookup
    const allTimeSalesMap = {};
    allTimeSales.forEach(item => {
        if (item._id) {
            allTimeSalesMap[item._id.toString()] = item.totalSold;
        }
    });

    // Combine the data and add product information
    const topProducts = await Transaction.aggregate([
        {
            $match: {
                transactionType: 'SALE',
                createdAt: {
                    $gte: startOfMonth,
                    $lt: endOfMonth
                }
            }
        },
        { $unwind: '$products' },
        {
            $group: {
                _id: '$products.product',
                monthlySold: { $sum: '$products.quantity' }
            }
        },
        { $sort: { monthlySold: -1 } },
        { $limit: 10 },
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'productInfo'
            }
        },
        { $unwind: '$productInfo' },
        {
            $project: {
                productId: '$_id',
                name: '$productInfo.productName',
                monthlySold: 1,
                image: '$productInfo.image',
                price: "$productInfo.sellingPrice",
                status: "$productInfo.status"
            }
        }
    ]);

    const topProductsWithAllTimeSales = topProducts.map(product => ({
        ...product,
        totalSold: allTimeSalesMap[product.productId.toString()] || 0
    }));

    return topProductsWithAllTimeSales;
};

/* done Working */
exports.addProduct = async (req, res) => {
    try {
        const { productName, unit, unitSize, sellingPrice, createdBy, category, ...remaining } = req.body;

        if (!productName || !unit || !unitSize || !sellingPrice) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        const product = await Product.create({
            productName,
            image: req.image,
            unit,
            unitSize,
            sellingPrice,
            createdBy,
            category,
            ...remaining
        });

        res.status(201).json({
            success: true,
            message: "Product added successfully!",
            product
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

/* done Working */
exports.updateProduct = async (req, res) => {
    try {
        const { productName, unit, unitSize, sellingPrice, _id, category } = req.body;

        const product = await Product.findById(_id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (req.file && req.image) {
            // Delete old image from Cloudinary if it exists
            if (product.image && product.image.cloudinary_id) {
                await cloudinary.uploader.destroy(product.image.cloudinary_id);
            }

            // Update image with new Cloudinary data
            product.image = req.image; // From uploadToCloudinary middleware
        }

        if (productName) product.productName = productName;
        if (unit) product.unit = unit;
        if (unitSize) product.unitSize = unitSize;
        if (sellingPrice) product.sellingPrice = sellingPrice;
        if (category) product.category = category;

        await product.save();

        res.status(200).json({
            success: true,
            message: "Product updated successfully!",
            product
        });

    } catch (error) {
        if (req.file) {
            const tempPath = path.join(__dirname, '../../assets/products', req.file.filename);
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }

        res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

exports.deleteProduct = async (req, res) => {
    try {
        const { _id } = req.body;

        const product = await Product.findById(_id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            _id,
            { status: 'inactive' },
            { new: true }
        );

        res.status(200).json({
            product: updatedProduct,
            success: true,
            message: "Product marked as inactive successfully!"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.deductProductStock = async (req, res) => {
    const { products, quantity, ...data } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid products array" });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: "Invalid quantity. Must be a positive number" });
    }

    try {
        const deductionDetails = [];
        const processedProducts = [];
        let remainingToDeduct = 0;
        const supplierIds = new Set();

        for (const productId of products) {
            remainingToDeduct = quantity;

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                continue;
            }

            const product = await Product.findById(productId);
            if (!product || product.status !== 'active') {
                continue;
            }

            const batches = await ProductBatch.find({
                'products.product': productId,
                'products.remainingStock': { $gt: 0 }
            }).sort({ 'products.expiryDate': 1 });

            if (batches.length === 0) {
                console.log(`No available batches found for product ${productId}`);
                continue;
            }

            let deductedFromThisProduct = 0;

            for (const batch of batches) {
                if (remainingToDeduct <= 0) break;

                if (batch.supplier) {
                    supplierIds.add(batch.supplier.toString());
                }

                for (let i = 0; i < batch.products.length; i++) {
                    const item = batch.products[i];

                    if (item.product.toString() === productId && item.remainingStock > 0) {
                        const deduction = Math.min(item.remainingStock, remainingToDeduct);

                        item.remainingStock -= deduction;
                        remainingToDeduct -= deduction;
                        deductedFromThisProduct += deduction;

                        batch.markModified(`products.${i}.remainingStock`);

                        if (deduction > 0) {
                            deductionDetails.push({
                                productId,
                                batchId: batch._id,
                                expiryDate: item.expiryDate,
                                deducted: deduction,
                            });
                        }

                        if (remainingToDeduct <= 0) break;
                    }
                }

                await batch.save();

                if (remainingToDeduct <= 0) break;
            }

            if (deductedFromThisProduct > 0) {
                processedProducts.push({
                    product: productId,
                    quantity: deductedFromThisProduct,
                });
            }

            console.log(`Deducted ${deductedFromThisProduct} units from product ${productId}`);
        }

        const totalDeducted = quantity - remainingToDeduct;

        if (totalDeducted === 0) {
            return res.status(400).json({
                success: false,
                message: "Unable to deduct stock. No available inventory or products are inactive.",
                debug: {
                    requestedProducts: products,
                    requestedQuantity: quantity
                }
            });
        }

        await Transaction.create({
            ...data,
            products: processedProducts,
            suppliers: Array.from(supplierIds),
            deductionDetails,
        });

        const _products = await Product.find({ status: 'active' })
            .limit(5)
            .sort({ createdAt: -1 })
            .lean();

        const stockData = await ProductBatch.aggregate([
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.product',
                    totalStock: { $sum: '$products.remainingStock' }
                }
            }
        ]);

        const stockMap = {};
        stockData.forEach(item => {
            stockMap[item._id.toString()] = item.totalStock;
        });

        const productsWithStock = _products.map(prod => ({
            ...prod,
            inStock: stockMap[prod._id.toString()] || 0
        }));

        return res.status(200).json({
            success: true,
            message: `Successfully deducted ${totalDeducted} unit(s).`,
            data: productsWithStock
        });

    } catch (error) {
        console.error("Stock deduction error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "An error occurred while processing stock deduction",
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};