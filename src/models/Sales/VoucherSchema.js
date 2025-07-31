const mongoose = require('mongoose');

const VoucherSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Voucher code is required'],
        unique: true,
        trim: true,
        uppercase: true,
        minlength: [4, 'Voucher code must be at least 4 characters'],
        maxlength: [20, 'Voucher code cannot exceed 20 characters']
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: [true, 'Discount type is required']
    },
    discountValue: {
        type: Number,
        required: [true, 'Discount value is required'],
        min: [0, 'Discount value must be positive']
    },
    minPurchase: {
        type: Number,
        default: 0,
        min: [0, 'Minimum purchase amount must be positive']
    },
    maxDiscount: {
        type: Number,
        default: null,
        min: [0, 'Maximum discount amount must be positive']
    },
    applicableTo: {
        type: String,
        enum: ['all', 'product', 'category'],
        default: 'all'
    },
    applicableIds: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Product',
        required: function() { return this.applicableTo === 'product'; }
    }],
    applicableCategories: [{
        type: String,
        required: function() { return this.applicableTo === 'category'; }
    }],
    validFrom: {
        type: Date,
        required: [true, 'Valid from date is required']
    },
    validUntil: {
        type: Date,
        required: [true, 'Valid until date is required']
    },
    usageLimit: {
        type: Number,
        default: null,
        min: [1, 'Usage limit must be at least 1']
    },
    usedCount: {
        type: Number,
        default: 0,
        min: [0, 'Used count cannot be negative']
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'expired'],
        default: 'active'
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Ensure validUntil is after validFrom
VoucherSchema.pre('save', function(next) {
    if (this.validUntil <= this.validFrom) {
        return next(new Error('Valid until date must be after valid from date'));
    }
    next();
});

// Update status to expired if validity period has ended
VoucherSchema.pre('save', function(next) {
    if (this.validUntil < new Date()) {
        this.status = 'expired';
    }
    next();
});

// Generate unique voucher code if not provided
VoucherSchema.pre('save', async function(next) {
    if (this.isNew && !this.code) {
        this.code = `VCHR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }
    next();
});

module.exports = mongoose.model('Voucher', VoucherSchema);