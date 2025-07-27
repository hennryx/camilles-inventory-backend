const mongoose = require('mongoose');

const SalesSchema = new mongoose.Schema({
    saleDate: {
        type: Date,
        default: Date.now
    },

    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },

        quantity: {
            type: Number,
            required: true
        },
        total: { type: Number, required: true }
    }],

    batchesUsed: [{
        batch: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InventoryBatch'
        },
        quantityUsed: {
            type: Number
        }
    }],

    total: {
        type: Number,
        required: true
    },

    notes: {
        type: String
    },

    createBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Sales', SalesSchema);