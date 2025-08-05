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
        default: 0,
        min: [0, 'Out of stock'],
    }
}, {
    timestamps: true
});

// Notify admins when a staff creates a new product
ProductSchema.post('save', async function() {
    if (this.isNew) {
        const user = await mongoose.model('User').findById(this.createdBy);
        if (user && user.role === 'staff') {
            const admins = await mongoose.model('User').find({ role: 'admin' });
            await mongoose.model('Notification').create({
                message: `Staff ${user.username} created a new product: ${this.productName}`,
                type: 'SYSTEM',
                relatedEntity: this._id,
                entityType: 'Product',
                recipients: admins.map(admin => admin._id),
                createdBy: this.createdBy
            });
        }
    }
});

// Update totalStock after batch changes and check for low/out of stock
ProductSchema.statics.updateTotalStock = async function (productId) {
    const batches = await mongoose.model('ProductBatch').find({ product: productId });
    const totalStock = batches.reduce((sum, batch) => sum + batch.remainingStock, 0);
    const product = await this.findById(productId);
    
    if (product) {
        // Check previous stock to avoid duplicate notifications
        const previousStock = product.totalStock;
        product.totalStock = totalStock;
        await product.save({ validateBeforeSave: false }); // Avoid recursive save

        // Notify if stock is low (≤10) or out (0)
        if (totalStock <= 10 && totalStock > 0 && previousStock > 10) {
            const usersToNotify = await mongoose.model('User').find({ role: { $in: ['admin', 'staff'] } });
            await mongoose.model('Notification').create({
                message: `Product ${product.productName} has low stock: ${totalStock} units remaining`,
                type: 'LOW_STOCK',
                relatedEntity: productId,
                entityType: 'Product',
                recipients: usersToNotify.map(user => user._id)
            });
        } else if (totalStock === 0 && previousStock > 0) {
            const usersToNotify = await mongoose.model('User').find({ role: { $in: ['admin', 'staff'] } });
            await mongoose.model('Notification').create({
                message: `Product ${product.productName} is out of stock`,
                type: 'LOW_STOCK',
                relatedEntity: productId,
                entityType: 'Product',
                recipients: usersToNotify.map(user => user._id)
            });
        }
    }
};
module.exports = mongoose.model('Product', ProductSchema);