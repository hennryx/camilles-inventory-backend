const mongoose = require('mongoose');
const ProductBatch = require("../../models/Products/batchSchema");
const SupplierSchema = require("../../models/Supplier/SupplierSchema");
const Transaction = require("../../models/Transaction/TransactionSchema");
const ProductSchema = require('../../models/Products/ProductSchema');

exports.getPurchases = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 5;
        const skip = (page - 1) * limit;
        let search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const regex = search ? new RegExp(search, 'i') : null;

        let startDate = null
        let endDate = null
        let supplierCompanyName = ""
        let filters = req.query.filters ? JSON.parse(req.query.filters) : null;
        if (filters) {
            const { date, supplier } = filters;
            startDate = date?.start ? new Date(date?.start) : null;
            endDate = date?.end ? new Date(date?.end) : null;
            supplierCompanyName = typeof supplier === 'string' ? supplier.trim() : '';
        }
        const escapedSupplierCompanyName = supplierCompanyName ? new RegExp(supplierCompanyName, 'i') : null;

        const pipeline = [
            {
                $match: {
                    transactionType: 'PURCHASE',
                    ...(startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && {
                        createdAt: {
                            $gte: startDate,
                            $lte: endDate
                        }
                    })
                }
            },
            {
                $lookup: {
                    from: 'suppliers',
                    localField: 'supplier',
                    foreignField: '_id',
                    as: 'supplier'
                }
            },
            { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'products'
                }
            },
            {
                $match: {
                    ...(search && {
                        $or: [
                            { 'supplier.firstname': regex },
                            { 'supplier.middlename': regex },
                            { 'supplier.lastname': regex },
                            { 'supplier.companyName': regex },
                            { 'products.productName': regex }
                        ]
                    }),
                    ...(supplierCompanyName && {
                        $or: [
                            {'supplier.companyName': escapedSupplierCompanyName}
                        ]
                    })
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]
        const purchases = await Transaction.aggregate(pipeline)

        let totalItems = 0;
        if (search !== "") {
            totalItems = purchases.length
        } else {
            totalItems = await Transaction.countDocuments({ transactionType: "PURCHASE" })
        }

        res.status(200).json({
            count: totalItems,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            success: true,
            data: purchases,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

exports.savePurchase = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { transactionType, items, totalAmount, supplier, purchaseDate, notes, createdBy } = req.body;

        // Validate required fields
        if (transactionType !== 'PURCHASE') {
            throw new Error('Transaction type must be PURCHASE');
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('Items must be a non-empty array');
        }
        if (!totalAmount || totalAmount < 0) {
            throw new Error('Total amount is required and must be non-negative');
        }
        if (!supplier) {
            throw new Error('Supplier is required for PURCHASE transactions');
        }
        if (!createdBy) {
            throw new Error('CreatedBy is required');
        }

        // Validate items structure and product existence
        for (const item of items) {
            if (!item.product || !item.quantity || !item.unitPrice) {
                throw new Error('Each item must have product, quantity, and unitPrice');
            }
            if (item.quantity < 1) {
                throw new Error('Quantity must be at least 1');
            }
            if (item.unitPrice < 0) {
                throw new Error('Unit price must be non-negative');
            }
            if (item.expiryDate === "") {
                throw new Error('expiry date is required');
            }
            const product = await ProductSchema.findById(item.product).session(session);
            if (!product) {
                throw new Error(`Product ${item.product} not found`);
            }
        }

        // Validate supplier
        const supplierDoc = await SupplierSchema.findById(supplier).session(session);
        if (!supplierDoc) {
            throw new Error('Supplier not found');
        }

        // Validate totalAmount
        const calculatedTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        if (calculatedTotal !== totalAmount) {
            throw new Error('Total amount does not match calculated total');
        }

        // Create transaction
        const transaction = new Transaction({
            transactionType,
            transactionDate: purchaseDate ? new Date(purchaseDate) : new Date(),
            items,
            totalAmount,
            supplier,
            notes,
            createdBy
        });

        // Create product batches for each item
        const batches = [];
        for (const item of items) {
            const batch = new ProductBatch({
                product: item.product,
                stock: item.quantity,
                remainingStock: item.quantity,
                purchaseDate: transaction.transactionDate,
                costPrice: item.unitPrice,
                batchNumber: `BATCH-${Date.now()}-${item.product.slice(-6)}`,
                createdBy,
                purchasePrice: item.unitPrice,
                supplier,
                expiryDate: item.expiryDate
            });
            batches.push(batch);
        }

        // Save transaction and batches within the session
        await transaction.save({ session });
        await ProductBatch.insertMany(batches, { session });

        // Commit the transaction
        await session.commitTransaction();

        // Populate transaction for response
        await transaction.populate('items.product', 'productName sellingPrice');
        await transaction.populate('supplier', 'companyName');

        res.status(201).json({
            success: true,
            data: transaction
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ error: error.message });
    } finally {
        session.endSession();
    }
}

exports.updatePurchase = async (req, res) => {
    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No purchase data provided."
            });
        }

        if (!data._id) {
            return res.status(400).json({
                success: false,
                message: "No Record Found"
            });
        }

        const purchase = await ProductBatch.findByIdAndUpdate(data._id, data, { new: true });

        if (!purchase) {
            return res.status(400).json({
                success: false,
                message: "No record Found"
            });
        }

        res.status(200).json({
            message: "Purchase record updated successfully",
            purchase: purchase,
            success: true
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        })
    }

}

exports.deletePurchase = async (req, res) => {
    try {
        const { _id } = req.body;

        if (!_id) {
            return res.status(400).json({
                success: false,
                message: "Missing Id"
            })
        }

        const purchase = await ProductBatch.findByIdAndDelete(_id);

        if (!purchase) {
            return res.status(400).json({
                success: false,
                message: "No record Found"
            });
        }

        res.status(200).json({
            message: "Purchase deleted successfully",
            purchase: purchase,
            success: true
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        })
    }

}