const mongoose = require("mongoose");

const productBatchSchema = new mongoose.Schema({

    supplier: {
        type: mongoose.Schema.ObjectId,
        ref: 'Supplier',
        required: true
    },

    products: [{
        product: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product',
            required: true
        },

        stock: {
            type: Number,
            required: true
        },

        remainingStock: {
            type: Number,
            required: true
        },
        
        expiryDate: { 
            type: Date,
            required: true
        },
    
        price: { 
            type: Number, 
            required: true 
        },
    }],

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
})

module.exports = mongoose.model('ProductBatch', productBatchSchema)