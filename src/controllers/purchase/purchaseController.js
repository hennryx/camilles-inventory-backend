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

            { $unwind: "$items" },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'items.product'
                }
            },
            { $unwind: "$items.product" },
            {
                $addFields: {
                    "items.product": "$items.product",
                    "items.unitPrice": "$items.unitPrice",
                    "items.quantity": "$items.quantity"
                }
            },
            {
                $lookup: {
                    from: 'productbatches',
                    let: { productId: '$items.product._id', batchIds: '$batchesUsed.batch' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$product', '$$productId'] },
                                        { $in: ['$_id', { $ifNull: ['$$batchIds', []] }] }
                                    ]
                                }
                            }
                        },
                        { $limit: 1 } // Assuming one batch per item in PURCHASE
                    ],
                    as: 'batch'
                }
            },
            {
                $unwind: { path: '$batch', preserveNullAndEmptyArrays: true }
            },
            {
                $group: {
                    _id: "$_id",
                    orderNumber: { $first: "$orderNumber" },
                    transactionType: { $first: "$transactionType" },
                    transactionDate: { $first: "$transactionDate" },
                    createdAt: { $first: "$createdAt" },
                    supplier: { $first: "$supplier" },
                    createdBy: { $first: "$createdBy" },
                    totalAmount: { $first: "$totalAmount" },
                    notes: { $first: "$notes" },
                    items: {
                        $push: {
                            product: "$items.product",
                            quantity: "$items.quantity",
                            unitPrice: "$items.unitPrice",
                            expiryDate: "$batch.expiryDate"
                        }
                    }
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
                            { 'items.product.productName': regex }
                        ]
                    }),
                    ...(supplierCompanyName && {
                        $or: [
                            { 'supplier.companyName': escapedSupplierCompanyName }
                        ]
                    })
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'createdBy'
                }
            },
            { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
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

        // Create product batches for each item
        const batches = [];
        for (const item of items) {
            const batch = new ProductBatch({
                product: item.product,
                stock: item.quantity,
                remainingStock: item.quantity,
                purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
                costPrice: item.unitPrice,
                batchNumber: `BATCH-${Date.now()}-${item.product.slice(-6)}`,
                createdBy,
                purchasePrice: item.unitPrice,
                supplier,
                expiryDate: item.expiryDate
            });
            batches.push(batch);
        }

        // Create transaction
        const transaction = new Transaction({
            transactionType,
            transactionDate: purchaseDate ? new Date(purchaseDate) : new Date(),
            items,
            totalAmount,
            supplier,
            notes,
            createdBy,
            batchesUsed: batches.map((batch, i) => ({
                batch: batch._id,
                quantityUsed: items[i].quantity
            }))
        });

        // Save transaction and batches within the session
        await ProductBatch.insertMany(batches, { session });
        await transaction.save({ session });

        // Commit the transaction
        await session.commitTransaction();

        // Populate transaction for response
        await transaction.populate('items.product', 'productName sellingPrice');
        await transaction.populate('supplier', 'companyName');
        await transaction.populate('batchesUsed.batch', 'batchNumber expiryDate');

        res.status(201).json({
            success: true,
            data: transaction,
            message: "New purchase added"
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ error: error.message });
    } finally {
        session.endSession();
    }
}

exports.updatePurchase = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { _id, items, totalAmount, supplier, notes, updatedBy, page = 1, limit = 5 } = req.body;

        // Validate required fields
        if (!_id) {
            throw new Error('Transaction ID is required');
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
        if (!updatedBy) {
            throw new Error('UpdatedBy is required');
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
                throw new Error('Expiry date is required');
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

        // Find existing transaction
        const transaction = await Transaction.findById(_id).session(session);
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        if (transaction.transactionType !== 'PURCHASE') {
            throw new Error('Can only update PURCHASE transactions');
        }

        // Delete old batches associated with this transaction
        await ProductBatch.deleteMany(
            { _id: { $in: transaction.batchesUsed.map(b => b.batch) } },
            { session }
        );

        // Create new product batches for updated items
        const batches = [];
        for (const item of items) {
            const batch = new ProductBatch({
                product: item.product,
                stock: item.quantity,
                remainingStock: item.quantity,
                purchaseDate: transaction.transactionDate,
                costPrice: item.unitPrice,
                batchNumber: `BATCH-${Date.now()}-${item.product.slice(-6)}`,
                createdBy: updatedBy,
                purchasePrice: item.unitPrice,
                supplier,
                expiryDate: item.expiryDate
            });
            batches.push(batch);
        }

        // Update transaction
        transaction.items = items;
        transaction.totalAmount = totalAmount;
        transaction.supplier = supplier;
        transaction.transactionDate = transaction.transactionDate;
        transaction.notes = notes || transaction.notes;
        transaction.updatedBy = updatedBy;
        transaction.batchesUsed = batches.map((batch, i) => ({
            batch: batch._id,
            quantityUsed: items[i].quantity
        }));

        // Save new batches and updated transaction
        await ProductBatch.insertMany(batches, { session });
        await transaction.save({ session });

        // Commit the transaction
        await session.commitTransaction();

        // Populate transaction for response
        await transaction.populate('items.product', 'productName sellingPrice');
        await transaction.populate('supplier', 'companyName');
        await transaction.populate('batchesUsed.batch', 'batchNumber expiryDate');

        const dataCount = await Transaction.countDocuments().session(session);
        res.status(200).json({
            success: true,
            message: 'Purchase updated successfully',
            data: transaction,
            currentPage: page,
            totalPages: Math.ceil(dataCount.length / limit),
        });
    } catch (error) {
        await session.abortTransaction();
        console.log(error.message)
        res.status(400).json({
            success: false,
            message: "Something went wrong"
        });
    } finally {
        session.endSession();
    }
}

exports.deletePurchase = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { _id, page = 1, limit = 5 } = req.body;

        // Validate required fields
        if (!_id) {
            throw new Error('Transaction ID is required');
        }

        // Find the transaction
        const transaction = await Transaction.findById(_id).session(session);
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        if (transaction.transactionType !== 'PURCHASE') {
            throw new Error('Can only delete PURCHASE transactions');
        }

        // Delete associated batches
        await ProductBatch.deleteMany(
            { _id: { $in: transaction.batchesUsed.map(b => b.batch) } },
            { session }
        );

        // Delete the transaction
        await Transaction.deleteOne({ _id }, { session });

        // Commit the transaction
        await session.commitTransaction();

        const deletedTransaction = transaction.toObject();
        const dataCount = await Transaction.countDocuments().session(session);
        res.status(200).json({
            success: true,
            message: 'Purchase deleted successfully',
            data: deletedTransaction,
            currentPage: page,
            totalPages: Math.ceil(dataCount.length / limit),
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({
            success: false,
            message: error.message
        });
    } finally {
        session.endSession();
    }
}