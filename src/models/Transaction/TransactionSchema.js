const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
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
        required: function() { return this.transactionType === 'PURCHASE'; }
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

// FIFO stock deduction for sales, damages, and returns
TransactionSchema.pre('save', async function(next) {
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
});

module.exports = mongoose.model('Transaction', TransactionSchema);