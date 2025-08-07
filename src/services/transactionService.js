const Transaction = require('../models/Transaction/TransactionSchema');

// Get top selling products for the current month
exports.getTopSellingProducts = async (month, year, limit = 5) => {
    // Default to current month (July 2025) if not specified
    const date = new Date();
    const targetYear = parseInt(year) || date.getFullYear(); // 2025
    const targetMonth = parseInt(month) || date.getMonth() + 1; // 7 (July)

    // Calculate date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1); // e.g., 2025-07-01
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999); // e.g., 2025-07-31

    return await Transaction.aggregate([
        // Filter for SALE transactions in the specified month
        {
            $match: {
                transactionType: 'SALE',
                transactionDate: {
                    $gte: startDate,
                    $lte: endDate
                }
            }
        },
        // Unwind items array
        {
            $unwind: '$items'
        },
        // Group by product
        {
            $group: {
                _id: '$items.product',
                totalQuantitySold: { $sum: '$items.quantity' },
                totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } }
            }
        },
        // Join with Product collection
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'productDetails'
            }
        },
        // Unwind productDetails
        {
            $unwind: '$productDetails'
        },
        // Project fields
        {
            $project: {
                productId: '$_id',
                productName: '$productDetails.productName',
                image: '$productDetails.image',
                unit: '$productDetails.unit',
                unitSize: '$productDetails.unitSize',
                sellingPrice: '$productDetails.sellingPrice',
                totalStock: '$productDetails.totalStock',
                totalQuantitySold: 1,
                totalRevenue: 1
            }
        },
        // Sort by totalQuantitySold descending
        {
            $sort: { totalQuantitySold: -1 }
        },
        // Limit to specified number of products
        {
            $limit: parseInt(limit)
        }
    ]);
};