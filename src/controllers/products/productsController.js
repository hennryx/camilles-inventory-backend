const Product = require('../../models/Products/ProductSchema');
const Transaction = require("../../models/Transaction/TransactionSchema");
const path = require('path');
const fs = require('fs');
const { getTopSellingProducts } = require("../../services/transactionService");
const { getStocksInfo } = require('../../services/inventoryService');

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

        const allProducts = await Product.find({ status: "active"});
        const products = await Product.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .lean();

        const hasCategory = typeof req.query.category === 'string' && req.query.category.trim() !== "";
        const hasSearch = typeof req.query.search === 'string' && req.query.search.trim() !== "";

        const totalItems = ((hasCategory || hasSearch) && category !== 'all')
            ? products.length
            : await Product.countDocuments();

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
        const {minimumStock, outStock, totalNumberItems} = await getStocksInfo(allProducts);

        // Get top-selling products
        const now = new Date();
        const month = now.getMonth() + 1
        const year = now.getFullYear()
        const topProducts = await getTopSellingProducts(month, year, limit);

        // Get distinct categories
        const allCategories = await Product.distinct('category', { status: 'active' });

        res.status(200).json({
            success: true,
            totalItems,
            totalNumberItems,
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
        const totalItems = await Product.countDocuments();

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
exports.getCustomProducts = async (req, res) => {
    try {
        const products = await Product.find({}, { _id: 1, productName: 1 , unitSize: 1, unit: 1, sellingPrice: 1})
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: products,
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
        const { productName, unit, unitSize, sellingPrice, _id, category, containerType, description, brand, page = 1, limit = 5 } = req.body;

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

            product.image = req.image;
        }

        if (productName) product.productName = productName;
        if (unit) product.unit = unit;
        if (unitSize) product.unitSize = unitSize;
        if (sellingPrice) product.sellingPrice = sellingPrice;
        if (category) product.category = category;
        if (containerType) product.containerType = containerType;
        if (description) product.description = description;
        if (brand) product.brand = brand;

        await product.save();

        const allData = await Product.find({ status: 'active'});
        const { minimumStock, outStock, totalNumberItems } = await getStocksInfo(allData)
        res.status(200).json({
            success: true,
            data: product,
            count: allData.length,
            totalNumberItems,
            minimumStock,
            outStock,
            currentPage: Number(page),
            totalPages: Math.ceil(allData.length / limit),
            message: "Product updated successfully!",
        });

    } catch (error) {
        if (req.file) {
            const tempPath = path.join(__dirname, '../../assets/products', req.file.filename);
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }

        console.error(error.message)
        res.status(400).json({
            success: false,
            message: "Something went wrong"
        });
    }
}

/* done Working */
exports.deleteProduct = async (req, res) => {
    try {
        const { _id, page=1, limit=5 } = req.body;

        const product = await Product.findById(_id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        await Product.findByIdAndUpdate(
            _id,
            { status: 'inactive' },
            { new: true }
        );

        const allData = await Product.find({ status: 'active'});
        const { minimumStock, outStock, totalNumberItems } = await getStocksInfo(allData)

        res.status(200).json({
            product: allData,
            success: true,
            count: allData.length,
            totalNumberItems,
            minimumStock,
            outStock,
            currentPage: Number(page),
            totalPages: Math.ceil(allData.length / limit),
            message: "Product marked as inactive successfully!"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}