const mongoose = require('mongoose');

// Function to format date and time for order number
function formatDateForOrderNumber(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}-${hours}${minutes}${seconds}${milliseconds}`;
}

// Function to generate a unique order number
async function generateOrderNumber(transactionDate) {
    const prefix = 'PO'; // Customize prefix as needed
    const formattedDate = formatDateForOrderNumber(transactionDate);
    let orderNumber = `${prefix}-${formattedDate}`;

    // Check for uniqueness
    const existingTransaction = await mongoose.model('Transaction').findOne({ orderNumber });
    if (existingTransaction) {
        // Add a random 4-digit suffix to resolve rare collisions
        const random = Math.floor(1000 + Math.random() * 9000);
        orderNumber = `${prefix}-${formattedDate}-${random}`;
        // Recursively check again to ensure uniqueness
        const stillExists = await mongoose.model('Transaction').findOne({ orderNumber });
        if (stillExists) {
            return generateOrderNumber(transactionDate); // Try again if still not unique
        }
    }
    return orderNumber;
}

const TransactionSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    transactionType: {
        type: String,
        enum: ['SALE', 'PURCHASE', 'DAMAGE', 'RETURN'],
        required: true
    },
    transactionDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, 'Quantity must be at least 1']
        },
        unitPrice: {
            type: Number,
            required: true,
            min: [0, 'Price must be positive']
        }
    }],
    batchesUsed: [{
        batch: {
            type: mongoose.Schema.ObjectId,
            ref: 'ProductBatch',
            required: true
        },
        quantityUsed: {
            type: Number,
            required: true,
            min: [1, 'Quantity used must be at least 1']
        }
    }],
    totalAmount: {
        type: Number,
        required: true,
        min: [0, 'Total amount must be positive']
    },
    supplier: {
        type: mongoose.Schema.ObjectId,
        ref: 'Supplier',
        required: function () { return this.transactionType === 'PURCHASE'; }
    },
    notes: {
        type: String
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Pre-save middleware to generate order number
TransactionSchema.pre('validate', async function (next) {
    if (this.isNew && !this.orderNumber) {
        try {
            this.orderNumber = await generateOrderNumber(this.transactionDate);
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

// FIFO stock deduction for sales, damages, and returns
TransactionSchema.pre('save', async function (next) {
    if (this.isNew && ['SALE', 'DAMAGE', 'RETURN'].includes(this.transactionType)) {
        try {
            for (const item of this.items) {
                const productId = item.product;
                let quantityNeeded = item.quantity;
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const batches = await mongoose.model('ProductBatch')
                    .find({ 
                        product: productId, 
                        remainingStock: { $gt: 0 },
                        status: 'active',
                        condition: 'good',
                        expiryDate: { $gt: today }
                    })
                    .sort({ purchaseDate: 1 });

                this.batchesUsed = this.batchesUsed || [];
                for (const batch of batches) {
                    if (quantityNeeded <= 0) break;
                    const quantityToUse = Math.min(quantityNeeded, batch.remainingStock);
                    batch.remainingStock -= quantityToUse;
                    quantityNeeded -= quantityToUse;
                    this.batchesUsed.push({ batch: batch._id, quantityUsed: quantityToUse });
                    await batch.save();
                }
                if (quantityNeeded > 0) {
                    throw new Error(`Insufficient valid stock for product ${productId}. Check for expired or inactive batches.`);
                }
                await mongoose.model('Product').updateTotalStock(productId);
            }
            
            // Notify admins and staff for SALE transactions (customer orders)
            if (this.transactionType === 'SALE') {
                const products = await mongoose.model('Product').find({
                    _id: { $in: this.items.map(item => item.product) }
                }, 'productName');
                const productNames = products.map(p => p.productName).join(', ');
                const usersToNotify = await mongoose.model('User').find({
                    role: { $in: ['admin', 'staff'] }
                });
                await mongoose.model('Notification').create({
                    message: `Customer order placed (Order #${this.orderNumber}) for products: ${productNames}`,
                    type: 'SYSTEM',
                    relatedEntity: this._id,
                    entityType: 'Transaction',
                    recipients: usersToNotify.map(user => user._id),
                    createdBy: this.createdBy
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});
/* TransactionSchema.pre('save', async function (next) {
    if (this.isNew && ['SALE', 'DAMAGE', 'RETURN'].includes(this.transactionType)) {
        try {
            for (const item of this.items) {
                const productId = item.product;
                let quantityNeeded = item.quantity;
                const batches = await mongoose.model('ProductBatch')
                    .find({ product: productId, remainingStock: { $gt: 0 } })
                    .sort({ purchaseDate: 1 }); // FIFO: oldest first

                this.batchesUsed = this.batchesUsed || [];
                for (const batch of batches) {
                    if (quantityNeeded <= 0) break;
                    const quantityToUse = Math.min(quantityNeeded, batch.remainingStock);
                    batch.remainingStock -= quantityToUse;
                    quantityNeeded -= quantityToUse;
                    this.batchesUsed.push({ batch: batch._id, quantityUsed: quantityToUse });
                    await batch.save();
                }
                if (quantityNeeded > 0) {
                    throw new Error(`Insufficient stock for product ${productId}`);
                }
                await mongoose.model('Product').updateTotalStock(productId);
            }
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
}); */

module.exports = mongoose.model('Transaction', TransactionSchema);