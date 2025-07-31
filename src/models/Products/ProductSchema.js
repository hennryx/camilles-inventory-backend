const mongoose = require('mongoose');
const QRCode = require('qrcode');

const ProductSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: [true, 'Please add a product name'],
        trim: true,
        maxlength: [100, 'Product name cannot exceed 100 characters']
    },
    unit: {
        type: String,
        required: true,
        enum: ['pieces', 'l', 'ml']
    },
    unitSize: {
        type: String
    },
    containerType: {
        type: String,
        enum: ['bottle', 'can', 'case']
    },
    sellingPrice: {
        type: Number,
        required: [true, 'Selling price is required'],
        min: [0, 'Price must be positive']
    },
    image: {
        name: String,
        url: String,
        cloudinary_id: String,
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    description: {
        type: String
    },
    brand: {
        type: String
    },
    qrCode: {
        type: String,
        unique: true
    },
    qrCodeData: {
        type: String
    },
    totalStock: {
        type: Number,
        default: 0
    },
    bulkDiscounts: [{
        minQuantity: {
            type: Number,
            min: [1, 'Minimum quantity must be at least 1']
        },
        discountType: {
            type: String,
            enum: ['percentage', 'fixed'],
        },
        discountValue: {
            type: Number,
            min: [0, 'Discount value must be positive']
        }
    }]
}, {
    timestamps: true
});

ProductSchema.pre('save', async function(next) {
    try {
        if (!this.qrCode || this.isNew) {
            const productId = this._id.toString();
            this.qrCodeData = productId;
            const qrCodeDataURL = await QRCode.toDataURL(productId, {
                errorCorrectionLevel: 'L',
                type: 'image/png',
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            this.qrCode = qrCodeDataURL;
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Update totalStock after batch changes
ProductSchema.statics.updateTotalStock = async function (productId) {
    const batches = await mongoose.model('ProductBatch').find({ 'product': productId });
    const totalStock = batches.reduce((sum, batch) => sum + batch.remainingStock, 0);
    /* const totalStock = batches.reduce((sum, batch) => {
        const product = batch.products.find(p => p.product.toString() === productId.toString());
        return sum + (product ? product.remainingStock : 0);
    }, 0); */
    await this.findByIdAndUpdate(productId, { totalStock });
};

module.exports = mongoose.model('Product', ProductSchema);