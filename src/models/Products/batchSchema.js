const mongoose = require('mongoose');

const ProductBatchSchema = new mongoose.Schema({
    batchNumber: {
        type: String,
        required: true,
        unique: true
    },
    supplier: {
        type: mongoose.Schema.ObjectId,
        ref: 'Supplier',
        required: true
    },
    product: {
        type: mongoose.Schema.ObjectId,
        ref: 'Product',
        required: true
    },
    stock: {
        type: Number,
        required: true,
        min: [0, 'Stock cannot be negative']
    },
    remainingStock: {
        type: Number,
        required: true,
        min: [0, 'Remaining stock cannot be negative']
    },
    expiryDate: {
        type: Date,
        required: true
    },
    purchasePrice: {
        type: Number,
        required: true,
        min: [0, 'Price must be positive']
    },
    purchaseDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Generate unique batch number
ProductBatchSchema.pre('save', async function(next) {
    if (this.isNew && !this.batchNumber) {
        this.batchNumber = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    next();
});

// Update Product.totalStock after save
ProductBatchSchema.post('save', async function() {
    await mongoose.model('Product').updateTotalStock(this.product);
});

// Update Product.totalStock after removal
ProductBatchSchema.post('remove', async function() {
    await mongoose.model('Product').updateTotalStock(this.product);
});

module.exports = mongoose.model('ProductBatch', ProductBatchSchema);