const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'Users',
        required: false // Allow guest users (no user ID)
    },
    sessionId: {
        type: String,
        required: function() { return !this.user; } // Required for guest users
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
        },
        discount: {
            type: Number,
            default: 0,
            min: [0, 'Discount cannot be negative']
        }
    }],
    totalAmount: {
        type: Number,
        required: true,
        min: [0, 'Total amount must be positive']
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '24h' // Auto-delete after 24 hours for abandoned carts
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Update totalAmount before saving
CartSchema.pre('save', async function (next) {
    this.totalAmount = this.items.reduce((total, item) => {
        return total + (item.quantity * (item.unitPrice - (item.discount || 0)));
    }, 0);
    next();
});

// Clear cart after order is placed
CartSchema.statics.clearCart = async function (cartId) {
    await this.deleteOne({ _id: cartId });
};

module.exports = mongoose.model('Cart', CartSchema);