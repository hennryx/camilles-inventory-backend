const mongoose = require('mongoose');
const Transaction = require('../Transaction/TransactionSchema');
const Notification = require('../Notification/NotificationSchema');
const Users = require('../Users');

// Function to generate unique customer order number
async function generateCustomerOrderNumber(orderDate) {
    const prefix = 'CUST';
    const formattedDate = require('./TransactionSchema').formatDateForOrderNumber(orderDate);
    let orderNumber = `${prefix}-${formattedDate}`;
    const existingOrder = await mongoose.model('Order').findOne({ customerOrderNumber: orderNumber });
    if (existingOrder) {
        const random = Math.floor(1000 + Math.random() * 9000);
        orderNumber = `${prefix}-${formattedDate}-${random}`;
        const stillExists = await mongoose.model('Order').findOne({ customerOrderNumber: orderNumber });
        if (stillExists) {
            return generateCustomerOrderNumber(orderDate);
        }
    }
    return orderNumber;
}

const OrderSchema = new mongoose.Schema({
    customerOrderNumber: {
        type: String,
        unique: true,
        required: true
    },
    customer: {
        type: mongoose.Schema.ObjectId,
        ref: 'Users',
        required: false // Allow guest orders
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
    orderStatus: {
        type: String,
        enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELED'],
        default: 'PENDING'
    },
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
        default: 'PENDING'
    },
    paymentMethod: {
        type: String,
        enum: ['CARD', 'CASH_ON_DELIVERY', 'BANK_TRANSFER'],
        required: true
    },
    deliveryAddress: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        required: function() { return this.orderStatus !== 'CANCELED'; }
    },
    orderDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    transaction: {
        type: mongoose.Schema.ObjectId,
        ref: 'Transaction'
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Generate customer order number
OrderSchema.pre('validate', async function (next) {
    if (this.isNew && !this.customerOrderNumber) {
        try {
            this.customerOrderNumber = await generateCustomerOrderNumber(this.orderDate);
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

// Create a transaction when order is confirmed
OrderSchema.pre('save', async function (next) {
    if (this.isModified('orderStatus') && this.orderStatus === 'CONFIRMED' && !this.transaction) {
        try {
            const transaction = new Transaction({
                transactionType: 'SALE',
                transactionDate: this.orderDate,
                items: this.items.map(item => ({
                    product: item.product,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice - (item.discount || 0)
                })),
                totalAmount: this.totalAmount,
                createdBy: this.customer,
                notes: this.notes
            });
            await transaction.save();
            this.transaction = transaction._id;
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

// Notify staff on order status changes
OrderSchema.post('save', async function () {
    if (this.isModified('orderStatus')) {
        const usersToNotify = await Users.find({ role: { $in: ['admin', 'staff'] } });
        const message = `Customer order ${this.customerOrderNumber} status updated to ${this.orderStatus}`;
        await Notification.create({
            message,
            type: 'ORDER_STATUS',
            relatedEntity: this._id,
            entityType: 'Order',
            recipients: usersToNotify.map(user => user._id),
            createdBy: this.customer || 'system'
        });
    }
});

module.exports = mongoose.model('Order', OrderSchema);