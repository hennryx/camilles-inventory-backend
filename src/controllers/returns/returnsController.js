const Transaction = require('../../models/Transaction/TransactionSchema');
const ProductBatch = require('../../models/Products/batchSchema');

exports.getReturns = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = { transactionType: 'RETURN' };

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const returns = await Transaction.find(query)
            .populate('products.product')
            .populate('suppliers')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: returns.length,
            data: returns
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.saveReturn = async (req, res) => {
    try {
        const { products, notes, transactionType, createdBy } = req.body;

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No products specified for return'
            });
        }

        const returnTransaction = await Transaction.create({
            products,
            notes,
            transactionType,
            createdBy,
            suppliers: []
        });

        for (const item of products) {
            const latestBatch = await ProductBatch.findOne({
                'products.product': item.product
            }).sort({ createdAt: -1 });

            if (latestBatch) {
                const productIndex = latestBatch.products.findIndex(
                    p => p.product.toString() === item.product
                );

                if (productIndex !== -1) {
                    latestBatch.products[productIndex].remainingStock += item.quantity;
                    await latestBatch.save();
                }
            }
        }

        res.status(201).json({
            success: true,
            message: 'Return processed successfully',
            returnData: returnTransaction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateReturn = async (req, res) => {
    try {
        const { _id, products, notes } = req.body;

        if (!_id) {
            return res.status(400).json({
                success: false,
                message: 'Return ID is required'
            });
        }

        const existingReturn = await Transaction.findById(_id);

        if (!existingReturn) {
            return res.status(404).json({
                success: false,
                message: 'Return not found'
            });
        }

        for (const item of existingReturn.products) {
            const latestBatch = await ProductBatch.findOne({
                'products.product': item.product
            }).sort({ createdAt: -1 });

            if (latestBatch) {
                const productIndex = latestBatch.products.findIndex(
                    p => p.product.toString() === item.product.toString()
                );

                if (productIndex !== -1) {
                    latestBatch.products[productIndex].remainingStock -= item.quantity;
                    await latestBatch.save();
                }
            }
        }

        existingReturn.products = products;
        existingReturn.notes = notes;
        await existingReturn.save();

        for (const item of products) {
            const latestBatch = await ProductBatch.findOne({
                'products.product': item.product
            }).sort({ createdAt: -1 });

            if (latestBatch) {
                const productIndex = latestBatch.products.findIndex(
                    p => p.product.toString() === item.product.toString()
                );

                if (productIndex !== -1) {
                    latestBatch.products[productIndex].remainingStock += item.quantity;
                    await latestBatch.save();
                }
            }
        }

        res.status(200).json({
            success: true,
            message: 'Return updated successfully',
            returnData: existingReturn
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.deleteReturn = async (req, res) => {
    try {
        const { _id } = req.body;

        if (!_id) {
            return res.status(400).json({
                success: false,
                message: 'Return ID is required'
            });
        }

        const returnToDelete = await Transaction.findById(_id);

        if (!returnToDelete) {
            return res.status(404).json({
                success: false,
                message: 'Return not found'
            });
        }

        for (const item of returnToDelete.products) {
            const latestBatch = await ProductBatch.findOne({
                'products.product': item.product
            }).sort({ createdAt: -1 });

            if (latestBatch) {
                const productIndex = latestBatch.products.findIndex(
                    p => p.product.toString() === item.product.toString()
                );

                if (productIndex !== -1) {
                    latestBatch.products[productIndex].remainingStock -= item.quantity;
                    await latestBatch.save();
                }
            }
        }

        await Transaction.findByIdAndDelete(_id);

        res.status(200).json({
            success: true,
            message: 'Return deleted successfully',
            returnData: returnToDelete
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};