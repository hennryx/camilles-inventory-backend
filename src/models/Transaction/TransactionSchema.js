const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    products: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },

    }],

    transactionType: {
        type: String,
        enum: ['SALE', 'PURCHASE', 'DAMAGE', 'RETURN'],
        required: true
    },

    notes: {
        type: String
    },

    suppliers: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Supplier',
        required: true
    }],

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);