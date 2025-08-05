const mongoose = require('mongoose');

const VoucherSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Voucher code is required'],
        unique: true,
        trim: true,
        uppercase: true,
        minlength: [4, 'Voucher code must be at least 4 characters'],
        maxlength: [20, 'Voucher code cannot exceed 20 characters'],
        default: function () {
            if (this.isNew) {
                return `VCHR-SAVE${this.voucherValue}`;
            }
            return undefined; // For updates, don't overwrite existing code
        }
    },
    voucherName: {
        type: String,
        required: [true, 'Voucher name is required']
    },
    voucherType: {
        type: String,
        enum: ['percentage', 'fixed', 'bulk'],
        required: [true, 'Voucher type is required']
    },
    voucherValue: {
        type: Number,
        required: [true, 'Voucher value is required'],
        min: [0, 'Voucher value must be positive']
    },
    minPurchase: {
        type: Number,
        default: 0,
        min: [0, 'Minimum purchase amount must be positive']
    },
    maxvoucher: {
        type: Number,
        default: null,
        min: [0, 'Maximum voucher amount must be positive']
    },
    applicableTo: {
        type: String,
        enum: ['all', 'product', 'category'],
        default: 'all'
    },
    applicableIds: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Product',
        required: function () { return this.applicableTo === 'product'; }
    }],
    applicableCategories: [{
        type: String,
        required: function () { return this.applicableTo === 'category'; }
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

VoucherSchema.pre('save', function (next) {
    if (this.validUntil <= this.validFrom) {
        return next(new Error('Valid until date must be after valid from date'));
    }

    if (this.validUntil < new Date()) {
        this.status = 'expired';
    }
    next();
});

module.exports = mongoose.model('Voucher', VoucherSchema);