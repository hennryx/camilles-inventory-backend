const mongoose = require('mongoose');

const ProductsSchema = new mongoose.Schema({
	productName: {
		type: String,
		required: [true, 'Please add a product name'],
		trim: true,
		maxlength: [100, 'Product name cannot exceed 100 characters']
	},

	unit: {
		type: String,
		required: true,
		enum: ['pieces', 'liters', 'ml']
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
		type: String
	},

	createdBy: {
		type: mongoose.Schema.ObjectId,
		ref: 'User',
		required: true
	},

	category: {
		type: String,
		required: true,
	},

	status: {
		type: String,
		enum: ['active', 'inactive'],
		default: 'active'
	},

	description: {
		type: String
	},

	rating: {
		type: Number
	},

	reviewCount: {
		type: Number
	},

	brand: {
		type: String
	},

	type: {
		type: String
	},

	qrCode: {
		type: String,
		unique: true
	},

	qrCodeData: {
		type: String,
	}

}, {
	timestamps: true
});

ProductsSchema.pre('save', async function(next) {
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

module.exports = mongoose.model('Product', ProductsSchema);