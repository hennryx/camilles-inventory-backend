const Transaction = require('../../models/Transaction/TransactionSchema')
const ProductBatchSchema = require('../../models/Products/batchSchema')
const { getStocksInfo } = require('../../services/inventoryService')

exports.getTransactions = async (req, res) => {
    try {
        const { startOfDay, endOfDay, type } = req.query
        let query = {}

        if (startOfDay && endOfDay) {
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
        const { transactionType, items, totalAmount, notes, createdBy, page=1, limit=5 } = req.body;

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

        await ProductBatchSchema.checkExpiredBatches();
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
        await transaction.populate([
            { path: 'items.product', select: 'productName sellingPrice' },
            { path: 'batchesUsed.batch', select: 'batchNumber expiryDate' }
        ]);

        const productIds = items.map(i => i.product);
        const productsUsed = await Product.find({ _id: { $in: productIds }, status: 'active' });
                const { minimumStock, outStock, totalNumberItems } = await getStocksInfo(allData)


        const notifications = await mongoose.model('Notification').find({
            recipients: createdBy,
            isRead: false
        }).populate('relatedEntity', 'batchNumber productName');

        res.status(201).json({
            success: true,
            data: productsUsed,
            totalNumberItems,
            minimumStock,
            outStock,
            currentPage: Number(page),
            totalPages: Math.ceil(allData.length / limit),
            notifications: notifications.length > 0 ? notifications : undefined
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


/* will be used later to get and add notifications */
// Endpoint to get all notifications for a user

// Endpoint to get all notifications for a user
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.body.userId || req.user._id; // Use req.user._id if using auth middleware
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const notifications = await mongoose.model('Notification').find({
            recipients: userId
        })
            .populate('relatedEntity', 'batchNumber productName orderNumber')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: notifications
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Endpoint to mark a notification as read
exports.markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId, userId } = req.body;

        if (!notificationId || !userId) {
            return res.status(400).json({ error: 'Notification ID and User ID are required' });
        }

        const notification = await mongoose.model('Notification').findById(notificationId);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        if (!notification.recipients.includes(userId)) {
            return res.status(403).json({ error: 'User not authorized to mark this notification as read' });
        }

        if (!notification.readBy.some(read => read.user.toString() === userId.toString())) {
            notification.readBy.push({ user: userId });
        }

        if (notification.recipients.every(recipient =>
            notification.readBy.some(read => read.user.toString() === recipient.toString()))) {
            notification.isRead = true;
        }

        await notification.save();

        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Endpoint to get expired batches
exports.getExpiredBatches = async (req, res) => {
    try {
        const notifications = await mongoose.model('ProductBatch').checkExpiredBatches();
        res.status(200).json({
            success: true,
            data: notifications
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};