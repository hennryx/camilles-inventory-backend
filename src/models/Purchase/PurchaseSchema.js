const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema({
    supplier: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Supplier', 
        required: true 
    },

    purchaseDate: { 
        type: Date, 
        default: Date.now, 
        required: true 
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

        pricePerUnit: { 
            type: Number, 
            required: true 
        },

        expiryDate: { 
            type: Date,
            required: true
        },

        batchNumber: { 
            type: String
        }
    }],

    totalAmount: { 
        type: Number, 
        required: true 
    },

    paymentDetails: {
        method: { type: String },
        reference: { type: String },
        date: { type: Date }
    },

    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    
    status: {
        type: String,
        enum: ['pending', 'processed', 'cancelled'],
        default: 'pending'
    }

}, {
    timestamps: true
});

module.exports = mongoose.model('Purchase', PurchaseSchema);