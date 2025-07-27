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