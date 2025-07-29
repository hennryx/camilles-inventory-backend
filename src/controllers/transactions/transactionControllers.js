const Transaction = require('../../models/Transaction/TransactionSchema')

exports.getTransactions = async (req, res) => {
    try {
        const { startOfDay, endOfDay, type } = req.query
        let query = {}

        if(startOfDay && endOfDay) {
            query = {
                createdAt: {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            };
        }

        if (type !== "All") {
            query.transactionType = type;
        }

        const transactions = await Transaction.find(query).populate('products.product').populate('suppliers').populate('createdBy');
        
        res.status(200).json({
            success: true,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

exports.deductStock = async (req, res) => {
    try {
        const { transactionType, items, totalAmount, notes, createdBy } = req.body;

        // Validate required fields
        if (!transactionType || !items || !totalAmount || !createdBy) {
            return res.status(400).json({ error: 'Missing required fields: transactionType, items, totalAmount, createdBy' });
        }

        if (!['SALE', 'DAMAGE'].includes(transactionType)) {
            return res.status(400).json({ error: 'Invalid transactionType. Must be SALE or DAMAGE' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Items must be a non-empty array' });
        }

        // Validate items structure
        for (const item of items) {
            if (!item.product || !item.quantity || !item.unitPrice) {
                return res.status(400).json({ error: 'Each item must have product, quantity, and unitPrice' });
            }
            if (item.quantity < 1) {
                return res.status(400).json({ error: 'Quantity must be at least 1' });
            }
            if (item.unitPrice < 0) {
                return res.status(400).json({ error: 'Unit price must be non-negative' });
            }
        }

        // Validate totalAmount
        const calculatedTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        if (calculatedTotal !== totalAmount) {
            return res.status(400).json({ error: 'Total amount does not match calculated total' });
        }

        // Create transaction
        const transaction = await Transaction.create({
            transactionType,
            transactionDate: new Date(),
            items,
            totalAmount,
            notes,
            createdBy
        });

        // Populate product details for response
        await transaction.populate('items.product', 'productName sellingPrice');

        res.status(201).json({
            success: true,
            data: transaction
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};