const mongoose = require('mongoose');

const InventoryBatch  = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },

    purchaseItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Purchase.items'
    },

    quantity: {
        type: Number,
        required: true
    },

    remainingQuantity: {
        type: Number,
        required: true
    },

    expiryDate: {
        type: Date,
        required: true
    },

    batchNumber: {
        type: String
    },

    isConsumed: {
        type: Boolean,
        default: false
    },

    recievedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    }

}, {
    timestamps: true
});

module.exports = mongoose.model('Inventory', InventoryBatch);