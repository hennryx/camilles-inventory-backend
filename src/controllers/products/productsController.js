const mongoose = require("mongoose");
const Product = require('../../models/Products/ProductSchema');
const ProductBatch = require("../../models/Products/batchSchema");
const Transaction = require("../../models/Transaction/TransactionSchema");
const path = require('path');
const fs = require('fs');
const { getTopSellingProducts } = require("../../services/transactionService");

/* done Working */
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

        if (search && search.toLowerCase() !== 'all') {
            query.$or = [
                { productName: { $regex: search, $options: 'i' } },
                { unit: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        if (category && category.toLowerCase() !== 'all') {
            query.category = { $regex: category, $options: 'i' };
        }

        const totalItems = await Product.countDocuments(query);

        const products = await Product.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .lean();

        const soldData = await Transaction.aggregate([
            {
                $match: {
                    transactionType: 'SALE'
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    totalSold: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } }
                }
            }
        ]);

        const soldMap = {};
        soldData.forEach(item => {
            if (item._id) {
                soldMap[item._id.toString()] = { totalSold: item.totalSold, totalRevenue: item.totalRevenue };
            }
        });

        const productsWithStock = products.map(prod => ({
            ...prod,
            totalSold: soldMap[prod._id.toString()]?.totalSold || 0,
            totalRevenue: soldMap[prod._id.toString()]?.totalRevenue || 0
        }));

        // Calculate stock metrics
        const minimumStock = productsWithStock.filter(p => p.totalStock <= 10 && p.totalStock > 0).length;
        const outStock = productsWithStock.filter(p => p.totalStock === 0).length;

        // Get top-selling products
        const now = new Date();
        const month = now.getMonth() + 1
        const year = now.getFullYear()
        const topProducts = await getTopSellingProducts(month, year, limit);

        // Get distinct categories
        const allCategories = await Product.distinct('category', { status: 'active' });
        allCategories.unshift('all'); // Add 'all' option

        res.status(200).json({
            success: true,
            totalItems,
            minimumStock,
            outStock,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            data: productsWithStock,
            topProducts,
            allCategories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/* done Working */
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
        res.status(200).json({
            success: true,
            data: product,
            message: "Product fetch Successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/* done Working */
exports.getAllProducts = async (req, res) => {
    try {
        // Parse query parameters for optional pagination
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 100); // Default high limit for "all"
        const skip = (page - 1) * limit;
        const showInactive = req.query.showInactive === 'true';

        // Build query
        let query = {};
        if (!showInactive) {
            query.status = 'active';
        }

        // Get total items for pagination
        const totalItems = await Product.countDocuments(query);

        // Fetch products with pagination and sorting
        const products = await Product.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .lean();

        // Aggregate sales data for July 2025
        const soldData = await Transaction.aggregate([
            {
                $match: {
                    transactionType: 'SALE',
                    transactionDate: {
                        $gte: new Date('2025-07-01T00:00:00.000Z'),
                        $lte: new Date('2025-07-31T23:59:59.999Z')
                    }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    totalSold: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } }
                }
            }
        ]);

        // Map sales data
        const soldMap = {};
        soldData.forEach(item => {
            if (item._id) {
                soldMap[item._id.toString()] = { totalSold: item.totalSold, totalRevenue: item.totalRevenue };
            }
        });

        // Map products with stock and sales data
        const productsWithStock = products.map(prod => ({
            ...prod,
            totalSold: soldMap[prod._id.toString()]?.totalSold || 0,
            totalRevenue: soldMap[prod._id.toString()]?.totalRevenue || 0
        }));

        // Calculate stock metrics
        const minimumStock = productsWithStock.filter(p => p.totalStock <= 10 && p.totalStock > 0).length;
        const outStock = productsWithStock.filter(p => p.totalStock === 0).length;

        // Get top-selling products
        let topProducts = [];
        try {
            topProducts = await getTopSellingProducts();
        } catch (error) {
            // Return empty array instead of failing
            topProducts = [];
        }

        // Get distinct categories
        const allCategories = await Product.distinct('category', { status: 'active' });
        allCategories.unshift('all');

        res.status(200).json({
            success: true,
            totalItems,
            minimumStock,
            outStock,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            data: productsWithStock,
            topProducts,
            allCategories
        });
    } catch (error) {
        console.error('Error in getAllProducts:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

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

/* done Working */
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